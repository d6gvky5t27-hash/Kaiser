// Phase 9 — §102-104: Region Fairness. Runs a subset of agents across
// several representative START_REGIONS (not just the default "player")
// to check whether success rates vary meaningfully by starting region.
// Test infrastructure only.
const fs = require("fs");
const path = require("path");
const { loadSandboxSource } = require("./run-campaign.js");
const { summarizeCampaign } = require("./metrics.js");

function parseArgs(argv) { const out = {}; for (const a of argv) { const m = /^--([^=]+)=(.*)$/.exec(a); if (m) out[m[1]] = m[2]; } return out; }
const cliArgs = parseArgs(process.argv.slice(2));
const OUT_DIR = path.join(__dirname, "..", "output", cliArgs.outDir || "phase9");
fs.mkdirSync(OUT_DIR, { recursive: true });

const REGIONS = ["player", "burgund", "england", "venedig", "mailand"];
const AGENTS_SUBSET = ["verwalter", "kaufmann", "kriegsherr", "diplomat"];
const SEEDS = Array.from({ length: 15 }, (_, i) => 3000 + i * 7919);

const source = loadSandboxSource();
const driver = `
  const __out = [];
  for (const region of ${JSON.stringify(REGIONS)}) {
    for (const agentId of ${JSON.stringify(AGENTS_SUBSET)}) {
      for (const seed of ${JSON.stringify(SEEDS)}) {
        const r = runCampaign(AGENTS[agentId], { seed, years: 100, startRegion: region });
        __out.push(r);
      }
    }
  }
  globalThis.__REGION_RESULTS__ = __out;
`;
console.log(`Running region fairness test: ${REGIONS.length} regions x ${AGENTS_SUBSET.length} agents x ${SEEDS.length} seeds...`);
const t0 = Date.now();
eval(source + driver);
const results = globalThis.__REGION_RESULTS__;
console.log(`Done: ${results.length} campaigns in ${Date.now() - t0}ms`);

const byRegion = {};
for (const r of results) {
  const s = summarizeCampaign(r);
  (byRegion[r.startRegion] = byRegion[r.startRegion] || []).push(s);
}
function mean(arr) { return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null; }
const summary = {};
for (const region in byRegion) {
  const rows = byRegion[region];
  summary[region] = {
    n: rows.length,
    avgYearsSimulated: Math.round(mean(rows.map(r => r.yearsSimulated)) * 10) / 10,
    survivedFull100Share: Math.round((rows.filter(r => r.yearsSimulated >= 100).length / rows.length) * 1000) / 1000,
    bankruptShare: Math.round((rows.filter(r => r.gameOver === "bankrupt").length / rows.length) * 1000) / 1000,
    noHeirShare: Math.round((rows.filter(r => r.gameOver === "no_heir").length / rows.length) * 1000) / 1000,
    avgFinalTreasury: Math.round(mean(rows.filter(r => r.finalState).map(r => r.finalState.treasury))),
    avgFinalPopulation: Math.round(mean(rows.filter(r => r.finalState).map(r => r.finalState.totalPopulation))),
  };
}
console.log(JSON.stringify(summary, null, 2));
fs.writeFileSync(path.join(OUT_DIR, "region_fairness_test.json"), JSON.stringify({ regions: REGIONS, agents: AGENTS_SUBSET, seeds: SEEDS, summary }, null, 2));
console.log("Written: " + path.join(OUT_DIR, "region_fairness_test.json"));
