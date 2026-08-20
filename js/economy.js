// ============================================================
// ECONOMY — Produktion, Preise, Handel (Markt/Regionalhandel/Land),
// Steuern, Infrastruktur, Staatsschulden, Technologie (§15/§20/§21/§24/§27/§28)
// ============================================================

function rollWeather() {
  const w = CONFIG.agriculture.weather;
  const roll = rnd();
  if (roll < w.duerreChance) return { name: "Dürre", factor: w.duerreFactor };
  if (roll < w.duerreChance + w.starkregenChance) return { name: "Starkregen", factor: w.starkregenFactor };
  if (roll < w.duerreChance + w.starkregenChance + w.frostChance) return { name: "Kalter Winter/Frost", factor: w.frostFactor };
  if (roll < w.duerreChance + w.starkregenChance + w.frostChance + w.gutesJahrChance) return { name: "besonders guter Sommer", factor: w.gutesJahrFactor };
  return { name: "normales Wetter", factor: 1.0 };
}

// ---------- Produktion ----------

function computeProduction(region) {
  const produced = {};
  for (const chain of PRODUCTION_CHAINS) {
    if (chain.building && !hasBuilding(region, chain.building)) continue;
    // Arbeitskräfte kommen aus der zuständigen Bevölkerungsgruppe (workerGroup, §13);
    // Bauern/Landarbeiter arbeiten Vollzeit in der Urproduktion, andere Gruppen teilen
    // sich Handwerk/Gewerbe nebenbei (Faktor 0.5)
    const wg = chain.workerGroup || "handwerker";
    const fullTime = wg === "bauern" || wg === "landarbeiter";
    let workers = region.population[wg].count * (fullTime ? 1.0 : 0.5);

    let amount = workers * chain.ratioPerWorker * CONFIG.economy.productionScale;
    // Gebäude, die eine Produktionskette erst ermöglichen (Sägewerk/Schmiede/Brauerei),
    // skalieren die Kapazität mit der Summe ihrer Ausbaustufen (mehrere/ausgebaute
    // Werkstätten verarbeiten mehr parallel, §26 Erweiterbarkeit)
    if (chain.building) {
      amount *= buildingLevelSum(region, chain.building);
    }
    if (chain.output === "getreide") {
      amount *= region.fertility * region.lastHarvestFactor;
      amount *= (1 + BUILDINGS.bauernhof.value * buildingLevelSum(region, "bauernhof"));
      amount *= (1 + BUILDINGS.muehle.value * buildingLevelSum(region, "muehle"));
      amount *= (1 + (region.getreideTechBonus || 0)); // §28 Technologie: Landwirtschaft
    }
    amount *= (1 + (region.productionBonus || 0));

    if (chain.input) {
      const available = region.warehouse[chain.input] || 0;
      const consumed = Math.min(available, amount);
      region.warehouse[chain.input] = available - consumed;
      amount = consumed; // 1:1 Umwandlung vereinfacht
    }
    produced[chain.output] = (produced[chain.output] || 0) + amount;
  }
  for (const g in produced) {
    region.warehouse[g] = (region.warehouse[g] || 0) + produced[g];
  }
  return produced;
}

// ---------- Kornbilanz (§Original-Vertiefung: Korn verteilen) ----------
// Hält fest, wie viel Getreide vor der Verteilung an das Volk zur Verfügung
// steht (Lagerbestand nach der Ernte) und wie hoch der reine Grundbedarf der
// Bevölkerung ist — die Kornbilanz (grainRatio) treibt danach sowohl die
// Geburtenrate (Überschuss) als auch die Sterberate (Mangel/Hungersnot) direkt
// mit (siehe updatePopulation() in population-dynasty.js), zusätzlich zum
// bereits bestehenden, zufriedenheitsvermittelten Effekt.
function computeGrainBalance(region) {
  let need = 0;
  for (const pid in region.population) {
    const coeff = (POP_GROUPS[pid].needs.getreide) || 0;
    need += coeff * region.population[pid].count * 0.01;
  }
  region.grainNeed = need;
  region.grainAvailable = region.warehouse.getreide || 0;
  region.grainRatio = need > 0 ? region.grainAvailable / need : 1;
}

// ---------- Preisbildung (§15/§21) ----------
// Marktspekulation: Preise schwanken jedes Jahr zusätzlich zur reinen
// Angebot/Nachfrage-Rechnung — mittelwert-rückkehrender Zufallsprozess,
// genau wie beim Landpreis, nur pro Ware und Region einzeln.

