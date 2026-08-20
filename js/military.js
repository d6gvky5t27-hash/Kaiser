// ============================================================
// MILITARY — Berater, Truppen, Armeestärke, Unterhalt, KI-Stärke-
// Schätzung; declareWar() eröffnet seit der Kriegskarte (js/war-map.js) eine
// andauernde Kampagne statt einer Sofortschlacht. Die alte
// Belagerungsauflösung (startSiege/siegeStarve/siegeBribe/resolveSiegeStorm
// weiter unten) bleibt als unbenutzter Code stehen, seit die "Burg"-
// Geländeboni der Kampf-Engine dieselbe Rolle pro Gebiet übernehmen (§33/§34)
// ============================================================

function generateAdvisorCandidate(role) {
  const c = createCharacter(rnd() < 0.5 ? "m" : "f", 28 + Math.floor(rnd()*30), "");
  c.advisorRole = role;
  return c;
}

// Kosten, um ein Amt von currentLevel auf currentLevel+1 zu bringen (0 = Berufung
// auf Stufe 1). Gleiches Muster wie bei Gebäude-Ausbaustufen (upgradeCost() in core.js).
function advisorUpgradeCost(role, currentLevel) {
  return Math.round(ADVISOR_ROLES[role].baseCost * Math.pow(CONFIG.advisors.upgradeCostMultiplier, currentLevel));
}

function hireAdvisor(state, role) {
  if (state.advisors[role]) return { ok: false, reason: "Dieses Amt ist bereits besetzt." };
  const cost = advisorUpgradeCost(role, 0);
  if (state.treasury < cost) return { ok: false, reason: "Nicht genug Taler, um jemanden zu berufen." };
  const candidate = generateAdvisorCandidate(role);
  const cid = nextCharId();
  state.characters[cid] = candidate;
  state.advisors[role] = cid;
  state.advisorLevels[role] = 1;
  state.treasury -= cost;
  logLedger(state, `Berater berufen: ${ADVISOR_ROLES[role].name}`, -cost);
  addChronicle(state, `${candidate.name} wurde zum ${ADVISOR_ROLES[role].name} ernannt.`);
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
  const c = state.characters[state.advisors[role]];
  addChronicle(state, `${c ? c.name : "Der Amtsinhaber"} wurde als ${ADVISOR_ROLES[role].name} entlassen.`);
  state.advisors[role] = null;
  state.advisorLevels[role] = 0;
  return { ok: true };
}

// Bonus aus dem relevanten Stat des Beraters, falls besetzt — skaliert linear mit
// der Ausbaustufe (§Original-Vertiefung: Stufe 3 wirkt dreimal so stark wie Stufe 1).

function advisorEffectBonus(state, role) {
  const advisorId = state.advisors[role];
  if (!advisorId) return 0;
  const advisor = state.characters[advisorId];
  if (!advisor || !advisor.alive) return 0;
  const cfg = CONFIG.advisors;
  const level = state.advisorLevels[role] || 1;
  const statVal = advisor.stats[ADVISOR_ROLES[role].statKey];
  if (role === "schatzmeister") return Math.min(cfg.schatzmeisterMaxBonus * level, (statVal / 100) * level);
  if (role === "marschall") return (statVal / cfg.marschallStrengthDivisor) * level;
  if (role === "diplomat") return (statVal / cfg.diplomatRelationBonusDivisor) * level;
  if (role === "handelsberater") return (statVal / cfg.handelsberaterProductionDivisor) * level;
  if (role === "spionagemeister") return (statVal / cfg.spionagemeisterAccuracyDivisor) * level;
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

  dip.treaties.nichtangriff = false;
  dip.treaties.allianz = false;
  dip.treaties.handel = false;
  dip.relation = clamp(dip.relation + cfg.warRelationCrash, -100, 100);
  if (hadPact) state.prestige = Math.max(0, state.prestige - cfg.breakPactPrestigePenalty);

  state.warState[aiId] = true;
  const report = `Krieg gegen ${region.name} erklärt! Die Kampagne beginnt — erobere ihre Gebiete auf der Kriegskarte.\n${allyLines.join(" ")}`;
  addChronicle(state, report.replace(/\n/g, " "));
  return { ok: true, report, allyLines };
}

// ---------- Mehrere Siegbedingungen (§47) ----------

