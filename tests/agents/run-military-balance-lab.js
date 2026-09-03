// Phase 10B — expanded Composition Lab (§21-30 of the master prompt).
// 10 compositions x 2 terrains (ebene direct assault, burg follow-up
// assault on the enemy capital with survivors+reinforcements) x 2
// formations (neutral "ausgewogen" baseline + composition's natural
// best-fit formation) x 30 seeds. Same fixed-budget-via-real-takeLoan()
// methodology as the Phase 9 army-composition test, extended.
// Test infrastructure only.
const fs = require("fs");
const path = require("path");
const { loadSandboxSource } = require("./run-campaign.js");

const OUT_DIR = path.join(__dirname, "..", "output", "phase10");
fs.mkdirSync(OUT_DIR, { recursive: true });

function parseArgs(argv) { const out = {}; for (const a of argv) { const m = /^--([^=]+)=(.*)$/.exec(a); if (m) out[m[1]] = m[2]; } return out; }
const args = parseArgs(process.argv.slice(2));
const LABEL = args.label || "baseline";
const BUDGET = 3000;
const N_SEEDS = args.seeds !== undefined ? Number(args.seeds) : 30;
const SEEDS = Array.from({ length: N_SEEDS }, (_, i) => 5000 + i * 7919);

const source = loadSandboxSource();
const driver = `
  const BUDGET = ${BUDGET};
  const COMPOSITIONS = {
    pikeniere_only:       { units: [["pikeniere", 1.0]], formation: "defensiv" },
    bogenschuetzen_only:  { units: [["bogenschuetzen", 1.0]], formation: "fernkampfstellung" },
    ritter_only:          { units: [["ritter", 1.0]], formation: "kavallerieflanke" },
    schwere_kavallerie_only: { units: [["schwere_kavallerie", 1.0]], formation: "kavallerieflanke" },
    soeldner_only:        { units: [["soeldner", 1.0]], formation: "aggressiv" },
    mixed_historical:     { units: [["pikeniere", 0.40], ["bogenschuetzen", 0.20], ["ritter", 0.25], ["schwere_kavallerie", 0.15]], formation: "ausgewogen" },
    infantry_heavy:       { units: [["miliz", 0.5], ["pikeniere", 0.5]], formation: "defensiv" },
    ranged_heavy:         { units: [["bogenschuetzen", 0.5], ["armbrustschuetzen", 0.5]], formation: "fernkampfstellung" },
    cavalry_heavy:         { units: [["ritter", 0.5], ["schwere_kavallerie", 0.5]], formation: "kavallerieflanke" },
    balanced:             { units: [["miliz", 0.15], ["bogenschuetzen", 0.15], ["armbrustschuetzen", 0.15], ["pikeniere", 0.25], ["ritter", 0.15], ["schwere_kavallerie", 0.15]], formation: "ausgewogen" },
  };
  const SEEDS = ${JSON.stringify(SEEDS)};
  const results = [];

  function recruitComposition(state, comp) {
    const recruited = {};
    let spentTaler = 0, spentPop = 0;
    for (const [type, share] of comp.units) {
      const budgetForType = BUDGET * share;
      const count = Math.floor(budgetForType / TROOP_TYPES[type].cost);
      if (count > 0) {
        const res = recruitTroops(state, type, count);
        if (res.ok) { recruited[type] = count; spentTaler += count * TROOP_TYPES[type].cost; spentPop += count * CONFIG.military.recruitPopCostPerUnit; }
      }
    }
    return { recruited, spentTaler, spentPop };
  }

  function fightTerritory(state, fromId, toId, formation) {
    const preBattleArmyStrength = armyStrength(state);
    const armies = buildTerritoryBattleArmies(state, fromId, toId, true);
    const terrain = territoryById(toId).terrain;
    armies.armyA.formation = formation; armies.armyA.tactic = "frontalangriff";
    const battleSeed = Math.floor(rnd() * 0xFFFFFFFF);
    let b = createBattle(armies.armyA, armies.armyB, terrain, "klar", battleSeed);
    let steps = 0;
    while (!b.finished && steps < 500) { b = advanceBattle(b); steps++; }
    applyTerritoryBattleResult(state, fromId, toId, b, true);
    const won = b.result && b.result.winner === "A";
    return { won, terrain, preBattleArmyStrength, casualtyShareA: b.result.armyA.startStrength > 0 ? b.result.armyA.casualties / b.result.armyA.startStrength : null, casualtyShareB: b.result.armyB.startStrength > 0 ? b.result.armyB.casualties / b.result.armyB.startStrength : null };
  }

  for (const seed of SEEDS) {
    for (const compName in COMPOSITIONS) {
      const comp = COMPOSITIONS[compName];
      for (const formationMode of ["ausgewogen", comp.formation]) {
        const state = newGame({ seed });
        takeLoan(state, BUDGET);
        const rec = recruitComposition(state, comp);
        for (const type in rec.recruited) deployToTerritory(state, "p_nord", type, rec.recruited[type]);

        // Stage 1: ebene (m_sued, border territory)
        const stage1 = fightTerritory(state, "p_nord", "m_sued", formationMode);
        let stage2 = null;
        if (stage1.won) {
          // Reinforce with a second identical wave, then push into the enemy capital (burg terrain).
          const rec2 = recruitComposition(state, comp);
          for (const type in rec2.recruited) deployToTerritory(state, "m_sued", type, rec2.recruited[type]);
          stage2 = fightTerritory(state, "m_sued", "m_hauptstadt", formationMode);
        }
        results.push({
          seed, composition: compName, formationMode, spentTaler: rec.spentTaler, spentPop: rec.spentPop,
          stage1, stage2,
        });
      }
    }
  }
  globalThis.__MIL_LAB__ = results;
`;

