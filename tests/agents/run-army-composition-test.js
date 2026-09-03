// Phase 9 — §38-44: Dominant Strategy Test (Pikemen-Spam vs Cavalry vs
// Mixed historical army). Controlled comparison, NOT part of the archetype
// campaign matrix: every composition gets the SAME fixed taler budget (via
// a real takeLoan() call, kept isolated per trial — debt is never repaid
// since each trial is a fresh, single-battle newGame(), not a full
// campaign), recruited via the real recruitTroops(), deployed via the real
// deployToTerritory(), and fought via the real battle engine against the
// SAME fixed target (p_nord -> m_sued) across many seeds. Only the seed
// (and therefore battle RNG) varies between trials of the same composition.
// Test infrastructure only.
const fs = require("fs");
const path = require("path");
const { loadSandboxSource } = require("./run-campaign.js");

const ROOT = path.join(__dirname, "..", "..");
const OUT_DIR = path.join(ROOT, "tests", "output", "phase9");
fs.mkdirSync(OUT_DIR, { recursive: true });

const BUDGET = 3000;
const N_TRIALS = 40;
const SEEDS = Array.from({ length: N_TRIALS }, (_, i) => 2000 + i * 7919);

const source = loadSandboxSource();
const driver = `
  const BUDGET = ${BUDGET};
  const COMPOSITIONS = {
    pikemen_only: [["pikeniere", 1.0]],
    cavalry_only: [["schwere_kavallerie", 1.0]],
    mixed_historical: [["pikeniere", 0.40], ["bogenschuetzen", 0.20], ["ritter", 0.25], ["schwere_kavallerie", 0.15]],
  };
  const SEEDS = ${JSON.stringify(SEEDS)};
  const results = [];
  for (const seed of SEEDS) {
    for (const compName in COMPOSITIONS) {
      const state = newGame({ seed });
      takeLoan(state, BUDGET);
      const recruited = {};
      let spentTaler = 0, spentPop = 0;
      for (const [type, share] of COMPOSITIONS[compName]) {
        const budgetForType = BUDGET * share;
        const count = Math.floor(budgetForType / TROOP_TYPES[type].cost);
        if (count > 0) {
          const res = recruitTroops(state, type, count);
          if (res.ok) { recruited[type] = count; spentTaler += count * TROOP_TYPES[type].cost; spentPop += count * CONFIG.military.recruitPopCostPerUnit; }
        }
      }
      const preBattleArmyStrength = armyStrength(state);
      for (const type in recruited) deployToTerritory(state, "p_nord", type, recruited[type]);
      const treasuryBefore = state.treasury;
      const armies = buildTerritoryBattleArmies(state, "p_nord", "m_sued", true);
      const terrain = territoryById("m_sued").terrain;
      armies.armyA.formation = "ausgewogen"; armies.armyA.tactic = "frontalangriff";
      const battleSeed = Math.floor(rnd() * 0xFFFFFFFF);
      let b = createBattle(armies.armyA, armies.armyB, terrain, "klar", battleSeed);
      let steps = 0;
      while (!b.finished && steps < 500) { b = advanceBattle(b); steps++; }
      applyTerritoryBattleResult(state, "p_nord", "m_sued", b, true);
      const won = b.result && b.result.winner === "A";
      const rA = b.result.armyA, rB = b.result.armyB;
      results.push({
        seed, composition: compName, recruited, spentTaler, spentPop, preBattleArmyStrength,
        won, casualtyShareA: rA.startStrength > 0 ? rA.casualties / rA.startStrength : null,
        casualtyShareB: rB.startStrength > 0 ? rB.casualties / rB.startStrength : null,
        treasuryBefore, treasuryAfter: state.treasury,
        territoryConquered: state.territories["m_sued"].owner === "player",
      });
    }
  }
  globalThis.__COMP_RESULTS__ = results;
`;

const t0 = Date.now();
eval(source + driver);
const results = globalThis.__COMP_RESULTS__;
console.log(`Army composition test: ${results.length} trials in ${Date.now() - t0}ms`);

const byComp = {};
for (const r of results) {
  if (!byComp[r.composition]) byComp[r.composition] = [];
  byComp[r.composition].push(r);
}
const summary = {};
for (const comp in byComp) {
  const rows = byComp[comp];
  const wins = rows.filter(r => r.won).length;
  const conquests = rows.filter(r => r.territoryConquered).length;
  summary[comp] = {
    trials: rows.length,
    avgSpentTaler: Math.round(rows.reduce((s, r) => s + r.spentTaler, 0) / rows.length),
    avgSpentPop: Math.round(rows.reduce((s, r) => s + r.spentPop, 0) / rows.length),
    avgPreBattleArmyStrength: Math.round(rows.reduce((s, r) => s + r.preBattleArmyStrength, 0) / rows.length),
    strengthPerTaler: Math.round((rows.reduce((s, r) => s + r.preBattleArmyStrength, 0) / rows.reduce((s, r) => s + r.spentTaler, 0)) * 1000) / 1000,
    strengthPerPop: Math.round((rows.reduce((s, r) => s + r.preBattleArmyStrength, 0) / rows.reduce((s, r) => s + r.spentPop, 0)) * 1000) / 1000,
    winRate: Math.round((wins / rows.length) * 1000) / 1000,
    territoryConquestRate: Math.round((conquests / rows.length) * 1000) / 1000,
    avgCasualtyShareA: Math.round((rows.reduce((s, r) => s + (r.casualtyShareA || 0), 0) / rows.length) * 1000) / 1000,
  };
}
console.log(JSON.stringify(summary, null, 2));

fs.writeFileSync(path.join(OUT_DIR, "army_composition_test.json"), JSON.stringify({ budget: BUDGET, trialsPerComposition: N_TRIALS, seeds: SEEDS, summary, results }, null, 0));
console.log("Written: " + path.join(OUT_DIR, "army_composition_test.json"));
