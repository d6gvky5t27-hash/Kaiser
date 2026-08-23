// ============================================================
// ADVANCE YEAR — der zentrale jährliche Rundenschritt, der alle
// anderen Module orchestriert. Muss nach allen anderen js/*-Dateien
// geladen werden.
// ============================================================

// ---------- advanceYear()-Teilschritte (Phase 2: Technical Stabilization) ----------
// Reines Extract-Method-Refactoring einer zuvor ~123 Zeilen langen
// Einzelfunktion: jeder Block steht unverändert (gleicher Code, gleiche
// Reihenfolge, keine umgestellten Bedingungen/Schleifen) in einer eigenen,
// benannten Funktion. advanceYear() selbst ruft sie danach nur noch in
// exakt der bisherigen Reihenfolge auf — siehe CODE_AUDIT.md Abschnitt 13
// für den zugrundeliegenden Plan.
//
// WICHTIG (RNG-Determinismus, §CODE_AUDIT.md 13.6): rnd() ist ein einziger
// globaler Zufallsstrom. Die Aufrufreihenfolge der rnd()-konsumierenden
// Fachfunktionen innerhalb jedes Teilschritts UND die Reihenfolge der
// Teilschritte zueinander entspricht exakt der vorherigen Zeilenreihenfolge
// in der ehemaligen Monolith-advanceYear(). Beim Ändern dieser Datei niemals
// Anweisungen umsortieren, auch wenn es harmlos aussieht — siehe
// tests/advance_year_snapshot_test.js für den verbindlichen Beweis.

// Berater-/Infrastruktur-/Technologie-Boni auf die Produktion, vor der
// eigentlichen Produktionsberechnung in processAllRegions().
function applyPreProductionBonuses(state) {
  const handelsberaterBonus = advisorEffectBonus(state, "handelsberater");
  const infraProdBonus = state.regions.player.infrastructureLevel * CONFIG.infrastructure.productionBonusPerLevel;
  const handwerkTechBonus = techBonus(state, "handwerk");
  state.regions.player.productionBonus = (state.regions.player._baseProductionBonus || 0) + handelsberaterBonus + infraProdBonus + handwerkTechBonus;
  state.regions.player.getreideTechBonus = techBonus(state, "landwirtschaft");
  generateResearchPoints(state, state.regions.player); // §28
}

// Wetter/Produktion/Kornbilanz/Preise/Zufriedenheit/Bevölkerung/
// Stadtentwicklung für JEDE Region (Spieler und alle KI-Regionen gleich
// behandelt, keine Sonderpfade) — die komplette ehemalige for-in-Schleife,
// unverändert.
function processAllRegions(state) {
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
    checkFamineMemory(state, id, r); // §Punkt 8/38: schwere Hungerkrise als Erinnerung festhalten
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
}

// Landpreis, Regierungsstil, Regionalhandel, Migration, Diplomatie-Update,
// Söldnerdesertion — alles, was nach der Region-Schleife, aber vor den
// Dynastie-/Herrscher-Effekten läuft.
function updateEconomyAndDiplomacy(state) {
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
}

// Geistlicher-Bonus, Legitimitätserholung, Dynastie-Update (Altern/Heirat/
// Geburt/Tod/Erbfolge), Prestige- und Charaktereigenschaften-Effekte.
function applyRulerAndDynastyEffects(state) {
  const r = state.regions.player;

  // Geistlicher hebt die Zufriedenheit — Stärke skaliert mit seiner Ausbaustufe
  if (state.advisors.geistlicher) {
    const geistlicherLevel = state.advisorLevels.geistlicher || 1;
    for (const pid in r.population) r.population[pid].satisfaction = clamp(r.population[pid].satisfaction + CONFIG.advisors.geistlicherSatBonus * geistlicherLevel * 0.5, 0, 100);
  }

  // Legitimität erholt sich langsam, niedrige Legitimität drückt die Zufriedenheit (§45)
  state.legitimacy = clamp(state.legitimacy + CONFIG.succession.legitimacyRecoveryPerYear, 0, 100);
  if (state.legitimacy < CONFIG.succession.legitimacyLowThreshold) {
    for (const pid in r.population) r.population[pid].satisfaction = clamp(r.population[pid].satisfaction - CONFIG.succession.legitimacyLowSatPenalty * 0.3, 0, 100);
  }

  updateDynasty(state);
  // §Character-Core-Punkt 89: EIN Aufruf statt advanceYear() wieder
  // aufzublasen — Beziehungen/Loyalität/Ansprüche/Rivalitäten/Berater-Tod
  // laufen NACH updateDynasty(), damit eine in diesem Jahr eingetretene
  // Erbfolge bereits mit dem neuen Herrscher berücksichtigt wird.
  updateCharacterCore(state);
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
      // handelsberaterBonus wie zuvor: derselbe reine, RNG-freie Wert wie in
      // applyPreProductionBonuses() (kein state-Feld dafür nötig, das Neuberechnen
      // liefert exakt denselben Wert, da sich Berater/Charaktere seit dort nicht
      // geändert haben).
      const handelsberaterBonus = advisorEffectBonus(state, "handelsberater");
      r._baseProductionBonus = (r._baseProductionBonus || 0) + prodBonus;
      r.productionBonus = r._baseProductionBonus + handelsberaterBonus;
    }
  }
}

