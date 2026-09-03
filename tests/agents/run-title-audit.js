// Phase 10A — Title Progression Audit. Re-runs the UNCHANGED Phase 9
// agents across the SAME 30 seeds against the CURRENT (possibly since-
// modified by later 10x iterations) production code, capturing a
// per-year (titleIndex, totalPopulation, treasury, prestige) trace per
// campaign — needed to build the title funnel and time-to-title stats,
// and to find which of the three requirements (pop/wealth/prestige) is
// the actual binding constraint. Test infrastructure only.
//
// Usage: node tests/agents/run-title-audit.js [--seeds=30] [--years=100] [--label=baseline]
const fs = require("fs");
const path = require("path");
const { loadSandboxSource } = require("./run-campaign.js");

const OUT_DIR = path.join(__dirname, "..", "output", "phase10");
fs.mkdirSync(OUT_DIR, { recursive: true });

function parseArgs(argv) { const out = {}; for (const a of argv) { const m = /^--([^=]+)=(.*)$/.exec(a); if (m) out[m[1]] = m[2]; } return out; }
const args = parseArgs(process.argv.slice(2));
const N_SEEDS = args.seeds !== undefined ? Number(args.seeds) : 30;
const YEARS = args.years !== undefined ? Number(args.years) : 100;
const LABEL = args.label || "baseline";
const SEEDS = Array.from({ length: N_SEEDS }, (_, i) => 1000 + i * 7919);

const source = loadSandboxSource();
const driver = `
  const __out = [];
  const __agentIds = AGENT_LIST;
  const __seeds = ${JSON.stringify(SEEDS)};
  for (const seed of __seeds) {
    for (const agentId of __agentIds) {
      const agent = AGENTS[agentId];
      const state = newGame({ seed, years: ${YEARS} });
      const ctx = { agentId: agent.id, seed, state, rng: makeAgentRng(agent.id + ":" + seed + ":" + AGENT_POLICY_VERSION), decisionLog: [], memory: {} };
      if (agent.init) agent.init(ctx);
      const trace = [];
      let crashed = null;
      try {
        for (let y = 0; y < ${YEARS}; y++) {
          for (let m = 0; m < 12; m++) {
            if (state.gameOver) break;
            if (agent.decideMonth) agent.decideMonth(ctx);
            advanceMonth(state);
            resolvePendingQueue(ctx, agent);
            if (state.gameOver) break;
          }
          const totalPop = Object.values(state.regions.player.population).reduce((s, g) => s + g.count, 0);
          trace.push({ year: state.year, titleIndex: state.titleIndex, totalPopulation: Math.round(totalPop), treasury: Math.round(state.treasury), prestige: Math.round(state.prestige * 10) / 10, legitimacy: Math.round(state.legitimacy) });
          if (state.gameOver) break;
        }
      } catch (e) { crashed = e.message; }
      __out.push({ agentId, seed, crashed, gameOver: state.gameOver, finalYear: state.year, trace });
    }
  }
  globalThis.__TITLE_AUDIT__ = __out;
  globalThis.__TITLES_SNAPSHOT__ = TITLES.map(t => ({ id: t.id, reqPop: t.reqPop, reqWealth: t.reqWealth, reqPrestige: t.reqPrestige }));
`;

console.log(`Title audit [${LABEL}]: ${N_SEEDS} seeds x agents, ${YEARS} years each...`);
const t0 = Date.now();
eval(source + driver);
const results = globalThis.__TITLE_AUDIT__;
console.log(`Done: ${results.length} campaigns in ${Date.now() - t0}ms`);
const crashes = results.filter(r => r.crashed);
console.log(`Crashes: ${crashes.length}`);
if (crashes.length) console.log(JSON.stringify(crashes.map(c => ({ agentId: c.agentId, seed: c.seed, err: c.crashed })), null, 2));

const TITLE_NAMES = ["freiherr", "baron", "graf", "landgraf", "markgraf", "fuerst", "herzog", "kurfuerst", "koenig", "kaiser"];

// ---- Funnel: % of campaigns reaching each title index (max titleIndex ever seen) ----
const maxTitleByRun = results.map(r => r.trace.length ? Math.max(...r.trace.map(t => t.titleIndex)) : 0);
const funnel = TITLE_NAMES.map((name, idx) => ({
  title: name, titleIndex: idx,
  reachedShare: Math.round((maxTitleByRun.filter(m => m >= idx).length / results.length) * 1000) / 1000,
}));