function updatePriceNoise(region) {
  const cfg = CONFIG.economy;
  for (const gid in GOODS) {
    const current = region.priceNoise[gid] !== undefined ? region.priceNoise[gid] : 1.0;
    const reversion = (1 - current) * cfg.priceNoiseReversion;
    const shock = (rnd() * 2 - 1) * cfg.priceNoiseShock;
    region.priceNoise[gid] = clamp(current + reversion + shock, cfg.priceNoiseMin, cfg.priceNoiseMax);
  }
}

function computeRegionalPrices(region) {
  const prices = {};
  region.priceBreakdown = {};
  for (const gid in GOODS) {
    let demand = 0;
    for (const pid in region.population) {
      const need = POP_GROUPS[pid].needs[gid];
      if (need) demand += region.population[pid].count * need * 0.01;
    }
    const supply = (region.warehouse[gid] || 0);
    const demandFactor = (demand - supply) / Math.max(supply, 1);
    const rawMultiplier = 1 + demandFactor * CONFIG.economy.demandElasticity;
    const noise = (region.priceNoise && region.priceNoise[gid]) || 1.0;
    const clampedMultiplier = clamp(rawMultiplier * noise, CONFIG.economy.priceMin, CONFIG.economy.priceMax);
    prices[gid] = Math.round(GOODS[gid].base * clampedMultiplier);
    // §84 Tooltip-Prinzip: Ursachen des Preises nachvollziehbar festhalten
    region.priceBreakdown[gid] = {
      basis: GOODS[gid].base,
      nachfrage: Math.round(demand),
      angebot: Math.round(supply),
      marktstimmung: Math.round(noise * 100) / 100,
      multiplikator: Math.round(clampedMultiplier * 100) / 100,
      gesamt: prices[gid],
    };
  }
  return prices;
}

// ---------- Bevölkerungsbedarf & Konsum ----------

function consumeAndUpdateSatisfaction(region, prices) {
  let totalSat = 0, totalCount = 0;
  for (const pid in region.population) {
    const grp = region.population[pid];
    // Bedarfe werden gewichtet gemittelt statt einzeln aufsummiert: eine Gruppe mit
    // vielen Nebenbedarfen (z.B. Adel mit 8 Waren) darf nicht automatisch eine
    // vielfach höhere Gesamtstrafe erleiden als eine Gruppe mit nur einem Bedarf
    // (z.B. Bauern mit nur Getreide) — die Gesamtwirkung bleibt so vergleichbar.
    let totalNeedWeight = 0, weightedDeficit = 0;
    for (const gid in POP_GROUPS[pid].needs) {
      const needCoefficient = POP_GROUPS[pid].needs[gid];
      const need = needCoefficient * grp.count * 0.01;
      const available = region.warehouse[gid] || 0;
      const got = Math.min(need, available);
      region.warehouse[gid] = available - got;
      const fulfillment = need > 0 ? got / need : 1;
      totalNeedWeight += needCoefficient;
      weightedDeficit += (1 - fulfillment) * needCoefficient;
    }
    const avgDeficit = totalNeedWeight > 0 ? weightedDeficit / totalNeedWeight : 0;
    let satDelta = -avgDeficit * CONFIG.population.needShortfallSatPenalty;
    // Steuerlast
    satDelta -= region.taxRate * CONFIG.population.taxSatisfactionPenalty;
    // Milde Homöostase: Zufriedenheit hat sonst keine stabilisierende Rückkehrkraft und
    // würde bei jeder noch so kleinen Dauerbelastung (z.B. Steuern) unbegrenzt abdriften.
    // Reale Schocks (Hunger, Kriegsniederlage, Rebellion) bleiben davon unberührt, da sie
    // direkt und stärker in die Zufriedenheit eingreifen als dieser sanfte Ausgleich.
    const homeostasis = (CONFIG.population.satisfactionBaseline - grp.satisfaction) * CONFIG.population.homeostasisStrength;
    grp.satisfaction = clamp(grp.satisfaction + satDelta * CONFIG.population.satisfactionSmoothing + homeostasis + (rnd()*4-2), 0, 100);
    totalSat += grp.satisfaction * grp.count;
    totalCount += grp.count;
  }
  region.satisfactionAvg = totalCount ? totalSat / totalCount : 50;
}

// ---------- Bevölkerungsentwicklung (§13/§14) ----------

// ---------- Einfache Handels-KI zwischen Regionen (§21) ----------

