// ============================================================
// DATENSCHICHT — bewusst getrennt von der Spiellogik (§65 Modding)
// ============================================================

// ---------- Balancing-Konfiguration (§71: keine Magic Numbers im Code) ----------
const CONFIG = {
  economy: {
    demandElasticity: 0.6,   // wie stark Angebot/Nachfrage-Ungleichgewicht auf Preise wirkt
    priceMin: 0.4,           // Preis-Untergrenze relativ zum Basispreis
    priceMax: 3.0,           // Preis-Obergrenze relativ zum Basispreis
    productionScale: 0.01,   // Skalierungsfaktor Arbeiter -> Produktionsmenge
    // Marktspekulation: Preise schwanken jedes Jahr zusätzlich zu Angebot/Nachfrage
    // etwas hin und her — wie auf einem echten Markt, nicht nur mechanisch berechnet.
    priceNoiseReversion: 0.12,   // wie schnell die Spekulation zur Mitte (1.0) zurückkehrt
    priceNoiseShock: 0.10,       // Stärke der zufälligen Schwankung pro Jahr
    priceNoiseMin: 0.75, priceNoiseMax: 1.35, // Bandbreite der Spekulationskomponente
  },
  agriculture: {
    weather: {
      duerreChance: 0.08,       duerreFactor: 0.5,
      starkregenChance: 0.08,   starkregenFactor: 0.7,   // kumulativ 0.16
      frostChance: 0.06,        frostFactor: 0.75,        // kumulativ 0.22
      gutesJahrChance: 0.10,    gutesJahrFactor: 1.35,    // kumulativ 0.32
    },
    // Kornlagerung (Korrektur einer Fehlkalibrierung): ohne Schwund/Kapazitätsgrenze
    // sammelte sich überschüssiges Getreide unbegrenzt über Jahrzehnte an, da der
    // Verbrauch stets exakt auf den Grundbedarf gedeckelt ist (siehe
    // consumeAndUpdateSatisfaction) — das trieb das angezeigte Verhältnis
    // (grainRatio) auf unrealistische Werte (teils >1000%). Jetzt begrenzt eine
    // Lagerkapazität samt Schwund den Bestand auf ein plausibles Maß, und der
    // bisher ungenutzte Kornspeicher-Gebäudetyp (§26) bekommt dadurch einen
    // echten Zweck: mehr/höherstufige Kornspeicher erlauben eine größere,
    // verlustarme Reserve.
    grainStorageCapNeedMultiplier: 4.0, // ohne Kornspeicher: ca. 4 Jahresbedarfe verlustarm lagerbar (großzügiger Puffer dämpft Jahr-zu-Jahr-Schwankungen)
    grainStartBufferMultiplier: 1.3,    // Startbestand des Spielers: ca. 1,3 Jahresbedarfe (gesunde Reserve, kein Vielfaches)
    // grainSpoilageWithinCapRate bewusst klein: ein konstanter jährlicher Schwund
    // selbst bei ausreichender Lagerkapazität erzwingt bei JEDER Region Dauer-
    // Überschussproduktion nur um den Bestand zu halten — das begünstigt über
    // 100 Spieljahre kumulativ Regionen mit leicht höherer Fruchtbarkeit
    // (Schritt-13-Lehre: kleine, aber konstante Effekte potenzieren sich über
    // viele Jahre). Ein kleiner Wert reicht für den realistischen Effekt, ohne
    // KI-Regionen unangemessen unterschiedlich zu bestrafen (siehe KI-gegen-
    // KI-Testsuite, §78).
    grainSpoilageWithinCapRate: 0.03,   // milder Schwund selbst bei ordentlicher Lagerung
    grainSpoilageAboveCapRate: 0.5,     // Getreide über der Lagerkapazität verdirbt größtenteils (Ungeziefer/Fäulnis)
  },
  population: {
    baseBirthRate: 0.018,
    baseDeathRate: 0.012,
    satisfactionBirthSwing: 0.01,
    satisfactionDeathSwing: 0.006,
    hungerThreshold: 20,       // Zufriedenheit unter diesem Wert -> Hungertote
    hungerDeathRate: 0.02,
    plagueMitigatedDeathRate: 0.01,
    plagueUnmitigatedDeathRate: 0.03,
    needShortfallSatPenalty: 20,   // Zufriedenheitsverlust bei 100% Mangel einer Ware
    satisfactionSmoothing: 0.3,    // Trägheit der Zufriedenheitsänderung pro Jahr
    taxSatisfactionPenalty: 40,    // Zufriedenheitsverlust bei taxRate=1.0
    satisfactionBaseline: 50,      // Homöostase-Zielwert
    homeostasisStrength: 0.2,      // wie stark Zufriedenheit zur Mitte zurückgezogen wird
    // Direkter Korn-Effekt auf Geburten-/Sterberate (zusätzlich zum bereits
    // bestehenden, zufriedenheitsvermittelten Effekt — Getreide ist über
    // POP_GROUPS.needs.getreide bereits Teil der Zufriedenheitsformel, dieser
    // Bonus/Malus macht den Zusammenhang aber direkt sicht- und spürbar).
    // grainRatio = verfügbares Getreide / Grundbedarf, siehe computeGrainBalance().
    // Bewusst moderat kalibriert, um keinen zweiten Bevölkerungskollaps-Pfad
    // neben dem bereits bestehenden satisfaction-basierten zu öffnen.
    // Seit die Kornbilanz durch Lagerkapazität/Schwund (CONFIG.agriculture) real
    // schwankt statt praktisch immer gesättigt (>>200%) zu sein, wirkt dieser
    // Effekt jetzt auch tatsächlich unterscheidend zwischen Regionen (vorher de
    // facto ein für alle gleicher Dauerbonus). Über 100 Spieljahre kann selbst
    // ein kleiner, aber konsistenter Zinsvorteil exponentiell explodieren
    // (Schritt-13-Lehre) — daher hier bewusst halbiert gegenüber dem alten Wert.
    grainBirthBonusMax: 0.003,  // zusätzliche Geburtenrate bei grainRatio >= 2.0 (doppelter Bedarf gedeckt)
    grainFamineThreshold: 0.15, // unterhalb dieses Verhältnisses gilt es als echte Hungersnot
    grainDeathBonusMax: 0.015,  // zusätzliche Sterberate bei grainRatio = 0 (kein Getreide mehr vorhanden)
  },
  trade: {
    perCapitaDiffThreshold: 0.05,
    transferShare: 0.15,
    transferCap: 200,
  },
  ai: {
    buildChance: 0.3,
    buildWealthThreshold: 600,
  },
  dynasty: {
    marriageMinAge: 16, marriageMaxAge: 45, marriageChance: 0.18,
    birthMinAge: 16, birthMaxAge: 45, birthChance: 0.22,
    healthDecayBaseAge: 55, healthDecayPerYear: 0.6,
    deathBaseChance: 0.002, deathAgeFactor: 0.004, deathAgeThreshold: 50,
    deathLowHealthThreshold: 30, deathLowHealthBonus: 0.05,
  },
  diplomacy: {
    startRelation: 30,
    yearlyDriftToward: 0,       // Beziehungen driften langsam zu diesem Wert
    yearlyDriftStrength: 0.04,
    treatyYearlyBonus: 1.5,     // bestehende Verträge verbessern Beziehung leicht pro Jahr
    randomNoise: 3,
    giftCost: 200, giftRelationGain: 15,
    nonAggressionMinRelation: 20, nonAggressionRelationGain: 5,
    tradeTreatyMinRelation: 10, tradeTreatyRelationGain: 5,
    allianceMinRelation: 50, allianceRelationGain: 10, alliancePrestigeGain: 10,
    tradeTreatyTransferBonus: 2.0,  // Multiplikator auf Transfermenge bei Handelsvertrag
    aiInitiativeChance: 0.10,       // Chance/Jahr, dass eine KI-Region selbst einen Vertrag anbietet
    aiGiftChance: 0.06, aiGiftRelationGain: 8,
  },
  state: {
    // Kalibrierungsfund (Nutzer-Feedback: "Steuereinnahmen kommen mir sehr wenig
    // vor"): der alte Wert (0.02) behandelte außerdem jede Bevölkerungsgruppe
    // gleich — inzwischen fließt POP_GROUPS[pid].weight (bislang ungenutztes
    // Datenfeld) als Wohlstands-/Steuerkraft-Gewicht ein (Adel zahlt anteilig
    // mehr als Arme/Tagelöhner). Neu kalibriert, damit eine Startregion (~2.400
    // Einwohner, 15% Steuersatz) auf ca. 90-100 Taler/Monat kommt — genug, um
    // einen kleinen Hofstaat/Garnison tatsächlich zu tragen, statt wie zuvor
    // nur ~1 Taler/Monat einzunehmen.
    treasuryTaxWealthFactor: 3.0,
    passivePrestigePerYear: 1,
    defeatPopThreshold: 200,
    bankruptTreasuryThreshold: -3000,
  },
  buildings: {
    plotsPerRegion: 12,
    maxLevel: 4,
    upgradeCostMultiplier: 1.6, // Kosten der nächsten Stufe = cost * multiplier^aktuelleStufe
  },
  succession: {
    disputeAgeClosenessYears: 5,   // Erben mit Altersabstand darunter erhöhen Streitrisiko
    disputeBaseChance: 0.15,
    disputeCloseBonus: 0.35,
    disputeSatPenalty: 15,
    disputeTreasuryCost: 300,
    disputePrestigePenalty: 10,
    legitimacyStart: 70,
    legitimacyDisputeLoss: 30,
    legitimacyRecoveryPerYear: 2,
    legitimacyLowThreshold: 40,
    legitimacyLowSatPenalty: 5,
  },
  military: {
    recruitPopCostPerUnit: 4,       // Bauern/Adel, die pro rekrutierter Einheit aus der Bevölkerung gezogen werden
    upkeepDeductedFromTreasury: true,
    aiStrengthPopFactor: 0.0025,
    aiStrengthRandomSpread: 0.4,    // ±40% Streuung auf die geschätzte Gegnerstärke
    lootShareOnWin: 0.15,
    warRelationCrash: -60,
    breakPactPrestigePenalty: 15,
    victoryPrestigeGain: 20,
    defeatPrestigeLoss: 15,
    winTroopLossShare: 0.10,
    loseTroopLossShare: 0.35,
    loseSatisfactionPenalty: 8,
    // Landgewinn nach Schlachtsieg (§29/§36 ergänzt um eine direkte
    // Eroberungs-Option neben der rein diplomatischen Gebietsforderung)
    warConquestHectares: 300,
    warConquestMinDefenderLand: 1000, // die KI-Region darf nie unter dieses Minimum fallen
    // Söldner (§33/§34): unzuverlässig, keine Lehenstreue — desertieren eher
    soeldnerDesertionBaseChance: 0.03,
    soeldnerDesertionUnpaidChance: 0.5, // wenn die Staatskasse den Sold nicht mehr deckt
    soeldnerDesertionLowLegitimacyBonus: 0.15,
    // §31: die KI wägt jetzt nicht nur ab (evaluateAiWarDecision in debug.js),
    // sondern erklärt bei genug Übergewicht auch tatsächlich selbst Krieg —
    // gleiche Schwelle (25) wie die bisherige reine Analysefunktion, damit
    // "würde angreifen" im Debug-Panel und echtes Verhalten übereinstimmen.
    aiWarThreshold: 25,
    aiWarInitiativeChance: 0.35, // nicht jede günstige Gelegenheit wird sofort genutzt
    aiWarCooldownYears: 6,       // nach einer Kriegserklärung erst mal Ruhe, unabhängig vom Ausgang
    aiWarGraceYears: 3,          // keine KI-Kriegserklärungen in den ersten Jahren einer Partie
    aiWarStrengthFloor: 15,      // Mindestnenner bei der Stärkevergleichs-Faktor-Berechnung, verhindert
                                  // eine rechnerische Explosion, solange der Spieler noch gar kein Heer hat
    aiWarMaxRelationForAggression: 20, // ab dieser Beziehung braucht es eine echte Rechtfertigung (schlechte
                                  // Beziehung), nicht nur militärische Schwäche — reine Wirtschafts-Erststrategien
                                  // bleiben so sicher, solange die Beziehung gepflegt wird (Geschenke etc.)
  },
  advisors: {
    hireCost: 150,
    yearlySalary: 40,
    schatzmeisterMaxBonus: 0.20,    // Steuereinnahmen bis zu +20 % je nach Verwaltungswert
    marschallStrengthDivisor: 8,    // Militärstärkebonus = Marschall-Militärwert / diesem Wert
    diplomatRelationBonusDivisor: 12, // zusätzlicher Beziehungsgewinn = Diplomatiewert / diesem Wert
    handelsberaterProductionDivisor: 60, // Produktionsbonus = Handelswert / diesem Wert
    geistlicherSatBonus: 3,
  },
  election: {
    triggerChancePerYear: 0.25,
    cooldownYearsAfterLoss: 8,
    knownElectorVoteRelationThreshold: 40,
    bribeCost: 400,
    bribeRelationGain: 20,
    abstractVotePrestigeThresholds: [150, 250, 350, 450], // 4 weitere, nicht direkt beeinflussbare Kurfürsten
    votesNeededForMajority: 4, // von insgesamt 7 Stimmen (3 bekannte + 4 abstrakte)
    lossPrestigePenalty: 10,
    lossRelationPenalty: -10,
  },
  intrigue: {
    sabotageCost: 250,
    sabotageDiscoveryChance: 0.35,
    sabotageRelationPenaltyOnDiscovery: -25,
    sabotageWarehouseLossShare: 0.3,
    spyMissionCost: 150,
    spyAccuracyGain: 0.35,
    spyAccuracyDecayPerYear: 0.08,
    baseIntelAccuracy: 0.25,
    // §32: zwei weitere Intrigen-Arten neben Sabotage
    rumorCost: 100,
    rumorDiscoveryChance: 0.20,
    rumorRelationPenaltyOnDiscovery: -10,
    rumorSatisfactionDamage: 12,          // trifft Adel & Bürger der Zielregion (Hof-Klatsch)
    extortionCost: 200,
    extortionBaseSuccessChance: 0.3,
    extortionIntelAccuracyBonus: 0.5,     // gute Aufklärung (Spionage) erhöht die Erfolgschance deutlich
    extortionAmount: 350,
    extortionRelationPenaltyAlways: -15,  // Erpressung schadet der Beziehung so oder so
    extortionFailExtraRelationPenalty: -20,
    // §32: die restlichen vier Intrigen-Arten aus der Spec
    conspiracyCost: 500,
    conspiracySuccessChance: 0.4,
    conspiracyDiscoveryRelationPenalty: -35,
    conspiracyDiscoveryPrestigePenalty: 15, // bei Aufdeckung wird der Spieler selbst bloßgestellt
    forgeryCost: 300,
    forgerySuccessChance: 0.55,
    forgeryLegitimacyGain: 8,
    forgeryFailLegitimacyLoss: 12,
    forgeryFailPrestigeLoss: 10,
    rebelSupportCost: 350,
    rebelSupportDiscoveryChance: 0.45,
    rebelSupportSatisfactionDamage: 22,      // trifft gezielt Arme & Tagelöhner (Aufwiegelung)
    rebelSupportPopLossShare: 0.03,          // kleiner, dauerhafter Bevölkerungsverlust durch Unruhen
    rebelSupportDiscoveryRelationPenalty: -45, // fast kriegsähnliche Konsequenz bei Aufdeckung
    manipulationCost: 200,
    manipulationSatisfactionDamage: 6,       // trifft alle Bevölkerungsgruppen leicht (Verwaltungschaos)
    manipulationDisruptionYears: 4,          // Jahre, in denen die Region seltener baut (aiRegionDevelops)
    manipulationDiscoveryChance: 0.25,
    manipulationDiscoveryRelationPenalty: -15,
  },
  religion: {
    startInfluence: 55,
    lowInfluenceThreshold: 30,
    lowInfluenceSatPenalty: 4,
    highInfluenceSatBonus: 3,
    highInfluenceThreshold: 75,
  },
  rebellion: {
    satisfactionThreshold: 25,
    legitimacyThreshold: 35,
    baseChance: 0.35,
  },
  difficulty: {
    // §48: Schwierigkeit NICHT über heimliche KI-Ressourcenboni, sondern über
    // KI-Fehlerquote / Planungshorizont / Informationsstand des Spielers
    leicht:   { aiMistakeChance: 0.35, aiBuildChanceMultiplier: 0.8,  intelAccuracyBonus: 0.15, startTreasuryMultiplier: 1.3 },
    normal:   { aiMistakeChance: 0.15, aiBuildChanceMultiplier: 1.0,  intelAccuracyBonus: 0,    startTreasuryMultiplier: 1.0 },
    schwer:   { aiMistakeChance: 0.05, aiBuildChanceMultiplier: 1.25, intelAccuracyBonus: -0.05, startTreasuryMultiplier: 0.85 },
    experte:  { aiMistakeChance: 0.0,  aiBuildChanceMultiplier: 1.5,  intelAccuracyBonus: -0.15, startTreasuryMultiplier: 0.7 },
  },
  // Leichte Szenario-Anpassung bei der Charaktererstellung (§103-Ansatz: kein
  // vollständiger Szenarioeditor mit eigenem Kartenlayout, aber echte,
  // spürbare Ausgangsbedingungen statt nur eines fixen Standardstarts) —
  // wirkt zusätzlich zum Schwierigkeitsgrad, nicht anstelle davon.
  scenario: {
    capital: {
      arm:    { treasuryMultiplier: 0.4 },
      normal: { treasuryMultiplier: 1.0 },
      reich:  { treasuryMultiplier: 2.2 },
    },
    stance: {
      freundlich: { relationOffset: 30 },
      neutral:    { relationOffset: 0 },
      angespannt: { relationOffset: -35 },
    },
  },
  // §25: Stadtentwicklung — Stufen von Weiler bis Kaiserstadt, abhängig von
  // Bevölkerung, Wohlstand und Infrastruktur (nicht nur einem einzelnen Wert)
  settlement: {
    tiers: [
      { name: "Weiler",     reqPop: 0,     reqInfra: 0 },
      { name: "Dorf",       reqPop: 1500,  reqInfra: 0 },
      { name: "Marktort",   reqPop: 3500,  reqInfra: 1 },
      { name: "Kleinstadt", reqPop: 7000,  reqInfra: 2 },
      { name: "Stadt",      reqPop: 13000, reqInfra: 3 },
      { name: "Großstadt",  reqPop: 22000, reqInfra: 4 },
      { name: "Metropole",  reqPop: 35000, reqInfra: 5 },
      { name: "Kaiserstadt",reqPop: 55000, reqInfra: 6 },
    ],
    tierSatisfactionBonusPerLevel: 1.0, // höhere Stufen erleichtern das Leben leicht (Infrastruktur/Sicherheit)
  },
  // §27: Infrastruktur — Straßen/Brücken vereinfacht als ein Ausbaulevel,
  // senkt Transportverluste beim Handel und unterstützt die Stadtentwicklung
  infrastructure: {
    maxLevel: 6,
    baseCost: 300,
    costMultiplierPerLevel: 1.5,
    materialCostPerLevel: { stein: 20, holz: 15 },
    tradeBonusPerLevel: 0.08,       // zusätzlicher Handelsvolumen-Bonus pro Stufe
    productionBonusPerLevel: 0.02,  // leichter Produktionsbonus (bessere Wege zu den Feldern)
  },
  // §Original-Vorbild "Kaiser" (C64, 1984): Land ist eine kauf-/verkaufbare,
  // preislich schwankende Ressource — mehr Land schafft mehr Baukapazität.
  land: {
    startHectares: 10000,       // Anfangsbestand wie im Original
    hectaresPerPlot: 800,       // Land, das eine Baugrundstücks-Parzelle "verbraucht"
    priceMin: 16, priceMax: 70, // Preisspanne wie im Original
    priceDriftStrength: 0.2,
    saleCommission: 0.10,       // 10 % Provision beim Verkauf, wie im Original
  },
  // §20/§21/§73: Marktplatz — Spieler kann Waren direkt kaufen/verkaufen,
  // nicht nur über die automatische Handels-KI zwischen Regionen. Reine
  // Geld<->Lager-Transaktion zum aktuellen Regionalpreis; der Preis selbst
  // reagiert danach ganz normal übers bestehende Angebot/Nachfrage-System,
  // weil sich der Lagerbestand verändert hat — kein separates Preismodell nötig.
  market: {
    buyMarkupShare: 0.08,       // Aufschlag beim Kauf
    sellCommissionShare: 0.08,  // Provision beim Verkauf
  },
  // §20/§21: Regionalhandel — echte Arbitrage zwischen zwei konkreten Regionen
  // statt nur dem eigenen lokalen Markt (Beispiel aus der Spec: Getreide in
  // Köln 45 / Mainz 62 / München 98 — Preisunterschiede gezielt ausnutzen).
  // Transportkosten sind höher als beim lokalen Markt, dazu ein Räuberrisiko
  // (§20 "Gefahren: Räuber, Piraten, Krieg, schlechte Straßen, Wetter, Zölle").
  interregionalTrade: {
    transportCostShare: 0.12,
    banditRiskChance: 0.06,
    banditLossShare: 0.35,
  },
  // Kornverteilung über den Eigenbedarf hinaus — hebt Zufriedenheit und lockt
  // Zuwanderer an, kostet aber Getreide (Original-Tipp: "mehr als nötig" verteilen)
  grainDistribution: {
    maxExtraPerCapita: 0.3,
    satisfactionBonusFactor: 12,
    migrationBonusFactor: 0.015,
  },
  // Regierungsstil "Sehr fair" bis "Gierig" — zusätzlicher Hebel neben der Steuer
  governance: {
    incomeFactorAtGreedy: 0.03,      // Zusatzeinnahmen pro Bevölkerungseinheit bei Regler=100
    satisfactionPenaltyAtGreedy: 8,  // Zufriedenheitsverlust bei Regler=100
    legitimacyPenaltyAtGreedy: 1.5,  // Legitimitätsverlust/Jahr bei Regler=100
  },
  // §Original: vor einer Kriegserklärung werden die übrigen Herrscher gefragt,
  // ob sie unterstützen, den Gegner unterstützen, Durchmarsch gewähren oder neutral bleiben
  warAllies: {
    supportThreshold: 40,     // ab dieser Beziehung steigt die Unterstützungschance deutlich
    baseSupportChance: 0.15,
    baseOpposeChance: 0.08,
    strengthContribution: 0.35, // wie viel der Stärke eines Unterstützers einfließt
  },
  // §36: Belagerungen — verteidigt eine Stadtmauer, zieht sich der Krieg über
  // mehrere Jahre statt sich sofort aufzulösen (§35 Formationen bleiben davon unberührt)
  siege: {
    durationPerWallLevel: 1,     // Jahre Belagerungsdauer je Stadtmauer-Stufe
    maxDuration: 6,
    stormCasualtyMultiplier: 1.6,  // höheres Verlustrisiko bei Sturmangriff
    starveStrengthDrainPerYear: 0.08, // Aushungern schwächt den Verteidiger/Jahr
    starveUpkeepShare: 0.5,       // Belagerungsheer kostet weiterhin (reduzierten) Unterhalt
    bribeCost: 500,
    bribeSuccessChance: 0.35,
    bribeRelationPenalty: -20,
  },
  // §14 Migration: Zufriedenheit lockt Zuwanderer an bzw. vertreibt Bevölkerung
  migration: {
    factor: 0.0004, // (Zufriedenheit-50) * factor * Bevölkerung = Netto-Wanderungssaldo/Jahr
    interRegionalShare: 0.6, // Anteil der Auswanderer, der tatsächlich in eine attraktivere Nachbarregion zieht (§14) statt zur Außenwelt
  },
  // §28: Technologiesystem — Forschungspunkte aus Universität + Gelehrten-nahen
  // Gruppen, investierbar in 5 Kategorien mit spürbarem, aber moderatem Bonus
  technology: {
    categories: {
      landwirtschaft: { name: "Landwirtschaft", bonusPerLevel: 0.05, appliesTo: "getreide_production" },
      handwerk:       { name: "Handwerk",       bonusPerLevel: 0.05, appliesTo: "production" },
      militaer:       { name: "Militär",        bonusPerLevel: 0.05, appliesTo: "army_strength" },
      verwaltung:     { name: "Verwaltung",     bonusPerLevel: 0.05, appliesTo: "tax_income" },
      handel:         { name: "Handel",         bonusPerLevel: 0.05, appliesTo: "trade_volume" },
    },
    maxLevel: 5,
    pointsPerLevel: 120,          // Kosten für die nächste Stufe = pointsPerLevel * (aktuelleStufe+1)
    basePointsPerYear: 2,
    pointsPerUniversityLevel: 8,
  },
  // §47: mehrere Siegbedingungen statt nur "Kaiser werden"
  victoryConditions: {
    kaiser: { name: "Kaiser werden", desc: "Klassischer Weg: Kaiserwahl gewinnen (§12)." },
    reichtum: { name: "Reichste Dynastie", desc: "Erreiche 80.000 Taler Staatskasse und halte sie 5 Jahre.", treasuryTarget: 80000, sustainYears: 5 },
    handelsmacht: { name: "Größte Handelsmacht", desc: "Erreiche einen Gesamtlagerwert von 15.000 Talern und halte ihn 5 Jahre.", warehouseValueTarget: 15000, sustainYears: 5 },
    militaer: { name: "Militärische Dominanz", desc: "Besiege alle 3 Nachbarn im Krieg (kumulativ, auch über mehrere Kriege verteilt).", warsToWinAgainstEach: 1 },
    endlos: { name: "Endlosmodus", desc: "Kein Sieg-Ziel — spiele frei weiter." },
  },
  // §24: Staatsschulden — Kredite mit Zins, Bankrott bleibt die harte Grenze
  debt: {
    baseInterestRate: 0.08,
    prestigeInterestReduction: 0.00004, // je Prestigepunkt sinkt der Zins etwas
    legitimacyInterestReduction: 0.0003,
    minInterestRate: 0.03,
    maxInterestRate: 0.25,
    maxLoanRelativeToTreasuryDeficit: 5000,
  },
  // §29: erweiterte Diplomatie-Aktionen
  diplomacyExtra: {
    vassalizeMinRelation: 70,
    vassalizeTributeShare: 0.08, // Anteil der KI-"Wirtschaftskraft", der jährlich als Tribut fließt
    demandTributeCost: 0,
    demandTributeMinRelation: -20,
    demandTributeSuccessChance: 0.5,
    demandTributeAmount: 400,
    demandTributeFailRelationPenalty: -15,
    dynasticMarriageMinRelation: 30,
    dynasticMarriageRelationFloorBonus: 20,
    dynasticMarriageCost: 300,
    hostageExchangeCost: 150,
    hostageExchangeRelationGain: 12,
    // Durchmarschrecht: sichere, günstigere Handelsrouten durch die Region
    transitRightsMinRelation: 25,
    transitRightsCost: 150,
    transitRightsTransportDiscount: 0.5, // halbiert die Transportkosten mit dieser Region
    transitRightsBanditRiskDiscount: 0.5, // halbiert das Räuberrisiko
    // Garantie: dauerhafte Beziehungs-Untergrenze, günstiger als eine dynastische Ehe
    guaranteeMinRelation: 10,
    guaranteeCost: 200,
    guaranteeFloorBonus: 10,
    // Friedensvertrag: großer einmaliger Beziehungssprung, kostet mehr bei sehr schlechten Beziehungen
    peaceTreatyBaseCost: 300,
    peaceTreatyRelationGain: 35,
    // Gebietsforderungen: Land von einer Region abtreten lassen (nur bei militärischer Überlegenheit aussichtsreich)
    demandTerritoryMinRelation: -40,
    demandTerritoryHectares: 500,
    demandTerritoryFailRelationPenalty: -20,
  },
};

