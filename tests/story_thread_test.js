// Phase 6 "Story Threads" — Regressionstests (§Punkt 80-84).
// Ausführen mit: node tests/story_thread_test.js
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

function makeSuccessionCandidate(state, traits) {
  const ruler = state.characters[state.rulerId];
  ruler.parentId = ruler.parentId || 'root_thread';
  const id = nextCharId();
  const c = createCharacter('m', 30, ruler.surname);
  c.parentId = ruler.parentId;
  if (traits) c.traits = traits;
  state.characters[id] = c;
  return id;
}

// ---------- §80: Thread Discovery (positiv) ----------
console.log('--- §80: Thread Discovery ---');
(function() {
  const state = newGame({ seed: 40 });
  const id = makeSuccessionCandidate(state, ['rachsuechtig']);
  setClaim(state.characters[id], 'player', 'strong', 'succession_passed_over');
  recordWorldEvent(state, { type: 'PASSED_OVER_IN_SUCCESSION', actorIds: [state.rulerId], targetIds: [id], emotionalWeight: -50 });
  refreshRelationship(state, id, state.rulerId);
  state.characters[id].loyalty = 25;
  state.characters[id].rivalIds.push(state.rulerId);
  const ruler = state.characters[state.rulerId];
  ruler.rivalIds.push(id);
  discoverStoryThreads(state);
  const threads = getActiveStoryThreads(state);
  const match = threads.find(t => t.type === 'SUCCESSION_CONFLICT' && t.actorIds.includes(id));
  check('SUCCESSION_CONFLICT-Thread wird bei starkem Claim + Memory + Rivalität + niedriger Loyalität erkannt', !!match);
  if (match) check('Thread-Titel ist dynamisch (enthält den Charakternamen)', match.title.includes(state.characters[id].name));
})();

// ---------- §81: Negativtest ----------
console.log('--- §81: Negativtest ---');
(function() {
  const state = newGame({ seed: 41 });
  const id = makeSuccessionCandidate(state, ['loyal']);
  // KEIN negativer Memory, KEIN Claim, KEINE Rivalität -> objektiv kein Konfliktsignal.
  // §Punkt 81 sagt wörtlich "kein KONFLIKTthread" — ein unverheirateter
  // erwachsener Verwandter OHNE jeden Streit ist weiterhin ein objektiv
  // gültiger DYNASTIC_ALLIANCE-Kandidat (Heiratsfähigkeit ist keine
  // Konfliktgeschichte) und darf/soll dafür durchaus erkannt werden.
  discoverStoryThreads(state);
  const threads = getActiveStoryThreads(state);
  const conflictMatch = threads.find(t => t.actorIds.includes(id) && (t.type === 'SUCCESSION_CONFLICT' || t.type === 'PERSONAL_RIVALRY'));
  check('ohne reale Konfliktsignale entsteht KEIN Konfliktthread (Beziehung/Loyalität/Trait sprechen dagegen)', !conflictMatch);
})();

// ---------- §82: Dedup-Test ----------
console.log('--- §82: Dedup-Test ---');
(function() {
  const state = newGame({ seed: 42 });
  const id = makeSuccessionCandidate(state, ['rachsuechtig']);
  setClaim(state.characters[id], 'player', 'strong', 'succession_passed_over');
  const m1 = recordWorldEvent(state, { type: 'PASSED_OVER_IN_SUCCESSION', actorIds: [state.rulerId], targetIds: [id], emotionalWeight: -50 });
  refreshRelationship(state, id, state.rulerId);
  state.characters[id].loyalty = 20;
  state.characters[state.rulerId].rivalIds.push(id);
  discoverStoryThreads(state);
  const countAfterFirst = getActiveStoryThreads(state).length;
  // Zweite, passende Memory fuer dieselbe Person -> darf KEINEN zweiten Thread erzeugen
  recordWorldEvent(state, { type: 'PASSED_OVER_IN_SUCCESSION', actorIds: [state.rulerId], targetIds: [id], emotionalWeight: -55 });
  discoverStoryThreads(state);
  const countAfterSecond = getActiveStoryThreads(state).length;
  check('mehrere passende Memories derselben Person erzeugen nur EINEN Thread', countAfterFirst === countAfterSecond);
})();

