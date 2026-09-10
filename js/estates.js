// ============================================================
// ESTATES — Phase 11 "Living Realm": macht die Zufriedenheit von
// Bevölkerungsgruppen politisch LESBAR, statt nur eine Zahl zu bleiben.
// Vier Stände (Adel, Geistlichkeit, Bürgertum, Bauernschaft), jeweils eine
// zusammenfassende Sicht auf bereits bestehende POP_GROUPS (siehe
// ESTATE_DEFINITIONS, data/gamedata.js) — KEINE zweite Bevölkerungsquelle,
// KEIN zweites Zufriedenheitssystem (§6).
//
// Architekturregeln dieses Moduls:
//  - Einfluss/Zufriedenheit/Interessen werden bei Bedarf berechnet
//    (computeEstate*()), nicht laufend im State fortgeschrieben — exakt das
//    bereits etablierte Muster aus computeDramaTensionBreakdown()
//    (js/drama-director.js) und computeThreadImportanceBreakdown()
//    (js/story-threads.js): jede Komponente einzeln benannt und additiv,
//    keine Blackbox, siehe explainEstateInfluence().
//  - state.estates speichert NUR, was wirklich über Jahre stabil bleiben
//    muss: den amtierenden Wortführer (leaderId) und den Cooldown seit der
//    letzten Forderung (lastDemandYear) — beides ließe sich sonst nicht
//    widerspruchsfrei "on demand" ableiten (ein Wortführer soll nicht jedes
//    Jahr neu gewürfelt werden, ein Cooldown braucht einen Ankerpunkt).
//  - Wortführer werden AUSSCHLIESSLICH aus bereits vorhandenen
//    state.characters gewählt (§31: "Score aus Status/Traits/Beziehung/
//    Rolle/Claim/Skill/Standbezug, kein RNG nötig") — kein createCharacter()-
//    Aufruf in dieser Datei. Findet sich kein passender Kandidat (das ist
//    für die Bauernschaft der historische Normalfall — keine formale
//    Vertretung am Hof), bleibt leaderId schlicht null statt eine
//    erfundene Figur einzusetzen.
//  - Die eigentlichen "Forderungen" sind bewusst KEIN zweites Eventsystem:
//    sie werden als reguläre CHAIN_TEMPLATES-Einträge in js/event-chains.js
//    umgesetzt (queueChainDecision(), dasselbe pendingEvent-Fenster) — diese
//    Datei liefert nur die Berechnungsgrundlage, die deren
//    checkEligibility() abfragt (siehe checkEstateDemandEligibility()).
// ============================================================

// ---------- Zufriedenheit/Bevölkerungs-/Wohlstandsanteil (§6) ----------

function computeEstateSatisfaction(state, estateId) {
  const def = ESTATE_DEFINITIONS[estateId];
  const r = state.regions.player;
  let sumWeighted = 0, sumCount = 0;
  for (const pid of def.popGroups) {
    const grp = r.population[pid];
    if (!grp) continue;
    sumWeighted += grp.satisfaction * grp.count;
    sumCount += grp.count;
  }
  return sumCount > 0 ? Math.round((sumWeighted / sumCount) * 10) / 10 : 50;
}

function computeEstatePopulationShare(state, estateId) {
  const def = ESTATE_DEFINITIONS[estateId];
  const r = state.regions.player;
  let estateCount = 0, totalCount = 0;
  for (const pid in r.population) {
    totalCount += r.population[pid].count;
    if (def.popGroups.includes(pid)) estateCount += r.population[pid].count;
  }
  return totalCount > 0 ? estateCount / totalCount : 0;
}

