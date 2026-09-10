// ============================================================
// IMPERIAL POLITICS — Phase 12 "Kaiserwahl 2.0": aus einer Schwellenprüfung
// + Bestechungs-Autowin wird der politische Höhepunkt einer Kampagne.
//
// Architekturregeln dieses Moduls (§2/§3 des Auftrags):
//  - KEIN zweites Diplomatiesystem. Die sieben Electors SIND
//    state.diplomacy (ai1-ai7, seit dieser Phase alle sieben — s. newGame()
//    in js/core.js) — jede bestehende Diplomatiefunktion (Geschenke,
//    Bündnisse, Verträge, Sabotage, checkForeignRulerDeaths) wirkt
//    automatisch auch auf die vier neuen Electors, ohne dass dieses Modul
//    sie dupliziert.
//  - Stance/Score werden bei Bedarf berechnet (computeElectorScoreBreakdown),
//    nicht laufend fortgeschrieben — dasselbe additive Breakdown-Muster wie
//    computeDramaTensionBreakdown()/computeEstateInfluenceBreakdown().
//  - state.imperialCandidacy trägt NUR, was für die laufende Kandidatur
//    wirklich transient ist (Rivalen-Auswahl bei Kandidaturerklärung
//    festgelegt, Geschenk-Zähler für abklingende Wirkung). state.electionPromises
//    ist die DAUERHAFTE Zusagen-Ablage — überlebt Wahlsieg/-niederlage, damit
//    ein gebrochenes Versprechen Jahre später noch nachwirken kann (§50/§128).
//  - Rivalen-Kandidaten sind ausschließlich echte region.rulerId-Charaktere
//    (Phase 8E) — kein erfundener NPC, keine KI-KI-Beziehungen (die es im
//    bestehenden Modell nicht gibt, §3) werden vorgetäuscht: Faktoren, die
//    das erfordern würden (z.B. diplomatische Beziehung), tragen bei
//    Rivalen-Kandidaten ehrlich 0 bei, statt geschätzt zu werden.
// ============================================================

// ---------- Electors (§7-13) ----------
function getElectorIds(state) { return Object.keys(state.diplomacy); }

function isWarCapableElector(state, aiId) { return !!(state.warState && (aiId in state.warState)); }

// ---------- Wohlstands-Proxy für KI-Regionen (§30: reale, bereits
// vorhandene Voraussetzungen statt einer erfundenen AI-Prestige-Kennzahl —
// dieselbe Formel, die aiRegionDevelops() (js/economy.js) bereits für
// KI-Bauentscheidungen verwendet, hier nur wiederverwendet, nicht neu erfunden). ----------
function computeRegionWealthProxy(region) {
  const totalPop = Object.values(region.population).reduce((s, g) => s + g.count, 0);
  return (region.warehouse.getreide || 0) + (region.warehouse.eisen || 0) * 3 + (region.warehouse.werkzeuge || 0) * 4 + totalPop * 0.15;
}

// ---------- Rivalen-Kandidaten (§28-34) ----------
function checkRivalCandidateEligibility(state, aiId) {
  const region = state.regions[aiId];
  const kurfuerst = TITLES.find(t => t.id === "kurfuerst");
  const totalPop = Object.values(region.population).reduce((s, g) => s + g.count, 0);
  const wealthProxy = computeRegionWealthProxy(region);
  const minWealth = CONFIG.ai.buildWealthThreshold * CONFIG.election.candidateEligibility.wealthProxyMultiplier;
  const checks = [
    { label: `Bevölkerung ${Math.round(totalPop)}: erfüllt (>= ${kurfuerst.reqPop}, dieselbe Schwelle wie beim Spieler)`, passed: totalPop >= kurfuerst.reqPop },
    { label: "Kathedrale errichtet", passed: hasBuilding(region, "kathedrale") },
    { label: `Wohlstand ${Math.round(wealthProxy)}: erfüllt (>= ${Math.round(minWealth)})`, passed: wealthProxy >= minWealth },
    { label: "Herrscher lebt", passed: !!(region.rulerId && state.characters[region.rulerId] && state.characters[region.rulerId].alive) },
  ];
  return { checks, eligible: checks.every(c => c.passed) };
}

