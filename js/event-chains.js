// ============================================================
// EVENT CHAINS — Phase 5 "Aus Simulation werden Geschichten": mehrjährige
// Handlungsstränge, die aus bereits bestehenden Zuständen (Charaktere,
// Traits, Beziehungen, Loyalität, Claims, Rivalitäten, World Memory)
// entstehen. KEIN Drama Director (§Punkt 2): es gibt keine Funktion
// "Spiel ist langweilig -> erzeuge Krise" — jede Kette braucht plausible,
// tatsächlich erfüllte Simulationsvoraussetzungen (siehe die
// canStartXChain()-Funktionen unten), Zufall entscheidet höchstens WANN,
// nie OB die Welt überhaupt reif für eine Geschichte ist (§Punkt 54).
//
// Architektur (§Punkt 6/11): ein schlankes Modul statt einer God-Class.
// Jede Kette ist ein Eintrag in CHAIN_TEMPLATES mit zwei Funktionen:
//   checkEligibility(state) -> { checks, eligible, payload }
//     checks: menschenlesbare Einzelprüfungen (fürs Debug-Panel, §Punkt
//     45/46 "warum (nicht) gestartet"), eligible: alle checks erfüllt,
//     payload: Start-Nutzlast (actorIds/targetIds/regionIds/variables/…),
//     nur bedeutsam wenn eligible === true.
//   advance(state, chain) -> Fortschreiben einer bereits aktiven Kette:
//     Verzögerungen prüfen, ggf. eine Entscheidung anbieten
//     (queueChainDecision) oder die Kette auflösen/ablaufen lassen.
// Texte/Optionen sind Daten, komplexe Bedingungen bleiben JS (§Punkt 11) —
// keine generische Story-DSL.
// ============================================================

// ---------- Chain-Runtime-Grundbausteine (§Punkt 7/8/9) ----------

function chainCooldownKey(templateId, actorIds, targetIds) {
  const people = (actorIds || []).concat(targetIds || []).slice().sort().join(",");
  return templateId + "::" + (people || "global");
}

function isChainOnCooldown(state, templateId, actorIds, targetIds) {
  const key = chainCooldownKey(templateId, actorIds, targetIds);
  return (state.eventChains.cooldowns[key] || 0) > state.year;
}

// §Punkt 42: eine konkrete Person soll nicht gleichzeitig mehrere fast
// identische persönliche Konfliktketten tragen — Konflikte bündeln statt
// zu vervielfachen.
function characterInActiveChain(state, characterId) {
  return Object.values(state.eventChains.active).some(c =>
    c.actorIds.includes(characterId) || c.targetIds.includes(characterId));
}

function startEventChain(state, templateId, payload, historyNote) {
  const tpl = CHAIN_TEMPLATES[templateId];
  const id = "ec" + state.eventChains.nextId++;
  const chain = {
    id, templateId,
    status: "ACTIVE",
    startedYear: state.year,
    lastAdvancedYear: state.year,
    actorIds: payload.actorIds || [],
    targetIds: payload.targetIds || [],
    regionIds: payload.regionIds || [],
    stage: tpl.initialStage,
    variables: payload.variables || {},
    originatingMemoryIds: payload.originatingMemoryIds || [],
    history: [{ year: state.year, stage: tpl.initialStage, event: "started", note: historyNote || tpl.name }],
    urgency: payload.urgency || "normal",
    expiresYear: payload.expiresYear || (state.year + CONFIG.eventChains.defaultExpiryYears),
    resolution: null,
    threadId: null, // §Phase-6-Punkt 47: vom zugehörigen Story Thread gesetzt, siehe attachChainToThread()
  };
  state.eventChains.active[id] = chain;
  state.eventChains.cooldowns[chainCooldownKey(templateId, chain.actorIds, chain.targetIds)] =
    state.year + (tpl.cooldownYears || CONFIG.eventChains.defaultCooldownYears);
  attachChainToThread(state, chain); // js/story-threads.js
  return chain;
}

function endEventChain(state, chain, status, outcome, note) {
  chain.status = status;
  chain.resolution = outcome;
  chain.history.push({ year: state.year, stage: chain.stage, event: status.toLowerCase(), outcome, note });
  delete state.eventChains.active[chain.id];
  state.eventChains.resolved[chain.id] = chain;
  notifyThreadOfChainResolution(state, chain); // js/story-threads.js (§Phase-6-Punkt 48)
}
function resolveEventChain(state, chain, outcome, note) { endEventChain(state, chain, "RESOLVED", outcome, note); }
function failEventChain(state, chain, outcome, note) { endEventChain(state, chain, "FAILED", outcome, note); }
function expireEventChain(state, chain, reason, note) { endEventChain(state, chain, "EXPIRED", reason, note); }

function chainParticipantsAlive(state, chain) {
  return chain.actorIds.concat(chain.targetIds).every(id => {
    const c = state.characters[id];
    return c ? c.alive : true; // Regions-/sonstige Nicht-Charakter-IDs zählen immer als "lebendig"
  });
}

// §Punkt 25/89: Chain-Entscheidungen laufen über das bestehende, bereits
// vorhandene Event-Fenster (state.pendingEvent/showEvent()/resolveEvent()
// in index.html) — KEIN zweites Eventsystem (§Punkt 63/64). `source`/
// `chainId` machen die Herkunft nachvollziehbar (§Punkt 64).
function queueChainDecision(state, chain, title, text, options) {
  state.pendingEvent = {
    title, text,
    source: "EVENT_CHAIN", chainId: chain.id,
    options: options.map(opt => ({
      label: opt.label,
      apply: (r, s) => {
        chain.history.push({ year: s.year, stage: chain.stage, choice: opt.outcome || opt.label });
        opt.effect(s, chain);
      },
    })),
  };
  // §Punkt 65/66: das ANBIETEN einer bedeutsamen Entscheidung ist selbst
  // chronikwürdig ("Wilhelm fordert einen Platz im Rat") — die Auflösung
  // (Option gewählt) trägt bereits die bestehende, generische
  // resolveEvent()-Chronikzeile.
  addChronicle(state, title + " " + text);
}

// §Punkt 45/46: einheitliche Erklärungsstruktur für "warum (nicht)
// gestartet" — wird sowohl vom Runtime-Scheduler als auch vom Debug-Panel
// genutzt (eine Quelle der Wahrheit statt einer zweiten Debug-Logik).
function chainEligibilityChecks(checks, payload) {
  return { checks, eligible: checks.every(c => c.passed), payload };
}

// ---------- Jährlicher Orchestrator (§Punkt 39/40) ----------
// Priorität ohne Drama Director: (1) bereits aktive Ketten IMMER zuerst
// fortschreiben, (2) höchstens EINE neue Kette pro Jahr, nach einer festen
// Reihenfolge, nur wenn noch Kapazität frei ist und dieses Jahr noch keine
// andere Entscheidung (Chain oder regulär) das Event-Fenster belegt.
const CHAIN_PRIORITY_ORDER = [
  "passed_over_heir", "corrupt_treasurer", "grieved_advisor", "famine_crisis",
  "rising_rival", "border_conflict", "trade_conflict", "dynastic_marriage",
  "church_conflict", "imperial_ambition",
];

