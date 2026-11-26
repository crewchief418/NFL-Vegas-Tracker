import { NextResponse } from "next/server";
import { query } from "../../../lib/db";
import { loadCurrentEspnLines } from "../../../lib/espn-current-lines";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(request) {
  const secret=process.env.CRON_SECRET;
  return Boolean(secret)&&request.headers.get("authorization")===`Bearer ${secret}`;
}

async function readCachedLines() {
  const result=await query(`SELECT metadata,last_synced,status,last_error
    FROM public.data_source_sync WHERE source='current_vegas_lines'`);
  const row=result.rows[0];
  if(!row)return {ok:true,status:"not_refreshed",fetchedAt:null,games:[]};
  return {ok:row.status==="ready",status:row.status,fetchedAt:row.metadata?.fetchedAt||row.last_synced,
    games:Array.isArray(row.metadata?.games)?row.metadata.games:[],error:row.last_error||undefined};
}

async function refreshAndSave() {
  const lock=await query(`INSERT INTO public.data_source_sync(source,status,row_count,last_synced,last_error,metadata)
    VALUES('current_vegas_lines','syncing',0,now(),NULL,'{}'::jsonb)
    ON CONFLICT(source) DO UPDATE SET status='syncing',last_synced=now(),last_error=NULL
    WHERE public.data_source_sync.status<>'syncing'
      OR public.data_source_sync.last_synced<now()-interval '20 minutes'
    RETURNING source`);
  if(!lock.rowCount) {
    const cached=await readCachedLines();
    return {...cached,refreshInProgress:true};
  }
  try {
    const fresh=await loadCurrentEspnLines();
    const ready=(fresh.games||[]).filter(game=>game.spreadPoints!==null||game.overUnder!==null).length;
    // Preserve the first pregame market snapshot as the opening line. Later
    // refreshes must never overwrite it.
    for (const game of fresh.games||[]) {
      if (game.spreadPoints===null && game.overUnder===null) continue;
      await query(`UPDATE public.games SET
        opening_spread_points=COALESCE(opening_spread_points,$3),
        opening_over_under_line=COALESCE(opening_over_under_line,$4),
        opening_favorite_team=COALESCE(opening_favorite_team,$5),
        opening_provider=COALESCE(opening_provider,$6),
        opening_updated_at=COALESCE(opening_updated_at,now())
        WHERE competition_type=$1 AND source_game_id=$2
          AND (opening_spread_points IS NULL OR opening_over_under_line IS NULL)`,
        [game.competition_type,game.source_game_id,game.spreadPoints,game.overUnder,game.favorite,game.provider]);
    }
    await query(`UPDATE public.data_source_sync
      SET status='ready',row_count=$1,last_synced=now(),last_error=NULL,metadata=$2::jsonb
      WHERE source='current_vegas_lines'`,[fresh.games.length,JSON.stringify(fresh)]);
    return {ok:true,status:"ready",...fresh,ready};
  } catch(error) {
    await query(`UPDATE public.data_source_sync SET status='error',last_synced=now(),last_error=$1
      WHERE source='current_vegas_lines'`,[error.message]).catch(()=>{});
    throw error;
  }
}

export async function GET(request) {
  try {
    if(authorized(request))return NextResponse.json(await refreshAndSave(),{headers:{"Cache-Control":"no-store"}});
    return NextResponse.json(await readCachedLines(),{headers:{"Cache-Control":"no-store"}});
  } catch(error) {
    console.error("GET /api/current-lines:",error);
    return NextResponse.json({ok:false,error:"Unable to load current ESPN sportsbook lines."},{status:500});
  }
}

export async function POST() {
  try {
    return NextResponse.json(await refreshAndSave(),{headers:{"Cache-Control":"no-store"}});
  } catch(error) {
    console.error("POST /api/current-lines:",error);
    return NextResponse.json({ok:false,error:"Unable to refresh current ESPN sportsbook lines."},{status:500});
  }
}
