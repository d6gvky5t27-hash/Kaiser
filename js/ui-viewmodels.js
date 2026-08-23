// ============================================================
// UI VIEWMODELS — Phase 8B "Main Screen + Map + HUD" (§54/55/110-113):
// reine Anzeige-Transformationen über bereits vorhandene state-Werte.
// KEINE Gameplaylogik, KEIN rnd()-Aufruf (§56/120/121) — jede Funktion
// hier liest nur bestehende, bereits simulierte Daten und formt sie in
// eine für die Oberfläche direkt nutzbare Form um. Getestet in
// tests/ui_viewmodel_test.js (u. a. §56: RNG-Neutralität).
// ============================================================

// ---------- HUD (Top Bar, §6-11) ----------
function getHudViewModel(state) {
  const r = state.regions.player;
  const ruler = state.characters[state.rulerId];
  const totalPop = Object.values(r.population).reduce((s, g) => s + g.count, 0);
  const currentTitle = TITLES[state.titleIndex];
  return {
    rulerName: ruler ? `${ruler.name} ${ruler.surname || ""}`.trim() : "–",
    rulerAge: ruler ? ruler.age : null,
    titleName: currentTitle ? currentTitle.name : "–",
    regionName: r.name,
    year: state.year,
    month: state.month,
    treasury: Math.round(state.treasury),
    population: totalPop,
    prestige: Math.round(state.prestige),
    legitimacy: Math.round(state.legitimacy),
    grainRatioPct: Math.round((r.grainRatio !== undefined ? r.grainRatio : 1) * 100),
  };
}

// ---------- Welt-/Regionskarte (§18-30) ----------
// Nutzt ausschließlich die bereits bestehende TERRITORIES-Graph-Struktur
// und state.territories (Besitzer/Garnison/Aufstellung, siehe
// js/war-map.js) — dieselbe Datenquelle, die die Kriegskarte seit Phase
// "Kriegskarte" bereits nutzt. Keine neue Kartenmechanik, nur eine
// zweite, dauerhaft sichtbare Darstellung derselben Daten.
function getWorldMapViewModel(state) {
  const nodes = TERRITORIES.map(t => {
    const terr = state.territories[t.id];
    const owner = state.regions[terr.owner];
    const isPlayer = terr.owner === "player";
    const strength = isPlayer
      ? Object.values(terr.deployment).reduce((a, b) => a + b, 0)
      : Math.round(terr.garrison);
    return {
      id: t.id, name: t.name, x: t.x, y: t.y, terrain: t.terrain, capital: !!t.capital,
      ownerId: terr.owner, ownerName: owner ? owner.name : terr.owner,
      isPlayerOwned: isPlayer, strength, hasForces: strength > 0,
    };
  });
  const lines = [];
  const drawn = new Set();
  for (const t of TERRITORIES) {
    for (const adjId of t.adjacent) {
      const key = [t.id, adjId].sort().join("|");
      if (drawn.has(key)) continue;
      drawn.add(key);
      const other = territoryById(adjId);
      lines.push({ x1: t.x, y1: t.y, x2: other.x, y2: other.y });
    }
  }
  return { territories: nodes, lines };
}

// ---------- Kontextpanel (§31-38) ----------
function foodStatusLabel(ratioPct) {
  if (ratioPct < 50) return "KRITISCH";
  if (ratioPct < 80) return "KNAPP";
  return "STABIL";
}
function levelLabel(pct) {
  if (pct < 35) return "SCHWACH";
  if (pct < 65) return "MITTEL";
  return "GUT";
}

