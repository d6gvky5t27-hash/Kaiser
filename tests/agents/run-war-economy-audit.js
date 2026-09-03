// Phase 10C — War Economy Audit (§39-46). Runs the unchanged war-heavy
// agents and captures the FULL monthly financial report (applyMonthlyFinances's
// return value: taxIncome/upkeep/salaries/debtInterest/vassalTribute/
// otherEntries) for every month, to find the EXACT cost driver behind the
// Phase-9 73-83% bankruptcy rate — not just "war is expensive" in general.
// Test infrastructure only.
const fs = require("fs");
const path = require("path");
const { loadSandboxSource } = require("./run-campaign.js");

const OUT_DIR = path.join(__dirname, "..", "output", "phase10");
fs.mkdirSync(OUT_DIR, { recursive: true });

function parseArgs(argv) { const out = {}; for (const a of argv) { const m = /^--([^=]+)=(.*)$/.exec(a); if (m) out[m[1]] = m[2]; } return out; }
const args = parseArgs(process.argv.slice(2));
const LABEL = args.label || "baseline";
const N_SEEDS = args.seeds !== undefined ? Number(args.seeds) : 15;
const AGENTS_TO_AUDIT = ["kriegsherr", "hardliner", "opportunist", "minmaxer"];
const SEEDS = Array.from({ length: N_SEEDS }, (_, i) => 1000 + i * 7919);

const source = loadSandboxSource();
const driver = `
  const __out = [];
  for (const agentId of ${JSON.stringify(AGENTS_TO_AUDIT)}) {
    for (const seed of ${JSON.stringify(SEEDS)}) {
      const agent = AGENTS[agentId];
      const state = newGame({ seed });
      const ctx = { agentId: agent.id, seed, state, rng: makeAgentRng(agent.id + ":" + seed + ":" + AGENT_POLICY_VERSION), decisionLog: [], memory: {} };
      const monthly = [];
      let recruitSpend = 0, loanProceeds = 0, buildingSpend = 0, otherSpend = 0, otherIncome = 0;
      let warStartYear = null, firstBankruptYear = null;
      for (let y = 0; y < 100; y++) {
        for (let m = 0; m < 12; m++) {
          if (state.gameOver) break;
          if (agent.decideMonth) agent.decideMonth(ctx);
          const wasAtWar = Object.values(state.warState || {}).some(Boolean);
          const res = advanceMonth(state).report;
          if (wasAtWar && warStartYear === null) warStartYear = state.year;
          for (const e of res.otherEntries) {
            const label = e.label || e[0] || "";
            const amount = e.amount !== undefined ? e.amount : e[1];
            if (/Aushebung|angeheuert|zum Lehensdienst/.test(label)) recruitSpend += -Math.min(0, amount) || Math.max(0, -amount);
            else if (/Kredit aufgenommen/.test(label)) loanProceeds += amount;
            else if (/Neubau|Ausbau/.test(label)) buildingSpend += Math.max(0, -amount);
            else if (amount < 0) otherSpend += -amount;
            else otherIncome += amount;
          }
          monthly.push({ year: state.year, month: state.month, treasury: Math.round(state.treasury), taxIncome: res.taxIncome, upkeep: res.upkeep, salaries: res.salaries, debtInterest: res.debtInterest, vassalTribute: res.vassalTribute, atWar: Object.values(state.warState || {}).some(Boolean) });
          resolvePendingQueue(ctx, agent);
          if (state.gameOver && firstBankruptYear === null && state.gameOver === "bankrupt") firstBankruptYear = state.year;
          if (state.gameOver) break;
        }
        if (state.gameOver) break;
      }
      __out.push({
        agentId, seed, gameOver: state.gameOver, finalYear: state.year, warStartYear, firstBankruptYear,
        recruitSpend: Math.round(recruitSpend), loanProceeds: Math.round(loanProceeds), buildingSpend: Math.round(buildingSpend),
        otherSpend: Math.round(otherSpend), otherIncome: Math.round(otherIncome),
        totalTaxIncome: Math.round(monthly.reduce((s, x) => s + x.taxIncome, 0)),
        totalUpkeep: Math.round(monthly.reduce((s, x) => s + x.upkeep, 0)),
        totalSalaries: Math.round(monthly.reduce((s, x) => s + x.salaries, 0)),
        totalDebtInterest: Math.round(monthly.reduce((s, x) => s + x.debtInterest, 0)),
        totalVassalTribute: Math.round(monthly.reduce((s, x) => s + x.vassalTribute, 0)),
        monthsAtWar: monthly.filter(x => x.atWar).length,
        monthsSimulated: monthly.length,
        monthly,
      });
    }
  }
  globalThis.__WAR_ECON__ = __out;
`;

