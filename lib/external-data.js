import { gunzipSync } from "node:zlib";
import { query } from "./db";

const TEAM_ABBR = {
  ARI:"Cardinals", ATL:"Falcons", BAL:"Ravens", BUF:"Bills", CAR:"Panthers", CHI:"Bears",
  CIN:"Bengals", CLE:"Browns", DAL:"Cowboys", DEN:"Broncos", DET:"Lions", GB:"Packers",
  HOU:"Texans", IND:"Colts", JAX:"Jaguars", KC:"Chiefs", LAC:"Chargers", LAR:"Rams",
  LV:"Raiders", MIA:"Dolphins", MIN:"Vikings", NE:"Patriots", NO:"Saints", NYG:"Giants",
  NYJ:"Jets", PHI:"Eagles", PIT:"Steelers", SEA:"Seahawks", SF:"49ers", TB:"Buccaneers",
  TEN:"Titans", WAS:"Commanders", OAK:"Raiders", SD:"Chargers", STL:"Rams", LA:"Rams",
  JAC:"Jaguars", WSH:"Commanders"
};
const STADIUMS = {
  Bills:{name:"Highmark Stadium",lat:42.7738,lon:-78.7870},
  Dolphins:{name:"Hard Rock Stadium",lat:25.9580,lon:-80.2389},
  Patriots:{name:"Gillette Stadium",lat:42.0909,lon:-71.2643},
  Jets:{name:"MetLife Stadium",lat:40.8135,lon:-74.0745},
  Ravens:{name:"M&T Bank Stadium",lat:39.2780,lon:-76.6227},
  Bengals:{name:"Paycor Stadium",lat:39.0954,lon:-84.5160},
  Browns:{name:"Huntington Bank Field",lat:41.5061,lon:-81.6995},
  Steelers:{name:"Acrisure Stadium",lat:40.4468,lon:-80.0158},
  Texans:{name:"NRG Stadium (indoor)",lat:29.6847,lon:-95.4107,indoor:true},
  Colts:{name:"Lucas Oil Stadium (indoor)",lat:39.7601,lon:-86.1639,indoor:true},
  Jaguars:{name:"EverBank Stadium",lat:30.3239,lon:-81.6373},
  Titans:{name:"Nissan Stadium",lat:36.1665,lon:-86.7713},
  Broncos:{name:"Empower Field at Mile High",lat:39.7439,lon:-105.0201},
  Chiefs:{name:"GEHA Field at Arrowhead",lat:39.0489,lon:-94.4839},
  Raiders:{name:"Allegiant Stadium (indoor)",lat:36.0909,lon:-115.1833,indoor:true},
  Chargers:{name:"SoFi Stadium (indoor)",lat:33.9535,lon:-118.3392,indoor:true},
  Cowboys:{name:"AT&T Stadium (retractable roof)",lat:32.7473,lon:-97.0945,indoor:true},
  Giants:{name:"MetLife Stadium",lat:40.8135,lon:-74.0745},
  Eagles:{name:"Lincoln Financial Field",lat:39.9008,lon:-75.1675},
  Commanders:{name:"Northwest Stadium",lat:38.9077,lon:-76.8645},
  Bears:{name:"Soldier Field",lat:41.8623,lon:-87.6167},
  Lions:{name:"Ford Field (indoor)",lat:42.3400,lon:-83.0456,indoor:true},
  Packers:{name:"Lambeau Field",lat:44.5013,lon:-88.0622},
  Vikings:{name:"U.S. Bank Stadium (indoor)",lat:44.9738,lon:-93.2575,indoor:true},
  Falcons:{name:"Mercedes-Benz Stadium (retractable roof)",lat:33.7554,lon:-84.4008,indoor:true},
  Panthers:{name:"Bank of America Stadium",lat:35.2258,lon:-80.8528},
  Saints:{name:"Caesars Superdome (indoor)",lat:29.9511,lon:-90.0812,indoor:true},
  Buccaneers:{name:"Raymond James Stadium",lat:27.9759,lon:-82.5033},
  Cardinals:{name:"State Farm Stadium (retractable roof)",lat:33.5276,lon:-112.2626,indoor:true},
  Rams:{name:"SoFi Stadium (indoor)",lat:33.9535,lon:-118.3392,indoor:true},
  "49ers":{name:"Levi's Stadium",lat:37.4033,lon:-121.9694},
  Seahawks:{name:"Lumen Field",lat:47.5952,lon:-122.3316}
};