// §Phase-6-Punkt 41: aktive Ketten fortschreiben bleibt unverändert von der
// Priorisierung getrennt — Fortsetzung hat immer Vorrang vor Neustarts,
// unabhängig vom Drama Director.
function advanceActiveEventChains(state) {
  for (const id of Object.keys(state.eventChains.active)) {
    const chain = state.eventChains.active[id];
    if (!chain || chain.status !== "ACTIVE") continue;
    if (!chainParticipantsAlive(state, chain)) {
      expireEventChain(state, chain, "PARTICIPANT_DIED", "Ein Beteiligter ist verstorben, die Geschichte endet hier.");
      continue;
    }
    if (chain.expiresYear && state.year > chain.expiresYear) {
      expireEventChain(state, chain, "TIMED_OUT", "Die Angelegenheit hat sich mit der Zeit erledigt.");
      continue;
    }
    const tpl = CHAIN_TEMPLATES[chain.templateId];
    if (!tpl) continue; // defensiv, sollte bei bekannten Templates nie eintreten
    tpl.advance(state, chain);
    chain.lastAdvancedYear = state.year;
  }
}

// §Phase-6-Punkt 42: Eligibility bleibt UNVERÄNDERT die einzige Wahrheit —
// diese Funktion liefert exakt dieselben Kandidaten wie Phase 5s
// Festreihenfolge-Schleife, nur ohne bereits eine Auswahl zu treffen. Wird
// sowohl vom Scheduler unten als auch vom Drama-Director-Debug-Panel
// genutzt (js/drama-director.js, explainEligibleChainScores()).
function collectEligibleChainCandidates(state) {
  const out = [];
  for (const templateId of CHAIN_PRIORITY_ORDER) {
    const tpl = CHAIN_TEMPLATES[templateId];
    const result = tpl.checkEligibility(state);
    if (!result.eligible) continue;
    const people = (result.payload.actorIds || []).concat(result.payload.targetIds || []);
    if (people.some(pid => characterInActiveChain(state, pid))) continue;
    if (isChainOnCooldown(state, templateId, result.payload.actorIds, result.payload.targetIds)) continue;
    out.push({ templateId, result });
  }
  return out;
}

// §Phase-6-Punkt 43/45: unter den bereits eligiblen Kandidaten wählt der
// Drama Director per Score (js/drama-director.js) statt per fester
// Reihenfolge — CHAIN_PRIORITY_ORDER dient nur noch als stabiler
// Tie-Break bei Score-Gleichstand (§Punkt 39 "stabile feste
// Tie-Break-Regel"). Der Phase-5-Zufallswurf, OB die gewählte Kette
// dieses Jahr tatsächlich beginnt, bleibt bewusst bestehen (siehe
// DEVELOPMENT.md "Phase 6" für die dokumentierte Entscheidung, §Punkt 46).
function startNewEventChainIfEligible(state) {
  if (state.pendingEvent) return; // dieses Jahr ist die Event-Anzeige bereits belegt
  if (Object.keys(state.eventChains.active).length >= CONFIG.eventChains.maxActive) return;

  const candidates = collectEligibleChainCandidates(state);
  if (!candidates.length) return;

  const scored = candidates.map(c => Object.assign({}, c, { score: computeChainDirectorScore(state, c.templateId, c.result.payload) }));
  scored.sort((a, b) => b.score.total - a.score.total || CHAIN_PRIORITY_ORDER.indexOf(a.templateId) - CHAIN_PRIORITY_ORDER.indexOf(b.templateId));
  const chosen = scored[0];
  const tpl = CHAIN_TEMPLATES[chosen.templateId];
  // §Punkt 52/53: erst alle Bedingungen (oben, inkl. Director-Score), DANN
  // genau EIN gezielter Wurf, ob es dieses Jahr tatsächlich losgeht.
  if (rnd() < (tpl.startChance !== undefined ? tpl.startChance : CONFIG.eventChains.startChance)) {
    startEventChain(state, chosen.templateId, chosen.result.payload);
  }
}

// §Punkt 59: wird von handleSuccession() aufgerufen. Ketten referenzieren
// "den Herrscher" bewusst LIVE über state.rulerId (nie eine eingefrorene
// ID) — ein Herrscherwechsel erledigt die Übertragung dadurch von selbst,
// ohne ID-Umschreibung. Hier wird nur ein nachvollziehbarer History-Eintrag
// ergänzt (Debug-/Nachvollziehbarkeit, §Punkt 59 "aktive Chains prüfen").
function notifyEventChainsOfSuccession(state, oldRulerId, newRulerId) {
  for (const id in state.eventChains.active) {
    const chain = state.eventChains.active[id];
    chain.history.push({ year: state.year, stage: chain.stage, event: "ruler_changed", note: "Der Herrscher wechselte — die Geschichte läuft unter dem neuen Herrscher weiter." });
  }
}

// ---------- Test-Policies (§Punkt 72/73) ----------
// NUR für automatisierte Langzeittests (ai_vs_ai_test.js,
// phase3/4/5_*_metrics_test.js, baseline_analysis.js, economy_test.js) —
// KEINE echte KI des fertigen Spiels. Ohne eine solche Policy bliebe eine
// unbeantwortete Entscheidung in einem UI-losen Testlauf für immer im
// Event-Fenster stehen (advanceMonth() prüft `state.pendingEvent` nicht),
// was ab der ersten Chain-Entscheidung ALLE weiteren Events/Chains dieser
// Partie blockieren würde. Die Optionsreihenfolge in allen 10 Chain-
// Templates ist bewusst von großzügig/entgegenkommend zu hart/ablehnend
// sortiert (siehe die jeweiligen queueChainDecision()-Aufrufe oben) — daher
// ist "erste Option" eine sinnvolle CONCILIATORY- und "letzte Option" eine
// sinnvolle AGGRESSIVE-Näherung, ohne dass Optionen einen eigenen
// Metadaten-Tag brauchen.
function resolvePendingEventWithPolicy(state, policy) {
  const ev = state.pendingEvent;
  if (!ev || !ev.options || !ev.options.length) return false;
  let idx = 0;
  if (policy === "RANDOM_VALID_OPTION") idx = Math.floor(rnd() * ev.options.length);
  else if (policy === "AGGRESSIVE") idx = ev.options.length - 1;
  else if (policy === "CONCILIATORY") idx = 0;
  else idx = 0; // FIRST_OPTION (Default)
  ev.options[idx].apply(state.regions.player, state);
  addChronicle(state, `Ereignis "${ev.title}": Option "${ev.options[idx].label}" gewählt.`);
  state.pendingEvent = null;
  return true;
}

// ---------- Debug-Erklärung (§Punkt 45/46) ----------
function explainChainEligibility(state, templateId) {
  const tpl = CHAIN_TEMPLATES[templateId];
  if (!tpl) return null;
  const result = tpl.checkEligibility(state);
  const checks = result.checks.slice();
  if (result.eligible) {
    const people = (result.payload.actorIds || []).concat(result.payload.targetIds || []);
    const boundElsewhere = people.some(pid => characterInActiveChain(state, pid));
    checks.push({ label: "Beteiligte nicht bereits in einer anderen aktiven Kette gebunden", passed: !boundElsewhere });
    const onCooldown = isChainOnCooldown(state, templateId, result.payload.actorIds, result.payload.targetIds);
    checks.push({ label: "Kein Cooldown nach vorheriger gleichartiger Kette", passed: !onCooldown });
    const capacityFree = Object.keys(state.eventChains.active).length < CONFIG.eventChains.maxActive;
    checks.push({ label: `Kapazität frei (max. ${CONFIG.eventChains.maxActive} aktive Ketten gleichzeitig)`, passed: capacityFree });
  }
  return { templateId, name: tpl.name, checks, eligible: checks.every(c => c.passed) };
}

