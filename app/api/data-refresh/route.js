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
export async function GET(request){
  if(!authorized(request))return NextResponse.json({error:"Data refresh requires the configured CRON_SECRET."},{status:401});
  try{
    const result=await refreshExternalData();
    return NextResponse.json({ok:true,...result});
  }catch(error){
    console.error("NFL data refresh failed:",error);
    return NextResponse.json({ok:false,error:error.message},{status:500});
  }
}
export async function POST(request){
  if(!authorized(request))return NextResponse.json({error:"Data refresh requires the configured CRON_SECRET."},{status:401});
  try{
    const result=await refreshExternalData();
    return NextResponse.json({ok:true,...result});
  }catch(error){
    console.error("NFL data refresh failed:",error);
    return NextResponse.json({ok:false,error:error.message},{status:500});
  }
}
