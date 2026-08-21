// Determinismus-/Snapshot-Regressionstest für advanceYear() (ursprünglich
// Phase 2: Technical Stabilization). Zweck: bei identischem Seed muss der
// simulierte Zustand JAHR FÜR JAHR identisch bleiben, unabhängig davon,
// wie advanceYear() intern strukturiert ist (Extract-Method-Refactorings
// dürfen daran nichts ändern). Dieser Test bleibt dauerhaft im Projekt —
// jede künftige Änderung kann damit sofort erkennen, ob sich
// Simulationsergebnisse ungewollt verschoben haben.
//
// PHASE 3 CHARACTER CORE BASELINE (§Punkt 91): Phase 3 hat bewusst neue
// RNG-Aufrufe hinzugefügt (Charaktere bekommen 2 zusätzliche Skill-Würfe
// für finanzen/intrige — bereits beim allerersten Charakter in newGame(),
// daher verschiebt sich der GESAMTE nachfolgende Zufallsstrom). Das
// Golden-Fixture wurde daher nach Phase 3 neu erzeugt (§Punkt 47/48 des
// Phase-3-Auftrags erlaubt das ausdrücklich). Das alte, aus Phase 2
// stammende Fixture wurde NICHT gelöscht, sondern versioniert unter
// `tests/fixtures/advance_year_snapshot_golden_phase2.json` archiviert.
//
// Nutzung:
//   node tests/advance_year_snapshot_test.js            vergleicht gegen
//                                                        das gespeicherte
//                                                        Golden-Fixture
//   node tests/advance_year_snapshot_test.js --update    schreibt das
//                                                        Golden-Fixture neu
//                                                        (nur bewusst nach
//                                                        einer geprüften,
//                                                        beabsichtigten
//                                                        Verhaltensänderung
//                                                        verwenden!)
//
// Erfasst pro Jahr genau die in der Phase-2-Anweisung geforderten Felder:
// Jahr, RNG-Aufrufzähler, Staatskasse, Bevölkerung (gesamt + je Gruppe),
// Warenpreise, Dynastiestatus (Herrscher/Ehepartner/Kinder), Prestige,
// Legitimität, Kriege, Beziehungen, Chronik (vollständig, als zusätzlicher
// RNG-Fingerprint — abweichende Ereignis-/Wettertexte verraten eine
// verschobene RNG-Reihenfolge sofort), Game-Over-Zustand.
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const FIXTURE_PATH = path.join(__dirname, "fixtures", "advance_year_snapshot_golden.json");
const SEEDS = [101, 202, 303]; // Seed A, B, C
const MAX_YEARS = 100;

const gamedata = fs.readFileSync(path.join(ROOT, "data/gamedata.js"), "utf8");
const simModules = ["core", "economy", "population-dynasty", "characters", "politics", "diplomacy", "military", "debug", "war-map", "advance-year"];
const sim = simModules.map(m => fs.readFileSync(path.join(ROOT, "js", m + ".js"), "utf8")).join("\n");

const testBody = `
function snapshotYear(state) {
  const r = state.regions.player;
  const totalPop = Object.values(r.population).reduce((s, g) => s + g.count, 0);
  const popByGroup = {};
  for (const pid in r.population) popByGroup[pid] = r.population[pid].count;
  const ruler = state.characters[state.rulerId];
  const relations = {};
  for (const aiId in state.diplomacy) relations[aiId] = state.diplomacy[aiId].relation;
  return {
    year: state.year,
    rngCalls: __rngCalls,
    treasury: state.treasury,
    totalPopulation: totalPop,
    populationByGroup: popByGroup,
    prices: r.prices || {},
    rulerName: ruler ? (ruler.name + " " + ruler.surname) : null,
    rulerAge: ruler ? ruler.age : null,
    rulerAlive: ruler ? ruler.alive : null,
    spouseId: ruler ? (ruler.spouseId || null) : null,
    childrenCount: ruler ? ruler.childrenIds.length : null,
    prestige: state.prestige,
    legitimacy: state.legitimacy,
    warsWon: state.stats.warsWon,
    warsLost: state.stats.warsLost,
    relations: relations,
    chronicle: state.chronicle.slice(),
    gameOver: state.gameOver,
  };
}

function runSeed(seed) {
  const state = newGame({ seed });
  const years = [];
  for (let y = 0; y < ${MAX_YEARS}; y++) {
    let yearCompleted = false;
    for (let m = 0; m < 12; m++) {
      const res = advanceMonth(state);
      yearCompleted = res.yearCompleted;
      if (state.gameOver) break;
    }
    years.push(snapshotYear(state));
    if (state.gameOver) break;
  }
  return years;
}

const result = {};
for (const seed of ${JSON.stringify(SEEDS)}) {
  result["seed_" + seed] = runSeed(seed);
}
globalThis.__SNAPSHOT_RESULT__ = result;
`;

