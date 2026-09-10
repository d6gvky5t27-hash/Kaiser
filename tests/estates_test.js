// Phase 11 "Living Realm" — Regressionstests für das Landstände-Kernmodul
// (js/estates.js): Init/Migration, Zufriedenheit/Einfluss-Breakdown,
// Wortführer-Auswahl, Interessen-Erkennung, Forderungsfähigkeit und
// RNG-Neutralität (kein einziger rnd()-Aufruf, dasselbe Muster wie
// tests/ui_viewmodel_test.js §83 für die Phase-8H-ViewModels).
// Ausführen mit: node tests/estates_test.js
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

// ---------- Init ----------
console.log('--- Init ---');
(function() {
  const state = newGame({ seed: 1 });
  check('state.estates hat genau die 4 Stände', JSON.stringify(Object.keys(state.estates).sort()) === JSON.stringify(['adel','bauernschaft','buergertum','geistlichkeit']));
  for (const id of ESTATE_IDS) {
    const est = state.estates[id];
    check('estates.' + id + '.lastDemandYear startet bei 0', est.lastDemandYear === 0);
    check('estates.' + id + '.privileges startet leer', Array.isArray(est.privileges) && est.privileges.length === 0);
  }
  check('Bauernschaft hat zu Spielbeginn keinen Wortführer (kein passender Kandidat, keine erfundene Figur)', state.estates.bauernschaft.leaderId === null);
})();

// ---------- Zufriedenheit ist ein echter, gewichteter Durchschnitt der zugeordneten POP_GROUPS ----------
console.log('--- Zufriedenheit (§6: baut auf POP_GROUPS auf, keine zweite Quelle) ---');
(function() {
  const state = newGame({ seed: 2 });
  const r = state.regions.player;
  r.population.bauern.satisfaction = 80; r.population.bauern.count = 100;
  r.population.landarbeiter.satisfaction = 20; r.population.landarbeiter.count = 100;
  r.population.tageloehner.count = 0; r.population.arme.count = 0;
  const sat = computeEstateSatisfaction(state, 'bauernschaft');
  check('Bauernschaft-Zufriedenheit ist der bevölkerungsgewichtete Schnitt (erwartet 50)', Math.abs(sat - 50) < 0.5);
})();

// ---------- Einfluss-Breakdown (§: vollständig aufgeschlüsselt, keine Blackbox) ----------
console.log('--- Einfluss-Breakdown ---');
(function() {
  const state = newGame({ seed: 3 });
  for (const id of ESTATE_IDS) {
    const bd = computeEstateInfluenceBreakdown(state, id);
    const sum = bd.components.reduce((s, c) => s + c.value, 0);
    check(id + ': total liegt in [0,100]', bd.total >= 0 && bd.total <= 100);
    check(id + ': total entspricht der Summe aller Komponenten (bis auf Clamping)', Math.abs(bd.total - Math.round(sum)) < 1 || bd.total === 0 || bd.total === 100);
    check(id + ': jede Komponente hat ein Label', bd.components.every(c => typeof c.label === 'string' && c.label.length > 0));
  }
  const withKnights = newGame({ seed: 3 });
  withKnights.army.ritter = 10;
  const infl1 = computeEstateInfluence(state, 'adel');
  const infl2 = computeEstateInfluence(withKnights, 'adel');
  check('Adel-Einfluss steigt, wenn der Spieler von Lehnsrittern abhängt (echte, bestehende Abhängigkeit)', infl2 > infl1);
})();

// ---------- Wortführer: nur aus Character Core, stabil, an das passende Hofamt gekoppelt ----------
console.log('--- Wortführer ---');
(function() {
  const state = newGame({ seed: 4 });
  check('Bürgertum ohne Handelsberater hat keinen Wortführer', state.estates.buergertum.leaderId === null);
  const before = state.__rngCallsMarker = __rngCalls;
  openAdvisorSelection(state, 'handelsberater');
  confirmAdvisorSelection(state, 0);
  updateEstates(state);
  const leaderId = state.estates.buergertum.leaderId;
  check('Nach Berufung eines Handelsberaters wird er automatisch Wortführer des Bürgertums', leaderId !== null && leaderId === state.advisors.handelsberater);
  const leaderIdAgain = selectEstateLeader(state, 'buergertum');
  check('Wortführer bleibt bei erneuter Auswahl stabil (kein grundloses Neuwürfeln)', leaderIdAgain === leaderId);
  dismissAdvisor(state, 'handelsberater');
  updateEstates(state);
  check('Nach Entlassung des Handelsberaters verliert das Bürgertum seinen Wortführer', state.estates.buergertum.leaderId === null);
})();

