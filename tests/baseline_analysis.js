// Baseline-Analyse (Phase 1 des KAISERREICH-NEXT-GENERATION-Master-Prompts,
// Punkt 4 "Backup/Sicherheit"): erfasst reproduzierbare Referenzwerte für rein
// passives Spiel (keine Spielereingriffe, wie in economy_test.js/ai_vs_ai_test.js),
// damit spätere Änderungen objektiv damit verglichen werden können.
//
// Anders als economy_test.js/ai_vs_ai_test.js verwendet dieses Skript FESTE
// Seeds (0..RUNS-1) statt generateFreshSeed() — die bestehenden Testdateien
// sind dadurch bei jedem Lauf unterschiedlich (echte Zufallszahl als Seed),
// was für eine Baseline ungeeignet ist. Rein additiv, verändert kein
// Gameplay-Modul.
//
// Ausführen mit: node tests/baseline_analysis.js
const fs = require("fs");
const path = require("path");

const gamedata = fs.readFileSync(path.join(__dirname, "..", "data/gamedata.js"), "utf8");
const simModules = ["core", "economy", "population-dynasty", "memory", "characters", "story-threads", "drama-director", "event-chains", "politics", "diplomacy", "military", "debug", "war-map", "advance-year"];
const sim = simModules.map(m => fs.readFileSync(path.join(__dirname, "..", "js", m + ".js"), "utf8")).join("\n");

