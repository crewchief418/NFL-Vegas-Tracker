import { NextResponse } from "next/server";
import { query } from "../../../lib/db";
import { syncDepthCharts } from "../../../lib/external-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(){
  try{
    const seasonResult=await query("SELECT MAX(season) AS season FROM public.games");
    const season=Number(seasonResult.rows[0]?.season)||new Date().getUTCFullYear();
    const lock=await query(`INSERT INTO public.data_source_sync (source,status,row_count,last_synced,last_error,metadata)
      VALUES ('nflverse_depth_charts','syncing',0,now(),NULL,'{}'::jsonb)
      ON CONFLICT (source) DO UPDATE SET status='syncing',last_synced=now(),last_error=NULL
      WHERE (public.data_source_sync.status='syncing' AND public.data_source_sync.last_synced < now()-interval '30 minutes')
         OR (public.data_source_sync.status IN ('ready','error') AND public.data_source_sync.last_synced < now()-interval '20 hours')
         OR public.data_source_sync.last_synced IS NULL
      RETURNING source`);
    if(!lock.rowCount){
      const state=await query("SELECT status,last_synced,row_count,metadata FROM public.data_source_sync WHERE source='nflverse_depth_charts'");
      return NextResponse.json({ok:true,skipped:true,...(state.rows[0]||{})});
    }
    try{
      const depthChartRows=await syncDepthCharts(season);
      return NextResponse.json({ok:true,season,depthChartRows});
    }catch(error){
      await query(`UPDATE public.data_source_sync SET status='error',last_error=$1,last_synced=now() WHERE source='nflverse_depth_charts'`,[error.message]);
      throw error;
    }
  }catch(error){
    console.error("NFL depth chart sync failed:",error);
    return NextResponse.json({ok:false,error:error.message},{status:500});
  }
}