// §Phase-8C-Korrektur: `population[gid].wealth` wird von der Simulation seit
// Erzeugung nie mehr aktualisiert (bleibt für immer beim Startwert 50) —
// als "Wohlstand" dargestellt wäre das eine Konstante, keine echte
// Wirtschaftskennzahl. Der Lagerwert (Bestand × aktueller Marktpreis) ist
// dagegen echt, dynamisch und für jede Region verfügbar (auch KI-Regionen
// ohne eigene Staatskasse) — wird deshalb ab hier als "Wohlstand"-Ersatz
// verwendet (siehe §Phase-8C-Punkt 4/44).
// §Phase-8C-Korrektur: `region.prices` wird erst nach dem ERSTEN
// abgeschlossenen Monat gesetzt (siehe processAllRegions() in
// js/advance-year.js) -- vorher bleibt es undefined, obwohl
// `region.priceBreakdown` durch andere Aufrufer (z. B. die bestehende
// Marktpreis-Tabelle) trotzdem schon frisch berechnet sein kann. Damit
// Preis-Anzeige und Preiserklärung nie auseinanderlaufen, gilt
// `priceBreakdown[gid].gesamt` als vorrangige, stets konsistente Quelle.
function resolveGoodPrice(region, gid) {
  if (region.priceBreakdown && region.priceBreakdown[gid]) return region.priceBreakdown[gid].gesamt;
  if (region.prices && region.prices[gid] !== undefined) return region.prices[gid];
  return GOODS[gid] ? GOODS[gid].base : 0;
}

function computeWarehouseValue(region) {
  let total = 0;
  for (const gid in region.warehouse) {
    total += (region.warehouse[gid] || 0) * resolveGoodPrice(region, gid);
  }
  return Math.round(total);
}

function getRegionSummaryViewModel(state, territoryId) {
  const t = territoryById(territoryId);
  if (!t) return null;
  const terr = state.territories[territoryId];
  const ownerId = terr.owner;
  const r = state.regions[ownerId];
  const totalPop = Object.values(r.population).reduce((s, g) => s + g.count, 0);
  const foodPct = Math.round((r.grainRatio !== undefined ? r.grainRatio : 1) * 100);
  const topGoods = Object.keys(r.warehouse)
    .map(gid => ({ id: gid, name: GOODS[gid] ? GOODS[gid].name : gid, stock: Math.round(r.warehouse[gid] || 0) }))
    .sort((a, b) => b.stock - a.stock)
    .slice(0, 5)
    .filter(g => g.stock > 0);
  const populationByGroup = Object.keys(r.population).map(gid => ({
    id: gid, name: POP_GROUPS[gid] ? POP_GROUPS[gid].name : gid,
    count: r.population[gid].count, satisfaction: Math.round(r.population[gid].satisfaction),
  }));
  const isPlayerTerritory = ownerId === "player";
  const militaryStrength = isPlayerTerritory
    ? Object.entries(terr.deployment).filter(([, v]) => v > 0).map(([k, v]) => ({ id: k, name: TROOP_TYPES[k] ? TROOP_TYPES[k].name : k, count: v }))
    : [{ id: "garrison", name: "Garnison (geschätzt)", count: Math.round(terr.garrison) }];
  const terrain = TERRAIN_TYPES[t.terrain] || TERRAIN_TYPES.ebene;
  const warehouseValue = computeWarehouseValue(r);

  // §Phase-8C-Punkt 48: WIRTSCHAFT-Tab des Kontextpanels -- Top-Produktion
  // und Engpässe aus denselben echten Feldern wie getEconomicRisksViewModel(),
  // hier aber für JEDE Region (r.lastProduction/r.priceBreakdown werden für
  // Spieler- und KI-Regionen identisch in processAllRegions() befüllt).
  let topProduction = [];
  let shortages = [];
  if (r.lastProduction) {
    topProduction = Object.keys(r.lastProduction)
      .map(gid => ({ id: gid, name: GOODS[gid] ? GOODS[gid].name : gid, amount: Math.round(r.lastProduction[gid]) }))
      .filter(g => g.amount > 0)
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);
    if (r.priceBreakdown) {
      for (const gid in r.lastProduction) {
        const production = r.lastProduction[gid] || 0;
        const consumption = r.priceBreakdown[gid] ? r.priceBreakdown[gid].nachfrage : 0;
        if (consumption > 0 && production < consumption * 0.85) {
          shortages.push({ id: gid, name: GOODS[gid] ? GOODS[gid].name : gid, shortfallPct: Math.round((1 - production / consumption) * 100) });
        }
      }
      shortages.sort((a, b) => b.shortfallPct - a.shortfallPct);
      shortages = shortages.slice(0, 5);
    }
  }
  // §Phase-8C-Punkt 49: BEVÖLKERUNG-Tab -- echtes Jahreswachstum (dieselbe
  // Quelle wie getPopulationOverviewViewModel(), nur regionsunabhängig).
  let populationGrowth = null;
  if (r.lastPopSummary) {
    const migration = r.lastNetMigration || 0;
    const yearlyDelta = Math.round((r.lastPopSummary.geburten || 0) - (r.lastPopSummary.todesfaelle || 0) + migration);
    const before = totalPop - yearlyDelta;
    populationGrowth = {
      yearlyDelta,
      yearlyPct: before > 0 ? Math.round((yearlyDelta / before) * 1000) / 10 : null,
      births: Math.round(r.lastPopSummary.geburten || 0),
      deaths: Math.round(r.lastPopSummary.todesfaelle || 0),
    };
  }

  return {
    territoryId, territoryName: t.name, terrainName: terrain.name, isCapital: !!t.capital,
    ownerId, ownerName: r.name, isPlayerTerritory,
    population: totalPop, satisfactionPct: Math.round(r.satisfactionAvg !== undefined ? r.satisfactionAvg : 55),
    satisfactionLabel: levelLabel(r.satisfactionAvg !== undefined ? r.satisfactionAvg : 55),
    foodPct, foodLabel: foodStatusLabel(foodPct),
    warehouseValue,
    topGoods, populationByGroup, militaryStrength,
    topProduction, shortages, populationGrowth,
  };
}

