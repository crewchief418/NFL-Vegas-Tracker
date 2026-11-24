// Empirical paired-residual Monte Carlo engine. Uses only chronological
// out-of-sample historical errors from the walk-forward backtest.
export const DEFAULT_SIMULATIONS = 10000;
const MIN_CALIBRATION_GAMES = 100;
const clamp = (n,min,max)=>Math.max(min,Math.min(max,n));
const round = n=>Math.round(n*10)/10;

function seededRandom(seed) {
  let value = (Number(seed) || 1) >>> 0;
  return () => {
    value += 0x6D2B79F5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const reachableScores=(()=>{const values=new Set([0]);for(let score=0;score<=70;score++){if(values.has(score)){for(const points of [2,3,6,7,8])values.add(score+points);}}return [...values].sort((a,b)=>a-b);})();
function nearestFootballScore(value){let best=0,distance=Infinity;for(const score of reachableScores){const next=Math.abs(score-value);if(next<distance){best=score;distance=next;}}return best;}
function plausibleScores(margin,total) {
  const safeTotal = Math.max(0,total);
  const safeMargin = clamp(margin,-safeTotal,safeTotal);
  const rawHome = (safeTotal+safeMargin)/2;
  const rawAway = (safeTotal-safeMargin)/2;
  const home = nearestFootballScore(Math.max(0,rawHome));
  const away = nearestFootballScore(Math.max(0,rawAway));
  return {home,away,margin:home-away,total:home+away};
}
export function simulateGame(game, residuals, simulations=DEFAULT_SIMULATIONS) {
  const samples = (residuals||[]).filter(r=>Number.isFinite(Number(r.marginError))&&Number.isFinite(Number(r.totalError)));
  if(samples.length<MIN_CALIBRATION_GAMES) return {available:false,reason:`Only ${samples.length} eligible historical forecast errors are available; at least ${MIN_CALIBRATION_GAMES} are required.`,calibrationGames:samples.length};
  const count=clamp(Math.floor(Number(simulations)||DEFAULT_SIMULATIONS),1000,50000);
  const seedText=`${game.competition_type}:${game.source_game_id}:${game.game_date}:${game.predicted_home_margin}:${game.predicted_total_points}:${samples.length}`;
  let seed=2166136261; for(const ch of seedText) seed=Math.imul(seed^ch.charCodeAt(0),16777619);
  const random=seededRandom(seed);
  const outcomes=[];
  let homeWins=0,awayWins=0,ties=0,homeCovers=0,awayCovers=0,coverPushes=0,overs=0,unders=0,totalPushes=0;
  const spread=game.spread_points==null?null:Number(game.spread_points);
  const totalLine=game.over_under_line==null?null:Number(game.over_under_line);
  for(let i=0;i<count;i++){
    const residual=samples[Math.floor(random()*samples.length)];
    const margin=Number(game.predicted_home_margin)+Number(residual.marginError);
    const total=Number(game.predicted_total_points)+Number(residual.totalError);
    const score=plausibleScores(margin,total);
    if(score.margin>0)homeWins++; else if(score.margin<0)awayWins++; else ties++;
    if(spread!==null){const cover=score.margin-spread;if(cover>0)homeCovers++;else if(cover<0)awayCovers++;else coverPushes++;}
    if(totalLine!==null){if(score.total>totalLine)overs++;else if(score.total<totalLine)unders++;else totalPushes++;}
    outcomes.push(score);
  }
  const pct=n=>round(n/count*100);
  const avg=key=>round(outcomes.reduce((sum,row)=>sum+row[key],0)/count);
  const sorted=key=>outcomes.map(row=>row[key]).sort((a,b)=>a-b);
  const quantile=(arr,q)=>arr[Math.min(arr.length-1,Math.floor((arr.length-1)*q))];
  const margins=sorted("margin"), totals=sorted("total");
  const bins=Array.from({length:11},(_,i)=>({label:String(i*10)+"–"+String(i*10+9)+"%",games:0}));
  const winPct=pct(homeWins);
  return {
    available:true,simulations:count,calibrationGames:samples.length,
    homeWinProbability:pct(homeWins),awayWinProbability:pct(awayWins),tieProbability:pct(ties),
    projectedHomeScore:round(avg("home")),projectedAwayScore:round(avg("away")),
    projectedMargin:avg("margin"),projectedTotal:avg("total"),
    marginRange:[quantile(margins,.1),quantile(margins,.9)],totalRange:[quantile(totals,.1),quantile(totals,.9)],
    homeCoverProbability:spread===null?null:pct(homeCovers),awayCoverProbability:spread===null?null:pct(awayCovers),coverPushProbability:spread===null?null:pct(coverPushes),
    overProbability:totalLine===null?null:pct(overs),underProbability:totalLine===null?null:pct(unders),totalPushProbability:totalLine===null?null:pct(totalPushes),
    histogram:Array.from({length:13},(_,i)=>{const low=-30+i*5,high=low+4;return {range:`${low} to ${high}`,count:outcomes.filter(row=>row.margin>=low&&row.margin<=high).length};}),
    method:"Paired empirical residual bootstrap from chronological walk-forward backtests",
    probabilityNote:"Monte Carlo frequencies are empirical estimates, not guarantees. Accuracy depends on historical calibration and input quality."
  };
}
export { MIN_CALIBRATION_GAMES };