function parseCsv(text) {
  const rows=[]; let row=[], field="", quoted=false;
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(quoted){
      if(c==='"'&&text[i+1]==='"'){field+='"';i++;}
      else if(c==='"')quoted=false;
      else field+=c;
    }else if(c==='"')quoted=true;
    else if(c===","){row.push(field);field="";}
    else if(c==="\n"){row.push(field.replace(/\r$/,""));if(row.some(v=>v!==""))rows.push(row);row=[];field="";}
    else field+=c;
  }
  if(field!==""||row.length){row.push(field.replace(/\r$/,""));if(row.some(v=>v!==""))rows.push(row);}
  if(!rows.length)return [];
  const headers=rows.shift().map((v,i)=>i===0?v.replace(/^\uFEFF/,"").trim():v.trim());
  return rows.map(values=>Object.fromEntries(headers.map((h,i)=>[h,(values[i]??"").trim()])));
}
function value(row,...keys){for(const key of keys){if(row[key]!==undefined&&row[key]!==null&&row[key]!=="")return row[key];}return "";}
function teamName(team){const raw=String(team||"").trim();return TEAM_ABBR[raw.toUpperCase()]||raw;}
function asInt(v){const n=Number(v);return Number.isInteger(n)?n:null;}
function asDate(v){
  if(!v)return null;
  const d=new Date(v);
  return Number.isNaN(d.getTime())?null:d.toISOString().slice(0,10);
}
async function fetchCsv(url){
  const response=await fetch(url,{headers:{"User-Agent":"NFL-Vegas-Tracker/1.0"}});
  if(!response.ok)throw new Error(`Source download failed (${response.status}): ${url}`);
  const bytes=Buffer.from(await response.arrayBuffer());
  const content=url.endsWith(".gz")?gunzipSync(bytes).toString("utf8"):bytes.toString("utf8");
  return parseCsv(content);
}
async function setSync(source,status,rowCount=0,error=null,metadata={}){
  await query(`INSERT INTO public.data_source_sync (source,status,row_count,last_synced,last_error,metadata)
    VALUES ($1,$2,$3,CASE WHEN $2='ready' THEN now() ELSE NULL END,$4,$5::jsonb)
    ON CONFLICT (source) DO UPDATE SET status=EXCLUDED.status,row_count=EXCLUDED.row_count,
    last_synced=CASE WHEN EXCLUDED.status='ready' THEN now() ELSE public.data_source_sync.last_synced END,
    last_error=EXCLUDED.last_error,metadata=EXCLUDED.metadata`,
    [source,status,rowCount,error,JSON.stringify(metadata)]);
}
async function upsertTeamRows(rows){
  for(let i=0;i<rows.length;i+=250){
    const batch=rows.slice(i,i+250);
    await query(`INSERT INTO public.nflverse_team_weekly_stats (season,season_type,week,team,payload)
      SELECT x.season,x.season_type,x.week,x.team,x.payload FROM jsonb_to_recordset($1::jsonb)
      AS x(season integer,season_type text,week integer,team text,payload jsonb)
      ON CONFLICT (season,season_type,week,team) DO UPDATE SET payload=EXCLUDED.payload,imported_at=now()`,
      [JSON.stringify(batch)]);
  }
}
async function upsertPlayerRows(rows){
  for(let i=0;i<rows.length;i+=250){
    const batch=rows.slice(i,i+250);
    await query(`INSERT INTO public.nflverse_player_weekly_stats (season,season_type,week,player_id,player_name,team,position,payload)
      SELECT x.season,x.season_type,x.week,x.player_id,x.player_name,x.team,x.position,x.payload
      FROM jsonb_to_recordset($1::jsonb) AS x(season integer,season_type text,week integer,player_id text,player_name text,team text,position text,payload jsonb)
      ON CONFLICT (season,season_type,week,player_id) DO UPDATE SET player_name=EXCLUDED.player_name,team=EXCLUDED.team,
      position=EXCLUDED.position,payload=EXCLUDED.payload,imported_at=now()`,
      [JSON.stringify(batch)]);
  }
}
async function upsertInjuryRows(rows){
  for(let i=0;i<rows.length;i+=250){
    const batch=rows.slice(i,i+250);
    await query(`INSERT INTO public.nflverse_injury_reports
      (season,season_type,week,team,player_id,player_name,position,report_date,report_status,practice_status,injury,payload)
      SELECT x.season,x.season_type,x.week,x.team,x.player_id,x.player_name,x.position,x.report_date::date,
      x.report_status,x.practice_status,x.injury,x.payload
      FROM jsonb_to_recordset($1::jsonb) AS x(season integer,season_type text,week integer,team text,player_id text,
      player_name text,position text,report_date text,report_status text,practice_status text,injury text,payload jsonb)
      ON CONFLICT (season,season_type,week,team,player_id,player_name,report_date) DO UPDATE SET
      report_status=EXCLUDED.report_status,practice_status=EXCLUDED.practice_status,
      injury=EXCLUDED.injury,payload=EXCLUDED.payload,imported_at=now()`,
      [JSON.stringify(batch)]);
  }
}
async function syncDepthCharts(season){
  const rows=await fetchCsv(`https://github.com/nflverse/nflverse-data/releases/download/depth_charts/depth_charts_${season}.csv.gz`);
  if(!rows.length)return 0;
  // 2025+ depth charts are timestamped daily snapshots, not week-numbered charts.
  const latestDt=rows.reduce((latest,row)=>String(value(row,"dt"))>latest?String(value(row,"dt")):latest,"");
  const normalized=rows.filter(row=>String(value(row,"dt"))===latestDt&&["QB","RB","WR","TE"].includes(String(value(row,"pos_abb")).toUpperCase()))
    .map(row=>({season,team:teamName(value(row,"team")),player_name:String(value(row,"player_name")),
      gsis_id:String(value(row,"gsis_id")),position:String(value(row,"pos_abb")).toUpperCase(),
      position_name:String(value(row,"pos_name")),depth_rank:asInt(value(row,"pos_rank"))||99,
      snapshot_dt:latestDt,payload:row}))
    .filter(row=>row.team&&row.player_name&&row.depth_rank<99);
  await query(`DELETE FROM public.nflverse_depth_charts WHERE season=$1`,[season]);
  for(let i=0;i<normalized.length;i+=500){
    await query(`INSERT INTO public.nflverse_depth_charts
      (season,team,player_name,gsis_id,position,position_name,depth_rank,snapshot_dt,payload)
      SELECT x.season,x.team,x.player_name,x.gsis_id,x.position,x.position_name,x.depth_rank,x.snapshot_dt::timestamptz,x.payload
      FROM jsonb_to_recordset($1::jsonb) AS x(season integer,team text,player_name text,gsis_id text,position text,
        position_name text,depth_rank integer,snapshot_dt text,payload jsonb)`,[JSON.stringify(normalized.slice(i,i+500))]);
  }
  await setSync("nflverse_depth_charts","ready",normalized.length,null,{season,snapshotDt:latestDt});
  return normalized.length;
}

