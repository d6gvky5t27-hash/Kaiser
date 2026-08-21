// Phase-3-Metriken (Character Core) — §Punkt 56/84/85/87: Langzeitmessung
// über mehrere Partien, um die neuen Systeme (Charaktere/Traits/
// Beziehungen/Loyalität/Claims/Rivalitäten/Berater) empirisch statt nur
// theoretisch zu kalibrieren. Rein additiv, feste Seeds (0..RUNS-1).
//
// Ausführen mit: node tests/phase3_metrics_test.js
const fs = require("fs");
const path = require("path");

const gamedata = fs.readFileSync(path.join(__dirname, "..", "data/gamedata.js"), "utf8");
const simModules = ["core", "economy", "population-dynasty", "memory", "characters", "story-threads", "drama-director", "event-chains", "politics", "diplomacy", "military", "debug", "war-map", "advance-year"];
const sim = simModules.map(m => fs.readFileSync(path.join(__dirname, "..", "js", m + ".js"), "utf8")).join("\n");

const testBody = `
const RUNS = 30;
const YEARS = 100;

let totalActiveChars = 0, totalTraitsSum = 0, totalTraitsCount = 0;
let totalRivalries = 0, totalAdvisorAppointments = 0, totalAdvisorDeaths = 0;
let totalLoyaltySum = 0, totalLoyaltyCount = 0, totalStrongClaims = 0;
const gameOverReasons = {};
let noHeirCount = 0;

const startTime = Date.now();

for (let run = 0; run < RUNS; run++) {
  const state = newGame({ seed: run });
  for (let y = 0; y < YEARS; y++) {
    for (let m = 0; m < 12; m++) { advanceMonth(state); resolvePendingEventWithPolicy(state, "FIRST_OPTION"); if (state.gameOver) break; }
    if (state.gameOver) break;
  }
  gameOverReasons[state.gameOver || "kein Game Over"] = (gameOverReasons[state.gameOver || "kein Game Over"] || 0) + 1;
  if (state.gameOver === "no_heir") noHeirCount++;

  const allChars = Object.values(state.characters);
  const aliveChars = allChars.filter(c => c.alive);
  totalActiveChars += aliveChars.length;
  for (const c of aliveChars) {
    totalTraitsSum += c.traits.length;
    totalTraitsCount++;
    totalLoyaltySum += c.loyalty;
    totalLoyaltyCount++;
    totalStrongClaims += c.claims.filter(cl => cl.strength === "strong" || cl.strength === "primary").length;
  }
  // Rivalitaeten zaehlen (jedes Paar einmal, ueber rivalIds)
  const countedPairs = new Set();
  for (const c of allChars) {
    for (const rid of c.rivalIds) {
      const key = [Object.keys(state.characters).find(k=>state.characters[k]===c), rid].sort().join("-");
      countedPairs.add(key);
    }
  }
  totalRivalries += countedPairs.size;

  // Beraterwechsel ueber die Chronik zaehlen (Ernennungen/Todesfaelle)
  totalAdvisorAppointments += state.chronicle.filter(l => l.includes("wurde zum") && l.includes("ernannt")).length;
  totalAdvisorDeaths += state.chronicle.filter(l => l.includes("ist verstorben") && Object.values(ADVISOR_ROLES).some(r => l.includes(r.name))).length;
}

const elapsedMs = Date.now() - startTime;

console.log('=== PHASE 3 CHARACTER CORE — Metriken (' + RUNS + ' Partien x ' + YEARS + ' Jahre, feste Seeds) ===');
console.log('');
console.log('Aktive (lebende) Charaktere im Schnitt am Spielende: ' + (totalActiveChars/RUNS).toFixed(1));
console.log('Traits pro Charakter im Schnitt: ' + (totalTraitsSum/totalTraitsCount).toFixed(2));
console.log('Rivalitaeten pro Partie (100 Jahre) im Schnitt: ' + (totalRivalries/RUNS).toFixed(2));
console.log('Berater-Ernennungen pro Partie im Schnitt: ' + (totalAdvisorAppointments/RUNS).toFixed(2));
console.log('Berater-Todesfaelle pro Partie im Schnitt: ' + (totalAdvisorDeaths/RUNS).toFixed(2));
console.log('Durchschnittliche Loyalitaet (alle lebenden wichtigen Charaktere): ' + (totalLoyaltySum/totalLoyaltyCount).toFixed(1));
console.log('Starke/primaere Ansprueche im Schnitt am Spielende: ' + (totalStrongClaims/RUNS).toFixed(2));
console.log('');
console.log('--- Game-Over-Gruende ---');
for (const reason in gameOverReasons) console.log('  ' + reason + ': ' + gameOverReasons[reason] + '/' + RUNS);
console.log('no_heir-Rate: ' + Math.round(100*noHeirCount/RUNS) + '% (Phase-2-Baseline zum Vergleich: 53%, siehe BASELINE.md — bewusst NICHT gefixt, §Punkt 57)');
console.log('');
console.log('Performance: ' + elapsedMs + ' ms fuer ' + RUNS + ' Partien (' + (elapsedMs/RUNS).toFixed(0) + ' ms/Partie)');
`;

eval(gamedata + "\n" + sim + "\n" + testBody);
