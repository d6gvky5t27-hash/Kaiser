// Phase 3 "Character Core" — Regressionstests für Charaktergenerator,
// Beziehungen, Traits, Claims, Loyalität und Berater (§Punkt 49-55).
// Ausführen mit: node tests/character_core_test.js
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const gamedata = fs.readFileSync(path.join(ROOT, "data/gamedata.js"), "utf8");
const simModules = ["core", "economy", "population-dynasty", "memory", "characters", "politics", "diplomacy", "military", "debug", "war-map", "advance-year"];
const sim = simModules.map(m => fs.readFileSync(path.join(ROOT, "js", m + ".js"), "utf8")).join("\n");

const testBody = `
let failures = 0;
function check(label, cond) {
  if (cond) { console.log('  OK   ' + label); }
  else { console.log('  FAIL ' + label); failures++; }
}

// ---------- §49: Charaktergenerator, gleicher Seed + gleiche Inputs = identischer Charakter ----------
console.log('--- Charaktergenerator (Determinismus) ---');
seedRng(777);
const charA = createCharacter('m', 30, 'Test');
seedRng(777);
const charB = createCharacter('m', 30, 'Test');
check('gleicher Seed+Inputs erzeugt identischen Charakter', JSON.stringify(charA) === JSON.stringify(charB));
seedRng(778);
const charC = createCharacter('m', 30, 'Test');
check('anderer Seed erzeugt (wahrscheinlich) anderen Charakter', JSON.stringify(charA) !== JSON.stringify(charC));

// ---------- §50: Beziehungen ----------
console.log('--- Beziehungen ---');
(function() {
  seedRng(1);
  const state = newGame({ seed: 1 });
  const ruler = state.characters[state.rulerId];
  const sibId = nextCharId();
  const sib = createCharacter('m', ruler.age - 2, ruler.surname);
  sib.parentId = ruler.parentId || 'root';
  state.characters[sibId] = sib;
  ruler.parentId = ruler.parentId || 'root'; // gemeinsamer (künstlicher) Elternteil fürs Testszenario
  refreshRelationship(state, sibId, state.rulerId);
  const rel = state.characters[sibId].relationships[state.rulerId];
  const expectedSum = rel.modifiers.reduce((s, m) => s + m.value, 0);
  check('Beziehungssumme = Summe der Modifikatoren', rel.total === Math.max(-100, Math.min(100, expectedSum)));
  check('Gründe sind erhalten (mind. 1 Modifikator: Geschwister)', rel.modifiers.some(m => m.source === 'geschwister'));

  // Minimum/Maximum-Klammerung (§Phase-4: Modifikatoren kommen jetzt aus
  // dem World-Memory-System statt aus einem statischen Zusatzwert)
  recordWorldEvent(state, {
    type: 'RIVALRY_BEGAN', actorIds: [sibId, state.rulerId], targetIds: [sibId, state.rulerId],
    emotionalWeight: -1000,
    description: 'Testszenario: extreme Rivalität zur Prüfung der Klammerung.',
  });
  refreshRelationship(state, sibId, state.rulerId);
  check('Beziehung wird nach unten auf -100 geklammert', state.characters[sibId].relationships[state.rulerId].total === -100);
})();

// ---------- §51: Traits ----------
console.log('--- Traits (tatsächliche Auswirkungen) ---');
(function() {
  const ambitious = { traits: ['ehrgeizig'] };
  const loyal = { traits: ['loyal'] };
  const corrupt = { traits: ['korrupt'] };
  const charismatic = { traits: ['charismatisch'] };
  check('ehrgeizig senkt loyaltyMod', traitEffectSum(ambitious, 'loyaltyMod') < 0);
  check('ehrgeizig erhöht claimAggression', traitEffectSum(ambitious, 'claimAggression') > 0);
  check('loyal erhöht loyaltyMod', traitEffectSum(loyal, 'loyaltyMod') > 0);
  check('korrupt senkt advisorEffectMod', traitEffectSum(corrupt, 'advisorEffectMod') < 0);
  check('charismatisch erhöht relationshipMod', traitEffectSum(charismatic, 'relationshipMod') > 0);
})();

// ---------- §52: Claims ----------
console.log('--- Claims ---');
(function() {
  const state = newGame({ seed: 2 });
  const ruler = state.characters[state.rulerId];
  // direkter Erbe (einziges Kind)
  const heirId = nextCharId();
  const heir = createCharacter('m', 20, ruler.surname);
  heir.parentId = state.rulerId;
  state.characters[heirId] = heir;
  ruler.childrenIds.push(heirId);
  updateClaims(state);
  check('direkter/einziger Erbe bekommt primary-Claim', state.characters[heirId].claims.some(c => c.titleId === 'player' && c.strength === 'primary'));

  // Bruder des Herrschers (weak claim)
  const rootParent = 'root_test';
  ruler.parentId = rootParent;
  const sibId = nextCharId();
  const sib = createCharacter('f', ruler.age - 3, ruler.surname);
  sib.parentId = rootParent;
  state.characters[sibId] = sib;
  updateClaims(state);
  check('Geschwister des Herrschers bekommt weak-Claim', state.characters[sibId].claims.some(c => c.titleId === 'player' && c.strength === 'weak'));

  // entfernter Verwandter (kein direktes Eltern-Kind/Geschwister-Verhältnis) -> kein Claim
  const distantId = nextCharId();
  const distant = createCharacter('m', 40, ruler.surname);
  state.characters[distantId] = distant;
  updateClaims(state);
  check('entfernter Verwandter ohne Eltern-/Geschwisterbezug bekommt keinen Claim', distant.claims.length === 0);

  // Charakter ohne jeden Bezug
  const strangerId = nextCharId();
  const stranger = createCharacter('m', 40, 'Fremdhaus');
  state.characters[strangerId] = stranger;
  updateClaims(state);
  check('Charakter ohne Anspruch bleibt ohne Claim', stranger.claims.length === 0);
})();

// ---------- §53: Loyalität ----------
console.log('--- Loyalität ---');
(function() {
  const state = newGame({ seed: 3 });
  const ruler = state.characters[state.rulerId];
  ruler.parentId = ruler.parentId || 'root_loy';

  const aId = nextCharId();
  const a = createCharacter('m', 40, ruler.surname);
  a.parentId = ruler.parentId;
  a.traits = [];
  state.characters[aId] = a;

  const bId = nextCharId();
  const b = createCharacter('m', 40, ruler.surname);
  b.parentId = ruler.parentId;
  b.traits = ['ehrgeizig'];
  state.characters[bId] = b;

  updateClaims(state); // beide sind Geschwister -> weak claim für beide zunächst
  setClaim(b, 'player', 'strong', 'test_strong_claim'); // B bekommt zusätzlich einen starken eigenen Anspruch
  refreshRelationship(state, aId, state.rulerId);
  refreshRelationship(state, bId, state.rulerId);
  const loyA = computeLoyalty(state, aId);
  const loyB = computeLoyalty(state, bId);
  check('Charakter mit starkem Claim + ehrgeizig hat niedrigere Loyalität als ohne', loyB < loyA);
})();

// ---------- §54: Berater ----------
console.log('--- Berater ---');
(function() {
  const state = newGame({ seed: 4 });
  const openRes = openAdvisorSelection(state, 'schatzmeister');
  check('Kandidatenauswahl öffnet erfolgreich', openRes.ok === true);
  const candidates = state.pendingAdvisorSelection.candidates;
  check('2-4 Kandidaten werden erzeugt', candidates.length >= 2 && candidates.length <= 4);
  const skills = candidates.map(c => (c.existingId ? state.characters[c.existingId] : c.generated).stats.finanzen);
  check('Kandidaten unterscheiden sich in Skills (nicht alle identisch)', new Set(skills).size > 1 || candidates.length === 1);

  const before = state.treasury;
  const confirmRes = confirmAdvisorSelection(state, 0);
  check('Ernennung funktioniert', confirmRes.ok === true && state.advisors.schatzmeister !== null);
  check('Kosten wurden abgebucht', state.treasury < before);

  const advId = state.advisors.schatzmeister;
  const dismissRes = dismissAdvisor(state, 'schatzmeister');
  check('Entlassung funktioniert', dismissRes.ok === true && state.advisors.schatzmeister === null);
  check('advisorRole wird beim Entlassen zurückgesetzt', state.characters[advId].advisorRole === null);

  // Tod macht Amt frei
  openAdvisorSelection(state, 'marschall');
  confirmAdvisorSelection(state, 0);
  const marschallId = state.advisors.marschall;
  state.characters[marschallId].alive = false;
  state.characters[marschallId].age = 200; // stellt sicher, dass rollDeathChance() hoch genug waere, falls erneut geprüft
  checkAdvisorDeaths(state); // sollte den bereits toten Charakter überspringen (kein Crash)
  check('checkAdvisorDeaths() crasht nicht bei bereits totem Berater', true);

  // frischer, lebender Berater mit extrem hoher Sterbewahrscheinlichkeit
  openAdvisorSelection(state, 'diplomat');
  confirmAdvisorSelection(state, 0);
  const diplomatId = state.advisors.diplomat;
  state.characters[diplomatId].age = 150;
  state.characters[diplomatId].health = 0;
  checkAdvisorDeaths(state);
  check('Tod macht das Amt frei', state.advisors.diplomat === null && state.characters[diplomatId].alive === false);
})();

console.log('');
if (failures > 0) {
  console.log(failures + ' Testfall(e) FEHLGESCHLAGEN.');
  process.exitCode = 1;
} else {
  console.log('Alle Character-Core-Tests bestanden.');
}
`;

eval(gamedata + "\n" + sim + "\n" + testBody);