// §65/§79: die reinen Datentabellen (GOODS bis TITLES weiter unten) werden ab
// hier aus data/json/*.json erzeugt (Quelle der Wahrheit fürs Modden) — siehe
// tools/data-sync.js. Einzelheiten, die als JSON keine Inline-Kommentare
// tragen können: gewuerze & seide sind bewusst reine Importluxusgüter ohne
// heimische Produktionskette; buecher (Holz->Papier->Buecher) und mehl/brot
// (Getreide->Mehl->Brot) sind die beiden zweistufigen Produktionsketten.
const GOODS = {
  "getreide": {
    "name": "Getreide",
    "base": 10,
    "category": "grundnahrung"
  },
  "gemuese": {
    "name": "Gemüse",
    "base": 7,
    "category": "grundnahrung"
  },
  "fleisch": {
    "name": "Fleisch",
    "base": 16,
    "category": "grundnahrung"
  },
  "fisch": {
    "name": "Fisch",
    "base": 11,
    "category": "grundnahrung"
  },
  "salz": {
    "name": "Salz",
    "base": 20,
    "category": "grundnahrung"
  },
  "holz": {
    "name": "Holz",
    "base": 6,
    "category": "rohstoff"
  },
  "stein": {
    "name": "Stein",
    "base": 8,
    "category": "rohstoff"
  },
  "ton": {
    "name": "Ton",
    "base": 7,
    "category": "rohstoff"
  },
  "eisen": {
    "name": "Eisen",
    "base": 18,
    "category": "rohstoff"
  },
  "kohle": {
    "name": "Kohle",
    "base": 9,
    "category": "rohstoff"
  },
  "wolle": {
    "name": "Wolle",
    "base": 12,
    "category": "rohstoff"
  },
  "leder": {
    "name": "Leder",
    "base": 14,
    "category": "rohstoff"
  },
  "bier": {
    "name": "Bier",
    "base": 8,
    "category": "verarbeitet"
  },
  "wein": {
    "name": "Wein",
    "base": 22,
    "category": "verarbeitet"
  },
  "werkzeuge": {
    "name": "Werkzeuge",
    "base": 25,
    "category": "verarbeitet"
  },
  "waffen": {
    "name": "Waffen",
    "base": 45,
    "category": "verarbeitet"
  },
  "kleidung": {
    "name": "Kleidung",
    "base": 30,
    "category": "verarbeitet"
  },
  "gewuerze": {
    "name": "Gewürze",
    "base": 60,
    "category": "luxus"
  },
  "seide": {
    "name": "Seide",
    "base": 70,
    "category": "luxus"
  },
  "papier": {
    "name": "Papier",
    "base": 12,
    "category": "verarbeitet"
  },
  "buecher": {
    "name": "Bücher",
    "base": 35,
    "category": "luxus"
  },
  "schmuck": {
    "name": "Schmuck",
    "base": 85,
    "category": "luxus"
  },
  "glaswaren": {
    "name": "Glaswaren",
    "base": 32,
    "category": "luxus"
  },
  "mehl": {
    "name": "Mehl",
    "base": 13,
    "category": "verarbeitet"
  },
  "brot": {
    "name": "Brot",
    "base": 18,
    "category": "verarbeitet"
  }
};

