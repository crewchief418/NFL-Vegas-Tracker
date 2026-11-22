import { NextResponse } from "next/server";
import { query } from "../../../lib/db";
import { buildPredictionReport, MODEL_VERSION } from "../../../lib/predictions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function easternClock() {
  const parts = new Intl.DateTimeFormat("en-US",{timeZone:"America/New_York",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(new Date());
  const value = Object.fromEntries(parts.map(part => [part.type,part.value]));
  return { date: `${value.year}-${value.month}-${value.day}`, time: `${value.hour}:${value.minute}` };
}
async function loadGames() {
  const result = await query(`SELECT competition_type,source_game_id,season,
    to_char(game_date,'YYYY-MM-DD') AS game_date,to_char(game_time,'HH24:MI') AS game_time,
    away_team,home_team,spread_points,over_under_line,away_score,home_score,total_points,ats_result,updated_at
    FROM public.games ORDER BY game_date,game_time NULLS LAST,source_game_id`);
  return result.rows;
}
async function loadExternalContext(upcoming) {
  const currentSeason = new Date().getUTCFullYear();
  const [teamResult, qbResult, injuryResult, weatherResult, syncResult] = await Promise.all([
    query(`WITH ranked AS (
      SELECT team,season,season_type,week,payload,ROW_NUMBER() OVER(PARTITION BY team ORDER BY season DESC,
      CASE WHEN season_type='POST' THEN 0 ELSE 1 END,week DESC) AS rn
      FROM public.nflverse_team_weekly_stats WHERE season >= $1 - 1
    ) SELECT team,season,season_type,week,payload FROM ranked WHERE rn <= 6 ORDER BY team,season DESC,
      CASE WHEN season_type='POST' THEN 0 ELSE 1 END,week DESC`,[currentSeason]),
    query(`WITH ranked AS (
      SELECT team,player_id,player_name,position,season,season_type,week,payload,
      ROW_NUMBER() OVER(PARTITION BY team,player_id ORDER BY CASE WHEN season_type='POST' THEN 0 ELSE 1 END,week DESC) AS rn
      FROM public.nflverse_player_weekly_stats WHERE position='QB' AND season=$1
    ) SELECT team,player_id,player_name,position,season,season_type,week,payload FROM ranked WHERE rn <= 6 ORDER BY team,player_name,CASE WHEN season_type='POST' THEN 0 ELSE 1 END,week DESC`,[currentSeason]),
    query(`SELECT team,player_id,player_name,position,report_status,practice_status,injury,week
      FROM public.nflverse_injury_reports
      WHERE season=$1
      AND season_type=(SELECT season_type FROM public.nflverse_injury_reports WHERE season=$1 ORDER BY report_date DESC LIMIT 1)
      AND week=(SELECT MAX(week) FROM public.nflverse_injury_reports WHERE season=$1
        AND season_type=(SELECT season_type FROM public.nflverse_injury_reports WHERE season=$1 ORDER BY report_date DESC LIMIT 1))
      ORDER BY team,position,player_name`,[currentSeason]),
    query(`SELECT competition_type,source_game_id,game_date,home_team,stadium,
      temperature_max_f,temperature_min_f,wind_max_mph,wind_gust_max_mph,precipitation_in,weather_code,fetched_at
      FROM public.game_weather`),
    query(`SELECT source,status,row_count,last_synced,last_error,metadata
      FROM public.data_source_sync ORDER BY source`)
  ]);
  const byTeam = rows => rows.reduce((map,row) => {
    if(!map.has(row.team))map.set(row.team,[]);
    map.get(row.team).push(row);
    return map;
  },new Map());
  const teamStats=byTeam(teamResult.rows), qbStats=byTeam(qbResult.rows), injuries=byTeam(injuryResult.rows);
  const weather=new Map(weatherResult.rows.map(row=>[`${row.competition_type}:${row.source_game_id}`,row]));
  const enriched=upcoming.map(game=>({...game,external_context:{
    homeTeamStats:teamStats.get(game.home_team)||[],
    awayTeamStats:teamStats.get(game.away_team)||[],
    homeQBStats:qbStats.get(game.home_team)||[],
    awayQBStats:qbStats.get(game.away_team)||[],
    homeInjuries:injuries.get(game.home_team)||[],
    awayInjuries:injuries.get(game.away_team)||[],
    weather:weather.get(`${game.competition_type}:${game.source_game_id}`)||null
  }}));
  return {upcoming:enriched,dataSources:syncResult.rows,dataCoverage:{
    teamStatRows:teamResult.rows.length,qbStatRows:qbResult.rows.length,
    currentInjuryRows:injuryResult.rows.length,weatherGames:weatherResult.rows.length
  }};
}
async function buildReport() {
  const games = await loadGames();
  const history = games.filter(game => game.away_score != null && game.home_score != null);
  const now = easternClock();
  const upcoming = games.filter(game => {
    if (game.away_score != null || game.home_score != null) return false;
    const date = String(game.game_date).slice(0,10);
    return date > now.date || (date === now.date && Boolean(game.game_time) && String(game.game_time) > now.time);
  });
  const external=await loadExternalContext(upcoming);
  const latestUpdate = history.reduce((latest,game) => Math.max(latest,Date.parse(game.updated_at)||0),0);
  const sourceSignature=external.dataSources.map(row=>`${row.source}:${row.last_synced||"none"}`).join("|");
  const trainingSignature = `${history.length}:${latestUpdate}:${sourceSignature}`;
  return { ...buildPredictionReport(history, external.upcoming), trainingSignature,
    dataSources:external.dataSources,dataCoverage:external.dataCoverage };
}
async function getPerformance() {
  const result = await query(`WITH latest AS (
      SELECT DISTINCT ON (competition_type,source_game_id) *
      FROM public.market_predictions WHERE model_version=$1
      ORDER BY competition_type,source_game_id,generated_at DESC,id DESC
    )
    SELECT p.*,g.away_score,g.home_score,g.total_points AS actual_total,g.ats_result
    FROM latest p LEFT JOIN public.games g
    ON g.competition_type=p.competition_type AND g.source_game_id=p.source_game_id
    ORDER BY p.game_date DESC,p.game_time DESC NULLS LAST`,[MODEL_VERSION]);
  const scored = result.rows.filter(row => row.away_score != null && row.home_score != null);
  const winnerRows = scored.filter(row => Number(row.home_score) !== Number(row.away_score));
  const winnerHits = winnerRows.filter(row => (Number(row.predicted_home_win_probability) >= 0.5) === (Number(row.home_score) > Number(row.away_score))).length;
  const atsRows = scored.filter(row => row.spread_points != null && row.ats_result !== "push");
  const atsHits = atsRows.filter(row => (Number(row.predicted_home_win_probability) >= 0.5) === (Number(row.home_score) - Number(row.away_score) > Number(row.spread_points))).length;
  const ouRows = scored.filter(row => row.over_under_line != null && row.actual_total != null && Number(row.actual_total) !== Number(row.over_under_line));
  const ouHits = ouRows.filter(row => (Number(row.predicted_over_probability) >= 0.5) === (Number(row.actual_total) > Number(row.over_under_line))).length;
  const rate = (hits, count) => count ? Number((hits / count * 100).toFixed(1)) : null;
  const confidence = ["Lean","Moderate","High"].map(level => {
    const rows = winnerRows.filter(row => row.confidence === level);
    const hits = rows.filter(row => (Number(row.predicted_home_win_probability) >= 0.5) === (Number(row.home_score) > Number(row.away_score))).length;
    return { level, games: rows.length, accuracy: rate(hits, rows.length) };
  });
  return {
    saved: result.rows.length,settled: scored.length,
    winner: { games: winnerRows.length,correct: winnerHits,accuracy: rate(winnerHits,winnerRows.length) },
    ats: { games: atsRows.length,correct: atsHits,accuracy: rate(atsHits,atsRows.length) },
    overUnder: { games: ouRows.length,correct: ouHits,accuracy: rate(ouHits,ouRows.length) },
    confidence,latestGenerated: result.rows[0]?.generated_at || null,
    recent: result.rows.slice(0,30).map(row=>({
      game_date:String(row.game_date).slice(0,10),away_team:row.away_team,home_team:row.home_team,
      predicted_home_win_probability:Number(row.predicted_home_win_probability),
      predicted_home_cover_probability:row.predicted_home_cover_probability==null?null:Number(row.predicted_home_cover_probability),
      predicted_over_probability:row.predicted_over_probability==null?null:Number(row.predicted_over_probability),
      predicted_home_margin:Number(row.predicted_home_margin),predicted_total_points:Number(row.predicted_total_points),
      confidence:row.confidence,settled:row.away_score!=null&&row.home_score!=null,
      actual_score:row.away_score==null?null:`${row.away_score}-${row.home_score}`
    }))
  };
}
export async function GET() {
  try {
    const report = await buildReport();
    const performance = await getPerformance();
    return NextResponse.json({ ...report, performance });
  } catch (error) {
    console.error("GET /api/predictions:", error);
    return NextResponse.json({ error: "Unable to build the prediction report." }, { status: 500 });
  }
}
export async function POST() {
  try {
    const report = await buildReport();
    const upcoming = report.upcoming;
    if (!upcoming.length) return NextResponse.json({ saved: 0, modelVersion: MODEL_VERSION });
    const forecastDate = easternClock().date;
    const columns = ["competition_type","source_game_id","model_version","forecast_date","training_signature","game_date","game_time","away_team","home_team","spread_points","over_under_line","predicted_home_win_probability","predicted_home_cover_probability","predicted_over_probability","predicted_home_margin","predicted_total_points","confidence","sample_size","feature_snapshot"];
    const values = [];
    const tuples = upcoming.map((game,index)=>{
      const offset=index*columns.length;
      values.push(game.competition_type,game.source_game_id,MODEL_VERSION,forecastDate,report.trainingSignature,
        game.game_date,game.game_time,game.away_team,game.home_team,game.spread_points,game.over_under_line,
        game.predicted_home_win_probability,game.predicted_home_cover_probability,game.predicted_over_probability,
        game.predicted_home_margin,game.predicted_total_points,game.confidence,game.sample_size,
        JSON.stringify(game.feature_snapshot));
      return `(${columns.map((_,column)=>`$${offset+column+1}`).join(",")})`;
    });
    const result=await query(`INSERT INTO public.market_predictions (${columns.join(",")})
      VALUES ${tuples.join(",")} ON CONFLICT DO NOTHING RETURNING id`,values);
    return NextResponse.json({saved:result.rowCount,alreadyRecorded:upcoming.length-result.rowCount,
      upcoming:upcoming.length,modelVersion:MODEL_VERSION,dataCoverage:report.dataCoverage});
  } catch(error) {
    console.error("POST /api/predictions:",error);
    return NextResponse.json({error:"Unable to save the pregame prediction snapshots."},{status:500});
  }
}