// Dieselbe POP_GROUPS[pid].weight-gewichtete Wirtschaftskraft, die
// applyMonthlyFinances() (js/advance-year.js) bereits für die Steuerlast je
// Gruppe verwendet (taxByGroup) — hier nur als Anteil statt als Taler-Summe,
// keine zweite Wohlstandsformel.
function computeEstateWealthShare(state, estateId) {
  const def = ESTATE_DEFINITIONS[estateId];
  const r = state.regions.player;
  let estateWealth = 0, totalWealth = 0;
  for (const pid in r.population) {
    const w = r.population[pid].count * (POP_GROUPS[pid].weight || 1);
    totalWealth += w;
    if (def.popGroups.includes(pid)) estateWealth += w;
  }
  return totalWealth > 0 ? estateWealth / totalWealth : 0;
}

// ---------- Aktivität (§Anbindung an bestehende Eventketten) ----------
// Die sechs Stände-Eventketten (js/event-chains.js) werden erst in einem
// Folgeschritt ergänzt — dieses Array wird dann dort exakt genauso befüllt
// registriert; hier bereits vorbereitet, damit computeEstateInfluenceBreakdown()
// unten schon vollständig ist. Solange keine passende Kette existiert, liefert
// getActiveEstateChain() defensiv einfach null (kein Fehler, kein Sonderfall
// nötig).
const ESTATE_CHAIN_TEMPLATE_IDS = [
  "adel_hofamt", "adel_krieg", "staedte_handel",
  "bauern_nahrung", "kirche_herrscher", "staende_gegeneinander",
];

function getActiveEstateChain(state, estateId) {
  for (const id in state.eventChains.active) {
    const chain = state.eventChains.active[id];
    if (!ESTATE_CHAIN_TEMPLATE_IDS.includes(chain.templateId)) continue;
    if (!estateId) return chain;
    const chainEstateIds = chain.variables && chain.variables.estateIds ? chain.variables.estateIds : (chain.variables && chain.variables.estateId ? [chain.variables.estateId] : []);
    if (chainEstateIds.includes(estateId)) return chain;
  }
  return null;
}

// ---------- Einfluss (§6/§31: vollständig aufgeschlüsselt, keine Blackbox) ----------

function computeEstateInfluenceBreakdown(state, estateId) {
  const cfg = CONFIG.estates.influenceWeights;
  const components = [{ label: "Basis", value: cfg.base[estateId] || 0 }];
  let total = cfg.base[estateId] || 0;
  const add = (label, value) => { if (value) { components.push({ label, value: Math.round(value * 10) / 10 }); total += value; } };

  const popShare = computeEstatePopulationShare(state, estateId);
  add(`Bevölkerungsanteil (${Math.round(popShare * 100)}%)`, popShare * cfg.populationShareFactor);

  const wealthShare = computeEstateWealthShare(state, estateId);
  add(`Wohlstandsanteil (${Math.round(wealthShare * 100)}%)`, wealthShare * cfg.wealthShareFactor);

  const leaderId = state.estates[estateId].leaderId;
  if (leaderId && state.characters[leaderId] && state.characters[leaderId].alive) {
    const leader = state.characters[leaderId];
    const statVal = leader.stats[ESTATE_LEADER_SKILL[estateId]] || 10;
    add("Wortführer-Einfluss", (statVal / 17) * cfg.leaderBonusMax);
  }

  // Adel: reale, bereits bestehende Abhängigkeit — Ritter/schwere Kavallerie
  // erfordern minAdelSatisfaction (TROOP_TYPES, data/gamedata.js). Wer davon
  // Gebrauch macht, ist politisch auf den Adel angewiesen.
  if (estateId === "adel") {
    const dependentTroops = (state.army.ritter || 0) + (state.army.schwere_kavallerie || 0);
    add("Militärische Abhängigkeit vom Lehnsadel", dependentTroops > 0 ? cfg.militaryDependencyBonus : 0);
  }
  // Geistlichkeit: koppelt an den bereits bestehenden, einzigen
  // Religionsregler state.religiousInfluence (js/politics.js,
  // updateReligion()) statt einen zweiten Kirchen-Einfluss-Wert zu führen.
  if (estateId === "geistlichkeit") {
    const infl = state.religiousInfluence !== undefined ? state.religiousInfluence : 55;
    add("Kirchlicher Einfluss im Reich", (infl / 100) * cfg.religiousInfluenceFactor);
  }

  const activeChain = getActiveEstateChain(state, estateId);
  add("Jüngste politische Aktivität", activeChain ? cfg.recentActivityBonus : 0);

  return { components, total: clamp(Math.round(total), 0, 100) };
}