// Produktionsketten: Input-Ware -> Output-Ware, Verhältnis, benötigtes Gebäude,
// Bevölkerungsgruppe, die die Arbeitskraft stellt (workerGroup)
const PRODUCTION_CHAINS = [
  {
    "input": null,
    "output": "getreide",
    "ratioPerWorker": 1,
    "building": null,
    "workerGroup": "bauern"
  },
  {
    "input": null,
    "output": "gemuese",
    "ratioPerWorker": 0.5,
    "building": "gemuesegarten",
    "workerGroup": "landarbeiter"
  },
  {
    "input": null,
    "output": "fleisch",
    "ratioPerWorker": 0.35,
    "building": "viehweide",
    "workerGroup": "landarbeiter"
  },
  {
    "input": null,
    "output": "wolle",
    "ratioPerWorker": 0.4,
    "building": "viehweide",
    "workerGroup": "landarbeiter"
  },
  {
    "input": null,
    "output": "fisch",
    "ratioPerWorker": 0.4,
    "building": "fischerteich",
    "workerGroup": "landarbeiter"
  },
  {
    "input": null,
    "output": "wein",
    "ratioPerWorker": 0.3,
    "building": "weingut",
    "workerGroup": "landarbeiter"
  },
  {
    "input": null,
    "output": "holz",
    "ratioPerWorker": 0.6,
    "building": "saegewerk",
    "workerGroup": "handwerker"
  },
  {
    "input": null,
    "output": "stein",
    "ratioPerWorker": 0.4,
    "building": "steinbruch",
    "workerGroup": "handwerker"
  },
  {
    "input": null,
    "output": "ton",
    "ratioPerWorker": 0.4,
    "building": "tongrube",
    "workerGroup": "handwerker"
  },
  {
    "input": null,
    "output": "eisen",
    "ratioPerWorker": 0.3,
    "building": "schmiede",
    "workerGroup": "handwerker"
  },
  {
    "input": null,
    "output": "kohle",
    "ratioPerWorker": 0.35,
    "building": "kohlebergwerk",
    "workerGroup": "handwerker"
  },
  {
    "input": null,
    "output": "leder",
    "ratioPerWorker": 0.3,
    "building": "gerberei",
    "workerGroup": "handwerker"
  },
  {
    "input": null,
    "output": "salz",
    "ratioPerWorker": 0.25,
    "building": "salzsiederei",
    "workerGroup": "handwerker"
  },
  {
    "input": "getreide",
    "output": "bier",
    "ratioPerWorker": 0.4,
    "building": "brauerei",
    "workerGroup": "handwerker"
  },
  {
    "input": "eisen",
    "output": "werkzeuge",
    "ratioPerWorker": 0.3,
    "building": "schmiede",
    "workerGroup": "handwerker"
  },
  {
    "input": "eisen",
    "output": "waffen",
    "ratioPerWorker": 0.2,
    "building": "waffenschmiede",
    "workerGroup": "handwerker"
  },
  {
    "input": "wolle",
    "output": "kleidung",
    "ratioPerWorker": 0.3,
    "building": "weberei",
    "workerGroup": "handwerker"
  },
  {
    "input": "holz",
    "output": "papier",
    "ratioPerWorker": 0.4,
    "building": "papiermuehle",
    "workerGroup": "handwerker"
  },
  {
    "input": "papier",
    "output": "buecher",
    "ratioPerWorker": 0.15,
    "building": "buchbinderei",
    "workerGroup": "geistliche"
  },
  {
    "input": "eisen",
    "output": "schmuck",
    "ratioPerWorker": 0.1,
    "building": "goldschmiede",
    "workerGroup": "handwerker"
  },
  {
    "input": "stein",
    "output": "glaswaren",
    "ratioPerWorker": 0.2,
    "building": "glasblaeserei",
    "workerGroup": "handwerker"
  },
  {
    "input": "getreide",
    "output": "mehl",
    "ratioPerWorker": 0.5,
    "building": "kornmuehle",
    "workerGroup": "handwerker"
  },
  {
    "input": "mehl",
    "output": "brot",
    "ratioPerWorker": 0.35,
    "building": "baeckerei",
    "workerGroup": "handwerker"
  }
];

