// Automatisierte Tests für die Kampf-Engine (§41) + Monte-Carlo-Balancing (§42)
// Ausführen mit: node tests/battle_test.js

const fs = require("fs");
const path = require("path");

const files = ["battle-data.js", "battle-engine.js", "battle-state-machine.js"];
const combined = files.map(f => fs.readFileSync(path.join(__dirname, "..", "battle-engine", f), "utf8")).join("\n");

const testBody = `
function freshArmy(name, unitType, count, opts) {
  const commander = createCommander(name + "-Kommandant", 50, 50, 50, opts && opts.commanderExperience || 40);
  return createArmy(name, commander, [createUnitStack(unitType, count, opts)]);
}

function simulateBattle1000Times(makeArmyA, makeArmyB, terrain, weather, runs) {
  runs = runs || 1000;
  let winsA = 0, winsB = 0, other = 0;
  let totalCasualtyShareA = 0, totalCasualtyShareB = 0;
  for (let i = 0; i < runs; i++) {
    const armyA = makeArmyA();
    const armyB = makeArmyB();
    const state = simulateBattle(armyA, armyB, terrain, weather, i * 104729 + 7);
    const r = state.result;
    if (r.winner === "A") winsA++;
    else if (r.winner === "B") winsB++;
    else other++;
    totalCasualtyShareA += r.armyA.startStrength > 0 ? r.armyA.casualties / r.armyA.startStrength : 0;
    totalCasualtyShareB += r.armyB.startStrength > 0 ? r.armyB.casualties / r.armyB.startStrength : 0;
  }
  return {
    winsA, winsB, other, runs,
    avgCasualtyShareA: totalCasualtyShareA / runs,
    avgCasualtyShareB: totalCasualtyShareB / runs,
  };
}

console.log("=== KAMPF-ENGINE TESTSUITE (§41) ===\\n");
let failures = [];

// ---------- Test 1: 1000 Infanterie vs 1000 Infanterie — sollte ausgeglichen sein ----------
{
  const res = simulateBattle1000Times(
    () => freshArmy("Seite A", "infanterie", 1000),
    () => freshArmy("Seite B", "infanterie", 1000),
    "ebene", "klar", 300
  );
  const winRateA = res.winsA / res.runs;
  console.log("Test 1: 1000 Infanterie vs 1000 Infanterie (gleich stark)");
  console.log("  Siege A: " + res.winsA + "/" + res.runs + " (" + (winRateA*100).toFixed(1) + "%) | Siege B: " + res.winsB + " | Sonstige: " + res.other);
  console.log("  Ø Verluste A: " + (res.avgCasualtyShareA*100).toFixed(1) + "% | Ø Verluste B: " + (res.avgCasualtyShareB*100).toFixed(1) + "%");
  if (winRateA < 0.35 || winRateA > 0.65) failures.push("Test 1: Gleich starke Armeen sind nicht ausgeglichen (Siegrate A=" + (winRateA*100).toFixed(1) + "%)");
  console.log("");
}

// ---------- Test 2: erfahrene vs unerfahrene Infanterie ----------
{
  const res = simulateBattle1000Times(
    () => freshArmy("Veteranen", "infanterie", 1000, { experience: 80 }),
    () => freshArmy("Rekruten", "infanterie", 1000, { experience: 15 }),
    "ebene", "klar", 400
  );
  const winRateA = res.winsA / res.runs;
  console.log("Test 2: Erfahrene (Exp 80) vs unerfahrene (Exp 15) Infanterie");
  console.log("  Siege Veteranen: " + res.winsA + "/" + res.runs + " (" + (winRateA*100).toFixed(1) + "%)");
  if (winRateA < 0.6) failures.push("Test 2: Erfahrene Truppen gewinnen nicht deutlich häufiger (nur " + (winRateA*100).toFixed(1) + "%)");
  console.log("");
}

// ---------- Test 3: Kavallerie vs Bogenschützen auf Ebene — Kavallerie klar im Vorteil ----------
{
  const res = simulateBattle1000Times(
    () => freshArmy("Reiter", "kavallerie", 500),
    () => freshArmy("Schützen", "bogenschuetzen", 500),
    "ebene", "klar", 500
  );
  const winRateA = res.winsA / res.runs;
  console.log("Test 3: 500 Kavallerie vs 500 Bogenschützen auf Ebene");
  console.log("  Siege Kavallerie: " + res.winsA + "/" + res.runs + " (" + (winRateA*100).toFixed(1) + "%)");
  if (winRateA < 0.65) failures.push("Test 3: Kavallerie sollte auf Ebene gegen Bogenschützen deutlich im Vorteil sein (nur " + (winRateA*100).toFixed(1) + "%)");
  console.log("");
}

// ---------- Test 4: Kavallerie vs defensive Infanterie im Wald — Kavallerie im Nachteil ----------
{
  const res = simulateBattle1000Times(
    () => { const a = freshArmy("Reiter", "kavallerie", 500); a.formation = "aggressiv"; a.tactic = "frontalangriff"; return a; },
    () => { const b = freshArmy("Verteidiger", "infanterie", 500); b.formation = "defensiv"; b.tactic = "verteidigen"; return b; },
    "wald", "klar", 600
  );
  const winRateA = res.winsA / res.runs;
  console.log("Test 4: 500 Kavallerie (aggressiv) vs 500 defensive Infanterie im Wald");
  console.log("  Siege Kavallerie: " + res.winsA + "/" + res.runs + " (" + (winRateA*100).toFixed(1) + "%)");
  if (winRateA > 0.5) failures.push("Test 4: Kavallerie sollte im Wald gegen defensive Infanterie im Nachteil sein (aber " + (winRateA*100).toFixed(1) + "% Siege)");
  console.log("");
}

// ---------- Test 5: sehr niedrige Moral — Armee soll relativ schnell fliehen ----------
{
  let routedCount = 0, runs = 300;
  for (let i = 0; i < runs; i++) {
    const commander = createCommander("Verzweifelt", 50, 50, 20, 30);
    const army = createArmy("Verzweifelte Truppe", commander, [createUnitStack("miliz", 500, { morale: 12, discipline: 20 })]);
    const log = [];
    seedBattleRng(i * 7919 + 3);
    const fakeState = { log: [], phaseIndex: 0, meleeRoundsDone: 0 };
    const routed = checkRouts(army, fakeState, army.name);
    if (routed > 0) routedCount++;
  }
  const routRate = routedCount / runs;
  console.log("Test 5: Sehr niedrige Moral (12) — Fluchtrate pro Moralprüfung");
  console.log("  Geflohen: " + routedCount + "/" + runs + " (" + (routRate*100).toFixed(1) + "%)");
  if (routRate < 0.15) failures.push("Test 5: Truppen mit sehr niedriger Moral fliehen zu selten (" + (routRate*100).toFixed(1) + "%)");
  console.log("");
}

// ---------- Test 6 (Zusatz, §32): keine Willkür — große erfahrene Armee vs winzige Miliz ----------
{
  const res = simulateBattle1000Times(
    () => freshArmy("Großmacht", "infanterie", 5000, { experience: 70, morale: 80 }),
    () => freshArmy("Miliz", "miliz", 500, { experience: 10, morale: 40 }),
    "ebene", "klar", 700
  );
  const winRateA = res.winsA / res.runs;
  console.log("Test 6 (Zusatz §32): 5000 erfahrene Infanterie vs 500 schwache Miliz — sollte fast immer gewinnen");
  console.log("  Siege Großmacht: " + res.winsA + "/" + res.runs + " (" + (winRateA*100).toFixed(1) + "%)");
  if (winRateA < 0.95) failures.push("Test 6: Deutlich überlegene Armee gewinnt nicht fast immer (nur " + (winRateA*100).toFixed(1) + "%) — Zufall zu stark?");
  console.log("");
}

console.log("=== ZUSAMMENFASSUNG ===");
if (failures.length) {
  console.log("Fehlgeschlagene Tests:");
  failures.forEach(f => console.log(" - " + f));
  process.exitCode = 1;
} else {
  console.log("Alle Testfälle innerhalb der erwarteten Toleranzen bestanden.");
}
`;

eval(combined + "\n" + testBody);
