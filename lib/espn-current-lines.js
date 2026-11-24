import { query } from "./db";

const SCOREBOARD = "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard";
const CORE = "https://sports.core.api.espn.com/v2/sports/football/leagues/nfl";
const ALIASES = {
  ARI:"Cardinals",ATL:"Falcons",BAL:"Ravens",BUF:"Bills",CAR:"Panthers",CHI:"Bears",CIN:"Bengals",CLE:"Browns",
  DAL:"Cowboys",DEN:"Broncos",DET:"Lions",GB:"Packers",HOU:"Texans",IND:"Colts",JAX:"Jaguars",KC:"Chiefs",
  LAC:"Chargers",LAR:"Rams",LV:"Raiders",MIA:"Dolphins",MIN:"Vikings",NE:"Patriots",NO:"Saints",NYG:"Giants",
  NYJ:"Jets",PHI:"Eagles",PIT:"Steelers",SEA:"Seahawks",SF:"49ers",TB:"Buccaneers",TEN:"Titans",WAS:"Commanders",
  WSH:"Commanders",OAK:"Raiders",SD:"Chargers",STL:"Rams",LA:"Rams",JAC:"Jaguars"
};
const teamName = value => ALIASES[String(value || "").trim().toUpperCase()] || String(value || "").trim();
const numeric = value => value == null || value === "" || !Number.isFinite(Number(value)) ? null : Number(value);

async function fetchJson(url) {
  const response = await fetch(url,{cache:"no-store",signal:AbortSignal.timeout(12000),
    headers:{"User-Agent":"NFL-Vegas-Tracker/1.0","Accept":"application/json"}});
  if(!response.ok) throw new Error(`ESPN request failed (${response.status})`);
  return response.json();
}
function eventTeams(event) {
  const competition=event.competitions?.[0], competitors=competition?.competitors||[];
  const home=competitors.find(row=>row.homeAway==="home"), away=competitors.find(row=>row.homeAway==="away");
  return {home:teamName(home?.team?.abbreviation||home?.team?.displayName),
    away:teamName(away?.team?.abbreviation||away?.team?.displayName),competitionId:competition?.id||event.id};
}
function extractLine(item,game) {
  const details=String(item?.details||"");
  const detailNumber=details.match(/([+-]?\d+(?:\.\d+)?)\s*$/)?.[1];
  const raw=numeric(item?.spread??item?.pointSpread??detailNumber);
  let spreadPoints=null, favorite=null;
  if(raw===0){spreadPoints=0;favorite="PK";}
  else if(raw!==null){
    if(item?.homeTeamOdds?.favorite===true){spreadPoints=Math.abs(raw);favorite=game.home_team;}
    else if(item?.awayTeamOdds?.favorite===true){spreadPoints=-Math.abs(raw);favorite=game.away_team;}
    else {
      const label=details.replace(/\s*[+-]?\d+(?:\.\d+)?\s*$/,"").trim().toUpperCase();
      if(teamName(label)===game.home_team||label.includes(game.home_team.toUpperCase())){spreadPoints=Math.abs(raw);favorite=game.home_team;}
      else if(teamName(label)===game.away_team||label.includes(game.away_team.toUpperCase())){spreadPoints=-Math.abs(raw);favorite=game.away_team;}
      else {spreadPoints=-raw;favorite=raw<0?game.home_team:game.away_team;}
    }
  }
  return {spreadPoints,favorite,overUnder:numeric(item?.overUnder??item?.over_under??item?.total)};
}
function chooseProvider(items,game) {
  return [...items].filter(item=>{
    const name=String(item?.provider?.name||"").toLowerCase();
    if(!name||/(live|model|predictor|analytics|consensus)/.test(name))return false;
    const line=extractLine(item,game);
    return line.spreadPoints!==null||line.overUnder!==null;
  }).sort((a,b)=>(numeric(a.provider?.priority)??9999)-(numeric(b.provider?.priority)??9999)||
    String(a.provider?.name||"").localeCompare(String(b.provider?.name||"")))[0]||null;
}
async function mapLimit(items,limit,worker) {
  const results=new Array(items.length);let cursor=0;
  await Promise.all(Array.from({length:Math.min(limit,items.length)},async()=>{
    while(true){const index=cursor++;if(index>=items.length)return;results[index]=await worker(items[index]);}
  }));
  return results;
}
const dateKey = value => String(value).replaceAll("-","");

export async function loadCurrentEspnLines() {
  const gamesResult=await query(`SELECT competition_type,source_game_id,game_date::text AS game_date,away_team,home_team
    FROM public.games
    WHERE season=EXTRACT(YEAR FROM (now() AT TIME ZONE 'America/New_York'))::int
      AND game_date >= ((date_trunc('week',now() AT TIME ZONE 'America/New_York')::date)+1)
      AND game_date <= ((date_trunc('week',now() AT TIME ZONE 'America/New_York')::date)+7)
      AND away_score IS NULL AND home_score IS NULL
    ORDER BY game_date,game_time NULLS LAST,source_game_id`);
  const games=gamesResult.rows;
  const dates=[...new Set(games.map(game=>String(game.game_date).slice(0,10)))];
  const scoreboards=await mapLimit(dates,5,async date=>{
    try{const data=await fetchJson(`${SCOREBOARD}?dates=${dateKey(date)}&limit=1000`);return [date,data.events||[]];}
    catch(error){return [date,{error:error.message}];}
  });
  const byDate=new Map(scoreboards);
  const results=await mapLimit(games,5,async game=>{
    const date=String(game.game_date).slice(0,10), board=byDate.get(date);
    if(!Array.isArray(board))return {...game,spreadPoints:null,overUnder:null,provider:null,status:"unavailable",message:board?.error||"ESPN schedule unavailable"};
    const event=board.find(candidate=>{
      const teams=eventTeams(candidate);return teams.home===game.home_team&&teams.away===game.away_team;
    });
    if(!event)return {...game,spreadPoints:null,overUnder:null,provider:null,status:"unmatched",message:"No matching ESPN event"};
    try{
      const teams=eventTeams(event);
      const data=await fetchJson(`${CORE}/events/${encodeURIComponent(event.id)}/competitions/${encodeURIComponent(teams.competitionId)}/odds?limit=100`);
      const provider=chooseProvider(data.items||[],game);
      if(!provider)return {...game,espnEventId:event.id,spreadPoints:null,overUnder:null,provider:null,status:"no_odds",message:"No current sportsbook odds returned"};
      const line=extractLine(provider,game);
      return {...game,espnEventId:event.id,...line,provider:provider.provider?.name||"ESPN sportsbook",status:line.spreadPoints!==null&&line.overUnder!==null?"ready":"partial"};
    }catch(error){return {...game,spreadPoints:null,overUnder:null,provider:null,status:"unavailable",message:error.message};}
  });
  return {fetchedAt:new Date().toISOString(),games:results};
}