// materialCost (§26: Bauwerke aus echten mittelalterlichen Rohstoffen — Holz, Stein,
// Ton, Eisen — statt nur Geld; verknüpft Wirtschaft und Bautätigkeit spürbar, §3)
const BUILDINGS = {
  "bauernhof": {
    "name": "Bauernhof",
    "icon": "BH",
    "cost": 200,
    "effect": "getreide_boost",
    "value": 0.15,
    "materialCost": {
      "holz": 20
    }
  },
  "gemuesegarten": {
    "name": "Gemüsegarten",
    "icon": "GG",
    "cost": 150,
    "effect": "enables",
    "value": "gemuese",
    "materialCost": {
      "holz": 10
    }
  },
  "viehweide": {
    "name": "Viehweide",
    "icon": "VW",
    "cost": 180,
    "effect": "enables",
    "value": "fleisch",
    "materialCost": {
      "holz": 15
    }
  },
  "fischerteich": {
    "name": "Fischerteich",
    "icon": "FT",
    "cost": 170,
    "effect": "enables",
    "value": "fisch",
    "materialCost": {
      "holz": 12
    }
  },
  "weingut": {
    "name": "Weingut",
    "icon": "WG",
    "cost": 220,
    "effect": "enables",
    "value": "wein",
    "materialCost": {
      "holz": 15
    }
  },
  "kornspeicher": {
    "name": "Getreidespeicher",
    "icon": "KS",
    "cost": 150,
    "effect": "storage_boost",
    "value": 200,
    "materialCost": {
      "holz": 30
    }
  },
  "markt": {
    "name": "Markt",
    "icon": "MA",
    "cost": 300,
    "effect": "trade_boost",
    "value": 0.1,
    "materialCost": {
      "holz": 15
    }
  },
  "muehle": {
    "name": "Mühle",
    "icon": "MÜ",
    "cost": 250,
    "effect": "getreide_boost",
    "value": 0.2,
    "materialCost": {
      "holz": 25,
      "stein": 10
    }
  },
  "saegewerk": {
    "name": "Sägewerk",
    "icon": "SW",
    "cost": 220,
    "effect": "enables",
    "value": "holz",
    "materialCost": {
      "holz": 15
    }
  },
  "steinbruch": {
    "name": "Steinbruch",
    "icon": "ST",
    "cost": 240,
    "effect": "enables",
    "value": "stein",
    "materialCost": {
      "holz": 10
    }
  },
  "tongrube": {
    "name": "Tongrube",
    "icon": "TO",
    "cost": 200,
    "effect": "enables",
    "value": "ton",
    "materialCost": {
      "holz": 8
    }
  },
  "kohlebergwerk": {
    "name": "Kohlebergwerk",
    "icon": "KB",
    "cost": 300,
    "effect": "enables",
    "value": "kohle",
    "materialCost": {
      "holz": 20,
      "stein": 15
    }
  },
  "gerberei": {
    "name": "Gerberei",
    "icon": "GB",
    "cost": 260,
    "effect": "enables",
    "value": "leder",
    "materialCost": {
      "holz": 15
    }
  },
  "salzsiederei": {
    "name": "Salzsiederei",
    "icon": "SS",
    "cost": 260,
    "effect": "enables",
    "value": "salz",
    "materialCost": {
      "holz": 10,
      "ton": 10
    }
  },
  "schmiede": {
    "name": "Schmiede",
    "icon": "SM",
    "cost": 400,
    "effect": "enables",
    "value": "eisen",
    "materialCost": {
      "stein": 20,
      "eisen": 5
    }
  },
  "waffenschmiede": {
    "name": "Waffenschmiede",
    "icon": "WS",
    "cost": 420,
    "effect": "enables",
    "value": "waffen",
    "materialCost": {
      "stein": 20,
      "eisen": 10
    }
  },
  "weberei": {
    "name": "Weberei",
    "icon": "WB",
    "cost": 240,
    "effect": "enables",
    "value": "kleidung",
    "materialCost": {
      "holz": 15
    }
  },
  "brauerei": {
    "name": "Brauerei",
    "icon": "BR",
    "cost": 280,
    "effect": "enables",
    "value": "bier",
    "materialCost": {
      "holz": 20,
      "ton": 10
    }
  },
  "rathaus": {
    "name": "Rathaus",
    "icon": "RH",
    "cost": 500,
    "effect": "admin_boost",
    "value": 0.1,
    "materialCost": {
      "stein": 30,
      "holz": 10
    }
  },
  "kaserne": {
    "name": "Kaserne",
    "icon": "KA",
    "cost": 350,
    "effect": "military",
    "value": 1,
    "materialCost": {
      "holz": 25,
      "stein": 10
    }
  },
  "stadtmauer": {
    "name": "Stadtmauer",
    "icon": "SM2",
    "cost": 600,
    "effect": "defense",
    "value": 1,
    "materialCost": {
      "stein": 50
    }
  },
  "kirche": {
    "name": "Kirche",
    "icon": "KR",
    "cost": 350,
    "effect": "religion_boost",
    "value": 5,
    "materialCost": {
      "stein": 25,
      "holz": 10
    }
  },
  "kloster": {
    "name": "Kloster",
    "icon": "KO",
    "cost": 300,
    "effect": "religion_boost",
    "value": 8,
    "materialCost": {
      "stein": 20
    }
  },
  "universitaet": {
    "name": "Universität",
    "icon": "UN",
    "cost": 600,
    "effect": "research",
    "value": 10,
    "materialCost": {
      "stein": 30,
      "holz": 20
    }
  },
  "palast": {
    "name": "Palast",
    "icon": "PA",
    "cost": 800,
    "effect": "prestige_boost",
    "value": 2,
    "materialCost": {
      "stein": 60,
      "holz": 20
    }
  },
  "kathedrale": {
    "name": "Kathedrale",
    "icon": "KT",
    "cost": 1200,
    "effect": "prestige_boost",
    "value": 4,
    "materialCost": {
      "stein": 90,
      "holz": 30
    }
  },
  "papiermuehle": {
    "name": "Papiermühle",
    "icon": "PM",
    "cost": 280,
    "effect": "enables",
    "value": "papier",
    "materialCost": {
      "holz": 20,
      "stein": 10
    }
  },
  "buchbinderei": {
    "name": "Buchbinderei",
    "icon": "BB",
    "cost": 320,
    "effect": "enables",
    "value": "buecher",
    "materialCost": {
      "holz": 15,
      "stein": 5
    }
  },
  "goldschmiede": {
    "name": "Goldschmiede",
    "icon": "GS",
    "cost": 400,
    "effect": "enables",
    "value": "schmuck",
    "materialCost": {
      "stein": 15,
      "holz": 10
    }
  },
  "glasblaeserei": {
    "name": "Glasbläserei",
    "icon": "GB",
    "cost": 350,
    "effect": "enables",
    "value": "glaswaren",
    "materialCost": {
      "stein": 20,
      "holz": 15
    }
  },
  "kornmuehle": {
    "name": "Kornmühle",
    "icon": "KM",
    "cost": 240,
    "effect": "enables",
    "value": "mehl",
    "materialCost": {
      "holz": 15,
      "stein": 5
    }
  },
  "baeckerei": {
    "name": "Bäckerei",
    "icon": "BK",
    "cost": 260,
    "effect": "enables",
    "value": "brot",
    "materialCost": {
      "holz": 20,
      "stein": 10
    }
  }
};

