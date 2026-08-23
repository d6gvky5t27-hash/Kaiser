// Phase 4 "World Memory" — Regressionstests für das Erinnerungssystem
// (§Punkt 58/59). Ausführen mit: node tests/world_memory_test.js
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const gamedata = fs.readFileSync(path.join(ROOT, "data/gamedata.js"), "utf8");
const simModules = ["core", "economy", "population-dynasty", "memory", "characters", "story-threads", "drama-director", "event-chains", "chronicle", "politics", "diplomacy", "military", "debug", "war-map", "advance-year"];
const sim = simModules.map(m => fs.readFileSync(path.join(ROOT, "js", m + ".js"), "utf8")).join("\n");

const testBody = `
let failures = 0;
function check(label, cond) {
  if (cond) { console.log('  OK   ' + label); }
  else { console.log('  FAIL ' + label); failures++; }
}

// ---------- 1: Memory wird korrekt erzeugt ----------
console.log('--- Grunderzeugung ---');
(function() {
  const state = newGame({ seed: 10 });
  const before = Object.keys(state.memories.byId).length;
  const m = recordWorldEvent(state, {
    type: 'MARRIAGE', actorIds: ['c1'], targetIds: ['c2'],
    emotionalWeight: 40, description: 'Testheirat.',
  });
  check('Memory wurde in state.memories.byId abgelegt', state.memories.byId[m.id] === m);
  check('Zaehler ist um 1 gestiegen', Object.keys(state.memories.byId).length === before + 1);
  check('ID ist stabil/deterministisch (m-Praefix)', /^m\\d+$/.test(m.id));
  check('Jahr wird vom aktuellen Spielstand uebernommen', m.year === state.year);
})();

// ---------- 2: Teilnehmer korrekt ----------
console.log('--- Teilnehmer ---');
(function() {
  const state = newGame({ seed: 10 });
  const m = recordWorldEvent(state, { type: 'DENIED_OFFICE', actorIds: ['c1'], targetIds: ['c2'], emotionalWeight: -35 });
  check('actorIds korrekt', m.actorIds[0] === 'c1');
  check('targetIds korrekt', m.targetIds[0] === 'c2');
})();

// ---------- 3: Importance korrekt (Default aus MEMORY_TYPES, Override moeglich) ----------
console.log('--- Importance ---');
(function() {
  const state = newGame({ seed: 10 });
  const m1 = recordWorldEvent(state, { type: 'TITLE_GAINED', actorIds: ['c1'] });
  check('Default-Importance aus MEMORY_TYPES uebernommen', m1.importance === MEMORY_TYPES.TITLE_GAINED.importance);
  const m2 = recordWorldEvent(state, { type: 'TITLE_GAINED', actorIds: ['c1'], importance: 99 });
  check('Importance-Override wird respektiert', m2.importance === 99);
})();

// ---------- 4: Positive Memory ----------
console.log('--- Positive Memory ---');
(function() {
  const state = newGame({ seed: 10 });
  const m = recordWorldEvent(state, { type: 'MARRIAGE', actorIds: ['c1'], targetIds: ['c2'], emotionalWeight: 40 });
  check('emotionalWeight positiv gespeichert', m.emotionalWeight === 40);
  check('computeEffectiveWeight im Erzeugungsjahr = voller Wert', computeEffectiveWeight(state, m, 'c1') === 40);
})();

// ---------- 5: Negative Memory ----------
console.log('--- Negative Memory ---');
(function() {
  const state = newGame({ seed: 10 });
  const m = recordWorldEvent(state, { type: 'DENIED_OFFICE', actorIds: ['c1'], targetIds: ['c2'], emotionalWeight: -35 });
  check('emotionalWeight negativ gespeichert', m.emotionalWeight === -35);
  check('computeEffectiveWeight im Erzeugungsjahr = voller Wert', computeEffectiveWeight(state, m, 'c2') === -35);
})();

// ---------- 6: Decay funktioniert (nimmt mit der Zeit ab, ohne zu loeschen) ----------
console.log('--- Decay ---');
(function() {
  const state = newGame({ seed: 10 });
  const m = recordWorldEvent(state, { type: 'DENIED_OFFICE', actorIds: ['c1'], targetIds: ['c2'], emotionalWeight: -35, decayRate: 0.05 });
  const w0 = computeEffectiveWeight(state, m, 'c2');
  state.year += 10;
  const w10 = computeEffectiveWeight(state, m, 'c2');
  check('Betrag nimmt mit der Zeit ab', Math.abs(w10) < Math.abs(w0));
  check('Memory bleibt weiterhin in state.memories.byId (kein Loeschen)', !!state.memories.byId[m.id]);
  check('Vorzeichen bleibt erhalten (weiterhin negativ)', w10 < 0);
})();

// ---------- 7: Rachsuechtig veraendert den negativen Decay ----------
console.log('--- Trait: rachsuechtig ---');
(function() {
  const state = newGame({ seed: 10 });
  const c1 = createCharacter('m', 30, 'Test'); c1.traits = [];
  const c2 = createCharacter('m', 30, 'Test'); c2.traits = ['rachsuechtig'];
  state.characters['t1'] = c1; state.characters['t2'] = c2;
  const m1 = recordWorldEvent(state, { type: 'DENIED_OFFICE', actorIds: ['x'], targetIds: ['t1'], emotionalWeight: -35, decayRate: 0.05 });
  const m2 = recordWorldEvent(state, { type: 'DENIED_OFFICE', actorIds: ['x'], targetIds: ['t2'], emotionalWeight: -35, decayRate: 0.05 });
  state.year += 10;
  const wNormal = computeEffectiveWeight(state, m1, 't1');
  const wVengeful = computeEffectiveWeight(state, m2, 't2');
  check('rachsuechtig laesst negative Erinnerungen langsamer verblassen (Betrag bleibt hoeher)', Math.abs(wVengeful) > Math.abs(wNormal));
})();

// ---------- 8: Query-Funktionen ----------
console.log('--- Queries ---');
(function() {
  const state = newGame({ seed: 10 });
  recordWorldEvent(state, { type: 'MARRIAGE', actorIds: ['c1'], targetIds: ['c2'], emotionalWeight: 40 });
  state.year += 5;
  recordWorldEvent(state, { type: 'DENIED_OFFICE', actorIds: ['c3'], targetIds: ['c1'], emotionalWeight: -35 });
  recordWorldEvent(state, { type: 'TITLE_GAINED', actorIds: ['c4'], importance: 90 });

  check('getMemoriesForCharacter findet Erinnerungen als Actor und Target', getMemoriesForCharacter(state, 'c1').length === 2);
  check('getMemoriesBetweenCharacters findet gemeinsame Erinnerung', getMemoriesBetweenCharacters(state, 'c1', 'c3').length === 1);
  check('getMemoriesByType filtert korrekt', getMemoriesByType(state, 'MARRIAGE').length === 1);
  check('getRecentMemories liefert nur juengere Erinnerungen', getRecentMemories(state, 2).length === 2);
  check('getImportantMemories filtert nach Mindest-Bedeutsamkeit', getImportantMemories(state, 80).length === 1);
  check('hasMemory findet passenden Treffer', hasMemory(state, { type: 'DENIED_OFFICE', targetId: 'c1' }));
  check('hasMemory liefert false bei fehlendem Treffer', !hasMemory(state, { type: 'RULER_DIED', targetId: 'c1' }));
  check('Query-Funktionen mutieren state.memories nicht', Object.keys(state.memories.byId).length === 3);
})();

// ---------- 9: Save/Load erhaelt Memories ----------
console.log('--- Save/Load ---');
(function() {
  const state = newGame({ seed: 10 });
  recordWorldEvent(state, { type: 'MARRIAGE', actorIds: ['c1'], targetIds: ['c2'], emotionalWeight: 40, description: 'Testheirat.' });
  const json = serializeSave(state);
  const loaded = deserializeSave(json);
  check('Anzahl Memories bleibt erhalten', Object.keys(loaded.memories.byId).length === Object.keys(state.memories.byId).length);
  const restored = Object.values(loaded.memories.byId)[0];
  check('Inhalt bleibt erhalten', restored.type === 'MARRIAGE' && restored.description === 'Testheirat.');
  check('nextId bleibt erhalten (keine ID-Kollisionen nach Laden)', loaded.memories.nextId === state.memories.nextId);
})();

// ---------- 10: Migration v3 -> v4 ----------
console.log('--- Migration v3->v4 ---');
(function() {
  const state = newGame({ seed: 10 });
  const parsed = JSON.parse(serializeSave(state));
  delete parsed.state.memories;
  for (const id in parsed.state.characters) delete parsed.state.characters[id].rivalryOrigin;
  parsed.saveVersion = 3;
  const migrated = migrateSaveV3ToV4(parsed);
  check('saveVersion wird auf 4 gesetzt', migrated.saveVersion === 4);
  check('state.memories wird als LEERER Speicher angelegt (keine retroaktive Fiktion)', migrated.state.memories && Object.keys(migrated.state.memories.byId).length === 0);
  check('memories.nextId startet bei 1', migrated.state.memories.nextId === 1);
  let allHaveRivalryOrigin = true;
  for (const id in migrated.state.characters) if (!migrated.state.characters[id].rivalryOrigin) allHaveRivalryOrigin = false;
  check('rivalryOrigin wird bei allen Charakteren ergaenzt', allHaveRivalryOrigin);

  const fresh = JSON.parse(serializeSave(state));
  delete fresh.state.memories;
  for (const id in fresh.state.characters) delete fresh.state.characters[id].rivalryOrigin;
  fresh.saveVersion = 3;
  let threw = false;
  let loadedState = null;
  try { loadedState = deserializeSave(JSON.stringify(fresh)); } catch (e) { threw = true; }
  check('deserializeSave verkettet v3->v4 korrekt durch, ohne zu werfen', !threw && loadedState && loadedState.memories);
})();

// ---------- §Punkt 59: Beziehungsintegration — Beispielrechnung ----------
console.log('--- Beziehungsintegration (Beispiel §Punkt 59) ---');
(function() {
  const state = newGame({ seed: 10, year: 1500 });
  const normal = createCharacter('m', 30, 'Test'); normal.traits = [];
  const vengeful = createCharacter('m', 30, 'Test'); vengeful.traits = ['rachsuechtig'];
  state.characters['n1'] = normal; state.characters['v1'] = vengeful;

  state.year = 1510;
  recordWorldEvent(state, { type: 'DENIED_OFFICE', actorIds: ['ruler'], targetIds: ['n1'], emotionalWeight: -20, decayRate: MEMORY_TYPES.DENIED_OFFICE.decayRate });
  recordWorldEvent(state, { type: 'DENIED_OFFICE', actorIds: ['ruler'], targetIds: ['v1'], emotionalWeight: -20, decayRate: MEMORY_TYPES.DENIED_OFFICE.decayRate });

  state.year = 1520;
  const decayedNormal = getMemoriesForCharacter(state, 'n1').map(m => computeEffectiveWeight(state, m, 'n1'))[0];
  const decayedVengeful = getMemoriesForCharacter(state, 'v1').map(m => computeEffectiveWeight(state, m, 'v1'))[0];
  check('nach 10 Jahren ist der Betrag kleiner als die urspruenglichen -20', Math.abs(decayedNormal) < 20);
  check('rachsuechtiger Charakter behaelt einen staerkeren (negativeren) Effekt', decayedVengeful < decayedNormal);
})();

console.log('');
if (failures > 0) { console.log(failures + ' Test(s) fehlgeschlagen.'); process.exit(1); }
console.log('Alle World-Memory-Tests bestanden.');
`;

eval(gamedata + "\n" + sim + "\n" + testBody);
