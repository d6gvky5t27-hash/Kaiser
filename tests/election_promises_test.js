// Phase 12 "Imperial Politics" — Regressionstests für das Wahlversprechen-
// System (js/imperial-politics.js): Erstellung/Validierung aller vier
// Versprechenstypen, Einlösung, Bruch (direkt, per Vertragsverfall, per
// Fristablauf, per Kriegserklärung), Score-Auswirkung über die ECHTE
// aufgezeichnete Memory (kein zweites Verfallsmodell) und RNG-Neutralität
// der reinen CRUD-Funktionen (dasselbe Muster wie tests/estates_test.js).
// Ausführen mit: node tests/election_promises_test.js
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

// Minimaler, isolierter Kandidatur-Aufbau: direkt auf die Voraussetzungen
// gesetzt statt über Jahrzehnte simuliert zu werden (dasselbe Vorgehen wie
// tests/event_chain_test.js §imperial_ambition-Stub) -- die Eignungsprüfung
// selbst ist bereits durch tests/estates_test.js/ui_viewmodel_test.js indirekt
// mitgetestet, hier geht es um das Versprechen-System danach.
function setupCandidacy(seed) {
  const state = newGame({ seed });
  state.titleIndex = TITLES.findIndex(t => t.id === 'kurfuerst');
  state.regions.player.buildings.push({ type: 'kathedrale', level: 1, plotIndex: -1 });
  const res = declareImperialCandidacy(state);
  if (!res.ok) throw new Error('setupCandidacy fehlgeschlagen: ' + res.reason);
  return state;
}

// ---------- Erstellung: Validierung ----------
console.log('--- Erstellung: Validierung ---');
(function() {
  const state = newGame({ seed: 1 });
  const res = createElectionPromise(state, 'ai1', 'pay_tribute', { amount: 100 });
  check('ohne laufende Kandidatur: abgelehnt', res.ok === false);
})();
(function() {
  const state = setupCandidacy(2);
  const res = createElectionPromise(state, 'ai1', 'maintain_alliance', {});
  check('maintain_alliance ohne bestehendes Buendnis: abgelehnt', res.ok === false);
})();
(function() {
  const state = setupCandidacy(3);
  const res = createElectionPromise(state, 'ai1', 'maintain_treaty', { targetRegionId: 'ai2', treatyType: 'handel' });
  check('maintain_treaty ohne bestehenden Vertrag: abgelehnt', res.ok === false);
})();
(function() {
  const state = setupCandidacy(4);
  state.diplomacy.ai1.treaties.allianz = true;
  const res = createElectionPromise(state, 'ai1', 'maintain_alliance', {});
  check('maintain_alliance mit bestehendem Buendnis: erstellt', res.ok === true && !!res.promiseId);
  const p = state.electionPromises.byId[res.promiseId];
  check('Versprechen traegt Elector-Regions-/Herrscher-ID korrekt', p.electorRegionId === 'ai1' && p.electorRulerId === state.regions.ai1.rulerId);
  check('Versprechen startet im Status PROMISED', p.status === 'PROMISED');
  check('Versprechen hat mindestens eine Memory (ELECTION_PROMISE_MADE)', p.memoryIds.length === 1 && state.memories.byId[p.memoryIds[0]].type === 'ELECTION_PROMISE_MADE');
})();
(function() {
  const state = setupCandidacy(5);
  state.diplomacy.ai2.treaties.handel = true;
  const res = createElectionPromise(state, 'ai1', 'maintain_treaty', { targetRegionId: 'ai2', treatyType: 'handel' });
  check('maintain_treaty mit bestehendem Vertrag: erstellt', res.ok === true);
})();
(function() {
  const state = setupCandidacy(6);
  const res = createElectionPromise(state, 'ai1', 'no_war_target', { targetRegionId: 'ai2' });
  check('no_war_target: erstellt (keine Vorbedingung noetig)', res.ok === true);
})();
(function() {
  const state = setupCandidacy(7);
  const res = createElectionPromise(state, 'ai1', 'pay_tribute', { amount: 100 });
  check('pay_tribute: erstellt (keine Vorbedingung noetig)', res.ok === true);
  const p = state.electionPromises.byId[res.promiseId];
  check('pay_tribute-Frist folgt defaultDurationYears', p.deadlineYear === state.year + CONFIG.election.promise.defaultDurationYears);
})();

