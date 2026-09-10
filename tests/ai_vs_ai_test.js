// KI-gegen-KI-Testsuite (§78 der Spec)
// Ausführen mit: node tests/ai_vs_ai_test.js
//
// Da der Spieler keine spielbare "KI-Fraktion" unter mehreren KI-Fraktionen ist
// (die Simulation hat eine feste Spielerregion + KI-Nachbarn, kein reines
// KI-gegen-KI-Match), interpretieren wir §78 wie folgt: Alle Partien laufen
// komplett ohne Spielereingriff (identisch zum Wirtschaftstest), aber die
// Auswertung konzentriert sich auf die KI-Regionen selbst — wächst/entwickelt
// sich KEINE KI-Region systematisch immer am stärksten (was auf eine
// "dominante Strategie" ohne Gegenspiel hindeuten würde)? Das ist die für
// unsere Architektur sinnvollste Umsetzung von "keine Strategie darf nahezu
// immer gewinnen".

const fs = require("fs");
const path = require("path");

const gamedata = fs.readFileSync(path.join(__dirname, "..", "data/gamedata.js"), "utf8");
const simModules = ["core", "economy", "population-dynasty", "memory", "characters", "estates", "story-threads", "drama-director", "event-chains", "chronicle", "politics", "diplomacy", "military", "debug", "war-map", "advance-year"];
const sim = simModules.map(m => fs.readFileSync(path.join(__dirname, "..", "js", m + ".js"), "utf8")).join("\n");

const testBody = `
const RUNS = 100;
const YEARS = 100;
const aiIds = ['ai1', 'ai2', 'ai3', 'ai4', 'ai5', 'ai6', 'ai7'];

let dominanceWins = {}; // wie oft ist Region X die bevölkerungsreichste KI-Region?
for (const id of aiIds) dominanceWins[id] = 0;

let finalPopsByRegion = {}; // für Streuungsanalyse
for (const id of aiIds) finalPopsByRegion[id] = [];

let playerTitles = {};
let playerVictories = 0;

for (let run = 0; run < RUNS; run++) {
  const state = newGame({ seed: run * 7919 }); // deterministisch, aber pro Run verschieden
  for (let year = 0; year < YEARS; year++) {
    for (let m = 0; m < 12; m++) { advanceMonth(state); resolvePendingEventWithPolicy(state, "FIRST_OPTION"); if (state.gameOver) break; } // Monatstakt: 12x advanceMonth() = 1 Jahr, inkl. monatlicher Finanzen
    if (state.gameOver) break;
  }

  let maxPop = -1, dominant = null;
  for (const id of aiIds) {
    const pop = Object.values(state.regions[id].population).reduce((s,g) => s + g.count, 0);
    finalPopsByRegion[id].push(pop);
    if (pop > maxPop) { maxPop = pop; dominant = id; }
  }
  if (dominant) dominanceWins[dominant]++;

  const titleName = TITLES[state.titleIndex].name;
  playerTitles[titleName] = (playerTitles[titleName] || 0) + 1;
  if (state.gameOver === 'victory') playerVictories++;
}

console.log('=== KI-gegen-KI-Testsuite: ' + RUNS + ' Partien x ' + YEARS + ' Jahre (ohne Spielereingriff) ===');
console.log('');
console.log('--- Dominanz-Verteilung unter den KI-Regionen (bevölkerungsreichste je Partie) ---');
for (const id of aiIds) {
  const pct = (dominanceWins[id] / RUNS * 100).toFixed(1);
  console.log('  ' + id + ': ' + dominanceWins[id] + '/' + RUNS + ' (' + pct + '%)');
}
const maxDominancePct = Math.max(...aiIds.map(id => dominanceWins[id] / RUNS));
console.log('');
console.log('Höchste Dominanz-Häufigkeit einer einzelnen Region: ' + (maxDominancePct*100).toFixed(1) + '%');
console.log('(Erwartung bei fairer Balance: nahe 1/' + aiIds.length + ' = ' + (100/aiIds.length).toFixed(1) + '% pro Region,');
console.log(' deutliche Abweichung würde auf einen unbeabsichtigten Startvorteil hindeuten.)');

console.log('');
console.log('--- Spieler-Titelverteilung nach ' + YEARS + ' passiven Jahren ---');
for (const title in playerTitles) {
  console.log('  ' + title + ': ' + playerTitles[title] + '/' + RUNS);
}
console.log('Spieler-Siege (sollten bei rein passivem Spiel nahe 0 liegen): ' + playerVictories + '/' + RUNS);

let failures = [];
if (maxDominancePct > 0.5) {
  failures.push('Eine KI-Region dominiert in über 50% der Partien — mögliches Balancing-Problem (Startwerte/Fruchtbarkeit prüfen).');
}
if (playerVictories > RUNS * 0.05) {
  failures.push('Der Spieler gewinnt in über 5% der rein passiven Partien — Titelaufstieg/Kaiserwahl könnte zu leicht ohne Eingriff erreichbar sein.');
}

console.log('');
if (failures.length) {
  console.log('--- Auffaelligkeiten ---');
  failures.forEach(f => console.log(' - ' + f));
  process.exitCode = 1;
} else {
  console.log('Keine kritischen Auffaelligkeiten gefunden — keine Strategie/Region dominiert unangemessen.');
}
`;

eval(gamedata + "\n" + sim + "\n" + testBody);