// Deterministisch (kein RNG): sortiert nach Wohlstands-Proxy, gedeckelt auf
// maxRivalCandidates (§33: politische Lesbarkeit vor Simulationsexzess).
function getEligibleRivalCandidates(state) {
  const out = [];
  for (const aiId of getElectorIds(state)) {
    const elig = checkRivalCandidateEligibility(state, aiId);
    if (elig.eligible) out.push({ aiId, rulerId: state.regions[aiId].rulerId, wealthProxy: computeRegionWealthProxy(state.regions[aiId]) });
  }
  out.sort((a, b) => b.wealthProxy - a.wealthProxy || a.aiId.localeCompare(b.aiId));
  return out.slice(0, CONFIG.election.maxRivalCandidates);
}

// ---------- Kandidatur des Spielers (§28-43) ----------
function checkImperialCandidacyEligibility(state) {
  const titleRank = state.titleIndex;
  const kurfuerstRank = TITLES.findIndex(t => t.id === "kurfuerst");
  const checks = [
    { label: `Titel (Index ${titleRank}): erfüllt (>= Kurfürst)`, passed: titleRank >= kurfuerstRank },
    { label: "Kathedrale errichtet", passed: hasBuilding(state.regions.player, "kathedrale") },
    { label: "Keine Kandidatur bereits erklärt", passed: !state.imperialCandidacy },
    { label: "Keine Wahl derzeit anhängig", passed: !state.pendingElection },
    { label: `Kein Nachwahl-Cooldown (${state.electionCooldown || 0} Jahre verbleibend)`, passed: (state.electionCooldown || 0) <= 0 },
  ];
  return { checks, eligible: checks.every(c => c.passed) };
}

// Spielerseitige, bewusste Entscheidung (§42) statt automatischem Trigger --
// öffnet die 3-8-jährige Wahlvorphase (§38) und legt die Rivalen-Kandidaten
// FEST (nicht bei jeder Score-Abfrage neu gewürfelt/neu bestimmt), damit
// eine Kandidatur eine erkennbare, stabile politische Lage beschreibt.
function declareImperialCandidacy(state) {
  const elig = checkImperialCandidacyEligibility(state);
  if (!elig.eligible) return { ok: false, reason: "Voraussetzungen für eine Kandidatur nicht erfüllt.", checks: elig.checks };
  const cfg = CONFIG.election;
  const rivals = getEligibleRivalCandidates(state);
  state.imperialCandidacy = {
    declaredYear: state.year,
    rivalCandidateIds: rivals.map(r => r.rulerId),
    giftsGivenThisCandidacy: {},
  };
  if (!state.electionPromises) state.electionPromises = { byId: {}, nextId: 1 };
  const ruler = state.characters[state.rulerId];
  addChronicle(state, `${ruler.name} ${ruler.surname || ""} erhebt Anspruch auf die Kaiserkrone.`.replace(/\s+/g, " "));
  recordWorldEvent(state, {
    type: "IMPERIAL_CANDIDACY_DECLARED", actorIds: [state.rulerId], targetIds: [],
    emotionalWeight: 30, metadata: { rivalCount: rivals.length },
    description: `${ruler.name} ${ruler.surname || ""} erhebt Anspruch auf die Kaiserkrone.`.replace(/\s+/g, " "),
  });
  return { ok: true, rivalCandidateIds: state.imperialCandidacy.rivalCandidateIds };
}

