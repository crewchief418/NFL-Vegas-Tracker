import { NextResponse } from "next/server";
import { query } from "../../../lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function easternDate() {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const p = Object.fromEntries(parts.map(x => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}`;
}
function weekStart(dateText) {
  const d = new Date(`${dateText}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 5) % 7));
  return d.toISOString().slice(0, 10);
}
function authorized(request) {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret) && request.headers.get("authorization") === `Bearer ${secret}`;
}
function fullGamePeriod(period) {
  const p = String(period || "").toLowerCase();
  return !/(1st|2nd|3rd|4th|first|second|third|fourth|quarter|half|q[1-4]|[1-4]q|1h|2h)/.test(p);
}
function selectionAvailable(selections, side) {
  const item = (Array.isArray(selections) ? selections : []).find(x => String(x.side || "").toLowerCase() === side);
  return typeof item?.available === "boolean" ? item.available : null;
}
async function fetchBoard() {
  const key = process.env.PRIZEPICKS_API_KEY;
  if (!key) throw new Error("PRIZEPICKS_API_KEY is not configured in Vercel.");
  const all = [];
  let cursor = null;
  const seenCursors = new Set();
  for (let page = 0; page < 12; page++) {
    const url = new URL("https://prizepicksapi.com/api/v1/projections");
    url.searchParams.set("league", "NFL");
    url.searchParams.set("limit", "1000");
    url.searchParams.set("view", "compact");
    url.searchParams.set("status", "active");
    if (cursor) {
      if (seenCursors.has(cursor)) throw new Error("PrizePicks pagination repeated a cursor; stopping to avoid duplicate imports.");
      seenCursors.add(cursor);
      url.searchParams.set("cursor", cursor);
    }
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${key}`,
        "X-User-Request": "NFL Vegas Tracker weekly PrizePicks comparison import",
        Accept: "application/json"
      },
      cache: "no-store",
      signal: AbortSignal.timeout(25000)
    });
    if (!response.ok) {
      const detail = (await response.text()).slice(0, 240);
      throw new Error(`PrizePicks feed returned HTTP ${response.status}${detail ? `: ${detail}` : "."}`);
    }
    const payload = await response.json();
    if (!Array.isArray(payload.data)) throw new Error("PrizePicks feed returned an unexpected board format.");
    all.push(...payload.data);
    cursor = payload.meta?.next_cursor || null;
    if (!cursor) break;
    if (page === 11) throw new Error("PrizePicks active NFL board exceeded the twelve-page safety limit.");
  }
  return all;
}
function normalize(row, week) {
  const player = row.player || {};
  const market = row.market || {};
  const event = row.event || {};
  const starts = event.starts_at ? new Date(event.starts_at) : null;
  if (!player.name || !market.stat || !Number.isFinite(Number(row.line)) || !starts || Number.isNaN(starts.getTime())) return null;
  const dateParts = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(starts);
  const dateValues = Object.fromEntries(dateParts.map(part => [part.type, part.value]));
  const startDate = `${dateValues.year}-${dateValues.month}-${dateValues.day}`;
  const weekEnd = new Date(`${week}T12:00:00Z`);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);
  const end = weekEnd.toISOString().slice(0, 10);
  if (startDate < week || startDate > end || !fullGamePeriod(market.period)) return null;
  const selections = Array.isArray(row.selections) ? row.selections : [];
  const tier = selections.find(x => x.side === "more")?.tier || selections.find(x => x.side === "less")?.tier || row.source_fields?.odds_type || "unknown";
  return {
    projection_id: String(row.id || row.source_projection_id || ""),
    week_start: week,
    event_starts_at: starts.toISOString(),
    player_id: player.id ? String(player.id) : null,
    player_name: String(player.name).trim(),
    team: player.team || null,
    position: player.position || null,
    opponent: event.opponent || row.source_context?.opponent || null,
    stat: String(market.stat).trim(),
    period: market.period || "Full Game",
    line: Number(row.line),
    status: row.status || "active",
    tier: String(tier).toLowerCase(),
    more_available: selectionAvailable(selections, "more"),
    less_available: selectionAvailable(selections, "less"),
    source_updated_at: row.source_updated_at || row.observed_at || null,
    source_payload: row
  };
}
async function importBoard() {
  const week = weekStart(easternDate());
  const run = await query("INSERT INTO public.prizepicks_import_runs(week_start,status) VALUES($1,'syncing') RETURNING id", [week]);
  const runId = run.rows[0]?.id;
  try {
    const raw = await fetchBoard();
    const rows = raw.map(row => normalize(row, week)).filter(row => row && row.projection_id);
    if (!rows.length) throw new Error("PrizePicks returned no full-game NFL lines for the current week.");
    const capturedAt = new Date().toISOString();
    for (let i = 0; i < rows.length; i += 250) {
      const batch = rows.slice(i, i + 250).map(row => ({ ...row, captured_at: capturedAt }));
      await query(`INSERT INTO public.prizepicks_projection_snapshots
        (projection_id,week_start,captured_at,event_starts_at,player_id,player_name,team,position,opponent,stat,period,line,status,tier,more_available,less_available,source_updated_at,source_payload)
        SELECT x.projection_id,x.week_start::date,x.captured_at::timestamptz,x.event_starts_at::timestamptz,x.player_id,x.player_name,x.team,x.position,x.opponent,x.stat,x.period,x.line,x.status,x.tier,x.more_available,x.less_available,NULLIF(x.source_updated_at,'')::timestamptz,x.source_payload
        FROM jsonb_to_recordset($1::jsonb) AS x(projection_id text,week_start text,captured_at text,event_starts_at text,player_id text,player_name text,team text,position text,opponent text,stat text,period text,line numeric,status text,tier text,more_available boolean,less_available boolean,source_updated_at text,source_payload jsonb)`,
        [JSON.stringify(batch)]);
    }
    await query("UPDATE public.prizepicks_import_runs SET status='ready',row_count=$2,source_status='fresh' WHERE id=$1", [runId, rows.length]);
    return { ok: true, weekStart: week, imported: rows.length, capturedAt };
  } catch (error) {
    await query("UPDATE public.prizepicks_import_runs SET status='error',error=$2,source_status='failed' WHERE id=$1", [runId, error.message]).catch(() => {});
    throw error;
  }
}
async function readBoard() {
  const week = weekStart(easternDate());
  const [lines, runs] = await Promise.all([
    query(`WITH latest AS (
        SELECT DISTINCT ON (projection_id) projection_id,week_start,captured_at,event_starts_at,player_id,player_name,team,position,opponent,stat,period,line,status,tier,more_available,less_available,source_updated_at
        FROM public.prizepicks_projection_snapshots
        WHERE week_start=$1
        ORDER BY projection_id,captured_at DESC
      )
      SELECT * FROM latest WHERE status='active' ORDER BY event_starts_at,player_name,stat`, [week]),
    query(`SELECT imported_at,row_count,status,error,source_status
      FROM public.prizepicks_import_runs WHERE week_start=$1 ORDER BY imported_at DESC LIMIT 1`, [week])
  ]);
  return { ok: true, weekStart: week, projections: lines.rows, latestImport: runs.rows[0] || null };
}
export async function GET(request) {
  try {
    if (authorized(request)) {
      const result = await importBoard();
      return NextResponse.json({ ...result, ...(await readBoard()) }, { headers: { "Cache-Control": "no-store" } });
    }
    return NextResponse.json(await readBoard(), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("GET /api/prizepicks:", error);
    return NextResponse.json({ ok: false, error: error.message || "Unable to load PrizePicks lines." }, { status: 500 });
  }
}
export async function POST() {
  try {
    const result = await importBoard();
    return NextResponse.json({ ...result, ...(await readBoard()) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("POST /api/prizepicks:", error);
    return NextResponse.json({ ok: false, error: error.message || "Unable to import PrizePicks lines." }, { status: 500 });
  }
}
