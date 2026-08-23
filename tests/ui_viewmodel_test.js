// Phase 8B "Main Screen + Map + HUD" — Regressionstests für die neuen
// reinen Anzeige-ViewModels (§54-56/110-113). Zweck: sicherstellen, dass
// diese Funktionen NIE rnd() aufrufen (§56/120/121) und ausschließlich
// bereits reale, vorhandene state-Werte transformieren.
// Ausführen mit: node tests/ui_viewmodel_test.js
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const gamedata = fs.readFileSync(path.join(ROOT, "data/gamedata.js"), "utf8");
const simModules = [
  "core", "economy", "population-dynasty", "memory", "characters", "story-threads",
  "drama-director", "event-chains", "chronicle", "politics", "diplomacy", "military",
  "debug", "war-map", "advance-year",
];
const sim = simModules.map(m => fs.readFileSync(path.join(ROOT, "js", m + ".js"), "utf8")).join("\n");
const battleFiles = ["battle-engine/battle-data.js", "battle-engine/battle-engine.js", "battle-engine/battle-state-machine.js", "js/battle-bridge.js"];
const battle = battleFiles.map(f => fs.readFileSync(path.join(ROOT, f), "utf8")).join("\n");
const viewmodels = fs.readFileSync(path.join(ROOT, "js/ui-viewmodels.js"), "utf8");