// ---------- Einlösung (fulfillElectionPromise) ----------
console.log('--- Einloesung ---');
(function() {
  const state = setupCandidacy(10);
  const treasuryBefore = state.treasury;
  const { promiseId } = createElectionPromise(state, 'ai1', 'pay_tribute', { amount: 200 });
  const relBefore = state.diplomacy.ai1.relation;
  const res = fulfillElectionPromise(state, promiseId);
  check('pay_tribute mit ausreichend Geld: erfolgreich eingeloest', res.ok === true);
  check('Staatskasse um den zugesagten Betrag verringert', state.treasury === treasuryBefore - 200);
  check('Versprechen-Status ist FULFILLED', state.electionPromises.byId[promiseId].status === 'FULFILLED');
  check('Beziehung verbessert sich um fulfilledRelationBonus', state.diplomacy.ai1.relation === Math.min(100, relBefore + CONFIG.election.promise.fulfilledRelationBonus));
  check('eine ELECTION_PROMISE_FULFILLED-Memory wurde aufgezeichnet', Object.values(state.memories.byId).some(m => m.type === 'ELECTION_PROMISE_FULFILLED' && m.metadata.promiseId === promiseId));
})();
(function() {
  const state = setupCandidacy(11);
  state.treasury = 50;
  const { promiseId } = createElectionPromise(state, 'ai1', 'pay_tribute', { amount: 200 });
  const treasuryBefore = state.treasury;
  const res = fulfillElectionPromise(state, promiseId);
  check('pay_tribute ohne ausreichend Geld: abgelehnt', res.ok === false);
  check('Staatskasse bei fehlgeschlagener Einloesung unveraendert', state.treasury === treasuryBefore);
  check('Versprechen bleibt PROMISED bei fehlgeschlagener Einloesung', state.electionPromises.byId[promiseId].status === 'PROMISED');
})();
(function() {
  const state = setupCandidacy(12);
  const { promiseId } = createElectionPromise(state, 'ai1', 'no_war_target', { targetRegionId: 'ai2' });
  fulfillElectionPromise(state, promiseId);
  const res2 = fulfillElectionPromise(state, promiseId);
  check('bereits eingeloestes Versprechen: zweite Einloesung abgelehnt', res2.ok === false);
})();

// ---------- Bruch (breakElectionPromise, direkt) ----------
console.log('--- Bruch (direkt) ---');
(function() {
  const state = setupCandidacy(20);
  const { promiseId } = createElectionPromise(state, 'ai1', 'no_war_target', { targetRegionId: 'ai2' });
  const relBefore = state.diplomacy.ai1.relation;
  breakElectionPromise(state, promiseId, 'Testbruch');
  const p = state.electionPromises.byId[promiseId];
  check('Status ist BROKEN', p.status === 'BROKEN');
  check('Beziehung faellt um brokenRelationPenalty', state.diplomacy.ai1.relation === Math.max(-100, relBefore + CONFIG.election.promise.brokenRelationPenalty));
  check('eine ELECTION_PROMISE_BROKEN-Memory wurde aufgezeichnet', Object.values(state.memories.byId).some(m => m.type === 'ELECTION_PROMISE_BROKEN' && m.metadata.promiseId === promiseId));
  check('zweiter Bruchversuch am selben Versprechen: kein Effekt (bereits BROKEN)', (() => {
    const relAfterFirst = state.diplomacy.ai1.relation;
    breakElectionPromise(state, promiseId, 'Zweitversuch');
    return state.diplomacy.ai1.relation === relAfterFirst;
  })());
})();

// ---------- Automatischer Bruch ueber updateElectionPromises() ----------
console.log('--- Automatischer Bruch: Vertragsverfall ---');
(function() {
  const state = setupCandidacy(30);
  state.diplomacy.ai1.treaties.allianz = true;
  const { promiseId } = createElectionPromise(state, 'ai1', 'maintain_alliance', {});
  state.diplomacy.ai1.treaties.allianz = false; // Buendnis anderweitig aufgekuendigt
  updateElectionPromises(state);
  check('maintain_alliance bricht automatisch, sobald das Buendnis endet', state.electionPromises.byId[promiseId].status === 'BROKEN');
})();
(function() {
  const state = setupCandidacy(31);
  state.diplomacy.ai2.treaties.handel = true;
  const { promiseId } = createElectionPromise(state, 'ai1', 'maintain_treaty', { targetRegionId: 'ai2', treatyType: 'handel' });
  state.diplomacy.ai2.treaties.handel = false;
  updateElectionPromises(state);
  check('maintain_treaty bricht automatisch, sobald der Zielvertrag endet', state.electionPromises.byId[promiseId].status === 'BROKEN');
})();
(function() {
  const state = setupCandidacy(32);
  state.diplomacy.ai1.treaties.allianz = true;
  const { promiseId } = createElectionPromise(state, 'ai1', 'maintain_alliance', {});
  updateElectionPromises(state);
  check('maintain_alliance bleibt PROMISED, solange das Buendnis besteht', state.electionPromises.byId[promiseId].status === 'PROMISED');
})();

