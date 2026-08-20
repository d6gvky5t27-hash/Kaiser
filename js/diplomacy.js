// ============================================================
// DIPLOMACY — Verträge, Vasallen/Tribut/Ehe/Geiseln, Intrigen,
// Kriegsverbündete (§29/§30/§32)
// ============================================================

function sendGift(state, aiId) {
  const cfg = CONFIG.diplomacy;
  if (state.treasury < cfg.giftCost) return { ok: false, reason: "Nicht genug Taler." };
  state.treasury -= cfg.giftCost;
  state.diplomacy[aiId].relation = clamp(state.diplomacy[aiId].relation + cfg.giftRelationGain, -100, 100);
  addChronicle(state, `Ein Geschenk wurde an ${state.regions[aiId].name} gesandt.`);
  return { ok: true };
}

function proposeNonAggression(state, aiId) {
  const cfg = CONFIG.diplomacy;
  const dip = state.diplomacy[aiId];
  if (dip.treaties.nichtangriff) return { ok: false, reason: "Bereits ein Nichtangriffspakt in Kraft." };
  if (dip.relation < cfg.nonAggressionMinRelation) return { ok: false, reason: "Die Beziehung ist zu schlecht für dieses Angebot." };
  dip.treaties.nichtangriff = true;
  dip.relation = clamp(dip.relation + cfg.nonAggressionRelationGain, -100, 100);
  addChronicle(state, `Ein Nichtangriffspakt mit ${state.regions[aiId].name} wurde geschlossen.`);
  return { ok: true };
}

function proposeTradeTreaty(state, aiId) {
  const cfg = CONFIG.diplomacy;
  const dip = state.diplomacy[aiId];
  if (dip.treaties.handel) return { ok: false, reason: "Es besteht bereits ein Handelsvertrag." };
  if (dip.relation < cfg.tradeTreatyMinRelation) return { ok: false, reason: "Die Beziehung ist zu schlecht für dieses Angebot." };
  dip.treaties.handel = true;
  dip.relation = clamp(dip.relation + cfg.tradeTreatyRelationGain, -100, 100);
  addChronicle(state, `Ein Handelsvertrag mit ${state.regions[aiId].name} wurde geschlossen.`);
  return { ok: true };
}

function proposeAlliance(state, aiId) {
  const cfg = CONFIG.diplomacy;
  const dip = state.diplomacy[aiId];
  if (dip.treaties.allianz) return { ok: false, reason: "Es besteht bereits ein Bündnis." };
  if (dip.relation < cfg.allianceMinRelation) return { ok: false, reason: "Die Beziehung ist zu schlecht für ein Bündnis." };
  dip.treaties.allianz = true;
  dip.relation = clamp(dip.relation + cfg.allianceRelationGain, -100, 100);
  state.prestige += cfg.alliancePrestigeGain;
  addChronicle(state, `Ein Bündnis mit ${state.regions[aiId].name} wurde geschlossen.`);
  return { ok: true };
}

function updateDiplomacy(state) {
  const cfg = CONFIG.diplomacy;
  const diplomatBonus = advisorEffectBonus(state, "diplomat");
  for (const aiId in state.diplomacy) {
    const dip = state.diplomacy[aiId];
    let delta = (cfg.yearlyDriftToward - dip.relation) * cfg.yearlyDriftStrength;
    const treatyCount = Object.values(dip.treaties).filter(Boolean).length;
    delta += treatyCount * cfg.treatyYearlyBonus;
    delta += (rnd() * 2 - 1) * cfg.randomNoise;
    delta *= (1 + diplomatBonus);
    dip.relation = clamp(dip.relation + delta, -100, 100);
    // §29 dynastische Ehe: Beziehung fällt nicht mehr unter die vereinbarte Untergrenze
    if (dip.dynasticMarriageFloor !== undefined) dip.relation = Math.max(dip.relation, dip.dynasticMarriageFloor);
    if (dip.guaranteeFloor !== undefined) dip.relation = Math.max(dip.relation, dip.guaranteeFloor);

    // KI-seitige Diplomatie-Initiative (§30/§86): Nachbarn handeln auch von sich aus
    if (rnd() < cfg.aiGiftChance && dip.relation < 70) {
      dip.relation = clamp(dip.relation + cfg.aiGiftRelationGain, -100, 100);
      addChronicle(state, `${state.regions[aiId].name} sandte Gesandte mit Geschenken, um die Beziehungen zu verbessern.`);
    } else if (rnd() < cfg.aiInitiativeChance) {
      if (!dip.treaties.nichtangriff && dip.relation >= cfg.nonAggressionMinRelation) {
        dip.treaties.nichtangriff = true;
        addChronicle(state, `${state.regions[aiId].name} bot von sich aus einen Nichtangriffspakt an, der angenommen wurde.`);
      } else if (!dip.treaties.handel && dip.relation >= cfg.tradeTreatyMinRelation) {
        dip.treaties.handel = true;
        addChronicle(state, `${state.regions[aiId].name} schlug einen Handelsvertrag vor, der angenommen wurde.`);
      }
    }
  }
}