function runInterregionalTrade(state) {
  const regionIds = Object.keys(state.regions);
  for (const gid in GOODS) {
    // Sortiere Regionen nach Lagerbestand pro Kopf
    const stocks = regionIds.map(id => {
      const r = state.regions[id];
      const pop = Object.values(r.population).reduce((s,g)=>s+g.count,0) || 1;
      return { id, perCapita: (r.warehouse[gid]||0) / pop };
    }).sort((a,b) => b.perCapita - a.perCapita);
    if (stocks.length < 2) continue;
    const fromId = stocks[0].id, toId = stocks[stocks.length-1].id;
    const from = state.regions[fromId];
    const to = state.regions[toId];
    if (stocks[0].perCapita - stocks[stocks.length-1].perCapita > CONFIG.trade.perCapitaDiffThreshold) {
      let cap = CONFIG.trade.transferCap;
      // Handelsvertrag zwischen Spieler und KI-Region verstärkt den Warenfluss
      const dipFrom = state.diplomacy && state.diplomacy[fromId];
      const dipTo = state.diplomacy && state.diplomacy[toId];
      if ((dipFrom && dipFrom.treaties.handel) || (dipTo && dipTo.treaties.handel)) {
        cap *= CONFIG.diplomacy.tradeTreatyTransferBonus;
      }
      // §27: Bessere Infrastruktur (Straßen) erhöht das mögliche Handelsvolumen
      const infraBonus = 1 + (from.infrastructureLevel || 0) * CONFIG.infrastructure.tradeBonusPerLevel
                            + (to.infrastructureLevel || 0) * CONFIG.infrastructure.tradeBonusPerLevel;
      cap *= infraBonus;
      // §28: Handelstechnologie erhöht das Volumen zusätzlich, wenn der Spieler beteiligt ist
      if (fromId === "player" || toId === "player") cap *= (1 + techBonus(state, "handel"));
      const transferAmount = Math.min((from.warehouse[gid]||0) * CONFIG.trade.transferShare, cap);
      from.warehouse[gid] = (from.warehouse[gid]||0) - transferAmount;
      to.warehouse[gid] = (to.warehouse[gid]||0) + transferAmount;
    }
  }
}

// ---------- KI-Eigenentwicklung (§86: Welt spielt ohne Spieler) ----------

function aiRegionDevelops(region, state) {
  const diffCfg = CONFIG.difficulty[state.difficulty] || CONFIG.difficulty.normal;
  // §48: Schwierigkeit über KI-Fehlerquote/Bautempo, nicht über versteckte Ressourcenboni
  if (rnd() < diffCfg.aiMistakeChance) return; // KI verpasst diese Gelegenheit (Fehlentscheidung)
  // §32 politische Manipulation: eine lahmgelegte Verwaltung baut deutlich seltener
  if (region._manipulationYears > 0 && rnd() < 0.5) return;
  // "Wohlstands"-Näherung: Lagerbestände UND Bevölkerungsgröße fließen ein, damit
  // wachsende Regionen auch bei schwankenden Kornvorräten weiter ausbauen (§86)
  const totalPop = Object.values(region.population).reduce((s,g)=>s+g.count,0);
  const wealthProxy = (region.warehouse.getreide||0) + (region.warehouse.eisen||0)*3 + (region.warehouse.werkzeuge||0)*4 + totalPop * 0.15;
  if (wealthProxy > CONFIG.ai.buildWealthThreshold && rnd() < CONFIG.ai.buildChance * diffCfg.aiBuildChanceMultiplier) {
    const plot = freePlotIndex(region);
    if (plot !== null) {
      const types = Object.keys(BUILDINGS);
      const pick = types[Math.floor(rnd()*types.length)];
      // KI zahlt nicht aus der Spieler-Staatskasse — vereinfachtes eigenes Budget
      region.buildings.push({ type: pick, level: 1, plotIndex: plot });
    } else {
      // keine freie Parzelle mehr -> stattdessen ein bestehendes Gebäude ausbauen
      const upgradable = region.buildings.filter(b => b.level < CONFIG.buildings.maxLevel);
      if (upgradable.length) {
        const inst = upgradable[Math.floor(rnd()*upgradable.length)];
        inst.level += 1;
      }
    }
  }
}

// ---------- Titel-Aufstieg (§11) ----------
// ---------- Stadtentwicklung (§25) ----------

