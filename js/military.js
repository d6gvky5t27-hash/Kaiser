// ============================================================
// MILITARY — Berater, Truppen, Armeestärke, Unterhalt, KI-Stärke-
// Schätzung; alte Sofort-/Belagerungsauflösung bleibt als unbenutzter
// Code stehen, seit die eigenständige Kampf-Engine übernommen hat (§33/§34)
// ============================================================

function generateAdvisorCandidate(role) {
  const c = createCharacter(rnd() < 0.5 ? "m" : "f", 28 + Math.floor(rnd()*30), "");
  c.advisorRole = role;
  return c;
}

function hireAdvisor(state, role) {
  const cfg = CONFIG.advisors;
  if (state.advisors[role]) return { ok: false, reason: "Dieses Amt ist bereits besetzt." };
  if (state.treasury < cfg.hireCost) return { ok: false, reason: "Nicht genug Taler, um jemanden zu berufen." };
  const candidate = generateAdvisorCandidate(role);
  const cid = nextCharId();
  state.characters[cid] = candidate;
  state.advisors[role] = cid;
  state.treasury -= cfg.hireCost;
  addChronicle(state, `${candidate.name} wurde zum ${ADVISOR_ROLES[role].name} ernannt.`);
  return { ok: true };
}

function dismissAdvisor(state, role) {
  if (!state.advisors[role]) return { ok: false, reason: "Dieses Amt ist nicht besetzt." };
  const c = state.characters[state.advisors[role]];
  addChronicle(state, `${c ? c.name : "Der Amtsinhaber"} wurde als ${ADVISOR_ROLES[role].name} entlassen.`);
  state.advisors[role] = null;
  return { ok: true };
}

// Normierter Bonus (0..~0.3) aus dem relevanten Stat des Beraters, falls besetzt

function advisorEffectBonus(state, role) {
  const advisorId = state.advisors[role];
  if (!advisorId) return 0;
  const advisor = state.characters[advisorId];
  if (!advisor || !advisor.alive) return 0;
  const cfg = CONFIG.advisors;
  const statVal = advisor.stats[ADVISOR_ROLES[role].statKey];
  if (role === "schatzmeister") return Math.min(cfg.schatzmeisterMaxBonus, statVal / 100);
  if (role === "marschall") return statVal / cfg.marschallStrengthDivisor;
  if (role === "diplomat") return statVal / cfg.diplomatRelationBonusDivisor;
  if (role === "handelsberater") return statVal / cfg.handelsberaterProductionDivisor;
  return 0;
}

function payAdvisorSalaries(state) {
  const count = Object.values(state.advisors).filter(Boolean).length;
  state.treasury -= count * CONFIG.advisors.yearlySalary;
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

function payArmyUpkeep(state) {
  let upkeep = 0;
  for (const type in state.army) upkeep += state.army[type] * TROOP_TYPES[type].upkeep;
  state.treasury -= upkeep;
  checkSoeldnerDesertion(state, state.treasury < 0);
  return upkeep;
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

function declareWar(state, aiId, formation) {
  const cfg = CONFIG.military;
  const dip = state.diplomacy[aiId];
  const region = state.regions[aiId];
  const hadPact = dip.treaties.nichtangriff || dip.treaties.allianz;

  // §Original "Kaiser": die übrigen Herrscher werden gefragt, ob sie
  // unterstützen, dem Gegner helfen oder neutral bleiben
  const allyResults = rollWarAllies(state, aiId);
  let allyStrengthBonus = 0, enemyStrengthBonus = 0;
  const allyLines = [];
  for (const result of allyResults) {
    const theirStrength = estimateAiStrength(state.regions[result.aiId]);
    if (result.stance === "supportPlayer") {
      allyStrengthBonus += theirStrength * CONFIG.warAllies.strengthContribution;
      allyLines.push(`${result.name} unterstützt dich.`);
    } else if (result.stance === "supportEnemy") {
      enemyStrengthBonus += theirStrength * CONFIG.warAllies.strengthContribution;
      allyLines.push(`${result.name} unterstützt ${region.name}.`);
    } else {
      allyLines.push(`${result.name} bleibt neutral.`);
    }
  }

  // Verträge enden mit der Kriegserklärung, unabhängig vom weiteren Verlauf
  dip.treaties.nichtangriff = false;
  dip.treaties.allianz = false;
  dip.treaties.handel = false;
  dip.relation = clamp(dip.relation + cfg.warRelationCrash, -100, 100);
  if (hadPact) state.prestige = Math.max(0, state.prestige - cfg.breakPactPrestigePenalty);

  // §36: Eine befestigte Region (Stadtmauer) löst eine mehrjährige Belagerung
  // aus, statt sich sofort aufzulösen — unbefestigte Ziele bleiben eine
  // Sofortschlacht (vereinfachtes Schlachtsystem, §35)
  const wallLevel = buildingLevelSum(region, "stadtmauer");
  if (wallLevel > 0) {
    const duration = Math.min(CONFIG.siege.maxDuration, wallLevel * CONFIG.siege.durationPerWallLevel);
    state.pendingSiege = {
      targetId: aiId, formation, allyStrengthBonus, enemyStrengthBonus,
      duration, defenderStrengthFactor: 1.0,
    };
    const report = `Belagerung von ${region.name} beginnt (Stadtmauer verteidigt, geschätzte Dauer bis zu ${duration} Jahre).\n${allyLines.join(" ")}`;
    addChronicle(state, report.replace(/\n/g, " "));
    return { ok: true, siegeStarted: true, report, allyLines };
  }

  const playerStrength = armyStrength(state, formation) + allyStrengthBonus;
  const aiStrength = estimateAiStrength(region) + enemyStrengthBonus;
  const winChance = playerStrength / Math.max(playerStrength + aiStrength, 1);
  const won = rnd() < winChance;

  const formationName = formation && FORMATIONS[formation] ? FORMATIONS[formation].name : null;
  let report;
  if (won) {
    const loot = Math.round((region.warehouse.getreide||0) * cfg.lootShareOnWin * 2 + Object.values(region.population).reduce((s,g)=>s+g.count,0) * 0.05);
    state.treasury += loot;
    state.prestige += cfg.victoryPrestigeGain;
    for (const type in state.army) state.army[type] = Math.round(state.army[type] * (1 - cfg.winTroopLossShare));
    state.stats.warsWon++;
    if (!state.warsWonAgainst) state.warsWonAgainst = {};
    state.warsWonAgainst[aiId] = true;
    report = `Sieg gegen ${region.name}${formationName ? ` (Formation: ${formationName})` : ""}! Beute: ${loot} Taler, Prestige +${cfg.victoryPrestigeGain}.`;
  } else {
    state.stats.warsLost++;
    state.prestige = Math.max(0, state.prestige - cfg.defeatPrestigeLoss);
    for (const type in state.army) state.army[type] = Math.round(state.army[type] * (1 - cfg.loseTroopLossShare));
    const r = state.regions.player;
    for (const pid in r.population) r.population[pid].satisfaction = clamp(r.population[pid].satisfaction - cfg.loseSatisfactionPenalty, 0, 100);
    report = `Niederlage gegen ${region.name}${formationName ? ` (Formation: ${formationName})` : ""}. Schwere Verluste, Prestige -${cfg.defeatPrestigeLoss}.`;
  }
  if (allyLines.length) report += `\n${allyLines.join(" ")}`;
  addChronicle(state, report.replace(/\n/g, " "));
  return { ok: true, won, report, allyLines };
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
