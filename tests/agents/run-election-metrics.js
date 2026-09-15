// Phase 12 — Imperial Politics-specific metrics. Re-runs the SAME kind of
// campaigns as tests/agents/run-matrix.js/run-estate-metrics.js fresh
// in-memory (needs full per-campaign World Memory/eventChains/
// electionPromises scans a saved summary doesn't retain) and computes:
//   - candidacy rate, elections held/won/lost (from real TITLE_GAINED
//     (titleId=kaiser)/IMPERIAL_ELECTION_LOST memories, not inferred from
//     gameOver alone -- gameOver="victory" can also come from the other
//     three alternative victory conditions)
//   - years from candidacy declaration to resolution (from the real
//     decisionLog year field, first declare->first resolve per campaign)
//   - gifts/promises actually made (decisionLog action counts) and their
//     final outcome (state.electionPromises: PROMISED/FULFILLED/BROKEN, by type)
//   - the five new Kaiserwahl chains' resolution/outcome distribution and
//     narrative-diversity ceiling extension (Phase 11's ceiling was 16
//     distinct templateIds, Phase 12's is 21)
// Test infrastructure only. Usage:
//   node tests/agents/run-election-metrics.js [--outDir=phase12] [--seeds=30] [--seedBase=1000] [--years=100]
"use strict";
const fs = require("fs");
const path = require("path");
const { loadSandboxSource } = require("./run-campaign.js");

const ROOT = path.join(__dirname, "..", "..");
function parseArgs(argv) { const out = {}; for (const a of argv) { const m = /^--([^=]+)=(.*)$/.exec(a); if (m) out[m[1]] = m[2]; } return out; }
const args = parseArgs(process.argv.slice(2));
const OUT_DIR = path.join(ROOT, "tests", "output", args.outDir || "phase12");
const N_SEEDS = args.seeds !== undefined ? Number(args.seeds) : 30;
const YEARS = args.years !== undefined ? Number(args.years) : 100;
const SEED_BASE = args.seedBase !== undefined ? Number(args.seedBase) : 1000;
const SEEDS = Array.from({ length: N_SEEDS }, (_, i) => SEED_BASE + i * 7919);