const testBody = `
let failures = 0;
function check(label, cond) {
  if (cond) { console.log('  OK   ' + label); }
  else { console.log('  FAIL ' + label); failures++; }
}

// ---------- §56/120/121: keine ViewModel-Funktion darf rnd() verbrauchen ----------
console.log('--- RNG-Neutralitaet ---');
(function() {
  const state = newGame({ seed: 80 });
  for (let y = 0; y < 5; y++) { for (let m = 0; m < 12; m++) advanceMonth(state); resolvePendingEventWithPolicy(state, 'FIRST_OPTION'); }
  const before = __rngCalls;
  getHudViewModel(state);
  getWorldMapViewModel(state);
  for (const t of TERRITORIES) getRegionSummaryViewModel(state, t.id);
  getPrimaryStoryViewModel(state);
  getAlertViewModel(state);
  getYearTransitionViewModel(state);
  check('kein einziger rnd()-Aufruf durch die ViewModels', __rngCalls === before);
})();

// ---------- Determinismus: wiederholte Aufrufe liefern identisches Ergebnis ----------
console.log('--- Determinismus ---');
(function() {
  const state = newGame({ seed: 81 });
  const a1 = JSON.stringify(getHudViewModel(state));
  const a2 = JSON.stringify(getHudViewModel(state));
  check('getHudViewModel() ist deterministisch', a1 === a2);
  const b1 = JSON.stringify(getWorldMapViewModel(state));
  const b2 = JSON.stringify(getWorldMapViewModel(state));
  check('getWorldMapViewModel() ist deterministisch', b1 === b2);
})();

// ---------- getHudViewModel ----------
console.log('--- getHudViewModel ---');
(function() {
  const state = newGame({ seed: 82 });
  const hud = getHudViewModel(state);
  check('rulerName ist gesetzt und real (stimmt mit state.characters ueberein)', hud.rulerName === (state.characters[state.rulerId].name + ' ' + state.characters[state.rulerId].surname).trim());
  check('year stimmt mit state.year ueberein', hud.year === state.year);
  check('treasury ist gerundet', hud.treasury === Math.round(state.treasury));
  check('population stimmt mit der Summe der Bevoelkerungsgruppen ueberein', hud.population === Object.values(state.regions.player.population).reduce((s,g)=>s+g.count,0));
})();

// ---------- getWorldMapViewModel / getRegionSummaryViewModel ----------
console.log('--- Weltkarte + Kontextpanel ---');
(function() {
  const state = newGame({ seed: 83 });
  const map = getWorldMapViewModel(state);
  check('alle 16 Territorien sind enthalten', map.territories.length === TERRITORIES.length);
  check('jedes Territorium hat einen gueltigen Besitzer', map.territories.every(t => state.regions[t.ownerId]));
  check('Adjazenz-Linien werden erzeugt (mind. so viele wie eindeutige Kanten)', map.lines.length > 0);
  check('eigene Hauptstadt ist als Hauptstadt markiert', map.territories.find(t => t.id === 'p_hauptstadt').capital === true);

  const own = getRegionSummaryViewModel(state, 'p_hauptstadt');
  check('Kontextpanel fuer eigenes Gebiet: isPlayerTerritory', own.isPlayerTerritory === true);
  check('Bevoelkerung stimmt mit echten Regionsdaten ueberein', own.population === Object.values(state.regions.player.population).reduce((s,g)=>s+g.count,0));
  check('foodLabel ist einer von STABIL/KNAPP/KRITISCH', ['STABIL','KNAPP','KRITISCH'].includes(own.foodLabel));
  check('populationByGroup enthaelt alle Bevoelkerungsgruppen', own.populationByGroup.length === Object.keys(state.regions.player.population).length);

  const enemy = getRegionSummaryViewModel(state, 'm_hauptstadt');
  check('Kontextpanel fuer fremdes Gebiet: isPlayerTerritory false', enemy.isPlayerTerritory === false);
  check('fremdes Gebiet zeigt eine Garnisonsschaetzung statt echter Truppenzahlen', enemy.militaryStrength[0].id === 'garrison');

  check('unbekannte Territoriums-ID liefert null (keine erfundenen Daten)', getRegionSummaryViewModel(state, 'does_not_exist') === null);
})();

// ---------- getPrimaryStoryViewModel ----------
console.log('--- Story Card ---');
(function() {
  const state = newGame({ seed: 84 });
  const quiet = getPrimaryStoryViewModel(state);
  check('frisches Spiel ohne Threads: ruhige Jahre, keine erfundene Geschichte', quiet.hasFocus === false && quiet.quiet === true);

  const heirId = nextCharId();
  const c = createCharacter('m', 30, state.characters[state.rulerId].surname);
  c.parentId = state.rulerId;
  state.characters[heirId] = c;
  state.characters[state.rulerId].childrenIds.push(heirId);
  const thread = createStoryThread(state, 'SUCCESSION_CONFLICT', { actorIds: [heirId], regionIds: [], memoryIds: [], strength: 60 });
  state.drama.focusThreadId = thread.id;
  const withFocus = getPrimaryStoryViewModel(state);
  check('aktiver Fokus-Thread wird angezeigt', withFocus.hasFocus === true && withFocus.threadId === thread.id);
  check('Titel kommt direkt aus dem echten Thread', withFocus.title === thread.title);
  check('Stufentext ist natuerlichsprachlich, kein Debug-Wert (kein "STATUS=" o.ae.)', !withFocus.stageText.includes('=') && !/\\d/.test(withFocus.stageText));
})();

// ---------- getAlertViewModel ----------
console.log('--- Warnungen ---');
(function() {
  const state = newGame({ seed: 85 });
  const alertsQuiet = getAlertViewModel(state);
  check('Struktur enthaelt alle drei Prioritaetsstufen', Array.isArray(alertsQuiet.critical) && Array.isArray(alertsQuiet.important) && Array.isArray(alertsQuiet.info));

  state.regions.player.grainRatio = 0.3;
  const alertsFood = getAlertViewModel(state);
  check('kritische Hungerlage erzeugt eine KRITISCH-Warnung', alertsFood.critical.some(a => a.id === 'food_critical'));

  state.warState.ai1 = true;
  const alertsWar = getAlertViewModel(state);
  check('aktiver Krieg erzeugt eine KRITISCH-Warnung', alertsWar.critical.some(a => a.id === 'war_ai1'));

  state.treasury = -50;
  const alertsDebt = getAlertViewModel(state);
  check('negative Staatskasse erzeugt eine WICHTIG-Warnung', alertsDebt.important.some(a => a.id === 'treasury_low'));

  check('keine Warnung erwaehnt normales Wetter (kein Wetter-Spam, §17)', !JSON.stringify(alertsFood).includes('Wetter') && !JSON.stringify(alertsFood).includes('Ernteeinfluss'));
})();

// ---------- getYearTransitionViewModel ----------
console.log('--- Jahreswechsel-Hinweis ---');
(function() {
  const state = newGame({ seed: 86 });
  const vm1 = getYearTransitionViewModel(state);
  check('ohne offene Entscheidung: "keine dringenden Angelegenheiten"', vm1.pendingCount === 0 && vm1.pendingLabel.includes('Keine'));

  state.pendingElection = { bribed: {} };
  const vm2 = getYearTransitionViewModel(state);
  check('offene Kaiserwahl zaehlt als offene Entscheidung', vm2.pendingCount === 1);
})();

console.log('');
if (failures > 0) { console.log(failures + ' Test(s) fehlgeschlagen.'); process.exit(1); }
console.log('Alle UI-ViewModel-Tests bestanden.');
`;

eval(gamedata + "\n" + sim + "\n" + battle + "\n" + viewmodels + "\n" + testBody);
