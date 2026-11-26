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
function projectPlayer(rows, injury){
  const first=rows[0], pos=String(first.position||"").toUpperCase();
  const factor=injuryFactor(injury);
  const p=key=>average(rows,key)*factor;
  const round=x=>Math.round(x*10)/10;
  const base={
    player_id:first.player_id,
    player_name:first.payload?.player_display_name||first.player_name,
    team:first.team,position:pos,
    games_sampled:rows.length,
    injury_status:injury?.report_status||injury?.practice_status||"Available",
    injury:injury?.injury||null,
    availability_factor:factor
  };
  if(pos==="QB")return {...base,passing_yards:round(p("passing_yards")),passing_tds:round(p("passing_tds")),interceptions:round(p("passing_interceptions")),rushing_yards:round(p("rushing_yards")),rushing_tds:round(p("rushing_tds")),attempts:round(p("attempts")),completions:round(p("completions"))};
  if(pos==="RB")return {...base,carries:round(p("carries")),rushing_yards:round(p("rushing_yards")),rushing_tds:round(p("rushing_tds")),targets:round(p("targets")),receptions:round(p("receptions")),receiving_yards:round(p("receiving_yards")),receiving_tds:round(p("receiving_tds"))};
  return {...base,targets:round(p("targets")),receptions:round(p("receptions")),receiving_yards:round(p("receiving_yards")),receiving_tds:round(p("receiving_tds"))};
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
    const [stats,injuries,sync]=await Promise.all([
      query(`WITH latest_week AS (SELECT MAX(week) AS week FROM public.nflverse_player_weekly_stats WHERE season=$1 AND season_type='REG'),
        ranked AS (SELECT season,week,player_id,player_name,team,position,payload,
          ROW_NUMBER() OVER(PARTITION BY player_id ORDER BY week DESC) AS rn
          FROM public.nflverse_player_weekly_stats
          WHERE season=$1 AND season_type='REG' AND position IN ('QB','RB','WR','TE')
            AND week <= (SELECT week FROM latest_week))
        SELECT season,week,player_id,player_name,team,position,payload FROM ranked WHERE rn<=6
        ORDER BY team,position,player_name,week DESC`,[season]),
      query(`SELECT DISTINCT ON (team,player_id,player_name) team,player_id,player_name,position,
        report_status,practice_status,injury,report_date
        FROM public.nflverse_injury_reports WHERE season=$1
        ORDER BY team,player_id,player_name,report_date DESC`,[season]),
      query(`SELECT last_synced,status FROM public.data_source_sync WHERE source='nflverse_player_stats'`)
    ]);
    const injuryMap=new Map(injuries.rows.map(x=>[`${x.team}:${x.player_id||x.player_name}`,x]));
    const groups=new Map();
    for(const row of stats.rows){
      const key=`${row.team}:${row.player_id}`;
      if(!groups.has(key))groups.set(key,[]);
      groups.get(key).push(row);
    }
    const projected=[...groups.values()].map(rows=>{
      rows.sort((a,b)=>Number(b.week)-Number(a.week));
      const r=rows[0],injury=injuryMap.get(`${r.team}:${r.player_id}`)||injuryMap.get(`${r.team}:${r.player_name}`);
      return projectPlayer(rows,injury);
    });
    const result=games.rows.map(game=>{
      const byTeam=team=>projected.filter(p=>p.team===team&&p.availability_factor>0)
        .filter(p=>p.position==="QB" ? p.attempts>=8 : p.position==="RB" ? (p.carries>=3||p.targets>=2) : p.targets>=2)
        .sort((a,b)=>pRank(b)-pRank(a));
      const home=byTeam(game.home_team),away=byTeam(game.away_team);
      return {...game,players:{away,home}};
    });
    return NextResponse.json({week:window,season,games:result,
      dataUpdatedAt:sync.rows[0]?.last_synced||null,dataStatus:sync.rows[0]?.status||"unknown",
      playerRows:stats.rowCount,injuryRows:injuries.rowCount});
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