// ============================================================
// CHAIN 1 — DER ÜBERGANGENE ERBE (§Punkt 13)
// ============================================================

function canStartPassedOverHeirChain(state) {
  const cfg = CONFIG.eventChains;
  let candidate = null;
  const checks = [];
  for (const id in state.characters) {
    const c = state.characters[id];
    if (!c.alive || id === state.rulerId) continue;
    const claim = c.claims.find(cl => cl.titleId === "player" && cl.reason === "succession_passed_over");
    if (!claim) continue;
    if (!hasMemory(state, { type: "PASSED_OVER_IN_SUCCESSION", targetId: id })) continue;
    if (c.age < cfg.adultAge) continue;
    const rel = computeRelationshipBreakdown(state, id, state.rulerId);
    if (rel.total >= -15 || c.loyalty >= 45) continue;
    candidate = { id, c, rel };
    break;
  }
  if (!candidate) {
    return chainEligibilityChecks([{ label: "Ein lebender, übergangener Erbe mit starkem Claim, niedriger Beziehung und Loyalität existiert", passed: false }], {});
  }
  const { id, c, rel } = candidate;
  checks.push({ label: `Strong Claim ("succession_passed_over"): erfüllt`, passed: true });
  checks.push({ label: `PASSED_OVER_IN_SUCCESSION-Memory vorhanden: erfüllt`, passed: true });
  checks.push({ label: `Loyalität ${c.loyalty}: erfüllt (< 45)`, passed: c.loyalty < 45 });
  checks.push({ label: `Beziehung ${rel.total}: erfüllt (< -15)`, passed: rel.total < -15 });
  checks.push({ label: `Alter ${c.age}: erfüllt (>= ${cfg.adultAge})`, passed: c.age >= cfg.adultAge });
  checks.push({ label: "Character alive: erfüllt", passed: true });
  return chainEligibilityChecks(checks, {
    actorIds: [id], targetIds: [],
    variables: {}, // nextYear wird erst beim ersten advance()-Aufruf gewürfelt (§Punkt 52: sparsamer RNG-Verbrauch)
    originatingMemoryIds: [hasMemoryId(state, "PASSED_OVER_IN_SUCCESSION", id)],
    urgency: "normal",
  });
}

// Kleiner Helfer: die Memory-ID des jüngsten passenden Treffers (für
// originatingMemoryIds, §Punkt 33) — reine Lesefunktion auf bestehenden
// World-Memory-Queries.
function hasMemoryId(state, type, targetId) {
  const matches = getMemoriesByType(state, type).filter(m => m.targetIds.includes(targetId));
  if (!matches.length) return null;
  return matches.sort((a, b) => b.year - a.year)[0].id;
}

const CHAIN_PASSED_OVER_HEIR = {
  id: "passed_over_heir", name: "Der übergangene Erbe", category: "dynasty",
  initialStage: "resentment", cooldownYears: 20, startChance: 0.4,
  checkEligibility: canStartPassedOverHeirChain,
  advance(state, chain) {
    const heirId = chain.actorIds[0];
    const heir = state.characters[heirId];
    if (chain.stage === "resentment") {
      if (chain.variables.nextYear === undefined) chain.variables.nextYear = state.year + 2 + Math.floor(rnd() * 3);
      if (state.year < chain.variables.nextYear) return;
      chain.stage = "demand";
      queueChainDecision(state, chain,
        "Ein Bruder fordert sein Recht",
        `${heir.name} ${heir.surname || ""} hat in den vergangenen Jahren zunehmend Unterstützung am Hofe gesammelt. Nun verlangt er öffentlich ein Amt, das seiner Geburt und seinem Rang angemessen sei.`.replace(/\s+/g, " "),
        [
          {
            label: "Fordern Sie ihn als Berater an (Amt anbieten).", outcome: "office_offered",
            effect: (s, c) => {
              const memory = recordWorldEvent(s, {
                type: "DEMAND_ACCEPTED", actorIds: [s.rulerId], targetIds: [heirId],
                emotionalWeight: 40, description: `${heir.name} ${heir.surname || ""} wurde ein Platz im Rat zugestanden.`.replace(/\s+/g, " "),
              });
              refreshRelationship(s, heirId, s.rulerId);
              resolveEventChain(s, c, "APPOINTED", `${heir.name} erhält ein Amt, der Groll legt sich.`);
              c.originatingMemoryIds.push(memory.id);
            },
          },
          {
            label: "Bieten Sie ihm eine kleinere Anerkennung an (Kompromiss).", outcome: "compromise",
            effect: (s, c) => {
              recordWorldEvent(s, {
                type: "DEMAND_ACCEPTED", actorIds: [s.rulerId], targetIds: [heirId],
                emotionalWeight: 18, description: `${heir.name} ${heir.surname || ""} erhielt eine kleinere Anerkennung seines Ranges.`.replace(/\s+/g, " "),
              });
              refreshRelationship(s, heirId, s.rulerId);
              c.stage = "watching";
              c.variables.nextYear = s.year + 2 + Math.floor(rnd() * 3);
            },
          },
          {
            label: "Weisen Sie seine Forderung zurück.", outcome: "refused",
            effect: (s, c) => {
              const memory = recordWorldEvent(s, {
                type: "DEMAND_REFUSED", actorIds: [s.rulerId], targetIds: [heirId],
                emotionalWeight: -30, description: `${heir.name} ${heir.surname || ""} wurde öffentlich zurückgewiesen.`.replace(/\s+/g, " "),
              });
              refreshRelationship(s, heirId, s.rulerId);
              c.originatingMemoryIds.push(memory.id);
              c.stage = "escalation";
              c.variables.nextYear = s.year + 1 + Math.floor(rnd() * 2);
            },
          },
        ]);
      return;
    }
    if (chain.stage === "watching") {
      if (state.year < chain.variables.nextYear) return;
      const rel = computeRelationshipBreakdown(state, heirId, state.rulerId);
      if (rel.total >= 0) { resolveEventChain(state, chain, "RECONCILED", `${heir.name} hat sich mit dem kleineren Zugeständnis versöhnt.`); return; }
      chain.stage = "escalation";
      chain.variables.nextYear = state.year + 1;
      return;
    }
    if (chain.stage === "escalation") {
      if (state.year < chain.variables.nextYear) return;
      const rel = computeRelationshipBreakdown(state, heirId, state.rulerId);
      const ambitious = heir.traits.includes("ehrgeizig") || heir.traits.includes("rachsuechtig");
      const escalateChance = clamp((ambitious ? 0.35 : 0.15) + Math.max(0, -rel.total) / 200, 0, 0.6);
      const reconcileChance = heir.traits.includes("loyal") || heir.traits.includes("bescheiden") ? 0.25 : 0.1;
      const roll = rnd();
      if (roll < escalateChance) {
        if (!heir.rivalIds.includes(state.rulerId)) addRivalry(state, heirId, state.rulerId);
        failEventChain(state, chain, "ESCALATED", `${heir.name} sammelt offen Unterstützer gegen den Herrscher.`);
      } else if (roll < escalateChance + reconcileChance) {
        queueChainDecision(state, chain,
          "Eine letzte Gelegenheit zur Versöhnung",
          `${heir.name} ${heir.surname || ""} zeigt trotz allem noch Bereitschaft, sich zu versöhnen — wenn ihm entgegengekommen wird.`.replace(/\s+/g, " "),
          [
            {
              label: "Reichen Sie ihm die Hand.", outcome: "reconciled",
              effect: (s, c) => {
                recordWorldEvent(s, { type: "DEMAND_ACCEPTED", actorIds: [s.rulerId], targetIds: [heirId], emotionalWeight: 35, description: `${heir.name} und der Herrscher versöhnen sich.` });
                refreshRelationship(s, heirId, s.rulerId);
                resolveEventChain(s, c, "RECONCILED", `${heir.name} und der Herrscher versöhnen sich nach Jahren der Spannung.`);
              },
            },
            {
              label: "Bleiben Sie hart.", outcome: "stayed_firm",
              effect: (s, c) => { c.stage = "escalation"; c.variables.nextYear = s.year + 2; },
            },
          ]);
      } else {
        chain.variables.nextYear = state.year + 2;
      }
    }
  },
};