function computeEstateInfluence(state, estateId) {
  return computeEstateInfluenceBreakdown(state, estateId).total;
}

function explainEstateInfluence(state, estateId) {
  return computeEstateInfluenceBreakdown(state, estateId);
}

// ---------- Wortführer (§31: Status/Traits/Beziehung/Rolle/Claim/Skill/
// Standbezug — deterministisch aus dem Character Core, kein RNG) ----------

// Welcher Skill (state.characters[*].stats) für die Standesrolle am
// plausibelsten ist — reine Zuordnung, kein neuer Statwert.
const ESTATE_LEADER_SKILL = { adel: "militaer", geistlichkeit: "charisma", buergertum: "handel", bauernschaft: "verwaltung" };
// Für Geistlichkeit/Bürgertum gibt es bereits ein echtes, passendes Hofamt
// (ADVISOR_ROLES) — dessen Inhaber ist der naheliegendste Wortführer, statt
// eine zweite, konkurrierende Rollenzuweisung zu erfinden.
const ESTATE_LEADER_ADVISOR_ROLE = { geistlichkeit: "geistlicher", buergertum: "handelsberater" };

// Standbezug (§31): wer zählt überhaupt als plausibler Kandidat für diesen
// Stand? Bewusst KEIN offener Pool aller Charaktere — ein Wortführer braucht
// einen nachvollziehbaren Bezug zum jeweiligen Stand.
function candidateEstateLeaders(state, estateId) {
  const out = [];
  const advisorRole = ESTATE_LEADER_ADVISOR_ROLE[estateId];
  if (advisorRole) {
    const advId = state.advisors[advisorRole];
    if (advId && state.characters[advId] && state.characters[advId].alive) out.push(advId);
    return out; // Geistlichkeit/Bürgertum: ausschließlich das passende Hofamt, kein zweiter Kandidatenpool
  }
  if (estateId === "adel") {
    const ruler = state.characters[state.rulerId];
    if (!ruler) return out;
    for (const id in state.characters) {
      if (id === state.rulerId) continue;
      const c = state.characters[id];
      if (!c.alive) continue;
      const isFamily = c.parentId === state.rulerId || c.spouseId === state.rulerId ||
        (ruler.parentId && c.parentId === ruler.parentId); // Kind, Ehepartner oder Geschwister des Herrschers
      const isMarriedInNoble = ruler.childrenIds.some(cid => state.characters[cid] && state.characters[cid].spouseId === id);
      const hasClaim = c.claims.some(cl => cl.titleId === "player" && cl.strength !== "none");
      if (isFamily || isMarriedInNoble || hasClaim) out.push(id);
    }
    return out;
  }
  // Bauernschaft: bewusst kein Kandidatenpool — es gibt im Spiel keine
  // simulierte Figur mit plausiblem Standbezug zu den Bauern (keine erfundene
  // NPC-Rolle, §Auftrag). leaderId bleibt in diesem historisch korrekten
  // Regelfall null (siehe selectEstateLeader()).
  return out;
}

function scoreEstateLeaderCandidate(state, estateId, candidateId) {
  const c = state.characters[candidateId];
  let score = c.stats[ESTATE_LEADER_SKILL[estateId]] || 10; // Skill, 3-17
  score += traitEffectSum(c, "relationshipMod") * 2;         // Charisma-artige Traits (Status/Ausstrahlung)
  const rel = computeRelationshipBreakdown(state, candidateId, state.rulerId).total;
  score += rel * 0.2;                                         // Beziehung zum Herrscher
  const claim = c.claims.find(cl => cl.titleId === "player");
  if (claim) score += { weak: 2, strong: 6, primary: 10 }[claim.strength] || 0; // Claim
  if (c.advisorRole === ESTATE_LEADER_ADVISOR_ROLE[estateId]) score += 15;      // Rolle (bereits bekleidetes passendes Hofamt)
  return Math.round(score * 10) / 10;
}

