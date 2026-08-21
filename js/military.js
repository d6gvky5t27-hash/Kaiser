// ============================================================
// MILITARY — Berater, Truppen, Armeestärke, Unterhalt, KI-Stärke-
// Schätzung; declareWar() eröffnet seit der Kriegskarte (js/war-map.js) eine
// andauernde Kampagne statt einer Sofortschlacht. Die alte, regionsweite
// Belagerungsauflösung (resolveSiegeStorm/resolveSiegeStarve/
// resolveSiegeBribe sowie ihr Duplikat in js/battle-bridge.js) wurde in
// Phase 2 (Technical Stabilization) entfernt — seit der Kriegskarte
// (§38) übernehmen die "Burg"-Geländeboni der Kampf-Engine dieselbe
// Rolle pro Gebiet (§33/§34). Beide Implementierungen waren nachweislich
// unerreichbar: `startSiege()` (die einzige Stelle, die `state.pendingSiege`
// je setzte) wurde von keiner Stelle im Projekt aufgerufen (siehe
// CODE_AUDIT.md Abschnitt 12/13.8). `state.pendingSiege`-Prüfungen, die
// als reine (stets falsche) Schutzbedingungen in noch aktivem Code stehen
// (z. B. in checkAiWarInitiative()), bleiben bewusst unverändert stehen —
// sie sind harmlos und ihre Entfernung war nicht Teil dieses Schritts.
// ============================================================

// §Character-Core-Punkt 25/26: ein einzelner Kandidat pro Vakanz wurde
// durch eine echte Auswahl von 2-4 unterschiedlichen Personen ersetzt.
// generateAdvisorCandidate() (ein Kandidat) bleibt als Baustein erhalten.
function generateAdvisorCandidate(role) {
  const gender = rnd() < 0.5 ? "m" : "f";
  const age = 28 + Math.floor(rnd() * 30);
  const c = createCharacter(gender, age, randomNobleHouse());
  c.advisorRole = role;
  // Gehaltsforderung streut moderat um den bereits kalibrierten baseCost
  // (§Punkt 25) — im Mittel über viele Kandidaten identisch zum bisherigen
  // Fixpreis, keine stille Gesamtkostenverschiebung.
  c.salaryDemand = Math.round(ADVISOR_ROLES[role].baseCost * (0.85 + rnd() * 0.3));
  return c;
}

// Mischt gelegentlich einen lebenden, erwachsenen, amtslosen Geschwisterteil
// des Herrschers in den Kandidatenpool (§Punkt 1, das Wilhelm-Beispiel) —
// wird er nicht gewählt, entsteht daraus eine echte, nachvollziehbare
// "Amt verweigert"-Beziehungsspannung (siehe confirmAdvisorSelection unten).
function generateAdvisorCandidates(state, role) {
  const count = 2 + Math.floor(rnd() * 3); // 2-4
  const candidates = [];
  const ruler = state.characters[state.rulerId];
  if (ruler && ruler.parentId && rnd() < 0.4) {
    for (const id in state.characters) {
      const c = state.characters[id];
      if (c.alive && c.parentId === ruler.parentId && c !== ruler && c.age >= 18 && !c.advisorRole) {
        candidates.push({ existingId: id });
        break;
      }
    }
  }
  while (candidates.length < count) candidates.push({ generated: generateAdvisorCandidate(role) });
  return candidates;
}

// Kosten, um ein Amt von currentLevel auf currentLevel+1 zu bringen (0 = Berufung
// auf Stufe 1). Gleiches Muster wie bei Gebäude-Ausbaustufen (upgradeCost() in core.js).
function advisorUpgradeCost(role, currentLevel) {
  return Math.round(ADVISOR_ROLES[role].baseCost * Math.pow(CONFIG.advisors.upgradeCostMultiplier, currentLevel));
}

// Öffnet die Kandidatenauswahl für ein vakantes Amt (Kosten werden erst bei
// confirmAdvisorSelection() tatsächlich abgebucht).
function openAdvisorSelection(state, role) {
  if (state.advisors[role]) return { ok: false, reason: "Dieses Amt ist bereits besetzt." };
  const cost = advisorUpgradeCost(role, 0);
  if (state.treasury < cost) return { ok: false, reason: "Nicht genug Taler, um jemanden zu berufen." };
  state.pendingAdvisorSelection = { role, cost, candidates: generateAdvisorCandidates(state, role) };
  return { ok: true };
}

