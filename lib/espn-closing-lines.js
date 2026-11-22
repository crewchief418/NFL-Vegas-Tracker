import { query } from "./db";

const ESPN_SCOREBOARD = "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard";
const ESPN_CORE = "https://sports.core.api.espn.com/v2/sports/football/leagues/nfl";
const TEAM_ALIASES = {
  ARI:"Cardinals", ATL:"Falcons", BAL:"Ravens", BUF:"Bills", CAR:"Panthers", CHI:"Bears",
  CIN:"Bengals", CLE:"Browns", DAL:"Cowboys", DEN:"Broncos", DET:"Lions", GB:"Packers",
  HOU:"Texans", IND:"Colts", JAX:"Jaguars", KC:"Chiefs", LAC:"Chargers", LAR:"Rams",
  LV:"Raiders", MIA:"Dolphins", MIN:"Vikings", NE:"Patriots", NO:"Saints", NYG:"Giants",
  NYJ:"Jets", PHI:"Eagles", PIT:"Steelers", SEA:"Seahawks", SF:"49ers", TB:"Buccaneers",
  TEN:"Titans", WAS:"Commanders", WSH:"Commanders", OAK:"Raiders", SD:"Chargers", STL:"Rams"
};
function teamName(value) {
  const text=String(value||"").trim();
  return TEAM_ALIASES[text.toUpperCase()]||text;
}
async function fetchJson(url) {
  let lastError;
  for(let attempt=0;attempt<2;attempt++) {
    try {
      const response=await fetch(url,{cache:"no-store",signal:AbortSignal.timeout(12000),
        headers:{"User-Agent":"NFL-Vegas-Tracker/1.0","Accept":"application/json"}});
      if(!response.ok) throw new Error(`ESPN request failed (${response.status})`);
      return await response.json();
    } catch(error) {
      lastError=error;
      if(attempt===0) await new Promise(resolve=>setTimeout(resolve,350));
    }
  }
  throw lastError;
}
async function mapLimit(items,limit,worker) {
  const results=new Array(items.length);let cursor=0;
  const runners=Array.from({length:Math.min(limit,items.length)},async()=>{
    while(true){const index=cursor++;if(index>=items.length)return;results[index]=await worker(items[index],index);}
  });
  await Promise.all(runners);return results;
}
function scoreboardDate(date) {
  return String(date).replaceAll("-","");
}
function eventTeams(event) {
  const competition=event.competitions?.[0];
  const competitors=competition?.competitors||[];
  const home=competitors.find(row=>row.homeAway==="home");
  const away=competitors.find(row=>row.homeAway==="away");
  return {competitionId:competition?.id||event.id,home:teamName(home?.team?.abbreviation||home?.team?.displayName),away:teamName(away?.team?.abbreviation||away?.team?.displayName)};
}
function findEvent(events,game) {
  return events.find(event=>{
    const teams=eventTeams(event);
    return teams.home===game.home_team&&teams.away===game.away_team;
  })||null;
}
function numeric(value) {
  if(value===null||value===undefined||value==="")return null;
  const parsed=Number(value);return Number.isFinite(parsed)?parsed:null;
}
function providerAllowed(item) {
  const name=String(item?.provider?.name||"").toLowerCase();
  return name&&!/(live|model|predictor|analytics|consensus)/.test(name);
}
function chooseProvider(items) {
  return [...items].filter(providerAllowed).sort((a,b)=>{
    const ap=numeric(a.provider?.priority),bp=numeric(b.provider?.priority);
    return (ap??9999)-(bp??9999)||String(a.provider?.name||"").localeCompare(String(b.provider?.name||""));
  })[0]||null;
}
function getSpread(item,game) {
  const details=String(item?.details||"");
  const detailNumber=details.match(/([+-]?\\d+(?:\\.\\d+)?)\\s*$/)?.[1];
  const raw=numeric(item?.spread??item?.pointSpread??detailNumber);
  if(raw===null)return {value:null,favorite:null};
  if(raw===0)return {value:0,favorite:"PK"};
  const homeFavorite=item?.homeTeamOdds?.favorite;
  const awayFavorite=item?.awayTeamOdds?.favorite;
  if(homeFavorite===true)return {value:Math.abs(raw),favorite:game.home_team};
  if(awayFavorite===true)return {value:-Math.abs(raw),favorite:game.away_team};
  const favoriteLabel=details.replace(/\\s*[+-]?\\d+(?:\\.\\d+)?\\s*$/,"").trim().toUpperCase();
  const normalizedFavorite=teamName(favoriteLabel);
  if(normalizedFavorite===game.home_team)return {value:Math.abs(raw),favorite:game.home_team};
  if(normalizedFavorite===game.away_team)return {value:-Math.abs(raw),favorite:game.away_team};
  // ESPN's spread is conventionally the favorite's negative handicap.
  return {value:-raw,favorite:raw<0?game.home_team:game.away_team};
}
function extractClosing(item,game) {
  const spread=getSpread(item,game);
  const total=numeric(item?.overUnder??item?.over_under??item?.total);
  return {spread:spread.value,total,favorite:spread.favorite};
}
async function loadScoreboard(date) {
  const data=await fetchJson(`${ESPN_SCOREBOARD}?dates=${scoreboardDate(date)}&limit=1000`);
  return Array.isArray(data.events)?data.events:[];
}
async function loadOdds(eventId,competitionId) {
  const url=`${ESPN_CORE}/events/${encodeURIComponent(eventId)}/competitions/${encodeURIComponent(competitionId||eventId)}/odds?limit=100`;
  const data=await fetchJson(url);
  return Array.isArray(data.items)?data.items:[];
}
async function setSync(status,rowCount,error,metadata) {
  await query(`INSERT INTO public.data_source_sync(source,status,row_count,last_synced,last_error,metadata)
    VALUES('espn_closing_lines',$1,$2,CASE WHEN $1='ready' THEN now() ELSE NULL END,$3,$4::jsonb)
    ON CONFLICT(source) DO UPDATE SET status=EXCLUDED.status,row_count=EXCLUDED.row_count,
    last_synced=CASE WHEN EXCLUDED.status='ready' THEN now() ELSE public.data_source_sync.last_synced END,
    last_error=EXCLUDED.last_error,metadata=EXCLUDED.metadata`,
    [status,rowCount,error,JSON.stringify(metadata||{})]);
}