console.log(`War economy audit [${LABEL}]: ${AGENTS_TO_AUDIT.length} agents x ${N_SEEDS} seeds...`);
const t0 = Date.now();
eval(source + driver);
const results = globalThis.__WAR_ECON__;
console.log(`Done: ${results.length} campaigns in ${Date.now() - t0}ms`);

function mean(a) { return a.length ? a.reduce((x, y) => x + y, 0) / a.length : null; }
function round(x) { return x === null || x === undefined ? null : Math.round(x); }

const byAgent = {};
for (const r of results) (byAgent[r.agentId] = byAgent[r.agentId] || []).push(r);
const summary = {};
for (const agentId in byAgent) {
  const rows = byAgent[agentId];
  const bankrupt = rows.filter(r => r.gameOver === "bankrupt");
  summary[agentId] = {
    n: rows.length,
    bankruptShare: round((bankrupt.length / rows.length) * 100) / 100,
    avgFinalYear: round(mean(rows.map(r => r.finalYear - 1500))),
    avgMonthsAtWar: round(mean(rows.map(r => r.monthsAtWar))),
    avgMonthsSimulated: round(mean(rows.map(r => r.monthsSimulated))),
    // Outflow decomposition, averaged per campaign (absolute Taler over the whole campaign)
    avgTotalTaxIncome: round(mean(rows.map(r => r.totalTaxIncome))),
    avgTotalUpkeep: round(mean(rows.map(r => r.totalUpkeep))),
    avgTotalSalaries: round(mean(rows.map(r => r.totalSalaries))),
    avgTotalDebtInterest: round(mean(rows.map(r => r.totalDebtInterest))),
    avgTotalVassalTribute: round(mean(rows.map(r => r.totalVassalTribute))),
    avgRecruitSpend: round(mean(rows.map(r => r.recruitSpend))),
    avgLoanProceeds: round(mean(rows.map(r => r.loanProceeds))),
    avgBuildingSpend: round(mean(rows.map(r => r.buildingSpend))),
    avgOtherSpend: round(mean(rows.map(r => r.otherSpend))),
    avgOtherIncome: round(mean(rows.map(r => r.otherIncome))),
    // Which single outflow category is largest, on average, relative to total tax income?
  };
  const s = summary[agentId];
  const outflows = { upkeep: s.avgTotalUpkeep, salaries: s.avgTotalSalaries, debtInterest: s.avgTotalDebtInterest, recruitSpend: s.avgRecruitSpend, buildingSpend: s.avgBuildingSpend, otherSpend: s.avgOtherSpend };
  const dominant = Object.entries(outflows).sort((a, b) => b[1] - a[1])[0];
  s.dominantOutflow = dominant[0];
  s.dominantOutflowShareOfIncome = round((dominant[1] / (s.avgTotalTaxIncome + s.avgOtherIncome + s.avgLoanProceeds + s.avgTotalVassalTribute)) * 100) / 100;
  s.totalOutflow = round(s.avgTotalUpkeep + s.avgTotalSalaries + s.avgTotalDebtInterest + s.avgRecruitSpend + s.avgBuildingSpend + s.avgOtherSpend);
  s.totalInflow = round(s.avgTotalTaxIncome + s.avgOtherIncome + s.avgLoanProceeds + s.avgTotalVassalTribute);
}

console.log(JSON.stringify(summary, null, 2));
fs.writeFileSync(path.join(OUT_DIR, `war_economy_${LABEL}.json`), JSON.stringify({ label: LABEL, seeds: SEEDS, summary, results }, null, 0));
console.log("Written: " + path.join(OUT_DIR, `war_economy_${LABEL}.json`));