// ---------- Interessen (§: aus echtem Weltzustand entdeckt, kein RNG) ----------
console.log('--- Interessen ---');
(function() {
  const state = newGame({ seed: 5 });
  state.regions.player.taxRate = 0.5;
  const adelInterests = discoverEstateInterests(state, 'adel');
  check('Hohe Steuerlast erzeugt ein Steuerlast-Interesse beim Adel', adelInterests.some(i => i.topic === 'steuerlast'));

  const state2 = newGame({ seed: 6 });
  state2.religiousInfluence = 5;
  const klerusInterests = discoverEstateInterests(state2, 'geistlichkeit');
  check('Niedriger kirchlicher Einfluss erzeugt ein Interesse bei der Geistlichkeit', klerusInterests.some(i => i.topic === 'kirchlicher_einfluss'));

  const state3 = newGame({ seed: 7 });
  state3.regions.player.grainRatio = 0.3;
  const bauernInterests = discoverEstateInterests(state3, 'bauernschaft');
  check('Kornmangel erzeugt ein Nahrungssicherheits-Interesse bei der Bauernschaft', bauernInterests.some(i => i.topic === 'nahrungssicherheit'));

  const state4 = newGame({ seed: 8 });
  const ruhig = discoverEstateInterests(state4, 'adel').concat(discoverEstateInterests(state4, 'bauernschaft'));
  check('Interessen sind niemals RNG-gewürfelt (deterministisch bei gleichem Zustand)', JSON.stringify(discoverEstateInterests(state4, 'adel')) === JSON.stringify(discoverEstateInterests(state4, 'adel')));
})();

// ---------- Forderungsfähigkeit (Cooldown + max. 1 aktiv systemweit) ----------
console.log('--- Forderungsfähigkeit ---');
(function() {
  const state = newGame({ seed: 9 });
  state.estates.adel.lastDemandYear = state.year;
  const elig = checkEstateDemandEligibility(state, 'adel');
  check('Direkt nach einer Forderung greift der Cooldown', !elig.eligible && elig.checks[0].passed === false);

  const state2 = newGame({ seed: 10 });
  state2.eventChains.active['ecTest'] = { id: 'ecTest', templateId: 'adel_hofamt', variables: { estateId: 'adel' } };
  const eligOther = checkEstateDemandEligibility(state2, 'geistlichkeit');
  check('Während einer aktiven Stände-Forderung ist keine zweite systemweit möglich', !eligOther.eligible);
  check('getActiveEstateChain() findet die aktive Kette für den betroffenen Stand', getActiveEstateChain(state2, 'adel') !== null);
  check('getActiveEstateChain() liefert null für einen unbeteiligten Stand', getActiveEstateChain(state2, 'buergertum') === null);
})();

// ---------- Migration v7 -> v8 ----------
console.log('--- Speicherstand-Migration v7 -> v8 ---');
(function() {
  const state = newGame({ seed: 11 });
  const serialized = JSON.parse(serializeSave(state));
  delete serialized.state.estates;
  serialized.saveVersion = 7;
  const migrated = migrateSaveV7ToV8(serialized);
  check('Migration v7->v8 setzt saveVersion auf 8', migrated.saveVersion === 8);
  check('Migration v7->v8 erzeugt state.estates aus dem aktuellen Weltzustand (keine erfundene Historie)', !!migrated.state.estates && ESTATE_IDS.every(id => migrated.state.estates[id]));
  check('Bereits vorhandenes state.estates bleibt bei erneuter Migration unangetastet', (function() {
    const already = { state: JSON.parse(JSON.stringify(migrated.state)), saveVersion: 7 };
    already.state.estates.adel.lastDemandYear = 1234;
    const remigrated = migrateSaveV7ToV8(already);
    return remigrated.state.estates.adel.lastDemandYear === 1234;
  })());
})();

// ---------- RNG-Neutralität (§: reine Berechnung, kein rnd()-Verbrauch) ----------
console.log('--- RNG-Neutralität ---');
(function() {
  const state = newGame({ seed: 12 });
  const before = __rngCalls;
  for (const id of ESTATE_IDS) {
    computeEstateInfluence(state, id);
    computeEstateSatisfaction(state, id);
    discoverEstateInterests(state, id);
    selectEstateLeader(state, id);
    checkEstateDemandEligibility(state, id);
    getEstateSummary(state, id);
  }
  check('kein einziger rnd()-Aufruf durch die Estate-Berechnungsfunktionen', __rngCalls === before);
})();

console.log('');
if (failures) { console.log(failures + ' Test(s) fehlgeschlagen.'); process.exitCode = 1; }
else console.log('Alle Estate-System-Tests bestanden.');
`;

eval(gamedata + "\n" + sim + "\n" + testBody);
