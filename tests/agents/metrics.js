// Phase 9 — pure metric computation over a serialized campaign result
// ({decisionLog, yearSnapshots, finalState, ...} as produced by
// engine.js#runCampaign). Deliberately independent of the game sandbox
// (plain Node module, no eval) so it can also be re-run standalone over
// saved JSON output. All heuristics here are explicitly documented —
// per the master prompt (§128 "nicht als perfektes wissenschaftliches Maß
// verkaufen"), these are transparent analysis tools, not certified science.
"use strict";

const MEANINGFUL_CATEGORIES = ["ECONOMY", "TAX", "MILITARY", "WAR", "DIPLOMACY", "ADVISOR", "EVENT", "TRADE", "TITLE"];

function decade(year) { return Math.floor((year - 1500) / 10); }

function summarizeCampaign(result) {
  const log = result.decisionLog || [];
  const years = result.yearSnapshots || [];
  const meaningful = log.filter(d => d.ok && d.meaningful);

  // ---- Meaningful decisions per decade (§29-31) ----
  const decadeBuckets = {};
  for (const d of meaningful) {
    const dk = decade(d.year);
    decadeBuckets[dk] = (decadeBuckets[dk] || 0) + 1;
  }
  const decadeCounts = Object.keys(decadeBuckets).map(Number).sort((a, b) => a - b).map(dk => ({ decade: dk, count: decadeBuckets[dk] }));
  const avgMeaningfulPerDecade = decadeCounts.length ? decadeCounts.reduce((s, x) => s + x.count, 0) / decadeCounts.length : 0;

  // ---- Repetition score (§31): share of all meaningful decisions taken up
  // by the single most-repeated (category,action) pair. High = the agent
  // spends most of its "decisions" repeating one routine action. ----
  const pairCounts = {};
  for (const d of meaningful) {
    const key = d.category + ":" + d.action;
    pairCounts[key] = (pairCounts[key] || 0) + 1;
  }
  const pairEntries = Object.entries(pairCounts).sort((a, b) => b[1] - a[1]);
  const topPair = pairEntries[0] || ["-", 0];
  const repetitionScore = meaningful.length ? topPair[1] / meaningful.length : 0;

  // ---- Per-year meaningful-decision counts, boring streaks, autopilot index (§32-34) ----
  const meaningfulByYear = {};
  for (const d of meaningful) meaningfulByYear[d.year] = (meaningfulByYear[d.year] || 0) + 1;
  const simulatedYears = years.map(y => y.year);
  let boringStreak = 0, longestBoringStreak = 0, boringYears = 0;
  for (const y of simulatedYears) {
    if (!meaningfulByYear[y]) { boringStreak++; boringYears++; longestBoringStreak = Math.max(longestBoringStreak, boringStreak); }
    else boringStreak = 0;
  }
  const yearsWithoutMeaningfulShare = simulatedYears.length ? boringYears / simulatedYears.length : 0;

  // Identical-action-sequence years: consecutive years whose SET of
  // (category,action) meaningful decisions is exactly identical.
  const yearActionSets = {};
  for (const d of meaningful) {
    const y = d.year;
    if (!yearActionSets[y]) yearActionSets[y] = new Set();
    yearActionSets[y].add(d.category + ":" + d.action);
  }
  let identicalSeqYears = 0;
  for (let i = 1; i < simulatedYears.length; i++) {
    const a = yearActionSets[simulatedYears[i - 1]], b = yearActionSets[simulatedYears[i]];
    if (!a || !b) continue;
    if (a.size === b.size && [...a].every(x => b.has(x))) identicalSeqYears++;
  }
  const identicalSeqShare = simulatedYears.length > 1 ? identicalSeqYears / (simulatedYears.length - 1) : 0;
  // Analysis-only composite (NOT a gameplay value, §32).
  const autopilotIndex = Math.round(((yearsWithoutMeaningfulShare + identicalSeqShare) / 2) * 1000) / 1000;

  // ---- System engagement (§35-37) ----
  const touchedCategories = {};
  for (const d of log) if (d.ok) touchedCategories[d.category] = (touchedCategories[d.category] || 0) + 1;
  const systemEngagement = {};
  for (const c of MEANINGFUL_CATEGORIES) systemEngagement[c] = !!touchedCategories[c];

  // ---- War stats (§61-64), derived from yearSnapshots.atWarCount transitions
  // (documented simplification: overlapping multi-front wars are treated as
  // one "at war" episode, not tracked individually — see report §War Findings). ----
  let warEpisodes = [];
  let curStart = null;
  for (const y of years) {
    if (y.atWarCount > 0 && curStart === null) curStart = y.year;
    if (y.atWarCount === 0 && curStart !== null) { warEpisodes.push({ start: curStart, end: y.year, years: y.year - curStart }); curStart = null; }
  }
  if (curStart !== null && years.length) warEpisodes.push({ start: curStart, end: years[years.length - 1].year, years: years[years.length - 1].year - curStart + 1 });
  const attacks = log.filter(d => d.action === "attack_territory" && d.ok);
  const attacksWon = attacks.filter(d => d.params && d.params.won).length;
  const declaredWars = log.filter(d => d.action === "declare_war" && d.ok).length;
  const defendedForced = log.filter(d => (d.action === "defend_surprise_attack" || d.action === "defend_territory") && d.ok).length;

  // ---- Kaiserwahl (§69-70) ----
  const bribes = log.filter(d => d.action === "bribe_elector" && d.ok).length;
  const elections = log.filter(d => d.action === "resolve_election" && d.ok).length;
  const becameKaiser = result.finalState && result.finalState.gameOver === "victory";

  // ---- Perfect stability streak (§99-100): composite "no visible crisis" definition. ----
  let stabilityStreak = 0, longestStabilityStreak = 0;
  for (const y of years) {
    const stable = y.treasury > 100 && (y.grainRatio === null || y.grainRatio >= 0.9) && y.avgSatisfaction >= 45 && y.legitimacy >= 45 && y.atWarCount === 0;
    if (stable) { stabilityStreak++; longestStabilityStreak = Math.max(longestStabilityStreak, stabilityStreak); }
    else stabilityStreak = 0;
  }

  // ---- Death-spiral heuristic (§56): >=5 consecutive years of population
  // decline while satisfaction stays low. ----
  let declineStreak = 0, deathSpiralDetected = false, deathSpiralYear = null;
  for (let i = 1; i < years.length; i++) {
    const declining = years[i].totalPopulation < years[i - 1].totalPopulation && years[i].avgSatisfaction < 25;
    if (declining) { declineStreak++; if (declineStreak >= 5 && !deathSpiralDetected) { deathSpiralDetected = true; deathSpiralYear = years[i].year; } }
    else declineStreak = 0;
  }

  // ---- Comeback rate (§60): recovery within 10 years of a "severe crisis" tick. ----
  let crises = 0, comebacks = 0;
  for (let i = 0; i < years.length; i++) {
    const y = years[i];
    const severe = y.treasury < 0 || (y.grainRatio !== null && y.grainRatio < 0.3);
    if (!severe) continue;
    crises++;
    for (let j = i + 1; j < Math.min(years.length, i + 11); j++) {
      if (years[j].treasury > 100 && (years[j].grainRatio === null || years[j].grainRatio >= 0.7)) { comebacks++; break; }
    }
  }

  // ---- Snowball inputs (cross-campaign correlation computed in aggregate.js) ----
  const year20 = years.find(y => y.year - 1500 >= 19) || years[Math.min(19, years.length - 1)] || null;
  const yearFinal = years[years.length - 1] || null;

  return {
    agentId: result.agentId, seed: result.seed, startRegion: result.startRegion,
    yearsSimulated: result.yearsSimulated, gameOver: result.finalState ? result.finalState.gameOver : "crashed",
    crashed: !!result.crashed,
    totalDecisions: log.length, meaningfulDecisions: meaningful.length,
    avgMeaningfulPerDecade: Math.round(avgMeaningfulPerDecade * 100) / 100,
    decadeCounts,
    repetitionScore: Math.round(repetitionScore * 1000) / 1000, topRepeatedAction: topPair[0],
    autopilotIndex, yearsWithoutMeaningfulShare: Math.round(yearsWithoutMeaningfulShare * 1000) / 1000,
    identicalSeqShare: Math.round(identicalSeqShare * 1000) / 1000,
    longestBoringStreak, systemEngagement,
    warEpisodes, warEpisodeCount: warEpisodes.length,
    avgWarDuration: warEpisodes.length ? Math.round((warEpisodes.reduce((s, w) => s + w.years, 0) / warEpisodes.length) * 10) / 10 : 0,
    declaredWars, attacksTotal: attacks.length, attacksWon, defendedForced,
    bribes, elections, becameKaiser,
    longestStabilityStreak,
    deathSpiralDetected, deathSpiralYear,
    crises, comebacks, comebackRate: crises ? Math.round((comebacks / crises) * 1000) / 1000 : null,
    year20Snapshot: year20, finalSnapshot: yearFinal,
    finalState: result.finalState,
  };
}

module.exports = { summarizeCampaign, decade, MEANINGFUL_CATEGORIES };