// ---------- Story Card (§12-15/43) ----------
// Bewusst NUR natürlichsprachliche Stufenbeschreibungen — keine
// Debug-Werte (Tension/Momentum/Director-Score bleiben im Debug-Panel,
// §14/53/145).
const THREAD_STAGE_TEXT = {
  BUILDING: "Die Spannungen wachsen.",
  ACTIVE: "Die Lage bleibt angespannt.",
  CLIMAX: "Der Konflikt erreicht einen Höhepunkt.",
  AFTERMATH: "Die Lage beruhigt sich.",
};
const THREAD_ICON_BY_TYPE = {
  SUCCESSION_CONFLICT: "⚜", PERSONAL_RIVALRY: "⚔", DYNASTIC_ALLIANCE: "💍",
  FOOD_CRISIS: "🌾", FOREIGN_CONFLICT: "🛡", IMPERIAL_AMBITION: "👑",
  RELIGIOUS_TENSION: "✝", ECONOMIC_CRISIS: "💰",
};

function getPrimaryStoryViewModel(state) {
  const activeNonDormant = getActiveStoryThreads(state).filter(t => t.status !== "DORMANT");
  if (!activeNonDormant.length) {
    return { hasFocus: false, quiet: true, message: "Das Reich befindet sich in ruhigen Jahren." };
  }
  const focusId = state.drama.focusThreadId;
  const focus = focusId ? activeNonDormant.find(t => t.id === focusId) : null;
  if (!focus) return { hasFocus: false, quiet: false };
  return {
    hasFocus: true, threadId: focus.id, title: focus.title,
    icon: THREAD_ICON_BY_TYPE[focus.type] || "⚜",
    stageText: THREAD_STAGE_TEXT[focus.status] || "Die Geschichte entwickelt sich weiter.",
  };
}

