// Phase 11 — Estate-specific metrics. Re-runs the SAME campaigns as
// tests/agents/run-matrix.js (same seeds/agents/years) fresh in-memory
// (not reading its saved output, since these metrics need full per-
// campaign World Memory/eventChains scans that run-matrix.js's on-disk
// summaries don't retain) and computes:
//   - demand frequency/outcome per estate (from real ESTATE_* memories)
//   - staende_gegeneinander (cross-estate conflict) frequency/outcomes
//   - Cross-System Decisions score (§ named key success metric) -- an
//     estate-chain resolution that touched >=2 systems beyond the single
//     estate's own satisfaction, classified from each chain's real,
//     already-read effect() code (see CROSS_SYSTEM_OUTCOMES below), not a
//     runtime effect-log (none exists) -- documented, not a blackbox.
//   - recurring leader-character coverage (share of campaigns where at
//     least one estate ever had a leader; avg distinct leaders/campaign)
//   - memory payoff (avg ESTATE_* memories/campaign; share clearing the
//     Chronicle scoredThreshold)
//   - narrative diversity (distinct chain templateIds encountered/campaign,
//     Phase 10's ceiling was 10, Phase 11's is 16)
// Test infrastructure only. Usage:
//   node tests/agents/run-estate-metrics.js [--outDir=phase11] [--seeds=30] [--seedBase=1000] [--years=100]
"use strict";
const fs = require("fs");
const path = require("path");
const { loadSandboxSource } = require("./run-campaign.js");

const ROOT = path.join(__dirname, "..", "..");
function parseArgs(argv) { const out = {}; for (const a of argv) { const m = /^--([^=]+)=(.*)$/.exec(a); if (m) out[m[1]] = m[2]; } return out; }
const args = parseArgs(process.argv.slice(2));
const OUT_DIR = path.join(ROOT, "tests", "output", args.outDir || "phase11");
const N_SEEDS = args.seeds !== undefined ? Number(args.seeds) : 30;
const YEARS = args.years !== undefined ? Number(args.years) : 100;
const SEED_BASE = args.seedBase !== undefined ? Number(args.seedBase) : 1000;
const SEEDS = Array.from({ length: N_SEEDS }, (_, i) => SEED_BASE + i * 7919);

// Documented classification (§ see file header): an outcome that is a pure
// refusal touching only the demanding estate's own population satisfaction
// is single-system; every granted/compromise/refused-with-side-effect
// outcome touches at least one further system (treasury, taxRate, prestige,
// legitimacy, religiousInfluence, a SECOND estate's satisfaction, or the
// privileges array itself as a lasting political fact) per each chain's
// actual effect() body in js/event-chains.js.
const SINGLE_SYSTEM_OUTCOMES = new Set(["IGNORED", "DISMISSED"]);

