import { NextResponse } from "next/server";
import { query } from "../../../lib/db";
import { refreshExternalData } from "../../../lib/external-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(request){
  const secret=process.env.CRON_SECRET;
  return Boolean(secret)&&request.headers.get("authorization")===`Bearer ${secret}`;
}
async function runRefresh(manual=false){
  if(manual){
    const lock=await query(`INSERT INTO public.data_source_sync (source,status,row_count,last_synced,last_error,metadata)
      VALUES ('manual_external_refresh','syncing',0,now(),NULL,'{}'::jsonb)
      ON CONFLICT (source) DO UPDATE SET status='syncing',last_synced=now(),last_error=NULL
      WHERE public.data_source_sync.status <> 'syncing'
      AND (public.data_source_sync.last_synced IS NULL OR public.data_source_sync.last_synced < now()-interval '20 hours')
      RETURNING source`);
    if(!lock.rowCount) return {limited:true};
  }
  try{
    const result=await refreshExternalData();
    if(manual)await query(`UPDATE public.data_source_sync SET status='ready',row_count=$1,last_synced=now(),last_error=NULL,metadata=$2::jsonb
      WHERE source='manual_external_refresh'`,[result.teamRows+result.playerRows+result.injuryRows+result.weatherGames,JSON.stringify(result)]);
    return {ok:true,...result};
  }catch(error){
    if(manual)await query(`UPDATE public.data_source_sync SET status='error',last_synced=now(),last_error=$1 WHERE source='manual_external_refresh'`,[error.message]);
    throw error;
  }
}
export async function GET(request){
  if(!authorized(request))return NextResponse.json({error:"Scheduled data refresh requires CRON_SECRET."},{status:401});
  try{
    const result=await runRefresh(false);
    return NextResponse.json(result);
  }catch(error){
    console.error("NFL scheduled data refresh failed:",error);
    return NextResponse.json({ok:false,error:error.message},{status:500});
  }
}
export async function POST(request){
  const manual=!authorized(request);
  try{
    const result=await runRefresh(manual);
    if(result.limited)return NextResponse.json({error:"Free data was refreshed recently. Try again after the 20-hour refresh window."},{status:429});
    return NextResponse.json(result);
  }catch(error){
    console.error("NFL manual data refresh failed:",error);
    return NextResponse.json({ok:false,error:error.message},{status:500});
  }
}
