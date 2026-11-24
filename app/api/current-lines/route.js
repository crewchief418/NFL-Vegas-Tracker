import { NextResponse } from "next/server";
import { loadCurrentEspnLines } from "../../../lib/espn-current-lines";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  try {
    return NextResponse.json({ok:true,...await loadCurrentEspnLines()},{headers:{"Cache-Control":"no-store"}});
  } catch(error) {
    console.error("GET /api/current-lines:",error);
    return NextResponse.json({ok:false,error:"Unable to load current ESPN sportsbook lines."},{status:500});
  }
}