function confirmAdvisorSelection(state, candidateIndex) {
  const sel = state.pendingAdvisorSelection;
  if (!sel) return { ok: false, reason: "Keine Kandidatenauswahl offen." };
  const chosen = sel.candidates[candidateIndex];
  if (!chosen) return { ok: false, reason: "Ungültige Auswahl." };
  if (state.treasury < sel.cost) return { ok: false, reason: "Nicht genug Taler, um jemanden zu berufen." };

  let cid, character;
  if (chosen.existingId) {
    cid = chosen.existingId;
    character = state.characters[cid];
  } else {
    character = chosen.generated;
    cid = nextCharId();
    state.characters[cid] = character;
  }
  character.advisorRole = sel.role;
  character.appointedYear = state.year; // §Phase-5-Punkt 15: Amtsdauer-Grundlage für die Korruptions-Kette
  state.advisors[sel.role] = cid;
  state.advisorLevels[sel.role] = 1;
  state.treasury -= sel.cost;
  logLedger(state, `Berater berufen: ${ADVISOR_ROLES[sel.role].name}`, -sel.cost);
  addChronicle(state, `${character.name} ${character.surname || ""} wurde zum ${ADVISOR_ROLES[sel.role].name} ernannt.`.replace(/\s+/g, " "));
  recordWorldEvent(state, {
    type: "APPOINTED_TO_OFFICE", actorIds: [state.rulerId], targetIds: [cid],
    emotionalWeight: 25, metadata: { role: sel.role },
    description: `${character.name} ${character.surname || ""} wurde zum ${ADVISOR_ROLES[sel.role].name} ernannt.`.replace(/\s+/g, " "),
  });

  for (const other of sel.candidates) {
    if (other === chosen || !other.existingId) continue;
    const rejected = state.characters[other.existingId];
    const memory = recordWorldEvent(state, {
      type: "DENIED_OFFICE", actorIds: [state.rulerId], targetIds: [other.existingId],
      emotionalWeight: -35, metadata: { role: sel.role },
      description: `${rejected.name} ${rejected.surname || ""} wurde bei der Vergabe des Amtes ${ADVISOR_ROLES[sel.role].name} übergangen.`.replace(/\s+/g, " "),
    });
    refreshRelationship(state, other.existingId, state.rulerId);
    addChronicle(state, memory.description);
  }
  state.pendingAdvisorSelection = null;
  return { ok: true };
}

function upgradeAdvisor(state, role) {
  if (!state.advisors[role]) return { ok: false, reason: "Dieses Amt ist nicht besetzt." };
  const currentLevel = state.advisorLevels[role] || 1;
  if (currentLevel >= CONFIG.advisors.maxLevel) return { ok: false, reason: "Höchste Stufe bereits erreicht." };
  const cost = advisorUpgradeCost(role, currentLevel);
  if (state.treasury < cost) return { ok: false, reason: "Nicht genug Taler für den Ausbau." };
  state.treasury -= cost;
  state.advisorLevels[role] = currentLevel + 1;
  logLedger(state, `Berater ausgebaut: ${ADVISOR_ROLES[role].name} (Stufe ${currentLevel + 1})`, -cost);
  const c = state.characters[state.advisors[role]];
  addChronicle(state, `${c ? c.name : "Der Amtsinhaber"} wurde als ${ADVISOR_ROLES[role].name} auf Stufe ${currentLevel + 1} befördert.`);
  return { ok: true };
}

function dismissAdvisor(state, role) {
  if (!state.advisors[role]) return { ok: false, reason: "Dieses Amt ist nicht besetzt." };
  const advId = state.advisors[role];
  const c = state.characters[advId];
  addChronicle(state, `${c ? c.name : "Der Amtsinhaber"} wurde als ${ADVISOR_ROLES[role].name} entlassen.`);
  if (c) {
    c.advisorRole = null;
    recordWorldEvent(state, {
      type: "DISMISSED_FROM_OFFICE", actorIds: [state.rulerId], targetIds: [advId],
      emotionalWeight: -30, metadata: { role },
      description: `${c.name} ${c.surname || ""} wurde als ${ADVISOR_ROLES[role].name} entlassen.`.replace(/\s+/g, " "),
    });
    refreshRelationship(state, advId, state.rulerId);
  }
  state.advisors[role] = null;
  state.advisorLevels[role] = 0;
  return { ok: true };
}