// ---------- Geschenke während der Kandidatur (§20/§73-79: ersetzt das alte
// bribed[aiId]=true-Autowin) ----------
function giftElector(state, aiId) {
  if (!state.imperialCandidacy) return { ok: false, reason: "Derzeit läuft keine Kandidatur." };
  const cfg = CONFIG.election;
  if (state.treasury < cfg.giftCost) return { ok: false, reason: "Nicht genug Taler für ein Geschenk." };
  state.treasury -= cfg.giftCost;
  logLedger(state, `Diplomatisches Geschenk an ${state.regions[aiId].name} (Kaiserwahl)`, -cfg.giftCost);
  const prevCount = state.imperialCandidacy.giftsGivenThisCandidacy[aiId] || 0;
  state.imperialCandidacy.giftsGivenThisCandidacy[aiId] = prevCount + 1;
  // §77/§78: abklingende Wirkung je wiederholtem Geschenk, durch "gierig"
  // (giftEffectMod, s. TRAITS in data/gamedata.js) verstärkbar.
  const electorRuler = state.characters[state.regions[aiId].rulerId];
  const traitMod = electorRuler ? traitEffectSum(electorRuler, "giftEffectMod") : 0;
  const decayed = cfg.giftDuringCandidacyRelationGain * Math.pow(cfg.giftDiminishingReturnsFactor, prevCount) * (1 + traitMod);
  state.diplomacy[aiId].relation = clamp(state.diplomacy[aiId].relation + decayed, -100, 100);
  addChronicle(state, `${state.regions[aiId].name} erhielt ein diplomatisches Geschenk vor der Kaiserwahl.`);
  return { ok: true, relationGain: Math.round(decayed * 10) / 10 };
}

// ---------- Wahlversprechen (§44-60) ----------
// Nur Typen, die auf echten, bereits bestehenden Mechaniken beruhen (§45/§46):
//   no_war_target    — dem Elector zugesagt, ein bestimmtes drittes ai-Gebiet
//                       nicht anzugreifen (echte declareWar()-Handlung)
//   maintain_alliance — die BEREITS bestehende Allianz mit dem Elector selbst
//                       nicht aufzukündigen (echtes treaties.allianz)
//   maintain_treaty  — einen bestimmten Vertrag (nichtangriff/handel) mit
//                       einem dritten ai-Gebiet aufrechtzuerhalten
//   pay_tribute      — eine zugesagte Zahlung bis zu einer Frist zu leisten
// "Unterstützung in einem Konflikt" (§45-Beispiel) entfällt bewusst -- es
// gibt in der bestehenden Architektur keine KI-gegen-KI-Kriege, die der
// Spieler unterstützen könnte (§3: keine neue Diplomatiemechanik erfinden).
function createElectionPromise(state, aiId, type, conditions) {
  if (!state.imperialCandidacy) return { ok: false, reason: "Derzeit läuft keine Kandidatur." };
  if (type === "maintain_alliance" && !state.diplomacy[aiId].treaties.allianz) {
    return { ok: false, reason: "Es besteht noch kein Bündnis, das aufrechterhalten werden könnte." };
  }
  const cfg = CONFIG.election.promise;
  if (!state.electionPromises) state.electionPromises = { byId: {}, nextId: 1 };
  const id = "promise" + state.electionPromises.nextId++;
  const promise = {
    id, electorRegionId: aiId, electorRulerId: state.regions[aiId].rulerId,
    type, createdYear: state.year, deadlineYear: state.year + (conditions.durationYears || cfg.defaultDurationYears),
    status: "PROMISED", conditions: Object.assign({}, conditions), memoryIds: [],
  };
  state.electionPromises.byId[id] = promise;
  const electorRuler = state.characters[promise.electorRulerId];
  const desc = describeElectionPromise(state, promise);
  const memory = recordWorldEvent(state, {
    type: "ELECTION_PROMISE_MADE", actorIds: [state.rulerId], targetIds: [promise.electorRulerId],
    emotionalWeight: 20, metadata: { promiseId: id, promiseType: type },
    description: desc,
  });
  promise.memoryIds.push(memory.id);
  if (electorRuler) refreshRelationship(state, promise.electorRulerId, state.rulerId);
  addChronicle(state, desc);
  return { ok: true, promiseId: id };
}

function describeElectionPromise(state, promise) {
  const electorRuler = state.characters[promise.electorRulerId];
  const electorName = electorRuler ? `${electorRuler.name} ${electorRuler.surname || ""}`.trim() : state.regions[promise.electorRegionId].name;
  const targetName = promise.conditions.targetRegionId ? state.regions[promise.conditions.targetRegionId].name : null;
  if (promise.type === "no_war_target") return `${electorName} erhielt das Versprechen, ${targetName} nicht anzugreifen.`;
  if (promise.type === "maintain_alliance") return `${electorName} erhielt das Versprechen, das Bündnis aufrechtzuerhalten.`;
  if (promise.type === "maintain_treaty") return `${electorName} erhielt das Versprechen, den Vertrag mit ${targetName} aufrechtzuerhalten.`;
  if (promise.type === "pay_tribute") return `${electorName} wurde eine Zahlung von ${promise.conditions.amount} Talern zugesagt.`;
  return `${electorName} erhielt ein politisches Versprechen.`;
}

