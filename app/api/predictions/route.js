import { NextResponse } from "next/server";
import { query } from "../../../lib/db";
import { buildPredictionReport, MODEL_VERSION } from "../../../lib/predictions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function loadGames() {
  const result = await query(`SELECT competition_type,source_game_id,season,
    to_char(game_date,'YYYY-MM-DD') AS game_date,to_char(game_time,'HH24:MI') AS game_time,
    away_team,home_team,spread_points,over_under_line,away_score,home_score,total_points,ats_result
    FROM public.games
    ORDER BY game_date,game_time NULLS LAST,source_game_id`);
  return result.rows;
}
async function buildReport() {
  const games = await loadGames();
  const history = games.filter(game => game.away_score != null && game.home_score != null);
  const today = new Date().toISOString().slice(0,10);
  const upcoming = games.filter(game => game.away_score == null && game.home_score == null && String(game.game_date).slice(0,10) >= today);
  return buildPredictionReport(history, upcoming);
}
async function getPerformance() {
  const result = await query(`SELECT p.*,g.away_score,g.home_score,g.total_points AS actual_total,
    g.ats_result
    FROM public.market_predictions p
    LEFT JOIN public.games g ON g.competition_type=p.competition_type AND g.source_game_id=p.source_game_id
    WHERE p.model_version=$1
    ORDER BY p.game_date DESC,p.game_time DESC NULLS LAST`,[MODEL_VERSION]);
  const scored = result.rows.filter(row => row.away_score != null && row.home_score != null);
  const winnerRows = scored.filter(row => Number(row.home_score) !== Number(row.away_score));
  const winnerHits = winnerRows.filter(row => (Number(row.predicted_home_win_probability) >= 0.5) === (Number(row.home_score) > Number(row.away_score))).length;
  const atsRows = scored.filter(row => row.spread_points != null && row.ats_result !== "push");
  const atsHits = atsRows.filter(row => {
    const actualHomeCover = Number(row.home_score) - Number(row.away_score) > Number(row.spread_points);
    return (Number(row.predicted_home_cover_probability) >= 0.5) === actualHomeCover;
  }).length;
  const ouRows = scored.filter(row => row.over_under_line != null && row.actual_total != null && Number(row.actual_total) !== Number(row.over_under_line));
  const ouHits = ouRows.filter(row => (Number(row.predicted_over_probability) >= 0.5) === (Number(row.actual_total) > Number(row.over_under_line))).length;
  const rate = (hits, count) => count ? Number((hits / count * 100).toFixed(1)) : null;
  const confidence = ["Lean","Moderate","High"].map(level => {
    const rows = winnerRows.filter(row => row.confidence === level);
    const hits = rows.filter(row => (Number(row.predicted_home_win_probability) >= 0.5) === (Number(row.home_score) > Number(row.away_score))).length;
    return { level, games: rows.length, accuracy: rate(hits, rows.length) };
  });
  return {
    saved: result.rows.length,
    settled: scored.length,
    winner: { games: winnerRows.length, correct: winnerHits, accuracy: rate(winnerHits, winnerRows.length) },
    ats: { games: atsRows.length, correct: atsHits, accuracy: rate(atsHits, atsRows.length) },
    overUnder: { games: ouRows.length, correct: ouHits, accuracy: rate(ouHits, ouRows.length) },
    confidence,
    latestGenerated: result.rows[0]?.generated_at || null,
    recent: result.rows.slice(0, 30).map(row => ({
      game_date: String(row.game_date).slice(0,10),
      away_team: row.away_team,
      home_team: row.home_team,
      predicted_home_win_probability: Number(row.predicted_home_win_probability),
      predicted_home_cover_probability: row.predicted_home_cover_probability == null ? null : Number(row.predicted_home_cover_probability),
      predicted_over_probability: row.predicted_over_probability == null ? null : Number(row.predicted_over_probability),
      predicted_home_margin: Number(row.predicted_home_margin),
      predicted_total_points: Number(row.predicted_total_points),
      confidence: row.confidence,
      settled: row.away_score != null && row.home_score != null,
      actual_score: row.away_score == null ? null : `${row.away_score}-${row.home_score}`
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
    const upcoming = report.upcoming.filter(game => game.game_date >= new Date().toISOString().slice(0,10));
    if (!upcoming.length) return NextResponse.json({ saved: 0, modelVersion: MODEL_VERSION });
    const columns = ["competition_type","source_game_id","model_version","game_date","game_time","away_team","home_team","spread_points","over_under_line","predicted_home_win_probability","predicted_home_cover_probability","predicted_over_probability","predicted_home_margin","predicted_total_points","confidence","sample_size","feature_snapshot"];
    const values = [];
    const tuples = upcoming.map((game, index) => {
      const offset = index * columns.length;
      values.push(game.competition_type,game.source_game_id,MODEL_VERSION,game.game_date,game.game_time,game.away_team,game.home_team,
        game.spread_points,game.over_under_line,game.predicted_home_win_probability,game.predicted_home_cover_probability,
        game.predicted_over_probability,game.predicted_home_margin,game.predicted_total_points,game.confidence,game.sample_size,
        JSON.stringify(game.feature_snapshot));
      return `(${columns.map((_, column) => `$${offset + column + 1}`).join(",")})`;
    });
    const result = await query(`INSERT INTO public.market_predictions (${columns.join(",")})
      VALUES ${tuples.join(",")}
      ON CONFLICT DO NOTHING
      RETURNING id`, values);
    return NextResponse.json({ saved: result.rowCount, alreadyRecorded: upcoming.length - result.rowCount, upcoming: upcoming.length, modelVersion: MODEL_VERSION });
  } catch (error) {
    console.error("POST /api/predictions:", error);
    return NextResponse.json({ error: "Unable to save the pregame prediction snapshots." }, { status: 500 });
  }
}