// §Character-Core-Punkt 30: Berater altern (bereits über die gemeinsame
// Alterungsschleife in updateDynasty()) und sterben jetzt auch — dieselbe
// Sterbewahrscheinlichkeits-Formel wie beim Herrscher (rollDeathChance() in
// js/population-dynasty.js), keine zweite Alterungslogik. Tod macht das
// Amt frei (§Punkt 41).
function checkAdvisorDeaths(state) {
  for (const role in state.advisors) {
    const advId = state.advisors[role];
    if (!advId) continue;
    const adv = state.characters[advId];
    if (!adv || !adv.alive) continue;
    if (rnd() < rollDeathChance(adv)) {
      adv.alive = false;
      adv.advisorRole = null;
      const desc = `${adv.name} ${adv.surname || ""}, ${ADVISOR_ROLES[role].name}, ist verstorben.`.replace(/\s+/g, " ");
      addChronicle(state, desc);
      recordWorldEvent(state, {
        type: "DIED_IN_OFFICE", actorIds: [advId], targetIds: [],
        emotionalWeight: -15, metadata: { role },
        description: desc,
      });
      state.advisors[role] = null;
      state.advisorLevels[role] = 0;
    }
  }
}

// §Character-Core-Punkt 27: Beraterwirkung entsteht primär aus Skill,
// Charaktereigenschaften und Loyalität — NICHT mehr aus "Stufe 3 = dreifache
// Wirkung" (die bisherige reine ×level-Skalierung). Das bestehende
// Ausbausystem (upgradeAdvisor(), baseCost, Ausbaukosten) bleibt technisch
// vollständig erhalten (§Punkt 28/29: kein harter Cut) — die Stufe wirkt
// jetzt als moderater Amtserfahrungsbonus (`tenureFactor`, per CONFIG neu
// und separat kalibriert) statt als alleiniger linearer Multiplikator.
function advisorEffectBonus(state, role) {
  const advisorId = state.advisors[role];
  if (!advisorId) return 0;
  const advisor = state.characters[advisorId];
  if (!advisor || !advisor.alive) return 0;
  const cfg = CONFIG.advisors;
  const level = state.advisorLevels[role] || 1;
  const statVal = advisor.stats[ADVISOR_ROLES[role].statKey];
  const tenureFactor = 1 + (level - 1) * cfg.tenureBonusPerLevel;
  const traitFactor = 1 + traitEffectSum(advisor, "advisorEffectMod");
  const loyaltyFactor = 0.7 + (advisor.loyalty / 100) * 0.3; // 0.7x (Loyalität 0) .. 1.0x (Loyalität 100)
  const multiplier = tenureFactor * traitFactor * loyaltyFactor;
  if (role === "schatzmeister") return Math.min(cfg.schatzmeisterMaxBonus * multiplier, (statVal / 100) * multiplier);
  if (role === "marschall") return (statVal / cfg.marschallStrengthDivisor) * multiplier;
  if (role === "diplomat") return (statVal / cfg.diplomatRelationBonusDivisor) * multiplier;
  if (role === "handelsberater") return (statVal / cfg.handelsberaterProductionDivisor) * multiplier;
  if (role === "spionagemeister") return (statVal / cfg.spionagemeisterAccuracyDivisor) * multiplier;
  return 0;
}

// ---------- Militär (§33/§34/§35) ----------