function breakElectionPromise(state, promiseId, reasonNote) {
  const promise = state.electionPromises.byId[promiseId];
  if (!promise || promise.status !== "PROMISED") return;
  promise.status = "BROKEN";
  const cfg = CONFIG.election.promise;
  const dip = state.diplomacy[promise.electorRegionId];
  if (dip) dip.relation = clamp(dip.relation + cfg.brokenRelationPenalty, -100, 100);
  const memory = recordWorldEvent(state, {
    type: "ELECTION_PROMISE_BROKEN", actorIds: [state.rulerId], targetIds: [promise.electorRulerId],
    emotionalWeight: -45, metadata: { promiseId, promiseType: promise.type },
    description: `${describeElectionPromise(state, promise).replace("erhielt das Versprechen,", "wurde das Versprechen gebrochen,").replace("wurde eine Zahlung", "erhielt nicht die zugesagte Zahlung")} (${reasonNote || "gebrochen"})`,
  });
  promise.memoryIds.push(memory.id);
  if (state.characters[promise.electorRulerId]) refreshRelationship(state, promise.electorRulerId, state.rulerId);
  addChronicle(state, memory.description);
}

function fulfillElectionPromise(state, promiseId) {
  const promise = state.electionPromises.byId[promiseId];
  if (!promise || promise.status !== "PROMISED") return { ok: false, reason: "Kein offenes Versprechen mit dieser ID." };
  if (promise.type === "pay_tribute") {
    if (state.treasury < promise.conditions.amount) return { ok: false, reason: "Nicht genug Taler, um die Zusage einzulösen." };
    state.treasury -= promise.conditions.amount;
    logLedger(state, "Wahlversprechen eingelöst (Zahlung)", -promise.conditions.amount);
  }
  promise.status = "FULFILLED";
  const cfg = CONFIG.election.promise;
  const dip = state.diplomacy[promise.electorRegionId];
  if (dip) dip.relation = clamp(dip.relation + cfg.fulfilledRelationBonus, -100, 100);
  const memory = recordWorldEvent(state, {
    type: "ELECTION_PROMISE_FULFILLED", actorIds: [state.rulerId], targetIds: [promise.electorRulerId],
    emotionalWeight: 25, metadata: { promiseId, promiseType: promise.type },
    description: describeElectionPromise(state, promise).replace("erhielt das Versprechen,", "erhielt die Einlösung des Versprechens,").replace("wurde eine Zahlung", "erhielt die zugesagte Zahlung"),
  });
  promise.memoryIds.push(memory.id);
  if (state.characters[promise.electorRulerId]) refreshRelationship(state, promise.electorRulerId, state.rulerId);
  addChronicle(state, memory.description);
  return { ok: true };
}

// Jährliche Prüfung ALLER offenen Versprechen (§52/§128: kann Jahre nach
// der Wahl zurückkehren -- läuft daher unabhängig davon, ob gerade eine
// Kandidatur aktiv ist). Verletzung wird ereignisnah erkannt (Vertrags-
// abwesenheit), nicht erst rückwirkend zur Frist.
function updateElectionPromises(state) {
  if (!state.electionPromises) return;
  for (const id in state.electionPromises.byId) {
    const p = state.electionPromises.byId[id];
    if (p.status !== "PROMISED") continue;
    if (p.type === "maintain_alliance") {
      if (!state.diplomacy[p.electorRegionId] || !state.diplomacy[p.electorRegionId].treaties.allianz) {
        breakElectionPromise(state, id, "Bündnis nicht aufrechterhalten"); continue;
      }
    } else if (p.type === "maintain_treaty") {
      const dip = state.diplomacy[p.conditions.targetRegionId];
      if (!dip || !dip.treaties[p.conditions.treatyType]) { breakElectionPromise(state, id, "Vertrag nicht aufrechterhalten"); continue; }
    }
    // no_war_target wird ereignisnah in checkPromiseViolationOnWarDeclared()
    // erkannt (js/military.js declareWar()-Aufrufstelle), nicht hier gepollt.
    if (state.year >= p.deadlineYear) {
      if (p.type === "pay_tribute") { breakElectionPromise(state, id, "Frist verstrichen, Zahlung nie geleistet"); }
      else { fulfillElectionPromise(state, id); }
    }
  }
}