// Titelaufstieg, Kaiserwahl-Trigger, Aufklärung, Religion, KI-
// Kriegsinitiative, Kriegskarten-Garnisonserholung/-gegenangriff.
function updatePoliticsAndWar(state) {
  const r = state.regions.player;
  checkTitleProgress(state);
  checkElectionTrigger(state);
  updateIntel(state);
  updateReligion(state, r);
  checkAiWarInitiative(state); // §31: KI wägt nicht nur ab, sondern erklärt ggf. tatsächlich Krieg
  reinforceAiTerritories(state); // Kriegskarte: KI-Garnisonen erholen sich langsam
  aiTerritoryCounterAttack(state); // Kriegskarte: eine im Krieg befindliche Region kann zurückschlagen
}

// Alternative Siegbedingungen, Statistik-Höchstwerte, Event-Auswahl,
// Game-Over-Prüfung — der Jahresabschluss.
function finalizeYear(state) {
  const r = state.regions.player;

  // §47 alternative Siegbedingungen prüfen
  checkAlternativeVictory(state);

  // §87 Spielende-Auswertung: laufende Höchstwerte mitschreiben
  const totalPlayerPop = Object.values(r.population).reduce((s,g)=>s+g.count, 0);
  state.stats.maxPopulation = Math.max(state.stats.maxPopulation, totalPlayerPop);
  state.stats.maxTreasury = Math.max(state.stats.maxTreasury, state.treasury);
  state.stats.highestTitleIndex = Math.max(state.stats.highestTitleIndex, state.titleIndex);
  state.stats.maxLand = Math.max(state.stats.maxLand || 0, r.land); // §Phase-7-Punkt 34: für "größtes Territorium"-Meilenstein

  // §Phase-6-Punkt 41: aktive Chains IMMER zuerst fortschreiben (kann neue
  // Memories/Thread-Signale erzeugen), DANN Story Threads mit dem
  // aktualisierten Weltzustand fortschreiben/entdecken (js/story-threads.js),
  // DANN der Drama Director seine Tension/Pacing/Fokus-Bewertung
  // aktualisieren (js/drama-director.js, reiner Kurator, erfindet nichts),
  // ERST DANN darf höchstens eine neue Chain starten — jetzt Director-
  // priorisiert statt fester Reihenfolge (§Punkt 42: Eligibility bleibt
  // dabei unverändert die einzige Wahrheit). Alles VOR den gewöhnlichen
  // Flavour-Events, damit eine bedeutsame Chain-Entscheidung Vorrang vor
  // einem beliebigen Wetter-/Kleinevent hat (§Punkt 39/40 aus Phase 5).
  advanceActiveEventChains(state);
  updateStoryThreads(state);
  updateDramaDirector(state);
  startNewEventChainIfEligible(state);

  // Event auswerten: erstes zutreffendes Event der Spielerregion (nur,
  // wenn nicht bereits eine Event-Chain-Entscheidung das Fenster belegt)
  if (!state.pendingEvent) {
    for (const ev of EVENTS) {
      if (ev.condition(r, state) && rnd() < 0.6) {
        state.pendingEvent = ev;
        state.pendingEvent.source = state.pendingEvent.source || "RANDOM";
        if (["seuche", "rebellion", "brand_in_der_stadt"].includes(ev.id)) state.stats.disastersCount++;
        break;
      }
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
}

function advanceYear(state) {
  state.year += 1;
  state.pendingEvent = null;

  applyPreProductionBonuses(state);
  processAllRegions(state);
  updateEconomyAndDiplomacy(state);
  applyRulerAndDynastyEffects(state);
  updatePoliticsAndWar(state);
  finalizeYear(state);

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

  // Gehalt pro Amt skaliert mit der Ausbaustufe (ein Stufe-3-Berater kostet 3× so viel)
  let advisorSalaryUnits = 0;
  for (const role in state.advisors) {
    if (state.advisors[role]) advisorSalaryUnits += state.advisorLevels[role] || 1;
  }
  const salaries = Math.round(advisorSalaryUnits * CONFIG.advisors.yearlySalary / 12);
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