// ---------- Berater (§42/§43) ----------

function vassalize(state, aiId) {
  const cfg = CONFIG.diplomacyExtra;
  const dip = state.diplomacy[aiId];
  if (state.vassals[aiId]) return { ok: false, reason: "Diese Region ist bereits Vasall." };
  if (dip.relation < cfg.vassalizeMinRelation) return { ok: false, reason: `Beziehung zu niedrig (mind. ${cfg.vassalizeMinRelation} nötig).` };
  state.vassals[aiId] = true;
  addChronicle(state, `${state.regions[aiId].name} hat sich als Vasall unterstellt und zahlt fortan Tribut.`);
  return { ok: true };
}

function demandTribute(state, aiId) {
  const cfg = CONFIG.diplomacyExtra;
  const dip = state.diplomacy[aiId];
  if (dip.relation < cfg.demandTributeMinRelation) return { ok: false, reason: "Beziehung zu schlecht, um überhaupt zu verhandeln." };
  if (rnd() < cfg.demandTributeSuccessChance) {
    state.treasury += cfg.demandTributeAmount;
    dip.relation = clamp(dip.relation - 10, -100, 100);
    addChronicle(state, `${state.regions[aiId].name} zahlte ${cfg.demandTributeAmount} Taler Tribut.`);
    return { ok: true, success: true };
  } else {
    dip.relation = clamp(dip.relation + cfg.demandTributeFailRelationPenalty, -100, 100);
    addChronicle(state, `${state.regions[aiId].name} weigerte sich, Tribut zu zahlen — die Beziehungen leiden.`);
    return { ok: true, success: false };
  }
}

function dynasticMarriage(state, aiId) {
  const cfg = CONFIG.diplomacyExtra;
  const dip = state.diplomacy[aiId];
  if (dip.relation < cfg.dynasticMarriageMinRelation) return { ok: false, reason: `Beziehung zu niedrig (mind. ${cfg.dynasticMarriageMinRelation} nötig).` };
  if (state.treasury < cfg.dynasticMarriageCost) return { ok: false, reason: "Nicht genug Taler für die Mitgift." };
  state.treasury -= cfg.dynasticMarriageCost;
  dip.relation = clamp(dip.relation + cfg.dynasticMarriageRelationFloorBonus, -100, 100);
  dip.dynasticMarriageFloor = Math.max(dip.dynasticMarriageFloor || -100, dip.relation - 20);
  addChronicle(state, `Eine dynastische Heirat mit dem Haus ${state.regions[aiId].name} wurde geschlossen.`);
  return { ok: true };
}

function hostageExchange(state, aiId) {
  const cfg = CONFIG.diplomacyExtra;
  if (state.treasury < cfg.hostageExchangeCost) return { ok: false, reason: "Nicht genug Taler für den Geiselaustausch." };
  state.treasury -= cfg.hostageExchangeCost;
  state.diplomacy[aiId].relation = clamp(state.diplomacy[aiId].relation + cfg.hostageExchangeRelationGain, -100, 100);
  addChronicle(state, `Ein Geiselaustausch mit ${state.regions[aiId].name} festigte das Vertrauen.`);
  return { ok: true };
}

