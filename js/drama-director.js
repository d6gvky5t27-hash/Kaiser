// ============================================================
// DRAMA DIRECTOR — Phase 6: KURATOR, NICHT AUTOR (§Punkt 2). Erfindet
// keine Krisen, sondern bewertet ausschließlich bereits bestehende
// plausible Entwicklungen (World Memories, Event Chains, Story Threads,
// Wirtschaft, Diplomatie, Herrschergesundheit, Kaiserwahl, Hunger) und
// entscheidet nur über PRIORISIERUNG:
//   - welcher Story Thread gerade im Vordergrund steht (focusThreadId)
//   - welche der bereits ELIGIBLEN Event Chains dieses Jahr den Vorzug
//     bekommt (computeChainDirectorScore())
// Eligibility bleibt unangetastet die alleinige Wahrheit (§Punkt 42) —
// der Director kann niemals eine ineligible Kette starten, er wählt nur
// unter den bereits plausiblen aus.
//
// Möglichst ohne RNG (§Punkt 39/40): Tension/Pacing/Fokus/Score sind reine
// additive, konfigurierbare Formeln (§Punkt 22 "keine Blackbox") —
// state.drama.tensionBreakdown macht jeden Punkt nachvollziehbar.
// ============================================================

// ---------- Globale Tension (§Punkt 18-21) ----------
// KEINE Katastrophen-Wahrscheinlichkeit — eine reine Beschreibung, wie
// angespannt die Welt gerade ist. Jede Komponente ist ein CONFIG-Gewicht
// (§Punkt 107), keine verstreute Magic Number.
function computeDramaTensionBreakdown(state) {
  const w = CONFIG.drama.tensionWeights;
  const components = [];
  let total = 0;
  const add = (label, value) => { if (value) { components.push({ label, value }); total += value; } };

  const ruler = state.characters[state.rulerId];
  if (ruler) {
    const rivalCount = ruler.rivalIds.filter(id => state.characters[id] && state.characters[id].alive).length;
    add(`Aktive Rivalitäten (${rivalCount})`, Math.min(rivalCount * w.activeRivalryPerRival, w.activeRivalryCap));

    const importantOthers = getImportantCharacterIds(state).filter(id => id !== state.rulerId);
    const lowLoyalty = importantOthers.some(id => state.characters[id].loyalty < w.lowLoyaltyThreshold);
    add("Niedrige Loyalität einflussreicher Personen", lowLoyalty ? w.lowLoyaltyPowerful : 0);

    let unresolvedClaim = false;
    for (const id in state.characters) {
      if (id === state.rulerId) continue;
      const c = state.characters[id];
      if (c.alive && c.claims.some(cl => cl.titleId === "player" && (cl.strength === "strong" || cl.strength === "primary"))) { unresolvedClaim = true; break; }
    }
    add("Ungeklärte starke Ansprüche", unresolvedClaim ? w.unresolvedClaim : 0);

    add("Herrschergesundheit niedrig", ruler.health < w.rulerHealthThreshold ? w.rulerHealth : 0);
    const livingHeirs = ruler.childrenIds.filter(id => state.characters[id] && state.characters[id].alive).length;
    add("Unsichere Erbfolge (kein lebender Erbe)", livingHeirs === 0 ? w.uncertainSuccession : 0);
    add("Stabile Dynastie", (livingHeirs > 0 && rivalCount === 0) ? w.stableDynastyBonus : 0);
  }

  const recentFamine = hasMemory(state, { type: "FAMINE", sinceYear: state.year - 3 });
  add("Hungerkrise", recentFamine ? w.hunger : 0);

  const r = state.regions.player;
  add("Volle Kornspeicher", (r.grainRatio !== undefined ? r.grainRatio : 1) >= w.fullGranariesThreshold ? w.fullGranariesBonus : 0);

  const weakEconomy = (state.debt || 0) > 0 || state.treasury < 0;
  add("Schwache Wirtschaft", weakEconomy ? w.weakEconomy : 0);
  add("Gute Wirtschaft", state.treasury >= w.goodEconomyThreshold ? w.goodEconomyBonus : 0);

  const atWar = !!(state.warState && Object.values(state.warState).some(Boolean));
  add("Krieg", atWar ? w.war : 0);
  const relations = Object.values(state.diplomacy).map(d => d.relation);
  add("Schlechte Beziehungen", relations.some(rel => rel < w.badRelationsThreshold) ? w.badRelations : 0);
  add("Frieden", (!atWar && relations.length && relations.every(rel => rel >= 30)) ? w.peaceBonus : 0);

  const activeChainCount = Object.keys(state.eventChains.active).length;
  add(`Aktive Event Chains (${activeChainCount})`, Math.min(activeChainCount * w.activeChainPerChain, w.activeChainCap));

  const kurfuerstRank = TITLES.findIndex(t => t.id === "kurfuerst");
  const electionSoon = !!state.pendingElection || (state.titleIndex >= kurfuerstRank && (state.electionCooldown || 0) <= 1);
  add("Bevorstehende Kaiserwahl", electionSoon ? w.upcomingElection : 0);

  const infl = state.religiousInfluence !== undefined ? state.religiousInfluence : 55;
  add("Religiöse Spannungen", infl < CONFIG.religion.lowInfluenceThreshold + 15 ? w.religiousTension : 0);

  add("Hohe Legitimität", state.legitimacy >= w.highLegitimacyThreshold ? w.highLegitimacyBonus : 0);

  const importantChars = getImportantCharacterIds(state).filter(id => id !== state.rulerId);
  const avgLoyalty = importantChars.length ? importantChars.reduce((s, id) => s + state.characters[id].loyalty, 0) / importantChars.length : 100;
  add("Hohe Loyalität am Hof", avgLoyalty >= w.highLoyaltyThreshold ? w.highLoyaltyBonus : 0);

  const recentResolution = getAllStoryThreads(state).some(t => t.status === "RESOLVED" && t.history.length &&
    (state.year - t.history[t.history.length - 1].year) <= w.recentResolutionYears);
  add("Kürzlich gelöste Krise", recentResolution ? w.recentResolutionBonus : 0);

  return { components, total: clamp(Math.round(total), 0, 100) };
}