// ============================================================
// CHAIN 2 — DER GEKRÄNKTE BERATER (§Punkt 14)
// ============================================================

function canStartGrievedAdvisorChain(state) {
  const cfg = CONFIG.eventChains;
  let candidate = null;
  for (const id in state.characters) {
    const c = state.characters[id];
    if (!c.alive || id === state.rulerId) continue;
    const wasDenied = hasMemory(state, { type: "DENIED_OFFICE", targetId: id, sinceYear: state.year - 15 });
    const wasDismissed = hasMemory(state, { type: "DISMISSED_FROM_OFFICE", targetId: id, sinceYear: state.year - 15 });
    if (!wasDenied && !wasDismissed) continue;
    const provocative = c.traits.includes("ehrgeizig") || c.traits.includes("rachsuechtig") || c.traits.includes("korrupt");
    if (!provocative) continue;
    const rel = computeRelationshipBreakdown(state, id, state.rulerId);
    if (rel.total >= -10) continue;
    candidate = { id, c, rel, wasDenied, wasDismissed };
    break;
  }
  if (!candidate) return chainEligibilityChecks([{ label: "Ehemaliger/aktueller Berater mit Amts-Kränkung, provokantem Trait und schlechter Beziehung existiert", passed: false }], {});
  const { id, c, rel } = candidate;
  const checks = [
    { label: "DENIED_OFFICE oder DISMISSED_FROM_OFFICE-Memory (letzte 15 Jahre): erfüllt", passed: true },
    { label: "ehrgeizig / rachsüchtig / korrupt: erfüllt", passed: true },
    { label: `Beziehung ${rel.total}: erfüllt (< -10)`, passed: rel.total < -10 },
    { label: "Character alive: erfüllt", passed: true },
  ];
  return chainEligibilityChecks(checks, {
    actorIds: [id], targetIds: [],
    variables: {}, // nextYear wird erst beim ersten advance()-Aufruf gewürfelt (§Punkt 52)
    urgency: "normal",
  });
}

const CHAIN_GRIEVED_ADVISOR = {
  id: "grieved_advisor", name: "Der gekränkte Berater", category: "hof",
  initialStage: "grudge", cooldownYears: 15, startChance: 0.35,
  checkEligibility: canStartGrievedAdvisorChain,
  advance(state, chain) {
    const id = chain.actorIds[0];
    const c = state.characters[id];
    if (chain.stage === "grudge") {
      if (chain.variables.nextYear === undefined) chain.variables.nextYear = state.year + 1 + Math.floor(rnd() * 2);
      if (state.year < chain.variables.nextYear) return;
      chain.stage = "demand";
      const stillInOffice = c.advisorRole !== null;
      queueChainDecision(state, chain,
        "Eine offene Forderung",
        `${c.name} ${c.surname || ""} lässt keinen Zweifel: die vergangene Zurücksetzung soll wiedergutgemacht werden — sonst drohe man mit ${stillInOffice ? "dem Rücktritt" : "einem Seitenwechsel"}.`.replace(/\s+/g, " "),
        [
          {
            label: "Zahlen Sie eine Wiedergutmachung.", outcome: "compensation",
            effect: (s, ch) => {
              s.treasury -= 150;
              recordWorldEvent(s, { type: "DEMAND_ACCEPTED", actorIds: [s.rulerId], targetIds: [id], emotionalWeight: 30, description: `${c.name} ${c.surname || ""} erhielt eine Wiedergutmachung.`.replace(/\s+/g, " ") });
              refreshRelationship(s, id, s.rulerId);
              resolveEventChain(s, ch, "COMPENSATED", `${c.name} nimmt die Wiedergutmachung an.`);
            },
          },
          {
            label: "Versprechen Sie ein höheres Amt bei nächster Gelegenheit.", outcome: "promised",
            effect: (s, ch) => {
              recordWorldEvent(s, { type: "DEMAND_ACCEPTED", actorIds: [s.rulerId], targetIds: [id], emotionalWeight: 20, description: `${c.name} ${c.surname || ""} wurde ein höheres Amt in Aussicht gestellt.`.replace(/\s+/g, " ") });
              refreshRelationship(s, id, s.rulerId);
              resolveEventChain(s, ch, "PROMISED", `${c.name} lässt sich mit einem Versprechen vorerst beruhigen.`);
            },
          },
          {
            label: "Weisen Sie die Forderung zurück.", outcome: "refused",
            effect: (s, ch) => {
              const memory = recordWorldEvent(s, { type: "DEMAND_REFUSED", actorIds: [s.rulerId], targetIds: [id], emotionalWeight: -30, description: `${c.name} ${c.surname || ""} wurde schroff zurückgewiesen.`.replace(/\s+/g, " ") });
              refreshRelationship(s, id, s.rulerId);
              ch.originatingMemoryIds.push(memory.id);
              if (stillInOffice) {
                dismissAdvisor(s, c.advisorRole);
                failEventChain(s, ch, "RESIGNED", `${c.name} tritt im Zorn zurück.`);
              } else {
                const ambitious = c.traits.includes("ehrgeizig") || c.traits.includes("rachsuechtig");
                if (ambitious && rnd() < 0.4 && !c.rivalIds.includes(s.rulerId)) addRivalry(s, id, s.rulerId);
                failEventChain(s, ch, "SIDE_CHANGED", `${c.name} wendet sich enttäuscht ab.`);
              }
            },
          },
        ]);
    }
  },
};

// ============================================================
// CHAIN 3 — DER KORRUPTE SCHATZMEISTER (§Punkt 15)
// ============================================================