export async function refreshEspnClosingLines({retry=false,batchSize=80}={}) {
  const started=Date.now();
  const statusFilter=retry
    ? "AND closing_line_status IN ('unmatched','no_odds','partial')"
    : "AND closing_line_status IS NULL";
  const result=await query(`SELECT competition_type,source_game_id,season,game_date::text AS game_date,
      away_team,home_team,espn_event_id
    FROM public.games
    WHERE away_score IS NOT NULL AND home_score IS NOT NULL
      AND season >= 2014 ${statusFilter}
    ORDER BY season DESC,game_date DESC,source_game_id
    LIMIT $1`,[Math.min(Math.max(Number(batchSize)||80,1),120)]);
  const games=result.rows;
  if(!games.length) {
    const [total,unresolved]=await Promise.all([
      query("SELECT COUNT(*)::int AS count FROM public.games WHERE season>=2014 AND (closing_spread_points IS NOT NULL OR closing_over_under_line IS NOT NULL)"),
      query("SELECT COUNT(*)::int AS count FROM public.games WHERE away_score IS NOT NULL AND home_score IS NOT NULL AND season>=2014 AND closing_line_status IS NULL")
    ]);
    const summary={attempted:0,updated:0,totalLines:Number(total.rows[0]?.count||0),remaining:Number(unresolved.rows[0]?.count||0)};
    await setSync("ready",summary.totalLines,null,summary);
    return summary;
  }
  await setSync("syncing",0,null,{attempted:games.length});
  let updated=0,matched=0,unmatched=0,noOdds=0,partial=0;
  try {
    const dates=[...new Set(games.filter(g=>!g.espn_event_id).map(g=>g.game_date))];
    const scoreboardResults=await mapLimit(dates,6,async date=>{
      try{return [date,await loadScoreboard(date)];}
      catch(error){return [date,{error:error.message}];}
    });
    const scoreboards=new Map(scoreboardResults);
    const tasks=games.map(game=>({game,event:null,competitionId:null}));
    for(const task of tasks) {
      if(task.game.espn_event_id) {task.event={id:task.game.espn_event_id};task.competitionId=task.game.espn_event_id;continue;}
      const scoreboard=scoreboards.get(task.game.game_date);
      if(!Array.isArray(scoreboard)){task.error=scoreboard?.error||"ESPN scoreboard unavailable";continue;}
      task.event=findEvent(scoreboard,task.game);
      if(task.event){task.competitionId=eventTeams(task.event).competitionId;matched++;}
      else task.error="No matching ESPN event found";
    }
    const outcomes=await mapLimit(tasks,6,async task=>{
      if(task.error)return {task,error:task.error};
      try {
        const odds=await loadOdds(task.event.id,task.competitionId);
        const provider=chooseProvider(odds);
        if(!provider)return {task,noOdds:true};
        const line=extractClosing(provider,task.game);
        if(line.spread===null&&line.total===null)return {task,noOdds:true};
        return {task,provider,line};
      } catch(error) {return {task,error:error.message};}
    });
    for(const outcome of outcomes) {
      const game=outcome.task.game;
      if(outcome.error) {
        unmatched++;
        await query(`UPDATE public.games SET espn_event_id=COALESCE($3,espn_event_id),closing_line_status='unmatched',
          closing_updated_at=now(),closing_metadata=$4::jsonb
          WHERE competition_type=$1 AND source_game_id=$2`,
          [game.competition_type,game.source_game_id,outcome.task.event?.id||null,JSON.stringify({error:outcome.error})]);
        continue;
      }
      if(outcome.noOdds) {
        noOdds++;
        await query(`UPDATE public.games SET espn_event_id=COALESCE($3,espn_event_id),closing_line_status='no_odds',
          closing_updated_at=now(),closing_metadata=$4::jsonb
          WHERE competition_type=$1 AND source_game_id=$2`,
          [game.competition_type,game.source_game_id,outcome.task.event?.id||null,JSON.stringify({message:"ESPN returned no usable sportsbook spread or total."})]);
        continue;
      }
      const {provider,line,task}=outcome;
      const status=line.spread!==null&&line.total!==null?"ready":"partial";
      if(status==="partial")partial++;
      await query(`UPDATE public.games SET espn_event_id=$3,
        closing_spread_points=COALESCE($4,closing_spread_points),
        closing_over_under_line=COALESCE($5,closing_over_under_line),
        closing_favorite_team=COALESCE($6,closing_favorite_team),
        closing_provider=$7,
        closing_line_status=CASE WHEN COALESCE($4,closing_spread_points) IS NOT NULL
          AND COALESCE($5,closing_over_under_line) IS NOT NULL THEN 'ready' ELSE 'partial' END,
        closing_updated_at=now(),closing_metadata=$8::jsonb,
        covered_team=CASE
          WHEN away_score IS NULL OR home_score IS NULL OR COALESCE($4,closing_spread_points,spread_points) IS NULL
            OR away_score+COALESCE($4,closing_spread_points,spread_points)-home_score=0 THEN NULL
          WHEN away_score+COALESCE($4,closing_spread_points,spread_points)-home_score>0 THEN away_team ELSE home_team END,
        ats_result=CASE
          WHEN away_score IS NULL OR home_score IS NULL OR COALESCE($4,closing_spread_points,spread_points) IS NULL THEN 'unknown'
          WHEN away_score+COALESCE($4,closing_spread_points,spread_points)-home_score=0 THEN 'push'
          WHEN away_score+COALESCE($4,closing_spread_points,spread_points)-home_score>0 THEN 'away' ELSE 'home' END
        WHERE competition_type=$1 AND source_game_id=$2`,
        [game.competition_type,game.source_game_id,task.event.id,line.spread,line.total,line.favorite,
         provider.provider?.name||"ESPN sportsbook",
         JSON.stringify({providerId:provider.provider?.id||null,providerPriority:provider.provider?.priority??null,
           details:provider.details||null,espnEventId:task.event.id,method:"ESPN completed-game odds snapshot"})]);
      updated++;
    }
    const [remaining,total]=await Promise.all([
      query("SELECT COUNT(*)::int AS count FROM public.games WHERE away_score IS NOT NULL AND home_score IS NOT NULL AND season>=2014 AND closing_line_status IS NULL"),
      query("SELECT COUNT(*)::int AS count FROM public.games WHERE season>=2014 AND (closing_spread_points IS NOT NULL OR closing_over_under_line IS NOT NULL)")
    ]);
    const summary={attempted:games.length,updated,totalLines:Number(total.rows[0]?.count||0),unmatched,noOdds,partial,
      remaining:Number(remaining.rows[0]?.count||0),durationMs:Date.now()-started};
    await setSync("ready",summary.totalLines,null,summary);
    return summary;
  } catch(error) {
    await setSync("error",updated,error.message,{attempted:games.length,updated,durationMs:Date.now()-started});
    throw error;
  }
}