// ---- Time-to-title: first year each titleIndex was reached, aggregated ----
const yearsByTitle = TITLE_NAMES.map(() => []);
for (const r of results) {
  let seen = -1;
  for (const t of r.trace) {
    if (t.titleIndex > seen) {
      for (let idx = seen + 1; idx <= t.titleIndex; idx++) yearsByTitle[idx].push(t.year - 1500);
      seen = t.titleIndex;
    }
  }
}
function pct(arr, p) { if (!arr.length) return null; const s = [...arr].sort((a, b) => a - b); const idx = Math.min(s.length - 1, Math.floor(p * s.length)); return s[idx]; }
const timeToTitle = TITLE_NAMES.map((name, idx) => {
  const arr = yearsByTitle[idx];
  return { title: name, n: arr.length, median: pct(arr, 0.5), p25: pct(arr, 0.25), p75: pct(arr, 0.75), min: arr.length ? Math.min(...arr) : null, max: arr.length ? Math.max(...arr) : null };
});

// ---- Per-agent funnel (which archetypes get further) ----
const byAgent = {};
for (const r of results) { (byAgent[r.agentId] = byAgent[r.agentId] || []).push(r); }
const perAgentFunnel = {};
for (const agentId in byAgent) {
  const rows = byAgent[agentId];
  const maxT = rows.map(r => r.trace.length ? Math.max(...r.trace.map(t => t.titleIndex)) : 0);
  perAgentFunnel[agentId] = TITLE_NAMES.map((name, idx) => Math.round((maxT.filter(m => m >= idx).length / rows.length) * 1000) / 1000);
}

// ---- Binding-constraint analysis: for campaigns that stalled below Kaiser,
// at the FINAL simulated year, which of pop/wealth/prestige is furthest
// (proportionally) below the NEXT title's requirement? ----
const bindingCounts = { pop: 0, wealth: 0, prestige: 0 };
// Pulled live from the sandbox's actual TITLES const (never hardcoded) so
// this stays correct across 10A.1/10A.2/... balance iterations.
const TITLE_REQS = globalThis.__TITLES_SNAPSHOT__;
for (const r of results) {
  if (!r.trace.length) continue;
  const last = r.trace[r.trace.length - 1];
  const nextIdx = last.titleIndex + 1;
  if (nextIdx >= TITLE_REQS.length) continue;
  const req = TITLE_REQS[nextIdx];
  const popShare = req.reqPop > 0 ? last.totalPopulation / req.reqPop : 1;
  const wealthShare = req.reqWealth > 0 ? last.treasury / req.reqWealth : 1;
  const prestigeShare = req.reqPrestige > 0 ? last.prestige / req.reqPrestige : 1;
  const min = Math.min(popShare, wealthShare, prestigeShare);
  if (min === popShare) bindingCounts.pop++;
  else if (min === wealthShare) bindingCounts.wealth++;
  else bindingCounts.prestige++;
}

// ---- Average "shortfall share" at campaign end, per requirement, for next-title ----
let popShares = [], wealthShares = [], prestigeShares = [];
for (const r of results) {
  if (!r.trace.length) continue;
  const last = r.trace[r.trace.length - 1];
  const nextIdx = last.titleIndex + 1;
  if (nextIdx >= TITLE_REQS.length) continue;
  const req = TITLE_REQS[nextIdx];
  if (req.reqPop > 0) popShares.push(last.totalPopulation / req.reqPop);
  if (req.reqWealth > 0) wealthShares.push(last.treasury / req.reqWealth);
  if (req.reqPrestige > 0) prestigeShares.push(last.prestige / req.reqPrestige);
}
function mean(a) { return a.length ? a.reduce((x, y) => x + y, 0) / a.length : null; }

const report = {
  label: LABEL, seeds: SEEDS, years: YEARS, totalCampaigns: results.length, crashCount: crashes.length,
  funnel, timeToTitle, perAgentFunnel, bindingConstraintCounts: bindingCounts,
  avgShortfallShareVsNextTitle: {
    population: Math.round(mean(popShares) * 1000) / 1000,
    wealth: Math.round(mean(wealthShares) * 1000) / 1000,
    prestige: Math.round(mean(prestigeShares) * 1000) / 1000,
  },
};
console.log(JSON.stringify(report, null, 2));
fs.writeFileSync(path.join(OUT_DIR, `title_audit_${LABEL}.json`), JSON.stringify({ ...report, results }, null, 0));
console.log("Written: " + path.join(OUT_DIR, `title_audit_${LABEL}.json`));
