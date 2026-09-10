// Phase 10 — regression guards for the three balance fixes (title ladder,
// armyStrength recalibration, vassal tribute bug). Deliberately lightweight
// smoke checks, not a re-run of the full agent lab (see tests/agents/ for
// that) — these just prevent a future edit from silently reintroducing the
// exact problems Phase 10 found and fixed.
// Ausführen mit: node tests/phase10_balance_test.js
const fs = require("fs");
const path = require("path");

const gamedata = fs.readFileSync(path.join(__dirname, "..", "data/gamedata.js"), "utf8");
const simModules = ["core", "economy", "population-dynasty", "memory", "characters", "estates", "imperial-politics", "story-threads", "drama-director", "event-chains", "chronicle", "politics", "diplomacy", "military", "debug", "war-map", "advance-year"];
const sim = simModules.map(m => fs.readFileSync(path.join(__dirname, "..", "js", m + ".js"), "utf8")).join("\n");
const battle = ["battle-data", "battle-engine", "battle-state-machine"].map(f => fs.readFileSync(path.join(__dirname, "..", "battle-engine", f + ".js"), "utf8")).join("\n");
const bridge = fs.readFileSync(path.join(__dirname, "..", "js/battle-bridge.js"), "utf8");

const testBody = `
console.log("=== PHASE 10 BALANCE REGRESSION TESTS ===\\n");
let failures = [];
function check(name, cond) {
  if (cond) console.log("  OK   " + name);
  else { console.log("  FAIL " + name); failures.push(name); }
}

console.log("--- 10A: Title ladder ---");
check("TITLES has 10 entries", TITLES.length === 10);
for (let i = 1; i < TITLES.length; i++) {
  check("reqPop strictly increasing at " + TITLES[i].id, TITLES[i].reqPop > TITLES[i-1].reqPop);
  check("reqWealth strictly increasing at " + TITLES[i].id, TITLES[i].reqWealth > TITLES[i-1].reqWealth);
  check("reqPrestige strictly increasing at " + TITLES[i].id, TITLES[i].reqPrestige > TITLES[i-1].reqPrestige);
}
// Kaiser must stay reachable in principle: checkTitleProgress() explicitly
// never auto-promotes to "kaiser" (only via checkElectionTrigger + a won
// election) — but koenig (the tier just below) must be reachable via
// ordinary progression once a palast is built, at population/wealth/prestige
// levels a strong administrative campaign was empirically observed to reach
// (see PHASE10_BALANCE_COMPARISON.md). This just guards against someone
// silently pushing reqPop/reqWealth/reqPrestige for koenig back into an
// unreachable range.
const koenig = TITLES.find(t => t.id === "koenig");
check("koenig reqPop stays within an empirically-reachable range (<=25000)", koenig.reqPop <= 25000);
check("koenig reqPrestige stays within an empirically-reachable range (<=200)", koenig.reqPrestige <= 200);

console.log("--- 10B: armyStrength calibration ---");
const state = newGame({ seed: 1 });
const pikeCost = TROOP_TYPES.pikeniere.cost, kavCost = TROOP_TYPES.schwere_kavallerie.cost;
state.army.pikeniere = 20;
const pikeStrength = armyStrength(state);
state.army.pikeniere = 0;
state.army.schwere_kavallerie = Math.round(20 * pikeCost / kavCost); // same taler budget, fewer units
const kavStrength = armyStrength(state);
// Cavalry must no longer be rated as stronger than an equal-cost pikemen
// force despite empirically losing to it in real battles — see
// PHASE10_BALANCE_COMPARISON.md §H-N (0.033 win rate at the old rating).
check("equal-Taler-budget pikeniere armyStrength >= schwere_kavallerie armyStrength", pikeStrength >= kavStrength);
check("pikeniere no longer the single cheapest unit per strength point (cost/strength)", (TROOP_TYPES.pikeniere.cost / TROOP_TYPES.pikeniere.strength) >= (TROOP_TYPES.bogenschuetzen.cost / TROOP_TYPES.bogenschuetzen.strength) - 5);

console.log("--- 10C: Vassal tribute ---");
const s2 = newGame({ seed: 1 });
for (const tid in s2.territories) {
  if (territoryById(tid).region === "ai1") s2.territories[tid].owner = "player";
}
checkRegionConquest(s2, "ai1");
const report = applyMonthlyFinances(s2);
check("a populated vassal generates nonzero monthly tribute", report.vassalTribute > 0);
check("vassal tribute is a plausible monthly figure (not absurdly large)", report.vassalTribute < 5000);

console.log("");
if (failures.length) {
  console.log("--- FEHLGESCHLAGEN ---");
  failures.forEach(f => console.log(" - " + f));
  process.exitCode = 1;
} else {
  console.log("Alle Phase-10-Balance-Regressionstests bestanden.");
}
`;

eval(gamedata + "\n" + sim + "\n" + battle + "\n" + bridge + "\n" + testBody);
