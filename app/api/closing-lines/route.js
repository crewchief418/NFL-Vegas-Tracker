import { NextResponse } from "next/server";
import { query } from "../../../lib/db";
import { refreshEspnClosingLines } from "../../../lib/espn-closing-lines";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(request) {
  const secret=process.env.CRON_SECRET;
  return Boolean(secret)&&request.headers.get("authorization")===`Bearer ${secret}`;
}
export async function GET(request) {
  if(!authorized(request))return NextResponse.json({error:"Scheduled ESPN closing-line refresh requires CRON_SECRET."},{status:401});
  try {
    const result=await refreshEspnClosingLines();
    return NextResponse.json({ok:true,...result});
  } catch(error) {
    console.error("Scheduled ESPN closing-line refresh failed:",error);
    return NextResponse.json({ok:false,error:error.message},{status:500});
  }
}
export async function POST(request) {
  const manual=!authorized(request);
  try {
    const body=await request.json().catch(()=>({}));
    if(manual) {
      const lock=await query(`INSERT INTO public.data_source_sync(source,status,row_count,last_synced,last_error,metadata)
        VALUES('manual_espn_closing_lines','syncing',0,now(),NULL,'{}'::jsonb)
        ON CONFLICT(source) DO UPDATE SET status='syncing',last_synced=now(),last_error=NULL
        WHERE (public.data_source_sync.status='syncing' AND public.data_source_sync.last_synced < now()-interval '90 minutes')
          OR (public.data_source_sync.status='error' AND public.data_source_sync.last_synced < now()-interval '2 minutes')
          OR (public.data_source_sync.status='ready' AND public.data_source_sync.last_synced < now()-interval '5 minutes')
          OR public.data_source_sync.last_synced IS NULL
        RETURNING source`);
      if(!lock.rowCount)return NextResponse.json({error:"An ESPN closing-line batch ran recently. Wait five minutes before starting another batch."},{status:429});
    }
    const result=await refreshEspnClosingLines({retry:Boolean(body.retry),batchSize:80});
    if(manual)await query(`UPDATE public.data_source_sync SET status='ready',row_count=$1,last_synced=now(),last_error=NULL,metadata=$2::jsonb
      WHERE source='manual_espn_closing_lines'`,[result.updated,JSON.stringify(result)]);
    return NextResponse.json({ok:true,...result});
  } catch(error) {
    if(manual)await query("UPDATE public.data_source_sync SET status='error',last_synced=now(),last_error=$1 WHERE source='manual_espn_closing_lines'",[error.message]).catch(()=>{});
    console.error("Manual ESPN closing-line refresh failed:",error);
    return NextResponse.json({ok:false,error:error.message},{status:500});
  }
}
