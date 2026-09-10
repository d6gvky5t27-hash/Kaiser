// Phase 6 "Drama Director" — Regressionstests (§Punkt 85-88, 116-117).
// Ausführen mit: node tests/drama_director_test.js
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

// ---------- §85: Director-Priorität — akute Hungerkrise vor optionalen Ketten ----------
console.log('--- §85: Director-Priorität ---');
(function() {
  const state = newGame({ seed: 60 });
  // Berater-Streit vorbereiten (optional)
  const advId = nextCharId();
  const adv = createCharacter('m', 40, 'Testhaus');
  adv.traits = ['ehrgeizig'];
  adv.advisorRole = 'schatzmeister';
  state.characters[advId] = adv;
  state.advisors.schatzmeister = advId;
  recordWorldEvent(state, { type: 'DENIED_OFFICE', actorIds: [state.rulerId], targetIds: [advId], emotionalWeight: -40 });
  refreshRelationship(state, advId, state.rulerId);

  // Echte Hungerkrise (systemkritisch)
  recordWorldEvent(state, { type: 'FAMINE', regionIds: ['player'], emotionalWeight: -60, description: 'Testhungersnot' });

  updateStoryThreads(state);
  updateDramaDirector(state);
  const scores = explainEligibleChainScores(state);
  const famineEntry = scores.find(s => s.templateId === 'famine_crisis');
  const advisorEntry = scores.find(s => s.templateId === 'grieved_advisor');
  check('Hungerkrise ist eligible', !!famineEntry);
  if (famineEntry && advisorEntry) {
    check('Hungerkrise erhält (mindestens) so hohe Priorität wie ein optionaler Beraterstreit', famineEntry.total >= advisorEntry.total);
  }
})();

// ---------- §86: Recovery-Test ----------
console.log('--- §86: Recovery-Test ---');
(function() {
  const state = newGame({ seed: 61 });
  // Großereignis simulieren: hohe Importance-Memory in diesem Jahr
  recordWorldEvent(state, { type: 'RULER_DIED', actorIds: [state.rulerId], targetIds: [], emotionalWeight: -50 });
  updateDramaDirector(state);
  check('Großereignis setzt ein Recovery-Fenster', state.drama.recoveryWindowUntilYear !== null && state.drama.recoveryWindowUntilYear >= state.year);

  const advId = nextCharId();
  const adv = createCharacter('m', 40, 'Testhaus');
  state.characters[advId] = adv;
  const optionalScore = computeChainDirectorScore(state, 'grieved_advisor', { actorIds: [advId], targetIds: [] });
  check('optionale Kette bekommt im Recovery-Fenster einen Abzug', optionalScore.breakdown.some(b => b.value < 0));

  recordWorldEvent(state, { type: 'FAMINE', regionIds: ['player'], emotionalWeight: -60 });
  const criticalScore = computeChainDirectorScore(state, 'famine_crisis', { regionIds: ['player'] });
  check('systemkritische Kette bleibt im Recovery-Fenster OHNE Abzug', !criticalScore.breakdown.some(b => b.label.includes('Recovery')));
})();

// ---------- §87: "Erfolg wird nicht bestraft" ----------
console.log('--- §87: Erfolg wird nicht bestraft ---');
(function() {
  const state = newGame({ seed: 62 });
  const r = state.regions.player;
  state.treasury = 50000;
  state.legitimacy = 95;
  r.grainRatio = 1.3;
  for (const pid in state.diplomacy) state.diplomacy[pid].relation = 80;
  const ruler = state.characters[state.rulerId];
  ruler.rivalIds = [];
  ruler.health = 90;
  updateStoryThreads(state);
  updateDramaDirector(state);
  check('extrem stabiler Zustand erzeugt niedrige Tension', state.drama.tension < 30);
  check('Pacing ist QUIET oder BUILDING, nicht CRISIS', state.drama.pacing === 'QUIET' || state.drama.pacing === 'BUILDING');
})();

// ---------- §88: No-Eligible-Story-Test ----------
console.log('--- §88: No-Eligible-Story-Test ---');
(function() {
  const state = newGame({ seed: 63 });
  state.drama.yearsSinceMajorEvent = 30; // "seit 30 Jahren nichts Großes passiert"
  const candidates = collectEligibleChainCandidates(state);
  check('ohne jede plausible Voraussetzung ist NICHTS eligible', candidates.length === 0);
  const beforeActive = Object.keys(state.eventChains.active).length;
  startNewEventChainIfEligible(state);
  check('yearsSinceMajorEvent allein erzwingt KEINEN Chain-Start', Object.keys(state.eventChains.active).length === beforeActive);
})();