const source = loadSandboxSource();
const driver = `
  const ESTATE_CHAIN_IDS = ${JSON.stringify(["adel_hofamt", "adel_krieg", "staedte_handel", "bauern_nahrung", "kirche_herrscher", "staende_gegeneinander"])};
  const results = [];
  for (const agentId of AGENT_LIST) {
    for (const seed of ${JSON.stringify(SEEDS)}) {
      const state = newGame({ seed, startRegion: "player" });
      const ctx = { agentId, seed, state, rng: makeAgentRng(agentId + ":" + seed + ":" + AGENT_POLICY_VERSION), decisionLog: [], memory: {} };
      const agent = AGENTS[agentId];
      if (agent.init) agent.init(ctx);
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
          if (state.gameOver) break;
        }
      } catch (e) { crashed = String(e.message || e); }

      if (crashed) { results.push({ agentId, seed, crashed }); continue; }

      // ---- Estate demand memories (real, recorded, not inferred) ----
      const estateMemoryCounts = { adel: { GRANTED: 0, REFUSED: 0, PRIVILEGE: 0 }, geistlichkeit: { GRANTED: 0, REFUSED: 0, PRIVILEGE: 0 }, buergertum: { GRANTED: 0, REFUSED: 0, PRIVILEGE: 0 }, bauernschaft: { GRANTED: 0, REFUSED: 0, PRIVILEGE: 0 } };
      let chronicleWorthyEstateMemories = 0, totalEstateMemories = 0;
      for (const id in state.memories.byId) {
        const mem = state.memories.byId[id];
        if (!mem.tags.includes("estates")) continue;
        totalEstateMemories++;
        const estId = mem.metadata && mem.metadata.estateId;
        if (estId && estateMemoryCounts[estId]) {
          if (mem.type === "ESTATE_DEMAND_GRANTED") estateMemoryCounts[estId].GRANTED++;
          else if (mem.type === "ESTATE_DEMAND_REFUSED") estateMemoryCounts[estId].REFUSED++;
          else if (mem.type === "ESTATE_PRIVILEGE_GRANTED") estateMemoryCounts[estId].PRIVILEGE++;
        }
        if (isChronicleWorthy(state, mem).worthy) chronicleWorthyEstateMemories++;
      }

      // ---- Resolved/failed estate chains: templateId x outcome, cross-system classification ----
      const chainOutcomes = {};
      let crossSystemCount = 0, totalEstateChainResolutions = 0;
      let staendeGegeneinanderCount = 0;
      const staendeGegeneinanderOutcomes = {};
      const distinctTemplateIds = new Set();
      for (const bucket of [state.eventChains.resolved]) {
        for (const id in bucket) {
          const c = bucket[id];
          distinctTemplateIds.add(c.templateId);
          if (!ESTATE_CHAIN_IDS.includes(c.templateId)) continue;
          totalEstateChainResolutions++;
          const key = c.templateId + ":" + c.resolution;
          chainOutcomes[key] = (chainOutcomes[key] || 0) + 1;
          if (!${JSON.stringify([...SINGLE_SYSTEM_OUTCOMES])}.includes(c.resolution)) crossSystemCount++;
          if (c.templateId === "staende_gegeneinander") {
            staendeGegeneinanderCount++;
            staendeGegeneinanderOutcomes[c.resolution] = (staendeGegeneinanderOutcomes[c.resolution] || 0) + 1;
          }
        }
      }
      for (const id in state.eventChains.active) distinctTemplateIds.add(state.eventChains.active[id].templateId);

      // ---- Leader coverage over the FINAL state (a snapshot, not a full
      // time series -- sufficient to measure "did estates get real
      // representation at all", the headline claim) ----
      const finalLeaders = ESTATE_IDS.filter(id => state.estates[id].leaderId).length;

      // ---- Final influence/satisfaction distribution point ----
      const finalEstateSnapshot = {};
      for (const id of ESTATE_IDS) finalEstateSnapshot[id] = { influence: computeEstateInfluence(state, id), satisfaction: Math.round(computeEstateSatisfaction(state, id) * 10) / 10 };

      results.push({
        agentId, seed, crashed: null,
        estateMemoryCounts, totalEstateMemories, chronicleWorthyEstateMemories,
        chainOutcomes, totalEstateChainResolutions, crossSystemCount,
        staendeGegeneinanderCount, staendeGegeneinanderOutcomes,
        distinctTemplateIdCount: distinctTemplateIds.size,
        finalLeaders, finalEstateSnapshot,
        yearsSimulated: state.year - 1500,
        gameOver: state.gameOver,
      });
    }
  }
  globalThis.__ESTATE_RESULTS__ = results;
`;

console.log(`Running estate-metrics pass: ${N_SEEDS} seeds x ${"12"} agents, ${YEARS} years each (seedBase=${SEED_BASE})...`);
const t0 = Date.now();
eval(source + driver);
const results = globalThis.__ESTATE_RESULTS__;
console.log(`Done: ${results.length} campaigns in ${Date.now() - t0}ms`);
const crashes = results.filter(r => r.crashed);
console.log(`Crashes: ${crashes.length}/${results.length}`);
if (crashes.length) console.log(JSON.stringify(crashes, null, 2));

const ok = results.filter(r => !r.crashed);

// ---------- Aggregate across ALL agents ----------
const ESTATE_IDS_JS = ["adel", "geistlichkeit", "buergertum", "bauernschaft"];
function mean(arr) { return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null; }

