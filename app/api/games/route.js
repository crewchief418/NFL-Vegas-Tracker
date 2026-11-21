import { NextResponse } from "next/server";
import { query } from "../../../lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function validCompetition(value) { return value === "regular" || value === "playoffs" || value === "all"; }
function normalizeTeam(value) {
  const name = String(value || "").trim();
  if (/^redskins$/i.test(name)) return "Commanders";
  if (/^patriors$/i.test(name)) return "Patriots";
  return name;
}
function calculateAts(awayScore, homeScore, spread) {
  if (awayScore == null || homeScore == null || spread == null) return { covered: null, result: "unknown" };
  const margin = Number(awayScore) + Number(spread) - Number(homeScore);
  if (margin === 0) return { covered: null, result: "push" };
  return margin > 0 ? { covered: "away", result: "away" } : { covered: "home", result: "home" };
}
function numericOrNull(value) {
  if (value === "" || value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : NaN;
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    if (searchParams.get("summary") === "1") {
      const result = await query(`SELECT COUNT(*) FILTER (WHERE competition_type='regular')::int AS regular,
        COUNT(*) FILTER (WHERE competition_type='playoffs')::int AS playoffs, COUNT(*)::int AS total FROM public.games`);
      return NextResponse.json(result.rows[0]);
    }
    const competition = searchParams.get("competition") || "regular";
    if (!validCompetition(competition)) return NextResponse.json({error:"Invalid competition type"},{status:400});
    const values=[]; let where="WHERE 1=1";
    if(competition!=="all"){values.push(competition);where+=` AND competition_type=$${values.length}`;}
    const season=searchParams.get("season"), team=searchParams.get("team"), completed=searchParams.get("completed");
    if(season&&/^\d{4}$/.test(season)){values.push(Number(season));where+=` AND season=$${values.length}`;}
    if(team){values.push(team);where+=` AND (away_team=$${values.length} OR home_team=$${values.length})`;}
    if(completed==="1")where+=" AND away_score IS NOT NULL";
    if(completed==="0")where+=" AND away_score IS NULL";
    const result=await query(`SELECT source_game_id,competition_type,season,game_type,
      to_char(game_date,'YYYY-MM-DD') AS game_date,to_char(game_time,'HH24:MI') AS game_time,
      away_team,home_team,favorite_team,favorite_spread,spread_text,spread_points,
      away_score,home_score,total_points,over_under_line,covered_team,ats_result,source_covered_team
      FROM public.games ${where} ORDER BY game_date,game_time NULLS LAST,source_game_id`,values);
    return NextResponse.json({games:result.rows});
  } catch(error){console.error("GET /api/games:",error);return NextResponse.json({error:"Unable to load games from the database."},{status:500});}
}

