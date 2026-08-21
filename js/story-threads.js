// ============================================================
// STORY THREADS — Phase 6 "Aus einzelnen Geschichten wird eine lebendige
// Kampagne": größere, mehrjährige Erzählbögen, die mehrere Event Chains,
// Memories und Zustände zu EINER Geschichte bündeln (§Punkt 5/11). Eine
// Chain erzählt "Der gekränkte Berater"; ein Thread kann über Jahrzehnte
// "Der Konflikt zwischen Friedrich und Wilhelm" erzählen.
//
// KEIN RNG (§Punkt 37/38): Threads existieren, weil ihre Voraussetzungen
// objektiv im Weltzustand vorhanden sind — discoverStoryThreads() würfelt
// nie "entsteht ein Thread?".
//
// Architektur: 8 Thread-Typen (STORY_THREAD_TYPES), jeder mit genau einer
// detect(state)-Funktion, die aktuelle Signal-Kandidaten liefert (Akteure/
// Regionen/Memories + eine grobe Anfangsstärke). advanceStoryThread()
// bewertet pro Jahr, ob das Signal noch besteht, aktualisiert Tension/
// Momentum/Importance und die Statusmaschine DORMANT/BUILDING/ACTIVE/
// CLIMAX/AFTERMATH/RESOLVED(/EXPIRED). discoverStoryThreads() legt für
// noch nicht abgedeckte Kandidaten neue Threads an (§Punkt 12: Dedup pro
// Typ+Beteiligte, keine Fast-Duplikate).
// ============================================================

// §Punkt 57: optionale, stark vereinfachte "Story Beats" — rein aus dem
// Status abgeleitet, keine eigene Zustandsmaschine.
const STAGE_FOR_STATUS = {
  DORMANT: "SETUP", BUILDING: "SETUP", ACTIVE: "DEVELOPMENT",
  CLIMAX: "CLIMAX", AFTERMATH: "RESOLUTION", RESOLVED: "RESOLUTION", EXPIRED: "RESOLUTION",
};

// §Punkt 47: welchem Thread-Typ eine Event Chain thematisch zugeordnet ist.
const CHAIN_THREAD_TYPE = {
  passed_over_heir: "SUCCESSION_CONFLICT",
  rising_rival: "PERSONAL_RIVALRY",
  grieved_advisor: "PERSONAL_RIVALRY",
  corrupt_treasurer: "ECONOMIC_CRISIS",
  trade_conflict: "ECONOMIC_CRISIS",
  famine_crisis: "FOOD_CRISIS",
  border_conflict: "FOREIGN_CONFLICT",
  church_conflict: "RELIGIOUS_CONFLICT",
  dynastic_marriage: "DYNASTIC_ALLIANCE",
  imperial_ambition: "IMPERIAL_AMBITION",
};

// ---------- Signal-Erkennung je Thread-Typ (§Punkt 9/10, kein RNG) ----------
// Jede detect()-Funktion liefert Kandidaten {actorIds, regionIds, memoryIds,
// strength (0-100, grobe Anfangs-/Vergleichsstärke)} — nur für Zustände,
// die bereits objektiv bestehen. Absichtlich an denselben Signalen wie die
// jeweiligen Event-Chain-Eligibility-Prüfungen orientiert (§Punkt 11: eine
// Chain IST Teil dessen, was ein Thread aggregiert), aber gröber/breiter,
// da ein Thread eine ganze Geschichte statt eines einzelnen Ereignisses
// beschreibt.