// ---------- Weitere Diplomatie-Aktionen: Durchmarschrecht, Garantie, Friedensvertrag, Gebietsforderung ----------
function grantTransitRights(state, aiId) {
  const cfg = CONFIG.diplomacyExtra;
  const dip = state.diplomacy[aiId];
  if (dip.relation < cfg.transitRightsMinRelation) return { ok: false, reason: `Beziehung zu niedrig (mind. ${cfg.transitRightsMinRelation} nötig).` };
  if (state.treasury < cfg.transitRightsCost) return { ok: false, reason: "Nicht genug Taler." };
  state.treasury -= cfg.transitRightsCost;
  dip.treaties.durchmarsch = true;
  addChronicle(state, `${state.regions[aiId].name} gewährt Durchmarschrecht — Handelsrouten über die Region werden sicherer und günstiger.`);
  return { ok: true };
}

function guaranteeRegion(state, aiId) {
  const cfg = CONFIG.diplomacyExtra;
  const dip = state.diplomacy[aiId];
  if (dip.relation < cfg.guaranteeMinRelation) return { ok: false, reason: `Beziehung zu niedrig (mind. ${cfg.guaranteeMinRelation} nötig).` };
  if (state.treasury < cfg.guaranteeCost) return { ok: false, reason: "Nicht genug Taler." };
  state.treasury -= cfg.guaranteeCost;
  dip.guaranteeFloor = Math.max(dip.guaranteeFloor || -100, dip.relation - 15, cfg.guaranteeFloorBonus);
  addChronicle(state, `Du garantierst die Unabhängigkeit von ${state.regions[aiId].name} — die Beziehung wird dauerhaft nicht mehr allzu tief fallen.`);
  return { ok: true };
}

function proposePeaceTreaty(state, aiId) {
  const cfg = CONFIG.diplomacyExtra;
  const dip = state.diplomacy[aiId];
  // je schlechter die Beziehung, desto teurer der Friedensvertrag (mehr Zugeständnisse nötig)
  const relationPenaltyFactor = dip.relation < 0 ? (1 + Math.abs(dip.relation) / 50) : 1;
  const cost = Math.round(cfg.peaceTreatyBaseCost * relationPenaltyFactor);
  if (state.treasury < cost) return { ok: false, reason: `Nicht genug Taler (benötigt: ${cost}).` };
  state.treasury -= cost;
  dip.relation = clamp(dip.relation + cfg.peaceTreatyRelationGain, -100, 100);
  addChronicle(state, `Ein Friedensvertrag mit ${state.regions[aiId].name} wurde für ${cost} Taler geschlossen.`);
  return { ok: true, cost };
}

function demandTerritory(state, aiId) {
  const cfg = CONFIG.diplomacyExtra;
  const dip = state.diplomacy[aiId];
  const region = state.regions[aiId];
  if (dip.relation < cfg.demandTerritoryMinRelation) return { ok: false, reason: "Die Beziehung ist zu gut, um Gebiete zu fordern — das wäre unglaubwürdig." };
  const playerStrength = armyStrength(state);
  const theirStrength = estimateAiStrength(region);
  const successChance = clamp(playerStrength / Math.max(playerStrength + theirStrength, 1), 0.1, 0.9);
  if (rnd() < successChance) {
    const hectares = Math.min(cfg.demandTerritoryHectares, Math.max(0, region.land - 1000));
    region.land -= hectares;
    state.regions.player.land += hectares;
    dip.relation = clamp(dip.relation - 25, -100, 100);
    addChronicle(state, `${region.name} tritt unter Druck ${hectares} Hektar Land ab!`);
    return { ok: true, success: true, hectares };
  } else {
    dip.relation = clamp(dip.relation + cfg.demandTerritoryFailRelationPenalty, -100, 100);
    addChronicle(state, `${region.name} weist die Gebietsforderung entschieden zurück — die Beziehungen leiden.`);
    return { ok: true, success: false };
  }
}