// ---------- §116: Zentraler Anti-Cheat-Test ----------
console.log('--- §116: Zentraler Anti-Cheat-Test ---');
(function() {
  const state = newGame({ seed: 64 });
  const ruler = state.characters[state.rulerId];
  // sehr reich, hohe Legitimität, volle Nahrung, kein Rivale, gesicherte
  // Erbfolge, gute Beziehungen, Frieden, keine passende Memory, keine
  // eligible Chain, 30 Jahre kein Großereignis
  state.treasury = 100000;
  state.legitimacy = 95;
  state.regions.player.grainRatio = 1.3;
  ruler.rivalIds = [];
  ruler.health = 90;
  const heirId = nextCharId();
  const heir = createCharacter('m', 20, ruler.surname);
  heir.parentId = state.rulerId;
  state.characters[heirId] = heir;
  ruler.childrenIds.push(heirId);
  // Erbe ist bereits verheiratet — sonst wäre ein unverheirateter, erwachsener
  // Erbe bei guten Beziehungen selbst ein objektiv gültiges (und laut
  // §Punkt 67 ausdrücklich legitimes) DYNASTIC_ALLIANCE-Signal ("Eheverhandlung
  // läuft" ist KEINE erfundene Krise) — für den strikten "wirklich gar nichts
  // ist plausibel"-Test hier bewusst ausgeschlossen.
  const heirSpouseId = nextCharId();
  const heirSpouse = createCharacter('f', 19, 'Fremdhaus');
  state.characters[heirSpouseId] = heirSpouse;
  heir.spouseId = heirSpouseId;
  heirSpouse.spouseId = heirId;
  for (const pid in state.diplomacy) state.diplomacy[pid].relation = 80;
  state.drama.yearsSinceMajorEvent = 30;

  for (let y = 0; y < 5; y++) {
    updateStoryThreads(state);
    updateDramaDirector(state);
    startNewEventChainIfEligible(state);
    state.year += 1;
  }
  check('Drama Director erfindet in einem durchweg stabilen Zustand KEINE neue Kette', Object.keys(state.eventChains.active).length === 0);
  check('kein neuer Story Thread vom Typ SUCCESSION_CONFLICT/PERSONAL_RIVALRY/FOOD_CRISIS entsteht', !getActiveStoryThreads(state).some(t => ['SUCCESSION_CONFLICT','PERSONAL_RIVALRY','FOOD_CRISIS'].includes(t.type)));
  check('kein pendingEvent wurde künstlich erzeugt', !state.pendingEvent);
})();

// ---------- §117: Die Geschichte, die im Vordergrund stehen soll ----------
console.log('--- §117: Erkennbar dramatischer Zustand ---');
(function() {
  const state = newGame({ seed: 65 });
  const ruler = state.characters[state.rulerId];
  ruler.parentId = ruler.parentId || 'root117';
  ruler.health = 15; // schwer krank

  const rivalId = nextCharId();
  const rival = createCharacter('m', 35, ruler.surname);
  rival.parentId = ruler.parentId;
  rival.traits = ['rachsuechtig'];
  state.characters[rivalId] = rival;
  setClaim(rival, 'player', 'strong', 'succession_passed_over');
  recordWorldEvent(state, { type: 'PASSED_OVER_IN_SUCCESSION', actorIds: [state.rulerId], targetIds: [rivalId], emotionalWeight: -60 });
  recordWorldEvent(state, { type: 'DENIED_OFFICE', actorIds: [state.rulerId], targetIds: [rivalId], emotionalWeight: -40 });
  refreshRelationship(state, rivalId, state.rulerId);
  rival.loyalty = 22;
  rival.rivalIds.push(state.rulerId);
  ruler.rivalIds.push(rivalId);
  for (const pid in state.diplomacy) state.diplomacy[pid].relation = -10;

  updateStoryThreads(state);
  updateDramaDirector(state);

  check('globale Tension ist deutlich erhöht', state.drama.tension >= 40);
  const thread = getActiveStoryThreads(state).find(t => t.actorIds.includes(rivalId));
  check('der Konflikt wird als Story Thread erkannt', !!thread);
  if (thread) {
    check('Thread-Tension ist hoch', thread.tension >= 50);
    check('Dieser Thread wird zum Fokus (einzig relevanter aktiver Thread)', state.drama.focusThreadId === thread.id);
  }
})();

// ---------- §Phase-11: unzufriedene Stände fließen in die globale Tension ein ----------
console.log('--- Phase 11: Stände-Unruhe als Tension-Komponente ---');
(function() {
  const state = newGame({ seed: 61 });
  const before = computeDramaTensionBreakdown(state).total;
  for (const pid of ESTATE_DEFINITIONS.bauernschaft.popGroups) state.regions.player.population[pid].satisfaction = 10;
  for (const pid of ESTATE_DEFINITIONS.buergertum.popGroups) state.regions.player.population[pid].satisfaction = 10;
  const breakdown = computeDramaTensionBreakdown(state);
  const unrestComponent = breakdown.components.find(c => c.label.includes('Unzufriedene Stände'));
  check('unzufriedene Stände erzeugen eine benannte Tension-Komponente', !!unrestComponent && unrestComponent.value > 0);
  check('globale Tension steigt spürbar gegenüber dem zufriedenen Ausgangszustand', breakdown.total > before);
})();

// ---------- §Phase-11: die sechs Stände-Ketten sind fürs Director-Scoring erreichbar ----------
console.log('--- Phase 11: Stände-Ketten im Director-Scoring ---');
(function() {
  const state = newGame({ seed: 62 });
  state.regions.player.taxRate = 0.5; // Adel-Steuerlast-Interesse auslösen
  updateStoryThreads(state);
  updateDramaDirector(state);
  const explanation = explainDramaState(state);
  check('explainDramaState() bleibt fehlerfrei, obwohl 16 statt 10 Chain-Templates existieren', Array.isArray(explanation.tensionBreakdown));
  // explainEligibleChainScores() darf nicht crashen, auch wenn keine der 6
  // neuen Ketten in CHAIN_THREAD_TYPE eingetragen ist (thread bleibt null) —
  // computeChainDirectorScore() muss diesen Fall bereits robust behandeln.
  let threw = false;
  let scores = [];
  try { scores = explainEligibleChainScores(state); } catch (e) { threw = true; console.log('    Exception: ' + e.message); }
  check('explainEligibleChainScores() wirft keinen Fehler mit neuen, thread-losen Ketten', !threw);
  check('jeder Score hat total/breakdown/threadId', scores.every(s => typeof s.total === 'number' && Array.isArray(s.breakdown) && ('threadId' in s)));
})();

console.log('');
if (failures > 0) { console.log(failures + ' Test(s) fehlgeschlagen.'); process.exit(1); }
console.log('Alle Drama-Director-Tests bestanden.');
`;

eval(gamedata + "\n" + sim + "\n" + testBody);