function detectSuccessionConflictSignals(state) {
  const out = [];
  for (const id in state.characters) {
    const c = state.characters[id];
    if (!c.alive || id === state.rulerId) continue;
    const claim = c.claims.find(cl => cl.titleId === "player" && cl.reason === "succession_passed_over");
    if (!claim) continue;
    const mems = getMemoriesByType(state, "PASSED_OVER_IN_SUCCESSION").filter(m => m.targetIds.includes(id));
    if (!mems.length) continue;
    const rel = computeRelationshipBreakdown(state, id, state.rulerId);
    let strength = 30;
    if (rel.total < -15) strength += 20;
    if (c.loyalty < 45) strength += 15;
    if (c.rivalIds.includes(state.rulerId)) strength += 20;
    out.push({ actorIds: [id], regionIds: [], memoryIds: mems.map(m => m.id), strength: clamp(strength, 0, 100) });
  }
  return out;
}

// §Punkt 11-Abgrenzung: eine Rivalität MIT dynastischem Anspruch wird als
// SUCCESSION_CONFLICT erkannt (oben), nicht zusätzlich hier — sonst
// entstünden zwei fast identische Threads für dieselbe Person.
function detectPersonalRivalrySignals(state) {
  const out = [];
  const ruler = state.characters[state.rulerId];
  if (!ruler) return out;
  for (const rid of ruler.rivalIds) {
    const c = state.characters[rid];
    if (!c || !c.alive) continue;
    const hasSuccessionClaim = c.claims.some(cl => cl.titleId === "player" && cl.reason === "succession_passed_over");
    if (hasSuccessionClaim) continue;
    const mems = getMemoriesByType(state, "RIVALRY_BEGAN").filter(m => m.actorIds.includes(rid) || m.targetIds.includes(rid));
    const rel = computeRelationshipBreakdown(state, rid, state.rulerId);
    let strength = 35;
    if (rel.total < -25) strength += 20;
    if (c.advisorRole) strength += 10;
    out.push({ actorIds: [rid], regionIds: [], memoryIds: mems.map(m => m.id), strength: clamp(strength, 0, 100) });
  }
  return out;
}

function detectEconomicCrisisSignals(state) {
  const r = state.regions.player;
  const debtBad = (state.debt || 0) > 500;
  const tradeBad = r.taxRate > 0.3 && r.population.haendler.satisfaction < 30;
  if (!debtBad && !tradeBad) return [];
  let strength = 30;
  if (debtBad) strength += 25;
  if (tradeBad) strength += 20;
  return [{ actorIds: [], regionIds: ["player"], memoryIds: [], strength: clamp(strength, 0, 100) }];
}

// §Punkt 10: keine künstliche Schwelle — nutzt dieselbe echte FAMINE-
// Memory wie famine_crisis (js/event-chains.js) und js/memory.js.
function detectFoodCrisisSignals(state) {
  const mems = getMemoriesByType(state, "FAMINE").filter(m => m.year >= state.year - 3);
  if (!mems.length) return [];
  const regionIds = mems[0].regionIds.length ? mems[0].regionIds : ["player"];
  return [{ actorIds: [], regionIds, memoryIds: mems.map(m => m.id), strength: 60 }];
}

function detectForeignConflictSignals(state) {
  const out = [];
  for (const aiId in state.diplomacy) {
    const dip = state.diplomacy[aiId];
    const atWar = !!(state.warState && state.warState[aiId]);
    const badRelation = dip.relation < -25;
    if (!atWar && !badRelation) continue;
    out.push({ actorIds: [], regionIds: [aiId], memoryIds: [], strength: atWar ? 70 : 35 });
  }
  return out;
}

function detectReligiousConflictSignals(state) {
  const infl = state.religiousInfluence !== undefined ? state.religiousInfluence : 55;
  if (infl >= CONFIG.religion.lowInfluenceThreshold + 15) return [];
  return [{ actorIds: [], regionIds: ["player"], memoryIds: [], strength: 40 }];
}

function detectImperialAmbitionSignals(state) {
  const kurfuerstRank = TITLES.findIndex(t => t.id === "kurfuerst");
  if (state.titleIndex < kurfuerstRank && state.prestige < 150) return [];
  return [{ actorIds: [], regionIds: [], memoryIds: [], strength: 40 }];
}

