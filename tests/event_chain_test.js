// Phase 5 "Event Chains" — Regressionstests (§Punkt 74-82).
// Ausführen mit: node tests/event_chain_test.js
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

// ---------- §74: Charakter-Chain-Test (übergangener Erbe wird eligible) ----------
console.log('--- §74: Charakter-Chain-Test (positiv) ---');
(function() {
  const state = newGame({ seed: 20 });
  const ruler = state.characters[state.rulerId];
  ruler.parentId = ruler.parentId || 'root74';
  const brotherId = nextCharId();
  const brother = createCharacter('m', 30, ruler.surname);
  brother.parentId = ruler.parentId;
  brother.traits = ['rachsuechtig'];
  state.characters[brotherId] = brother;
  setClaim(brother, 'player', 'strong', 'succession_passed_over');
  recordWorldEvent(state, { type: 'PASSED_OVER_IN_SUCCESSION', actorIds: [state.rulerId], targetIds: [brotherId], emotionalWeight: -60 });
  refreshRelationship(state, brotherId, state.rulerId);
  brother.loyalty = 20;
  const result = canStartPassedOverHeirChain(state);
  check('übergangener Bruder mit starkem Claim + Memory + niedriger Loyalität/Beziehung wird eligible', result.eligible === true);
  check('payload referenziert den richtigen Charakter', result.payload.actorIds[0] === brotherId);
})();

// ---------- §75: Negativtest (loyal + gute Beziehung darf NICHT triggern) ----------
console.log('--- §75: Negativtest ---');
(function() {
  const state = newGame({ seed: 21 });
  const ruler = state.characters[state.rulerId];
  ruler.parentId = ruler.parentId || 'root75';
  const sibId = nextCharId();
  const sib = createCharacter('m', 30, ruler.surname);
  sib.parentId = ruler.parentId;
  sib.traits = ['loyal'];
  state.characters[sibId] = sib;
  setClaim(sib, 'player', 'strong', 'succession_passed_over');
  recordWorldEvent(state, { type: 'PASSED_OVER_IN_SUCCESSION', actorIds: [state.rulerId], targetIds: [sibId], emotionalWeight: 5 }); // symbolisch, Beziehung wird unten direkt gesetzt
  sib.loyalty = 95;
  // Beziehung künstlich sehr gut machen: keine negativen Memories, nur starke strukturelle Boni
  sib.spouseId = null;
  refreshRelationship(state, sibId, state.rulerId);
  const rel = computeRelationshipBreakdown(state, sibId, state.rulerId);
  check('Testaufbau: Beziehung tatsächlich hoch (>= 0)', rel.total >= 0);
  const result = canStartPassedOverHeirChain(state);
  check('starker Claim + gute Beziehung + hohe Loyalität + loyal-Trait: KEIN Start', result.eligible === false);
})();

// ---------- §76: Hunger-Test ----------
console.log('--- §76: Hunger-Test ---');
(function() {
  const state = newGame({ seed: 22 });
  const normalResult = canStartFamineCrisisChain(state);
  check('normale Versorgung (keine FAMINE-Memory): keine Hunger-Kette eligible', normalResult.eligible === false);
  recordWorldEvent(state, { type: 'FAMINE', regionIds: ['player'], emotionalWeight: -60, description: 'Testhungersnot' });
  const famineResult = canStartFamineCrisisChain(state);
  check('echte Hungerkrise (FAMINE-Memory vorhanden): Hunger-Kette eligible', famineResult.eligible === true);
})();

// ---------- §77: Korruptions-Test ----------
console.log('--- §77: Korruptions-Test ---');
(function() {
  const state = newGame({ seed: 23 });
  const res1 = openAdvisorSelection(state, 'schatzmeister');
  check('Testaufbau: Kandidatenauswahl öffnet', res1.ok === true);
  confirmAdvisorSelection(state, 0);
  const advId = state.advisors.schatzmeister;
  const adv = state.characters[advId];
  adv.traits = ['korrupt'];
  adv.loyalty = 30;
  state.characters[state.rulerId].stats.verwaltung = 5;
  // frisch berufen (appointedYear = aktuelles Jahr) -> Amtsdauer-Bedingung NICHT erfüllt
  const freshResult = canStartCorruptTreasurerChain(state);
  check('frisch berufener korrupter Schatzmeister (Amtsdauer < 3): NICHT automatisch eligible', freshResult.eligible === false);
  // Amtsdauer künstlich verlängern
  adv.appointedYear = state.year - 5;
  const tenuredResult = canStartCorruptTreasurerChain(state);
  check('korrupter Schatzmeister mit Amtsdauer + niedriger Loyalität + schwacher Kontrolle: eligible', tenuredResult.eligible === true);
})();

