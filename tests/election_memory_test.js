// Phase 12 "Imperial Politics" — Regressionstests für die World-Memory-
// Integration der Kaiserwahl (js/imperial-politics.js + die Phase-12-
// Ergänzungen in data/gamedata.js MEMORY_TYPES): welcher Vorgang erzeugt
// welche Memory mit welcher Actor/Target-Zuordnung, Wiederverwendung
// bestehender Typen (TITLE_GAINED/ELECTION_SUPPORT_GIVEN/
// ELECTION_PROMISE_BROKEN) statt Dopplung, und dass die bestehende
// Trait-Verfallsmodulation (computeEffectiveWeight, rachsüchtig/
// barmherzig/loyal) ohne jeden neuen Trait-Code auf die neuen Kaiserwahl-
// Memories wirkt (die zentrale Wiederverwendungs-Behauptung des Moduls).
// Ausführen mit: node tests/election_memory_test.js
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const gamedata = fs.readFileSync(path.join(ROOT, "data/gamedata.js"), "utf8");
const simModules = ["core", "economy", "population-dynasty", "memory", "characters", "estates", "imperial-politics", "story-threads", "drama-director", "event-chains", "chronicle", "politics", "diplomacy", "military", "debug", "war-map", "advance-year"];
const sim = simModules.map(m => fs.readFileSync(path.join(ROOT, "js", m + ".js"), "utf8")).join("\n");