async function syncNflverse(){
  const seasonResult=await query("SELECT MAX(season) AS season FROM public.games");
  const currentSeason=Number(seasonResult.rows[0]?.season)||new Date().getUTCFullYear();
  // The prediction model only consumes the current and previous seasons.
  // Avoid downloading six unnecessary years during the 60-second Hobby runtime.
  const firstSeason=Math.max(2020,currentSeason-1);
  let teamCount=0,playerCount=0,injuryCount=0;
  await setSync("nflverse_team_stats","syncing");
  await setSync("nflverse_player_stats","syncing");
  await setSync("nflverse_injuries","syncing");
  try{
    for(let season=firstSeason;season<=currentSeason;season++){
      const [teamRows,playerRows]=await Promise.all([
        fetchCsv(`https://github.com/nflverse/nflverse-data/releases/download/stats_team/stats_team_week_${season}.csv.gz`),
        fetchCsv(`https://github.com/nflverse/nflverse-data/releases/download/stats_player/stats_player_week_${season}.csv.gz`)
      ]);
      const teams=teamRows.map(row=>{
        const team=teamName(value(row,"team","team_abbr"));
        const year=asInt(value(row,"season"))||season,week=asInt(value(row,"week"));
        const seasonType=String(value(row,"season_type")||"REG").toUpperCase();
        return team&&week!==null?{season:year,season_type:seasonType,week,team,payload:row}:null;
      }).filter(Boolean);
      const players=playerRows.map(row=>{
        const id=value(row,"player_id","player_gsis_id","gsis_id","player");
        const name=value(row,"player_name","player_display_name","full_name","player");
        const team=teamName(value(row,"team","recent_team","team_abbr"));
        const year=asInt(value(row,"season"))||season,week=asInt(value(row,"week"));
        const seasonType=String(value(row,"season_type")||"REG").toUpperCase();
        return id&&week!==null?{season:year,season_type:seasonType,week,player_id:String(id),player_name:String(name),team,position:String(value(row,"position","player_position")),payload:row}:null;
      }).filter(Boolean);
      await upsertTeamRows(teams); await upsertPlayerRows(players);
      teamCount+=teams.length;playerCount+=players.length;
    }
    await setSync("nflverse_team_stats","ready",teamCount,null,{seasons:`${firstSeason}-${currentSeason}`});
    await setSync("nflverse_player_stats","ready",playerCount,null,{seasons:`${firstSeason}-${currentSeason}`});
  }catch(error){
    await setSync("nflverse_team_stats","error",teamCount,error.message,{});
    await setSync("nflverse_player_stats","error",playerCount,error.message,{});
    throw error;
  }
  try{
    for(let season=firstSeason;season<=currentSeason;season++){
      const rows=await fetchCsv(`https://github.com/nflverse/nflverse-data/releases/download/injuries/injuries_${season}.csv`);
      const normalized=rows.map(row=>{
        const reportDate=asDate(value(row,"date_modified","report_date"))||`${season}-01-01`;
        const playerName=value(row,"full_name","player_name");
        return {season:asInt(value(row,"season"))||season,season_type:String(value(row,"season_type")||"REG").toUpperCase(),week:asInt(value(row,"week"))||0,
          team:teamName(value(row,"team")),player_id:String(value(row,"gsis_id","player_id")),
          player_name:String(playerName),position:String(value(row,"position")),
          report_date:reportDate,report_status:String(value(row,"report_status")),
          practice_status:String(value(row,"practice_status")),
          injury:String(value(row,"report_primary_injury","practice_primary_injury")),
          payload:row};
      }).filter(row=>row.team&&row.player_name);

      // nflverse can publish multiple injury entries for the same player/report key.
      // Postgres cannot update the same conflict target twice in one INSERT batch,
      // so retain the last source row for each exact unique key before upserting.
      const uniqueInjuries=new Map();
      for(const row of normalized){
        const key=[row.season,row.season_type,row.week,row.team,row.player_id,row.player_name,row.report_date].join("\\u001f");
        uniqueInjuries.set(key,row);
      }
      const deduplicated=[...uniqueInjuries.values()];
      await upsertInjuryRows(deduplicated);injuryCount+=deduplicated.length;
    }
    await setSync("nflverse_injuries","ready",injuryCount,null,{seasons:`${firstSeason}-${currentSeason}`});
  }catch(error){
    await setSync("nflverse_injuries","error",injuryCount,error.message,{});
    throw error;
  }
  const depthChartRows=await syncDepthCharts(currentSeason);
  return {teamRows:teamCount,playerRows:playerCount,injuryRows:injuryCount,depthChartRows};
}