const source = loadSandboxSource();
const driver = `
  const IMPERIAL_POLITICS_CHAIN_IDS = ${JSON.stringify(["unsicherer_kurfuerst", "teures_versprechen", "rivalisierende_zusagen", "gebrochenes_versprechen", "deciding_vote"])};
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

      // ---- Real memories, not inferred: how many elections were actually
      // won/lost, and when the crown was actually gained (if at all) ----
      let electionsWon = 0, electionsLost = 0, kaiserYear = null;
      for (const id in state.memories.byId) {
        const mem = state.memories.byId[id];
        if (mem.type === "TITLE_GAINED" && mem.metadata && mem.metadata.titleId === "kaiser") { electionsWon++; kaiserYear = mem.year; }
        if (mem.type === "IMPERIAL_ELECTION_LOST") electionsLost++;
      }

      // ---- Decision-log-derived counts (real actions actually taken) ----
      const declareEvents = ctx.decisionLog.filter(d => d.action === "declare_imperial_candidacy" && d.ok);
      const resolveEvents = ctx.decisionLog.filter(d => d.action === "resolve_election" && d.ok);
      const giftCount = ctx.decisionLog.filter(d => d.action === "gift_elector" && d.ok).length;
      const promiseOfferCount = ctx.decisionLog.filter(d => d.action === "promise_elector" && d.ok).length;
      let yearsToFirstResolution = null;
      if (declareEvents.length && resolveEvents.length) {
        const firstResolveAfterDeclare = resolveEvents.find(r => r.year >= declareEvents[0].year);
        if (firstResolveAfterDeclare) yearsToFirstResolution = firstResolveAfterDeclare.year - declareEvents[0].year;
      }

      // ---- Final election-promise ledger (persists past the election
      // itself, s. §50/§128 -- so this is a full-campaign snapshot, not
      // just "promises during the last candidacy") ----
      const promiseCounts = { PROMISED: 0, FULFILLED: 0, BROKEN: 0 };
      const promiseTypeCounts = { no_war_target: 0, maintain_alliance: 0, maintain_treaty: 0, pay_tribute: 0 };
      let totalPromisesCreated = 0;
      if (state.electionPromises) {
        for (const id in state.electionPromises.byId) {
          const p = state.electionPromises.byId[id];
          totalPromisesCreated++;
          promiseCounts[p.status] = (promiseCounts[p.status] || 0) + 1;
          promiseTypeCounts[p.type] = (promiseTypeCounts[p.type] || 0) + 1;
        }
      }

      // ---- The five new chains: resolution/outcome distribution + how a
      // broken-promise aftermath was actually handled ----
      const chainOutcomes = {};
      let totalImperialPoliticsChainResolutions = 0;
      const gebrochenesVersprechenHandling = { COMPENSATED: 0, DENIED: 0, SILENT: 0 };
      const distinctTemplateIds = new Set();
      for (const id in state.eventChains.resolved) {
        const c = state.eventChains.resolved[id];
        distinctTemplateIds.add(c.templateId);
        if (!IMPERIAL_POLITICS_CHAIN_IDS.includes(c.templateId)) continue;
        totalImperialPoliticsChainResolutions++;
        const key = c.templateId + ":" + c.resolution;
        chainOutcomes[key] = (chainOutcomes[key] || 0) + 1;
        if (c.templateId === "gebrochenes_versprechen" && gebrochenesVersprechenHandling[c.resolution] !== undefined) gebrochenesVersprechenHandling[c.resolution]++;
      }
      for (const id in state.eventChains.active) distinctTemplateIds.add(state.eventChains.active[id].templateId);

      results.push({
        agentId, seed, crashed: null,
        candidacyDeclaredCount: declareEvents.length,
        electionsHeld: resolveEvents.length, electionsWon, electionsLost, kaiserYear,
        yearsToFirstResolution,
        giftCount, promiseOfferCount,
        totalPromisesCreated, promiseCounts, promiseTypeCounts,
        chainOutcomes, totalImperialPoliticsChainResolutions, gebrochenesVersprechenHandling,
        distinctTemplateIdCount: distinctTemplateIds.size,
        finalTitleIndex: state.titleIndex,
        yearsSimulated: state.year - 1500,
        gameOver: state.gameOver,
      });
    }
  }
  globalThis.__ELECTION_RESULTS__ = results;
`;

console.log(`Running election-metrics pass: ${N_SEEDS} seeds x ${"12"} agents, ${YEARS} years each (seedBase=${SEED_BASE})...`);
const t0 = Date.now();
eval(source + driver);
const results = globalThis.__ELECTION_RESULTS__;
console.log(`Done: ${results.length} campaigns in ${Date.now() - t0}ms`);
const crashes = results.filter(r => r.crashed);
console.log(`Crashes: ${crashes.length}/${results.length}`);
if (crashes.length) console.log(JSON.stringify(crashes, null, 2));

const ok = results.filter(r => !r.crashed);

function mean(arr) { return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null; }
function round(n, d) { return n === null || n === undefined ? null : Math.round(n * Math.pow(10, d)) / Math.pow(10, d); }