function detectDynasticAllianceSignals(state) {
  const cfg = CONFIG.eventChains;
  const out = [];
  const ruler = state.characters[state.rulerId];
  if (!ruler) return out;
  const familyIds = ruler.childrenIds.concat(
    ruler.parentId ? Object.keys(state.characters).filter(id => state.characters[id].parentId === ruler.parentId && id !== state.rulerId) : []
  );
  for (const id of familyIds) {
    const c = state.characters[id];
    if (c && c.alive && c.age >= cfg.adultAge && !c.spouseId) out.push({ actorIds: [id], regionIds: [], memoryIds: [], strength: 25 });
  }
  return out;
}

const STORY_THREAD_TYPES = {
  SUCCESSION_CONFLICT: { detect: detectSuccessionConflictSignals },
  PERSONAL_RIVALRY: { detect: detectPersonalRivalrySignals },
  ECONOMIC_CRISIS: { detect: detectEconomicCrisisSignals },
  FOOD_CRISIS: { detect: detectFoodCrisisSignals },
  FOREIGN_CONFLICT: { detect: detectForeignConflictSignals },
  RELIGIOUS_CONFLICT: { detect: detectReligiousConflictSignals },
  IMPERIAL_AMBITION: { detect: detectImperialAmbitionSignals },
  DYNASTIC_ALLIANCE: { detect: detectDynasticAllianceSignals },
};

// ---------- Spielerfreundliche, dynamische Titel (§Punkt 51/52) ----------
function generateThreadTitle(state, type, candidate) {
  const nameOf = (id) => state.characters[id] ? `${state.characters[id].name} ${state.characters[id].surname || ""}`.trim() : id;
  const regionOf = (id) => state.regions[id] ? state.regions[id].name : id;
  switch (type) {
    case "SUCCESSION_CONFLICT": return `Der Anspruch von ${nameOf(candidate.actorIds[0])}`;
    case "PERSONAL_RIVALRY": return `Der Streit mit ${nameOf(candidate.actorIds[0])}`;
    case "ECONOMIC_CRISIS": return `Die Wirtschaftsnot von ${state.regions.player.name}`;
    case "FOOD_CRISIS": return `Die Hungerjahre von ${candidate.regionIds[0] ? regionOf(candidate.regionIds[0]) : state.regions.player.name}`;
    case "FOREIGN_CONFLICT": return `Der Konflikt mit ${regionOf(candidate.regionIds[0])}`;
    case "RELIGIOUS_CONFLICT": return `Der Zwist mit der Kirche`;
    case "IMPERIAL_AMBITION": return `Der Weg zur Kaiserkrone`;
    case "DYNASTIC_ALLIANCE": return `Das Heiratsbündnis von ${nameOf(candidate.actorIds[0])}`;
    default: return type;
  }
}

// ---------- Matching/Dedup (§Punkt 12) ----------
function candidateMatchesThread(thread, candidate) {
  if (candidate.actorIds && candidate.actorIds.length) return candidate.actorIds.some(id => thread.actorIds.includes(id));
  if (candidate.regionIds && candidate.regionIds.length) return candidate.regionIds.some(id => thread.regionIds.includes(id));
  return thread.actorIds.length === 0 && thread.regionIds.length === 0; // globaler Typ ohne feste Beteiligte
}

function findExistingThreadForCandidate(state, type, candidate) {
  return Object.values(state.storyThreads.active).find(t => t.type === type && candidateMatchesThread(t, candidate));
}

function recordThreadHistory(thread, year, note) {
  thread.history.push({ year, status: thread.status, note });
}