const testBody = `
const RUNS = 30;
const YEARS = 100;

const finalPops = [], finalTreasuries = [], warsWon = [], warsLost = [], generations = [], disasters = [], highestTitles = [];
const gameOverReasons = {};
let electionsTriggered = 0;
const priceCeilingHits = {}; // je Ware, wie oft nahe der Preisobergrenze
for (const gid in GOODS) priceCeilingHits[gid] = 0;
let birthsTotal = 0, deathsTotalNatural = 0, deathsTotalHunger = 0, deathsTotalPlague = 0;

for (let run = 0; run < RUNS; run++) {
  const state = newGame({ seed: run }); // fester Seed: reproduzierbare Baseline
  for (let y = 0; y < YEARS; y++) {
    for (let m = 0; m < 12; m++) { advanceMonth(state); resolvePendingEventWithPolicy(state, "FIRST_OPTION"); if (state.gameOver) break; }
    if (state.gameOver) break;
    if (state.pendingElection) electionsTriggered++; // wurde in reinem Passivspiel je eine Wahl ausgeloest?
  }
  const r = state.regions.player;
  const totalPop = Object.values(r.population).reduce((s, g) => s + g.count, 0);
  finalPops.push(totalPop);
  finalTreasuries.push(state.treasury);
  warsWon.push(state.stats.warsWon || 0);
  warsLost.push(state.stats.warsLost || 0);
  generations.push(state.stats.generations || 1);
  disasters.push(state.stats.disastersCount || 0);
  highestTitles.push(TITLES[state.stats.highestTitleIndex || 0].name);
  gameOverReasons[state.gameOver || "kein Game Over (100 Jahre erreicht)"] = (gameOverReasons[state.gameOver || "kein Game Over (100 Jahre erreicht)"] || 0) + 1;

  const prices = r.prices || {};
  for (const gid in GOODS) {
    const ratio = (prices[gid] || 0) / GOODS[gid].base;
    if (ratio >= CONFIG.economy.priceMax * 0.9) priceCeilingHits[gid]++;
  }

  // letzte bekannte Bevoelkerungsaufschluesselung (Ursachen) dieses Laufs aufsummieren
  if (r.lastPopBreakdown) {
    for (const pid in r.lastPopBreakdown) {
      const b = r.lastPopBreakdown[pid];
      birthsTotal += b.geburten || 0;
      deathsTotalNatural += -(b.alterstod || 0);
      deathsTotalHunger += -(b.hungertote || 0);
      deathsTotalPlague += -(b.seuchentote || 0);
    }
  }
}

const avg = arr => Math.round(arr.reduce((a,b)=>a+b,0) / arr.length);
const titleCounts = {};
for (const t of highestTitles) titleCounts[t] = (titleCounts[t] || 0) + 1;

console.log('=== BASELINE (Phase 1) — ' + RUNS + ' Partien x ' + YEARS + ' Jahre, feste Seeds 0..' + (RUNS-1) + ', keine Spielereingriffe ===');
console.log('');
console.log('Bevoelkerung (Ende) min/avg/max: ' + Math.min(...finalPops) + ' / ' + avg(finalPops) + ' / ' + Math.max(...finalPops));
console.log('Staatskasse (Ende)  min/avg/max: ' + Math.min(...finalTreasuries) + ' / ' + avg(finalTreasuries) + ' / ' + Math.max(...finalTreasuries));
console.log('Kriege gewonnen     min/avg/max: ' + Math.min(...warsWon) + ' / ' + (warsWon.reduce((a,b)=>a+b,0)/RUNS).toFixed(2) + ' / ' + Math.max(...warsWon));
console.log('Kriege verloren     min/avg/max: ' + Math.min(...warsLost) + ' / ' + (warsLost.reduce((a,b)=>a+b,0)/RUNS).toFixed(2) + ' / ' + Math.max(...warsLost));
console.log('Generationen (Dynastiewechsel) min/avg/max: ' + Math.min(...generations) + ' / ' + (generations.reduce((a,b)=>a+b,0)/RUNS).toFixed(2) + ' / ' + Math.max(...generations));
console.log('Katastrophen-Ereignisse min/avg/max: ' + Math.min(...disasters) + ' / ' + (disasters.reduce((a,b)=>a+b,0)/RUNS).toFixed(2) + ' / ' + Math.max(...disasters));
console.log('');
console.log('--- Hoechster erreichter Titel (nach 100 Jahren bzw. bei Game Over) ---');
for (const t in titleCounts) console.log('  ' + t + ': ' + titleCounts[t] + '/' + RUNS);
console.log('');
console.log('--- Game-Over-Gruende ---');
for (const reason in gameOverReasons) console.log('  ' + reason + ': ' + gameOverReasons[reason] + '/' + RUNS);
console.log('');
console.log('--- Kaiserwahlen ausgeloest (rein passiv) ---');
console.log('  ' + electionsTriggered + ' von ' + RUNS + ' Partien');
console.log('');
console.log('--- Waren nahe der Preisobergrenze (>=90% von priceMax), Haeufigkeit ueber alle Laeufe ---');
const sortedGoods = Object.keys(priceCeilingHits).filter(g => priceCeilingHits[g] > 0).sort((a,b) => priceCeilingHits[b]-priceCeilingHits[a]);
if (sortedGoods.length === 0) console.log('  keine');
else sortedGoods.forEach(g => console.log('  ' + g + ': ' + priceCeilingHits[g] + '/' + RUNS));
console.log('');
console.log('--- Bevoelkerungs-Todesursachen (letztes simuliertes Jahr aller Laeufe, aufsummiert) ---');
console.log('  Geburten gesamt: ' + birthsTotal);
console.log('  Alterstod gesamt: ' + deathsTotalNatural + ' (' + (100*deathsTotalNatural/(deathsTotalNatural+deathsTotalHunger+deathsTotalPlague)).toFixed(1) + '%)');
console.log('  Hungertod gesamt: ' + deathsTotalHunger + ' (' + (100*deathsTotalHunger/(deathsTotalNatural+deathsTotalHunger+deathsTotalPlague)).toFixed(1) + '%)');
console.log('  Seuchentod gesamt: ' + deathsTotalPlague + ' (' + (100*deathsTotalPlague/(deathsTotalNatural+deathsTotalHunger+deathsTotalPlague)).toFixed(1) + '%)');
console.log('  Hinweis: Herrschertod selbst kennt aktuell keine unterscheidbaren Ursachen');
console.log('  (nur alters-/gesundheitsbasierte Sterbewahrscheinlichkeit in updateDynasty(),');
console.log('  siehe CODE_AUDIT.md) — nur die Bevoelkerungsebene unterscheidet Alter/Hunger/Seuche.');
`;

eval(gamedata + "\n" + sim + "\n" + testBody);