// ---------- Warnungen (§16-17) ----------
// Jede Warnung ist die direkte Übersetzung eines bereits real
// vorhandenen Simulationszustands — keine neue Schwelle ohne bestehendes
// Vorbild (Quellen sind kommentiert). Kein Wetter-Spam (§17): normales
// Wetter erzeugt hier grundsätzlich keinen Eintrag.
function getAlertViewModel(state) {
  const r = state.regions.player;
  const ruler = state.characters[state.rulerId];
  const critical = [];
  const important = [];
  const info = [];

  const foodRatio = r.grainRatio !== undefined ? r.grainRatio : 1;
  if (foodRatio < 0.5) critical.push({ id: "food_critical", text: "Nahrung kritisch" }); // vgl. debug-Event-Bedingung "kritische Hungerkrise" (index.html)

  for (const aiId in state.warState) {
    if (state.warState[aiId]) critical.push({ id: "war_" + aiId, text: `Krieg mit ${state.regions[aiId].name}` });
  }

  if (ruler) {
    const livingChildren = ruler.childrenIds.map(id => state.characters[id]).filter(c => c && c.alive);
    if (livingChildren.length === 0) critical.push({ id: "no_heir", text: "Thronfolge ungeklärt" });
    else if (livingChildren.some(c => c.age >= CONFIG.eventChains.adultAge && !c.spouseId)) {
      important.push({ id: "heir_unmarried", text: "Thronfolger unverheiratet" });
    }
  }

  if (state.treasury < 0) important.push({ id: "treasury_low", text: "Staatskasse im Minus" }); // vgl. computeDramaTensionBreakdown() "weakEconomy"

  const growingRivalry = getActiveStoryThreads(state).find(t =>
    (t.type === "PERSONAL_RIVALRY" || t.type === "SUCCESSION_CONFLICT") && t.status === "BUILDING");
  if (growingRivalry) important.push({ id: "rivalry_" + growingRivalry.id, text: `Rivalität wächst: ${growingRivalry.title}` });

  const nextTitle = TITLES[state.titleIndex + 1];
  if (nextTitle) {
    const totalPop = Object.values(r.population).reduce((s, g) => s + g.count, 0);
    const popProgress = nextTitle.reqPop > 0 ? totalPop / nextTitle.reqPop : 1;
    const wealthProgress = nextTitle.reqWealth > 0 ? state.treasury / nextTitle.reqWealth : 1;
    const prestigeProgress = nextTitle.reqPrestige > 0 ? state.prestige / nextTitle.reqPrestige : 1;
    if (popProgress >= 0.8 && wealthProgress >= 0.8 && prestigeProgress >= 0.8) {
      info.push({ id: "title_close", text: `Titelaufstieg in Sicht: ${nextTitle.name}` });
    }
  }

  return { critical, important, info };
}

// ---------- Jahreswechsel-Hinweis (§11) ----------
function getYearTransitionViewModel(state) {
  let pendingCount = 0;
  if (state.pendingEvent) pendingCount++;
  if (state.pendingElection) pendingCount++;
  return {
    nextYear: state.year + (state.month >= 12 ? 1 : 0),
    pendingCount,
    pendingLabel: pendingCount === 0 ? "Keine dringenden Angelegenheiten"
      : pendingCount === 1 ? "1 wichtige Entscheidung offen"
      : `${pendingCount} wichtige Entscheidungen offen`,
  };
}

// ============================================================
// §Phase-8C "Reich + Provinz + Wirtschaft": weitere reine ViewModels.
// Dieselben Regeln wie oben — nur Aggregation/Formatierung existierender
// state-Werte (§66), kein rnd(), keine neue Gameplaylogik (§72/31).
// Trends werden AUSSCHLIESSLICH aus tatsächlich vorhandenen Vorjahres-/
// Vormonatsdaten gebildet (state.lastMonthlyReport, r.lastPopBreakdown/
// lastPopSummary/lastNetMigration, r.lastProduction) — es gibt KEINE
// mehrjährige Zeitreihe im Spielstand; wo keine echte Vergleichsbasis
// existiert, bleibt das Feld `null` statt einer erfundenen Zahl (§5/§21/§42).
// ============================================================

function statusLabelForPct(pct, thresholds) {
  if (pct < thresholds.critical) return "KRITISCH";
  if (pct < thresholds.tense) return "ANGESPANNT";
  return "STABIL";
}