// ---------- Importance/Momentum (§Punkt 30/32) ----------
function computeThreadImportance(state, thread) {
  let imp = 20;
  const ruler = state.characters[state.rulerId];
  if (thread.actorIds.includes(state.rulerId)) imp += 20;
  if (ruler && thread.actorIds.some(id => ruler.childrenIds.includes(id))) imp += 15; // Erbe beteiligt
  if (thread.regionIds.includes("player")) imp += 10;
  if (thread.type === "FOOD_CRISIS" || thread.type === "ECONOMIC_CRISIS") imp += 10; // betrifft die Bevölkerung
  if (thread.type === "IMPERIAL_AMBITION") imp += 25; // Kaiserwahl, §Punkt 56 "sehr groß"
  if (thread.type === "SUCCESSION_CONFLICT") imp += 20; // Thronfolge, §Punkt 56 "groß"
  if (thread.type === "FOREIGN_CONFLICT" && thread.regionIds.some(id => state.warState && state.warState[id])) imp += 15; // echter Krieg
  imp += Math.min(thread.memoryIds.length * 3, 15); // historischer Einfluss
  return clamp(Math.round(imp), 0, 100);
}

function updateThreadMomentum(thread, gainedNewSignal) {
  thread.momentum = gainedNewSignal ? clamp(thread.momentum + 30, 0, 100) : clamp(Math.round(thread.momentum * 0.8), 0, 100);
}

// ---------- Erzeugung ----------
function createStoryThread(state, type, candidate) {
  const id = "st" + state.storyThreads.nextId++;
  const initialStatus = candidate.strength >= 55 ? "ACTIVE" : (candidate.strength >= 35 ? "BUILDING" : "DORMANT");
  const title = generateThreadTitle(state, type, candidate);
  const thread = {
    id, type, title,
    status: initialStatus, stage: STAGE_FOR_STATUS[initialStatus],
    startedYear: state.year, lastActivityYear: state.year,
    actorIds: (candidate.actorIds || []).slice(), regionIds: (candidate.regionIds || []).slice(),
    memoryIds: (candidate.memoryIds || []).slice(), chainIds: [],
    tension: candidate.strength, importance: 0, momentum: 25,
    tags: [type.toLowerCase()],
    history: [],
    resolution: null,
  };
  thread.importance = computeThreadImportance(state, thread);
  recordThreadHistory(thread, state.year, `${title} beginnt.`);
  state.storyThreads.active[id] = thread;
  return thread;
}

function threadParticipantsAlive(state, thread) {
  return thread.actorIds.every(id => { const c = state.characters[id]; return c ? c.alive : true; });
}

function resolveStoryThread(state, thread, resolution) {
  thread.status = "RESOLVED";
  thread.stage = STAGE_FOR_STATUS.RESOLVED;
  thread.resolution = resolution;
  recordThreadHistory(thread, state.year, `${thread.title}: ${resolution}.`);
  // §Punkt 70: nur wirklich bedeutsame Geschichten hinterlassen eine
  // strukturierte Abschluss-Memory — keine Memory-Typ-/Mengen-Explosion.
  if (thread.importance >= 50) {
    const memory = recordWorldEvent(state, {
      type: "MAJOR_STORY_RESOLVED", actorIds: thread.actorIds.slice(), regionIds: thread.regionIds.slice(),
      importance: thread.importance, emotionalWeight: 0,
      metadata: { threadId: thread.id, threadType: thread.type },
      description: `${thread.title} findet ihren Abschluss.`,
    });
    thread.memoryIds.push(memory.id);
  }
  delete state.storyThreads.active[thread.id];
  state.storyThreads.resolved[thread.id] = thread;
}

function expireStoryThread(state, thread, reason) {
  thread.status = "EXPIRED";
  thread.stage = STAGE_FOR_STATUS.EXPIRED;
  thread.resolution = reason;
  recordThreadHistory(thread, state.year, `${thread.title}: ${reason}.`);
  delete state.storyThreads.active[thread.id];
  state.storyThreads.resolved[thread.id] = thread;
}

