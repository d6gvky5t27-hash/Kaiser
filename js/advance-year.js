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
    computeGrainBalance(r); // vor der Verteilung erfassen: verfügbares Getreide vs. Grundbedarf
    updatePriceNoise(r); // Marktspekulation: Preise schwanken auch ohne Angebots-/Nachfrageänderung
    const prices = computeRegionalPrices(r);
    r.prices = prices;
    consumeAndUpdateSatisfaction(r, prices);
    applyExtraGrainDistribution(state, r); // §Original: freiwillige Kornverteilung
    r.grainDistributed = r.grainAvailable - (r.warehouse.getreide || 0); // tatsächlich ans Volk abgegeben (Grundbedarf + Kornausgabe)
    applyGrainSpoilage(r); // Schwund/Verderb des Restbestands oberhalb der Lagerkapazität
    updatePopulation(r);
    if (r._manipulationYears > 0) r._manipulationYears -= 1; // §32 politische Manipulation klingt ab
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
  applyInterRegionalMigration(state); // §14: Wanderung zwischen den 8 Regionen statt nur zur/von der Außenwelt
  updateDiplomacy(state);
  // Steuern/Unterhalt/Gehälter/Zinsen/Tribut laufen seit dem Monatstakt über
  // applyMonthlyFinances() (12×/Jahr) statt hier einmal jährlich — die
  // Söldner-Fahnenflucht-Prüfung bleibt aber bewusst eine jährliche
  // Stichprobe (ihre Wahrscheinlichkeiten sind auf diese Frequenz kalibriert).
  checkSoeldnerDesertion(state, state.treasury < 0);
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

  return {};
}

// ---------- Monatstakt: Kassenbuch ----------
// Steuern/Unterhalt/Gehälter/Zinsen/Tribut laufen monatlich (jeweils
// Jahresformel ÷12), damit die Staatskasse sich spürbar und nachvollziehbar
// über die Zeit entwickelt statt einmal jährlich in einem Schlag zu
// springen. Alles andere (Ernte, Bevölkerung, Diplomatie, Wahlen, Altern,
// Ereignisse …) bleibt bewusst ein reiner Jahresrhythmus — siehe advanceMonth().
function applyMonthlyFinances(state) {
  const treasuryBefore = state.treasury;
  const r = state.regions.player;

  // Steuerkraft je Gruppe unterscheidet sich (POP_GROUPS[pid].weight, §Original-
  // Vertiefung: Adel/Händler/Bürger tragen anteilig mehr zur Steuerlast bei als
  // Bauern, Tagelöhner oder Arme) statt wie zuvor pauschal pro Kopf.
  let totalWealth = 0;
  const taxByGroup = {};
  for (const pid in r.population) {
    const w = r.population[pid].count * (POP_GROUPS[pid].weight || 1) * CONFIG.state.treasuryTaxWealthFactor;
    totalWealth += w;
    taxByGroup[pid] = w;
  }
  const schatzmeisterBonus = advisorEffectBonus(state, "schatzmeister");
  const verwaltungTechBonus = techBonus(state, "verwaltung");
  const taxMultiplier = r.taxRate * (1 + schatzmeisterBonus + verwaltungTechBonus) / 12;
  const taxIncome = Math.round(totalWealth * taxMultiplier);
  state.treasury += taxIncome;
  // Für die Kassenbuch-Aufschlüsselung: wie viel jede Gruppe monatlich beisteuert
  const taxBreakdown = {};
  for (const pid in taxByGroup) taxBreakdown[pid] = Math.round(taxByGroup[pid] * taxMultiplier);

  let upkeep = 0;
  for (const type in state.army) upkeep += state.army[type] * TROOP_TYPES[type].upkeep;
  upkeep = Math.round(upkeep / 12);
  state.treasury -= upkeep;

  const advisorCount = Object.values(state.advisors).filter(Boolean).length;
  const salaries = Math.round(advisorCount * CONFIG.advisors.yearlySalary / 12);
  state.treasury -= salaries;

  let debtInterest = 0;
  if (state.debt > 0) {
    debtInterest = Math.round(state.debt * currentDebtInterestRate(state) / 12);
    state.treasury -= debtInterest;
  }

  const vcfg = CONFIG.diplomacyExtra;
  let vassalTribute = 0;
  for (const aiId in state.vassals) {
    if (!state.vassals[aiId]) continue;
    const region = state.regions[aiId];
    const totalPop = Object.values(region.population).reduce((s, g) => s + g.count, 0);
    const tribute = Math.round(totalPop * vcfg.vassalizeTributeShare * 0.02 / 12);
    state.treasury += tribute;
    vassalTribute += tribute;
  }

  // Alle seit dem letzten Kassenbuch-Fenster einzeln erfassten Transaktionen
  // (Bau/Ausbau, Land-/Warenhandel, Kredite, siehe logLedger()) werden hier
  // mit ausgegeben und danach geleert — so listet das Kassenbuch wirklich
  // alle Ein-/Ausgaben des Monats auf, nicht nur die fünf Sammelposten.
  const otherEntries = state.ledgerLog || [];
  state.ledgerLog = [];

  const report = {
    year: state.year, month: state.month,
    treasuryBefore, treasuryAfter: state.treasury,
    taxIncome, upkeep, salaries, debtInterest, vassalTribute,
    taxBreakdown, otherEntries,
    net: state.treasury - treasuryBefore,
  };
  state.lastMonthlyReport = report;
  return report;
}

// Der primäre, spielergesteuerte Rundenschritt (auf Nutzerwunsch: mehr
// spürbare Schritte innerhalb eines Herrscherlebens). Löst nach dem 12.
// Monat automatisch den bereits bestehenden, unveränderten Jahresschritt
// advanceYear() aus — Ernte/Bevölkerung/Diplomatie/Ereignisse etc. bleiben
// exakt so kalibriert wie zuvor, nur die Staatskasse entwickelt sich jetzt
// zusätzlich monatlich sichtbar.
function advanceMonth(state) {
  const report = applyMonthlyFinances(state);
  state.month += 1;
  let yearCompleted = false;
  if (state.month > 12) {
    state.month = 1;
    advanceYear(state);
    yearCompleted = true;
  }
  return { report, yearCompleted };
}

// ---------- Speichersystem (§64) — JSON Export/Import, kein Browser-Storage ----------