console.log(`Military balance lab [${LABEL}]: ${N_SEEDS} seeds x 10 compositions x 2 formation modes x 2 stages...`);
const t0 = Date.now();
eval(source + driver);
const results = globalThis.__MIL_LAB__;
console.log(`Done: ${results.length} trials in ${Date.now() - t0}ms`);

// ---- Aggregate per (composition, formationMode) ----
const key = r => r.composition + "|" + r.formationMode;
const byKey = {};
for (const r of results) (byKey[key(r)] = byKey[key(r)] || []).push(r);

function mean(a) { return a.length ? a.reduce((x, y) => x + y, 0) / a.length : null; }
function round(x, d) { d = d || 3; return x === null || x === undefined ? null : Math.round(x * Math.pow(10, d)) / Math.pow(10, d); }

const summary = {};
for (const k in byKey) {
  const rows = byKey[k];
  const stage1Wins = rows.filter(r => r.stage1.won).length;
  const stage2Attempts = rows.filter(r => r.stage2).length;
  const stage2Wins = rows.filter(r => r.stage2 && r.stage2.won).length;
  summary[k] = {
    trials: rows.length,
    avgSpentTaler: Math.round(mean(rows.map(r => r.spentTaler))),
    avgSpentPop: Math.round(mean(rows.map(r => r.spentPop))),
    avgPreBattleArmyStrength: round(mean(rows.map(r => r.stage1.preBattleArmyStrength)), 1),
    stage1WinRate: round(stage1Wins / rows.length),
    stage1AvgCasualtyShareA: round(mean(rows.map(r => r.stage1.casualtyShareA || 0))),
    stage2Attempts,
    stage2WinRate: stage2Attempts ? round(stage2Wins / stage2Attempts) : null,
    stage2AvgCasualtyShareA: stage2Attempts ? round(mean(rows.filter(r => r.stage2).map(r => r.stage2.casualtyShareA || 0))) : null,
    strengthPerTaler: round(mean(rows.map(r => r.stage1.preBattleArmyStrength)) / mean(rows.map(r => r.spentTaler)), 4),
    strengthPerPop: round(mean(rows.map(r => r.stage1.preBattleArmyStrength)) / mean(rows.map(r => r.spentPop)), 3),
  };
}

// ---- Predictive validity: armyStrength (relative to a fixed reference) vs actual stage1 win rate ----
// Build a simple ranking correlation: does higher armyStrength-per-taler correlate with higher win rate?
const compRows = Object.keys(summary).filter(k => k.endsWith("|ausgewogen")).map(k => summary[k]);
function pearson(xs, ys) {
  const n = xs.length; const mx = mean(xs), my = mean(ys);
  let num = 0, dx2 = 0, dy2 = 0;
  for (let i = 0; i < n; i++) { const dx = xs[i] - mx, dy = ys[i] - my; num += dx * dy; dx2 += dx * dx; dy2 += dy * dy; }
  return dx2 === 0 || dy2 === 0 ? null : round(num / Math.sqrt(dx2 * dy2));
}
const strengths = compRows.map(r => r.avgPreBattleArmyStrength);
const winRates = compRows.map(r => r.stage1WinRate);
const predictiveValidity = pearson(strengths, winRates);

console.log(JSON.stringify({ summary, predictiveValidity }, null, 2));
fs.writeFileSync(path.join(OUT_DIR, `military_lab_${LABEL}.json`), JSON.stringify({ label: LABEL, budget: BUDGET, seeds: SEEDS, summary, predictiveValidity, results }, null, 0));
console.log("Written: " + path.join(OUT_DIR, `military_lab_${LABEL}.json`));
