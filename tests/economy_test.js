// Automatisierter Wirtschaftstest (§77 der Spec)
// Ausführen mit: node tests/economy_test.js
const fs = require("fs");
const path = require("path");

const gamedata = fs.readFileSync(path.join(__dirname, "..", "data/gamedata.js"), "utf8");
const simModules = ["core", "economy", "population-dynasty", "politics", "diplomacy", "military", "debug", "advance-year"];
const sim = simModules.map(m => fs.readFileSync(path.join(__dirname, "..", "js", m + ".js"), "utf8")).join("\n");

const testBody = `
const RUNS = 20;
const YEARS = 100;
let failures = [];
let priceExplosions = 0, popCollapses = 0, ranToCompletion = 0;
let finalPops = [], finalTreasuries = [];

for (let run = 0; run < RUNS; run++) {
  const state = newGame();
  let years = 0;
  for (; years < YEARS; years++) {
    for (let m = 0; m < 12; m++) { advanceMonth(state); if (state.gameOver) break; } // Monatstakt: 12x advanceMonth() = 1 Jahr, inkl. monatlicher Finanzen
    if (state.gameOver) break;
  }
  const r = state.regions.player;
  const totalPop = Object.values(r.population).reduce((s, g) => s + g.count, 0);
  const prices = r.prices || {};
  const priceRatios = Object.keys(GOODS).map(g => prices[g] / GOODS[g].base);
  const maxRatio = Math.max(...priceRatios);

  if (maxRatio >= CONFIG.economy.priceMax * 0.98) {
    priceExplosions++;
    failures.push('Run ' + run + ': Preis nahe Obergrenze (ratio ' + maxRatio.toFixed(2) + ') nach ' + years + ' Jahren');
  }
  if (totalPop < 100 && !state.gameOver) {
    popCollapses++;
    failures.push('Run ' + run + ': Bevölkerung fast null (' + totalPop + ') ohne Game-Over-Flag');
  }
  if (!state.gameOver) ranToCompletion++;
  finalPops.push(totalPop);
  finalTreasuries.push(state.treasury);
}

console.log('=== Wirtschaftstest: ' + RUNS + ' Partien x ' + YEARS + ' Jahre ===');
console.log('Vollstaendig durchgelaufen (kein Game Over): ' + ranToCompletion + '/' + RUNS);
console.log('Preise nahe Obergrenze:                     ' + priceExplosions + '/' + RUNS);
console.log('Bevoelkerungskollaps ohne Game-Over:         ' + popCollapses + '/' + RUNS);
console.log('Bevoelkerung (Ende) min/avg/max: ' + Math.min(...finalPops) + ' / ' + Math.round(finalPops.reduce((a,b)=>a+b,0)/RUNS) + ' / ' + Math.max(...finalPops));
console.log('Staatskasse (Ende) min/avg/max: ' + Math.round(Math.min(...finalTreasuries)) + ' / ' + Math.round(finalTreasuries.reduce((a,b)=>a+b,0)/RUNS) + ' / ' + Math.round(Math.max(...finalTreasuries)));

if (failures.length) {
  console.log('');
  console.log('--- Auffaelligkeiten ---');
  failures.forEach(f => console.log(' - ' + f));
  process.exitCode = 1;
} else {
  console.log('');
  console.log('Keine kritischen Auffaelligkeiten gefunden.');
}
`;

eval(gamedata + "\n" + sim + "\n" + testBody);