// ---------- Kaiserwahl (§12) ----------

function attemptSabotage(state, aiId) {
  const cfg = CONFIG.intrigue;
  if (state.treasury < cfg.sabotageCost) return { ok: false, reason: "Nicht genug Taler für die Intrige." };
  state.treasury -= cfg.sabotageCost;
  const region = state.regions[aiId];
  const discovered = rnd() < cfg.sabotageDiscoveryChance;
  for (const gid in region.warehouse) {
    region.warehouse[gid] = Math.round((region.warehouse[gid]||0) * (1 - cfg.sabotageWarehouseLossShare));
  }
  if (discovered) {
    state.diplomacy[aiId].relation = clamp(state.diplomacy[aiId].relation + cfg.sabotageRelationPenaltyOnDiscovery, -100, 100);
    addChronicle(state, `Eine Sabotage-Aktion gegen ${region.name} wurde aufgedeckt — die Beziehungen sind schwer belastet.`);
    return { ok: true, discovered: true };
  }
  addChronicle(state, `Lagerbestände in ${region.name} wurden heimlich sabotiert.`);
  return { ok: true, discovered: false };
}

// §32: weitere Intrigen-Arten neben Sabotage — Gerüchte (billig, sozialer
// Schaden statt Wareneinbußen) und Erpressung (teurer, riskanter, nutzt die
// eigene Spionage-Genauigkeit als Druckmittel)

function spreadRumors(state, aiId) {
  const cfg = CONFIG.intrigue;
  if (state.treasury < cfg.rumorCost) return { ok: false, reason: "Nicht genug Taler, um Gerüchte in Umlauf zu bringen." };
  state.treasury -= cfg.rumorCost;
  const region = state.regions[aiId];
  const discovered = rnd() < cfg.rumorDiscoveryChance;
  region.population.adel.satisfaction = clamp(region.population.adel.satisfaction - cfg.rumorSatisfactionDamage, 0, 100);
  region.population.buerger.satisfaction = clamp(region.population.buerger.satisfaction - cfg.rumorSatisfactionDamage, 0, 100);
  if (discovered) {
    state.diplomacy[aiId].relation = clamp(state.diplomacy[aiId].relation + cfg.rumorRelationPenaltyOnDiscovery, -100, 100);
    addChronicle(state, `Gerüchte über ${region.name} wurden gestreut — die Herkunft kam ans Licht, die Beziehungen leiden.`);
    return { ok: true, discovered: true };
  }
  addChronicle(state, `Unschöne Gerüchte über den Hof von ${region.name} machen die Runde.`);
  return { ok: true, discovered: false };
}

function attemptExtortion(state, aiId) {
  const cfg = CONFIG.intrigue;
  if (state.treasury < cfg.extortionCost) return { ok: false, reason: "Nicht genug Taler, um die Erpressung vorzubereiten." };
  state.treasury -= cfg.extortionCost;
  const accuracy = (state.intel[aiId] && state.intel[aiId].accuracy) || cfg.baseIntelAccuracy;
  const successChance = clamp(cfg.extortionBaseSuccessChance + accuracy * cfg.extortionIntelAccuracyBonus, 0.05, 0.9);
  const dip = state.diplomacy[aiId];
  dip.relation = clamp(dip.relation + cfg.extortionRelationPenaltyAlways, -100, 100);
  if (rnd() < successChance) {
    state.treasury += cfg.extortionAmount;
    addChronicle(state, `${state.regions[aiId].name} zahlt ${cfg.extortionAmount} Taler, um pikante Geheimnisse für sich zu behalten.`);
    return { ok: true, success: true };
  } else {
    dip.relation = clamp(dip.relation + cfg.extortionFailExtraRelationPenalty, -100, 100);
    addChronicle(state, `Der Erpressungsversuch gegen ${state.regions[aiId].name} scheitert kläglich — die Beziehungen sind schwer beschädigt.`);
    return { ok: true, success: false };
  }
}