// ---------- §78: Determinismus-Test ----------
console.log('--- §78: Determinismus-Test ---');
(function() {
  function run(seed) {
    const state = newGame({ seed });
    const log = [];
    for (let y = 0; y < 60; y++) {
      for (let m = 0; m < 12; m++) {
        advanceMonth(state);
        if (state.pendingEvent && state.pendingEvent.source === 'EVENT_CHAIN') log.push(state.pendingEvent.chainId + ':' + state.pendingEvent.title);
        resolvePendingEventWithPolicy(state, 'FIRST_OPTION');
        if (state.gameOver) break;
      }
      if (state.gameOver) break;
    }
    return { log, resolved: Object.keys(state.eventChains.resolved).map(id => state.eventChains.resolved[id].templateId + ':' + state.eventChains.resolved[id].resolution) };
  }
  const a = run(555);
  const b = run(555);
  check('gleicher Seed + gleiche Policy erzeugt identischen Chain-Verlauf', JSON.stringify(a) === JSON.stringify(b));
})();

// ---------- §79: Save/Load mitten in einer Kette ----------
console.log('--- §79: Save/Load-Test ---');
(function() {
  const state = newGame({ seed: 24 });
  const ruler = state.characters[state.rulerId];
  ruler.parentId = ruler.parentId || 'root79';
  const brotherId = nextCharId();
  const brother = createCharacter('m', 30, ruler.surname);
  brother.parentId = ruler.parentId;
  state.characters[brotherId] = brother;
  const chain = startEventChain(state, 'passed_over_heir', { actorIds: [brotherId], targetIds: [] });
  chain.variables.nextYear = state.year; // sofort fällig
  CHAIN_TEMPLATES.passed_over_heir.advance(state, chain);
  check('Testaufbau: Kette hat eine Entscheidung angeboten', !!state.pendingEvent && state.pendingEvent.chainId === chain.id);
  const stageBefore = chain.stage;
  const json = serializeSave(state);
  const loaded = deserializeSave(json);
  const loadedChain = loaded.eventChains.active[chain.id];
  check('Kette bleibt nach Laden erhalten', !!loadedChain);
  check('Stage bleibt exakt erhalten', loadedChain.stage === stageBefore);
  check('pendingEvent-Optionen sind nach dem Laden nicht mehr direkt aufrufbar (erwartetes JSON-Verhalten), aber der Chain-State ist vollständig', Array.isArray(loadedChain.history) && loadedChain.history.length >= 1);
})();

// ---------- §80: Chain-History-Test ----------
console.log('--- §80: Chain-History-Test ---');
(function() {
  const state = newGame({ seed: 25 });
  const ruler = state.characters[state.rulerId];
  ruler.parentId = ruler.parentId || 'root80';
  const brotherId = nextCharId();
  const brother = createCharacter('m', 30, ruler.surname);
  brother.parentId = ruler.parentId;
  state.characters[brotherId] = brother;
  const chain = startEventChain(state, 'passed_over_heir', { actorIds: [brotherId], targetIds: [] });
  chain.variables.nextYear = state.year;
  CHAIN_TEMPLATES.passed_over_heir.advance(state, chain);
  const historyLenBefore = chain.history.length;
  resolvePendingEventWithPolicy(state, 'FIRST_OPTION');
  check('Vergangene Entscheidung wird der History hinzugefügt', chain.history.length > historyLenBefore);
  check('History-Eintrag trägt Jahr und Stage', chain.history.every(h => h.year !== undefined && h.stage !== undefined));
})();

