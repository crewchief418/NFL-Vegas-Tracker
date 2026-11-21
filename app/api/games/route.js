import { NextResponse } from "next/server";
import { query } from "../../../lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function validCompetition(value) {
  return value === "regular" || value === "playoffs";
}

function calculateAts(awayScore, homeScore, spread) {
  if (awayScore == null || homeScore == null || spread == null) {
    return { covered: null, result: "unknown" };
  }
  const margin = Number(awayScore) + Number(spread) - Number(homeScore);
  if (margin === 0) return { covered: null, result: "push" };
  return margin > 0
    ? { covered: "away", result: "away" }
    : { covered: "home", result: "home" };
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    if (searchParams.get("summary") === "1") {
      const result = await query(`
        SELECT
          COUNT(*) FILTER (WHERE competition_type = 'regular')::int AS regular,
          COUNT(*) FILTER (WHERE competition_type = 'playoffs')::int AS playoffs,
          COUNT(*)::int AS total
        FROM public.games
      `);
      return NextResponse.json(result.rows[0]);
    }

    const competition = searchParams.get("competition") || "regular";
    if (!validCompetition(competition)) {
      return NextResponse.json({ error: "Invalid competition type" }, { status: 400 });
    }
    const season = searchParams.get("season");
    const team = searchParams.get("team");
    const completed = searchParams.get("completed");
    const values = [competition];
    let where = "WHERE competition_type = $1";
    if (season && /^\d{4}$/.test(season)) {
      values.push(Number(season));
      where += ` AND season = $${values.length}`;
    }
    if (team) {
      values.push(team);
      where += ` AND (away_team = $${values.length} OR home_team = $${values.length})`;
    }
    if (completed === "1") where += " AND away_score IS NOT NULL";
    if (completed === "0") where += " AND away_score IS NULL";
    const result = await query(
      `SELECT source_game_id, competition_type, season, game_type,
              to_char(game_date, 'YYYY-MM-DD') AS game_date,
              to_char(game_time, 'HH24:MI') AS game_time,
              away_team, home_team, spread_text, spread_points,
              away_score, home_score, total_points, covered_team, ats_result,
              source_covered_team
       FROM public.games ${where}
       ORDER BY game_date, game_time NULLS LAST, source_game_id`,
      values
    );
    return NextResponse.json({ games: result.rows });
  } catch (error) {
    console.error("GET /api/games:", error);
    return NextResponse.json({ error: "Unable to load games from the database." }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    const body = await request.json();
    const { competition_type, source_game_id } = body;
    if (!validCompetition(competition_type) || !Number.isInteger(Number(source_game_id))) {
      return NextResponse.json({ error: "A valid game identity is required." }, { status: 400 });
    }
    const awayScore = body.away_score === "" || body.away_score == null ? null : Number(body.away_score);
    const homeScore = body.home_score === "" || body.home_score == null ? null : Number(body.home_score);
    const spread = body.spread_points === "" || body.spread_points == null ? null : Number(body.spread_points);
    if ((awayScore != null && (!Number.isInteger(awayScore) || awayScore < 0)) ||
        (homeScore != null && (!Number.isInteger(homeScore) || homeScore < 0)) ||
        ((awayScore == null) !== (homeScore == null)) ||
        (spread != null && !Number.isFinite(spread))) {
      return NextResponse.json({ error: "Scores must be non-negative whole numbers and entered together. Spread must be numeric." }, { status: 400 });
    }
    const ats = calculateAts(awayScore, homeScore, spread);
    const total = awayScore == null ? null : awayScore + homeScore;
    const result = await query(
      `UPDATE public.games
       SET away_score = $3, home_score = $4, spread_points = $5,
           spread_text = $6, total_points = $7, covered_team = $8,
           ats_result = $9, updated_at = now()
       WHERE competition_type = $1 AND source_game_id = $2
       RETURNING source_game_id`,
      [competition_type, Number(source_game_id), awayScore, homeScore, spread,
       body.spread_text || (spread == null ? null : String(spread)),
       total, ats.covered === "away" ? body.away_team : ats.covered === "home" ? body.home_team : null,
       ats.result]
    );
    if (!result.rowCount) return NextResponse.json({ error: "Game not found." }, { status: 404 });
    return NextResponse.json({ success: true, ats_result: ats.result, total_points: total });
  } catch (error) {
    console.error("PATCH /api/games:", error);
    return NextResponse.json({ error: "Unable to save this game." }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    if (!validCompetition(body.competition_type) ||
        !Number.isInteger(Number(body.season)) ||
        !body.game_date || !body.away_team?.trim() || !body.home_team?.trim() ||
        body.away_team.trim() === body.home_team.trim()) {
      return NextResponse.json({ error: "Enter a season, date, two different teams, and competition." }, { status: 400 });
    }
    const nextId = await query(
      "SELECT COALESCE(MAX(source_game_id), 1000) + 1 AS next_id FROM public.games WHERE competition_type = $1",
      [body.competition_type]
    );
    const result = await query(
      `INSERT INTO public.games
       (competition_type, source_game_id, season, game_type, game_date, game_time,
        away_team, home_team, spread_text, spread_points, away_score, home_score,
        total_points, covered_team, ats_result, source_sheet, source_row)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NULL,NULL,NULL,NULL,'unknown','Manual Entry',0)
       RETURNING source_game_id`,
      [body.competition_type, Number(nextId.rows[0].next_id), Number(body.season),
       body.game_type || null, body.game_date, body.game_time || null,
       body.away_team.trim(), body.home_team.trim(), body.spread_text || null,
       body.spread_points === "" || body.spread_points == null ? null : Number(body.spread_points)]
    );
    return NextResponse.json({ success: true, source_game_id: result.rows[0].source_game_id }, { status: 201 });
  } catch (error) {
    console.error("POST /api/games:", error);
    return NextResponse.json({ error: "Unable to create game. Check that the date and spread are valid." }, { status: 500 });
  }
}