// §32: die restlichen vier Intrigen-Arten — Verschwörung (selten, teuer,
// aber verheerend bei Erfolg), Dokumentenfälschung (untermauert die eigene
// Legitimität, nicht gegen eine Region gerichtet), Rebellenunterstützung
// (härtester Eingriff neben Sabotage, fast kriegsähnliches Risiko bei
// Aufdeckung) und politische Manipulation (schwächer, aber mit langfristiger
// Wirkung — lähmt die Bautätigkeit der Zielregion für mehrere Jahre).

function attemptConspiracy(state, aiId) {
  const cfg = CONFIG.intrigue;
  if (state.treasury < cfg.conspiracyCost) return { ok: false, reason: "Nicht genug Taler für eine Verschwörung." };
  state.treasury -= cfg.conspiracyCost;
  const region = state.regions[aiId];
  if (rnd() < cfg.conspiracySuccessChance) {
    if (region.buildings.length > 0) {
      const idx = Math.floor(rnd() * region.buildings.length);
      const target = region.buildings[idx];
      const b = BUILDINGS[target.type];
      if (target.level > 1) {
        target.level -= 1;
        addChronicle(state, `Eine angezettelte Verschwörung stürzt ${region.name} ins Chaos — ${b.name} wird bei den Unruhen beschädigt (Stufe ${target.level}).`);
      } else {
        region.buildings.splice(idx, 1);
        addChronicle(state, `Eine angezettelte Verschwörung stürzt ${region.name} ins Chaos — ${b.name} wird in den Unruhen niedergebrannt.`);
      }
    } else {
      addChronicle(state, `Die Verschwörung gegen ${region.name} verpufft wirkungslos — es gibt dort nichts zu zerstören.`);
    }
    return { ok: true, success: true };
  } else {
    const dip = state.diplomacy[aiId];
    dip.relation = clamp(dip.relation + cfg.conspiracyDiscoveryRelationPenalty, -100, 100);
    state.prestige = Math.max(0, state.prestige - cfg.conspiracyDiscoveryPrestigePenalty);
    addChronicle(state, `Die Verschwörung gegen ${region.name} wird aufgedeckt — ein handfester Skandal beschädigt deinen Ruf.`);
    return { ok: true, success: false };
  }
}

function forgeDocuments(state) {
  const cfg = CONFIG.intrigue;
  if (state.treasury < cfg.forgeryCost) return { ok: false, reason: "Nicht genug Taler, um Urkunden fälschen zu lassen." };
  state.treasury -= cfg.forgeryCost;
  if (rnd() < cfg.forgerySuccessChance) {
    state.legitimacy = clamp(state.legitimacy + cfg.forgeryLegitimacyGain, 0, 100);
    addChronicle(state, `Gefälschte Urkunden untermauern deinen Herrschaftsanspruch — die Legitimität steigt.`);
    return { ok: true, success: true };
  } else {
    state.legitimacy = Math.max(0, state.legitimacy - cfg.forgeryFailLegitimacyLoss);
    state.prestige = Math.max(0, state.prestige - cfg.forgeryFailPrestigeLoss);
    addChronicle(state, `Die gefälschten Urkunden werden als Fälschung entlarvt — ein peinlicher Rückschlag für deine Legitimität.`);
    return { ok: true, success: false };
  }
}

function supportRebels(state, aiId) {
  const cfg = CONFIG.intrigue;
  if (state.treasury < cfg.rebelSupportCost) return { ok: false, reason: "Nicht genug Taler, um Aufständische zu finanzieren." };
  state.treasury -= cfg.rebelSupportCost;
  const region = state.regions[aiId];
  region.population.arme.satisfaction = clamp(region.population.arme.satisfaction - cfg.rebelSupportSatisfactionDamage, 0, 100);
  region.population.tageloehner.satisfaction = clamp(region.population.tageloehner.satisfaction - cfg.rebelSupportSatisfactionDamage, 0, 100);
  region.population.arme.count = Math.max(0, Math.round(region.population.arme.count * (1 - cfg.rebelSupportPopLossShare)));
  region.population.tageloehner.count = Math.max(0, Math.round(region.population.tageloehner.count * (1 - cfg.rebelSupportPopLossShare)));
  const discovered = rnd() < cfg.rebelSupportDiscoveryChance;
  if (discovered) {
    state.diplomacy[aiId].relation = clamp(state.diplomacy[aiId].relation + cfg.rebelSupportDiscoveryRelationPenalty, -100, 100);
    addChronicle(state, `Die Unterstützung von Aufständischen in ${region.name} wird aufgedeckt — die Beziehungen sind fast auf dem Stand eines Kriegsgrunds.`);
    return { ok: true, discovered: true };
  }
  addChronicle(state, `Heimlich finanzierte Unruhestifter sorgen in ${region.name} für Aufruhr unter den Ärmsten.`);
  return { ok: true, discovered: false };
}