// Wird von declareWar() (js/military.js) aufgerufen, BEVOR der Krieg
// tatsächlich beginnt -- bricht jedes no_war_target-Versprechen, das genau
// dieses Ziel schützt. Ereignisnah statt gepollt, weil ein einzelner
// Kriegsbeginn sofort und eindeutig ist.
function checkPromiseViolationOnWarDeclared(state, targetAiId) {
  if (!state.electionPromises) return;
  for (const id in state.electionPromises.byId) {
    const p = state.electionPromises.byId[id];
    if (p.status === "PROMISED" && p.type === "no_war_target" && p.conditions.targetRegionId === targetAiId) {
      breakElectionPromise(state, id, "Krieg trotz gegebenem Wort erklärt");
    }
  }
}

// ---------- Elector-Score (§18/§19/§21-27) ----------
// candidateId: state.rulerId (Spieler) ODER ein rivalCandidateId (region.rulerId
// eines Rivalen). Vollständig deterministisch, jede Komponente einzeln
// gedeckelt (§19), Gesamtscore auf CONFIG.election.scoreWeights.totalCap geklammert.
function computeElectorScoreBreakdown(state, aiId, candidateId) {
  const w = CONFIG.election.scoreWeights;
  const isPlayer = candidateId === state.rulerId;
  const components = [];
  let total = 0;
  const add = (label, value) => { if (value) { components.push({ label, value: Math.round(value * 10) / 10 }); total += value; } };

  const dip = state.diplomacy[aiId];
  const electorRulerId = state.regions[aiId].rulerId;
  const electorRuler = state.characters[electorRulerId];

  // §22: diplomatische Beziehung -- nur für den Spieler auswertbar (keine
  // KI-KI-Beziehungen im bestehenden Modell, §3).
  if (isPlayer) add("Diplomatische Beziehung", dip.relation * w.relationFactor);

  // §21: persönliche Beziehung zwischen Kandidat und Kurfürst — funktioniert
  // für JEDEN Kandidaten (Spieler oder Rivale), solange beide echte
  // Character-Core-Charaktere sind.
  if (electorRuler && state.characters[candidateId]) {
    const rel = computeRelationshipBreakdown(state, electorRulerId, candidateId);
    add("Persönliche Beziehung", rel.total * w.personalRelationFactor);
  }

  if (isPlayer) {
    add(dip.treaties.allianz ? "Bündnis" : (dip.treaties.nichtangriff ? "Nichtangriffspakt" : ""), dip.treaties.allianz ? w.allianceBonus : (dip.treaties.nichtangriff ? w.nonAggressionBonus : 0));
    if (isWarCapableElector(state, aiId) && state.warState && state.warState[aiId]) add("Krieg mit dem Kandidaten", w.warPenalty);
  }

  // §23-25: World Memory als Source of Truth für Krieg/Frieden/Hilfe --
  // dieselbe computeEffectiveWeight()-Verfallsformel wie überall sonst,
  // inkl. Trait-Modulation des ELECTORS (rachsüchtig hält länger nach,
  // barmherzig/loyal verzeiht schneller) -- kein neuer Trait-Code nötig,
  // computeEffectiveWeight liest diese Schlüssel bereits generisch.
  let memorySum = 0;
  for (const m of allMemories(state)) {
    if (!m.regionIds.includes(aiId)) continue;
    if (!m.tags.includes("war") && m.type !== "AID_GRANTED" && m.type !== "AID_REFUSED") continue;
    if (isPlayer !== (m.actorIds.includes(state.rulerId) || m.targetIds.includes(state.rulerId))) continue;
    memorySum += computeEffectiveWeight(state, m, electorRulerId);
  }
  add("Krieg/Frieden/Hilfe (World Memory)", clamp(memorySum, -w.memoryFactorCap, w.memoryFactorCap));

  // §52/§54/§128: offene und gebrochene Wahlversprechen an GENAU diesen
  // Elector. Gebrochene Versprechen nutzen die ECHTE, bereits aufgezeichnete
  // ELECTION_PROMISE_BROKEN-Memory (computeEffectiveWeight() liefert damit
  // denselben abklingenden, traitmodulierten Wert wie jede andere Memory --
  // kein zweites Verfallsmodell).
  if (state.electionPromises) {
    let promiseSum = 0;
    for (const id in state.electionPromises.byId) {
      const p = state.electionPromises.byId[id];
      if (p.electorRulerId !== electorRulerId) continue;
      if (p.status === "PROMISED") { promiseSum += CONFIG.election.promise.activePromiseScoreBonus; continue; }
      if (p.status === "BROKEN") {
        const lastMemoryId = p.memoryIds[p.memoryIds.length - 1];
        const brokenMemory = lastMemoryId ? state.memories.byId[lastMemoryId] : null;
        if (brokenMemory && brokenMemory.type === "ELECTION_PROMISE_BROKEN") promiseSum += computeEffectiveWeight(state, brokenMemory, electorRulerId);
      }
    }
    add("Wahlversprechen", clamp(promiseSum, w.brokenPromiseFactorCap, 40));
  }

  // §20/§73-79: laufende Geschenke dieser Kandidatur (nur Spieler -- Rivalen
  // machen in diesem Umfang keine Geschenke, s. Moduldoc).
  if (isPlayer && state.imperialCandidacy) {
    const giftCount = state.imperialCandidacy.giftsGivenThisCandidacy[aiId] || 0;
    if (giftCount > 0) {
      const cfg = CONFIG.election;
      let giftSum = 0;
      for (let i = 0; i < giftCount; i++) giftSum += cfg.giftDuringCandidacyRelationGain * Math.pow(cfg.giftDiminishingReturnsFactor, i);
      add("Diplomatische Geschenke", clamp(giftSum * 0.4, 0, w.giftFactorCap)); // 0.4: die Geschenkwirkung fließt bereits über relationFactor mit ein, hier nur der zusätzliche, direkt erinnerte Anteil
    }
  }

  if (isPlayer) {
    add("Prestige", clamp(state.prestige * w.prestigeFactor, 0, w.prestigeFactorCap));
    add("Legitimität", clamp((state.legitimacy - 50) * w.legitimacyFactor, -w.legitimacyFactorCap, w.legitimacyFactorCap));
    add("Titel", clamp(state.titleIndex * w.titleFactor, 0, w.titleFactorCap));
    // §23-Analogon: gemeinsame Gegner -- nur beim Spieler auswertbar (echte
    // state.warState/Beziehungsdaten vorhanden, s. Moduldoc zu KI-KI-Beziehungen).
    const sharedEnemy = getElectorIds(state).some(otherId => otherId !== aiId && state.diplomacy[otherId].relation < -30 && isWarCapableElector(state, otherId) && state.warState[otherId] && dip.relation < -10);
    add("Gemeinsame Gegner", sharedEnemy ? w.sharedEnemyBonus : 0);
  } else {
    // §30/§34: Rivalen-"Ausstrahlung" aus denselben realen Kennzahlen wie
    // die Kandidatur-Eignung (Wohlstands-Proxy/Bevölkerung), auf eine mit
    // Spieler-Prestige/Legitimität/Titel vergleichbare Größenordnung skaliert.
    const region = state.regions[getRegionIdForRulerId(state, candidateId)];
    if (region) {
      const wealthProxy = computeRegionWealthProxy(region);
      add("Ansehen des Rivalen", clamp((wealthProxy / 40), 0, w.prestigeFactorCap + w.legitimacyFactorCap + w.titleFactorCap));
    }
  }

  // §139/§140: echte dynastische Verbindung -- prüft eine TATSÄCHLICHE
  // Character-Core-Familienbeziehung (Kind/Ehepartner/Geschwister/gleiches
  // Haus) zwischen Kandidat und Elector-Herrscher. Im bestehenden Modell so
  // gut wie nie wahr (Auslandsherrscher haben laut Phase 8E bewusst KEINE
  // Familie, s. js/core.js) -- trägt deshalb i.d.R. 0 bei, wird aber ehrlich
  // (nicht erfunden) berechnet, falls sich das künftig ändert.
  if (electorRuler && state.characters[candidateId]) {
    const isFamily = electorRuler.parentId === candidateId || electorRuler.spouseId === candidateId ||
      (electorRuler.parentId && electorRuler.parentId === state.characters[candidateId].parentId);
    add("Dynastische Verbindung", isFamily ? w.dynasticBonus : 0);
  }

  return { components, total: clamp(Math.round(total), -w.totalCap, w.totalCap) };
}

