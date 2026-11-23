import { NextResponse } from "next/server";
import { query } from "../../../lib/db";
import { buildPredictionReport, MODEL_VERSION } from "../../../lib/predictions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function easternClock() {
  const parts = new Intl.DateTimeFormat("en-US",{timeZone:"America/New_York",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(new Date());
  const value = Object.fromEntries(parts.map(part => [part.type,part.value]));
  return { date: `${value.year}-${value.month}-${value.day}`, time: `${value.hour}:${value.minute}` };
}
async function loadGames() {
  const result = await query(`SELECT competition_type,source_game_id,season,
    to_char(game_date,'YYYY-MM-DD') AS game_date,to_char(game_time,'HH24:MI') AS game_time,
    away_team,home_team,COALESCE(closing_spread_points,spread_points) AS spread_points,
    COALESCE(closing_over_under_line,over_under_line) AS over_under_line,
    away_score,home_score,total_points,
    CASE WHEN closing_spread_points IS NOT NULL AND away_score IS NOT NULL AND home_score IS NOT NULL
      THEN CASE WHEN away_score+closing_spread_points-home_score=0 THEN 'push'
        WHEN away_score+closing_spread_points-home_score>0 THEN 'away' ELSE 'home' END
      ELSE ats_result END AS ats_result,updated_at
    FROM public.games ORDER BY game_date,game_time NULLS LAST,source_game_id`);
  return result.rows;
}
async function loadExternalContext(upcoming) {
  const currentSeason = Number(upcoming[0]?.season) || new Date().getUTCFullYear();
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
function currentNflWeekWindow(dateText) {
  // NFL weeks run Tuesday through Monday, keeping Thursday/Sunday/Monday
  // game windows together (including Thanksgiving week).
  const date = new Date(`${dateText}T12:00:00Z`);
  const daysSinceTuesday = (date.getUTCDay() + 5) % 7;
  date.setUTCDate(date.getUTCDate() - daysSinceTuesday);
  const start = date.toISOString().slice(0,10);
  date.setUTCDate(date.getUTCDate() + 6);
  const end = date.toISOString().slice(0,10);
  return { start, end, forecastEnd: end };
}
async function buildReport() {
  const games = await loadGames();
  const history = games.filter(game => game.away_score != null && game.home_score != null);
  const now = easternClock();
  const currentWeek = currentNflWeekWindow(now.date);
  const currentWeekGames = games.filter(game => {
    if (game.away_score != null || game.home_score != null) return false;
    const date = String(game.game_date).slice(0,10);
    return date >= currentWeek.start && date <= currentWeek.forecastEnd;
  });
  const external=await loadExternalContext(currentWeekGames);
  const latestUpdate = history.reduce((latest,game) => Math.max(latest,Date.parse(game.updated_at)||0),0);
  const sourceSignature=external.dataSources.map(row=>`${row.source}:${row.last_synced||"none"}`).join("|");
  const trainingSignature = `${history.length}:${latestUpdate}:${sourceSignature}`;
  const predictions = buildPredictionReport(history, external.upcoming);
  const statusByGame = new Map(external.upcoming.map(game => {
    const date = String(game.game_date).slice(0,10);
    const started = date < now.date || (date === now.date && (!game.game_time || String(game.game_time) <= now.time));
    return [`${game.competition_type}:${game.source_game_id}`, started ? "LIVE" : "UPCOMING"];
  }));
  return { ...predictions,
    upcoming: predictions.upcoming.map(game => ({...game, game_status:statusByGame.get(`${game.competition_type}:${game.source_game_id}`) || "UPCOMING"})),
    currentWeek, trainingSignature, dataSources:external.dataSources,dataCoverage:external.dataCoverage };
}
async function getPerformance(currentWeek) {
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
  const atsRows = scored.filter(row => row.spread_points != null && row.predicted_home_cover_probability != null && row.ats_result !== "push");
  const atsHits = atsRows.filter(row => (Number(row.predicted_home_cover_probability) >= 0.5) === (Number(row.home_score) - Number(row.away_score) > Number(row.spread_points))).length;
  const ouRows = scored.filter(row => row.over_under_line != null && row.actual_total != null && Number(row.actual_total) !== Number(row.over_under_line));
  const ouHits = ouRows.filter(row => (Number(row.predicted_over_probability) >= 0.5) === (Number(row.actual_total) > Number(row.over_under_line))).length;
  const rate = (hits, count) => count ? Number((hits / count * 100).toFixed(1)) : null;
  const confidence = ["Low","Moderate","High"].map(level => {
    const rows = winnerRows.filter(row => row.confidence === level);
    const hits = rows.filter(row => (Number(row.predicted_home_win_probability) >= 0.5) === (Number(row.home_score) > Number(row.away_score))).length;
    return { level, games: rows.length, accuracy: rate(hits, rows.length) };
  });
  return {
    saved: result.rows.length,settled: scored.length,
    winner: { games: winnerRows.length,correct: winnerHits,incorrect: winnerRows.length-winnerHits,ties: scored.length-winnerRows.length,accuracy: rate(winnerHits,winnerRows.length) },
    ats: { games: atsRows.length,correct: atsHits,accuracy: rate(atsHits,atsRows.length) },
    overUnder: { games: ouRows.length,correct: ouHits,accuracy: rate(ouHits,ouRows.length) },
    confidence,latestGenerated: result.rows[0]?.generated_at || null,
    // Keep completed prediction history, but don't surface stale future-season
    // snapshots that were incorrectly saved outside the two-week forecast window.
    recent: result.rows.filter(row => {
      const date = String(row.game_date).slice(0,10);
      return (row.away_score != null && row.home_score != null) ||
        (date >= currentWeek.start && date <= currentWeek.forecastEnd);
    }).slice(0,30).map(row=>({
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
    const saved = await query(`SELECT report,generated_at FROM public.market_prediction_runs ORDER BY generated_at DESC,id DESC LIMIT 1`);
    if (!saved.rows.length) return NextResponse.json({ error: "No saved forecast run exists yet. Select Refresh Forecasts to generate the first one." }, { status: 404 });
    const stored = saved.rows[0];
    const report = stored.report;
    const games = await loadGames();
    const now = easternClock();
    const active = new Map(games.filter(game => game.away_score == null && game.home_score == null)
      .map(game => [`${game.competition_type}:${game.source_game_id}`, game]));
    const startedSnapshots = await query(`SELECT DISTINCT ON (p.competition_type,p.source_game_id)
        p.competition_type,p.source_game_id,p.spread_points,p.over_under_line,
        p.predicted_home_win_probability,p.predicted_home_cover_probability,p.predicted_over_probability,
        p.predicted_home_margin,p.predicted_total_points,p.confidence,p.sample_size,p.feature_snapshot
      FROM public.market_predictions p
      JOIN public.games g ON g.competition_type=p.competition_type AND g.source_game_id=p.source_game_id
      WHERE g.away_score IS NULL AND g.home_score IS NULL
        AND g.game_date BETWEEN $1::date AND $2::date
        AND p.generated_at < ((g.game_date + COALESCE(g.game_time,TIME '23:59')) AT TIME ZONE 'America/New_York')
      ORDER BY p.competition_type,p.source_game_id,p.generated_at DESC,p.id DESC`,
      [report.currentWeek.start,report.currentWeek.end]);
    const frozen = new Map(startedSnapshots.rows.map(row => [`${row.competition_type}:${row.source_game_id}`,row]));
    const upcoming = (report.upcoming || []).flatMap(prediction => {
      const key = `${prediction.competition_type}:${prediction.source_game_id}`;
      const game = active.get(key);
      if (!game) return [];
      const date = String(game.game_date).slice(0,10);
      const started = date < now.date || (date === now.date && (!game.game_time || String(game.game_time) <= now.time));
      if (started) {
        const snapshot = frozen.get(key);
        if (!snapshot) return [];
        return [{ ...prediction,
          game_date: date, game_time: game.game_time || null, game_status: "LIVE",
          spread_points: snapshot.spread_points == null ? null : Number(snapshot.spread_points),
          over_under_line: snapshot.over_under_line == null ? null : Number(snapshot.over_under_line),
          predicted_home_win_probability: Number(snapshot.predicted_home_win_probability),
          predicted_home_cover_probability: snapshot.predicted_home_cover_probability == null ? null : Number(snapshot.predicted_home_cover_probability),
          predicted_over_probability: snapshot.predicted_over_probability == null ? null : Number(snapshot.predicted_over_probability),
          predicted_home_margin: Number(snapshot.predicted_home_margin),
          predicted_total_points: Number(snapshot.predicted_total_points),
          confidence: snapshot.confidence, sample_size: snapshot.sample_size, feature_snapshot: snapshot.feature_snapshot
        }];
      }
      return [{ ...prediction, game_date: date, game_time: game.game_time || null, game_status: "UPCOMING" }];
    });
    const performance = await getPerformance(report.currentWeek);
    return NextResponse.json({ ...report, upcoming, generatedAt: stored.generated_at, performance });
  } catch (error) {
    console.error("GET /api/predictions:", error);
    return NextResponse.json({ error: "Unable to load saved prediction report." }, { status: 500 });
  }
}
export async function POST() {
  try {
    const report = await buildReport();
    // Save new model snapshots only before kickoff. Live cards remain visible
    // on GET, but never get a fresh post-kickoff forecast snapshot.
    const upcoming = report.upcoming.filter(game => game.game_status === "UPCOMING");
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
    const result = upcoming.length
      ? await query(`INSERT INTO public.market_predictions (${columns.join(",")})
          VALUES ${tuples.join(",")} ON CONFLICT DO NOTHING RETURNING id`, values)
      : { rowCount: 0 };
    const run = await query(`INSERT INTO public.market_prediction_runs
      (forecast_date,training_signature,forecast_count,report)
      VALUES ($1,$2,$3,$4::jsonb) RETURNING id,generated_at`,
      [forecastDate,report.trainingSignature,upcoming.length,JSON.stringify(report)]);
    return NextResponse.json({saved:result.rowCount,alreadyRecorded:upcoming.length-result.rowCount,
      upcoming:upcoming.length,modelVersion:MODEL_VERSION,dataCoverage:report.dataCoverage,
      runId:run.rows[0]?.id,generatedAt:run.rows[0]?.generated_at});
  } catch(error) {
    console.error("POST /api/predictions:",error);
    return NextResponse.json({error:"Unable to save the pregame prediction snapshots."},{status:500});
  }
}