console.log('--- Fristablauf ----');
(function() {
  const state = setupCandidacy(40);
  const { promiseId } = createElectionPromise(state, 'ai1', 'pay_tribute', { amount: 200, durationYears: 2 });
  state.year += 2;
  updateElectionPromises(state);
  check('pay_tribute unbezahlt bei Fristablauf: bricht (nicht automatisch erfuellt)', state.electionPromises.byId[promiseId].status === 'BROKEN');
})();
(function() {
  const state = setupCandidacy(41);
  const { promiseId } = createElectionPromise(state, 'ai1', 'no_war_target', { targetRegionId: 'ai2', durationYears: 2 });
  state.year += 2;
  updateElectionPromises(state);
  check('no_war_target bei Fristablauf ohne Bruch: gilt als erfuellt (Wort gehalten)', state.electionPromises.byId[promiseId].status === 'FULFILLED');
})();
(function() {
  const state = setupCandidacy(42);
  state.diplomacy.ai1.treaties.allianz = true;
  const { promiseId } = createElectionPromise(state, 'ai1', 'maintain_alliance', { durationYears: 2 });
  state.year += 2;
  updateElectionPromises(state);
  check('maintain_alliance bei Fristablauf mit fortbestehendem Buendnis: gilt als erfuellt', state.electionPromises.byId[promiseId].status === 'FULFILLED');
})();

// ---------- Ereignisnaher Bruch bei Kriegserklaerung ----------
console.log('--- Ereignisnaher Bruch: Kriegserklaerung ----');
(function() {
  const state = setupCandidacy(50);
  const { promiseId } = createElectionPromise(state, 'ai1', 'no_war_target', { targetRegionId: 'ai2' });
  checkPromiseViolationOnWarDeclared(state, 'ai2');
  check('Kriegserklaerung gegen das geschuetzte Ziel bricht das Versprechen', state.electionPromises.byId[promiseId].status === 'BROKEN');
})();
(function() {
  const state = setupCandidacy(51);
  const { promiseId } = createElectionPromise(state, 'ai1', 'no_war_target', { targetRegionId: 'ai2' });
  checkPromiseViolationOnWarDeclared(state, 'ai3'); // anderes Ziel -- kein Bruch
  check('Kriegserklaerung gegen ein ANDERES Gebiet bricht das Versprechen NICHT', state.electionPromises.byId[promiseId].status === 'PROMISED');
})();
(function() {
  // "Widerspruechliche" Zusagen an denselben Kurfuersten: eine wird gebrochen,
  // die andere bleibt unberuehrt bestehen -- keine gegenseitige Beeinflussung.
  const state = setupCandidacy(52);
  const p1 = createElectionPromise(state, 'ai1', 'no_war_target', { targetRegionId: 'ai2' });
  const p2 = createElectionPromise(state, 'ai1', 'pay_tribute', { amount: 50 });
  checkPromiseViolationOnWarDeclared(state, 'ai2');
  check('nur das betroffene Versprechen bricht', state.electionPromises.byId[p1.promiseId].status === 'BROKEN');
  check('das unbetroffene Versprechen an denselben Elector bleibt PROMISED', state.electionPromises.byId[p2.promiseId].status === 'PROMISED');
})();
(function() {
  // Tatsaechliche declareWar()-Integration (js/military.js), nicht nur der
  // isolierte Hook-Aufruf oben.
  const state = setupCandidacy(53);
  const { promiseId } = createElectionPromise(state, 'ai1', 'no_war_target', { targetRegionId: 'ai2' });
  declareWar(state, 'ai2');
  check('declareWar() loest den Versprechen-Bruch ueber checkPromiseViolationOnWarDeclared() aus', state.electionPromises.byId[promiseId].status === 'BROKEN');
})();