// ---------- §83: Reaktivierungs-Test ----------
console.log('--- §83: Reaktivierungs-Test ---');
(function() {
  const state = newGame({ seed: 43 });
  const id = makeSuccessionCandidate(state, ['rachsuechtig']);
  setClaim(state.characters[id], 'player', 'strong', 'succession_passed_over');
  recordWorldEvent(state, { type: 'PASSED_OVER_IN_SUCCESSION', actorIds: [state.rulerId], targetIds: [id], emotionalWeight: -30 });
  refreshRelationship(state, id, state.rulerId);
  state.characters[id].loyalty = 40;
  discoverStoryThreads(state);
  const thread = getActiveStoryThreads(state).find(t => t.actorIds.includes(id));
  check('Testaufbau: Thread wurde erkannt', !!thread);
  thread.status = 'DORMANT';
  thread.lastActivityYear = state.year;
  const statusBefore = thread.status;
  // Neue, passende negative Memory -> Reaktivierung
  state.year += 3;
  recordWorldEvent(state, { type: 'PASSED_OVER_IN_SUCCESSION', actorIds: [state.rulerId], targetIds: [id], emotionalWeight: -60 });
  advanceStoryThread(state, thread);
  check('DORMANT-Thread wird durch neue passende Memory reaktiviert (BUILDING/ACTIVE)', thread.status === 'BUILDING' || thread.status === 'ACTIVE');
  check('Status unterscheidet sich vom vorherigen DORMANT', thread.status !== statusBefore);
})();

// ---------- §84: Auflösungs-Test ----------
console.log('--- §84: Auflösungs-Test ---');
(function() {
  const state = newGame({ seed: 44 });
  const id = makeSuccessionCandidate(state, []);
  setClaim(state.characters[id], 'player', 'strong', 'succession_passed_over');
  recordWorldEvent(state, { type: 'PASSED_OVER_IN_SUCCESSION', actorIds: [state.rulerId], targetIds: [id], emotionalWeight: -50 });
  refreshRelationship(state, id, state.rulerId);
  state.characters[id].loyalty = 20;
  state.characters[state.rulerId].rivalIds.push(id);
  discoverStoryThreads(state);
  const thread = getActiveStoryThreads(state).find(t => t.actorIds.includes(id));
  check('Testaufbau: Thread aktiv', !!thread && thread.status !== 'DORMANT');
  thread.status = 'ACTIVE';

  // Beziehung verbessert sich stark, Rivalität endet, Claim wird entfernt -> Signal verschwindet
  state.characters[state.rulerId].rivalIds = [];
  state.characters[id].rivalIds = [];
  state.characters[id].claims = state.characters[id].claims.filter(cl => cl.reason !== 'succession_passed_over');
  state.characters[id].loyalty = 80;

  let iterations = 0;
  while (state.storyThreads.active[thread.id] && iterations < 10) {
    state.year += 1;
    advanceStoryThread(state, thread);
    iterations++;
  }
  check('Thread löst sich nach verschwundenem Signal auf (RESOLVED, kein erzwungener Klimax)', state.storyThreads.resolved[thread.id] && state.storyThreads.resolved[thread.id].status === 'RESOLVED');
})();

// ---------- Ergänzend: Thread <-> Chain-Verknüpfung ----------
console.log('--- Thread<->Chain-Verknüpfung ---');
(function() {
  const state = newGame({ seed: 45 });
  const id = makeSuccessionCandidate(state, ['rachsuechtig']);
  setClaim(state.characters[id], 'player', 'strong', 'succession_passed_over');
  const chain = startEventChain(state, 'passed_over_heir', { actorIds: [id], targetIds: [] });
  check('startEventChain() verknüpft automatisch mit einem Thread', chain.threadId !== null);
  const thread = state.storyThreads.active[chain.threadId];
  check('Thread kennt die Chain', !!thread && thread.chainIds.includes(chain.id));
  check('Thread-Typ passt zur Chain (SUCCESSION_CONFLICT)', thread.type === 'SUCCESSION_CONFLICT');
})();

// ---------- Ergänzend: Chronik-Zusammenfassung (§Punkt 72/73) ----------
console.log('--- Thread-Zusammenfassung ---');
(function() {
  const state = newGame({ seed: 46 });
  const id = makeSuccessionCandidate(state, []);
  const thread = createStoryThread(state, 'SUCCESSION_CONFLICT', { actorIds: [id], regionIds: [], memoryIds: [], strength: 60 });
  resolveStoryThread(state, thread, 'RECONCILED');
  const summary = summarizeStoryThread(thread);
  check('Zusammenfassung enthält Titel', summary.includes(thread.title.toUpperCase()));
  check('Zusammenfassung enthält das Ergebnis', summary.includes('RECONCILED'));
})();

console.log('');
if (failures > 0) { console.log(failures + ' Test(s) fehlgeschlagen.'); process.exit(1); }
console.log('Alle Story-Thread-Tests bestanden.');
`;

eval(gamedata + "\n" + sim + "\n" + testBody);