// ---------- Pacing (§Punkt 23/92) — nur Priorisierungssignal, blockiert
// nie echte Ereignisse (§Punkt 27). ----------
function computePacingState(state) {
  if (state.drama.recoveryWindowUntilYear && state.year <= state.drama.recoveryWindowUntilYear) return "RECOVERY";
  const t = state.drama.tension;
  if (t >= 70) return "CRISIS";
  if (t >= 45) return "HIGH_TENSION";
  if (t >= 20 || state.drama.momentum > 10) return "BUILDING";
  return "QUIET";
}

// §Punkt 21/25/26: ein "Großereignis" ist ein Jahr mit einer hinreichend
// bedeutsamen Memory — dieselbe importance-Skala aus js/memory.js, kein
// zweiter Schwellenwert-Mechanismus.
function detectMajorEventThisYear(state) {
  return allMemories(state).some(m => m.year === state.year && m.importance >= CONFIG.drama.majorEventImportanceThreshold);
}

// ---------- Fokus (§Punkt 28/29) — wechselt nicht jedes Jahr ----------
function computeFocusThread(state, currentFocusId) {
  const candidates = getActiveStoryThreads(state).filter(t => t.status !== "DORMANT");
  if (!candidates.length) return null;
  const scored = candidates.map(t => ({
    t,
    score: t.importance + t.tension + t.momentum
      + (t.actorIds.includes(state.rulerId) ? 20 : 0)
      + (t.type === "SUCCESSION_CONFLICT" ? 15 : 0)
      + (t.status === "CLIMAX" ? 20 : 0),
  }));
  scored.sort((a, b) => b.score - a.score || a.t.id.localeCompare(b.t.id)); // §Punkt 39: stabiler Tie-Break, kein RNG
  const best = scored[0];
  const currentEntry = currentFocusId ? scored.find(s => s.t.id === currentFocusId) : null;
  if (!currentEntry) return best.t.id; // alter Fokus resolved/dormant/nicht mehr vorhanden -> neu wählen
  if (best.t.id !== currentFocusId && best.score > currentEntry.score + CONFIG.drama.focusSwitchThreshold) return best.t.id;
  return currentFocusId;
}