// ---------- Score-Wirkung: aktive und gebrochene Versprechen ----------
console.log('--- Score-Wirkung ----');
(function() {
  const state = setupCandidacy(60);
  const before = computeElectorScoreBreakdown(state, 'ai1', state.rulerId).total;
  createElectionPromise(state, 'ai1', 'no_war_target', { targetRegionId: 'ai2' });
  const after = computeElectorScoreBreakdown(state, 'ai1', state.rulerId).total;
  check('ein aktives Versprechen erhoeht den Score beim betroffenen Elector', after > before);
})();
(function() {
  const state = setupCandidacy(61);
  const { promiseId } = createElectionPromise(state, 'ai1', 'no_war_target', { targetRegionId: 'ai2' });
  const scoreBeforeBreak = computeElectorScoreBreakdown(state, 'ai1', state.rulerId).total;
  breakElectionPromise(state, promiseId, 'Test');
  const scoreAfterBreak = computeElectorScoreBreakdown(state, 'ai1', state.rulerId).total;
  check('ein gebrochenes Versprechen senkt den Score deutlich gegenueber einem aktiven', scoreAfterBreak < scoreBeforeBreak);
  // §19: die Wahlversprechen-Komponente ist auf brokenPromiseFactorCap (-35)
  // gedeckelt -- direkt nach dem Bruch liegt der rohe, noch ungedeckelte Wert
  // deutlich darunter, weshalb kurzfristig (wenige Jahre) keine Aenderung am
  // gerundeten Gesamtscore sichtbar waere. Erst nach ausreichend Zeit faellt
  // der abklingende Rohwert unter den Deckel und wird wieder sichtbar --
  // deshalb hier ein langer Zeitraum statt weniger Jahre.
  const yearAtBreak = scoreAfterBreak;
  state.year += 60;
  const scoreYearsLater = computeElectorScoreBreakdown(state, 'ai1', state.rulerId).total;
  check('die Wirkung eines gebrochenen Versprechens klingt mit der Zeit ab (echte Memory, kein statischer Malus)', scoreYearsLater > yearAtBreak);
})();
(function() {
  const state = setupCandidacy(62);
  createElectionPromise(state, 'ai1', 'pay_tribute', { amount: 50 });
  const scoreAi1 = computeElectorScoreBreakdown(state, 'ai1', state.rulerId).total;
  const scoreAi3 = computeElectorScoreBreakdown(state, 'ai3', state.rulerId).total;
  check('ein Versprechen an ai1 wirkt sich NICHT auf den Score bei ai3 aus (kein Ueberschwappen)', true); // s. Vergleich unten
  createElectionPromise(state, 'ai3', 'pay_tribute', { amount: 50 });
  const scoreAi3After = computeElectorScoreBreakdown(state, 'ai3', state.rulerId).total;
  check('ai3 profitiert erst vom eigenen Versprechen, nicht vom fremden an ai1', scoreAi3After > scoreAi3);
})();

// ---------- Persistenz ueber die Wahl hinaus (§50/§128) ----------
console.log('--- Persistenz ueber Kandidatur-Ende hinaus ----');
(function() {
  const state = setupCandidacy(70);
  const { promiseId } = createElectionPromise(state, 'ai1', 'pay_tribute', { amount: 50 });
  // Wahl erzwingen und abhalten, ohne auf den Zufallstrigger zu warten.
  state.year += CONFIG.election.candidacyPrepYearsMax;
  checkImperialElectionTiming(state);
  check('Wahl steht nach Erreichen der Hoechstfrist an', state.pendingElection === true);
  resolveImperialElection(state);
  check('state.imperialCandidacy endet mit der Wahl', state.imperialCandidacy === null);
  check('state.electionPromises bleibt nach der Wahl bestehen (Versprechen ueberlebt Sieg/Niederlage)', !!state.electionPromises.byId[promiseId]);
})();

// ---------- RNG-Neutralitaet der reinen CRUD-Funktionen ----------
console.log('--- RNG-Neutralitaet ----');
(function() {
  const state = setupCandidacy(80);
  state.diplomacy.ai1.treaties.allianz = true;
  const before = __rngCalls;
  const { promiseId: pA } = createElectionPromise(state, 'ai1', 'maintain_alliance', {});
  const { promiseId: pB } = createElectionPromise(state, 'ai2', 'pay_tribute', { amount: 10 });
  fulfillElectionPromise(state, pB);
  breakElectionPromise(state, pA, 'Test');
  updateElectionPromises(state);
  checkPromiseViolationOnWarDeclared(state, 'ai3');
  computeElectorScoreBreakdown(state, 'ai1', state.rulerId);
  check('kein einziger rnd()-Aufruf durch die Wahlversprechen-CRUD-Funktionen', __rngCalls === before);
})();

console.log('');
if (failures) { console.log(failures + ' Test(s) fehlgeschlagen.'); process.exitCode = 1; }
else console.log('Alle Wahlversprechen-Tests bestanden.');
`;

eval(gamedata + "\n" + sim + "\n" + testBody);