function resolveSiegeStorm(state) {
  if (!state.pendingSiege) return { ok: false, reason: "Keine Belagerung im Gange." };
  const s = state.pendingSiege;
  const cfg = CONFIG.military;
  const scfg = CONFIG.siege;
  const region = state.regions[s.targetId];

  const playerStrength = armyStrength(state, s.formation) + s.allyStrengthBonus;
  const aiStrength = (estimateAiStrength(region) + s.enemyStrengthBonus) * s.defenderStrengthFactor;
  const winChance = playerStrength / Math.max(playerStrength + aiStrength, 1);
  const won = rnd() < winChance;

  let report;
  if (won) {
    const loot = Math.round((region.warehouse.getreide||0) * cfg.lootShareOnWin * 2 + Object.values(region.population).reduce((sum,g)=>sum+g.count,0) * 0.05);
    state.treasury += loot;
    state.prestige += cfg.victoryPrestigeGain;
    for (const type in state.army) state.army[type] = Math.round(state.army[type] * (1 - cfg.winTroopLossShare * scfg.stormCasualtyMultiplier));
    state.stats.warsWon++;
    if (!state.warsWonAgainst) state.warsWonAgainst = {};
    state.warsWonAgainst[s.targetId] = true;
    report = `Sturmangriff auf ${region.name} erfolgreich! Beute: ${loot} Taler, Prestige +${cfg.victoryPrestigeGain}. Der Angriff kostete hohe Verluste.`;
  } else {
    state.stats.warsLost++;
    state.prestige = Math.max(0, state.prestige - cfg.defeatPrestigeLoss);
    for (const type in state.army) state.army[type] = Math.round(state.army[type] * (1 - cfg.loseTroopLossShare * scfg.stormCasualtyMultiplier));
    const r = state.regions.player;
    for (const pid in r.population) r.population[pid].satisfaction = clamp(r.population[pid].satisfaction - cfg.loseSatisfactionPenalty, 0, 100);
    report = `Sturmangriff auf ${region.name} gescheitert. Schwere Verluste, Prestige -${cfg.defeatPrestigeLoss}.`;
  }
  addChronicle(state, report);
  state.pendingSiege = null;
  return { ok: true, won, report };
}

function resolveSiegeStarve(state) {
  if (!state.pendingSiege) return { ok: false, reason: "Keine Belagerung im Gange." };
  const s = state.pendingSiege;
  s.defenderStrengthFactor = Math.max(0.2, s.defenderStrengthFactor - CONFIG.siege.starveStrengthDrainPerYear);
  let upkeep = 0;
  for (const type in state.army) upkeep += state.army[type] * TROOP_TYPES[type].upkeep * CONFIG.siege.starveUpkeepShare;
  state.treasury -= Math.round(upkeep);
  s.duration -= 1;
  addChronicle(state, `Die Belagerung von ${state.regions[s.targetId].name} zieht sich hin — der Verteidiger schwächt sich (Faktor ${s.defenderStrengthFactor.toFixed(2)}).`);
  if (s.duration <= 0) return resolveSiegeStorm(state);
  return { ok: true, ongoing: true };
}

function resolveSiegeBribe(state) {
  if (!state.pendingSiege) return { ok: false, reason: "Keine Belagerung im Gange." };
  const scfg = CONFIG.siege;
  if (state.treasury < scfg.bribeCost) return { ok: false, reason: "Nicht genug Taler für die Bestechung." };
  state.treasury -= scfg.bribeCost;
  const s = state.pendingSiege;
  const region = state.regions[s.targetId];
  const dip = state.diplomacy[s.targetId];
  if (rnd() < scfg.bribeSuccessChance) {
    const loot = Math.round((region.warehouse.getreide||0) * 0.1);
    state.treasury += loot;
    state.prestige += Math.round(CONFIG.military.victoryPrestigeGain * 0.6);
    addChronicle(state, `Die Garnison von ${region.name} wurde bestochen und übergibt die Stadt kampflos!`);
    state.pendingSiege = null;
    return { ok: true, won: true, report: `Die Garnison von ${region.name} wurde bestochen — Sieg ohne Schlacht!` };
  } else {
    dip.relation = clamp(dip.relation + scfg.bribeRelationPenalty, -100, 100);
    addChronicle(state, `Der Bestechungsversuch bei ${region.name} wurde entdeckt und schlug fehl.`);
    return { ok: true, won: false, report: "Der Bestechungsversuch ist gescheitert." };
  }
}