function getRegionIdForRulerId(state, rulerId) {
  for (const aiId of getElectorIds(state)) if (state.regions[aiId].rulerId === rulerId) return aiId;
  return null;
}

// ---------- Stance (§15/§16) ----------
function computeElectorStance(state, aiId, candidateId) {
  const score = computeElectorScoreBreakdown(state, aiId, candidateId).total;
  const t = CONFIG.election.stanceThresholds;
  if (score >= t.sicherFuer) return "SICHER_FUER";
  if (score >= t.geneigt) return "GENEIGT";
  if (score > t.geneigtGegen) return "UNENTSCHLOSSEN";
  if (score > t.sicherGegen) return "GENEIGT_GEGEN";
  return "SICHER_GEGEN";
}

// ---------- Kandidaten-Liste & Wahlablauf (§35-43, §93-98) ----------
function getActiveCandidates(state) {
  const out = [{ id: state.rulerId, isPlayer: true }];
  if (state.imperialCandidacy) {
    for (const rid of state.imperialCandidacy.rivalCandidateIds) {
      if (state.characters[rid] && state.characters[rid].alive) out.push({ id: rid, isPlayer: false });
    }
  }
  return out;
}

// Ersetzt das alte checkElectionTrigger(): löst NICHT mehr automatisch aus,
// sobald Voraussetzungen erfüllt sind (§42), sondern erst NACH einer per
// declareImperialCandidacy() erklärten Kandidatur, frühestens nach
// candidacyPrepYearsMin, spätestens erzwungen nach candidacyPrepYearsMax.
function checkImperialElectionTiming(state) {
  if (state.pendingElection) return;
  if (!state.imperialCandidacy) return; // §42: keine Wahl ohne erklärte Kandidatur
  if (state.electionCooldown > 0) { state.electionCooldown--; return; }
  const cfg = CONFIG.election;
  const yearsSinceDeclared = state.year - state.imperialCandidacy.declaredYear;
  if (yearsSinceDeclared < cfg.candidacyPrepYearsMin) return;
  const forced = yearsSinceDeclared >= cfg.candidacyPrepYearsMax;
  if (forced || rnd() < cfg.triggerChancePerYear) {
    state.pendingElection = true;
    addChronicle(state, "Die Kurfürsten versammeln sich: Die Kaiserwahl steht bevor!");
  }
}