// ---------- Jährliches Fortschreiben (§Punkt 14/15/33/34) ----------
function advanceStoryThread(state, thread) {
  if (!threadParticipantsAlive(state, thread)) { expireStoryThread(state, thread, "Ein Beteiligter ist verstorben"); return; }

  const typeDef = STORY_THREAD_TYPES[thread.type];
  const signals = typeDef ? typeDef.detect(state) : [];
  const matching = signals.find(s => candidateMatchesThread(thread, s));

  let gainedNewSignal = false;
  if (matching) {
    const newMemIds = (matching.memoryIds || []).filter(id => !thread.memoryIds.includes(id));
    if (newMemIds.length) { thread.memoryIds.push(...newMemIds); gainedNewSignal = true; }
    if (matching.strength > thread.tension) gainedNewSignal = true; // spürbare Verschärfung zählt ebenfalls als Aktivität
    thread.tension = matching.strength;
    if (gainedNewSignal) thread.lastActivityYear = state.year;
  } else {
    thread.tension = Math.round(thread.tension * 0.6); // Signal verschwunden -> klingt ab
  }
  updateThreadMomentum(thread, gainedNewSignal);
  thread.importance = computeThreadImportance(state, thread);

  const yearsSinceActivity = state.year - thread.lastActivityYear;
  const prevStatus = thread.status;

  if (!matching || thread.tension < 10) {
    // §Punkt 15: friedliches/verschwindendes Signal -> Richtung Auflösung,
    // kein erzwungener Klimax.
    if (thread.status === "CLIMAX" || thread.status === "ACTIVE") {
      thread.status = "AFTERMATH";
    } else if (thread.status === "AFTERMATH") {
      if (yearsSinceActivity >= CONFIG.storyThreads.aftermathYears) { resolveStoryThread(state, thread, "RESOLVED"); return; }
    } else if (thread.status === "BUILDING" || thread.status === "DORMANT") {
      resolveStoryThread(state, thread, "FADED"); // wurde nie zu einer richtigen Geschichte
      return;
    }
  } else {
    // Signal weiterhin vorhanden.
    if (thread.status === "ACTIVE" && yearsSinceActivity > CONFIG.storyThreads.dormancyYears) {
      thread.status = "DORMANT"; // §Punkt 33: lange keine neue Aktivität -> schläft, obwohl die Grundspannung bleibt
    } else if (thread.status === "DORMANT" && gainedNewSignal) {
      thread.status = "BUILDING"; // §Punkt 34: Reaktivierung durch neue passende Memory
    } else if (thread.tension >= 80) {
      thread.status = "CLIMAX";
    } else if (thread.tension >= 55 && thread.status !== "DORMANT") {
      thread.status = "ACTIVE";
    } else if (thread.tension >= 35 && (thread.status === "DORMANT" || thread.status === "BUILDING")) {
      thread.status = "BUILDING";
    }
  }
  thread.stage = STAGE_FOR_STATUS[thread.status] || thread.stage;
  if (thread.status !== prevStatus) recordThreadHistory(thread, state.year, `${thread.title}: ${prevStatus} -> ${thread.status}.`);
}

// §Punkt 37/38: Discovery liest nur den Zustand, kein rnd()-Aufruf.
function discoverStoryThreads(state) {
  for (const type in STORY_THREAD_TYPES) {
    const signals = STORY_THREAD_TYPES[type].detect(state);
    for (const candidate of signals) {
      if (findExistingThreadForCandidate(state, type, candidate)) continue; // §Punkt 12: Dedup
      if (candidate.strength < 20) continue; // §Punkt 10: keine Threads für Kleinigkeiten
      createStoryThread(state, type, candidate);
    }
  }
}

function updateStoryThreads(state) {
  for (const id of Object.keys(state.storyThreads.active)) {
    const thread = state.storyThreads.active[id];
    if (thread) advanceStoryThread(state, thread);
  }
  discoverStoryThreads(state);
}

