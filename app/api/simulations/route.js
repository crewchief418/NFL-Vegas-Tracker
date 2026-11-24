import { NextResponse } from "next/server";
import { query } from "../../../lib/db";
import { buildPredictionReport } from "../../../lib/predictions";
import { simulateGame, DEFAULT_SIMULATIONS } from "../../../lib/simulation";

export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=60;

export async function GET(request){
  try{
    const [gamesResult,savedResult]=await Promise.all([
      query(`SELECT competition_type,source_game_id,season,to_char(game_date,'YYYY-MM-DD') AS game_date,
        to_char(game_time,'HH24:MI') AS game_time,away_team,home_team,
        COALESCE(closing_spread_points,spread_points) AS spread_points,
        COALESCE(closing_over_under_line,over_under_line) AS over_under_line,
        away_score,home_score,ats_result FROM public.games ORDER BY game_date,game_time NULLS LAST,source_game_id`),
      query(`SELECT report,generated_at FROM public.market_prediction_runs ORDER BY generated_at DESC,id DESC LIMIT 1`)
    ]);
    if(!savedResult.rows.length) return NextResponse.json({error:"Generate a forecast first so simulations use the current model predictions."},{status:409});
    const games=gamesResult.rows;
    const history=games.filter(g=>g.away_score!=null&&g.home_score!=null);
    const calibration=buildPredictionReport(history,[]).simulationCalibration||[];
    const report=savedResult.rows[0].report;
    const active=new Map(games.filter(g=>g.away_score==null&&g.home_score==null).map(g=>[`${g.competition_type}:${g.source_game_id}`,g]));
    const forecasts=(report.upcoming||[]).filter(p=>active.has(`${p.competition_type}:${p.source_game_id}`));
    const simulations=forecasts.map(forecast=>{
      const game=active.get(`${forecast.competition_type}:${forecast.source_game_id}`);
      return {...forecast,...simulateGame(forecast,calibration,DEFAULT_SIMULATIONS),away_team:game.away_team,home_team:game.home_team,game_date:String(game.game_date).slice(0,10),game_time:game.game_time,spread_points:game.spread_points,over_under_line:game.over_under_line};
    });
    return NextResponse.json({generatedAt:savedResult.rows[0].generated_at,modelVersion:report.modelVersion,calibrationGames:calibration.length,minimumCalibrationGames:100,simulations});
  }catch(error){console.error("GET /api/simulations:",error);return NextResponse.json({error:"Unable to build simulations from the historical model data."},{status:500});}
}
