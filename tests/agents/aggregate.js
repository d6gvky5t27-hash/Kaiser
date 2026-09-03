// Phase 9 — cross-campaign aggregation over tests/output/phase9/campaign_summaries.json.
// Plain Node, no sandbox. Usage: node tests/agents/aggregate.js
"use strict";
const fs = require("fs");
const path = require("path");
const OUT_DIR = path.join(__dirname, "..", "output", "phase9");
const summaries = JSON.parse(fs.readFileSync(path.join(OUT_DIR, "campaign_summaries.json"), "utf8"));
const manifest = JSON.parse(fs.readFileSync(path.join(OUT_DIR, "manifest.json"), "utf8"));

function mean(arr) { return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null; }
function median(arr) { if (!arr.length) return null; const s = [...arr].sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; }
function round(x, d) { d = d || 2; return x === null || x === undefined ? null : Math.round(x * Math.pow(10, d)) / Math.pow(10, d); }

const byAgent = {};
for (const s of summaries) { (byAgent[s.agentId] = byAgent[s.agentId] || []).push(s); }

const agentAggregates = {};
for (const agentId in byAgent) {
  const rows = byAgent[agentId];
  const n = rows.length;
  const gameOverCounts = {};
  for (const r of rows) gameOverCounts[r.gameOver || "null(still_running_at_100y)"] = (gameOverCounts[r.gameOver || "null(still_running_at_100y)"] || 0) + 1;
  const engagementShare = {};
  for (const cat of ["ECONOMY", "TAX", "MILITARY", "WAR", "DIPLOMACY", "ADVISOR", "EVENT", "TRADE", "TITLE"]) {
    engagementShare[cat] = round(rows.filter(r => r.systemEngagement && r.systemEngagement[cat]).length / n, 3);
  }
  agentAggregates[agentId] = {
    campaigns: n,
    avgYearsSimulated: round(mean(rows.map(r => r.yearsSimulated)), 1),
    medianYearsSimulated: median(rows.map(r => r.yearsSimulated)),
    gameOverDistribution: gameOverCounts,
    survivedFull100Share: round(rows.filter(r => r.yearsSimulated >= 100).length / n, 3),
    becameKaiserShare: round(rows.filter(r => r.becameKaiser).length / n, 3),
    avgMeaningfulDecisions: round(mean(rows.map(r => r.meaningfulDecisions)), 1),
    avgMeaningfulPerDecade: round(mean(rows.map(r => r.avgMeaningfulPerDecade)), 2),
    avgRepetitionScore: round(mean(rows.map(r => r.repetitionScore)), 3),
    avgAutopilotIndex: round(mean(rows.map(r => r.autopilotIndex)), 3),
    avgLongestBoringStreak: round(mean(rows.map(r => r.longestBoringStreak)), 1),
    maxLongestBoringStreak: Math.max(...rows.map(r => r.longestBoringStreak)),
    systemEngagementShare: engagementShare,
    avgWarEpisodes: round(mean(rows.map(r => r.warEpisodeCount)), 2),
    avgWarDuration: round(mean(rows.filter(r => r.warEpisodeCount > 0).map(r => r.avgWarDuration)), 2),
    totalDeclaredWars: rows.reduce((s, r) => s + r.declaredWars, 0),
    totalAttacks: rows.reduce((s, r) => s + r.attacksTotal, 0),
    totalAttacksWon: rows.reduce((s, r) => s + r.attacksWon, 0),
    attackWinRate: round(rows.reduce((s, r) => s + r.attacksWon, 0) / Math.max(1, rows.reduce((s, r) => s + r.attacksTotal, 0)), 3),
    totalForcedDefenses: rows.reduce((s, r) => s + r.defendedForced, 0),
    avgBribes: round(mean(rows.map(r => r.bribes)), 2),
    totalElections: rows.reduce((s, r) => s + r.elections, 0),
    deathSpiralShare: round(rows.filter(r => r.deathSpiralDetected).length / n, 3),
    avgLongestStabilityStreak: round(mean(rows.map(r => r.longestStabilityStreak)), 1),
    comebackRate: round(mean(rows.filter(r => r.comebackRate !== null).map(r => r.comebackRate)), 3),
    avgFinalTreasury: round(mean(rows.filter(r => r.finalState).map(r => r.finalState.treasury)), 0),
    avgFinalPopulation: round(mean(rows.filter(r => r.finalState).map(r => r.finalState.totalPopulation)), 0),
    avgFinalTerritories: round(mean(rows.filter(r => r.finalState).map(r => r.finalState.territoriesOwned)), 2),
    avgFinalTitleIndex: round(mean(rows.filter(r => r.finalState).map(r => r.finalState.titleIndex)), 2),
    avgFinalGenerations: round(mean(rows.filter(r => r.finalState).map(r => r.finalState.generations)), 2),
  };
}

// ---- Snowball correlation (§57-59): year-20 territories+treasury+population vs final-year outcome, per agent that reaches year 20+. ----
function pearson(xs, ys) {
  const n = xs.length; if (n < 3) return null;
  const mx = mean(xs), my = mean(ys);
  let num = 0, dx2 = 0, dy2 = 0;
  for (let i = 0; i < n; i++) { const dx = xs[i] - mx, dy = ys[i] - my; num += dx * dy; dx2 += dx * dx; dy2 += dy * dy; }
  if (dx2 === 0 || dy2 === 0) return null;
  return round(num / Math.sqrt(dx2 * dy2), 3);
}
const snowball = {};
for (const agentId in byAgent) {
  const rows = byAgent[agentId].filter(r => r.year20Snapshot && r.finalSnapshot);
  if (rows.length < 5) { snowball[agentId] = null; continue; }
  snowball[agentId] = {
    n: rows.length,
    corrTreasury: pearson(rows.map(r => r.year20Snapshot.treasury), rows.map(r => r.finalSnapshot.treasury)),
    corrPopulation: pearson(rows.map(r => r.year20Snapshot.totalPopulation), rows.map(r => r.finalSnapshot.totalPopulation)),
    corrTerritories: pearson(rows.map(r => r.year20Snapshot.territoriesOwned), rows.map(r => r.finalSnapshot.territoriesOwned)),
  };
}

// ---- Region fairness (§102-104): only meaningful if multiple startRegions were used; the main matrix uses a single startRegion (see manifest), so this stays a placeholder unless run-region-test.js output exists. ----
let regionFairness = null;
const regionTestPath = path.join(OUT_DIR, "region_fairness_test.json");
if (fs.existsSync(regionTestPath)) regionFairness = JSON.parse(fs.readFileSync(regionTestPath, "utf8")).summary;

const out = { manifest, agentAggregates, snowball, regionFairness };
fs.writeFileSync(path.join(OUT_DIR, "aggregate_metrics.json"), JSON.stringify(out, null, 2));
console.log(JSON.stringify(agentAggregates, null, 2));
console.log("--- snowball correlations (year20 vs final) ---");
console.log(JSON.stringify(snowball, null, 2));
console.log("Written: " + path.join(OUT_DIR, "aggregate_metrics.json"));