// ---------- §81: Memory-Test (korrekt, keine Duplikate) ----------
console.log('--- §81: Memory-Test ---');
(function() {
  const state = newGame({ seed: 26 });
  const ruler = state.characters[state.rulerId];
  ruler.parentId = ruler.parentId || 'root81';
  const brotherId = nextCharId();
  const brother = createCharacter('m', 30, ruler.surname);
  brother.parentId = ruler.parentId;
  state.characters[brotherId] = brother;
  const chain = startEventChain(state, 'passed_over_heir', { actorIds: [brotherId], targetIds: [] });
  chain.variables.nextYear = state.year;
  CHAIN_TEMPLATES.passed_over_heir.advance(state, chain);
  const memCountBefore = Object.keys(state.memories.byId).length;
  resolvePendingEventWithPolicy(state, 'FIRST_OPTION'); // erste Option: Amt anbieten -> DEMAND_ACCEPTED
  const memCountAfter = Object.keys(state.memories.byId).length;
  check('Entscheidung erzeugt genau eine neue Memory', memCountAfter === memCountBefore + 1);
  const newMemories = getMemoriesByType(state, 'DEMAND_ACCEPTED');
  check('Memory hat korrekten Typ', newMemories.length === 1);
  check('Memory referenziert die richtigen Beteiligten', newMemories[0].targetIds.includes(brotherId));
})();

// ---------- §82: Relationship-Test ----------
console.log('--- §82: Relationship-Test ---');
(function() {
  const state = newGame({ seed: 27 });
  const ruler = state.characters[state.rulerId];
  ruler.parentId = ruler.parentId || 'root82';
  const brotherId = nextCharId();
  const brother = createCharacter('m', 30, ruler.surname);
  brother.parentId = ruler.parentId;
  state.characters[brotherId] = brother;
  recordWorldEvent(state, { type: 'PASSED_OVER_IN_SUCCESSION', actorIds: [state.rulerId], targetIds: [brotherId], emotionalWeight: -45 });
  refreshRelationship(state, brotherId, state.rulerId);
  const relBefore = computeRelationshipBreakdown(state, brotherId, state.rulerId).total;
  const chain = startEventChain(state, 'passed_over_heir', { actorIds: [brotherId], targetIds: [] });
  chain.variables.nextYear = state.year;
  CHAIN_TEMPLATES.passed_over_heir.advance(state, chain);
  resolvePendingEventWithPolicy(state, 'FIRST_OPTION'); // Amt anbieten -> sollte Beziehung verbessern
  const relAfter = computeRelationshipBreakdown(state, brotherId, state.rulerId).total;
  check('Amt-Angebot verbessert die Beziehung messbar über World Memory', relAfter > relBefore);
})();

// ---------- Ergänzend: Debug-Erklärung liefert sinnvolle Struktur ----------
console.log('--- Debug-Erklärung ---');
(function() {
  const state = newGame({ seed: 28 });
  const explanation = explainChainEligibility(state, 'famine_crisis');
  check('explainChainEligibility liefert Name und Checks', explanation.name === 'Hungerkrise' && Array.isArray(explanation.checks));
  check('nicht erfüllte Kette wird korrekt als "nicht eligible" markiert', explanation.eligible === false);
})();

