import { NextResponse } from "next/server";
import { query } from "../../../lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function easternDate() {
  const parts = new Intl.DateTimeFormat("en-US", {timeZone:"America/New_York",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());
  const p = Object.fromEntries(parts.map(x=>[x.type,x.value]));
  return `${p.year}-${p.month}-${p.day}`;
}
function weekWindow(dateText) {
  const d=new Date(`${dateText}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate()-((d.getUTCDay()+5)%7));
  const start=d.toISOString().slice(0,10);
  d.setUTCDate(d.getUTCDate()+6);
  return {start,end:d.toISOString().slice(0,10)};
}
function n(value){const x=Number(value);return Number.isFinite(x)?x:0;}
function clamp(value,min,max){return Math.max(min,Math.min(max,value));}
function average(rows,key){
  let total=0,weight=0;
  rows.forEach((row,i)=>{const w=Math.pow(.88,i);total+=n(row.payload?.[key])*w;weight+=w;});
  return weight?total/weight:0;
}
function injuryFactor(row){
  const status=String(row?.report_status||"").toLowerCase();
  const practice=String(row?.practice_status||"").toLowerCase();
  if(/injured reserve|reserve|out|suspended/.test(status))return 0;
  if(status.includes("doubtful"))return .2;
  if(status.includes("questionable"))return .65;
  if(status.includes("probable"))return .9;
  if(practice.includes("did not participate")||practice==="dnp")return .65;
  if(practice.includes("limited"))return .85;
  return 1;
}
function buildDefenseProfiles(rows){
  const allowed=new Map(),league={};
  const keys=["passing_yards","passing_tds","passing_interceptions","rushing_yards","rushing_tds","receptions","receiving_yards","receiving_tds"];
  for(const row of rows){
    const defense=String(row.opponent_team_code||"");
    if(!defense)continue;
    if(!allowed.has(defense))allowed.set(defense,{games:0,totals:{}});
    const profile=allowed.get(defense);
    profile.games++;
    for(const key of keys){
      const value=n(row.payload?.[key]);
      profile.totals[key]=(profile.totals[key]||0)+value;
      league[key]=(league[key]||0)+value;
    }
  }
  const leagueGames=rows.length||1;
  const profiles=new Map();
  for(const [team,profile] of allowed){
    const factors={};
    for(const key of keys){
      const teamAverage=profile.totals[key]/Math.max(1,profile.games);
      const leagueAverage=(league[key]||0)/leagueGames;
      const raw=leagueAverage>0?teamAverage/leagueAverage:1;
      // Small samples and extreme weekly results are deliberately damped.
      const cap=(key.includes("td")||key==="passing_interceptions") ? 0.20 : 0.12;
      factors[key]=clamp(1+(raw-1)*.65,1-cap,1+cap);
    }
    profiles.set(team,{games:profile.games,factors});
  }
  return profiles;
}
function projectPlayer(rows, injury){
  const first=rows[0], pos=String(first.position||"").toUpperCase();
  const factor=injuryFactor(injury);
  const p=key=>average(rows,key)*factor;
  const round=x=>Math.round(x*10)/10;
  const base={
    player_id:first.player_id,
    player_name:first.payload?.player_display_name||first.player_name,
    team:first.team,team_code:first.payload?.team||null,position:pos,
    games_sampled:rows.length,
    injury_status:injury?.report_status||injury?.practice_status||"Available",
    injury:injury?.injury||null,
    availability_factor:factor,
    role_usage:pos==="QB"?rows.reduce((sum,row)=>sum+n(row.payload?.attempts),0):
      pos==="RB"?rows.reduce((sum,row)=>sum+n(row.payload?.carries)+n(row.payload?.targets),0):
      rows.reduce((sum,row)=>sum+n(row.payload?.targets),0)
  };
  if(pos==="QB")return {...base,passing_yards:round(p("passing_yards")),passing_tds:round(p("passing_tds")),interceptions:round(p("passing_interceptions")),rushing_yards:round(p("rushing_yards")),rushing_tds:round(p("rushing_tds")),attempts:round(p("attempts")),completions:round(p("completions"))};
  if(pos==="RB")return {...base,carries:round(p("carries")),rushing_yards:round(p("rushing_yards")),rushing_tds:round(p("rushing_tds")),targets:round(p("targets")),receptions:round(p("receptions")),receiving_yards:round(p("receiving_yards")),receiving_tds:round(p("receiving_tds"))};
  return {...base,targets:round(p("targets")),receptions:round(p("receptions")),receiving_yards:round(p("receiving_yards")),receiving_tds:round(p("receiving_tds"))};
}
function applyMatchup(player, defense, opponentTeam){
  if(!defense)return {...player,opponent_defense:opponentTeam||"Unknown",matchup_sample_games:0,matchup_adjustment_pct:0,matchup_label:"No matchup data"};
  const f=defense.factors;
  const keys=player.position==="QB"
    ?["passing_yards","passing_tds","rushing_yards","rushing_tds"]
    :player.position==="RB"
      ?["rushing_yards","rushing_tds","receptions","receiving_yards","receiving_tds"]
      :["receptions","receiving_yards","receiving_tds"];
  const map={
    passing_yards:f.passing_yards,passing_tds:f.passing_tds,interceptions:f.passing_interceptions,
    rushing_yards:f.rushing_yards,rushing_tds:f.rushing_tds,
    receptions:f.receptions,receiving_yards:f.receiving_yards,receiving_tds:f.receiving_tds
  };
  const adjusted={...player};
  for(const key of Object.keys(map)){
    if(typeof adjusted[key]==="number"&&map[key])adjusted[key]=Math.round(adjusted[key]*map[key]*10)/10;
  }
  const mean=keys.reduce((sum,key)=>sum+(map[key]||1),0)/keys.length;
  const pct=Math.round((mean-1)*100);
  return {...adjusted,opponent_defense:opponentTeam||"Opponent",matchup_sample_games:defense.games,
    matchup_adjustment_pct:pct,matchup_label:pct>=5?"Favorable":pct<=-5?"Tough":"Neutral"};
}
export async function GET(){
  try{
    const today=easternDate(),window=weekWindow(today);
    const games=await query(`SELECT competition_type,source_game_id,season,game_date::text AS game_date,
      to_char(game_time,'HH24:MI') AS game_time,away_team,home_team
      FROM public.games WHERE away_score IS NULL AND home_score IS NULL
      AND game_date BETWEEN $1::date AND $2::date
      ORDER BY game_date,game_time NULLS LAST,source_game_id`,[window.start,window.end]);
    if(!games.rowCount)return NextResponse.json({week:window,games:[],message:"No upcoming games in the current NFL week."});
    const season=Number(games.rows[0].season);
    const [stats,injuries,defenseRows,sync]=await Promise.all([
      query(`WITH latest_week AS (SELECT MAX(week) AS week FROM public.nflverse_player_weekly_stats WHERE season=$1 AND season_type='REG'),
        ranked AS (SELECT season,week,player_id,player_name,team,position,payload,
          ROW_NUMBER() OVER(PARTITION BY player_id ORDER BY week DESC) AS rn
          FROM public.nflverse_player_weekly_stats
          WHERE season=$1 AND season_type='REG' AND position IN ('QB','RB','WR','TE')
            AND week <= (SELECT week FROM latest_week))
        SELECT season,week,player_id,player_name,team,position,payload FROM ranked WHERE rn<=8
        ORDER BY team,position,player_name,week DESC`,[season]),
      query(`SELECT DISTINCT ON (team,player_id,player_name) team,player_id,player_name,position,
        week,report_status,practice_status,injury,report_date,imported_at
        FROM public.nflverse_injury_reports
        WHERE season=$1 AND season_type='REG'
        ORDER BY team,player_id,player_name,week DESC,report_date DESC,imported_at DESC`,[season]),
      query(`WITH ranked_defense_games AS (
          SELECT season,week,team,payload->>'team' AS team_code,
            payload->>'opponent_team' AS opponent_team_code,payload,
            ROW_NUMBER() OVER (
              PARTITION BY payload->>'opponent_team'
              ORDER BY week DESC, team
            ) AS defense_game_rank
          FROM public.nflverse_team_weekly_stats
          WHERE season=$1 AND season_type='REG'
            AND NULLIF(payload->>'opponent_team','') IS NOT NULL
        )
        SELECT season,week,team,team_code,opponent_team_code,payload
        FROM ranked_defense_games
        WHERE defense_game_rank<=8
        ORDER BY week DESC`,[season]),
      query(`SELECT last_synced,status FROM public.data_source_sync WHERE source='nflverse_player_stats'`)
    ]);
    const injuryMap=new Map(injuries.rows.map(x=>[`${x.team}:${x.player_id||x.player_name}`,x]));
    const groups=new Map(),teamCodeByName=new Map();
    for(const row of stats.rows){
      if(row.payload?.team)teamCodeByName.set(row.team,row.payload.team);
      const key=`${row.team}:${row.player_id}`;
      if(!groups.has(key))groups.set(key,[]);
      groups.get(key).push(row);
    }
    const projected=[...groups.values()].map(rows=>{
      rows.sort((a,b)=>Number(b.week)-Number(a.week));
      const r=rows[0],injury=injuryMap.get(`${r.team}:${r.player_id}`)||injuryMap.get(`${r.team}:${r.player_name}`);
      return projectPlayer(rows,injury);
    });
    const defenseProfiles=buildDefenseProfiles(defenseRows.rows);
    const result=games.rows.map(game=>{
      const byTeam=(team,opponent)=>{
        const opponentCode=teamCodeByName.get(opponent);
        const defense=defenseProfiles.get(opponentCode);
        const rows=projected.filter(p=>p.team===team&&p.role_usage>=8&&p.availability_factor>0).sort((a,b)=>pRank(b)-pRank(a));
        return [
          ...rows.filter(p=>p.position==="QB").slice(0,1),
          ...rows.filter(p=>p.position==="RB").slice(0,3),
          ...rows.filter(p=>p.position==="WR").slice(0,5),
          ...rows.filter(p=>p.position==="TE").slice(0,2)
        ].map(player=>applyMatchup(player,defense,opponent));
      };
      const home=byTeam(game.home_team,game.away_team),away=byTeam(game.away_team,game.home_team);
      return {...game,players:{away,home}};
    });
    return NextResponse.json({week:window,season,games:result,
      dataUpdatedAt:sync.rows[0]?.last_synced||null,dataStatus:sync.rows[0]?.status||"unknown",
      playerRows:stats.rowCount,injuryRows:injuries.rowCount,defenseRows:defenseRows.rowCount,
      defenseSampleGames:8});
  }catch(error){
    console.error("GET /api/player-projections:",error);
    return NextResponse.json({error:"Unable to build player projections from the latest nflverse data."},{status:500});
  }
}
function pRank(p){
  if(p.position==="QB")return n(p.attempts)+n(p.rushing_yards)*.1;
  if(p.position==="RB")return n(p.carries)+n(p.targets)*1.5;
  return n(p.targets);
}
