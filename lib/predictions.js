import { buildSimulationValidation } from "./simulation-validation.js";
export const MODEL_VERSION = "elo-form-context-v2";

const LEAGUE_AVERAGE_POINTS = 22.5;
const ELO_K = 20;
const HOME_ADVANTAGE = 55;
const ELO_TO_POINTS = 28;
const LOGIT_WIN_SCALE = 7.5;
const LOGIT_MARGIN_SCALE = 6.8;
const LOGIT_TOTAL_SCALE = 6.5;
const RECENT_GAMES = 10;

function logistic(value) {
  return 1 / (1 + Math.exp(-Math.max(-30, Math.min(30, value))));
}
function round(value, digits = 3) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
function gameOrder(a, b) {
  const date = String(a.game_date).localeCompare(String(b.game_date));
  if (date) return date;
  const time = String(a.game_time || "").localeCompare(String(b.game_time || ""));
  if (time) return time;
  return Number(a.source_game_id) - Number(b.source_game_id);
}
function ensureTeam(state, name) {
  if (!state.ratings.has(name)) state.ratings.set(name, 1500);
  if (!state.recent.has(name)) state.recent.set(name, []);
}
function recentAverage(state, team, field) {
  const rows = state.recent.get(team) || [];
  if (!rows.length) return { value: LEAGUE_AVERAGE_POINTS, count: 0 };
  const mean = rows.reduce((sum, row) => sum + row[field], 0) / rows.length;
  const weight = rows.length / (rows.length + 4);
  return { value: LEAGUE_AVERAGE_POINTS + (mean - LEAGUE_AVERAGE_POINTS) * weight, count: rows.length };
}
function metricAverage(rows, keys) {
  const values = (rows || []).map(row => {
    for (const key of keys) {
      const raw = row?.payload?.[key] ?? row?.[key];
      const value = Number(raw);
      if (raw !== undefined && raw !== null && raw !== "" && Number.isFinite(value)) return value;
    }
    return null;
  }).filter(value => value !== null);
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}
function teamYardsPerPlay(rows) {
  const direct = metricAverage(rows, ["yards_per_play", "off_yards_per_play"]);
  if (direct !== null) return direct;
  const derived = (rows || []).map(row => {
    const p = row?.payload || row || {};
    const yards = Number(p.passing_yards) + Number(p.rushing_yards);
    const plays = Number(p.attempts) + Number(p.rushing_attempts ?? p.rush_attempts) + Number(p.sacks_suffered || 0);
    return Number.isFinite(yards) && Number.isFinite(plays) && plays > 0 ? yards / plays : null;
  }).filter(value => value !== null);
  return derived.length ? derived.reduce((sum,value)=>sum+value,0)/derived.length : null;
}
function teamTurnovers(rows) {
  const direct = metricAverage(rows, ["turnovers", "total_turnovers", "turnovers_lost"]);
  if (direct !== null) return direct;
  const interceptions = metricAverage(rows, ["passing_interceptions"]);
  const fumbles = metricAverage(rows, ["fumbles_lost"]);
  return interceptions === null && fumbles === null ? null : (interceptions || 0) + (fumbles || 0);
}
function quarterbackImpact(injuries, qbStats) {
  const totals = new Map();
  for (const row of qbStats || []) {
    const name = row.player_name || "";
    if (!name) continue;
    const attempts = Number(row.payload?.attempts ?? row.payload?.passing_attempts ?? 0) || 0;
    totals.set(name, (totals.get(name) || 0) + attempts);
  }
  const likelyStarter = [...totals.entries()].sort((a,b)=>b[1]-a[1])[0]?.[0];
  if (!likelyStarter) return { points: 0, player: null, status: null, stats: [] };
  const stats = (qbStats || []).filter(row => row.player_name === likelyStarter);
  const player = (injuries || []).find(row => String(row.position || "").toUpperCase() === "QB"
    && String(row.player_name || "").toLowerCase() === likelyStarter.toLowerCase()
    && /out|doubtful|questionable/i.test(String(row.report_status || "")));
  if (!player) return { points: 0, player: likelyStarter, status: null, stats };
  const status = String(player.report_status).toLowerCase();
  const points = status.includes("out") ? 3.5 : status.includes("doubtful") ? 2 : 0.75;
  return { points, player: player.player_name || likelyStarter, status: player.report_status, stats };
}
function supportingPlayerInjuryImpact(injuries, playerStats) {
  const weights={RB:0.55,WR:0.42,TE:0.30,FB:0.25,OT:0.32,LT:0.32,RT:0.32,OG:0.28,LG:0.28,RG:0.28,C:0.28,G:0.28,T:0.28};
  let points=0;
  const affected=[];
  const seen=new Set();
  for(const injury of injuries||[]){
    const position=String(injury.position||"").toUpperCase();
    if(position==="QB"||!weights[position])continue;
    const status=String(injury.report_status||"").toLowerCase();
    const practice=String(injury.practice_status||"").toLowerCase();
    const severity=status.includes("out")||status.includes("injured reserve")?1:
      status.includes("doubtful") ? 0.7 : status.includes("questionable") ? 0.3 :
      practice.includes("did not participate")||practice==="dnp" ? 0.2 : practice.includes("limited") ? 0.1 : 0;
    if(!severity)continue;
    const key=String(injury.player_id||injury.player_name).toLowerCase();
    if(seen.has(key))continue;
    seen.add(key);
    const rows=(playerStats||[]).filter(row=>
      String(row.player_id||"").toLowerCase()===String(injury.player_id||"").toLowerCase()||
      String(row.player_name||"").toLowerCase()===String(injury.player_name||"").toLowerCase());
    const ppg=metricAverage(rows,["fantasy_points_ppr","fantasy_points"]);
    const roleFactor=ppg==null?1:Math.max(.55,Math.min(1.5,.65+ppg/18));
    const impact=weights[position]*severity*roleFactor;
    points+=impact;
    affected.push({player:injury.player_name,position,status:injury.report_status||injury.practice_status,impact:round(impact,2)});
  }
  return {points:Math.min(2,points),players:affected};
}
function predictGame(game, state, external = {}) {
  ensureTeam(state, game.away_team);
  ensureTeam(state, game.home_team);
  const awayRating = state.ratings.get(game.away_team);
  const homeRating = state.ratings.get(game.home_team);
  const eloDiff = homeRating - awayRating + HOME_ADVANTAGE;
  const eloMargin = eloDiff / ELO_TO_POINTS;
  const homeOffense = recentAverage(state, game.home_team, "scored");
  const homeDefense = recentAverage(state, game.home_team, "allowed");
  const awayOffense = recentAverage(state, game.away_team, "scored");
  const awayDefense = recentAverage(state, game.away_team, "allowed");
  const projectedHomeFromForm = (homeOffense.value + awayDefense.value) / 2;
  const projectedAwayFromForm = (awayOffense.value + homeDefense.value) / 2;
  const formMargin = projectedHomeFromForm - projectedAwayFromForm;
  const formTotal = projectedHomeFromForm + projectedAwayFromForm;
  const homeEpa = metricAverage(external.homeTeamStats, ["off_epa", "offensive_epa", "epa_per_play", "off_epa_per_play"]);
  const awayEpa = metricAverage(external.awayTeamStats, ["off_epa", "offensive_epa", "epa_per_play", "off_epa_per_play"]);
  const homeYpp = teamYardsPerPlay(external.homeTeamStats);
  const awayYpp = teamYardsPerPlay(external.awayTeamStats);
  const homeTurnovers = teamTurnovers(external.homeTeamStats);
  const awayTurnovers = teamTurnovers(external.awayTeamStats);
  const efficiencyAdjustment = homeEpa !== null && awayEpa !== null
    ? (homeEpa - awayEpa) * 10
    : homeYpp !== null && awayYpp !== null ? (homeYpp - awayYpp) * 0.6 : 0;
  const turnoverAdjustment = homeTurnovers !== null && awayTurnovers !== null
    ? (awayTurnovers - homeTurnovers) * 0.35 : 0;
  const teamEfficiencyAdjustment = Math.max(-2.5, Math.min(2.5, efficiencyAdjustment + turnoverAdjustment));
  const homeQB = quarterbackImpact(external.homeInjuries, external.homeQBStats);
  const awayQB = quarterbackImpact(external.awayInjuries, external.awayQBStats);
  const homeQbEpa = metricAverage(homeQB.stats, ["passing_epa"]);
  const awayQbEpa = metricAverage(awayQB.stats, ["passing_epa"]);
  const qbPerformanceAdjustment = homeQbEpa !== null && awayQbEpa !== null
    ? Math.max(-2, Math.min(2, (homeQbEpa - awayQbEpa) * 0.25)) : 0;
  const injuryAdjustment = awayQB.points - homeQB.points;\n  const homeSkillInjuries = supportingPlayerInjuryImpact(external.homeInjuries, external.homePlayerStats);\n  const awaySkillInjuries = supportingPlayerInjuryImpact(external.awayInjuries, external.awayPlayerStats);\n  const skillPositionInjuryAdjustment = awaySkillInjuries.points - homeSkillInjuries.points;
  const weather = external.weather || null;
  const wind = weather?.wind_max_mph == null ? NaN : Number(weather.wind_max_mph);
  const precipitation = weather?.precipitation_in == null ? NaN : Number(weather.precipitation_in);
  const temperature = weather?.temperature_min_f == null ? NaN : Number(weather.temperature_min_f);
  const windPenalty = Number.isFinite(wind) ? Math.max(0, Math.min(2.5, (wind - 18) * 0.12)) : 0;
  const rainPenalty = Number.isFinite(precipitation) && precipitation >= 0.2 ? 0.4 : 0;
  const coldPenalty = Number.isFinite(temperature) && temperature <= 25 ? 0.4 : 0;
  const weatherTotalAdjustment = windPenalty + rainPenalty + coldPenalty;
  const predictedHomeMargin = 0.62 * eloMargin + 0.38 * formMargin + teamEfficiencyAdjustment + qbPerformanceAdjustment + injuryAdjustment + skillPositionInjuryAdjustment;
  const predictedTotalPoints = Math.max(20, Math.min(65, formTotal - weatherTotalAdjustment));
  const homeWinProbability = logistic(predictedHomeMargin / LOGIT_WIN_SCALE);
  const spread = game.spread_points == null ? null : Number(game.spread_points);
  const totalLine = game.over_under_line == null ? null : Number(game.over_under_line);
  const homeCoverProbability = spread == null ? null : logistic((predictedHomeMargin - spread) / LOGIT_MARGIN_SCALE);
  const overProbability = totalLine == null ? null : logistic((predictedTotalPoints - totalLine) / LOGIT_TOTAL_SCALE);
  const sampleSize = Math.min(homeOffense.count, awayOffense.count);
  const confidence = Math.abs(homeWinProbability - 0.5) >= 0.22 ? "High" : Math.abs(homeWinProbability - 0.5) >= 0.12 ? "Moderate" : "Low";
  return {
    competition_type: game.competition_type,
    source_game_id: Number(game.source_game_id),
    season: Number(game.season),
    game_date: String(game.game_date).slice(0, 10),
    game_time: game.game_time || null,
    away_team: game.away_team,
    home_team: game.home_team,
    spread_points: spread,
    over_under_line: totalLine,
    predicted_home_win_probability: round(homeWinProbability),
    predicted_home_cover_probability: homeCoverProbability == null ? null : round(homeCoverProbability),
    predicted_over_probability: overProbability == null ? null : round(overProbability),
    predicted_home_margin: round(predictedHomeMargin, 2),
    predicted_total_points: round(predictedTotalPoints, 2),
    confidence,
    sample_size: sampleSize,
    feature_snapshot: {
      home_elo: round(homeRating, 1),
      away_elo: round(awayRating, 1),
      elo_difference_with_home_field: round(eloDiff, 1),
      home_recent_games: homeOffense.count,
      away_recent_games: awayOffense.count,
      home_recent_scoring: round(homeOffense.value, 2),
      away_recent_scoring: round(awayOffense.value, 2),
      home_recent_points_allowed: round(homeDefense.value, 2),
      away_recent_points_allowed: round(awayDefense.value, 2),
      method: "Walk-forward Elo + last-10 scoring/defense blend with current NFL context",
      nflverse_team_weeks: { home: external.homeTeamStats?.length || 0, away: external.awayTeamStats?.length || 0 },
      team_efficiency_adjustment: round(teamEfficiencyAdjustment, 2),
      quarterback_performance_adjustment: round(qbPerformanceAdjustment, 2),
      home_qb_passing_epa: homeQbEpa == null ? null : round(homeQbEpa, 2),
      away_qb_passing_epa: awayQbEpa == null ? null : round(awayQbEpa, 2),
      quarterback_injury_adjustment: round(injuryAdjustment, 2),\n      skill_position_injury_adjustment: round(skillPositionInjuryAdjustment, 2),\n      home_skill_position_injuries: homeSkillInjuries.players,\n      away_skill_position_injuries: awaySkillInjuries.players,
      home_quarterback_report: { player: homeQB.player, status: homeQB.status },
      away_quarterback_report: { player: awayQB.player, status: awayQB.status },
      home_injury_count: external.homeInjuries?.length || 0,
      away_injury_count: external.awayInjuries?.length || 0,
      quarterback_recent_stats: { home: external.homeQBStats?.slice(0, 3) || [], away: external.awayQBStats?.slice(0, 3) || [] },
      weather: weather ? {
        stadium: weather.stadium,
        temperature_max_f: weather.temperature_max_f == null ? null : Number(weather.temperature_max_f),
        temperature_min_f: weather.temperature_min_f == null ? null : Number(weather.temperature_min_f),
        wind_max_mph: weather.wind_max_mph == null ? null : Number(weather.wind_max_mph),
        wind_gust_max_mph: weather.wind_gust_max_mph == null ? null : Number(weather.wind_gust_max_mph),
        precipitation_in: weather.precipitation_in == null ? null : Number(weather.precipitation_in),
        weather_code: weather.weather_code == null ? null : Number(weather.weather_code),
        total_adjustment: round(-weatherTotalAdjustment, 2)
      } : null
    }
  };
}
function updateState(game, prediction, state) {
  const awayScore = Number(game.away_score);
  const homeScore = Number(game.home_score);
  if (!Number.isFinite(awayScore) || !Number.isFinite(homeScore)) return;
  const margin = homeScore - awayScore;
  const eloDiff = state.ratings.get(game.home_team) - state.ratings.get(game.away_team) + HOME_ADVANTAGE;
  const expectedHome = logistic((eloDiff * Math.LN10) / 400);
  const actualHome = margin > 0 ? 1 : margin < 0 ? 0 : 0.5;
  const movMultiplier = Math.log(Math.abs(margin) + 1) * (2.2 / (2.2 + 0.001 * Math.abs(eloDiff)));
  const change = ELO_K * movMultiplier * (actualHome - expectedHome);
  state.ratings.set(game.home_team, state.ratings.get(game.home_team) + change);
  state.ratings.set(game.away_team, state.ratings.get(game.away_team) - change);
  const homeRows = state.recent.get(game.home_team) || [];
  const awayRows = state.recent.get(game.away_team) || [];
  homeRows.push({ scored: homeScore, allowed: awayScore });
  awayRows.push({ scored: awayScore, allowed: homeScore });
  if (homeRows.length > RECENT_GAMES) homeRows.shift();
  if (awayRows.length > RECENT_GAMES) awayRows.shift();
  state.recent.set(game.home_team, homeRows);
  state.recent.set(game.away_team, awayRows);
}
function createState() {
  return { ratings: new Map(), recent: new Map(), season: null };
}
function regressForSeason(state, season) {
  if (state.season === null) {
    state.season = season;
    return;
  }
  if (Number(season) !== Number(state.season)) {
    for (const [team, rating] of state.ratings.entries()) state.ratings.set(team, 1500 + (rating - 1500) * 0.72);
    state.season = season;
  }
}
function outcomeMetrics(rows) {
  const winRows = rows.filter(row => row.actualWinner === "home" || row.actualWinner === "away");
  const winHits = winRows.filter(row => row.predictedWinner === row.actualWinner).length;
  const brier = winRows.length ? winRows.reduce((sum, row) => {
    const actual = row.actualWinner === "home" ? 1 : 0;
    return sum + (row.homeWinProbability - actual) ** 2;
  }, 0) / winRows.length : null;
  const atsRows = rows.filter(row => row.atsResult === "home" || row.atsResult === "away");
  const atsHits = atsRows.filter(row => row.predictedHomeCover === (row.atsResult === "home")).length;
  const ouRows = rows.filter(row => row.ouResult === "over" || row.ouResult === "under");
  const ouHits = ouRows.filter(row => row.predictedOver === (row.ouResult === "over")).length;
  const marginRows = rows.filter(row => Number.isFinite(row.actualMargin));
  const totalRows = rows.filter(row => Number.isFinite(row.actualTotal));
  return {
    games: rows.length,
    winner: { games: winRows.length, correct: winHits, accuracy: winRows.length ? round(winHits / winRows.length * 100, 1) : null, brier: brier == null ? null : round(brier, 4) },
    ats: { games: atsRows.length, correct: atsHits, accuracy: atsRows.length ? round(atsHits / atsRows.length * 100, 1) : null },
    overUnder: { games: ouRows.length, correct: ouHits, accuracy: ouRows.length ? round(ouHits / ouRows.length * 100, 1) : null },
    marginMae: marginRows.length ? round(marginRows.reduce((sum, row) => sum + Math.abs(row.predictedMargin - row.actualMargin), 0) / marginRows.length, 2) : null,
    totalMae: totalRows.length ? round(totalRows.reduce((sum, row) => sum + Math.abs(row.predictedTotal - row.actualTotal), 0) / totalRows.length, 2) : null
  };
}