// Bedarf pro Kopf und Gruppe (relative Gewichtung für Preisbildung); §13: mindestens
// 10 Bevölkerungsgruppen
const POP_GROUPS = {
  "bauern": {
    "name": "Bauern",
    "needs": {
      "getreide": 1
    },
    "weight": 1,
    "share": 0.4
  },
  "landarbeiter": {
    "name": "Landarbeiter",
    "needs": {
      "getreide": 1,
      "gemuese": 0.3
    },
    "weight": 1,
    "share": 0.08
  },
  "handwerker": {
    "name": "Handwerker",
    "needs": {
      "getreide": 1,
      "bier": 0.3,
      "leder": 0.05,
      "kleidung": 0.1,
      "brot": 0.1
    },
    "weight": 1.1,
    "share": 0.12
  },
  "buerger": {
    "name": "Bürger",
    "needs": {
      "getreide": 1,
      "bier": 0.3,
      "fleisch": 0.2,
      "kleidung": 0.15,
      "salz": 0.1,
      "buecher": 0.02,
      "glaswaren": 0.03,
      "brot": 0.15
    },
    "weight": 1.4,
    "share": 0.08
  },
  "haendler": {
    "name": "Händler",
    "needs": {
      "getreide": 1,
      "bier": 0.4,
      "werkzeuge": 0.1,
      "leder": 0.05,
      "wein": 0.1,
      "papier": 0.05,
      "glaswaren": 0.02,
      "brot": 0.1
    },
    "weight": 1.3,
    "share": 0.07
  },
  "adel": {
    "name": "Adel",
    "needs": {
      "getreide": 1.2,
      "bier": 0.5,
      "werkzeuge": 0.2,
      "leder": 0.15,
      "wein": 0.3,
      "gewuerze": 0.05,
      "kleidung": 0.2,
      "waffen": 0.02,
      "schmuck": 0.03,
      "seide": 0.03,
      "buecher": 0.02,
      "brot": 0.1
    },
    "weight": 2,
    "share": 0.04
  },
  "geistliche": {
    "name": "Geistliche",
    "needs": {
      "getreide": 0.9,
      "wein": 0.1,
      "buecher": 0.05,
      "papier": 0.05,
      "brot": 0.1
    },
    "weight": 1.2,
    "share": 0.03
  },
  "soldaten": {
    "name": "Soldaten",
    "needs": {
      "getreide": 1.1,
      "fleisch": 0.2,
      "waffen": 0.05,
      "brot": 0.1
    },
    "weight": 1.2,
    "share": 0.03
  },
  "tageloehner": {
    "name": "Tagelöhner",
    "needs": {
      "getreide": 0.85
    },
    "weight": 0.6,
    "share": 0.08
  },
  "arme": {
    "name": "Arme",
    "needs": {
      "getreide": 0.8
    },
    "weight": 0.5,
    "share": 0.07
  }
};

// ---------- Militär (§33/§34) — geprägt von Vasallenheeren & Söldnern, keine
// stehende Armee: Vasallentruppen erfordern Lehenstreue (Adelszufriedenheit),
// Söldner sind jederzeit gegen Gold verfügbar, aber unzuverlässig (Fahnenflucht
// bei ausbleibendem Sold oder wackliger Herrschaft).
const TROOP_TYPES = {
  "miliz": {
    "name": "Bauernmiliz",
    "cost": 50,
    "upkeep": 2,
    "strength": 1,
    "source": "vasall"
  },
  "bogenschuetzen": {
    "name": "Bogenschützen",
    "cost": 90,
    "upkeep": 3,
    "strength": 2,
    "source": "vasall"
  },
  "armbrustschuetzen": {
    "name": "Armbrustschützen",
    "cost": 130,
    "upkeep": 4,
    "strength": 2.5,
    "source": "vasall"
  },
  "pikeniere": {
    "name": "Pikeniere",
    "cost": 110,
    "upkeep": 4,
    "strength": 3,
    "source": "vasall"
  },
  "ritter": {
    "name": "Ritter",
    "cost": 400,
    "upkeep": 12,
    "strength": 8,
    "source": "vasall",
    "minAdelSatisfaction": 45
  },
  "schwere_kavallerie": {
    "name": "Schwere Kavallerie",
    "cost": 650,
    "upkeep": 18,
    "strength": 12,
    "source": "vasall",
    "minAdelSatisfaction": 55
  },
  "soeldner": {
    "name": "Söldner",
    "cost": 200,
    "upkeep": 15,
    "strength": 4,
    "source": "soeldner"
  }
};

// Schlachtformationen (§35): keine echte taktische Simulation, aber eine
// spürbare, nachvollziehbare Vorentscheidung mit Vor-/Nachteilen
const FORMATIONS = {
  "ritter_zentrum": {
    "name": "Ritter im Zentrum, Fußvolk an den Flanken",
    "requiresTroop": "ritter",
    "bonus": 0.15
  },
  "schuetzen_vorhut": {
    "name": "Bogen-/Armbrustschützen als Vorhut",
    "requiresTroop": [
      "bogenschuetzen",
      "armbrustschuetzen"
    ],
    "bonus": 0.12
  },
  "pikenwall": {
    "name": "Pikenwall gegen Kavallerie",
    "requiresTroop": "pikeniere",
    "bonus": 0.13
  },
  "gleichmaessig": {
    "name": "Gleichmäßig verteilt (keine Schwerpunktbildung)",
    "requiresTroop": null,
    "bonus": 0
  }
};

// ---------- Berater (§42) ----------
const ADVISOR_ROLES = {
  "schatzmeister": {
    "name": "Schatzmeister",
    "statKey": "verwaltung",
    "desc": "Erhöht die Steuereinnahmen."
  },
  "marschall": {
    "name": "Marschall",
    "statKey": "militaer",
    "desc": "Stärkt die Armee."
  },
  "diplomat": {
    "name": "Diplomat",
    "statKey": "diplomatie",
    "desc": "Verbessert diplomatische Erfolge."
  },
  "spionagemeister": {
    "name": "Spionagemeister",
    "statKey": "intelligenz",
    "desc": "Grundlage für künftige Aufklärung (Beta)."
  },
  "geistlicher": {
    "name": "Geistlicher",
    "statKey": "charisma",
    "desc": "Hebt die Zufriedenheit leicht."
  },
  "handelsberater": {
    "name": "Handelsberater",
    "statKey": "handel",
    "desc": "Steigert die Produktion."
  }
};

// ---------- Zusätzliche Regionen für ein größeres Mitteleuropa-Bild (§6) ----------
// ai1-ai3 bleiben die unmittelbaren, diplomatisch erreichbaren Nachbarn.
// ai4-ai7 erweitern die simulierte Welt (Handel, Chronik-Ereignisse, eigenständige
// Entwicklung gemäß §86), sind aber (noch) nicht Ziel direkter Diplomatie/Kriege.
const EXTRA_REGIONS = [
  {
    "id": "ai4",
    "name": "Bayern",
    "fertility": 1.05,
    "pop": 2900
  },
  {
    "id": "ai5",
    "name": "Sachsen",
    "fertility": 0.95,
    "pop": 2700
  },
  {
    "id": "ai6",
    "name": "Böhmen",
    "fertility": 1.05,
    "pop": 2850
  },
  {
    "id": "ai7",
    "name": "Schwaben",
    "fertility": 0.95,
    "pop": 2750
  }
];

// ---------- Auswählbare Startregionen für das Jahr 1500 (§8-Vertiefung) ----------
// Auf Nutzerwunsch: statt einer einzigen fiktiven "Deine Provinz" darf der
// Spieler bei der Charaktererstellung aus real existierenden europäischen
// Herrschaftsgebieten des Jahres 1500 wählen. Fruchtbarkeit/Bevölkerung/
// Startkapital sind bewusst nur moderat unterschiedlich kalibriert (siehe
// applyStartRegion() in core.js) — die eigentliche Weltkarte (ai1-ai7)
// bleibt für alle Wahlmöglichkeiten identisch, nur die Identität und die
// Startbedingungen der eigenen Provinz ändern sich. "player" bleibt die
// namenlose Standardoption (unverändertes Verhalten, falls keine Region
// gewählt wird — wichtig für Abwärtskompatibilität von Spielständen/Tests).
const START_REGIONS = [
  {
    "id": "player",
    "name": "Deine Provinz",
    "fertility": 1.0,
    "pop": 2400,
    "treasuryMultiplier": 1.0,
    "description": "Eine namenlose Provinz irgendwo im Reich — der klassische, neutrale Einstieg."
  },
  {
    "id": "burgund",
    "name": "Herzogtum Burgund",
    "fertility": 1.05,
    "pop": 2600,
    "treasuryMultiplier": 1.3,
    "description": "Reiche Tuchhandelsstädte in Flandern, prachtvoller Hof — aber zwischen Frankreich und dem Reich eingeklemmt."
  },
  {
    "id": "england",
    "name": "Königreich England",
    "fertility": 1.0,
    "pop": 2500,
    "treasuryMultiplier": 1.0,
    "description": "Frisch geeinte Tudor-Krone nach den Rosenkriegen, Wollhandel mit Flandern."
  },
  {
    "id": "venedig",
    "name": "Republik Venedig",
    "fertility": 0.85,
    "pop": 2200,
    "treasuryMultiplier": 1.4,
    "description": "Seemacht und Handelsknotenpunkt zum Orient — wenig eigenes Ackerland, dafür prall gefüllte Kassen."
  },
  {
    "id": "mailand",
    "name": "Herzogtum Mailand",
    "fertility": 1.15,
    "pop": 2700,
    "treasuryMultiplier": 1.1,
    "description": "Fruchtbare Po-Ebene und blühende Handwerkskunst — im Visier französischer und spanischer Ambitionen."
  },
  {
    "id": "kastilien",
    "name": "Krone Kastilien",
    "fertility": 0.9,
    "pop": 2400,
    "treasuryMultiplier": 0.95,
    "description": "Frisch geeint nach der Reconquista von 1492, karge Hochebenen, Aufbruch in eine neue Zeit."
  },
  {
    "id": "portugal",
    "name": "Königreich Portugal",
    "fertility": 0.9,
    "pop": 2000,
    "treasuryMultiplier": 1.15,
    "description": "Kleines Königreich am Atlantik — die Entdeckungsfahrten füllen langsam die Staatskasse."
  },
  {
    "id": "polen",
    "name": "Königreich Polen",
    "fertility": 1.2,
    "pop": 2800,
    "treasuryMultiplier": 0.85,
    "description": "Weite Kornkammern zwischen Ostsee und Steppe — doch Adel und Krone ringen um Macht."
  },
  {
    "id": "ungarn",
    "name": "Königreich Ungarn",
    "fertility": 1.0,
    "pop": 2500,
    "treasuryMultiplier": 0.9,
    "description": "Fruchtbare Theiß-Ebene, aber Grenzland gegen das vordringende Osmanische Reich."
  },
  {
    "id": "schweiz",
    "name": "Alte Eidgenossenschaft",
    "fertility": 0.8,
    "pop": 1900,
    "treasuryMultiplier": 1.0,
    "description": "Bündnis freier Bergkantone, karges Ackerland — doch gefürchtete Söldner als Exportgut."
  },
  {
    "id": "bretagne",
    "name": "Herzogtum Bretagne",
    "fertility": 1.0,
    "pop": 2100,
    "treasuryMultiplier": 1.0,
    "description": "Noch unabhängiges Herzogtum an der Atlantikküste, bald von Frankreich vereinnahmt."
  }
];