// ---------- Jährliches Update ----------
function updateDramaDirector(state) {
  const breakdown = computeDramaTensionBreakdown(state);
  state.drama.tensionBreakdown = breakdown.components;
  const prevTension = state.drama.tension;
  state.drama.tension = breakdown.total;
  state.drama.momentum = Math.round(clamp((state.drama.tension - prevTension) * 0.5 + state.drama.momentum * 0.5, -100, 100));
  state.drama.recentIntensity.push(state.drama.tension);
  if (state.drama.recentIntensity.length > 10) state.drama.recentIntensity.shift();

  if (detectMajorEventThisYear(state)) {
    state.drama.lastMajorEventYear = state.year;
    state.drama.yearsSinceMajorEvent = 0;
    state.drama.recoveryWindowUntilYear = state.year + CONFIG.drama.recoveryWindowYears; // §Punkt 25
  } else {
    state.drama.yearsSinceMajorEvent = state.drama.lastMajorEventYear !== null ? (state.year - state.drama.lastMajorEventYear) : (state.drama.yearsSinceMajorEvent + 1);
  }
  state.drama.pacing = computePacingState(state);
  state.drama.focusThreadId = computeFocusThread(state, state.drama.focusThreadId);
}

// ---------- Chain-Priorisierung (§Punkt 41-46) ----------
// Ersetzt Phase 5s feste CHAIN_PRIORITY_ORDER-Reihenfolge durch einen
// deterministiven Score — Eligibility (js/event-chains.js,
// collectEligibleChainCandidates()) bleibt dabei unverändert die einzige
// Wahrheit, der Director wählt nur UNTER bereits eligiblen Ketten.
// §Punkt 45/46 Entscheidung (dokumentiert, siehe DEVELOPMENT.md "Phase 6"):
// Phase 5s `rnd() < startChance`-Wurf bleibt bestehen (bewusster
// Bestandteil, steuert weiterhin NUR das Timing innerhalb eines bereits
// plausiblen Jahres) — nur die Auswahl, WELCHE Kette diesen Wurf bekommt,
// ist jetzt Score- statt Reihenfolge-basiert.
function computeChainDirectorScore(state, templateId, payload) {
  const tpl = CHAIN_TEMPLATES[templateId];
  const cfg = CONFIG.drama;
  const threadType = CHAIN_THREAD_TYPE[templateId];
  const thread = threadType ? findExistingThreadForCandidate(state, threadType, { actorIds: payload.actorIds || [], regionIds: payload.regionIds || [] }) : null;
  const breakdown = [{ label: "Basis", value: 30 }];
  let total = 30;
  if (thread) {
    if (state.drama.focusThreadId === thread.id) { breakdown.push({ label: "Focus Thread", value: cfg.chainFocusBonus }); total += cfg.chainFocusBonus; }
    const tensionBonus = Math.round(thread.tension * cfg.chainThreadTensionFactor);
    if (tensionBonus) { breakdown.push({ label: `Thread-Tension ${thread.tension}`, value: tensionBonus }); total += tensionBonus; }
    const yearsSince = Math.min(state.year - thread.lastActivityYear, 10);
    const yearsBonus = yearsSince * cfg.chainYearsSinceActivityFactor;
    if (yearsBonus) { breakdown.push({ label: `${yearsSince} Jahre seit Thread-Aktivität`, value: yearsBonus }); total += yearsBonus; }
  }
  const inRecovery = state.drama.recoveryWindowUntilYear && state.year <= state.drama.recoveryWindowUntilYear;
  if (inRecovery && !tpl.systemCritical) { // §Punkt 26: nur OPTIONALE Ketten werden zurückgestaffelt
    breakdown.push({ label: "Recovery Window (nur optionale Ketten)", value: cfg.chainRecoveryPenalty });
    total += cfg.chainRecoveryPenalty;
  }
  return { total: Math.max(0, total), breakdown, threadId: thread ? thread.id : null };
}

// ---------- Debug-Erklärung (§Punkt 54/55/109) ----------
function explainDramaState(state) {
  return {
    tension: state.drama.tension,
    tensionBreakdown: computeDramaTensionBreakdown(state).components,
    pacing: state.drama.pacing,
    focusThreadId: state.drama.focusThreadId,
    yearsSinceMajorEvent: state.drama.yearsSinceMajorEvent,
    recoveryWindowUntilYear: state.drama.recoveryWindowUntilYear,
    recentIntensity: state.drama.recentIntensity.slice(),
  };
}

function explainEligibleChainScores(state) {
  const candidates = collectEligibleChainCandidates(state); // js/event-chains.js
  return candidates
    .map(c => Object.assign({ templateId: c.templateId, name: CHAIN_TEMPLATES[c.templateId].name }, computeChainDirectorScore(state, c.templateId, c.result.payload)))
    .sort((a, b) => b.total - a.total);
}
