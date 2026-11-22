import { NextResponse } from "next/server";
import { refreshNflSchedule } from "../../../lib/espn-schedule";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request) {
  const secret=process.env.CRON_SECRET;
  if(!secret||request.headers.get("authorization")!==`Bearer ${secret}`)
    return NextResponse.json({error:"Scheduled schedule sync requires CRON_SECRET."},{status:401});
  try {
    const result=await refreshNflSchedule();
    return NextResponse.json({success:true,...result});
  } catch(error) {
    console.error("NFL schedule sync failed:",error);
    return NextResponse.json({success:false,error:error.message},{status:500});
  }
}
