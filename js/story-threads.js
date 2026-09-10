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
  // §Phase-12: dieselbe Geschichte wie imperial_ambition -- der Weg zur
  // Kaiserkrone ist EIN Erzählbogen, keine fünf getrennten.
  unsicherer_kurfuerst: "IMPERIAL_AMBITION",
  teures_versprechen: "IMPERIAL_AMBITION",
  rivalisierende_zusagen: "IMPERIAL_AMBITION",
  gebrochenes_versprechen: "IMPERIAL_AMBITION",
  deciding_vote: "IMPERIAL_AMBITION",
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

// ---------- Importance 2.0 (§Phase-7-Punkt 3-7) ----------
// Wichtigster Audit-Fund vor dieser Überarbeitung (§Punkt 2/3): Importance
// variierte für SUCCESSION_CONFLICT/PERSONAL_RIVALRY praktisch GAR NICHT
// (jede der 115 SUCCESSION_CONFLICT-Threads in den Phase-6-Metriken hatte
// exakt Importance 43) — Ursache war, dass `thread.actorIds` für diese
// Typen bewusst nur die GEGENSPIELER-ID enthält, nie die des Herrschers
// (der wird absichtlich LIVE über state.rulerId referenziert, §Phase-6-
// Punkt 59-Analogon) — der alte `actorIds.includes(state.rulerId)`-Check
// konnte dadurch strukturell NIE zutreffen. Behoben durch eine explizite
// `threadInvolvesRuler()`-Prüfung statt einer reinen ID-Mitgliedschaft.
// Wichtig (§Punkt 7): Importance ist NICHT Tension — ein friedlich
// gelöster Thronfolgestreit kann Tension 0, aber Importance 80+ behalten
// (Tension wird oben nie in die Importance-Formel einbezogen).
function threadInvolvesRuler(state, thread) {
  if (thread.actorIds.includes(state.rulerId)) return true;
  if (thread.regionIds.includes("player")) return true;
  // Diese drei Typen sind per Definition IMMER auf den Herrscher bezogen
  // (Rivalität/Anspruch gegen ihn, eigene kaiserliche Ambition) — das ist
  // keine erfundene Pauschale, sondern folgt direkt aus den jeweiligen
  // detect()-Funktionen oben, die genau das voraussetzen.
  return thread.type === "SUCCESSION_CONFLICT" || thread.type === "PERSONAL_RIVALRY" || thread.type === "IMPERIAL_AMBITION";
}

function threadInvolvesHeir(state, thread) {
  const ruler = state.characters[state.rulerId];
  if (ruler && thread.actorIds.some(id => ruler.childrenIds.includes(id))) return true;
  // Ein Thronfolgestreit handelt per Definition davon, wer die Nachfolge
  // antritt/angetreten hat — der (unbeteiligte) Thronfolger ist die
  // implizite Gegenseite jedes SUCCESSION_CONFLICT-Threads.
  return thread.type === "SUCCESSION_CONFLICT";
}

// §Punkt 6: vollständig aufgeschlüsselte, debuggbare Komponenten statt
// einer Blackbox — dieselbe Struktur dient sowohl der internen Berechnung
// als auch explainThreadImportance() fürs Debug-Panel (eine Quelle der
// Wahrheit).
function computeThreadImportanceBreakdown(state, thread) {
  const components = [{ label: "Basis", value: 15 }];
  let total = 15;
  const add = (label, value) => { if (value) { components.push({ label, value }); total += value; } };

  add("Herrscher beteiligt", threadInvolvesRuler(state, thread) ? 15 : 0);
  add("Thronfolger betroffen", threadInvolvesHeir(state, thread) ? 15 : 0);

  const strongClaim = thread.actorIds.some(id => {
    const c = state.characters[id];
    return c && c.claims.some(cl => cl.titleId === "player" && (cl.strength === "strong" || cl.strength === "primary"));
  });
  add("Starker Anspruch beteiligt", strongClaim ? 10 : 0);

  const ruler = state.characters[state.rulerId];
  const rivalryInvolved = thread.type === "PERSONAL_RIVALRY" || thread.type === "SUCCESSION_CONFLICT" ||
    (ruler && thread.actorIds.some(id => ruler.rivalIds.includes(id)));
  add("Rivalität", rivalryInvolved ? 8 : 0);

  const atWar = thread.type === "FOREIGN_CONFLICT" && thread.regionIds.some(id => state.warState && state.warState[id]);
  add("Krieg", atWar ? 20 : 0);

  const rulerChangedDuring = thread.history.some(h => h.note && h.note.includes("Herrscher wechselte"));
  add("Herrscherwechsel während der Geschichte", rulerChangedDuring ? 10 : 0);

  add("Wirtschaftlicher/Versorgungsschaden", (thread.type === "ECONOMIC_CRISIS" || thread.type === "FOOD_CRISIS") ? 12 : 0);

  const endYear = thread.history.length ? thread.history[thread.history.length - 1].year : state.year;
  const duration = Math.max(0, endYear - thread.startedYear);
  add(`Dauer ${duration} Jahre`, Math.min(Math.round(duration / 2), 15));

  add(`${thread.memoryIds.length} bedeutende Erinnerung(en)`, Math.min(thread.memoryIds.length * 4, 16));

  add("Kaiser-/Titelbezug", thread.type === "IMPERIAL_AMBITION" ? 20 : 0);

  const reachedClimax = thread.history.some(h => h.status === "CLIMAX");
  add("CLIMAX erreicht", reachedClimax ? 15 : 0);

  add(`${thread.chainIds.length} Event Chain(s)`, Math.min(thread.chainIds.length * 5, 15));

  return { components, total: clamp(Math.round(total), 0, 100) };
}