export async function PATCH(request) {
  try {
    const body=await request.json(), {competition_type,source_game_id}=body;
    if(!validCompetition(competition_type)||!Number.isInteger(Number(source_game_id)))return NextResponse.json({error:"A valid game identity is required."},{status:400});
    const currentSeason=new Date().getFullYear();
    const existing=await query("SELECT season FROM public.games WHERE competition_type=$1 AND source_game_id=$2",[competition_type,Number(source_game_id)]);
    if(!existing.rowCount)return NextResponse.json({error:"Game not found."},{status:404});
    if(Number(existing.rows[0].season)<currentSeason)return NextResponse.json({error:`${existing.rows[0].season} season games are locked. Only ${currentSeason} season games can be edited.`},{status:403});
    const awayScore=numericOrNull(body.away_score), homeScore=numericOrNull(body.home_score);
    const favoriteSpread=numericOrNull(body.favorite_spread), overUnder=numericOrNull(body.over_under_line);
    const isPick=body.favorite_team==="PK"||String(body.spread_text||"").trim().toUpperCase()==="PK";
    const favoriteTeam=isPick?"PK":(body.favorite_team||null);
    if((awayScore!==null&&(!Number.isInteger(awayScore)||awayScore<0))||(homeScore!==null&&(!Number.isInteger(homeScore)||homeScore<0))||
      ((awayScore===null)!==(homeScore===null))||(Number.isNaN(favoriteSpread)|| (favoriteSpread!==null&&favoriteSpread<0))||
      (Number.isNaN(overUnder)||(overUnder!==null&&overUnder<0))||
      (!isPick&&favoriteTeam&&![body.away_team,body.home_team].includes(favoriteTeam))||
      (!isPick&&favoriteSpread!==null&&favoriteSpread>0&&!favoriteTeam)||
      (isPick&&favoriteSpread!==null&&favoriteSpread!==0)){
      return NextResponse.json({error:"Select a valid favorite and non-negative spread, enter a valid over/under, and enter both scores together."},{status:400});
    }
    const favoritePoints=isPick?0:favoriteSpread;
    const spread=isPick?0:favoritePoints===null?null:favoriteTeam===body.away_team?-favoritePoints:favoriteTeam===body.home_team?favoritePoints:null;
    const displaySpread=isPick?"PK":favoritePoints===null?null:`${favoriteTeam} -${favoritePoints}`;
    const ats=calculateAts(awayScore,homeScore,spread);
    const actualTotal=awayScore===null?null:awayScore+homeScore;
    const result=await query(`UPDATE public.games SET away_score=$3,home_score=$4,spread_points=$5,spread_text=$6,
      favorite_team=$7,favorite_spread=$8,over_under_line=$9,total_points=$10,covered_team=$11,ats_result=$12,updated_at=now()
      WHERE competition_type=$1 AND source_game_id=$2 RETURNING source_game_id`,
      [competition_type,Number(source_game_id),awayScore,homeScore,spread,displaySpread,favoriteTeam,favoritePoints,overUnder,actualTotal,
       ats.covered==="away"?body.away_team:ats.covered==="home"?body.home_team:null,ats.result]);
    if(!result.rowCount)return NextResponse.json({error:"Game not found."},{status:404});
    return NextResponse.json({success:true,ats_result:ats.result,total_points:actualTotal,over_under_line:overUnder});
  }catch(error){console.error("PATCH /api/games:",error);return NextResponse.json({error:"Unable to save this game."},{status:500});}
}

export async function POST(request) {
  try {
    const body=await request.json();
    const awayTeam=normalizeTeam(body.away_team), homeTeam=normalizeTeam(body.home_team);
    if(!validCompetition(body.competition_type)||!Number.isInteger(Number(body.season))||!body.game_date||
      !awayTeam||!homeTeam||awayTeam===homeTeam)
      return NextResponse.json({error:"Enter a season, date, two different teams, and competition."},{status:400});
    const isPick=body.favorite_team==="PK", favoriteTeam=isPick?"PK":normalizeTeam(body.favorite_team)||null;
    const favoriteSpread=isPick?0:numericOrNull(body.favorite_spread), overUnder=numericOrNull(body.over_under_line);
    if(Number.isNaN(favoriteSpread)||(favoriteSpread!==null&&favoriteSpread<0)||(Number.isNaN(overUnder)||(overUnder!==null&&overUnder<0))||
      (favoriteTeam!=="PK"&&favoriteTeam&&![awayTeam,homeTeam].includes(favoriteTeam))||
      (!isPick&&favoriteSpread!==null&&favoriteSpread>0&&!favoriteTeam))
      return NextResponse.json({error:"Choose a valid favorite and spread, or select Pick’em; enter a valid over/under total."},{status:400});
    const spread=isPick?0:favoriteSpread===null?null:favoriteTeam===awayTeam?-favoriteSpread:favoriteSpread;
    const displaySpread=isPick?"PK":favoriteSpread===null?null:`${favoriteTeam} -${favoriteSpread}`;
    const nextId=await query("SELECT COALESCE(MAX(source_game_id),1000)+1 AS next_id FROM public.games WHERE competition_type=$1",[body.competition_type]);
    const result=await query(`INSERT INTO public.games
      (competition_type,source_game_id,season,game_type,game_date,game_time,away_team,home_team,
       favorite_team,favorite_spread,spread_text,spread_points,over_under_line,away_score,home_score,total_points,
       covered_team,ats_result,source_sheet,source_row)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,NULL,NULL,NULL,NULL,'unknown','Manual Entry',0)
      RETURNING source_game_id`,
      [body.competition_type,Number(nextId.rows[0].next_id),Number(body.season),body.game_type||null,body.game_date,body.game_time||null,
       awayTeam,homeTeam,favoriteTeam,favoriteSpread,displaySpread,spread,overUnder]);
    return NextResponse.json({success:true,source_game_id:result.rows[0].source_game_id},{status:201});
  }catch(error){console.error("POST /api/games:",error);return NextResponse.json({error:"Unable to create game. Check the date and betting lines."},{status:500});}
}
