// Phase 9 — single-campaign CLI runner (prototyping/debugging tool).
// Usage: node tests/agents/run-campaign.js --agent=verwalter --seed=101 --years=100 [--startRegion=player] [--verbose]
//
// Test infrastructure only — never referenced by tools/build-bundle.js.
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..", "..");

// Exact source file order used by tools/build-bundle.js (minus ui-viewmodels.js,
// which is render-only and not needed by headless agents).
const SIM_FILES = [
  "data/gamedata.js",
  "js/map-geometry.js",
  "js/core.js",
  "js/economy.js",
  "js/population-dynasty.js",
  "js/memory.js",
  "js/characters.js",
  "js/estates.js",
  "js/story-threads.js",
  "js/drama-director.js",
  "js/event-chains.js",
  "js/chronicle.js",
  "js/politics.js",
  "js/diplomacy.js",
  "js/military.js",
  "js/debug.js",
  "js/war-map.js",
  "js/advance-year.js",
  "battle-engine/battle-data.js",
  "battle-engine/battle-engine.js",
  "battle-engine/battle-state-machine.js",
  "js/battle-bridge.js",
];
const AGENT_FILES = ["engine.js", "shared-behaviors.js", "archetypes.js"];

function loadSandboxSource() {
  const sim = SIM_FILES.map(f => fs.readFileSync(path.join(ROOT, f), "utf8")).join("\n");
  const agentCode = AGENT_FILES.map(f => fs.readFileSync(path.join(__dirname, f), "utf8")).join("\n");
  return sim + "\n" + agentCode + "\n";
}

function parseArgs(argv) {
  const out = {};
  for (const a of argv) {
    const m = /^--([^=]+)=(.*)$/.exec(a);
    if (m) out[m[1]] = m[2];
    else if (/^--([^=]+)$/.test(a)) out[a.slice(2)] = true;
  }
  return out;
}

if (require.main === module) {
  const args = parseArgs(process.argv.slice(2));
  const agentId = args.agent || "verwalter";
  const seed = args.seed !== undefined ? Number(args.seed) : 101;
  const years = args.years !== undefined ? Number(args.years) : 100;
  const startRegion = args.startRegion || "player";

  const source = loadSandboxSource();
  const driver = `
    const __agent = AGENTS[${JSON.stringify(agentId)}];
    if (!__agent) throw new Error("Unknown agent: " + ${JSON.stringify(agentId)});
    globalThis.__RESULT__ = runCampaign(__agent, { seed: ${seed}, years: ${years}, startRegion: ${JSON.stringify(startRegion)} });
  `;
  const t0 = Date.now();
  eval(source + driver);
  const result = globalThis.__RESULT__;
  const ms = Date.now() - t0;

  if (result.crashed) {
    console.error("CAMPAIGN CRASHED:", result.crashed.message);
    console.error(result.crashed.stack);
    process.exitCode = 1;
  } else {
    console.log(`Agent ${agentId} | seed ${seed} | ${result.yearsSimulated}/${years} years simulated in ${ms}ms`);
    console.log("Final state:", JSON.stringify(result.finalState, null, 2));
    console.log(`Decisions logged: ${result.decisionLog.length}`);
    if (args.verbose) {
      console.log("--- First 30 decisions ---");
      result.decisionLog.slice(0, 30).forEach(d => console.log(`${d.year}-${d.month} [${d.category}] ${d.action} ok=${d.ok} meaningful=${d.meaningful} :: ${d.reason}`));
      console.log("--- Last 10 year snapshots ---");
      result.yearSnapshots.slice(-10).forEach(s => console.log(JSON.stringify(s)));
    }
  }

  if (args.out) {
    fs.writeFileSync(args.out, JSON.stringify(result, null, args.pretty ? 2 : 0));
    console.log("Written to " + args.out);
  }
}

module.exports = { loadSandboxSource, SIM_FILES, AGENT_FILES };
