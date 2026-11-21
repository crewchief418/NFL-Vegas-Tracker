import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { query } from "../../../lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function cellText(v) {
  if (v == null) return "";
  return String(v).trim();
}
function parseDate(v) {
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v.toISOString().slice(0,10);
  if (typeof v === "number") {
    const d = XLSX.SSF.parse_date_code(v);
    if (!d) return null;
    return `${d.y}-${String(d.m).padStart(2,"0")}-${String(d.d).padStart(2,"0")}`;
  }
  const s = cellText(v);
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0,10);
}
function parseTime(v) {
  if (v == null || v === "") return null;
  if (v instanceof Date) return `${String(v.getUTCHours()).padStart(2,"0")}:${String(v.getUTCMinutes()).padStart(2,"0")}:00`;
  if (typeof v === "number") {
    const minutes = Math.round((v % 1) * 1440) % 1440;
    return `${String(Math.floor(minutes/60)).padStart(2,"0")}:${String(minutes%60).padStart(2,"0")}:00`;
  }
  const s = cellText(v);
  const m = s.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?$/i);
  if (!m) return null;
  let h = Number(m[1]);
  if (m[3]) h = (h % 12) + (m[3].toUpperCase() === "PM" ? 12 : 0);
  return `${String(h).padStart(2,"0")}:${m[2]}:00`;
}
function parseNumber(v) {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/[$,]/g,"").trim());
  return Number.isFinite(n) ? n : null;
}
function parseSpread(v, matchup, date) {
  const text = cellText(v);
  if (/^PK$/i.test(text)) return { text:"PK", points:0 };
  if (!text && date === "2015-02-01" && /patriots/i.test(matchup) && /seahawks/i.test(matchup)) {
    return { text:"PK", points:0 };
  }
  const points = parseNumber(v);
  return { text: text || null, points };
}
function calcAts(away, home, spread, awayTeam, homeTeam) {
  if (away == null || home == null || spread == null) return { covered:null, result:"unknown" };
  const margin = away + spread - home;
  if (margin === 0) return { covered:null, result:"push" };
  return margin > 0 ? { covered:awayTeam, result:"away" } : { covered:homeTeam, result:"home" };
}
function normalizeCovered(v, away, home) {
  const value = cellText(v);
  if (!value) return null;
  if (value.toLowerCase() === away.toLowerCase()) return away;
  if (value.toLowerCase() === home.toLowerCase()) return home;
  return null;
}
function pushRow(rows, competition, row, sourceSheet, sourceRow, playoffs=false) {
  const id = parseNumber(row[0]);
  const date = parseDate(row[1]);
  const away = cellText(row[playoffs ? 3 : 3]);
  const home = cellText(row[playoffs ? 4 : 4]);
  if (!Number.isInteger(id) || !date || !away || !home || away === home) return;
  const matchup = away + " " + home;
  const spread = parseSpread(row[5], matchup, date);
  const awayScore = parseNumber(row[playoffs ? 6 : 6]);
  const homeScore = parseNumber(row[playoffs ? 7 : 7]);
  const scoresPaired = (awayScore == null) === (homeScore == null);
  if (!scoresPaired) return;
  const ats = calcAts(awayScore, homeScore, spread.points, away, home);
  const sourceCovered = playoffs ? null : normalizeCovered(row[9], away, home);
  const season = playoffs ? Number(date.slice(0,4)) - 1 : parseNumber(row[11]);
  if (!Number.isInteger(season)) return;
  rows.push([
    competition, id, season, playoffs ? "Playoffs" : (cellText(row[12]) || null),
    date, parseTime(row[2]), away, home, spread.text, spread.points,
    awayScore, homeScore, parseNumber(row[playoffs ? 8 : 8]),
    ats.covered, ats.result, sourceCovered, sourceSheet, sourceRow
  ]);
}

export async function POST(request) {
  try {
    const secret = process.env.IMPORT_SECRET;
    if (!secret || request.headers.get("x-import-secret") !== secret) {
      return NextResponse.json({ error: "Import authorization failed." }, { status: 401 });
    }
    const form = await request.formData();
    const file = form.get("file");
    if (!file || typeof file.arrayBuffer !== "function") {
      return NextResponse.json({ error: "Choose the original NFL Scores.xlsx workbook." }, { status: 400 });
    }
    if (file.size > 12 * 1024 * 1024) {
      return NextResponse.json({ error: "Workbook must be smaller than 12 MB." }, { status: 413 });
    }
    const workbook = XLSX.read(Buffer.from(await file.arrayBuffer()), { type:"buffer", cellDates:true });
    const regularSheet = workbook.Sheets["Data_Picks"];
    const playoffSheet = workbook.Sheets["Playoff_Data_Picks"];
    if (!regularSheet || !playoffSheet) {
      return NextResponse.json({ error: "Workbook is missing Data_Picks or Playoff_Data_Picks." }, { status: 400 });
    }
    const regularData = XLSX.utils.sheet_to_json(regularSheet, { header:1, raw:true, defval:null });
    const playoffData = XLSX.utils.sheet_to_json(playoffSheet, { header:1, raw:true, defval:null });
    const rows = [];
    for (let i=1; i<regularData.length; i++) pushRow(rows,"regular",regularData[i],"Data_Picks",i+1,false);
    for (let i=1; i<playoffData.length; i++) pushRow(rows,"playoffs",playoffData[i],"Playoff_Data_Picks",i+1,true);
    if (!rows.length) return NextResponse.json({ error:"No valid game rows were found in the two source sheets." }, { status:422 });

    const existing = await query("SELECT COUNT(*)::int AS count FROM public.games");
    const before = existing.rows[0].count;
    let inserted = 0;
    const columns = 18;
    for (let offset=0; offset<rows.length; offset+=300) {
      const batch = rows.slice(offset,offset+300);
      const values = [];
      const tuples = batch.map((row,index) => {
        const placeholders = row.map((_,j)=>`$${index*columns+j+1}`);
        values.push(...row);
        return `(${placeholders.join(",")})`;
      });
      const result = await query(
        `INSERT INTO public.games
         (competition_type,source_game_id,season,game_type,game_date,game_time,away_team,home_team,
          spread_text,spread_points,away_score,home_score,total_points,covered_team,ats_result,
          source_covered_team,source_sheet,source_row)
         VALUES ${tuples.join(",")}
         ON CONFLICT (competition_type,source_game_id) DO NOTHING`,
        values
      );
      inserted += result.rowCount;
    }
    const counts = await query("SELECT competition_type, COUNT(*)::int AS count FROM public.games GROUP BY competition_type ORDER BY competition_type");
    return NextResponse.json({
      success:true, parsed:rows.length, inserted, alreadyPresent:rows.length-inserted,
      before, counts:counts.rows,
      note:"Original Covered values are preserved in source_covered_team; computed ATS outcomes are stored separately. Missing totals remain NULL."
    });
  } catch (error) {
    console.error("POST /api/import:", error);
    return NextResponse.json({ error:"Workbook import failed. No source workbook values were intentionally overwritten." }, { status:500 });
  }
}