// Stabil (§: kein jährliches Neuwürfeln ohne Grund) — ein bestehender,
// noch lebender Wortführer bleibt im Amt, auch wenn inzwischen ein
// theoretisch besser bewerteter Kandidat existiert. Nur wenn er stirbt,
// stirbt der Kandidatenpool selbst weg (z.B. Amtsverlust bei Geistlichkeit/
// Bürgertum), wird neu gewählt.
function selectEstateLeader(state, estateId) {
  const est = state.estates[estateId];
  if (est.leaderId && state.characters[est.leaderId] && state.characters[est.leaderId].alive) {
    // Für Geistlichkeit/Bürgertum ist der Wortführer an das Hofamt gebunden —
    // hat der Charakter das Amt verloren, ist er kein plausibler Wortführer mehr.
    const advisorRole = ESTATE_LEADER_ADVISOR_ROLE[estateId];
    if (!advisorRole || state.characters[est.leaderId].advisorRole === advisorRole) return est.leaderId;
  }
  const candidates = candidateEstateLeaders(state, estateId);
  if (!candidates.length) { est.leaderId = null; return null; }
  candidates.sort((a, b) => scoreEstateLeaderCandidate(state, estateId, b) - scoreEstateLeaderCandidate(state, estateId, a) || a.localeCompare(b)); // stabiler Tie-Break, kein RNG
  est.leaderId = candidates[0];
  return est.leaderId;
}

// ---------- Interessen (§: aus echtem Weltzustand entdeckt, kein RNG,
// dasselbe Muster wie die detect*Signals()-Funktionen in
// js/story-threads.js) ----------

function discoverEstateInterests(state, estateId) {
  const r = state.regions.player;
  const out = [];
  if (estateId === "adel") {
    if (r.taxRate > 0.25) out.push({ topic: "steuerlast", strength: clamp(Math.round((r.taxRate - 0.25) * 400), 0, 100) });
    if (!state.estates.adel.leaderId) out.push({ topic: "hofamt", strength: 40 });
    const atWar = !!(state.warState && Object.values(state.warState).some(Boolean));
    const cavalryInService = (state.army.ritter || 0) + (state.army.schwere_kavallerie || 0);
    if (atWar && cavalryInService === 0) out.push({ topic: "kriegsbeteiligung", strength: 50 });
  } else if (estateId === "geistlichkeit") {
    const infl = state.religiousInfluence !== undefined ? state.religiousInfluence : 55;
    const gap = CONFIG.religion.lowInfluenceThreshold + 15 - infl;
    if (gap > 0) out.push({ topic: "kirchlicher_einfluss", strength: clamp(Math.round(gap * 2), 0, 100) });
  } else if (estateId === "buergertum") {
    if (r.taxRate > 0.28) out.push({ topic: "zoelle", strength: clamp(Math.round((r.taxRate - 0.28) * 500), 0, 100) });
    if (!state.advisors.handelsberater) out.push({ topic: "wirtschaftlicher_einfluss", strength: 30 });
  } else if (estateId === "bauernschaft") {
    const grainRatio = r.grainRatio !== undefined ? r.grainRatio : 1;
    if (grainRatio < 0.8) out.push({ topic: "nahrungssicherheit", strength: clamp(Math.round((0.8 - grainRatio) * 150), 0, 100) });
    if (r.population.arme.satisfaction < 40) out.push({ topic: "steuererleichterung", strength: clamp(Math.round((40 - r.population.arme.satisfaction) * 2), 0, 100) });
  }
  return out;
}