function canStartCorruptTreasurerChain(state) {
  const advId = state.advisors.schatzmeister;
  if (!advId) return chainEligibilityChecks([{ label: "Amt Schatzmeister besetzt", passed: false }], {});
  const c = state.characters[advId];
  const checks = [];
  checks.push({ label: "Trait korrupt", passed: !!(c && c.alive && c.traits.includes("korrupt")) });
  if (!c || !c.alive || !c.traits.includes("korrupt")) return chainEligibilityChecks(checks, {});
  const tenureYears = c.appointedYear === null ? 999 : state.year - c.appointedYear; // §Migration: unbekannte Amtsdauer blockiert nicht
  const tenureOk = tenureYears >= 3;
  checks.push({ label: `Amtsdauer ${c.appointedYear === null ? "unbekannt (Altspielstand, nicht blockierend)" : tenureYears + " Jahre"}: erfüllt (>= 3)`, passed: tenureOk });
  const loyaltyOk = c.loyalty < 55;
  checks.push({ label: `Loyalität ${c.loyalty}: erfüllt (< 55)`, passed: loyaltyOk });
  const ruler = state.characters[state.rulerId];
  const verwaltungOk = ruler.stats.verwaltung < 13;
  checks.push({ label: `Herrscher-Verwaltung ${ruler.stats.verwaltung}: erfüllt (< 13, schwache Kontrolle)`, passed: verwaltungOk });
  if (!tenureOk || !loyaltyOk || !verwaltungOk) return chainEligibilityChecks(checks, {});
  return chainEligibilityChecks(checks, { actorIds: [advId], targetIds: [], variables: { nextYear: state.year + 1 }, urgency: "normal" });
}

const CHAIN_CORRUPT_TREASURER = {
  id: "corrupt_treasurer", name: "Unregelmäßigkeiten in der Staatskasse", category: "hof",
  initialStage: "suspicion", cooldownYears: 25, startChance: 0.3,
  checkEligibility: canStartCorruptTreasurerChain,
  advance(state, chain) {
    const advId = chain.actorIds[0];
    const c = state.characters[advId];
    if (!c || c.advisorRole !== "schatzmeister") { expireEventChain(state, chain, "OFFICE_VACATED", "Der Verdächtige ist nicht mehr im Amt."); return; }
    if (chain.stage === "suspicion") {
      if (state.year < chain.variables.nextYear) return;
      const ruler = state.characters[state.rulerId];
      const spionageBonus = advisorEffectBonus(state, "spionagemeister");
      const proofChance = clamp(0.35 + ruler.stats.verwaltung / 40 + spionageBonus, 0.1, 0.85);
      chain.variables.proofFound = rnd() < proofChance;
      chain.stage = "investigation";
      const proofText = chain.variables.proofFound
        ? "Erste Hinweise erhärten den Verdacht bereits deutlich."
        : "Bislang lässt sich nichts handfest beweisen.";
      queueChainDecision(state, chain,
        "Unregelmäßigkeiten in der Staatskasse",
        `Im Kassenbuch häufen sich seltsame Posten. Der Verdacht fällt auf ${c.name} ${c.surname || ""}, den Schatzmeister. ${proofText}`.replace(/\s+/g, " "),
        [
          {
            label: "Ignorieren.", outcome: "ignored",
            effect: (s, ch) => { s.treasury -= 100; resolveEventChain(s, ch, "IGNORED", "Die Unregelmäßigkeiten bleiben ungeahndet."); },
          },
          {
            label: "Diskret prüfen lassen.", outcome: "quiet_audit",
            effect: (s, ch) => {
              if (ch.variables.proofFound) {
                s.treasury += 200;
                recordWorldEvent(s, { type: "DEMAND_REFUSED", actorIds: [s.rulerId], targetIds: [advId], emotionalWeight: -15, description: `${c.name} ${c.surname || ""} musste stillschweigend Gelder zurückzahlen.`.replace(/\s+/g, " ") });
                refreshRelationship(s, advId, s.rulerId);
                resolveEventChain(s, ch, "QUIET_AUDIT", `Eine stille Prüfung bringt die veruntreuten Gelder zurück.`);
              } else {
                resolveEventChain(s, ch, "NOT_PROVEN", "Die diskrete Prüfung findet keine Beweise.");
              }
            },
          },
          {
            label: "Öffentlich anklagen.", outcome: "public_accusation",
            effect: (s, ch) => {
              if (ch.variables.proofFound) {
                dismissAdvisor(s, "schatzmeister");
                s.prestige += 8;
                s.treasury += 150;
                resolveEventChain(s, ch, "PUBLICLY_EXPOSED", `${c.name} wird öffentlich der Korruption überführt und entlassen.`);
              } else {
                s.prestige = Math.max(0, s.prestige - 12);
                const memory = recordWorldEvent(s, { type: "PUBLICLY_HUMILIATED", actorIds: [s.rulerId], targetIds: [advId], emotionalWeight: -50, description: `${c.name} ${c.surname || ""} wurde ohne Beweise öffentlich bloßgestellt.`.replace(/\s+/g, " ") });
                refreshRelationship(s, advId, s.rulerId);
                ch.originatingMemoryIds.push(memory.id);
                failEventChain(s, ch, "FAILED_ACCUSATION", `Die unbewiesene Anklage beschädigt den Ruf des Herrschers.`);
              }
            },
          },
          {
            label: "Stillschweigend entlassen.", outcome: "quiet_dismissal",
            effect: (s, ch) => { dismissAdvisor(s, "schatzmeister"); resolveEventChain(s, ch, "DISMISSED", `${c.name} wird ohne Aufsehen entlassen.`); },
          },
        ]);
    }
  },
};

// ============================================================
// CHAIN 4 — HUNGERKRISE (§Punkt 16)
// ============================================================

function canStartFamineCrisisChain(state) {
  // §Punkt 16 "keine künstliche Hungersnot": nutzt exakt dieselbe
  // FAMINE-Memory, die js/memory.js aus einer echten Nahrungsknappheit
  // erzeugt (§Punkt 31 "Memories als Auslöser") — keine eigene Schwelle.
  const recentFamine = hasMemory(state, { type: "FAMINE", sinceYear: state.year - 1 });
  const checks = [{ label: "Aktuelle FAMINE-Memory (echte Hungerkrise, letztes Jahr) vorhanden", passed: recentFamine }];
  if (!recentFamine) return chainEligibilityChecks(checks, {});
  return chainEligibilityChecks(checks, { regionIds: ["player"], variables: {}, urgency: "high" });
}

const CHAIN_FAMINE_CRISIS = {
  id: "famine_crisis", name: "Hungerkrise", category: "wirtschaft",
  initialStage: "decision", cooldownYears: 8, startChance: 0.6,
  systemCritical: true, // §Phase-6-Punkt 26: echte Hungersnot ist NICHT staffelbar, anders als optionale Chains
  checkEligibility: canStartFamineCrisisChain,
  advance(state, chain) {
    if (chain.stage === "decision") {
      chain.stage = "aftermath";
      chain.variables.nextYear = state.year + 2;
      queueChainDecision(state, chain,
        "Leere Kornspeicher",
        "Die Hungerkrise trifft die Ärmsten am härtesten. Vor den Kornspeichern wird es unruhig — die Bevölkerung erwartet eine Antwort des Herrschers.",
        [
          {
            label: "Korn aus dem Ausland kaufen (-600 Taler).", outcome: "buy_grain",
            effect: (s, c) => { s.treasury -= 600; const r = s.regions.player; r.warehouse.getreide = (r.warehouse.getreide || 0) + 80; for (const pid in r.population) r.population[pid].satisfaction = clamp(r.population[pid].satisfaction + 8, 0, 100); },
          },
          {
            label: "Staatliche Reserven öffnen.", outcome: "open_reserves",
            effect: (s, c) => { const r = s.regions.player; r.warehouse.getreide = Math.max(0, (r.warehouse.getreide || 0) - 40); r.population.arme.satisfaction = clamp(r.population.arme.satisfaction + 15, 0, 100); },
          },
          {
            label: "Preise gesetzlich begrenzen.", outcome: "price_cap",
            effect: (s, c) => { const r = s.regions.player; r.population.arme.satisfaction = clamp(r.population.arme.satisfaction + 6, 0, 100); r.population.haendler.satisfaction = clamp(r.population.haendler.satisfaction - 18, 0, 100); },
          },
          {
            label: "Nichts unternehmen.", outcome: "do_nothing",
            effect: (s, c) => { const r = s.regions.player; for (const pid in r.population) r.population[pid].satisfaction = clamp(r.population[pid].satisfaction - 12, 0, 100); },
          },
        ]);
      return;
    }
    if (chain.stage === "aftermath") {
      if (state.year < chain.variables.nextYear) return;
      const r = state.regions.player;
      const grainRatio = r.grainRatio !== undefined ? r.grainRatio : 1;
      if (grainRatio >= 0.8) resolveEventChain(state, chain, "RECOVERED", "Die Versorgungslage hat sich erholt.");
      else failEventChain(state, chain, "PROLONGED", "Die Not hält an.");
    }
  },
};

