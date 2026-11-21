import { NextResponse } from "next/server";
import { query } from "../../../lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
    if (!["regular", "playoffs"].includes(competition)) {
      return NextResponse.json({ error: "Invalid competition type" }, { status: 400 });
    }
    const season = searchParams.get("season");
    const values = [competition];
    let where = "WHERE competition_type = $1";
    if (season && /^\\d{4}$/.test(season)) {
      values.push(Number(season));
      where += " AND season = $2";
    }
    const result = await query(
      `SELECT source_game_id, season, game_type, game_date, game_time, away_team, home_team,
              spread_text, spread_points, away_score, home_score, total_points, covered_team, ats_result
       FROM public.games ${where}
       ORDER BY game_date, source_game_id`,
      values
    );
    return NextResponse.json({ games: result.rows });
  } catch (error) {
    console.error("GET /api/games:", error);
    return NextResponse.json({ error: "Database unavailable. Check DATABASE_URL and schema setup." }, { status: 500 });
  }
}