// ---------- Aggregate across ALL agents ----------
const campaignsWithCandidacy = ok.filter(r => r.candidacyDeclaredCount > 0);
const campaignsWithElection = ok.filter(r => r.electionsHeld > 0);
const overall = {
  campaigns: ok.length,
  candidacyRate: round(campaignsWithCandidacy.length / Math.max(1, ok.length), 3),
  electionHeldRate: round(campaignsWithElection.length / Math.max(1, ok.length), 3),
  totalElectionsHeld: ok.reduce((s, r) => s + r.electionsHeld, 0),
  totalElectionsWon: ok.reduce((s, r) => s + r.electionsWon, 0),
  totalElectionsLost: ok.reduce((s, r) => s + r.electionsLost, 0),
  electionWinShare: round(ok.reduce((s, r) => s + r.electionsWon, 0) / Math.max(1, ok.reduce((s, r) => s + r.electionsHeld, 0)), 3),
  avgYearsToFirstResolution: round(mean(ok.filter(r => r.yearsToFirstResolution !== null).map(r => r.yearsToFirstResolution)), 2),
  avgGiftsPerCampaign: round(mean(ok.map(r => r.giftCount)), 2),
  avgPromiseOffersPerCampaign: round(mean(ok.map(r => r.promiseOfferCount)), 2),
  totalPromisesCreated: ok.reduce((s, r) => s + r.totalPromisesCreated, 0),
  promiseStatusTotals: ["PROMISED", "FULFILLED", "BROKEN"].reduce((acc, k) => { acc[k] = ok.reduce((s, r) => s + (r.promiseCounts[k] || 0), 0); return acc; }, {}),
  promiseTypeTotals: ["no_war_target", "maintain_alliance", "maintain_treaty", "pay_tribute"].reduce((acc, k) => { acc[k] = ok.reduce((s, r) => s + (r.promiseTypeCounts[k] || 0), 0); return acc; }, {}),
  totalImperialPoliticsChainResolutions: ok.reduce((s, r) => s + r.totalImperialPoliticsChainResolutions, 0),
  gebrochenesVersprechenHandlingTotals: ["COMPENSATED", "DENIED", "SILENT"].reduce((acc, k) => { acc[k] = ok.reduce((s, r) => s + (r.gebrochenesVersprechenHandling[k] || 0), 0); return acc; }, {}),
  avgDistinctTemplateIds: round(mean(ok.map(r => r.distinctTemplateIdCount)), 2),
  chainOutcomeTotals: {},
};
for (const r of ok) {
  for (const key in r.chainOutcomes) overall.chainOutcomeTotals[key] = (overall.chainOutcomeTotals[key] || 0) + r.chainOutcomes[key];
}

// ---------- Per-agent breakdown ----------
const byAgent = {};
for (const r of ok) { if (!byAgent[r.agentId]) byAgent[r.agentId] = []; byAgent[r.agentId].push(r); }
const agentAggregates = {};
for (const agentId in byAgent) {
  const rows = byAgent[agentId];
  const withCandidacy = rows.filter(r => r.candidacyDeclaredCount > 0);
  const withElection = rows.filter(r => r.electionsHeld > 0);
  agentAggregates[agentId] = {
    campaigns: rows.length,
    candidacyRate: round(withCandidacy.length / rows.length, 3),
    electionHeldRate: round(withElection.length / rows.length, 3),
    totalElectionsWon: rows.reduce((s, r) => s + r.electionsWon, 0),
    totalElectionsLost: rows.reduce((s, r) => s + r.electionsLost, 0),
    electionWinShare: round(rows.reduce((s, r) => s + r.electionsWon, 0) / Math.max(1, rows.reduce((s, r) => s + r.electionsHeld, 0)), 3),
    avgYearsToFirstResolution: round(mean(rows.filter(r => r.yearsToFirstResolution !== null).map(r => r.yearsToFirstResolution)), 2),
    avgGiftsPerCampaign: round(mean(rows.map(r => r.giftCount)), 2),
    avgPromiseOffersPerCampaign: round(mean(rows.map(r => r.promiseOfferCount)), 2),
    totalPromisesCreated: rows.reduce((s, r) => s + r.totalPromisesCreated, 0),
    promiseBrokenShare: round(rows.reduce((s, r) => s + (r.promiseCounts.BROKEN || 0), 0) / Math.max(1, rows.reduce((s, r) => s + r.totalPromisesCreated, 0)), 3),
  };
}

const out = { manifest: { generatedAt: new Date().toISOString(), seedBase: SEED_BASE, seeds: SEEDS, years: YEARS, agentPolicyVersion: results.length ? results.find(r => !r.crashed) && "phase12-v1" : null }, overall, agentAggregates };
fs.writeFileSync(path.join(OUT_DIR, "election_metrics.json"), JSON.stringify(out, null, 2));
console.log("Written: " + path.join(OUT_DIR, "election_metrics.json"));
console.log(JSON.stringify(overall, null, 2));