// ============================================================
// CHAIN 5 — HANDELSKONFLIKT (§Punkt 17)
// ============================================================

function canStartTradeConflictChain(state) {
  const r = state.regions.player;
  const highTax = r.taxRate > 0.28;
  const checks = [{ label: `Zollsatz ${(r.taxRate * 100).toFixed(0)}%: erfüllt (> 28%)`, passed: highTax }];
  const partner = highTax ? null : Object.keys(state.diplomacy).find(aiId => state.diplomacy[aiId].treaties.handel && state.diplomacy[aiId].relation < 15);
  if (!highTax) checks.push({ label: "Handelspartner mit Handelsvertrag und schlechter Beziehung (< 15) existiert", passed: !!partner });
  if (!highTax && !partner) return chainEligibilityChecks(checks, {});
  return chainEligibilityChecks(checks, { regionIds: partner ? [partner] : ["player"], variables: { partner: partner || null }, urgency: "low" });
}

const CHAIN_TRADE_CONFLICT = {
  id: "trade_conflict", name: "Die Händlergilde beschwert sich", category: "wirtschaft",
  initialStage: "complaint", cooldownYears: 10, startChance: 0.35,
  checkEligibility: canStartTradeConflictChain,
  advance(state, chain) {
    if (chain.stage === "complaint") {
      chain.stage = "resolution";
      queueChainDecision(state, chain,
        "Die Handelswege werden teuer",
        "Kaufleute klagen über hohe Zölle und stockende Geschäfte. Sie drohen, ihre Waren woanders zu verkaufen, wenn sich nichts ändert.",
        [
          {
            label: "Zölle senken.", outcome: "lower_tax",
            effect: (s, c) => { const r = s.regions.player; r.taxRate = Math.max(0.05, r.taxRate - 0.06); r.population.haendler.satisfaction = clamp(r.population.haendler.satisfaction + 15, 0, 100); resolveEventChain(s, c, "TAX_LOWERED", "Die Zölle werden gesenkt, die Händler beruhigen sich."); },
          },
          {
            label: "Sonderprivileg gewähren (-250 Taler).", outcome: "privilege",
            effect: (s, c) => { s.treasury -= 250; s.regions.player.population.haendler.satisfaction = clamp(s.regions.player.population.haendler.satisfaction + 20, 0, 100); if (c.variables.partner) { const dip = s.diplomacy[c.variables.partner]; dip.relation = clamp(dip.relation + 10, -100, 100); } resolveEventChain(s, c, "PRIVILEGE_GRANTED", "Ein Sonderprivileg besänftigt die Kaufleute."); },
          },
          {
            label: "Die Beschwerde abweisen.", outcome: "dismissed",
            effect: (s, c) => { s.regions.player.population.haendler.satisfaction = clamp(s.regions.player.population.haendler.satisfaction - 15, 0, 100); if (c.variables.partner) { const dip = s.diplomacy[c.variables.partner]; dip.relation = clamp(dip.relation - 10, -100, 100); } failEventChain(s, c, "DISMISSED", "Die Beschwerde wird abgewiesen, der Unmut bleibt."); },
          },
        ]);
    }
  },
};

// ============================================================
// CHAIN 6 — GRENZKONFLIKT (§Punkt 18)
// ============================================================

function canStartBorderConflictChain(state) {
  for (const aiId in state.diplomacy) {
    if (state.warState && state.warState[aiId]) continue; // bereits offener Krieg — kein Vorfall mehr nötig
    const dip = state.diplomacy[aiId];
    if (dip.relation >= -15) continue;
    const factors = evaluateAiAggressionFactors(state, aiId);
    if (factors.gesamt <= 5) continue; // spürbare, aber noch keine kriegsauslösende Spannung
    return chainEligibilityChecks([
      { label: `Beziehung zu ${state.regions[aiId].name} (${dip.relation}): erfüllt (< -15)`, passed: true },
      { label: `militärische Spannung (${factors.gesamt}): erfüllt (> 5)`, passed: true },
      { label: "noch kein offener Krieg: erfüllt", passed: true },
    ], { regionIds: [aiId], variables: {}, urgency: "normal" });
  }
  return chainEligibilityChecks([{ label: "Nachbarregion mit schlechter Beziehung und spürbarer militärischer Spannung, aber noch ohne Krieg existiert", passed: false }], {});
}

const CHAIN_BORDER_CONFLICT = {
  id: "border_conflict", name: "Zwischenfall an der Grenze", category: "diplomatie",
  initialStage: "incident", cooldownYears: 10, startChance: 0.35,
  checkEligibility: canStartBorderConflictChain,
  advance(state, chain) {
    const aiId = chain.regionIds[0];
    const region = state.regions[aiId];
    if (!region) { expireEventChain(state, chain, "REGION_GONE", "Die Region existiert nicht mehr in dieser Form."); return; }
    if (chain.stage === "incident") {
      chain.stage = "resolution";
      queueChainDecision(state, chain,
        "Zwischenfall an der Grenze",
        `An der Grenze zu ${region.name} kam es zu einem gewaltsamen Zwischenfall. Beide Seiten geben sich gegenseitig die Schuld.`,
        [
          {
            label: "Entschuldigung fordern.", outcome: "demand_apology",
            effect: (s, c) => { const dip = s.diplomacy[aiId]; dip.relation = clamp(dip.relation + 5, -100, 100); resolveEventChain(s, c, "APOLOGY", `${region.name} entschuldigt sich, die Lage entspannt sich.`); },
          },
          {
            label: "Entschädigung verlangen.", outcome: "demand_compensation",
            effect: (s, c) => { const dip = s.diplomacy[aiId]; s.treasury += 150; dip.relation = clamp(dip.relation - 5, -100, 100); resolveEventChain(s, c, "COMPENSATION", `${region.name} zahlt widerwillig eine Entschädigung.`); },
          },
          {
            label: "Truppen an der Grenze mobilisieren.", outcome: "mobilize",
            effect: (s, c) => { const dip = s.diplomacy[aiId]; dip.relation = clamp(dip.relation - 15, -100, 100); failEventChain(s, c, "MOBILIZED", `Die Mobilisierung heizt die Spannung mit ${region.name} weiter an.`); },
          },
          {
            label: "Diplomatisch beruhigen.", outcome: "de_escalate",
            effect: (s, c) => { const dip = s.diplomacy[aiId]; dip.relation = clamp(dip.relation + 12, -100, 100); resolveEventChain(s, c, "DEESCALATED", `Geschickte Diplomatie entschärft den Zwischenfall mit ${region.name}.`); },
          },
        ]);
    }
  },
};