// ---------- Verknüpfung mit Event Chains (§Punkt 47/48/49) ----------
// Wird von js/event-chains.js beim Start bzw. Ende einer Kette aufgerufen.
function attachChainToThread(state, chain) {
  const type = CHAIN_THREAD_TYPE[chain.templateId];
  if (!type) return null;
  const candidate = { actorIds: chain.actorIds, regionIds: chain.regionIds };
  let thread = findExistingThreadForCandidate(state, type, candidate);
  if (!thread) {
    thread = createStoryThread(state, type, {
      actorIds: chain.actorIds, regionIds: chain.regionIds,
      memoryIds: chain.originatingMemoryIds.slice(), strength: 45,
    });
  }
  chain.threadId = thread.id;
  if (!thread.chainIds.includes(chain.id)) thread.chainIds.push(chain.id);
  thread.lastActivityYear = state.year;
  recordThreadHistory(thread, state.year, `Neue Entwicklung: "${CHAIN_TEMPLATES[chain.templateId].name}" beginnt.`);
  return thread;
}

function notifyThreadOfChainResolution(state, chain) {
  if (!chain.threadId) return;
  const thread = state.storyThreads.active[chain.threadId];
  if (!thread) return; // Thread ggf. bereits aufgelöst
  recordThreadHistory(thread, state.year, `${CHAIN_TEMPLATES[chain.templateId].name}: ${chain.resolution}.`);
  thread.lastActivityYear = state.year;
  // Die eigentliche Auflösungsprüfung übernimmt advanceStoryThread() im
  // nächsten Zyklus anhand des jetzt veränderten Weltzustands (§Punkt 48).
}

// ---------- Migration/Erbfolge-Hook ----------
// §Punkt 59-Analogon zu Event Chains: Threads referenzieren keine
// eingefrorene Herrscher-ID (Signale werten state.rulerId live aus), daher
// reicht ein History-Vermerk.
function notifyStoryThreadsOfSuccession(state, oldRulerId, newRulerId) {
  for (const id in state.storyThreads.active) {
    const thread = state.storyThreads.active[id];
    recordThreadHistory(thread, state.year, "Der Herrscher wechselte — die Geschichte läuft weiter.");
  }
}

// ---------- Query-/Debug-Hilfsfunktionen (§Punkt 53/72/73) ----------
function getActiveStoryThreads(state) { return Object.values(state.storyThreads.active); }
function getAllStoryThreads(state) { return getActiveStoryThreads(state).concat(Object.values(state.storyThreads.resolved)); }

function getThreadForChain(state, chainId) {
  return getAllStoryThreads(state).find(t => t.chainIds.includes(chainId));
}

// §Punkt 72/73: templatebasierte, menschenlesbare Zusammenfassung aus der
// bereits vorhandenen History — keine externe KI, keine Erfindung.
function summarizeStoryThread(thread) {
  const years = thread.status === "RESOLVED" || thread.status === "EXPIRED"
    ? `${thread.startedYear}–${thread.history[thread.history.length - 1].year}`
    : `${thread.startedYear}–`;
  const lines = thread.history.map(h => `${h.year}:\n${h.note}`);
  return `${thread.title.toUpperCase()}\n${years}\n` + lines.join("\n") +
    (thread.resolution ? `\nERGEBNIS:\n${thread.resolution}` : "");
}

// §Punkt 45/46-Analogon: "warum (nicht) als Thread erkannt?"
function explainThreadDiscovery(state, type) {
  const typeDef = STORY_THREAD_TYPES[type];
  if (!typeDef) return null;
  const signals = typeDef.detect(state);
  const covered = signals.filter(s => findExistingThreadForCandidate(state, type, s));
  const uncovered = signals.filter(s => !findExistingThreadForCandidate(state, type, s) && s.strength >= 20);
  return { type, signalCount: signals.length, coveredCount: covered.length, newCandidateCount: uncovered.length, signals };
}