function recruitTroops(state, type, count) {
  const t = TROOP_TYPES[type];
  if (!t || count <= 0) return { ok: false, reason: "Ungültige Truppenart." };
  const cost = t.cost * count;
  if (state.treasury < cost) return { ok: false, reason: "Nicht genug Taler für die Aushebung." };

  if (t.source === "soeldner") {
    // Söldner: keine Lehenspflicht, reine Geldsache, aber unzuverlässig (§33/§34)
    state.treasury -= cost;
    state.army[type] += count;
    addChronicle(state, `${count} ${t.name} wurden angeheuert.`);
    return { ok: true };
  }

  // Vasallentruppen: erfordern wehrfähige Bevölkerung, Ritter zusätzlich Lehenstreue des Adels
  if (t.minAdelSatisfaction !== undefined) {
    const adelSat = state.regions.player.population.adel.satisfaction;
    if (adelSat < t.minAdelSatisfaction) {
      return { ok: false, reason: `Der Adel verweigert die Lehenspflicht (Zufriedenheit ${Math.round(adelSat)} < ${t.minAdelSatisfaction} nötig für Ritterdienst).` };
    }
  }
  const popCost = CONFIG.military.recruitPopCostPerUnit * count;
  const sourcePop = (type === "ritter") ? state.regions.player.population.adel : state.regions.player.population.bauern;
  if (sourcePop.count < popCost) {
    return { ok: false, reason: type === "ritter" ? "Nicht genug adlige Familien für weitere Ritter verfügbar." : "Nicht genug wehrfähige Bauern verfügbar." };
  }
  state.treasury -= cost;
  sourcePop.count -= popCost;
  state.army[type] += count;
  addChronicle(state, `${count} ${t.name} wurden ${type === "ritter" ? "zum Lehensdienst gerufen" : "ausgehoben"}.`);
  return { ok: true };
}

function armyStrength(state, formation) {
  const marschallBonus = advisorEffectBonus(state, "marschall");
  const kaserneBonus = buildingLevelSum(state.regions.player, "kaserne") * 15;
  const stadtmauerBonus = buildingLevelSum(state.regions.player, "stadtmauer") * 10;
  // §Original "Kaiser": automatische Bürgermiliz abhängig von Markt-/Mühlenanzahl,
  // zusätzlich zu den ausgehobenen Truppen
  const autoMilizBonus = (buildingLevelSum(state.regions.player, "markt") + buildingLevelSum(state.regions.player, "muehle")) * 2;
  let strength = kaserneBonus + stadtmauerBonus + autoMilizBonus;
  for (const type in state.army) strength += state.army[type] * TROOP_TYPES[type].strength;

  let formationBonus = 0;
  if (formation && FORMATIONS[formation]) {
    const f = FORMATIONS[formation];
    const required = Array.isArray(f.requiresTroop) ? f.requiresTroop : (f.requiresTroop ? [f.requiresTroop] : []);
    const hasRequired = required.length === 0 || required.some(t => state.army[t] > 0);
    if (hasRequired) formationBonus = f.bonus;
  }
  const militaerTechBonus = techBonus(state, "militaer");
  return strength * (1 + marschallBonus + formationBonus + militaerTechBonus);
}

// §33/§34: Söldner sind ohne Lehenstreue — sie desertieren eher, besonders
// wenn der Sold ausbleibt oder die Herrschaft (Legitimität) wackelt

function checkSoeldnerDesertion(state, unpaid) {
  if (!state.army.soeldner || state.army.soeldner <= 0) return;
  const cfg = CONFIG.military;
  let chance = cfg.soeldnerDesertionBaseChance;
  if (unpaid) chance += cfg.soeldnerDesertionUnpaidChance;
  if (state.legitimacy < CONFIG.succession.legitimacyLowThreshold) chance += cfg.soeldnerDesertionLowLegitimacyBonus;
  const deserters = Math.round(state.army.soeldner * clamp(chance, 0, 1));
  if (deserters > 0) {
    state.army.soeldner -= deserters;
    addChronicle(state, `${deserters} Söldner sind desertiert${unpaid ? " (der Sold blieb aus)" : ""}.`);
  }
}

function estimateAiStrength(region) {
  const totalPop = Object.values(region.population).reduce((s,g)=>s+g.count,0);
  const base = totalPop * CONFIG.military.aiStrengthPopFactor + buildingLevelSum(region, "kaserne") * 15 + buildingLevelSum(region, "stadtmauer") * 10;
  const spread = CONFIG.military.aiStrengthRandomSpread;
  return base * (1 + (rnd() * 2 - 1) * spread);
}