const testBody = `
let failures = 0;
function check(label, cond) {
  if (cond) { console.log('  OK   ' + label); }
  else { console.log('  FAIL ' + label); failures++; }
}

function setupCandidacy(seed) {
  const state = newGame({ seed });
  state.titleIndex = TITLES.findIndex(t => t.id === 'kurfuerst');
  state.regions.player.buildings.push({ type: 'kathedrale', level: 1, plotIndex: -1 });
  const res = declareImperialCandidacy(state);
  if (!res.ok) throw new Error('setupCandidacy fehlgeschlagen: ' + res.reason);
  return state;
}

// ---------- MEMORY_TYPES-Konfiguration ----------
console.log('--- MEMORY_TYPES-Konfiguration ---');
(function() {
  check('IMPERIAL_CANDIDACY_DECLARED ist konfiguriert', !!MEMORY_TYPES.IMPERIAL_CANDIDACY_DECLARED);
  check('ELECTION_PROMISE_MADE ist konfiguriert', !!MEMORY_TYPES.ELECTION_PROMISE_MADE);
  check('ELECTION_PROMISE_FULFILLED ist konfiguriert', !!MEMORY_TYPES.ELECTION_PROMISE_FULFILLED);
  check('IMPERIAL_ELECTION_LOST ist konfiguriert', !!MEMORY_TYPES.IMPERIAL_ELECTION_LOST);
  check('ELECTION_SUPPORT_GIVEN wird wiederverwendet, kein Duplikat-Typ', !!MEMORY_TYPES.ELECTION_SUPPORT_GIVEN);
  check('ELECTION_PROMISE_BROKEN wird wiederverwendet, kein Duplikat-Typ', !!MEMORY_TYPES.ELECTION_PROMISE_BROKEN);
  check('TITLE_GAINED wird fuer den Wahlsieg wiederverwendet, kein neuer Sieg-Typ', !!MEMORY_TYPES.TITLE_GAINED);
  check('kein toter ELECTOR_PLEDGED_SUPPORT-Typ (nie tatsaechlich ausgeloest, entfernt)', MEMORY_TYPES.ELECTOR_PLEDGED_SUPPORT === undefined);
  check('ELECTION_PROMISE_MADE/FULFILLED sind personenbezogen (target_to_actor), keine direction:none', MEMORY_TYPES.ELECTION_PROMISE_MADE.direction === 'target_to_actor' && MEMORY_TYPES.ELECTION_PROMISE_FULFILLED.direction === 'target_to_actor');
  check('IMPERIAL_CANDIDACY_DECLARED betrifft das ganze Reich (direction:none), keine Einzelbeziehung', MEMORY_TYPES.IMPERIAL_CANDIDACY_DECLARED.direction === 'none');
})();

// ---------- declareImperialCandidacy() ----------
console.log('--- declareImperialCandidacy(): Memory ---');
(function() {
  const state = setupCandidacy(1);
  const mem = Object.values(state.memories.byId).find(m => m.type === 'IMPERIAL_CANDIDACY_DECLARED');
  check('eine IMPERIAL_CANDIDACY_DECLARED-Memory wurde erzeugt', !!mem);
  check('actorIds enthaelt den Spieler-Herrscher', mem.actorIds.includes(state.rulerId));
  check('targetIds ist leer (kein Einzeladressat)', mem.targetIds.length === 0);
})();

// ---------- createElectionPromise() ----------
console.log('--- createElectionPromise(): Memory + Beziehungswirkung ---');
(function() {
  const state = setupCandidacy(2);
  const electorRulerId = state.regions.ai1.rulerId;
  const relBefore = computeRelationshipBreakdown(state, electorRulerId, state.rulerId).total;
  const { promiseId } = createElectionPromise(state, 'ai1', 'no_war_target', { targetRegionId: 'ai2' });
  const mem = Object.values(state.memories.byId).find(m => m.type === 'ELECTION_PROMISE_MADE' && m.metadata.promiseId === promiseId);
  check('eine ELECTION_PROMISE_MADE-Memory wurde erzeugt', !!mem);
  check('actorIds ist der Spieler-Herrscher, targetIds der Elector-Herrscher', mem.actorIds[0] === state.rulerId && mem.targetIds[0] === electorRulerId);
  const relAfter = computeRelationshipBreakdown(state, electorRulerId, state.rulerId).total;
  check('das gegebene Versprechen fliesst automatisch in computeRelationshipBreakdown(Elector -> Spieler) ein (target_to_actor, kein Sondercode noetig)', relAfter !== relBefore);
})();

// ---------- fulfillElectionPromise() ----------
console.log('--- fulfillElectionPromise(): Memory ---');
(function() {
  const state = setupCandidacy(3);
  const { promiseId } = createElectionPromise(state, 'ai1', 'pay_tribute', { amount: 50 });
  fulfillElectionPromise(state, promiseId);
  const mem = Object.values(state.memories.byId).find(m => m.type === 'ELECTION_PROMISE_FULFILLED' && m.metadata.promiseId === promiseId);
  check('eine ELECTION_PROMISE_FULFILLED-Memory wurde erzeugt', !!mem);
  check('emotionalWeight ist positiv (Dankbarkeit, kein neutrales Ereignis)', mem.emotionalWeight > 0);
})();

// ---------- breakElectionPromise(): bestehenden Typ wiederverwenden ----------
console.log('--- breakElectionPromise(): bestehender Memory-Typ ---');
(function() {
  const state = setupCandidacy(4);
  const { promiseId } = createElectionPromise(state, 'ai1', 'no_war_target', { targetRegionId: 'ai2' });
  breakElectionPromise(state, promiseId, 'Test');
  const mem = Object.values(state.memories.byId).find(m => m.type === 'ELECTION_PROMISE_BROKEN' && m.metadata.promiseId === promiseId);
  check('eine ELECTION_PROMISE_BROKEN-Memory wurde erzeugt (bestehender Phase-4/5-Typ, nicht dupliziert)', !!mem);
  check('emotionalWeight ist deutlich negativ (Vertrauensbruch)', mem.emotionalWeight < 0);
  check('direction:none -- fliesst bewusst NICHT ueber computeRelationshipBreakdown ein, sondern direkt in den Elector-Score (s. js/imperial-politics.js)', MEMORY_TYPES.ELECTION_PROMISE_BROKEN.direction === 'none');
})();

// ---------- resolveImperialElection(): Sieg ----------
console.log('--- resolveImperialElection(): Sieg ---');
(function() {
  const state = setupCandidacy(5);
  // Alle Electors klar positiv stimmen, damit ein Sieg garantiert ist (§93-98: deterministisch bei gleichem Zustand).
  for (const aiId of getElectorIds(state)) state.diplomacy[aiId].relation = 100;
  state.prestige = 500; state.legitimacy = 100;
  state.year += CONFIG.election.candidacyPrepYearsMax;
  checkImperialElectionTiming(state);
  check('Wahl steht an', state.pendingElection === true);
  const res = resolveImperialElection(state);
  check('Wahl gewonnen', res.ok === true && res.won === true);
  const titleMem = Object.values(state.memories.byId).find(m => m.type === 'TITLE_GAINED' && m.metadata.titleId === 'kaiser');
  check('TITLE_GAINED (kaiser) wird wiederverwendet statt eines neuen Sieg-Typs', !!titleMem && titleMem.importance === 100);
  const supportMems = Object.values(state.memories.byId).filter(m => m.type === 'ELECTION_SUPPORT_GIVEN');
  check('pro unterstuetzendem Elector eine ELECTION_SUPPORT_GIVEN-Memory (bestehender Typ)', supportMems.length === res.perElectorResult.filter(r => r.votedFor === state.rulerId).length && supportMems.length > 0);
})();

// ---------- resolveImperialElection(): Niederlage ----------
console.log('--- resolveImperialElection(): Niederlage ---');
(function() {
  const state = setupCandidacy(6);
  // Ein unopponierter Kandidat gewinnt jede Stimme trivial (nichts, wogegen
  // die Kurfuersten abwaegen koennten) -- fuer eine ECHTE Niederlage braucht
  // es einen tatsaechlichen Gegenkandidaten. Direkt gesetzt statt ueber
  // Jahrzehnte simuliert (dieselbe Isolationstechnik wie setupCandidacy()
  // fuer die Spieler-Eignung).
  state.imperialCandidacy.rivalCandidateIds = [state.regions.ai1.rulerId];
  // Alle Electors klar negativ gegenueber dem Spieler, damit eine Niederlage garantiert ist.
  for (const aiId of getElectorIds(state)) state.diplomacy[aiId].relation = -100;
  state.prestige = 0; state.legitimacy = 0;
  state.year += CONFIG.election.candidacyPrepYearsMax;
  checkImperialElectionTiming(state);
  const res = resolveImperialElection(state);
  check('Wahl verloren', res.ok === true && res.won === false);
  const lostMem = Object.values(state.memories.byId).find(m => m.type === 'IMPERIAL_ELECTION_LOST');
  check('eine IMPERIAL_ELECTION_LOST-Memory wurde erzeugt', !!lostMem);
  check('metadata enthaelt playerVotes/totalVotes/winnerRegionId', lostMem.metadata.playerVotes === res.playerVotes && lostMem.metadata.totalVotes === res.totalVotes && 'winnerRegionId' in lostMem.metadata);
  check('IMPERIAL_ELECTION_LOST decayt nicht (decayRate 0, bleibt dauerhaft im Weltgedaechtnis)', MEMORY_TYPES.IMPERIAL_ELECTION_LOST.decayRate === 0);
})();

// ---------- Trait-Modulation: ohne jeden neuen Trait-Code wiederverwendet ----------
console.log('--- Trait-Modulation (computeEffectiveWeight, generisch wiederverwendet) ---');
(function() {
  const state = newGame({ seed: 7 });
  const vengeful = createCharacter('m', 40, 'Testhaus');
  vengeful.traits = ['rachsuechtig'];
  const neutral = createCharacter('m', 40, 'Testhaus');
  neutral.traits = [];
  const vid = nextCharId(); state.characters[vid] = vengeful;
  const nid = nextCharId(); state.characters[nid] = neutral;

  const memV = recordWorldEvent(state, { type: 'ELECTION_PROMISE_BROKEN', actorIds: [state.rulerId], targetIds: [vid], emotionalWeight: -45, metadata: {}, description: 'Test' });
  const memN = recordWorldEvent(state, { type: 'ELECTION_PROMISE_BROKEN', actorIds: [state.rulerId], targetIds: [nid], emotionalWeight: -45, metadata: {}, description: 'Test' });
  state.year += 20;
  const wV = computeEffectiveWeight(state, memV, vid);
  const wN = computeEffectiveWeight(state, memN, nid);
  check('rachsuechtig haelt einen Wahlversprechen-Bruch laenger nach (staerker negativ) als ein neutraler Charakter -- ohne jeden Phase-12-spezifischen Trait-Code', wV < wN);
})();
(function() {
  const state = newGame({ seed: 8 });
  const forgiving = createCharacter('m', 40, 'Testhaus');
  forgiving.traits = ['barmherzig'];
  const neutral = createCharacter('m', 40, 'Testhaus');
  neutral.traits = [];
  const fid = nextCharId(); state.characters[fid] = forgiving;
  const nid = nextCharId(); state.characters[nid] = neutral;

  const memF = recordWorldEvent(state, { type: 'ELECTION_PROMISE_BROKEN', actorIds: [state.rulerId], targetIds: [fid], emotionalWeight: -45, metadata: {}, description: 'Test' });
  const memN = recordWorldEvent(state, { type: 'ELECTION_PROMISE_BROKEN', actorIds: [state.rulerId], targetIds: [nid], emotionalWeight: -45, metadata: {}, description: 'Test' });
  state.year += 20;
  const wF = computeEffectiveWeight(state, memF, fid);
  const wN = computeEffectiveWeight(state, memN, nid);
  check('barmherzig verzeiht einen Wahlversprechen-Bruch schneller (schwaecher negativ) als ein neutraler Charakter', wF > wN);
})();

// ---------- RNG-Neutralitaet der Memory-erzeugenden Funktionen ----------
console.log('--- RNG-Neutralitaet ----');
(function() {
  const state = setupCandidacy(9);
  const before = __rngCalls;
  const { promiseId } = createElectionPromise(state, 'ai1', 'pay_tribute', { amount: 10 });
  fulfillElectionPromise(state, promiseId);
  check('kein einziger rnd()-Aufruf durch die Memory-erzeugenden Wahlversprechen-Funktionen', __rngCalls === before);
})();

console.log('');
if (failures) { console.log(failures + ' Test(s) fehlgeschlagen.'); process.exitCode = 1; }
else console.log('Alle Kaiserwahl-Memory-Tests bestanden.');
`;

eval(gamedata + "\n" + sim + "\n" + testBody);