function infrastructureUpgradeCost(currentLevel) {
  const cfg = CONFIG.infrastructure;
  return Math.round(cfg.baseCost * Math.pow(cfg.costMultiplierPerLevel, currentLevel));
}

function upgradeInfrastructure(state, region) {
  const cfg = CONFIG.infrastructure;
  if (region.infrastructureLevel >= cfg.maxLevel) return { ok: false, reason: "Höchste Infrastrukturstufe bereits erreicht." };
  const cost = infrastructureUpgradeCost(region.infrastructureLevel);
  if (state.treasury < cost) return { ok: false, reason: "Nicht genug Taler für den Infrastrukturausbau." };
  const missing = [];
  for (const gid in cfg.materialCostPerLevel) {
    const need = cfg.materialCostPerLevel[gid];
    if ((region.warehouse[gid] || 0) < need) missing.push(`${need} ${GOODS[gid].name}`);
  }
  if (missing.length) return { ok: false, reason: `Fehlende Baustoffe: ${missing.join(", ")}.` };
  state.treasury -= cost;
  for (const gid in cfg.materialCostPerLevel) region.warehouse[gid] -= cfg.materialCostPerLevel[gid];
  region.infrastructureLevel += 1;
  addChronicle(state, `Straßen und Wege in ${region.name} wurden ausgebaut (Infrastrukturstufe ${region.infrastructureLevel}).`);
  return { ok: true };
}

function currentDebtInterestRate(state) {
  const cfg = CONFIG.debt;
  const rate = cfg.baseInterestRate - state.prestige * cfg.prestigeInterestReduction - state.legitimacy * cfg.legitimacyInterestReduction;
  return clamp(rate, cfg.minInterestRate, cfg.maxInterestRate);
}

function takeLoan(state, amount) {
  if (amount <= 0) return { ok: false, reason: "Ungültiger Betrag." };
  state.treasury += amount;
  state.debt += amount;
  addChronicle(state, `Ein Kredit über ${amount} Taler wurde aufgenommen (Zinssatz ${(currentDebtInterestRate(state)*100).toFixed(1)}%).`);
  return { ok: true };
}

function repayDebt(state, amount) {
  if (amount <= 0) return { ok: false, reason: "Ungültiger Betrag." };
  const payable = Math.min(amount, state.debt, state.treasury);
  if (payable <= 0) return { ok: false, reason: "Keine Schulden oder keine Mittel zur Rückzahlung." };
  state.treasury -= payable;
  state.debt -= payable;
  addChronicle(state, `${payable} Taler Schulden wurden zurückgezahlt.`);
  return { ok: true };
}

// ---------- Erweiterte Diplomatie (§29) ----------

function updateLandPrice(state) {
  const cfg = CONFIG.land;
  const mid = (cfg.priceMin + cfg.priceMax) / 2;
  let delta = (mid - state.landPrice) * 0.05 * cfg.priceDriftStrength; // leichte Rückkehr zur Mitte
  delta += (rnd() * 2 - 1) * (cfg.priceMax - cfg.priceMin) * 0.08; // spekulative Schwankung
  state.landPrice = Math.round(clamp(state.landPrice + delta, cfg.priceMin, cfg.priceMax));
}

function buyLand(state, region, hectares) {
  if (hectares <= 0) return { ok: false, reason: "Ungültige Menge." };
  const cost = Math.round(hectares * state.landPrice);
  if (state.treasury < cost) return { ok: false, reason: "Nicht genug Taler für den Landkauf." };
  state.treasury -= cost;
  region.land += hectares;
  addChronicle(state, `${hectares} Hektar Land wurden für ${cost} Taler erworben.`);
  return { ok: true };
}

// ---------- Marktplatz: direkter Warenkauf/-verkauf (§20/§21/§73) ----------

function currentGoodPrice(region, gid) {
  return (region.prices && region.prices[gid]) || GOODS[gid].base;
}

function buyGoodFromMarket(state, region, gid, qty) {
  if (!GOODS[gid]) return { ok: false, reason: "Unbekannte Ware." };
  if (qty <= 0) return { ok: false, reason: "Ungültige Menge." };
  const price = currentGoodPrice(region, gid);
  const cost = Math.round(price * qty * (1 + CONFIG.market.buyMarkupShare));
  if (state.treasury < cost) return { ok: false, reason: "Nicht genug Taler für diesen Einkauf." };
  state.treasury -= cost;
  region.warehouse[gid] = (region.warehouse[gid] || 0) + qty;
  addChronicle(state, `${qty} ${GOODS[gid].name} für ${cost} Taler auf dem Markt gekauft.`);
  return { ok: true, cost };
}