// ---------- §31: Die KI erklärt jetzt tatsächlich selbst Krieg ----------
// evaluateAiWarDecision() (debug.js) lieferte bisher nur eine Analyse ohne
// Konsequenz ("würde angreifen", aber die KI griff nie wirklich an). Diese
// Funktion nutzt dieselben Faktoren/dieselbe Schwelle (25) und gibt ihnen
// eine echte Wirkung: Ist die Lage günstig genug, erklärt der Nachbar dem
// Spieler tatsächlich den Krieg.
function evaluateAiAggressionFactors(state, aiId) {
  const region = state.regions[aiId];
  const dip = state.diplomacy[aiId];
  const playerStrength = armyStrength(state);
  const aiStrength = estimateAiStrength(region);
  // Auf einen plausiblen Rahmen begrenzt (§48-Analogie: einzelne Faktoren dürfen
  // nicht unbegrenzt explodieren) — sonst könnte extreme militärische Schwäche
  // des Spielers selbst ein Bündnis (paktFaktor -100) rechnerisch überstimmen,
  // was ein Bündnis zu einem unzuverlässigen Versprechen machen würde. Der
  // Mindestnenner (statt max(playerStrength,1)) verhindert außerdem, dass ein
  // Spieler ganz ohne Heer — was in den ersten Jahrzehnten einer wirtschafts-
  // orientierten Partie völlig normal ist — allein dadurch schon als maximal
  // verlockendes Ziel erscheint.
  const militaerFaktor = clamp(Math.round(((aiStrength - playerStrength) / Math.max(playerStrength, CONFIG.military.aiWarStrengthFloor)) * 30), -60, 90);
  const beziehungFaktor = Math.round(-dip.relation / 4); // schlechte Beziehung begünstigt Krieg
  const legitimitaetFaktor = Math.round((50 - state.legitimacy) / 5); // schwacher Spieler wirkt einladend
  const paktFaktor = dip.treaties.nichtangriff ? -40 : (dip.treaties.allianz ? -100 : 0);
  return { militaerFaktor, beziehungFaktor, legitimitaetFaktor, paktFaktor, gesamt: militaerFaktor + beziehungFaktor + legitimitaetFaktor + paktFaktor };
}

// Prüft jährlich, ob einer der 3 direkten Nachbarn dem Spieler den Krieg
// erklärt. Löst die Schlacht selbst NICHT auf (das bleibt Sache der
// interaktiven Kampf-Engine, die der Spieler steuert) — markiert nur
// `state.incomingAiWar`, das die UI beim nächsten Rendern aufgreift und den
// Kampfbildschirm öffnet. Verträge/Beziehungscrash werden erst dort über
// applyBattleResultToGame() angewendet (einzige Quelle der Wahrheit für
// Kriegsfolgen, egal wer erklärt hat — keine doppelte Bestrafung).
function checkAiWarInitiative(state) {
  const cfg = CONFIG.military;
  if (state.gameOver || state.pendingSiege || state.incomingAiWar) return null;
  if (state.year - 1500 < cfg.aiWarGraceYears) return null;
  const diffCfg = CONFIG.difficulty[state.difficulty] || CONFIG.difficulty.normal;
  if (!state.aiWarCooldown) state.aiWarCooldown = {};
  for (const aiId in state.diplomacy) {
    // Kriegskarte: eine bereits andauernde Kampagne (state.warState) läuft über
    // die Gebietsangriffe (aiTerritoryCounterAttack), kein zweites "erklärt
    // Krieg"-Ereignis nötig; ebenso keine neue Kriegserklärung gegen eine
    // bereits vollständig eroberte (vasallisierte) Region.
    if (state.warState && state.warState[aiId]) continue;
    if (state.regions[aiId] && state.regions[aiId].conquered) continue;
    if ((state.aiWarCooldown[aiId] || 0) > 0) { state.aiWarCooldown[aiId] -= 1; continue; }
    // Militärische Schwäche allein reicht nicht — es braucht auch eine wirklich
    // schlechte Beziehung als Rechtfertigung (siehe aiWarMaxRelationForAggression).
    if (state.diplomacy[aiId].relation >= cfg.aiWarMaxRelationForAggression) continue;
    const { gesamt } = evaluateAiAggressionFactors(state, aiId);
    if (gesamt <= cfg.aiWarThreshold) continue;
    if (rnd() < diffCfg.aiMistakeChance) continue; // §48: Schwierigkeit wirkt auch hier über die KI-Fehlerquote
    if (rnd() > cfg.aiWarInitiativeChance) continue; // nicht jede günstige Gelegenheit wird sofort genutzt
    state.aiWarCooldown[aiId] = cfg.aiWarCooldownYears;
    state.incomingAiWar = aiId;
    if (state.warState) state.warState[aiId] = true; // Kriegskarte: ab jetzt eine andauernde Kampagne
    addChronicle(state, `${state.regions[aiId].name} erklärt dir ohne Vorwarnung den Krieg!`);
    return aiId;
  }
  return null;
}