// ---------- Localization-Grundstruktur (§80) ----------
// Aktuell nur Deutsch befüllt; Architektur ist für weitere Sprachen vorbereitet.
// Noch nicht die gesamte UI ist über STRINGS geführt (siehe DEVELOPMENT.md).
// §80: die statische UI-"Hülle" (Titelbildschirm, Charaktererstellung, Reiter,
// Hauptaktionen, Einstellungen) läuft vollständig über STRINGS/t() und ist in
// Deutsch UND Englisch komplett übersetzt — umschaltbar über den Sprachwähler
// im Optionen-Bereich. Bewusste Einschränkung (siehe DEVELOPMENT.md): die
// dynamisch generierten Inhalte der Spielreiter selbst (Chronik-Texte,
// Ereignistexte, Tabelleninhalte, Tooltip-Aufschlüsselungen) bleiben Deutsch —
// das wäre eine vollständige Zweitübersetzung von hunderten Text-Templates
// und laut Spec selbst (§101) niedrigste Priorität.
const STRINGS = {
  de: {
    title_h1: "KAISERREICH", title_h2: "AUFSTIEG EINER DYNASTIE",
    title_new_game: "NEUES SPIEL", title_load_game: "SPIEL LADEN",
    title_multiplayer: "MEHRSPIELER", title_chronicle: "CHRONIK", title_options: "OPTIONEN",
    title_multiplayer_hint: "In dieser Version nicht verfügbar",
    title_chronicle_hint: "Erst nach dem ersten Spielende verfügbar",
    title_options_alert: "CRT-Filter, Sound, Musik und Sprache lassen sich im Spiel selbst unten rechts umschalten.",
    intro_line1: "Anno 1500.",
    intro_line2: "Eine junge Dynastie erhebt sich in einem unruhigen Reich —",
    intro_line3: "zwischen Kornkammern, Kanzleien und Kriegsherren.",
    intro_skip: "(klicken zum Überspringen)",
    cc_title: "HERRSCHER ERSTELLEN",
    cc_name: "Name", cc_name_placeholder: "z. B. Friedrich",
    cc_gender: "Geschlecht", cc_gender_m: "männlich", cc_gender_f: "weiblich",
    cc_dynasty: "Dynastiename", cc_dynasty_placeholder: "z. B. von Kaisersberg",
    cc_region: "Startregion", cc_region_only: "Deine Provinz (einzige verfügbare Region in dieser Version)",
    cc_difficulty: "Schwierigkeitsgrad",
    cc_diff_easy: "Leicht — KI macht mehr Fehler", cc_diff_normal: "Normal — ausgewogene KI",
    cc_diff_hard: "Schwer — KI plant zielstrebiger", cc_diff_expert: "Experte — weniger Informationen, kaum KI-Fehler",
    cc_victory: "Zielsetzung (§47)",
    cc_victory_kaiser: "Kaiser werden (klassisch, per Kaiserwahl)",
    cc_victory_wealth: "Reichste Dynastie (80.000 Taler, 5 Jahre halten)",
    cc_victory_trade: "Größte Handelsmacht (Lagerwert 15.000, 5 Jahre halten)",
    cc_victory_military: "Militärische Dominanz (alle 3 Nachbarn besiegen)",
    cc_victory_endless: "Endlosmodus (kein Sieg-Ziel)",
    cc_capital: "Startkapital",
    cc_capital_arm: "Arm — Herausforderung von Anfang an",
    cc_capital_normal: "Normal",
    cc_capital_reich: "Reich — komfortabler Start",
    cc_stance: "Diplomatische Ausgangslage",
    cc_stance_freundlich: "Freundlich — Nachbarn wohlgesonnen",
    cc_stance_neutral: "Neutral",
    cc_stance_angespannt: "Angespannt — Nachbarn misstrauisch",
    cc_traits: "Persönlichkeitsschwerpunkte", cc_traits_hint: "(genau 2 wählen)",
    cc_start: "SPIEL BEGINNEN", cc_random: "ZUFÄLLIGER HERRSCHER", cc_back: "ZURÜCK",
    tab_provinz: "🏰 PROVINZ",
    tab_hof: "📚 BERATER & FORSCHUNG",
    tab_wirtschaft: "💰 WIRTSCHAFT",
    tab_diplomatie: "🤝 DIPLOMATIE",
    tab_karte: "🗺 KARTE & GEBÄUDE",
    tab_militaer: "⚔ MILITÄR",
    btn_advance: "▶ MONAT VERGEHEN LASSEN",
    btn_save: "💾 SPEICHERN",
    btn_load: "📂 LADEN",
    tb_year: "Jahr", tb_treasury: "Schatz", tb_treasury_unit: "Taler", tb_prestige: "Prestige",
    settings_crt: "CRT-Filter", settings_sound: "Sound", settings_music: "🎵 Musik", settings_debug: "🛠 Debug",
    settings_lang: "Sprache",
    panel_hof: "HOF",
    panel_berater: "BERATER",
    panel_provinz: "DEINE PROVINZ",
    panel_maerkte: "MARKTPREISE & LAGER",
    panel_diplomatie: "DIPLOMATIE",
    panel_chronik: "REICHSCHRONIK",
    panel_armee: "ARMEE",
    panel_kriegserklaerung: "KRIEGSERKLÄRUNG",
    panel_kaiserwahl: "KAISERWAHL",
    title_up_headline: "⚜ AUFSTIEG! ⚜",
    title_up_text: "Du wurdest zum {title} erhoben!",
  },
  en: {
    title_h1: "KAISERREICH", title_h2: "RISE OF A DYNASTY",
    title_new_game: "NEW GAME", title_load_game: "LOAD GAME",
    title_multiplayer: "MULTIPLAYER", title_chronicle: "CHRONICLE", title_options: "OPTIONS",
    title_multiplayer_hint: "Not available in this version",
    title_chronicle_hint: "Only available after your first game ends",
    title_options_alert: "CRT filter, sound, music and language can be toggled in-game, bottom right.",
    intro_line1: "Anno 1500.",
    intro_line2: "A young dynasty rises in an unquiet realm —",
    intro_line3: "between granaries, chancelleries, and warlords.",
    intro_skip: "(click to skip)",
    cc_title: "CREATE YOUR RULER",
    cc_name: "Name", cc_name_placeholder: "e.g. Frederick",
    cc_gender: "Gender", cc_gender_m: "male", cc_gender_f: "female",
    cc_dynasty: "Dynasty name", cc_dynasty_placeholder: "e.g. of Kaisersberg",
    cc_region: "Starting region", cc_region_only: "Your province (only region available in this version)",
    cc_difficulty: "Difficulty",
    cc_diff_easy: "Easy — the AI makes more mistakes", cc_diff_normal: "Normal — balanced AI",
    cc_diff_hard: "Hard — the AI plans more purposefully", cc_diff_expert: "Expert — less information, few AI mistakes",
    cc_victory: "Victory goal (§47)",
    cc_victory_kaiser: "Become Emperor (classic, via imperial election)",
    cc_victory_wealth: "Wealthiest dynasty (80,000 gold, hold for 5 years)",
    cc_victory_trade: "Greatest trading power (15,000 warehouse value, hold for 5 years)",
    cc_victory_military: "Military dominance (defeat all 3 neighbors)",
    cc_victory_endless: "Endless mode (no victory goal)",
    cc_capital: "Starting capital",
    cc_capital_arm: "Poor — a challenge from the start",
    cc_capital_normal: "Normal",
    cc_capital_reich: "Rich — a comfortable start",
    cc_stance: "Diplomatic starting position",
    cc_stance_freundlich: "Friendly — neighbors well-disposed",
    cc_stance_neutral: "Neutral",
    cc_stance_angespannt: "Tense — neighbors suspicious",
    cc_traits: "Personality traits", cc_traits_hint: "(pick exactly 2)",
    cc_start: "START GAME", cc_random: "RANDOM RULER", cc_back: "BACK",
    tab_provinz: "🏰 PROVINCE",
    tab_hof: "📚 ADVISORS & RESEARCH",
    tab_wirtschaft: "💰 ECONOMY",
    tab_diplomatie: "🤝 DIPLOMACY",
    tab_karte: "🗺 MAP & BUILDINGS",
    tab_militaer: "⚔ MILITARY",
    btn_advance: "▶ ADVANCE MONTH",
    btn_save: "💾 SAVE",
    btn_load: "📂 LOAD",
    tb_year: "Year", tb_treasury: "Treasury", tb_treasury_unit: "gold", tb_prestige: "Prestige",
    settings_crt: "CRT filter", settings_sound: "Sound", settings_music: "🎵 Music", settings_debug: "🛠 Debug",
    settings_lang: "Language",
    panel_hof: "COURT",
    panel_berater: "ADVISORS",
    panel_provinz: "YOUR PROVINCE",
    panel_maerkte: "MARKET PRICES & STOCKPILES",
    panel_diplomatie: "DIPLOMACY",
    panel_chronik: "IMPERIAL CHRONICLE",
    panel_armee: "ARMY",
    panel_kriegserklaerung: "DECLARATION OF WAR",
    panel_kaiserwahl: "IMPERIAL ELECTION",
    title_up_headline: "⚜ PROMOTED! ⚜",
    title_up_text: "You have been elevated to {title}!",
  },
};
let currentLocale = "de";
function t(key) { return (STRINGS[currentLocale] && STRINGS[currentLocale][key]) || key; }