function sellGoodToMarket(state, region, gid, qty) {
  if (!GOODS[gid]) return { ok: false, reason: "Unbekannte Ware." };
  if (qty <= 0) return { ok: false, reason: "Ungültige Menge." };
  const available = region.warehouse[gid] || 0;
  if (available < qty) return { ok: false, reason: `Nicht genug ${GOODS[gid].name} im Lager (vorhanden: ${Math.round(available)}).` };
  const price = currentGoodPrice(region, gid);
  const proceeds = Math.round(price * qty * (1 - CONFIG.market.sellCommissionShare));
  region.warehouse[gid] -= qty;
  state.treasury += proceeds;
  addChronicle(state, `${qty} ${GOODS[gid].name} für ${proceeds} Taler auf dem Markt verkauft.`);
  return { ok: true, proceeds };
}

// ---------- Regionalhandel: echte Arbitrage zwischen zwei konkreten Regionen (§20/§21) ----------

function rollBanditRisk(state, targetId) {
  const cfg = CONFIG.interregionalTrade;
  const hasTransitRights = targetId && state.diplomacy[targetId] && state.diplomacy[targetId].treaties.durchmarsch;
  const chance = hasTransitRights ? cfg.banditRiskChance * CONFIG.diplomacyExtra.transitRightsBanditRiskDiscount : cfg.banditRiskChance;
  if (rnd() < chance) return cfg.banditLossShare;
  return 0;
}

// Exportieren: Ware aus der Spielerregion im Zielmarkt verkaufen (zu dessen Preis)

function exportGoodToRegion(state, targetId, gid, qty) {
  if (!GOODS[gid]) return { ok: false, reason: "Unbekannte Ware." };
  if (qty <= 0) return { ok: false, reason: "Ungültige Menge." };
  const home = state.regions.player;
  const target = state.regions[targetId];
  const available = home.warehouse[gid] || 0;
  if (available < qty) return { ok: false, reason: `Nicht genug ${GOODS[gid].name} im eigenen Lager (vorhanden: ${Math.round(available)}).` };

  const cfg = CONFIG.interregionalTrade;
  const hasTransitRights = state.diplomacy[targetId] && state.diplomacy[targetId].treaties.durchmarsch;
  const transportCost = hasTransitRights ? cfg.transportCostShare * CONFIG.diplomacyExtra.transitRightsTransportDiscount : cfg.transportCostShare;
  home.warehouse[gid] -= qty;
  const lossShare = rollBanditRisk(state, targetId);
  const deliveredQty = qty * (1 - lossShare);
  const targetPrice = currentGoodPrice(target, gid);
  const proceeds = Math.round(targetPrice * deliveredQty * (1 - transportCost));
  state.treasury += proceeds;
  target.warehouse[gid] = (target.warehouse[gid] || 0) + deliveredQty;

  if (lossShare > 0) {
    addChronicle(state, `Ein Handelszug mit ${GOODS[gid].name} nach ${target.name} wurde von Räubern überfallen — nur ein Teil kam an. Erlös: ${proceeds} Taler.`);
  } else {
    addChronicle(state, `${qty} ${GOODS[gid].name} nach ${target.name} exportiert und dort für ${proceeds} Taler verkauft.`);
  }
  return { ok: true, proceeds, raided: lossShare > 0 };
}

// Importieren: Ware aus der Zielregion zu deren Preis kaufen und ins eigene Lager bringen

