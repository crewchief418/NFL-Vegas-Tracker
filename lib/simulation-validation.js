import { simulateGame } from "./simulation.js";

const round=(n,d=4)=>Number(n.toFixed(d));
const logistic=x=>1/(1+Math.exp(-Math.max(-30,Math.min(30,x))));
function scoreMetrics(rows,key){
  const usable=rows.filter(row=>Number.isFinite(row[key]));
  if(!usable.length)return {games:0,accuracy:null,brier:null,logLoss:null};
  const hits=usable.filter(row=>(row[key]>=.5)===(row.actualWinner==="home")).length;
  const brier=usable.reduce((sum,row)=>sum+(row[key]-(row.actualWinner==="home"?1:0))**2,0)/usable.length;
  const logLoss=usable.reduce((sum,row)=>{const p=Math.max(.000001,Math.min(.999999,row[key]));return sum-(row.actualWinner==="home"?Math.log(p):Math.log(1-p));},0)/usable.length;
  return {games:usable.length,correct:hits,accuracy:round(hits/usable.length*100,1),brier:round(brier),logLoss:round(logLoss)};
}
function calibrationBuckets(rows,key){
  return Array.from({length:5},(_,i)=>{
    const min=i*.2,max=min+.2;
    const bucket=rows.filter(row=>Number.isFinite(row[key])&&row[key]>=min&&(i===4?row[key]<=1:row[key]<max));
    return {range:`${Math.round(min*100)}–${Math.round(max*100)}%`,games:bucket.length,
      predicted:bucket.length?round(bucket.reduce((s,r)=>s+r[key],0)/bucket.length,3):null,
      actual:bucket.length?round(bucket.filter(r=>r.actualWinner==="home").length/bucket.length,3):null};
  });
}
export function buildSimulationValidation(backtestRows, minimumPriorGames=100){
  const rows=[...(backtestRows||[])].sort((a,b)=>String(a.gameDate).localeCompare(String(b.gameDate))||String(a.sourceGameId).localeCompare(String(b.sourceGameId)));
  const residuals=[];
  const evaluated=[];
  let cursor=0;
  while(cursor<rows.length){
    const date=rows[cursor].gameDate;
    const sameDay=[];
    while(cursor<rows.length&&rows[cursor].gameDate===date)sameDay.push(rows[cursor++]);
    // Simulate a date using only residuals from strictly earlier calendar dates.
    if(residuals.length>=minimumPriorGames){
      for(const row of sameDay){
        if(row.actualWinner!=="home"&&row.actualWinner!=="away")continue;
        const sim=simulateGame({
          competition_type:row.competitionType,source_game_id:row.sourceGameId,game_date:row.gameDate,
          predicted_home_margin:row.predictedMargin,predicted_total_points:row.predictedTotal,
          spread_points:row.spreadPoints,over_under_line:row.overUnderLine
        },residuals,1000);
        if(!sim.available)continue;
        const marketHomeProbability=row.spreadPoints==null?null:logistic(Number(row.spreadPoints)/7.5);
        evaluated.push({
          actualWinner:row.actualWinner,
          simulation:sim.homeWinProbability/100,
          model:row.homeWinProbability,
          market:marketHomeProbability,
          simulationHomeCover:sim.homeCoverProbability==null?null:sim.homeCoverProbability/100,
          actualHomeCover:row.atsResult==="home"?1:row.atsResult==="away"?0:null
        });
      }
    }
    // Add this date's errors only after every game on the date has been evaluated.
    for(const row of sameDay){
      if(Number.isFinite(row.actualMargin)&&Number.isFinite(row.predictedMargin)&&Number.isFinite(row.actualTotal)&&Number.isFinite(row.predictedTotal)){
        residuals.push({marginError:row.actualMargin-row.predictedMargin,totalError:row.actualTotal-row.predictedTotal});
      }
    }
  }
  const simulation=scoreMetrics(evaluated,"simulation");
  const model=scoreMetrics(evaluated,"model");
  const marketRows=evaluated.filter(row=>row.market!==null);
  const market=scoreMetrics(marketRows,"market");
  const coverRows=evaluated.filter(row=>row.actualHomeCover!==null&&row.simulationHomeCover!==null);
  const coverBrier=coverRows.length?round(coverRows.reduce((sum,row)=>sum+(row.simulationHomeCover-row.actualHomeCover)**2,0)/coverRows.length):null;
  const pairedDifferences=evaluated.map(row=>(row.model-(row.actualWinner==="home"?1:0))**2-(row.simulation-(row.actualWinner==="home"?1:0))**2);
  const improvement=pairedDifferences.length?round(pairedDifferences.reduce((sum,value)=>sum+value,0)/pairedDifferences.length):null;
  const variance=pairedDifferences.length>1?pairedDifferences.reduce((sum,value)=>sum+(value-improvement)**2,0)/(pairedDifferences.length-1):null;
  const standardError=variance==null?null:Math.sqrt(variance/pairedDifferences.length);
  const improvementCi95=standardError==null?null:[round(improvement-1.96*standardError),round(improvement+1.96*standardError)];
  return {
    methodology:"Expanding-window walk-forward residual bootstrap. Each evaluation date uses only errors from earlier dates; all games on the same date are held out together.",
    minimumPriorCalibrationGames:minimumPriorGames,
    calibrationGamesAvailable:residuals.length,
    evaluatedGames:evaluated.length,
    simulation,existingModel:model,vegasSpreadImplied:market,
    simulationHomeCover:{games:coverRows.length,brier:coverBrier},
    simulationBrierImprovementVsModel:improvement,simulationBrierImprovementVsModelCi95:improvementCi95,
    calibration:calibrationBuckets(evaluated,"simulation"),
    vegasMethodNote:"Closing spread converted to an approximate home-win probability using a fixed logistic scale of 7.5 points. This is a transparent benchmark, not a sportsbook moneyline or a de-vigged market probability.",
    caveat:"Historical validation is conditional on available game data and uses the same historical core model forecast series. Treat small samples cautiously; this does not prove future performance."
  };
}