// ---------- Forderungsfähigkeit (§: Grundlage für die künftigen
// Stände-Eventketten in js/event-chains.js — max. 1 aktive Forderung
// systemweit, siehe getActiveEstateChain()) ----------

function checkEstateDemandEligibility(state, estateId) {
  const cfg = CONFIG.estates.demand;
  const est = state.estates[estateId];
  const checks = [];

  const onCooldown = (est.lastDemandYear || 0) + cfg.cooldownYears > state.year;
  checks.push({ label: `Kein Cooldown (letzte Forderung: ${est.lastDemandYear || "nie"})`, passed: !onCooldown });

  const influence = computeEstateInfluence(state, estateId);
  checks.push({ label: `Einfluss ${influence}: erfüllt (>= ${cfg.minInfluenceToDemand})`, passed: influence >= cfg.minInfluenceToDemand });

  const satisfaction = computeEstateSatisfaction(state, estateId);
  checks.push({ label: `Zufriedenheit ${satisfaction}: erfüllt (<= ${cfg.maxSatisfactionToDemand})`, passed: satisfaction <= cfg.maxSatisfactionToDemand });

  const anyEstateChainActive = ESTATE_IDS.some(id => getActiveEstateChain(state, id));
  checks.push({ label: "Keine andere Stände-Forderung derzeit aktiv (max. 1 systemweit)", passed: !anyEstateChainActive });

  return { checks, eligible: checks.every(c => c.passed) };
}

function explainEstateDemandEligibility(state, estateId) {
  return checkEstateDemandEligibility(state, estateId);
}

// Wird von den Stände-Eventketten aufgerufen, sobald eine Forderung
// tatsächlich gestellt wird (queueChainDecision()-Aufruf) — reine
// Buchführung für den Cooldown oben, keine eigene Logik.
function markEstateDemandRaised(state, estateId) {
  state.estates[estateId].lastDemandYear = state.year;
}

// ---------- Init/Jahresschritt ----------

function initEstates(state) {
  state.estates = {};
  for (const id of ESTATE_IDS) state.estates[id] = { id, leaderId: null, lastDemandYear: 0, privileges: [] };
  for (const id of ESTATE_IDS) selectEstateLeader(state, id);
}

// §Character-Core-Punkt 89-Analogon: EIN Aufruf statt advanceYear() wieder
// aufzublasen — läuft nach updateCharacterCore() (js/advance-year.js,
// applyRulerAndDynastyEffects()), damit ein in diesem Jahr verlorenes
// Hofamt/eine verstorbene Person bereits berücksichtigt ist.
function updateEstates(state) {
  for (const id of ESTATE_IDS) selectEstateLeader(state, id);
}

// ---------- Debug-/UI-Zusammenfassung (§ESTATES DEBUG-Panel, künftige
// LANDSTÄNDE-UI) ----------

function getEstateSummary(state, estateId) {
  const est = state.estates[estateId];
  const influenceBreakdown = computeEstateInfluenceBreakdown(state, estateId);
  return {
    id: estateId,
    name: ESTATE_DEFINITIONS[estateId].name,
    leaderId: est.leaderId,
    satisfaction: computeEstateSatisfaction(state, estateId),
    populationShare: computeEstatePopulationShare(state, estateId),
    wealthShare: computeEstateWealthShare(state, estateId),
    influence: influenceBreakdown.total,
    influenceBreakdown: influenceBreakdown.components,
    interests: discoverEstateInterests(state, estateId),
    privileges: est.privileges.slice(),
    lastDemandYear: est.lastDemandYear,
    demandEligibility: checkEstateDemandEligibility(state, estateId),
    activeChainId: (getActiveEstateChain(state, estateId) || {}).id || null,
  };
}

function getAllEstatesSummary(state) {
  const out = {};
  for (const id of ESTATE_IDS) out[id] = getEstateSummary(state, id);
  return out;
}
