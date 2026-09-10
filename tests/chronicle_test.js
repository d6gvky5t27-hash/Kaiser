// Phase 7 "Narrative Calibration & Chronicle 2.0" — Regressionstests für
// Importance 2.0, Resolution 2.0 und Chronicle 2.0 (§Punkt 86-89).
// Ausführen mit: node tests/chronicle_test.js
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const gamedata = fs.readFileSync(path.join(ROOT, "data/gamedata.js"), "utf8");
const simModules = ["core", "economy", "population-dynasty", "memory", "characters", "estates", "story-threads", "drama-director", "event-chains", "chronicle", "politics", "diplomacy", "military", "debug", "war-map", "advance-year"];
const sim = simModules.map(m => fs.readFileSync(path.join(ROOT, "js", m + ".js"), "utf8")).join("\n");

const testBody = `
let failures = 0;
function check(label, cond) {
  if (cond) { console.log('  OK   ' + label); }
  else { console.log('  FAIL ' + label); failures++; }
}

function makeChild(state, ruler) {
  const id = nextCharId();
  const c = createCharacter(ruler.gender === 'm' ? 'f' : 'm', 25, ruler.surname);
  c.parentId = state.rulerId;
  state.characters[id] = c;
  ruler.childrenIds.push(id);
  return id;
}

// ---------- §Punkt 2-7: Importance Breakdown ----------
console.log('--- Importance Breakdown (§2-7) ---');
(function() {
  const state = newGame({ seed: 60 });
  const ruler = state.characters[state.rulerId];
  const rivalId = makeChild(state, ruler);
  ruler.rivalIds.push(rivalId);
  state.characters[rivalId].rivalIds.push(state.rulerId);
  const thread = createStoryThread(state, 'PERSONAL_RIVALRY', { actorIds: [rivalId], regionIds: [], memoryIds: [], strength: 60 });
  const breakdown = explainThreadImportance(state, thread);
  check('Breakdown liefert Komponentenliste', Array.isArray(breakdown.components) && breakdown.components.length > 0);
  const sum = breakdown.components.reduce((s, c) => s + c.value, 0);
  check('Summe der Komponenten ergibt den Gesamtwert (nachvollziehbar, keine Blackbox)', Math.round(sum) === breakdown.total);
  check('Herrscher-Beteiligung wird als eigene Komponente erkannt (Rivalität mit dem Herrscher)', breakdown.components.some(c => c.label === 'Herrscher beteiligt'));
  check('Thread.importance stimmt mit der Breakdown-Summe überein', thread.importance === breakdown.total);
})();

// ---------- §8-14: Resolution Mapping ----------
console.log('--- Resolution Mapping (§8-14) ---');
(function() {
  const state = newGame({ seed: 61 });
  const heirId = makeChild(state, state.characters[state.rulerId]);
  const chain = startEventChain(state, 'passed_over_heir', { actorIds: [heirId], targetIds: [] });
  const thread = state.storyThreads.active[chain.threadId];
  resolveEventChain(state, chain, 'APPOINTED', 'Testauflösung.');
  const resolution = classifyThreadResolution(state, thread, 'NATURAL_END');
  const VALID_TYPES = ['RECONCILED','ESCALATED','SUPPRESSED','COMPROMISE','FAILED','SUCCESS','MARRIED','APPOINTED','EXILED','DIED','WAR','PEACE','ABANDONED','NATURAL_END'];
  const VALID_TONES = ['PEACEFUL','CONFLICT','TRAGIC','TRIUMPHANT','AMBIGUOUS'];
  check('Resolution-Typ liegt in der erlaubten Liste', VALID_TYPES.includes(resolution.type));
  check('Resolution-Tone liegt in der erlaubten Liste', VALID_TONES.includes(resolution.tone));
  check('Ein APPOINTED-Kettenausgang wird als APPOINTED/PEACEFUL klassifiziert (aus echten Chain-Daten)', resolution.type === 'APPOINTED' && resolution.tone === 'PEACEFUL');
  check('sourceChainIds referenziert die tatsächliche Kette', resolution.sourceChainIds.includes(chain.id));

  resolveStoryThread(state, thread, 'NATURAL_END');
  check('thread.resolution ist ein strukturiertes Objekt, kein String', typeof thread.resolution === 'object' && thread.resolution !== null);
  check('thread.resolution.year ist gesetzt', thread.resolution.year === state.year);
  check('Resolved Threads bleiben in der Historie (kein Löschen)', !!state.storyThreads.resolved[thread.id]);
})();

// ---------- §20/21: Always Chronicle ----------
console.log('--- Always Chronicle (§20/21) ---');
(function() {
  const state = newGame({ seed: 62 });
  const memory = recordWorldEvent(state, { type: 'RULER_DIED', actorIds: [state.rulerId], targetIds: [], emotionalWeight: -50, importance: 1 });
  const info = isChronicleWorthy(state, memory);
  check('RULER_DIED ist IMMER chronikwürdig, unabhängig vom Score', info.always === true && info.worthy === true);

  const alwaysTypes = ['RULER_DIED', 'SUCCESSION', 'HEIR_BORN', 'TITLE_GAINED', 'WAR_DECLARED', 'PEACE_SIGNED', 'DYNASTY_ENDED'];
  let allAlways = true;
  for (const t of alwaysTypes) if (!ALWAYS_CHRONICLE_MEMORY_TYPES.has(t)) allAlways = false;
  check('alle geforderten Always-Chronicle-Typen sind in der Liste enthalten', allAlways);
})();

// ---------- §19/22: Scored Chronicle ----------
console.log('--- Scored Chronicle (§19/22) ---');
(function() {
  const state = newGame({ seed: 63 });
  const marriageMem = recordWorldEvent(state, { type: 'MARRIAGE', actorIds: ['x1'], targetIds: ['x2'], emotionalWeight: 40 });
  const infoMarriage = isChronicleWorthy(state, marriageMem);
  check('MARRIAGE (Importance 55) überschreitet die Score-Schwelle auch ohne Always-Liste', infoMarriage.scored === true && infoMarriage.worthy === true);

  const childMem = recordWorldEvent(state, { type: 'CHILD_BORN', actorIds: ['x3', 'x4'], targetIds: ['x5'], emotionalWeight: 25 });
  const infoChild = isChronicleWorthy(state, childMem);
  check('CHILD_BORN eines unbeteiligten Charakters bleibt unter der Schwelle (nicht chronikwürdig)', infoChild.scored === false && infoChild.worthy === false);

  const rulerChildMem = recordWorldEvent(state, { type: 'DENIED_OFFICE', actorIds: [state.rulerId], targetIds: ['x6'], emotionalWeight: -35 });
  const infoRulerChild = isChronicleWorthy(state, rulerChildMem);
  check('DENIED_OFFICE mit Herrscherbeteiligung erreicht die Schwelle durch den Herrscher-Bonus', infoRulerChild.scored === true);
})();

// ---------- §18: Wetter ausgeschlossen ----------
console.log('--- Wetter ausgeschlossen (§18) ---');
(function() {
  const state = newGame({ seed: 64 });
  for (let y = 0; y < 5; y++) { for (let m = 0; m < 12; m++) advanceMonth(state); resolvePendingEventWithPolicy(state, 'FIRST_OPTION'); }
  const worldLogHasWeather = state.chronicle.some(line => line.includes('Ernteeinfluss'));
  check('Testaufbau: World Log enthält tatsächlich Wetterzeilen', worldLogHasWeather);
  const entries = computeDynastyChronicle(state);
  const dynastyChronicleHasWeather = entries.some(e => e.text.includes('Ernteeinfluss') || e.text.includes('herrschte'));
  check('Dynasty Chronicle enthält KEINE reinen Wetterzeilen', !dynastyChronicleHasWeather);
})();

// ---------- §68: echte Wetterkrise darf Teil der Chronik sein ----------
console.log('--- Wetterkrise mit echten Folgen (§68) ---');
(function() {
  const state = newGame({ seed: 65 });
  recordWorldEvent(state, { type: 'FAMINE', regionIds: ['player'], emotionalWeight: -60, metadata: { hungerDeaths: 42, region: 'Testland' }, description: 'Eine Hungerkrise in Testland forderte etwa 42 Menschenleben.' });
  const entries = computeDynastyChronicle(state);
  check('eine ECHTE Hungerkrise (mit Toten) erscheint in der Dynasty Chronicle', entries.some(e => e.category === 'KRISE' && e.text.includes('Hungerkrise')));
})();

// ---------- §21: Herrschertod ----------
console.log('--- Herrschertod in Chronik (§21) ---');
(function() {
  const state = newGame({ seed: 66 });
  recordWorldEvent(state, { type: 'RULER_DIED', actorIds: [state.rulerId], targetIds: [], emotionalWeight: -50, metadata: { age: 55 }, description: 'Testherrschertod.' });
  const entries = computeDynastyChronicle(state);
  check('Herrschertod erscheint in der Dynasty Chronicle', entries.some(e => e.category === 'DYNASTIE' && e.text === 'Testherrschertod.'));
})();

// ---------- §25-27: Thread Summary in Chronicle ----------
console.log('--- Thread Summary (§25-27) ---');
(function() {
  const state = newGame({ seed: 67 });
  const heirId = makeChild(state, state.characters[state.rulerId]);
  const mem = recordWorldEvent(state, { type: 'MARRIAGE', actorIds: [heirId], targetIds: [], emotionalWeight: 40, description: 'Testheirat für Dedup-Test.' });
  const thread = createStoryThread(state, 'DYNASTIC_ALLIANCE', { actorIds: [heirId], regionIds: [], memoryIds: [mem.id], strength: 60 });
  thread.importance = 60; // Testaufbau: über die Zusammenfassungs-Schwelle gesetzt
  resolveStoryThread(state, thread, 'NATURAL_END');
  const entries = computeDynastyChronicle(state);
  const threadEntry = entries.find(e => e.threadId === thread.id);
  check('eine bedeutsame, abgeschlossene Thread-Geschichte erzeugt einen Chronik-Eintrag', !!threadEntry);
  if (threadEntry) check('der Zusammenfassungstext basiert auf echter Thread-Historie (enthält Titel)', threadEntry.text.includes(thread.title.toUpperCase()));

  const dupMemoryEntry = entries.find(e => e.memoryIds && e.memoryIds.includes(mem.id) && e.threadId === null);
  check('§87/88 Dedup: die Memory hinter der zusammengefassten Geschichte erscheint NICHT zusätzlich einzeln', !dupMemoryEntry);
})();

// ---------- §28-33: Ruler Era Query ----------
console.log('--- Ruler Era Query (§28-33) ---');
(function() {
  const state = newGame({ seed: 68 });
  const oldRulerId = state.rulerId;
  const ruler = state.characters[oldRulerId];
  const heirId = makeChild(state, ruler);
  ruler.alive = false;
  state.year += 20;
  handleSuccession(state);
  const eras = getRulerEras(state);
  check('nach einer Nachfolge existieren zwei Ären', eras.length === 2);
  check('erste Ära gehört dem alten Herrscher', eras[0].rulerId === oldRulerId && eras[0].endYear === state.year);
  check('zweite/aktuelle Ära gehört dem neuen Herrscher (ohne Ende)', eras[1].rulerId === state.rulerId && eras[1].endYear === null);
  const chronForOld = getChronicleForRuler(state, oldRulerId);
  check('getChronicleForRuler liefert nur Einträge innerhalb der Ära (keine späteren Jahre)', chronForOld.every(e => e.year <= eras[0].endYear));
})();

// ---------- §59-61: Save Migration v6 -> v7 ----------
console.log('--- Save Migration v6->v7 (§59-61) ---');
(function() {
  const state = newGame({ seed: 69 });
  const heirId = makeChild(state, state.characters[state.rulerId]);
  const chain = startEventChain(state, 'passed_over_heir', { actorIds: [heirId], targetIds: [] });
  const thread = state.storyThreads.active[chain.threadId];
  resolveEventChain(state, chain, 'RECONCILED', 'Testauflösung.');
  resolveStoryThread(state, thread, 'NATURAL_END');
  const legacyLabel = thread.resolution.type; // bereits strukturiert; simuliert einen ALTEN Spielstand unten

  const parsed = JSON.parse(serializeSave(state));
  const legacyThreadId = thread.id;
  parsed.state.storyThreads.resolved[legacyThreadId].resolution = 'RECONCILED'; // wie in Phase 6: reiner String
  delete parsed.state.rulerEraSnapshots;
  parsed.saveVersion = 6;

  const migrated = migrateSaveV6ToV7(parsed);
  check('saveVersion wird auf 7 gesetzt', migrated.saveVersion === 7);
  const migratedThread = migrated.state.storyThreads.resolved[legacyThreadId];
  check('String-Resolution wird zu einem strukturierten Objekt migriert', typeof migratedThread.resolution === 'object');
  check('legacyLabel bewahrt den ursprünglichen String nachvollziehbar', migratedThread.resolution.legacyLabel === 'RECONCILED');
  check('rulerEraSnapshots wird als leeres Objekt angelegt (keine erfundene Historie, §75)', migrated.state.rulerEraSnapshots && Object.keys(migrated.state.rulerEraSnapshots).length === 0);

  let threw = false, loaded = null;
  const fresh = JSON.parse(serializeSave(state));
  fresh.state.storyThreads.resolved[legacyThreadId].resolution = 'RECONCILED';
  delete fresh.state.rulerEraSnapshots;
  fresh.saveVersion = 6;
  try { loaded = deserializeSave(JSON.stringify(fresh)); } catch (e) { threw = true; }
  check('deserializeSave verkettet v6->v7 korrekt durch, ohne zu werfen', !threw && loaded && typeof loaded.storyThreads.resolved[legacyThreadId].resolution === 'object');
})();

// ---------- §62: Determinismus ----------
console.log('--- Determinismus (§62) ---');
(function() {
  const state = newGame({ seed: 70 });
  for (let y = 0; y < 10; y++) { for (let m = 0; m < 12; m++) advanceMonth(state); resolvePendingEventWithPolicy(state, 'FIRST_OPTION'); }
  const callsBefore = __rngCalls;
  const a1 = JSON.stringify(computeDynastyChronicle(state));
  const a2 = JSON.stringify(computeDynastyChronicle(state));
  const b1 = JSON.stringify(computeDynastySummary(state));
  const b2 = JSON.stringify(computeDynastySummary(state));
  const c1 = JSON.stringify(computeDynastyMilestones(state));
  const c2 = JSON.stringify(computeDynastyMilestones(state));
  check('computeDynastyChronicle() verbraucht keinen RNG', __rngCalls === callsBefore);
  check('computeDynastyChronicle() liefert bei wiederholtem Aufruf ein identisches Ergebnis', a1 === a2);
  check('computeDynastySummary() liefert bei wiederholtem Aufruf ein identisches Ergebnis', b1 === b2);
  check('computeDynastyMilestones() liefert bei wiederholtem Aufruf ein identisches Ergebnis', c1 === c2);
})();

// ---------- Herrscherbiografie (§30/31/72-75) ----------
console.log('--- Herrscherbiografie ---');
(function() {
  const state = newGame({ seed: 71 });
  const oldRulerId = state.rulerId;
  const heirId = makeChild(state, state.characters[oldRulerId]);
  state.characters[oldRulerId].alive = false;
  state.year += 15;
  handleSuccession(state);
  const bio = buildRulerBiography(state, oldRulerId);
  check('Biografie wird für einen abgeschlossenen Herrscher erzeugt', !!bio && bio.reignEnd !== null);
  check('Bevölkerung-Vorher/Nachher basiert auf echten Snapshots (kein erfundener Wert)', bio.populationStart !== null && bio.populationEnd !== null);
  const text = formatRulerBiography(bio);
  check('formatRulerBiography() liefert lesbaren Text mit Regierungsjahren', text.includes('Regierte') && text.includes(String(bio.reignStart)));
})();

console.log('--- Phase 11: eigene STÄNDE-Kategorie ---');
(function() {
  const state = newGame({ seed: 72 });
  recordWorldEvent(state, { type: 'ESTATE_DEMAND_GRANTED', actorIds: [state.rulerId], targetIds: [], importance: 60, description: 'Testforderung des Adels gewährt.' });
  recordWorldEvent(state, { type: 'ESTATE_PRIVILEGE_GRANTED', actorIds: [state.rulerId], targetIds: [], description: 'Testprivileg gewährt.' });
  check('chronicleCategoryForMemoryType() gibt STÄNDE für Stände-Memory-Typen zurück', chronicleCategoryForMemoryType('ESTATE_DEMAND_GRANTED') === 'STÄNDE');
  check('chronicleCategoryForMemoryType() gibt STÄNDE auch für ESTATE_PRIVILEGE_GRANTED zurück', chronicleCategoryForMemoryType('ESTATE_PRIVILEGE_GRANTED') === 'STÄNDE');
  const entries = computeDynastyChronicle(state);
  check('eine bedeutsame Stände-Forderung erscheint mit Kategorie STÄNDE in der Dynasty Chronicle', entries.some(e => e.category === 'STÄNDE' && e.text.includes('Testforderung')));
})();

console.log('');
if (failures > 0) { console.log(failures + ' Test(s) fehlgeschlagen.'); process.exit(1); }
console.log('Alle Chronicle-2.0-Tests bestanden.');
`;

eval(gamedata + "\n" + sim + "\n" + testBody);