// ============================================================
// CHAIN 7 — DYNASTISCHE HEIRAT (§Punkt 19)
// ============================================================

function canStartDynasticMarriageChain(state) {
  const cfg = CONFIG.eventChains;
  let candidate = null;
  const ruler = state.characters[state.rulerId];
  const familyIds = ruler.childrenIds.concat(
    ruler.parentId ? Object.keys(state.characters).filter(id => state.characters[id].parentId === ruler.parentId && id !== state.rulerId) : []
  );
  for (const id of familyIds) {
    const c = state.characters[id];
    if (c && c.alive && c.age >= cfg.adultAge && !c.spouseId) { candidate = { id, c }; break; }
  }
  if (!candidate) return chainEligibilityChecks([{ label: "Erwachsenes, unverheiratetes Familienmitglied existiert", passed: false }], {});
  const partnerId = Object.keys(state.diplomacy).find(aiId => state.diplomacy[aiId].relation >= 25);
  const checks = [
    { label: `Erwachsenes (${candidate.c.age}), unverheiratetes Familienmitglied: erfüllt`, passed: true },
    { label: "politisch sinnvoller Kandidat (Beziehung >= 25) existiert", passed: !!partnerId },
  ];
  if (!partnerId) return chainEligibilityChecks(checks, {});
  return chainEligibilityChecks(checks, { actorIds: [candidate.id], regionIds: [partnerId], variables: {}, urgency: "low" });
}

const CHAIN_DYNASTIC_MARRIAGE = {
  id: "dynastic_marriage", name: "Ein Heiratsangebot", category: "dynastie",
  initialStage: "proposal", cooldownYears: 12, startChance: 0.3,
  checkEligibility: canStartDynasticMarriageChain,
  advance(state, chain) {
    const id = chain.actorIds[0];
    const c = state.characters[id];
    const aiId = chain.regionIds[0];
    const region = state.regions[aiId];
    if (!c || c.spouseId) { expireEventChain(state, chain, "ALREADY_MARRIED", `${c ? c.name : "Das Familienmitglied"} hat bereits anderweitig geheiratet.`); return; }
    if (!region) { expireEventChain(state, chain, "REGION_GONE", "Der vorgesehene Partner steht nicht mehr zur Verfügung."); return; }
    if (chain.stage === "proposal") {
      chain.stage = "resolution";
      queueChainDecision(state, chain,
        "Ein Heiratsangebot aus " + region.name,
        `${region.name} lässt anfragen, ob ${c.name} ${c.surname || ""} als Ehepartner(in) für ein Mitglied des dortigen Hauses in Frage käme — eine Gelegenheit, die Beziehungen dauerhaft zu festigen.`.replace(/\s+/g, " "),
        [
          {
            label: "Angebot annehmen.", outcome: "accepted",
            effect: (s, ch) => {
              const spouse = createCharacter(c.gender === "m" ? "f" : "m", 16 + Math.floor(rnd() * 20), randomNobleHouse());
              const sid = nextCharId();
              s.characters[sid] = spouse;
              c.spouseId = sid; spouse.spouseId = id;
              const dip = s.diplomacy[aiId];
              dip.relation = clamp(dip.relation + 20, -100, 100);
              dip.dynasticMarriageFloor = Math.max(dip.dynasticMarriageFloor || -100, dip.relation - 20);
              recordWorldEvent(s, { type: "MARRIAGE", actorIds: [id, sid], targetIds: [id, sid], emotionalWeight: 35, description: `${c.name} ${c.surname || ""} vermählte sich mit dem Haus ${region.name}.`.replace(/\s+/g, " ") });
              resolveEventChain(s, ch, "MARRIED", `${c.name} heiratet in das Haus ${region.name} ein.`);
            },
          },
          {
            label: "Höhere Mitgift aushandeln (-300 Taler, bessere Beziehung).", outcome: "dowry",
            effect: (s, ch) => {
              s.treasury -= 300;
              const spouse = createCharacter(c.gender === "m" ? "f" : "m", 16 + Math.floor(rnd() * 20), randomNobleHouse());
              const sid = nextCharId();
              s.characters[sid] = spouse;
              c.spouseId = sid; spouse.spouseId = id;
              const dip = s.diplomacy[aiId];
              dip.relation = clamp(dip.relation + 30, -100, 100);
              dip.dynasticMarriageFloor = Math.max(dip.dynasticMarriageFloor || -100, dip.relation - 25);
              recordWorldEvent(s, { type: "MARRIAGE", actorIds: [id, sid], targetIds: [id, sid], emotionalWeight: 40, description: `${c.name} ${c.surname || ""} vermählte sich mit dem Haus ${region.name} bei großzügiger Mitgift.`.replace(/\s+/g, " ") });
              resolveEventChain(s, ch, "MARRIED_WITH_DOWRY", `${c.name} heiratet mit ausgehandelter Mitgift in das Haus ${region.name} ein.`);
            },
          },
          {
            label: "Angebot ablehnen.", outcome: "declined",
            effect: (s, ch) => { const dip = s.diplomacy[aiId]; dip.relation = clamp(dip.relation - 8, -100, 100); failEventChain(s, ch, "DECLINED", `Das Heiratsangebot aus ${region.name} wird ausgeschlagen.`); },
          },
        ]);
    }
  },
};

// ============================================================
// CHAIN 8 — KIRCHLICHER KONFLIKT (§Punkt 20)
// ============================================================

function canStartChurchConflictChain(state) {
  const infl = state.religiousInfluence !== undefined ? state.religiousInfluence : 55;
  const low = infl < CONFIG.religion.lowInfluenceThreshold + 10;
  const checks = [{ label: `Kirchlicher Einfluss ${Math.round(infl)}: erfüllt (< ${CONFIG.religion.lowInfluenceThreshold + 10})`, passed: low }];
  if (!low) return chainEligibilityChecks(checks, {});
  return chainEligibilityChecks(checks, { variables: {}, urgency: "low" });
}

const CHAIN_CHURCH_CONFLICT = {
  id: "church_conflict", name: "Die Kirche erhebt Einspruch", category: "politik",
  initialStage: "grievance", cooldownYears: 12, startChance: 0.3,
  checkEligibility: canStartChurchConflictChain,
  advance(state, chain) {
    if (chain.stage === "grievance") {
      chain.stage = "resolution";
      queueChainDecision(state, chain,
        "Die Kirche erhebt Einspruch",
        "Der Klerus beklagt sich offen über mangelnde Frömmigkeit am Hofe und fordert ein Zeichen des guten Willens.",
        [
          {
            label: "Zugeständnis machen (-200 Taler, +kirchlicher Einfluss).", outcome: "concession",
            effect: (s, c) => { s.treasury -= 200; s.religiousInfluence = clamp((s.religiousInfluence || 55) + 15, 0, 100); resolveEventChain(s, c, "CONCESSION", "Ein großzügiges Zugeständnis besänftigt die Kirche."); },
          },
          {
            label: "Verhandeln (kleines Zugeständnis).", outcome: "negotiate",
            effect: (s, c) => { s.religiousInfluence = clamp((s.religiousInfluence || 55) + 7, 0, 100); s.regions.player.population.arme.satisfaction = clamp(s.regions.player.population.arme.satisfaction - 3, 0, 100); resolveEventChain(s, c, "NEGOTIATED", "Ein Kompromiss beruhigt die Lage vorerst."); },
          },
          {
            label: "Die Forderung ablehnen.", outcome: "refuse",
            effect: (s, c) => { s.religiousInfluence = clamp((s.religiousInfluence || 55) - 12, 0, 100); s.legitimacy = Math.max(0, s.legitimacy - 5); failEventChain(s, c, "REFUSED", "Die Ablehnung verstimmt den Klerus nachhaltig."); },
          },
        ]);
    }
  },
};