eval(gamedata + "\n" + sim + "\n" + testBody);
const result = globalThis.__SNAPSHOT_RESULT__;

const updateMode = process.argv.includes("--update");

if (updateMode) {
  fs.mkdirSync(path.dirname(FIXTURE_PATH), { recursive: true });
  fs.writeFileSync(FIXTURE_PATH, JSON.stringify(result, null, 2) + "\n");
  console.log("Golden-Fixture geschrieben: " + FIXTURE_PATH);
  for (const key in result) console.log("  " + key + ": " + result[key].length + " Jahre simuliert");
  process.exit(0);
}

if (!fs.existsSync(FIXTURE_PATH)) {
  console.error("Kein Golden-Fixture gefunden unter " + FIXTURE_PATH + ".");
  console.error("Zuerst mit --update erzeugen (nur bewusst, als Referenzstand).");
  process.exit(1);
}

const golden = JSON.parse(fs.readFileSync(FIXTURE_PATH, "utf8"));
let anyDivergence = false;

for (const seedKey in golden) {
  const goldenYears = golden[seedKey];
  const actualYears = result[seedKey];
  if (!actualYears) {
    console.error(seedKey + ": FEHLT im aktuellen Lauf (Golden hat ihn).");
    anyDivergence = true;
    continue;
  }
  const maxLen = Math.max(goldenYears.length, actualYears.length);
  let divergedAt = -1;
  let divergedField = null;
  for (let i = 0; i < maxLen; i++) {
    const g = goldenYears[i];
    const a = actualYears[i];
    if (!g || !a) { divergedAt = i; divergedField = !g ? "(golden hat kein Jahr mehr)" : "(aktueller Lauf hat kein Jahr mehr)"; break; }
    const gStr = JSON.stringify(g);
    const aStr = JSON.stringify(a);
    if (gStr !== aStr) {
      divergedAt = i;
      // erstes abweichendes Feld ermitteln
      const keys = Object.keys(g);
      for (const k of keys) {
        if (JSON.stringify(g[k]) !== JSON.stringify(a[k])) { divergedField = k; break; }
      }
      break;
    }
  }
  if (divergedAt === -1) {
    console.log(seedKey + ": IDENTISCH ueber " + goldenYears.length + " simulierte Jahre.");
  } else {
    anyDivergence = true;
    const gy = goldenYears[divergedAt] ? goldenYears[divergedAt].year : "?";
    console.error(seedKey + ": ABWEICHUNG ab Index " + divergedAt + " (Spieljahr " + gy + "), Feld: " + divergedField);
    console.error("  golden: " + JSON.stringify(goldenYears[divergedAt] ? goldenYears[divergedAt][divergedField] : undefined));
    console.error("  aktuell: " + JSON.stringify(actualYears[divergedAt] ? actualYears[divergedAt][divergedField] : undefined));
  }
}

if (anyDivergence) {
  console.error("\nDETERMINISMUS-TEST FEHLGESCHLAGEN — nicht weitermachen, Ursache beheben.");
  process.exitCode = 1;
} else {
  console.log("\nDeterminismus-Test bestanden: alle " + Object.keys(golden).length + " Seeds liefern jahrgenau identische Zustaende.");
}