// §93-98: deterministisch bei gleichem Zustand -- der einzige rnd()-Verbrauch
// bleibt der bereits bestehende, dokumentierte Zufallswurf in
// checkImperialElectionTiming() (OB die Wahl dieses Jahr stattfindet), nicht
// WER sie gewinnt. explainImperialElectionResult() (Debug) liefert exakt
// dieselben Scores, die hier tatsächlich über Sieg/Niederlage entscheiden.
function resolveImperialElection(state) {
  if (!state.pendingElection) return { ok: false, reason: "Keine Wahl anhängig." };
  const candidates = getActiveCandidates(state);
  const electorIds = getElectorIds(state);
  const voteCounts = {}; candidates.forEach(c => voteCounts[c.id] = 0);
  const perElectorResult = [];
  for (const aiId of electorIds) {
    let bestId = candidates[0].id, bestScore = -Infinity;
    const scores = {};
    for (const c of candidates) {
      const s = computeElectorScoreBreakdown(state, aiId, c.id).total;
      scores[c.id] = s;
      if (s > bestScore || (s === bestScore && c.id === state.rulerId)) { bestScore = s; bestId = c.id; }
    }
    voteCounts[bestId]++;
    perElectorResult.push({ aiId, votedFor: bestId, scores });
    // §98/§166: nicht unterstützte Beziehung leidet (Spieler-Bezug wie bisher).
    if (bestId !== state.rulerId) state.diplomacy[aiId].relation = clamp(state.diplomacy[aiId].relation + CONFIG.election.lossRelationPenalty, -100, 100);
    else recordWorldEvent(state, {
      type: "ELECTION_SUPPORT_GIVEN", actorIds: [state.rulerId], targetIds: [state.regions[aiId].rulerId], regionIds: [aiId],
      emotionalWeight: 20, metadata: {},
      description: `${state.regions[aiId].name} unterstützte dich bei der Kaiserwahl.`,
    });
  }
  const playerVotes = voteCounts[state.rulerId] || 0;
  const won = playerVotes >= CONFIG.election.votesNeededForMajority;
  const winnerId = Object.keys(voteCounts).reduce((best, id) => voteCounts[id] > voteCounts[best] ? id : best, state.rulerId);

  state.pendingElection = null;
  const detailText = perElectorResult.map(r => `${state.regions[r.aiId].name}: ${r.votedFor === state.rulerId ? "für dich" : "dagegen"}`).join(", ");
  addChronicle(state, `Kaiserwahl: ${playerVotes} von ${electorIds.length} Stimmen für dich (${detailText}).`);

  if (won) {
    state.titleIndex = TITLES.findIndex(t => t.id === "kaiser");
    state.gameOver = "victory";
    addChronicle(state, "Die Kurfürsten haben entschieden: Du wurdest zum Kaiser gewählt!");
    recordWorldEvent(state, {
      type: "TITLE_GAINED", actorIds: [state.rulerId], targetIds: [],
      importance: 100, emotionalWeight: 50, metadata: { titleId: "kaiser" },
      description: `${state.characters[state.rulerId].name} wurde von den Kurfürsten zum Kaiser gewählt.`,
    });
  } else {
    state.electionCooldown = CONFIG.election.cooldownYearsAfterLoss;
    state.prestige = Math.max(0, state.prestige - CONFIG.election.lossPrestigePenalty);
    const winnerRegionId = getRegionIdForRulerId(state, winnerId);
    const winnerName = winnerId === state.rulerId ? null : (state.characters[winnerId] ? `${state.characters[winnerId].name} ${state.characters[winnerId].surname || ""}`.trim() : null);
    addChronicle(state, winnerName ? `Die Wahl ist verloren. ${winnerName} besteigt den Kaiserthron.` : "Die Wahl ist verloren.");
    recordWorldEvent(state, {
      type: "IMPERIAL_ELECTION_LOST", actorIds: [state.rulerId], targetIds: winnerId !== state.rulerId ? [winnerId] : [],
      emotionalWeight: -40, metadata: { playerVotes, totalVotes: electorIds.length, winnerRegionId },
      description: winnerName ? `${state.characters[state.rulerId].name} unterlag ${winnerName} bei der Kaiserwahl.` : `${state.characters[state.rulerId].name} verlor die Kaiserwahl.`,
    });
  }
  state.imperialCandidacy = null; // die Kandidatur selbst endet; state.electionPromises bleibt bestehen (§50/§128)
  return { ok: true, won, playerVotes, totalVotes: electorIds.length, perElectorResult };
}

// ---------- Debug/Erklärung (§17/§181/§228-230) ----------
function explainImperialCandidacyEligibility(state) { return checkImperialCandidacyEligibility(state); }
function explainElectorScore(state, aiId, candidateId) { return computeElectorScoreBreakdown(state, aiId, candidateId); }
function explainImperialElection(state) {
  const candidates = getActiveCandidates(state);
  const electorIds = getElectorIds(state);
  return electorIds.map(aiId => ({
    aiId, regionName: state.regions[aiId].name,
    rulerId: state.regions[aiId].rulerId,
    stance: computeElectorStance(state, aiId, state.rulerId),
    scores: candidates.map(c => ({ candidateId: c.id, isPlayer: c.isPlayer, breakdown: computeElectorScoreBreakdown(state, aiId, c.id) })),
  }));
}