// ---------- Ergänzend: alle 10 Templates + jede Option durchspielen ----------
// Reines Passivspiel erreicht nur 4 der 10 Ketten (siehe
// phase5_event_chain_metrics_test.js) — dieser synthetische Smoke-Test
// erzwingt für ALLE 10 Templates jede einzelne Entscheidungsoption, damit
// kein Code-Pfad ungetestet bleibt, nur weil ihn passives Spiel nie erreicht.
console.log('--- Smoke-Test: alle 10 Templates x alle Optionen ---');
(function() {
  function freshRuler(seed) {
    const state = newGame({ seed });
    const ruler = state.characters[state.rulerId];
    ruler.parentId = ruler.parentId || ('root_smoke_' + seed);
    return state;
  }
  function makeRelative(state, traits) {
    const ruler = state.characters[state.rulerId];
    const id = nextCharId();
    const c = createCharacter('m', 30, ruler.surname);
    c.parentId = ruler.parentId;
    if (traits) c.traits = traits;
    state.characters[id] = c;
    return id;
  }

  const setups = {
    passed_over_heir: (state) => {
      const id = makeRelative(state, ['rachsuechtig']);
      setClaim(state.characters[id], 'player', 'strong', 'succession_passed_over');
      return { actorIds: [id], targetIds: [] };
    },
    grieved_advisor: (state) => {
      const id = makeRelative(state, ['ehrgeizig']);
      return { actorIds: [id], targetIds: [] };
    },
    corrupt_treasurer: (state) => {
      openAdvisorSelection(state, 'schatzmeister');
      confirmAdvisorSelection(state, 0);
      const advId = state.advisors.schatzmeister;
      state.characters[advId].traits = ['korrupt'];
      state.characters[advId].loyalty = 20;
      state.characters[advId].appointedYear = state.year - 5;
      state.characters[state.rulerId].stats.verwaltung = 5;
      return { actorIds: [advId], targetIds: [] };
    },
    famine_crisis: (state) => ({ regionIds: ['player'], variables: {} }),
    trade_conflict: (state) => ({ regionIds: ['player'], variables: { partner: null } }),
    border_conflict: (state) => ({ regionIds: ['ai1'], variables: {} }),
    dynastic_marriage: (state) => {
      const id = makeRelative(state, []);
      return { actorIds: [id], regionIds: ['ai1'], variables: {} };
    },
    church_conflict: (state) => ({ variables: {} }),
    rising_rival: (state) => {
      const id = makeRelative(state, []);
      const ruler = state.characters[state.rulerId];
      ruler.rivalIds.push(id);
      state.characters[id].rivalIds.push(state.rulerId);
      state.characters[id].advisorRole = 'diplomat'; // "Amt" fürs Eligibility-Kriterium
      return { actorIds: [id], targetIds: [] };
    },
    imperial_ambition: (state) => { state.titleIndex = TITLES.findIndex(t => t.id === 'kurfuerst'); state.prestige = 300; return { variables: {} }; },
  };

  let seedCounter = 900;
  for (const templateId in CHAIN_TEMPLATES) {
    const tpl = CHAIN_TEMPLATES[templateId];
    const buildPayload = setups[templateId];
    // Anzahl Optionen ermitteln: eine Trockenrunde, dann für jede Option neu aufsetzen.
    // Manche Templates (passed_over_heir/grieved_advisor) haben eine anfängliche
    // Verzögerungsstufe (resentment/grudge) — bis zu 5 Jahre vorspulen, um die
    // erste tatsächliche Entscheidung zu erreichen.
    let optionCount = 0;
    {
      const state = freshRuler(seedCounter++);
      const payload = buildPayload(state);
      const chain = startEventChain(state, templateId, payload);
      for (let y = 0; y < 6 && !state.pendingEvent; y++) { tpl.advance(state, chain); state.year += 1; }
      optionCount = state.pendingEvent ? state.pendingEvent.options.length : 0;
      check(templateId + ': eine Entscheidung mit >=2 Optionen wird angeboten', optionCount >= 2);
    }
    for (let i = 0; i < optionCount; i++) {
      let threw = false;
      try {
        const state = freshRuler(seedCounter++);
        const payload = buildPayload(state);
        const chain = startEventChain(state, templateId, payload);
        for (let y = 0; y < 6 && !state.pendingEvent; y++) { tpl.advance(state, chain); state.year += 1; }
        if (state.pendingEvent && state.pendingEvent.options[i]) {
          state.pendingEvent.options[i].apply(state.regions.player, state);
        }
        // ggf. weitere Jahre simulieren, um Folgestufen (escalation/watching/aftermath) zu erreichen
        for (let extra = 0; extra < 25 && state.eventChains.active[chain.id]; extra++) {
          state.year += 1;
          tpl.advance(state, chain);
          if (state.pendingEvent && state.pendingEvent.chainId === chain.id) {
            state.pendingEvent.options[0].apply(state.regions.player, state);
          }
        }
      } catch (e) {
        threw = true;
        console.log('    Exception bei ' + templateId + ' Option ' + i + ': ' + e.message);
      }
      check(templateId + ' Option ' + i + ': kein Laufzeitfehler', !threw);
    }
  }
})();

console.log('');
if (failures > 0) { console.log(failures + ' Test(s) fehlgeschlagen.'); process.exit(1); }
console.log('Alle Event-Chain-Tests bestanden.');
`;

eval(gamedata + "\n" + sim + "\n" + testBody);