const TITLES = [
  {
    "id": "freiherr",
    "name": "Freiherr",
    "reqPop": 0,
    "reqWealth": 0,
    "reqPrestige": 0
  },
  {
    "id": "baron",
    "name": "Baron",
    "reqPop": 3000,
    "reqWealth": 1000,
    "reqPrestige": 20
  },
  {
    "id": "graf",
    "name": "Graf",
    "reqPop": 6000,
    "reqWealth": 3000,
    "reqPrestige": 50
  },
  {
    "id": "landgraf",
    "name": "Landgraf",
    "reqPop": 10000,
    "reqWealth": 6000,
    "reqPrestige": 90
  },
  {
    "id": "markgraf",
    "name": "Markgraf",
    "reqPop": 15000,
    "reqWealth": 10000,
    "reqPrestige": 140
  },
  {
    "id": "fuerst",
    "name": "Fürst",
    "reqPop": 22000,
    "reqWealth": 16000,
    "reqPrestige": 200
  },
  {
    "id": "herzog",
    "name": "Herzog",
    "reqPop": 32000,
    "reqWealth": 25000,
    "reqPrestige": 280
  },
  {
    "id": "kurfuerst",
    "name": "Kurfürst",
    "reqPop": 45000,
    "reqWealth": 40000,
    "reqPrestige": 380
  },
  {
    "id": "koenig",
    "name": "König",
    "reqPop": 65000,
    "reqWealth": 60000,
    "reqPrestige": 500
  },
  {
    "id": "kaiser",
    "name": "Kaiser",
    "reqPop": 90000,
    "reqWealth": 90000,
    "reqPrestige": 650
  }
];

// Event-System: TRIGGER/BEDINGUNGEN/TEXT/ENTSCHEIDUNGEN/KONSEQUENZEN (§38)
// ---------- Charaktersystem (§9/§10) ----------
const MALE_NAMES = ["Friedrich","Wilhelm","Heinrich","Konrad","Albrecht","Ludwig","Otto","Rudolf","Gottfried","Sigismund","Bernhard","Eberhard"];
const FEMALE_NAMES = ["Adelheid","Mathilde","Elisabeth","Kunigunde","Irmgard","Hedwig","Agnes","Gertrud","Luitgard","Ottilie","Beatrix","Ida"];

const TRAITS = [
  { id: "ehrgeizig",     name: "ehrgeizig",     effects: { prestigeGain: 0.15 } },
  { id: "grosszuegig",   name: "großzügig",     effects: { satisfactionBonus: 5, treasuryDrain: 0.05 } },
  { id: "geizig",        name: "geizig",        effects: { treasuryDrain: -0.05, satisfactionBonus: -5 } },
  { id: "gerecht",       name: "gerecht",       effects: { satisfactionBonus: 8 } },
  { id: "grausam",       name: "grausam",       effects: { satisfactionBonus: -10, prestigeGain: 0.05 } },
  { id: "fleissig",      name: "fleißig",       effects: { productionBonus: 0.05 } },
  { id: "faul",          name: "faul",          effects: { productionBonus: -0.05 } },
  { id: "diplomatisch",  name: "diplomatisch",  effects: { prestigeGain: 0.05 } },
  { id: "fromm",         name: "fromm",         effects: { satisfactionBonus: 4 } },
  { id: "verschwenderisch", name: "verschwenderisch", effects: { treasuryDrain: 0.1 } },
];

function randomTraits(count) {
  const pool = [...TRAITS];
  const picked = [];
  for (let i = 0; i < count && pool.length; i++) {
    const idx = Math.floor(rnd() * pool.length);
    picked.push(pool.splice(idx, 1)[0].id);
  }
  return picked;
}

function randomStat() { return 3 + Math.floor(rnd() * 15); } // 3-17

function createCharacter(gender, age, surname) {
  const pool = gender === "m" ? MALE_NAMES : FEMALE_NAMES;
  const name = pool[Math.floor(rnd() * pool.length)];
  return {
    name, surname, gender, age,
    health: 80 + Math.floor(rnd()*20),
    alive: true,
    stats: {
      intelligenz: randomStat(), diplomatie: randomStat(), verwaltung: randomStat(),
      militaer: randomStat(), handel: randomStat(), charisma: randomStat(),
    },
    traits: randomTraits(2),
    spouseId: null,
    childrenIds: [],
    parentId: null,
  };
}