// ---------- Reichsübersicht (§3-9) ----------
function getRealmEconomyViewModel(state) {
  const r = state.regions.player;
  const report = state.lastMonthlyReport;
  const totalPop = Object.values(r.population).reduce((s, g) => s + g.count, 0);
  const foodPct = Math.round((r.grainRatio !== undefined ? r.grainRatio : 1) * 100);
  const satisfactionPct = Math.round(r.satisfactionAvg !== undefined ? r.satisfactionAvg : 55);
  const warehouseValue = computeWarehouseValue(r);

  // §5: Treasury-Trend nur als "letzter Monat" -- das ist die einzige echte,
  // bereits gespeicherte Vergleichsbasis (kein mehrjähriges Zeitreihen-
  // Tracking im Spielstand, siehe Kommentar oben). Explizit korrekt
  // benannt statt fälschlich als Jahrestrend ausgegeben.
  const treasuryMonthlyNet = report ? Math.round(report.net) : null;

  // Bevölkerungstrend IST ein echter Jahreswert (Geburten - Todesfälle +
  // Wanderungssaldo aus dem zuletzt abgeschlossenen Jahr).
  let populationYearlyDelta = null, populationYearlyPct = null;
  if (r.lastPopSummary) {
    const migration = r.lastNetMigration || 0;
    populationYearlyDelta = Math.round((r.lastPopSummary.geburten || 0) - (r.lastPopSummary.todesfaelle || 0) + migration);
    const before = totalPop - populationYearlyDelta;
    populationYearlyPct = before > 0 ? Math.round((populationYearlyDelta / before) * 1000) / 10 : null;
  }

  return {
    treasury: Math.round(state.treasury),
    treasuryMonthlyNet,
    treasuryStatus: state.treasury < 0 ? "KRITISCH" : (state.treasury < 300 ? "ANGESPANNT" : "STABIL"), // vgl. weakEconomy-Schwelle (state.treasury<0) aus drama-director.js
    debt: Math.round(state.debt || 0),
    population: totalPop,
    populationYearlyDelta, populationYearlyPct,
    populationStatus: populationYearlyDelta === null ? null : (populationYearlyDelta > 0 ? "WACHSTUM" : (populationYearlyDelta < 0 ? "RÜCKGANG" : "STABIL")),
    foodPct, foodStatus: foodStatusLabel(foodPct),
    satisfactionPct, satisfactionStatus: statusLabelForPct(satisfactionPct, { critical: 35, tense: 55 }),
    warehouseValue,
  };
}

// ---------- Mini-Kassenbuch (§8-10) ----------
// Nutzt ausschließlich state.lastMonthlyReport (js/advance-year.js
// applyMonthlyFinances()) -- das bestehende Ledger bleibt unverändert,
// dies ist nur eine kompakte Voransicht derselben Felder (§10).
function getMiniLedgerViewModel(state) {
  const report = state.lastMonthlyReport;
  if (!report) return { available: false };
  const income = [];
  const expenses = [];
  if (report.taxIncome) income.push({ label: "Steuern", amount: Math.round(report.taxIncome) });
  if (report.vassalTribute) income.push({ label: "Vasallentribut", amount: Math.round(report.vassalTribute) });
  if (report.upkeep) expenses.push({ label: "Armee", amount: -Math.round(report.upkeep) });
  if (report.salaries) expenses.push({ label: "Hof (Berater)", amount: -Math.round(report.salaries) });
  if (report.debtInterest) expenses.push({ label: "Schuldzinsen", amount: -Math.round(report.debtInterest) });
  for (const entry of (report.otherEntries || [])) {
    const amount = Math.round(entry.amount);
    if (amount >= 0) income.push({ label: entry.label, amount });
    else expenses.push({ label: entry.label, amount });
  }
  return {
    available: true, year: report.year, month: report.month,
    income, expenses, net: Math.round(report.net),
  };
}

// ---------- Bevölkerung (§11-14) ----------
function getPopulationOverviewViewModel(state) {
  const r = state.regions.player;
  const totalPop = Object.values(r.population).reduce((s, g) => s + g.count, 0);
  const groups = Object.keys(r.population)
    .map(gid => ({
      id: gid, name: POP_GROUPS[gid] ? POP_GROUPS[gid].name : gid,
      count: r.population[gid].count,
      sharePct: totalPop > 0 ? Math.round((r.population[gid].count / totalPop) * 1000) / 10 : 0,
      satisfaction: Math.round(r.population[gid].satisfaction),
    }))
    .sort((a, b) => b.count - a.count);
  let yearlyDelta = null, yearlyPct = null;
  if (r.lastPopSummary) {
    const migration = r.lastNetMigration || 0;
    yearlyDelta = Math.round((r.lastPopSummary.geburten || 0) - (r.lastPopSummary.todesfaelle || 0) + migration);
    const before = totalPop - yearlyDelta;
    yearlyPct = before > 0 ? Math.round((yearlyDelta / before) * 1000) / 10 : null;
  }
  return { totalPop, yearlyDelta, yearlyPct, groups };
}