export function buildPredictionReport(allGames, upcomingGames = [], options = {}) {
  const games = [...allGames].filter(game => game.away_score != null && game.home_score != null).sort(gameOrder);
  const state = createState();
  const backtestRows = [];
  let previousSeason = null;
  let cursor = 0;
  while (cursor < games.length) {
    const gameDate = String(games[cursor].game_date).slice(0,10);
    const sameDay = [];
    while (cursor < games.length && String(games[cursor].game_date).slice(0,10) === gameDate) {
      sameDay.push(games[cursor]);
      cursor += 1;
    }
    const currentSeason = sameDay[0].season;
    if (previousSeason !== null && Number(currentSeason) !== Number(previousSeason)) regressForSeason(state, currentSeason);
    else if (previousSeason === null) regressForSeason(state, currentSeason);
    // Every game on the same calendar date is forecast before any result from
    // that date is added, preventing same-day result leakage when kickoff
    // times are missing or recorded inconsistently.
    const dayPredictions = sameDay.map(game => ({ game, prediction: predictGame(game, state) }));
    for (const { game, prediction } of dayPredictions) {
      const teamSample = Math.min(prediction.feature_snapshot.home_recent_games, prediction.feature_snapshot.away_recent_games);
      if (teamSample >= 2) {
        const actualWinner = Number(game.home_score) > Number(game.away_score) ? "home" : Number(game.home_score) < Number(game.away_score) ? "away" : "tie";
        const actualMargin = Number(game.home_score) - Number(game.away_score);
        const actualTotal = Number(game.home_score) + Number(game.away_score);
        backtestRows.push({
          gameDate: String(game.game_date).slice(0,10),
          competitionType: game.competition_type,
          sourceGameId: game.source_game_id,
          spreadPoints: game.spread_points == null ? null : Number(game.spread_points),
          overUnderLine: game.over_under_line == null ? null : Number(game.over_under_line),
          actualWinner,
          predictedWinner: prediction.predicted_home_win_probability >= 0.5 ? "home" : "away",
          homeWinProbability: prediction.predicted_home_win_probability,
          predictedHomeCover: prediction.predicted_home_cover_probability == null ? null : prediction.predicted_home_cover_probability >= 0.5,
          predictedOver: prediction.predicted_over_probability == null ? null : prediction.predicted_over_probability >= 0.5,
          atsResult: game.ats_result,
          ouResult: game.over_under_line == null ? null : actualTotal > Number(game.over_under_line) ? "over" : actualTotal < Number(game.over_under_line) ? "under" : "push",
          predictedMargin: prediction.predicted_home_margin,
          actualMargin,
          predictedTotal: prediction.predicted_total_points,
          actualTotal
        });
      }
    }
    for (const { game, prediction } of dayPredictions) updateState(game, prediction, state);
    previousSeason = currentSeason;
  }
  const predictions = [...upcomingGames].filter(game => game.away_score == null || game.home_score == null).sort(gameOrder)
    .map(game => predictGame(game, state, game.external_context || {}));
  const backtest = outcomeMetrics(backtestRows);
  const calibration = [
    { label: "50–59%", min: 0.5, max: 0.6 },
    { label: "60–69%", min: 0.6, max: 0.7 },
    { label: "70–79%", min: 0.7, max: 0.8 },
    { label: "80%+", min: 0.8, max: 1.01 }
  ].map(bucket => {
    const rows = backtestRows.filter(row => (row.actualWinner === "home" || row.actualWinner === "away") && Math.max(row.homeWinProbability, 1 - row.homeWinProbability) >= bucket.min && Math.max(row.homeWinProbability, 1 - row.homeWinProbability) < bucket.max);
    const hits = rows.filter(row => row.predictedWinner === row.actualWinner).length;
    return { label: bucket.label, games: rows.length, accuracy: rows.length ? round(hits / rows.length * 100, 1) : null };
  });
  return {
    modelVersion: MODEL_VERSION,
    methodology: "Historical backtest is chronological and uses only completed game history. Upcoming forecasts additionally use the latest available nflverse team/player stats and injury reports plus Open-Meteo stadium forecasts. Contextual adjustments are saved with each forecast but remain experimental and have not yet been validated in a historical out-of-sample backtest; the historical baseline has not yet been re-fit using those external snapshots.",
    backtest: { ...backtest, calibration },
    // Paired, chronological out-of-sample errors preserve the relationship between
    // scoring margin and total points for empirical Monte Carlo resampling.
    simulationValidation: options.includeSimulationValidation ? buildSimulationValidation(backtestRows) : null,
    simulationCalibration: backtestRows.filter(row => Number.isFinite(row.actualMargin) && Number.isFinite(row.predictedMargin) && Number.isFinite(row.actualTotal) && Number.isFinite(row.predictedTotal)).map(row => ({
      marginError: round(row.actualMargin - row.predictedMargin, 2),
      totalError: round(row.actualTotal - row.predictedTotal, 2)
    })),
    upcoming: predictions,
    trainedGames: games.length,
    trainedThrough: games.length ? String(games[games.length - 1].game_date).slice(0, 10) : null
  };
}