const EVENTS = [
  {
    id: "kornspeicher_leer",
    title: "Die Kornspeicher sind leer",
    text: "Nach schlechten Ernten sind die Kornspeicher nahezu leer. Vor den Bäckereien bilden sich lange Schlangen.",
    condition: (r) => (r.grainRatio !== undefined ? r.grainRatio : 1) < 0.5 && r.population.arme.satisfaction < 40,
    options: [
      { label: "Staatliche Reserven öffnen", apply: (r, s) => { r.warehouse.getreide = Math.max(0, (r.warehouse.getreide||0) - 40); r.population.arme.satisfaction += 15; } },
      { label: "Getreide importieren (-800 Taler)", apply: (r, s) => { s.treasury -= 800; r.warehouse.getreide = (r.warehouse.getreide||0) + 60; } },
      { label: "Preise gesetzlich begrenzen", apply: (r, s) => { r.population.arme.satisfaction += 5; r.population.haendler.satisfaction -= 20; } },
      { label: "Nichts unternehmen", apply: (r, s) => { r.population.arme.satisfaction -= 15; } },
    ],
  },
  {
    id: "gute_ernte",
    title: "Eine außergewöhnlich gute Ernte",
    text: "Die Scheunen sind prall gefüllt. Die Bauern feiern ein Erntedankfest.",
    condition: (r) => r.lastHarvestFactor > 1.3,
    options: [
      { label: "Fest ausrichten (+Zufriedenheit, -100 Taler)", apply: (r, s) => { s.treasury -= 100; r.population.bauern.satisfaction += 10; } },
      { label: "Überschuss verkaufen", apply: (r, s) => { s.treasury += 300; r.warehouse.getreide = Math.max(0,(r.warehouse.getreide||0)-100); } },
    ],
  },
  {
    id: "haendler_beschwerde",
    title: "Die Händlergilde beschwert sich",
    text: "Die Zölle seien zu hoch, klagt die Händlergilde. Sie drohen, ihre Waren woanders zu verkaufen.",
    condition: (r) => r.taxRate > 0.25,
    options: [
      { label: "Steuern senken", apply: (r, s) => { r.taxRate = Math.max(0.05, r.taxRate - 0.05); r.population.haendler.satisfaction += 15; } },
      { label: "Hart bleiben", apply: (r, s) => { r.population.haendler.satisfaction -= 15; } },
    ],
  },
  {
    id: "seuche",
    title: "Eine Seuche bricht aus",
    text: "Fieber grassiert in den ärmeren Vierteln. Die Ärzte sind ratlos.",
    condition: (r) => r.population.arme.satisfaction < 25 && rnd() < 0.5,
    options: [
      { label: "Quarantäne verhängen (-Handel, weniger Tote)", apply: (r, s) => { r.plagueMitigated = true; } },
      { label: "Geschehen lassen", apply: (r, s) => { r.plagueMitigated = false; } },
    ],
  },
  {
    id: "adel_fordert_amt",
    title: "Ein Adliger fordert ein Hofamt",
    text: "Ein einflussreicher Adliger fühlt sich übergangen und fordert Anerkennung.",
    condition: (r) => r.population.adel.satisfaction < 35,
    options: [
      { label: "Ihm ein Amt zugestehen", apply: (r, s) => { r.population.adel.satisfaction += 20; s.treasury -= 150; } },
      { label: "Ihn ignorieren", apply: (r, s) => { r.population.adel.satisfaction -= 10; } },
    ],
  },
  {
    id: "handwerker_innovation",
    title: "Ein Handwerker präsentiert eine Neuerung",
    text: "Ein findiger Handwerksmeister bittet um Fördermittel für ein neues Verfahren.",
    condition: (r) => r.population.handwerker.count > 500,
    options: [
      { label: "Fördern (-200 Taler, +Produktion)", apply: (r, s) => { s.treasury -= 200; r.productionBonus = (r.productionBonus||0) + 0.05; } },
      { label: "Ablehnen", apply: (r) => {} },
    ],
  },
  {
    id: "raeuberbanden",
    title: "Räuberbanden bedrohen die Handelswege",
    text: "Kaufleute berichten von Überfällen auf den Straßen ins Umland.",
    condition: (r) => r.satisfactionAvg < 45,
    options: [
      { label: "Patrouillen entsenden (-100 Taler)", apply: (r, s) => { s.treasury -= 100; r.population.haendler.satisfaction += 10; } },
      { label: "Nichts tun", apply: (r) => { r.population.haendler.satisfaction -= 10; } },
    ],
  },
  {
    id: "kirche_spende",
    title: "Die Kirche bittet um eine Spende",
    text: "Der Ortspfarrer bittet um Mittel für den Ausbau der Kirche.",
    condition: (r) => rnd() < 0.15,
    options: [
      { label: "Spenden (-150 Taler, +Prestige)", apply: (r, s) => { s.treasury -= 150; s.prestige += 5; } },
      { label: "Ablehnen", apply: (r) => {} },
    ],
  },
  {
    id: "handelsroute_eroeffnet",
    title: "Eine neue Handelsroute wird vorgeschlagen",
    text: "Kaufleute schlagen vor, eine feste Handelsroute zu einer Nachbarregion einzurichten.",
    condition: (r) => hasBuilding(r, "markt") && rnd() < 0.2,
    options: [
      { label: "Route einrichten (-200 Taler, +Händlerzufriedenheit)", apply: (r, s) => { s.treasury -= 200; r.population.haendler.satisfaction += 12; } },
      { label: "Ablehnen", apply: (r) => {} },
    ],
  },
  {
    id: "gelehrter_bittet_foerderung",
    title: "Ein Gelehrter bittet um Förderung",
    text: "Ein reisender Gelehrter möchte am Hof bleiben und um Wissen und Bildung werben.",
    condition: (r) => r.population.adel.count > 200 && rnd() < 0.15,
    options: [
      { label: "Aufnehmen (-120 Taler, +Prestige)", apply: (r, s) => { s.treasury -= 120; s.prestige += 8; } },
      { label: "Wegschicken", apply: (r) => {} },
    ],
  },
  {
    id: "wildererbande",
    title: "Wilderer plündern die Wälder",
    text: "Eine Bande von Wilderern hat sich in den Wäldern eingenistet und stiehlt Wild und Holz.",
    condition: (r) => (r.warehouse.holz || 0) > 150 && rnd() < 0.2,
    options: [
      { label: "Miliz entsenden (-80 Taler)", apply: (r, s) => { s.treasury -= 80; r.warehouse.holz = (r.warehouse.holz||0); } },
      { label: "Ignorieren", apply: (r) => { r.warehouse.holz = Math.max(0, (r.warehouse.holz||0) - 40); } },
    ],
  },
  {
    id: "komet",
    title: "Ein Komet erscheint am Nachthimmel",
    text: "Ein heller Komet zieht über das Land. Manche sehen darin ein böses, andere ein gutes Omen.",
    condition: (r) => rnd() < 0.06,
    options: [
      { label: "Als gutes Omen deuten lassen", apply: (r, s) => { s.prestige += 3; } },
      { label: "Die Bevölkerung beruhigen (-Zufriedenheitsverlust)", apply: (r) => { for (const p in r.population) r.population[p].satisfaction += 2; } },
    ],
  },
  {
    id: "brand_in_der_stadt",
    title: "Ein Großfeuer bricht aus",
    text: "In den engen Gassen der Stadt ist ein Feuer ausgebrochen und breitet sich rasch aus.",
    condition: (r) => r.buildings.length > 3 && rnd() < 0.08,
    options: [
      { label: "Löschmannschaften mobilisieren (-150 Taler, weniger Schaden)", apply: (r, s) => { s.treasury -= 150; r.warehouse.holz = Math.max(0,(r.warehouse.holz||0)-30); } },
      { label: "Das Feuer sich austoben lassen", apply: (r) => { r.population.arme.satisfaction -= 12; r.warehouse.holz = Math.max(0,(r.warehouse.holz||0)-80); } },
    ],
  },
  {
    id: "musiker_am_hof",
    title: "Ein Musiker bittet um Aufnahme an den Hof",
    text: "Ein talentierter Musiker möchte den Hof mit seiner Kunst bereichern.",
    condition: (r) => rnd() < 0.12,
    options: [
      { label: "Aufnehmen (-60 Taler, +Prestige, +Adelszufriedenheit)", apply: (r, s) => { s.treasury -= 60; s.prestige += 3; r.population.adel.satisfaction += 6; } },
      { label: "Ablehnen", apply: (r) => {} },
    ],
  },
  {
    id: "bettlerplage",
    title: "Immer mehr Bettler ziehen durch die Straßen",
    text: "Die Zahl der Mittellosen wächst, und der Rat fordert eine Entscheidung.",
    condition: (r) => r.population.arme.count > r.population.bauern.count * 0.6,
    options: [
      { label: "Armenspeisung einrichten (-100 Taler, +Zufriedenheit Arme)", apply: (r, s) => { s.treasury -= 100; r.population.arme.satisfaction += 15; } },
      { label: "Bettler des Landes verweisen", apply: (r) => { r.population.arme.count = Math.round(r.population.arme.count * 0.85); r.population.arme.satisfaction -= 10; } },
    ],
  },
  {
    id: "handwerkerstreik",
    title: "Die Handwerker drohen mit Streik",
    text: "Unzufriedene Handwerksmeister fordern bessere Bedingungen und drohen, die Arbeit niederzulegen.",
    condition: (r) => r.population.handwerker.satisfaction < 30,
    options: [
      { label: "Forderungen erfüllen (-180 Taler, +Zufriedenheit)", apply: (r, s) => { s.treasury -= 180; r.population.handwerker.satisfaction += 20; } },
      { label: "Hart durchgreifen", apply: (r) => { r.population.handwerker.satisfaction -= 10; r.productionBonus = (r.productionBonus||0) - 0.03; } },
    ],
  },
  {
    id: "wunderheiler",
    title: "Ein Wunderheiler zieht durchs Land",
    text: "Ein selbsternannter Heiler verspricht, Krankheiten mit fragwürdigen Mitteln zu kurieren.",
    condition: (r) => r.satisfactionAvg < 50 && rnd() < 0.1,
    options: [
      { label: "Ihn gewähren lassen", apply: (r) => { r.population.arme.satisfaction += 8; } },
      { label: "Als Scharlatan vertreiben", apply: (r) => { r.population.arme.satisfaction -= 3; } },
    ],
  },
  {
    id: "fremder_gesandter",
    title: "Ein fremder Gesandter trifft ein",
    text: "Ein Gesandter eines fernen Hofes überbringt Grüße und Geschenke.",
    condition: (r) => rnd() < 0.1,
    options: [
      { label: "Geschenke annehmen und erwidern (-100 Taler, +Prestige)", apply: (r, s) => { s.treasury -= 100; s.prestige += 6; } },
      { label: "Höflich, aber zurückhaltend empfangen", apply: (r, s) => { s.prestige += 2; } },
    ],
  },
  {
    id: "erbstreit_adel",
    title: "Erbstreit unter dem Landadel",
    text: "Zwei adlige Familien streiten öffentlich um ein Erbe und bitten dich um ein Urteil.",
    condition: (r) => r.population.adel.count > 100 && rnd() < 0.1,
    options: [
      { label: "Zugunsten der älteren Familie entscheiden", apply: (r) => { r.population.adel.satisfaction += 5; } },
      { label: "Zugunsten der jüngeren Familie entscheiden", apply: (r, s) => { r.population.adel.satisfaction -= 3; s.prestige += 2; } },
    ],
  },
  {
    id: "steuerhinterziehung",
    title: "Steuerhinterziehung wird aufgedeckt",
    text: "Mehrere wohlhabende Bürger haben systematisch Steuern hinterzogen.",
    condition: (r) => r.taxRate > 0.2 && rnd() < 0.15,
    options: [
      { label: "Hart bestrafen (+Staatskasse, -Händlerzufriedenheit)", apply: (r, s) => { s.treasury += 250; r.population.haendler.satisfaction -= 10; } },
      { label: "Nachsicht üben", apply: (r) => { r.population.haendler.satisfaction += 5; } },
    ],
  },
  {
    id: "rebellion",
    title: "Aufstand im Land",
    text: "Unzufriedenheit und angezweifelte Herrschaft haben sich entladen: Bewaffnete Aufständische ziehen durchs Land und fordern deinen Sturz.",
    condition: (r, s) => r.satisfactionAvg < CONFIG.rebellion.satisfactionThreshold && s.legitimacy < CONFIG.rebellion.legitimacyThreshold && rnd() < CONFIG.rebellion.baseChance,
    options: [
      {
        label: "Mit der Armee niederschlagen",
        apply: (r, s) => {
          const strength = typeof armyStrength === "function" ? armyStrength(s) : 0;
          if (strength > 15) {
            for (const pid in r.population) r.population[pid].satisfaction = clamp(r.population[pid].satisfaction - 5, 0, 100);
            s.legitimacy = clamp(s.legitimacy + 10, 0, 100);
            for (const type in s.army) s.army[type] = Math.round(s.army[type] * 0.9);
          } else {
            for (const pid in r.population) r.population[pid].satisfaction = clamp(r.population[pid].satisfaction - 15, 0, 100);
            s.treasury -= 400;
            s.prestige = Math.max(0, s.prestige - 15);
          }
        },
      },
      {
        label: "Steuern senken und Zugeständnisse machen",
        apply: (r, s) => {
          r.taxRate = Math.max(0.05, r.taxRate - 0.08);
          for (const pid in r.population) r.population[pid].satisfaction = clamp(r.population[pid].satisfaction + 12, 0, 100);
          s.legitimacy = clamp(s.legitimacy + 5, 0, 100);
        },
      },
      {
        label: "Nichts tun und hoffen",
        apply: (r, s) => {
          const totalPop = Object.values(r.population).reduce((sum,g)=>sum+g.count,0);
          r.population.arme.count = Math.max(0, Math.round(r.population.arme.count - totalPop*0.03));
          s.treasury -= 200;
          s.legitimacy = Math.max(0, s.legitimacy - 10);
        },
      },
    ],
  },
  {
    id: "ketzerei_entdeckt",
    title: "Ketzerei wird entdeckt",
    text: "Der Ortsklerus meldet abweichende Glaubenslehren unter der Bevölkerung und fordert ein Eingreifen.",
    condition: (r, s) => (s.religiousInfluence || 55) < CONFIG.religion.lowInfluenceThreshold + 15 && rnd() < 0.12,
    options: [
      { label: "Hart durchgreifen (+kirchlicher Einfluss, -Zufriedenheit Arme)", apply: (r, s) => { s.religiousInfluence = clamp((s.religiousInfluence||55) + 12, 0, 100); r.population.arme.satisfaction -= 10; } },
      { label: "Milde walten lassen (-kirchlicher Einfluss, +Zufriedenheit)", apply: (r, s) => { s.religiousInfluence = clamp((s.religiousInfluence||55) - 8, 0, 100); r.population.arme.satisfaction += 6; } },
    ],
  },
  {
    id: "wallfahrt",
    title: "Eine große Wallfahrt zieht ins Land",
    text: "Pilger aus fernen Landen durchqueren dein Gebiet und bringen Handel, aber auch Unruhe.",
    condition: (r, s) => (s.religiousInfluence || 55) > CONFIG.religion.highInfluenceThreshold - 15 && rnd() < 0.1,
    options: [
      { label: "Gastfreundschaft gewähren (-100 Taler, +kirchlicher Einfluss)", apply: (r, s) => { s.treasury -= 100; s.religiousInfluence = clamp((s.religiousInfluence||55) + 8, 0, 100); } },
      { label: "Durchreise zügig abwickeln", apply: (r, s) => { s.treasury += 60; } },
    ],
  },
  // §88 Easter Egg: eine einmalige, augenzwinkernde Anspielung auf die
  // Design-Philosophie "1986 außen – 2026 innen" (GAME_DESIGN.md), ausgelöst
  // sobald die Chronik zufällig das Jahr 1986 erreicht. Kein Gameplay-Effekt
  // von Belang, nur eine kleine Prestige-Anekdote — die _sawEasterEgg1986-
  // Flagge verhindert ein erneutes Auslösen, falls per Debug im Jahr
  // hin- und hergesprungen wird.
  {
    id: "seltsames_kribbeln",
    title: "Ein seltsames Kribbeln in der Luft",
    text: "Für einen Wimpernschlag scheint die Welt zu flackern — als bestünde sie aus lauter kleinen, viereckigen Farbklecksen. Ein fahrender Gaukler murmelt etwas von \"Pixeln\" und \"1986\", bevor alles wieder normal wirkt. Deine Hofastrologen sind ratlos, aber beeindruckt.",
    condition: (r, s) => s.year === 1986 && !s._sawEasterEgg1986,
    options: [
      { label: "Als gutes Omen feiern lassen (+Prestige)", apply: (r, s) => { s._sawEasterEgg1986 = true; s.prestige += 19; addChronicle(s, "Die Gelehrten datieren das Ereignis auf ein fernes Jahr: 1986."); } },
      { label: "Schnell vergessen", apply: (r, s) => { s._sawEasterEgg1986 = true; } },
    ],
  },
];