function getPopulationGroupDetailViewModel(state, groupId) {
  const r = state.regions.player;
  const g = r.population[groupId];
  const def = POP_GROUPS[groupId];
  if (!g || !def) return null;
  const needs = Object.keys(def.needs).map(gid => ({ id: gid, name: GOODS[gid] ? GOODS[gid].name : gid, amountPerCapita: def.needs[gid] }));
  const report = state.lastMonthlyReport;
  const monthlyTaxIncome = report && report.taxBreakdown ? Math.round(report.taxBreakdown[groupId] || 0) : null;
  const bd = r.lastPopBreakdown && r.lastPopBreakdown[groupId] ? r.lastPopBreakdown[groupId] : null;
  return {
    id: groupId, name: def.name, count: g.count, satisfaction: Math.round(g.satisfaction),
    taxWeight: def.weight, needs, monthlyTaxIncome,
    yearlyBirths: bd ? Math.round(bd.geburten || 0) : null,
    yearlyDeaths: bd ? Math.round((bd.alterstod || 0) + (bd.hungertote || 0) + (bd.seuchentote || 0)) : null,
  };
}

// ---------- Nahrung (§15/16) ----------
function getFoodSupplyViewModel(state) {
  const r = state.regions.player;
  const need = r.grainNeed || 0;
  const available = r.grainAvailable !== undefined ? r.grainAvailable : (r.warehouse.getreide || 0);
  const ratio = r.grainRatio !== undefined ? r.grainRatio : 1;
  const pct = Math.round(ratio * 100);
  let forecast;
  if (pct >= 100) forecast = "ausreichend";
  else if (pct >= 80) forecast = "knapp ausreichend";
  else if (pct >= 50) forecast = "angespannt";
  else forecast = "kritisch";
  return {
    pct, status: foodStatusLabel(pct),
    stock: Math.round(available), yearlyNeed: Math.round(need),
    forecast,
    criticalWarning: pct < 50
      ? "Bei unveränderter Lage reichen die Vorräte weniger als ein Jahr."
      : null,
  };
}

// ---------- Waren nach Kategorie (§17-24) ----------
// GOODS[gid].category ist bereits echte Daten (grundnahrung/rohstoff/
// verarbeitet/luxus) -- wird hier nur auf die im Auftrag vorgeschlagenen
// deutschen Anzeigenamen abgebildet, keine neue Datenstruktur.
const GOODS_CATEGORY_LABEL = {
  grundnahrung: "NAHRUNG", rohstoff: "ROHSTOFFE", verarbeitet: "HANDWERK", luxus: "LUXUS",
};

function getGoodsCategoryViewModel(state) {
  const r = state.regions.player;
  const categories = {};
  for (const gid in GOODS) {
    const cat = GOODS[gid].category || "sonstiges";
    const label = GOODS_CATEGORY_LABEL[cat] || cat.toUpperCase();
    if (!categories[label]) categories[label] = [];
    const production = r.lastProduction && r.lastProduction[gid] !== undefined ? Math.round(r.lastProduction[gid]) : null;
    const consumption = r.priceBreakdown && r.priceBreakdown[gid] ? Math.round(r.priceBreakdown[gid].nachfrage) : null;
    categories[label].push({
      id: gid, name: GOODS[gid].name, price: resolveGoodPrice(r, gid),
      stock: Math.round(r.warehouse[gid] || 0), production, consumption,
      gap: (production !== null && consumption !== null) ? Math.round(production - consumption) : null,
    });
  }
  for (const label in categories) categories[label].sort((a, b) => b.stock - a.stock);
  return { categories, order: ["NAHRUNG", "ROHSTOFFE", "HANDWERK", "LUXUS"].filter(c => categories[c]) };
}