function attemptPoliticalManipulation(state, aiId) {
  const cfg = CONFIG.intrigue;
  if (state.treasury < cfg.manipulationCost) return { ok: false, reason: "Nicht genug Taler für politische Manipulation." };
  state.treasury -= cfg.manipulationCost;
  const region = state.regions[aiId];
  for (const pid in region.population) {
    region.population[pid].satisfaction = clamp(region.population[pid].satisfaction - cfg.manipulationSatisfactionDamage, 0, 100);
  }
  region._manipulationYears = Math.max(region._manipulationYears || 0, cfg.manipulationDisruptionYears);
  const discovered = rnd() < cfg.manipulationDiscoveryChance;
  if (discovered) {
    state.diplomacy[aiId].relation = clamp(state.diplomacy[aiId].relation + cfg.manipulationDiscoveryRelationPenalty, -100, 100);
    addChronicle(state, `Politische Ränke gegen ${region.name} werden aufgedeckt — die Beziehungen leiden.`);
    return { ok: true, discovered: true };
  }
  addChronicle(state, `Politische Manipulation stürzt den Hof von ${region.name} für Jahre in Verwaltungschaos.`);
  return { ok: true, discovered: false };
}

// ---------- Informationsunsicherheit (§41) ----------

function spyOn(state, aiId) {
  const cfg = CONFIG.intrigue;
  if (state.treasury < cfg.spyMissionCost) return { ok: false, reason: "Nicht genug Taler für die Spionage." };
  state.treasury -= cfg.spyMissionCost;
  state.intel[aiId].accuracy = clamp(state.intel[aiId].accuracy + cfg.spyAccuracyGain, 0, 1);
  addChronicle(state, `Spione wurden nach ${state.regions[aiId].name} entsandt.`);
  return { ok: true };
}

function updateIntel(state) {
  const cfg = CONFIG.intrigue;
  for (const aiId in state.intel) {
    state.intel[aiId].accuracy = clamp(state.intel[aiId].accuracy - cfg.spyAccuracyDecayPerYear, cfg.baseIntelAccuracy, 1);
    const trueStrength = estimateAiStrength(state.regions[aiId]);
    const spread = (1 - state.intel[aiId].accuracy) * 0.7;
    state.intel[aiId].rangeLow = Math.round(trueStrength * (1 - spread));
    state.intel[aiId].rangeHigh = Math.round(trueStrength * (1 + spread));
  }
}

// ---------- Land als Handelsware (§Original "Kaiser", C64 1984) ----------

function rollWarAllies(state, targetId) {
  const cfg = CONFIG.warAllies;
  const results = [];
  for (const aiId in state.diplomacy) {
    if (aiId === targetId) continue;
    const relation = state.diplomacy[aiId].relation;
    const supportChance = clamp(cfg.baseSupportChance + Math.max(0, relation - cfg.supportThreshold) / 150, 0, 0.75);
    const opposeChance = clamp(cfg.baseOpposeChance + Math.max(0, -relation) / 200, 0, 0.4);
    const roll = rnd();
    let stance;
    if (roll < supportChance) stance = "supportPlayer";
    else if (roll < supportChance + opposeChance) stance = "supportEnemy";
    else stance = "neutral";
    results.push({ aiId, name: state.regions[aiId].name, stance });
  }
  return results;
}

// ---------- Technologiesystem (§28) ----------