// Kriegskarte (§Original-Vertiefung): "Krieg erklären" löst seitdem keine
// Sofortschlacht mehr aus, sondern eröffnet eine andauernde Kampagne
// (state.warState[aiId] = true), die der Spieler über die Gebietsangriffe
// auf der Kriegskarte (js/war-map.js) austrägt — jeder einzelne Zusammenstoß
// weiterhin über die volle interaktive Kampf-Engine. Die alte
// Wahrscheinlichkeits-Sofortauflösung und die Belagerungsauslösung entfallen
// hier bewusst: eine befestigte Hauptstadt bekommt stattdessen automatisch
// die "Burg"-Geländeboni der Kampf-Engine, wenn sie als Gebiet angegriffen
// wird — granularer als die alte regionsweite Belagerung.
function declareWar(state, aiId) {
  const cfg = CONFIG.military;
  const dip = state.diplomacy[aiId];
  const region = state.regions[aiId];
  const hadPact = dip.treaties.nichtangriff || dip.treaties.allianz;

  // §Original "Kaiser": die übrigen Herrscher werden gefragt, ob sie
  // unterstützen, dem Gegner helfen oder neutral bleiben (rein narrativ in
  // der Kriegskarten-Fassung — noch ohne mechanische Stärkewirkung auf
  // einzelne Gebietskämpfe).
  const allyResults = rollWarAllies(state, aiId);
  const allyLines = allyResults.map(result =>
    result.stance === "supportPlayer" ? `${result.name} unterstützt dich.`
    : result.stance === "supportEnemy" ? `${result.name} unterstützt ${region.name}.`
    : `${result.name} bleibt neutral.`
  );

  const wasAllied = dip.treaties.allianz;
  dip.treaties.nichtangriff = false;
  dip.treaties.allianz = false;
  dip.treaties.handel = false;
  dip.relation = clamp(dip.relation + cfg.warRelationCrash, -100, 100);
  if (hadPact) state.prestige = Math.max(0, state.prestige - cfg.breakPactPrestigePenalty);

  state.warState[aiId] = true;
  const report = `Krieg gegen ${region.name} erklärt! Die Kampagne beginnt — erobere ihre Gebiete auf der Kriegskarte.\n${allyLines.join(" ")}`;
  addChronicle(state, report.replace(/\n/g, " "));

  recordWorldEvent(state, {
    type: "WAR_DECLARED", actorIds: [state.rulerId], regionIds: [aiId],
    emotionalWeight: -20, metadata: { targetRegion: aiId },
    description: `${state.characters[state.rulerId].name} erklärte ${region.name} den Krieg.`,
  });
  if (wasAllied) {
    recordWorldEvent(state, {
      type: "ALLIANCE_BROKEN", actorIds: [state.rulerId], regionIds: [aiId],
      emotionalWeight: -40, metadata: { targetRegion: aiId },
      description: `Das Bündnis mit ${region.name} wurde durch die Kriegserklärung gebrochen.`,
    });
  }
  for (const result of allyResults) {
    if (result.stance !== "supportPlayer") continue;
    recordWorldEvent(state, {
      type: "AID_GRANTED", actorIds: [state.rulerId], regionIds: [result.aiId],
      emotionalWeight: 30, metadata: { war: aiId },
      description: `${result.name} unterstützte dich im Krieg gegen ${region.name}.`,
    });
  }
  return { ok: true, report, allyLines };
}