// ---------- Waren-Detail + Preiserklärung (§19-23) ----------
function getGoodDetailViewModel(state, goodId) {
  const good = GOODS[goodId];
  const r = state.regions.player;
  if (!good) return null;
  const pb = r.priceBreakdown && r.priceBreakdown[goodId] ? r.priceBreakdown[goodId] : null;
  const production = r.lastProduction && r.lastProduction[goodId] !== undefined ? Math.round(r.lastProduction[goodId]) : null;
  return {
    id: goodId, name: good.name, category: GOODS_CATEGORY_LABEL[good.category] || good.category,
    price: resolveGoodPrice(r, goodId),
    stock: Math.round(r.warehouse[goodId] || 0),
    production, consumption: pb ? Math.round(pb.nachfrage) : null,
    priceBreakdown: pb ? {
      basis: pb.basis, knappheit: pb.nachfrage - pb.angebot, nachfrage: pb.nachfrage,
      angebot: pb.angebot, marktstimmung: pb.marktstimmung, multiplikator: pb.multiplikator, gesamt: pb.gesamt,
    } : null,
    chain: getProductionChainViewModel(state, goodId),
  };
}

// ---------- Produktionskette (§27-31) ----------
// Reine Auswertung der bestehenden PRODUCTION_CHAINS-Rezeptliste -- keine
// neue Produktionslogik, nur Darstellung (§31).
function getProductionChainViewModel(state, goodId) {
  const producedBy = PRODUCTION_CHAINS.filter(c => c.output === goodId);
  const consumedBy = PRODUCTION_CHAINS.filter(c => c.input === goodId);
  return {
    inputs: producedBy.map(c => ({
      inputGoodId: c.input, inputGoodName: c.input && GOODS[c.input] ? GOODS[c.input].name : null,
      buildingId: c.building, buildingName: c.building && BUILDINGS[c.building] ? BUILDINGS[c.building].name : null,
      workerGroup: c.workerGroup, workerGroupName: POP_GROUPS[c.workerGroup] ? POP_GROUPS[c.workerGroup].name : c.workerGroup,
    })),
    outputs: consumedBy.map(c => ({
      outputGoodId: c.output, outputGoodName: GOODS[c.output] ? GOODS[c.output].name : c.output,
      buildingId: c.building, buildingName: c.building && BUILDINGS[c.building] ? BUILDINGS[c.building].name : null,
    })),
  };
}

// ---------- Handel (§32-36) ----------
function getTradeViewModel(state) {
  const cfg = CONFIG.interregionalTrade;
  const partners = [];
  for (const aiId in state.diplomacy) {
    const dip = state.diplomacy[aiId];
    if (!dip.treaties.handel) continue;
    const transitDiscount = dip.treaties.durchmarsch ? CONFIG.diplomacyExtra.transitRightsBanditRiskDiscount : 1;
    const riskPct = Math.round(cfg.banditRiskChance * transitDiscount * 100);
    partners.push({
      id: aiId, name: state.regions[aiId].name, relation: Math.round(dip.relation),
      hasTransitRights: !!dip.treaties.durchmarsch, riskPct,
      riskLabel: riskPct >= 12 ? "MITTEL" : (riskPct >= 6 ? "GERING" : "SEHR GERING"),
    });
  }
  return {
    partners,
    transportCostPct: Math.round(cfg.transportCostShare * 100),
    baseBanditRiskPct: Math.round(cfg.banditRiskChance * 100),
    banditLossSharePct: Math.round(cfg.banditLossShare * 100),
  };
}