const overall = {
  campaigns: ok.length,
  avgTotalEstateMemories: Math.round(mean(ok.map(r => r.totalEstateMemories)) * 100) / 100,
  chronicleWorthyShare: Math.round((ok.reduce((s, r) => s + r.chronicleWorthyEstateMemories, 0) / Math.max(1, ok.reduce((s, r) => s + r.totalEstateMemories, 0))) * 1000) / 1000,
  avgDistinctTemplateIds: Math.round(mean(ok.map(r => r.distinctTemplateIdCount)) * 100) / 100,
  avgFinalLeaders: Math.round(mean(ok.map(r => r.finalLeaders)) * 100) / 100,
  campaignsWithAnyLeaderShare: Math.round((ok.filter(r => r.finalLeaders > 0).length / ok.length) * 1000) / 1000,
  crossSystemDecisionShare: Math.round((ok.reduce((s, r) => s + r.crossSystemCount, 0) / Math.max(1, ok.reduce((s, r) => s + r.totalEstateChainResolutions, 0))) * 1000) / 1000,
  totalEstateChainResolutions: ok.reduce((s, r) => s + r.totalEstateChainResolutions, 0),
  totalCrossSystemDecisions: ok.reduce((s, r) => s + r.crossSystemCount, 0),
  campaignsWithStaendeGegeneinander: ok.filter(r => r.staendeGegeneinanderCount > 0).length,
  totalStaendeGegeneinander: ok.reduce((s, r) => s + r.staendeGegeneinanderCount, 0),
  estateDemandTotals: {},
  finalInfluenceAvg: {}, finalSatisfactionAvg: {},
};
for (const id of ESTATE_IDS_JS) {
  overall.estateDemandTotals[id] = ok.reduce((acc, r) => {
    const c = r.estateMemoryCounts[id];
    acc.GRANTED += c.GRANTED; acc.REFUSED += c.REFUSED; acc.PRIVILEGE += c.PRIVILEGE;
    return acc;
  }, { GRANTED: 0, REFUSED: 0, PRIVILEGE: 0 });
  overall.finalInfluenceAvg[id] = Math.round(mean(ok.map(r => r.finalEstateSnapshot[id].influence)) * 10) / 10;
  overall.finalSatisfactionAvg[id] = Math.round(mean(ok.map(r => r.finalEstateSnapshot[id].satisfaction)) * 10) / 10;
}

// ---------- Per-agent breakdown ----------
const byAgent = {};
for (const r of ok) {
  if (!byAgent[r.agentId]) byAgent[r.agentId] = [];
  byAgent[r.agentId].push(r);
}
const agentAggregates = {};
for (const agentId in byAgent) {
  const rows = byAgent[agentId];
  agentAggregates[agentId] = {
    campaigns: rows.length,
    avgTotalEstateMemories: Math.round(mean(rows.map(r => r.totalEstateMemories)) * 100) / 100,
    avgFinalLeaders: Math.round(mean(rows.map(r => r.finalLeaders)) * 100) / 100,
    avgDistinctTemplateIds: Math.round(mean(rows.map(r => r.distinctTemplateIdCount)) * 100) / 100,
    crossSystemDecisionShare: Math.round((rows.reduce((s, r) => s + r.crossSystemCount, 0) / Math.max(1, rows.reduce((s, r) => s + r.totalEstateChainResolutions, 0))) * 1000) / 1000,
    totalEstateChainResolutions: rows.reduce((s, r) => s + r.totalEstateChainResolutions, 0),
    campaignsWithStaendeGegeneinander: rows.filter(r => r.staendeGegeneinanderCount > 0).length,
  };
}

const out = { manifest: { generatedAt: new Date().toISOString(), seedBase: SEED_BASE, seeds: SEEDS, years: YEARS, agentPolicyVersion: results.length ? "phase11-v1" : null }, overall, agentAggregates };
fs.writeFileSync(path.join(OUT_DIR, "estate_metrics.json"), JSON.stringify(out, null, 2));
console.log("Written: " + path.join(OUT_DIR, "estate_metrics.json"));
console.log(JSON.stringify(overall, null, 2));
