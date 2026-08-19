// ============================================================
// ADVANCE YEAR — der zentrale jährliche Rundenschritt, der alle
// anderen Module orchestriert. Muss nach allen anderen js/*-Dateien
// geladen werden.
// ============================================================

function advanceYear(state) {
  state.year += 1;
  state.pendingEvent = null;

  // Berater-Effekt auf Produktion vor der Produktionsberechnung anwenden
  const handelsberaterBonus = advisorEffectBonus(state, "handelsberater");
  const infraProdBonus = state.regions.player.infrastructureLevel * CONFIG.infrastructure.productionBonusPerLevel;
  const handwerkTechBonus = techBonus(state, "handwerk");
  state.regions.player.productionBonus = (state.regions.player._baseProductionBonus || 0) + handelsberaterBonus + infraProdBonus + handwerkTechBonus;
  state.regions.player.getreideTechBonus = techBonus(state, "landwirtschaft");
  generateResearchPoints(state, state.regions.player); // §28

  for (const id in state.regions) {
    const r = state.regions[id];
    const weather = rollWeather();
    r.lastHarvestFactor = weather.factor;
    if (weather.factor < 0.8 || weather.factor > 1.2) {
      addChronicle(state, `In ${r.name} herrschte ${weather.name} (Ernteeinfluss ${(weather.factor*100).toFixed(0)}%).`);
    }
    computeProduction(r);
    updatePriceNoise(r); // Marktspekulation: Preise schwanken auch ohne Angebots-/Nachfrageänderung
    const prices = computeRegionalPrices(r);
    r.prices = prices;
    consumeAndUpdateSatisfaction(r, prices);
    applyExtraGrainDistribution(state, r); // §Original: freiwillige Kornverteilung
    updatePopulation(r);
    applyMigration(state, r); // §14
    if (!r.isPlayer) aiRegionDevelops(r, state);

    // §25: Stadtentwicklung — Stufenaufstieg prüfen, Zufriedenheitsbonus höherer Stufen
    const tierUp = updateSettlementTier(r);
    if (tierUp) addChronicle(state, `${r.name} hat die Entwicklungsstufe „${tierUp}“ erreicht.`);
    const tierSatBonus = (r.settlementTier || 0) * CONFIG.settlement.tierSatisfactionBonusPerLevel;
    if (tierSatBonus) {
      for (const pid in r.population) r.population[pid].satisfaction = clamp(r.population[pid].satisfaction + tierSatBonus * 0.05, 0, 100);
    }
  }

  updateLandPrice(state); // §Original: Landpreis schwankt spekulativ
  applyGovernanceStyle(state, state.regions.player); // §Original-Justizregler

  runInterregionalTrade(state);
  updateDiplomacy(state);
  const taxIncome = collectTaxes(state);
  payArmyUpkeep(state);
  payAdvisorSalaries(state);
  const r = state.regions.player;

  // Geistlicher hebt die Zufriedenheit leicht
  const geistlicherBonus = advisorEffectBonus(state, "geistlicher");
  if (state.advisors.geistlicher) {
    for (const pid in r.population) r.population[pid].satisfaction = clamp(r.population[pid].satisfaction + CONFIG.advisors.geistlicherSatBonus * 0.5, 0, 100);
  }

  // Legitimität erholt sich langsam, niedrige Legitimität drückt die Zufriedenheit (§45)
  state.legitimacy = clamp(state.legitimacy + CONFIG.succession.legitimacyRecoveryPerYear, 0, 100);
  if (state.legitimacy < CONFIG.succession.legitimacyLowThreshold) {
    for (const pid in r.population) r.population[pid].satisfaction = clamp(r.population[pid].satisfaction - CONFIG.succession.legitimacyLowSatPenalty * 0.3, 0, 100);
  }

  updateDynasty(state);
  const ruler = state.characters[state.rulerId];
  const prestigeGain = 1 + (ruler ? traitEffectSum(ruler, "prestigeGain") : 0);
  state.prestige += prestigeGain;
  // Palast: passiver Prestigezufluss (§26 Gebäudeeffekt)
  const palastBonus = buildingLevelSum(r, "palast") * BUILDINGS.palast.value;
  if (palastBonus) state.prestige += palastBonus;
  if (ruler) {
    const drain = traitEffectSum(ruler, "treasuryDrain");
    if (drain) state.treasury -= state.treasury * drain * 0.01;
    const satBonus = traitEffectSum(ruler, "satisfactionBonus");
    if (satBonus) {
      for (const pid in r.population) r.population[pid].satisfaction = clamp(r.population[pid].satisfaction + satBonus * 0.1, 0, 100);
    }
    const prodBonus = traitEffectSum(ruler, "productionBonus");
    if (prodBonus) {
      r._baseProductionBonus = (r._baseProductionBonus || 0) + prodBonus;
      r.productionBonus = r._baseProductionBonus + handelsberaterBonus;
    }
  }
  checkTitleProgress(state);
  checkElectionTrigger(state);
  updateIntel(state);
  updateReligion(state, r);
  checkAiWarInitiative(state); // §31: KI wägt nicht nur ab, sondern erklärt ggf. tatsächlich Krieg

  // §24 Staatsschulden: Zinsen fällig
  payDebtInterest(state);
  // §29 Vasallen zahlen Tribut
  collectVassalTribute(state);
  // §47 alternative Siegbedingungen prüfen
  checkAlternativeVictory(state);

  // §87 Spielende-Auswertung: laufende Höchstwerte mitschreiben
  const totalPlayerPop = Object.values(r.population).reduce((s,g)=>s+g.count, 0);
  state.stats.maxPopulation = Math.max(state.stats.maxPopulation, totalPlayerPop);
  state.stats.maxTreasury = Math.max(state.stats.maxTreasury, state.treasury);
  state.stats.highestTitleIndex = Math.max(state.stats.highestTitleIndex, state.titleIndex);

  // Event auswerten: erstes zutreffendes Event der Spielerregion
  for (const ev of EVENTS) {
    if (ev.condition(r, state) && rnd() < 0.6) {
      state.pendingEvent = ev;
      if (["seuche", "rebellion", "brand_in_der_stadt"].includes(ev.id)) state.stats.disastersCount++;
      break;
    }
  }

  const totalPop = Object.values(r.population).reduce((s,g)=>s+g.count,0);
  if (totalPop < CONFIG.state.defeatPopThreshold) {
    state.gameOver = "defeat";
    addChronicle(state, "Deine Provinz ist praktisch entvölkert. Deine Herrschaft endet.");
  }
  if (state.treasury < CONFIG.state.bankruptTreasuryThreshold) {
    state.gameOver = "bankrupt";
    addChronicle(state, "Der Staatsbankrott ist unabwendbar. Deine Herrschaft endet.");
  }

  return { taxIncome };
}

// ---------- Speichersystem (§64) — JSON Export/Import, kein Browser-Storage ----------