// ---------- Steuern (§37-42) ----------
// Nur EIN Steuersatz existiert (regionsweit, kein Satz pro Gruppe) —
// wird hier ehrlich als gemeinsamer Satz je Gruppe dargestellt, nicht als
// erfundene Differenzierung. Der Zufriedenheitseffekt ist in der
// Simulation ebenfalls ein einziger, für alle Gruppen gleicher Term
// (js/economy.js consumeAndUpdateSatisfaction(), §Punkt 7 Forschungsbericht).
function getTaxViewModel(state) {
  const r = state.regions.player;
  const report = state.lastMonthlyReport;
  const sharedRatePct = Math.round(r.taxRate * 1000) / 10;
  const sharedYearlySatisfactionEffect = -Math.round(r.taxRate * CONFIG.population.taxSatisfactionPenalty * 10) / 10;
  const groups = Object.keys(r.population).map(gid => ({
    id: gid, name: POP_GROUPS[gid] ? POP_GROUPS[gid].name : gid,
    ratePct: sharedRatePct,
    monthlyIncome: (report && report.taxBreakdown) ? Math.round(report.taxBreakdown[gid] || 0) : null,
    satisfactionEffect: sharedYearlySatisfactionEffect,
  }));
  return {
    sharedRatePct, sharedYearlySatisfactionEffect,
    totalMonthlyIncome: report ? Math.round(report.taxIncome) : null,
    groups,
  };
}

// ---------- Provinzübersicht (§43-45) ----------
function getProvinceListViewModel(state) {
  const ids = ["player", "ai1", "ai2", "ai3"];
  const list = ids.map(id => {
    const r = state.regions[id];
    const totalPop = Object.values(r.population).reduce((s, g) => s + g.count, 0);
    const foodPct = Math.round((r.grainRatio !== undefined ? r.grainRatio : 1) * 100);
    const satisfactionPct = Math.round(r.satisfactionAvg !== undefined ? r.satisfactionAvg : 55);
    const topGood = Object.keys(r.warehouse)
      .map(gid => ({ id: gid, name: GOODS[gid] ? GOODS[gid].name : gid, stock: r.warehouse[gid] || 0 }))
      .sort((a, b) => b.stock - a.stock)[0];
    let warning = null;
    if (foodPct < 50) warning = "Nahrung kritisch";
    else if (satisfactionPct < 35) warning = "Unzufriedenheit hoch";
    return {
      id, name: r.name, isPlayer: id === "player",
      population: totalPop, foodPct, satisfactionPct,
      warehouseValue: computeWarehouseValue(r),
      topGoodName: topGood ? topGood.name : null,
      warning,
    };
  });
  return list;
}

// ---------- Wirtschaftliche Risiken (§25/26) ----------
// Nur bereits berechenbare Probleme (Produktions-/Verbrauchslücke aus
// r.lastProduction, hohe Preise aus dem Multiplikator, Handelsrisiko aus
// CONFIG.interregionalTrade) -- keine neuen Schwellen ohne Vorbild (§26).
function getEconomicRisksViewModel(state) {
  const r = state.regions.player;
  const risks = [];
  if (r.lastProduction && r.priceBreakdown) {
    for (const gid in GOODS) {
      const production = r.lastProduction[gid] || 0;
      const consumption = r.priceBreakdown[gid] ? r.priceBreakdown[gid].nachfrage : 0;
      if (consumption > 0 && production < consumption * 0.85) {
        const shortfallPct = Math.round((1 - production / consumption) * 100);
        risks.push({ id: "shortfall_" + gid, goodId: gid, goodName: GOODS[gid].name, kind: "shortfall",
          text: `${GOODS[gid].name}: Produktion liegt ${shortfallPct}% unter Verbrauch.` });
      }
    }
  }
  if (r.priceBreakdown) {
    for (const gid in r.priceBreakdown) {
      if (r.priceBreakdown[gid].multiplikator >= 2.0) {
        risks.push({ id: "price_" + gid, goodId: gid, goodName: GOODS[gid].name, kind: "price",
          text: `${GOODS[gid].name}: Preis sehr hoch (${Math.round(r.priceBreakdown[gid].multiplikator * 100)}% des Grundpreises).` });
      }
    }
  }
  const trade = getTradeViewModel(state);
  const riskyPartner = trade.partners.find(p => p.riskLabel === "MITTEL");
  if (riskyPartner) risks.push({ id: "trade_risk_" + riskyPartner.id, kind: "trade",
    text: `Handel mit ${riskyPartner.name}: erhöhtes Räuberrisiko (${riskyPartner.riskPct}%).` });
  return risks.slice(0, 8);
}