// ============================================================
// CHAIN 9 — DER AUFSTEIGENDE RIVALE (§Punkt 21)
// ============================================================

function canStartRisingRivalChain(state) {
  const ruler = state.characters[state.rulerId];
  let candidate = null;
  for (const id of ruler.rivalIds) {
    const c = state.characters[id];
    if (!c || !c.alive) continue;
    const hasOffice = !!c.advisorRole;
    const strongClaim = c.claims.some(cl => cl.strength === "strong" || cl.strength === "primary");
    if (hasOffice || strongClaim) { candidate = { id, c, hasOffice, strongClaim }; break; }
  }
  if (!candidate) return chainEligibilityChecks([{ label: "Ein lebender Rivale mit Amt oder starkem Claim existiert", passed: false }], {});
  const checks = [
    { label: "Rivalität besteht (Phase 3/4): erfüllt", passed: true },
    { label: `Amt oder starker Claim (Amt: ${candidate.hasOffice}, Claim: ${candidate.strongClaim}): erfüllt`, passed: true },
    { label: "Character alive: erfüllt", passed: true },
  ];
  return chainEligibilityChecks(checks, { actorIds: [candidate.id], variables: {}, urgency: "normal" });
}

const CHAIN_RISING_RIVAL = {
  id: "rising_rival", name: "Der aufsteigende Rivale", category: "hof",
  initialStage: "awareness", cooldownYears: 15, startChance: 0.3,
  checkEligibility: canStartRisingRivalChain,
  advance(state, chain) {
    const id = chain.actorIds[0];
    const c = state.characters[id];
    if (chain.stage === "awareness") {
      chain.stage = "resolution";
      queueChainDecision(state, chain,
        "Der Hof spricht über einen Rivalen",
        `${c.name} ${c.surname || ""} gewinnt zunehmend Ansehen bei Hofe. Man munkelt bereits, er könnte eine Alternative zum Herrscher darstellen.`.replace(/\s+/g, " "),
        [
          {
            label: "Versöhnung anbieten.", outcome: "reconcile",
            effect: (s, ch) => {
              recordWorldEvent(s, { type: "DEMAND_ACCEPTED", actorIds: [s.rulerId], targetIds: [id], emotionalWeight: 35, description: `Der Herrscher bietet ${c.name} ${c.surname || ""} Versöhnung an.`.replace(/\s+/g, " ") });
              refreshRelationship(s, id, s.rulerId);
              const rel = computeRelationshipBreakdown(s, id, s.rulerId);
              if (rel.total > 10) {
                c.rivalIds = c.rivalIds.filter(rid => rid !== s.rulerId);
                const ruler = s.characters[s.rulerId];
                ruler.rivalIds = ruler.rivalIds.filter(rid => rid !== id);
                resolveEventChain(s, ch, "RECONCILED", `${c.name} ist fortan kein Rivale mehr.`);
              } else {
                resolveEventChain(s, ch, "PARTIAL_RECONCILIATION", `${c.name} bleibt vorsichtig, aber die Spannung sinkt.`);
              }
            },
          },
          {
            label: "Isolieren (Amt entziehen, falls vorhanden).", outcome: "isolate",
            effect: (s, ch) => {
              if (c.advisorRole) dismissAdvisor(s, c.advisorRole);
              refreshRelationship(s, id, s.rulerId);
              resolveEventChain(s, ch, "ISOLATED", `${c.name} wird gezielt vom Hof isoliert.`);
            },
          },
          {
            label: "Nur beobachten.", outcome: "observe",
            effect: (s, ch) => { resolveEventChain(s, ch, "MONITORED", `Der Herrscher behält ${c.name} vorerst nur im Auge.`); },
          },
        ]);
    }
  },
};

// ============================================================
// CHAIN 10 — KAISERLICHE AMBITION (§Punkt 22)
// ============================================================

function canStartImperialAmbitionChain(state) {
  const kurfuerstRank = TITLES.findIndex(t => t.id === "kurfuerst");
  const titleOk = state.titleIndex >= kurfuerstRank;
  const prestigeOk = state.prestige >= 200;
  const checks = [
    { label: `Titel (Index ${state.titleIndex}): erfüllt (>= Kurfürst)`, passed: titleOk },
    { label: `Prestige ${Math.round(state.prestige)}: erfüllt (>= 200)`, passed: prestigeOk },
  ];
  if (!titleOk || !prestigeOk) return chainEligibilityChecks(checks, {});
  return chainEligibilityChecks(checks, { variables: {}, urgency: "low" });
}

const CHAIN_IMPERIAL_AMBITION = {
  id: "imperial_ambition", name: "Kaiserliche Ambitionen", category: "politik",
  initialStage: "suggestion", cooldownYears: 15, startChance: 0.25,
  checkEligibility: canStartImperialAmbitionChain,
  advance(state, chain) {
    if (chain.stage === "suggestion") {
      chain.stage = "resolution";
      queueChainDecision(state, chain,
        "Kaiserliche Ambitionen",
        "Die Berater am Hof deuten unverhohlen an: Rang und Ansehen des Herrschers rechtfertigen inzwischen offene Ambitionen auf die Kaiserkrone.",
        [
          {
            label: "Offen um Unterstützung werben.", outcome: "openly_campaign",
            effect: (s, c) => { s.prestige += 10; resolveEventChain(s, c, "CAMPAIGNING", "Der Herrscher wirbt offen um die Kaiserkrone."); },
          },
          {
            label: "Diskret Unterstützung bei den Kurfürsten suchen.", outcome: "discreet_support",
            effect: (s, c) => {
              for (const aiId in s.diplomacy) { const dip = s.diplomacy[aiId]; dip.relation = clamp(dip.relation + 4, -100, 100); }
              resolveEventChain(s, c, "DISCREET_SUPPORT", "Diskrete Gesandte werben leise um Unterstützung.");
            },
          },
          {
            label: "Vorerst verzichten.", outcome: "defer",
            effect: (s, c) => { resolveEventChain(s, c, "DEFERRED", "Der Herrscher verzichtet vorerst auf offene Ambitionen."); },
          },
        ]);
    }
  },
};

// ---------- Registrierung ----------
const CHAIN_TEMPLATES = {
  passed_over_heir: CHAIN_PASSED_OVER_HEIR,
  grieved_advisor: CHAIN_GRIEVED_ADVISOR,
  corrupt_treasurer: CHAIN_CORRUPT_TREASURER,
  famine_crisis: CHAIN_FAMINE_CRISIS,
  trade_conflict: CHAIN_TRADE_CONFLICT,
  border_conflict: CHAIN_BORDER_CONFLICT,
  dynastic_marriage: CHAIN_DYNASTIC_MARRIAGE,
  church_conflict: CHAIN_CHURCH_CONFLICT,
  rising_rival: CHAIN_RISING_RIVAL,
  imperial_ambition: CHAIN_IMPERIAL_AMBITION,
};