function importGoodFromRegion(state, sourceId, gid, qty) {
  if (!GOODS[gid]) return { ok: false, reason: "Unbekannte Ware." };
  if (qty <= 0) return { ok: false, reason: "Ungültige Menge." };
  const home = state.regions.player;
  const source = state.regions[sourceId];
  const available = source.warehouse[gid] || 0;
  if (available < qty) return { ok: false, reason: `${source.name} hat nicht genug ${GOODS[gid].name} auf Lager (vorhanden: ${Math.round(available)}).` };

  const cfg = CONFIG.interregionalTrade;
  const hasTransitRights = state.diplomacy[sourceId] && state.diplomacy[sourceId].treaties.durchmarsch;
  const transportCost = hasTransitRights ? cfg.transportCostShare * CONFIG.diplomacyExtra.transitRightsTransportDiscount : cfg.transportCostShare;
  const sourcePrice = currentGoodPrice(source, gid);
  const cost = Math.round(sourcePrice * qty * (1 + transportCost));
  if (state.treasury < cost) return { ok: false, reason: "Nicht genug Taler für diesen Einkauf." };

  source.warehouse[gid] -= qty;
  state.treasury -= cost;
  const lossShare = rollBanditRisk(state, sourceId);
  const deliveredQty = qty * (1 - lossShare);
  home.warehouse[gid] = (home.warehouse[gid] || 0) + deliveredQty;

  if (lossShare > 0) {
    addChronicle(state, `Ein Handelszug mit ${GOODS[gid].name} aus ${source.name} wurde von Räubern überfallen — nur ein Teil kam an. Kosten: ${cost} Taler.`);
  } else {
    addChronicle(state, `${qty} ${GOODS[gid].name} aus ${source.name} importiert für ${cost} Taler.`);
  }
  return { ok: true, cost, raided: lossShare > 0 };
}

function sellLand(state, region, hectares) {
  if (hectares <= 0) return { ok: false, reason: "Ungültige Menge." };
  const occupiedPlots = new Set(region.buildings.map(b => b.plotIndex)).size;
  const minHectares = occupiedPlots * CONFIG.land.hectaresPerPlot;
  if (region.land - hectares < minHectares) {
    return { ok: false, reason: "Dieses Land wird noch von deinen Gebäuden benötigt — zuerst Gebäude aufgeben oder weniger verkaufen." };
  }
  const cfg = CONFIG.land;
  const proceeds = Math.round(hectares * state.landPrice * (1 - cfg.saleCommission));
  region.land -= hectares;
  state.treasury += proceeds;
  addChronicle(state, `${hectares} Hektar Land wurden für ${proceeds} Taler verkauft (10 % Provision abgezogen).`);
  return { ok: true };
}

// ---------- Kornverteilung über den Bedarf hinaus (§Original-Tipp) ----------

function applyExtraGrainDistribution(state, r) {
  const cfg = CONFIG.grainDistribution;
  if (!r.extraGrainRate) return;
  const totalPop = Object.values(r.population).reduce((s,g)=>s+g.count,0);
  const desiredAmount = r.extraGrainRate * cfg.maxExtraPerCapita * totalPop * 0.01;
  const available = r.warehouse.getreide || 0;
  const given = Math.min(available, desiredAmount);
  r.warehouse.getreide -= given;
  const fulfillment = desiredAmount > 0 ? given / desiredAmount : 0;
  const satBonus = fulfillment * cfg.satisfactionBonusFactor * r.extraGrainRate;
  for (const pid in r.population) r.population[pid].satisfaction = clamp(r.population[pid].satisfaction + satBonus * 0.2, 0, 100);
  r._migrationBonus = fulfillment * cfg.migrationBonusFactor * r.extraGrainRate;
}

// ---------- Migration (§14) — Zufriedenheit lockt Zuwanderer an oder vertreibt Bevölkerung ----------

function generateResearchPoints(state, r) {
  const cfg = CONFIG.technology;
  const points = cfg.basePointsPerYear + buildingLevelSum(r, "universitaet") * cfg.pointsPerUniversityLevel;
  state.researchPoints = (state.researchPoints || 0) + points;
  return points;
}

function techUpgradeCost(currentLevel) {
  return CONFIG.technology.pointsPerLevel * (currentLevel + 1);
}

function investResearch(state, category) {
  const cfg = CONFIG.technology;
  if (!cfg.categories[category]) return { ok: false, reason: "Unbekannte Forschungskategorie." };
  const currentLevel = (state.technology && state.technology[category]) || 0;
  if (currentLevel >= cfg.maxLevel) return { ok: false, reason: "Höchststufe bereits erreicht." };
  const cost = techUpgradeCost(currentLevel);
  if ((state.researchPoints || 0) < cost) return { ok: false, reason: `Nicht genug Forschungspunkte (${cost} nötig).` };
  state.researchPoints -= cost;
  if (!state.technology) state.technology = {};
  state.technology[category] = currentLevel + 1;
  addChronicle(state, `Forschung abgeschlossen: ${cfg.categories[category].name} erreicht Stufe ${currentLevel + 1}.`);
  return { ok: true };
}

function techBonus(state, category) {
  const cfg = CONFIG.technology;
  const level = (state.technology && state.technology[category]) || 0;
  return level * cfg.categories[category].bonusPerLevel;
}

// ---------- Religion (§46) ----------