function toNumber(v){const n=Number(v);return Number.isFinite(n)?n:null;}
async function syncWeather(){
  const games=await query(`SELECT competition_type,source_game_id,game_date::text AS game_date,home_team
    FROM public.games WHERE away_score IS NULL AND home_score IS NULL
    AND game_date >= (now() AT TIME ZONE 'America/New_York')::date AND game_date <= (now() AT TIME ZONE 'America/New_York')::date + 7
    ORDER BY game_date,game_time NULLS LAST LIMIT 64`);
  let saved=0,skipped=0,nextIndex=0;
  const worker=async()=>{
    while(true){
      const indexToProcess=nextIndex++;
      if(indexToProcess>=games.rows.length)return;
      const game=games.rows[indexToProcess];
      const stadium=STADIUMS[game.home_team];
      if(!stadium){skipped++;continue;}
      if(stadium.indoor){
        await query(`INSERT INTO public.game_weather (competition_type,source_game_id,game_date,home_team,stadium,latitude,longitude,source)
          VALUES ($1,$2,$3,$4,$5,$6,$7,'Open-Meteo · indoor venue')
          ON CONFLICT (competition_type,source_game_id) DO UPDATE SET game_date=EXCLUDED.game_date,
          home_team=EXCLUDED.home_team,stadium=EXCLUDED.stadium,latitude=EXCLUDED.latitude,longitude=EXCLUDED.longitude,
          temperature_max_f=NULL,temperature_min_f=NULL,wind_max_mph=NULL,wind_gust_max_mph=NULL,
          precipitation_in=NULL,weather_code=NULL,source=EXCLUDED.source,fetched_at=now()`,
          [game.competition_type,game.source_game_id,game.game_date,game.home_team,stadium.name,stadium.lat,stadium.lon]);
        saved++;continue;
      }
      const params=new URLSearchParams({latitude:String(stadium.lat),longitude:String(stadium.lon),
        daily:"temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max,wind_gusts_10m_max,weather_code",
        forecast_days:"7",timezone:"auto",temperature_unit:"fahrenheit",wind_speed_unit:"mph",precipitation_unit:"inch"});
      const response=await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`);
      if(!response.ok)throw new Error(`Open-Meteo request failed (${response.status})`);
      const weather=await response.json();
      const dayIndex=(weather.daily?.time||[]).indexOf(String(game.game_date).slice(0,10));
      if(dayIndex<0){skipped++;continue;}
      const daily=weather.daily;
      await query(`INSERT INTO public.game_weather
        (competition_type,source_game_id,game_date,home_team,stadium,latitude,longitude,
        temperature_max_f,temperature_min_f,wind_max_mph,wind_gust_max_mph,precipitation_in,weather_code,source)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'Open-Meteo')
        ON CONFLICT (competition_type,source_game_id) DO UPDATE SET game_date=EXCLUDED.game_date,
        home_team=EXCLUDED.home_team,stadium=EXCLUDED.stadium,latitude=EXCLUDED.latitude,longitude=EXCLUDED.longitude,
        temperature_max_f=EXCLUDED.temperature_max_f,temperature_min_f=EXCLUDED.temperature_min_f,
        wind_max_mph=EXCLUDED.wind_max_mph,wind_gust_max_mph=EXCLUDED.wind_gust_max_mph,
        precipitation_in=EXCLUDED.precipitation_in,weather_code=EXCLUDED.weather_code,source=EXCLUDED.source,fetched_at=now()`,
        [game.competition_type,game.source_game_id,game.game_date,game.home_team,stadium.name,stadium.lat,stadium.lon,
         toNumber(daily.temperature_2m_max?.[dayIndex]),toNumber(daily.temperature_2m_min?.[dayIndex]),
         toNumber(daily.wind_speed_10m_max?.[dayIndex]),toNumber(daily.wind_gusts_10m_max?.[dayIndex]),
         toNumber(daily.precipitation_sum?.[dayIndex]),asInt(daily.weather_code?.[dayIndex])]);
      saved++;
    }
  };
  await Promise.all(Array.from({length:Math.min(4,games.rows.length)},()=>worker()));
  await setSync("open_meteo_weather","ready",saved,null,{skipped,forecastWindowDays:7});
  return {weatherGames:saved,weatherSkipped:skipped};
}

export async function refreshExternalData(){
  const started=Date.now();
  const nflverse=await syncNflverse();
  let weather;
  try { weather=await syncWeather(); }
  catch(error) {
    await setSync("open_meteo_weather","error",0,error.message,{});
    throw error;
  }
  return {...nflverse,...weather,durationMs:Date.now()-started};
}

export { STADIUMS, TEAM_ABBR };