function computeThreadImportance(state, thread) {
  return computeThreadImportanceBreakdown(state, thread).total;
}

function explainThreadImportance(state, thread) {
  return computeThreadImportanceBreakdown(state, thread);
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

// ---------- Resolution 2.0 (§Phase-7-Punkt 8-13) ----------
// Bildet einen abgeschlossenen Chain-Ausgang (Phase 5, bereits vorhanden)
// auf eine der 14 vereinheitlichten Thread-Resolution-Kategorien ab.
// AUSSCHLIESSLICH echte, bereits vorhandene Daten (§Punkt 11) — kein
// rnd()-Aufruf. `tone` beschreibt den dramaturgischen Ausgang, keine
// moralische Bewertung (§Punkt 10/42).
const CHAIN_OUTCOME_RESOLUTION_MAP = {
  APPOINTED: { type: "APPOINTED", tone: "PEACEFUL", outcome: "POSITIVE" },
  RECONCILED: { type: "RECONCILED", tone: "PEACEFUL", outcome: "POSITIVE" },
  COMPENSATED: { type: "COMPROMISE", tone: "PEACEFUL", outcome: "POSITIVE" },
  PROMISED: { type: "COMPROMISE", tone: "AMBIGUOUS", outcome: "NEUTRAL" },
  MARRIED: { type: "MARRIED", tone: "TRIUMPHANT", outcome: "POSITIVE" },
  MARRIED_WITH_DOWRY: { type: "MARRIED", tone: "TRIUMPHANT", outcome: "POSITIVE" },
  ESCALATED: { type: "ESCALATED", tone: "CONFLICT", outcome: "NEGATIVE" },
  SIDE_CHANGED: { type: "ESCALATED", tone: "CONFLICT", outcome: "NEGATIVE" },
  RESIGNED: { type: "ESCALATED", tone: "CONFLICT", outcome: "NEGATIVE" },
  PUBLICLY_EXPOSED: { type: "SUCCESS", tone: "TRIUMPHANT", outcome: "POSITIVE" },
  FAILED_ACCUSATION: { type: "FAILED", tone: "TRAGIC", outcome: "NEGATIVE" },
  DISMISSED: { type: "SUCCESS", tone: "AMBIGUOUS", outcome: "NEUTRAL" },
  QUIET_AUDIT: { type: "SUCCESS", tone: "AMBIGUOUS", outcome: "POSITIVE" },
  NOT_PROVEN: { type: "SUPPRESSED", tone: "AMBIGUOUS", outcome: "NEUTRAL" },
  IGNORED: { type: "SUPPRESSED", tone: "AMBIGUOUS", outcome: "NEUTRAL" },
  RECOVERED: { type: "SUCCESS", tone: "PEACEFUL", outcome: "POSITIVE" },
  PROLONGED: { type: "FAILED", tone: "TRAGIC", outcome: "NEGATIVE" },
  TAX_LOWERED: { type: "COMPROMISE", tone: "PEACEFUL", outcome: "POSITIVE" },
  PRIVILEGE_GRANTED: { type: "COMPROMISE", tone: "PEACEFUL", outcome: "POSITIVE" },
  DEESCALATED: { type: "RECONCILED", tone: "PEACEFUL", outcome: "POSITIVE" },
  APOLOGY: { type: "RECONCILED", tone: "PEACEFUL", outcome: "POSITIVE" },
  COMPENSATION: { type: "COMPROMISE", tone: "AMBIGUOUS", outcome: "NEUTRAL" },
  MOBILIZED: { type: "ESCALATED", tone: "CONFLICT", outcome: "NEGATIVE" },
  DECLINED: { type: "ABANDONED", tone: "AMBIGUOUS", outcome: "NEUTRAL" },
  CONCESSION: { type: "COMPROMISE", tone: "PEACEFUL", outcome: "POSITIVE" },
  NEGOTIATED: { type: "COMPROMISE", tone: "AMBIGUOUS", outcome: "NEUTRAL" },
  REFUSED: { type: "ESCALATED", tone: "CONFLICT", outcome: "NEGATIVE" },
  ISOLATED: { type: "SUPPRESSED", tone: "AMBIGUOUS", outcome: "NEUTRAL" },
  MONITORED: { type: "NATURAL_END", tone: "AMBIGUOUS", outcome: "NEUTRAL" },
  CAMPAIGNING: { type: "SUCCESS", tone: "TRIUMPHANT", outcome: "POSITIVE" },
  DISCREET_SUPPORT: { type: "SUCCESS", tone: "AMBIGUOUS", outcome: "POSITIVE" },
  DEFERRED: { type: "ABANDONED", tone: "AMBIGUOUS", outcome: "NEUTRAL" },
  PARTIAL_RECONCILIATION: { type: "COMPROMISE", tone: "AMBIGUOUS", outcome: "NEUTRAL" },
};

function classifyThreadResolution(state, thread, fallbackType) {
  const primaryActorId = thread.actorIds[0] || null;
  const sourceChainIds = thread.chainIds.slice();
  const consequences = [];

  // 1. Tod eines Beteiligten übersticht alles andere.
  if (primaryActorId && state.characters[primaryActorId] && !state.characters[primaryActorId].alive) {
    return { type: "DIED", tone: "TRAGIC", outcome: "NEGATIVE", primaryActorId, consequences: ["Ein zentraler Beteiligter ist verstorben."], sourceChainIds };
  }
  // 2. Auswärtiger Konflikt: Krieg oder Frieden ist bereits eindeutig im Weltzustand sichtbar.
  if (thread.type === "FOREIGN_CONFLICT") {
    const atWar = thread.regionIds.some(id => state.warState && state.warState[id]);
    return atWar
      ? { type: "WAR", tone: "CONFLICT", outcome: "NEGATIVE", primaryActorId, consequences, sourceChainIds }
      : { type: "PEACE", tone: "PEACEFUL", outcome: "POSITIVE", primaryActorId, consequences, sourceChainIds };
  }
  // 3. Letzter abgeschlossener Chain-Ausgang (Phase 5) ist die genaueste Quelle.
  const lastResolvedChainId = sourceChainIds.slice().reverse().find(cid => state.eventChains.resolved[cid]);
  const lastChain = lastResolvedChainId ? state.eventChains.resolved[lastResolvedChainId] : null;
  if (lastChain) {
    const mapped = CHAIN_OUTCOME_RESOLUTION_MAP[lastChain.resolution];
    if (mapped) {
      if (primaryActorId) {
        const rel = computeRelationshipBreakdown(state, primaryActorId, state.rulerId).total;
        if (rel > 10) consequences.push("Die Beziehung hat sich deutlich verbessert.");
        else if (rel < -10) consequences.push("Die Beziehung bleibt angespannt.");
      }
      return Object.assign({ primaryActorId, consequences, sourceChainIds }, mapped);
    }
  }
  // 4. Fallback für Threads ohne (noch) abgeschlossene Chain: aktuelle Beziehung.
  if (primaryActorId) {
    const rel = computeRelationshipBreakdown(state, primaryActorId, state.rulerId).total;
    if (rel >= 20) return { type: "RECONCILED", tone: "PEACEFUL", outcome: "POSITIVE", primaryActorId, consequences: ["Die Beziehung hat sich deutlich erholt."], sourceChainIds };
    if (rel <= -20) return { type: "SUPPRESSED", tone: "AMBIGUOUS", outcome: "NEUTRAL", primaryActorId, consequences: [], sourceChainIds };
  }
  return { type: fallbackType || "NATURAL_END", tone: "AMBIGUOUS", outcome: "NEUTRAL", primaryActorId, consequences: [], sourceChainIds };
}

function resolveStoryThread(state, thread, fallbackType) {
  const resolution = classifyThreadResolution(state, thread, fallbackType);
  resolution.year = state.year;
  thread.status = "RESOLVED";
  thread.stage = STAGE_FOR_STATUS.RESOLVED;
  thread.resolution = resolution;
  recordThreadHistory(thread, state.year, `${thread.title}: ${resolution.type} (${resolution.tone}).`);
  // §Punkt 70: nur wirklich bedeutsame Geschichten hinterlassen eine
  // strukturierte Abschluss-Memory — keine Memory-Typ-/Mengen-Explosion.
  if (thread.importance >= 50) {
    const memory = recordWorldEvent(state, {
      type: "MAJOR_STORY_RESOLVED", actorIds: thread.actorIds.slice(), regionIds: thread.regionIds.slice(),
      importance: thread.importance, emotionalWeight: resolution.outcome === "POSITIVE" ? 20 : (resolution.outcome === "NEGATIVE" ? -20 : 0),
      metadata: { threadId: thread.id, threadType: thread.type, resolutionType: resolution.type },
      description: `${thread.title} findet ihren Abschluss.`,
    });
    thread.memoryIds.push(memory.id);
  }
  delete state.storyThreads.active[thread.id];
  state.storyThreads.resolved[thread.id] = thread;
}

function expireStoryThread(state, thread, reason) {
  const resolution = classifyThreadResolution(state, thread, "NATURAL_END");
  resolution.year = state.year;
  thread.status = "EXPIRED";
  thread.stage = STAGE_FOR_STATUS.EXPIRED;
  thread.resolution = resolution;
  recordThreadHistory(thread, state.year, `${thread.title}: ${reason} (${resolution.type}).`);
  delete state.storyThreads.active[thread.id];
  state.storyThreads.resolved[thread.id] = thread;
}

// ---------- Jährliches Fortschreiben (§Punkt 14/15/33/34) ----------
function advanceStoryThread(state, thread) {
  if (!threadParticipantsAlive(state, thread)) { expireStoryThread(state, thread, "Ein Beteiligter ist verstorben"); return; }

  const typeDef = STORY_THREAD_TYPES[thread.type];
  const signals = typeDef ? typeDef.detect(state) : [];
  let matching = signals.find(s => candidateMatchesThread(thread, s));
  // §Phase-7-Audit-Fund: eine gerade laufende, an diesen Thread angehängte
  // Event Chain IST selbst ein echtes, objektiv vorhandenes Signal — der
  // generische Typ-Detektor (oben) ist auf DISCOVERY zugeschnitten und
  // erkennt eine reine Chain-Situation (z. B. "Berater wurde übergangen",
  // ohne dass daraus schon eine Rivalität geworden ist) nicht immer als
  // "Rivalität". Ohne diesen Fallback fielen chain-getriebene Threads nach
  // nur einem Jahr fälschlich auf FADED zurück, sobald der generische
  // Detektor (der etwas anderes prüft) nicht zufällig mitbestätigte.
  if (!matching) {
    const hasActiveChain = thread.chainIds.some(cid => state.eventChains.active[cid]);
    if (hasActiveChain) matching = { strength: Math.max(thread.tension, 45), memoryIds: [] };
  }

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
      if (yearsSinceActivity >= CONFIG.storyThreads.aftermathYears) { resolveStoryThread(state, thread, "NATURAL_END"); return; }
    } else if (thread.status === "BUILDING" || thread.status === "DORMANT") {
      resolveStoryThread(state, thread, "ABANDONED"); // wurde nie zu einer richtigen Geschichte
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
  let result = `${thread.title.toUpperCase()}\n${years}\n` + lines.join("\n");
  if (thread.resolution) {
    result += `\nERGEBNIS:\n${thread.resolution.type} (${thread.resolution.tone})`;
    if (thread.resolution.consequences && thread.resolution.consequences.length) {
      result += "\n" + thread.resolution.consequences.join(" ");
    }
  }
  return result;
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
