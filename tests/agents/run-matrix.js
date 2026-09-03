// Phase 9 — full campaign matrix runner.
// Usage: node tests/agents/run-matrix.js [--seeds=30] [--years=100] [--startRegion=player]
//
// Runs AGENT_LIST x SEEDS x years fully inside ONE eval() sandbox (to avoid
// re-parsing ~600KB of game source per campaign), then computes compact
// per-campaign summaries (tests/agents/metrics.js, plain Node, no sandbox)
// and writes them + a curated subset of full decision logs to
// tests/output/phase9/. Test infrastructure only — never referenced by
// tools/build-bundle.js.
const fs = require("fs");
const path = require("path");
const { loadSandboxSource } = require("./run-campaign.js");
const { summarizeCampaign } = require("./metrics.js");

const ROOT = path.join(__dirname, "..", "..");
const OUT_DIR = path.join(ROOT, "tests", "output", "phase9");
const LOGS_DIR = path.join(OUT_DIR, "decision_logs");

function parseArgs(argv) {
  const out = {};
  for (const a of argv) { const m = /^--([^=]+)=(.*)$/.exec(a); if (m) out[m[1]] = m[2]; }
  return out;
}
const args = parseArgs(process.argv.slice(2));
const N_SEEDS = args.seeds !== undefined ? Number(args.seeds) : 30;
const YEARS = args.years !== undefined ? Number(args.years) : 100;
const START_REGION = args.startRegion || "player";
const N_CURATED_SEEDS = 3; // first N seeds get their full decision log saved, for every agent

const SEEDS = Array.from({ length: N_SEEDS }, (_, i) => 1000 + i * 7919);

fs.mkdirSync(LOGS_DIR, { recursive: true });

const source = loadSandboxSource();
const driver = `
  const __out = [];
  const __agentIds = AGENT_LIST;
  const __seeds = ${JSON.stringify(SEEDS)};
  for (const seed of __seeds) {
    for (const agentId of __agentIds) {
      const r = runCampaign(AGENTS[agentId], { seed, years: ${YEARS}, startRegion: ${JSON.stringify(START_REGION)} });
      __out.push(r);
    }
  }
  globalThis.__MATRIX_RESULTS__ = __out;
`;

console.log(`Running matrix: ${N_SEEDS} seeds x agents, ${YEARS} years each...`);
const t0 = Date.now();
eval(source + driver);
const results = globalThis.__MATRIX_RESULTS__;
const wallMs = Date.now() - t0;
console.log(`Matrix simulation done: ${results.length} campaigns in ${wallMs}ms (${Math.round(wallMs / results.length)}ms/campaign avg).`);

const summaries = [];
let crashCount = 0;
const crashes = [];
for (const r of results) {
  const s = summarizeCampaign(r);
  summaries.push(s);
  if (r.crashed) { crashCount++; crashes.push({ agentId: r.agentId, seed: r.seed, error: r.crashed }); }
  const seedIdx = SEEDS.indexOf(r.seed);
  if (seedIdx !== -1 && seedIdx < N_CURATED_SEEDS) {
    const fname = `${r.agentId}_seed${r.seed}.json`;
    fs.writeFileSync(path.join(LOGS_DIR, fname), JSON.stringify({
      agentId: r.agentId, seed: r.seed, policyVersion: r.policyVersion, startRegion: r.startRegion,
      yearsRequested: r.yearsRequested, yearsSimulated: r.yearsSimulated, crashed: r.crashed,
      finalState: r.finalState, decisionLog: r.decisionLog, yearSnapshots: r.yearSnapshots,
    }));
  }
}

fs.writeFileSync(path.join(OUT_DIR, "campaign_summaries.json"), JSON.stringify(summaries, null, 0));
fs.writeFileSync(path.join(OUT_DIR, "manifest.json"), JSON.stringify({
  generatedAt: new Date().toISOString(),
  agentPolicyVersion: results.length ? results[0].policyVersion : null,
  agentList: [...new Set(results.map(r => r.agentId))],
  seeds: SEEDS,
  curatedSeeds: SEEDS.slice(0, N_CURATED_SEEDS),
  years: YEARS,
  startRegion: START_REGION,
  totalCampaigns: results.length,
  crashCount,
  crashes,
  wallMs,
}, null, 2));

console.log(`Crashes: ${crashCount}/${results.length}`);
if (crashCount) console.log(JSON.stringify(crashes, null, 2));
console.log(`Written: ${path.join(OUT_DIR, "campaign_summaries.json")}`);
console.log(`Written: ${path.join(OUT_DIR, "manifest.json")}`);
console.log(`Curated full logs (${N_CURATED_SEEDS} seeds x all agents) in ${LOGS_DIR}`);
