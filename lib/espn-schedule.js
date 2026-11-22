import { query } from "./db";

const ESPN_SCOREBOARD = "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard";
const TEAM_ALIASES = {
  ARI:"Cardinals", ATL:"Falcons", BAL:"Ravens", BUF:"Bills", CAR:"Panthers", CHI:"Bears",
  CIN:"Bengals", CLE:"Browns", DAL:"Cowboys", DEN:"Broncos", DET:"Lions", GB:"Packers",
  HOU:"Texans", IND:"Colts", JAX:"Jaguars", KC:"Chiefs", LAC:"Chargers", LAR:"Rams",
  LV:"Raiders", MIA:"Dolphins", MIN:"Vikings", NE:"Patriots", NO:"Saints", NYG:"Giants",
  NYJ:"Jets", PHI:"Eagles", PIT:"Steelers", SEA:"Seahawks", SF:"49ers", TB:"Buccaneers",
  TEN:"Titans", WAS:"Commanders", WSH:"Commanders", OAK:"Raiders", SD:"Chargers", STL:"Rams",
  LA:"Rams", JAC:"Jaguars"
};
function teamName(value) {
  const raw=String(value||"").trim();
  return TEAM_ALIASES[raw.toUpperCase()]||raw;
}
function easternParts(value) {
  const parts=new Intl.DateTimeFormat("en-US",{timeZone:"America/New_York",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(new Date(value));
  return Object.fromEntries(parts.filter(p=>p.type!=="literal").map(p=>[p.type,p.value]));
}
function scoreboardDate(date) { return date.toISOString().slice(0,10).replaceAll("-",""); }
async function fetchScoreboard(start,end) {
  const url=`${ESPN_SCOREBOARD}?dates=${scoreboardDate(start)}-${scoreboardDate(end)}&limit=1000`;
  const response=await fetch(url,{cache:"no-store",signal:AbortSignal.timeout(20000),headers:{"User-Agent":"NFL-Vegas-Tracker/1.0","Accept":"application/json"}});
  if(!response.ok)throw new Error(`ESPN scoreboard request failed (${response.status})`);
  const data=await response.json();
  return Array.isArray(data.events)?data.events:[];
}
function eventMatch(event,game) {
  const comp=event.competitions?.[0];
  const competitors=comp?.competitors||[];
  const home=competitors.find(c=>c.homeAway==="home");
  const away=competitors.find(c=>c.homeAway==="away");
  return home&&away&&teamName(home.team?.abbreviation||home.team?.displayName)===game.home_team
    &&teamName(away.team?.abbreviation||away.team?.displayName)===game.away_team;
}
export async function refreshNflSchedule() {
  const started=Date.now();
  const gamesResult=await query(`SELECT competition_type,source_game_id,game_date::text AS game_date,game_time,
      away_team,home_team
    FROM public.games
    WHERE season=EXTRACT(YEAR FROM CURRENT_DATE)::int
      AND away_score IS NULL AND home_score IS NULL
      AND game_date >= CURRENT_DATE - 7 AND game_date <= CURRENT_DATE + 35
    ORDER BY game_date,game_time NULLS LAST`);
  const games=gamesResult.rows;
  const now=new Date();
  const start=new Date(now.getTime()-7*86400000);
  const end=new Date(now.getTime()+35*86400000);
  const events=await fetchScoreboard(start,end);
  let checked=0,updated=0,unchanged=0,unmatched=0,skipped=0;
  for(const game of games) {
    const candidates=events.filter(e=>eventMatch(e,game));
    if(candidates.length!==1){unmatched++;continue;}
    const event=candidates[0];
    const state=event.status?.type?.state;
    if(state!=="pre"){skipped++;continue;}
    const parts=easternParts(event.date);
    const nextDate=`${parts.year}-${parts.month}-${parts.day}`;
    const nextTime=`${parts.hour}:${parts.minute}`;
    checked++;
    if(nextDate===game.game_date&&String(game.game_time||"").slice(0,5)===nextTime){unchanged++;continue;}
    const result=await query(`UPDATE public.games SET game_date=$3::date,game_time=$4::time,updated_at=now()
      WHERE competition_type=$1 AND source_game_id=$2 AND away_score IS NULL AND home_score IS NULL
      RETURNING source_game_id`,[game.competition_type,game.source_game_id,nextDate,nextTime]);
    if(result.rowCount)updated++;
  }
  const summary={checked,updated,unchanged,unmatched,skipped,totalUpcoming:games.length,durationMs:Date.now()-started};
  await query(`INSERT INTO public.data_source_sync(source,status,row_count,last_synced,last_error,metadata)
    VALUES('espn_schedule','ready',$1,now(),NULL,$2::jsonb)
    ON CONFLICT(source) DO UPDATE SET status='ready',row_count=EXCLUDED.row_count,last_synced=now(),
      last_error=NULL,metadata=EXCLUDED.metadata`,[updated,JSON.stringify(summary)]);
  return summary;
}
