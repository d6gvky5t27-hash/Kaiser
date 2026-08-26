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
    // §Phase-8C.1-Punkt 31/40: "attackable" ist kein neuer Gameplay-Zustand,
    // sondern dieselbe Bedingung, die js/war-map.js bereits für einen
    // gültigen Angriff prüft (Krieg + direkte Adjazenz zu eigenem Gebiet,
    // siehe aiTerritoryCounterAttack()) -- hier nur zur dezenten
    // Hervorhebung auf der REICH-Karte, der eigentliche Angriff bleibt
    // weiterhin über die unveränderte Kriegskarte.
    const attackable = !isPlayer && !!state.warState[terr.owner]
      && t.adjacent.some(adjId => state.territories[adjId].owner === "player");
    // §Punkt 30: "ally" nutzt ausschließlich das bereits reale
    // state.diplomacy[...].treaties.allianz (js/diplomacy.js).
    const dip = state.diplomacy[terr.owner];
    const ally = !isPlayer && !!(dip && dip.treaties && dip.treaties.allianz);
    return {
      id: t.id, name: t.name, x: t.x, y: t.y, terrain: t.terrain, capital: !!t.capital,
      ownerId: terr.owner, ownerName: owner ? owner.name : terr.owner,
      isPlayerOwned: isPlayer, strength, hasForces: strength > 0, attackable, ally,
    };
  });
  // §Phase-8C.1-Punkt 8: die frühere Netzwerklinien-Liste entfällt --
  // js/map-geometry.js (per Generator validiert) bildet JEDE deklarierte
  // Adjazenz bereits als echte gemeinsame Gebietsgrenze ab, eine separate
  // Verbindungslinien-Darstellung ist damit nicht mehr nötig.
  return { territories: nodes };
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
// §Phase-8F-Punkt 39: alle 6 Status natürlichsprachlich (vorher fehlten
// DORMANT/RESOLVED -- fielen auf den generischen Fallback-Text zurück).
const THREAD_STAGE_TEXT = {
  DORMANT: "Der Konflikt ruht.",
  BUILDING: "Die Spannungen wachsen.",
  ACTIVE: "Der Konflikt bestimmt den Hof.",
  CLIMAX: "Die Lage spitzt sich zu.",
  AFTERMATH: "Die Folgen wirken nach.",
  RESOLVED: "Die Geschichte ist beendet.",
};
// §Phase-8F-Fund: RELIGIOUS_CONFLICT ist der reale Thread-Typ (siehe
// STORY_THREAD_TYPES/CHAIN_THREAD_TYPE in js/story-threads.js) -- der
// bisherige Schlüssel "RELIGIOUS_TENSION" war ein Tippfehler aus 8B, der
// seit Einführung des Typs in Phase 6 stumm auf den "⚜"-Fallback zurückfiel.
const THREAD_ICON_BY_TYPE = {
  SUCCESSION_CONFLICT: "⚜", PERSONAL_RIVALRY: "⚔", DYNASTIC_ALLIANCE: "💍",
  FOOD_CRISIS: "🌾", FOREIGN_CONFLICT: "🛡", IMPERIAL_AMBITION: "👑",
  RELIGIOUS_CONFLICT: "✝", ECONOMIC_CRISIS: "💰",
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

// ============================================================
// §Phase-8D "Hof + Dynastie + Charaktere": Menschen statt Zahlen. Reine
// Anzeige-Transformationen über das bereits reale Charaktermodell
// (js/characters.js: computeRelationshipBreakdown/computeLoyalty/Claims/
// Rivalitäten, js/memory.js: World Memory, js/story-threads.js) -- KEINE
// Gameplaylogik, KEIN rnd()-Aufruf. Portrait-/Wappen-Varianz kommt aus
// einem deterministischen String-Hash (§69), nie aus der Simulations-RNG.
// ============================================================

// ---------- deterministischer Hash (§69: kein Math.random()/rnd()) ----------
function hashStringToInt(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

// ---------- Portrait-Platzhalter (§5/6/7/8) ----------
// Rein aus vorhandenen Charakterdaten abgeleitet: Geschlecht, Alter, Rang
// (Herrscher/Hofamt/Adel), Haus. Liefert nur einen BESCHREIBENDEN
// Datensatz -- das eigentliche SVG-Bauteil entsteht in index.html
// (Darstellung bleibt Sache der Render-Schicht, siehe Trennung in
// js/ui-viewmodels.js überall sonst in diesem Modul).
function ageGroupOf(age) {
  if (age < 14) return "kind";
  if (age < 26) return "jung";
  if (age < 56) return "erwachsen";
  return "alt";
}
const PORTRAIT_RANK = { herrscher: 4, hoch: 3, amt: 2, adel: 1 };
// §Phase-8E: ein fremder Herrscher (state.regions[aiId].rulerId) ist kein
// state.rulerId, soll aber optisch genauso als Herrscher lesbar sein (Krone),
// nicht als beliebiger Adliger -- dieselbe kleine Prüfung wie überall sonst
// in diesem Modul, wenn ein fremder Herrscher gemeint sein könnte.
function isAnyRulerCharacter(state, characterId) {
  if (characterId === state.rulerId) return true;
  for (const aiId in state.diplomacy) {
    if (state.regions[aiId] && state.regions[aiId].rulerId === characterId) return true;
  }
  return false;
}
function getForeignRulerRegionId(state, characterId) {
  for (const aiId in state.diplomacy) {
    if (state.regions[aiId] && state.regions[aiId].rulerId === characterId) return aiId;
  }
  return null;
}
function getPortraitViewModel(state, characterId) {
  const c = state.characters[characterId];
  if (!c) return null;
  const isRuler = isAnyRulerCharacter(state, characterId);
  const rank = isRuler ? "herrscher" : (c.advisorRole ? "amt" : (c.claims.some(cl => cl.strength === "primary" || cl.strength === "strong") ? "hoch" : "adel"));
  const seed = hashStringToInt(characterId + "|" + c.name + "|" + (c.surname || ""));
  return {
    gender: c.gender, ageGroup: ageGroupOf(c.age), alive: c.alive, rank, rankOrder: PORTRAIT_RANK[rank],
    variant: seed % 5, // rein dekorative Formvariante (Haartracht/Kopfbedeckung), kein Gameplaybezug
    initials: (c.name ? c.name[0] : "?") + (c.surname ? c.surname.replace(/^von\s+/, "")[0] : ""),
  };
}

// ---------- Wappen-Platzhalter (§47-49) ----------
// Klein und sauber gehalten (§49: "keine Heraldik-Engine als neues
// Projekt") -- ein deterministischer Hash aus dem Hausnamen wählt aus
// wenigen festen Paletten/Mustern/Symbolen, KEIN rnd().
const HERALDRY_FIELD_COLORS = ["#6e2226", "#1b2534", "#33472e", "#4a3524", "#3d5570", "#63633a"];
const HERALDRY_CHARGE_COLORS = ["#b3893f", "#f2e6c9", "#8a3d3d", "#a97e34"];
const HERALDRY_DIVISIONS = ["plain", "fess", "pale", "chevron"];
const HERALDRY_SYMBOLS = ["lion", "eagle", "tower", "star", "boar"];
function getHeraldryViewModel(houseName) {
  const seed = hashStringToInt(houseName || "Kaisersberg");
  return {
    fieldColor: HERALDRY_FIELD_COLORS[seed % HERALDRY_FIELD_COLORS.length],
    chargeColor: HERALDRY_CHARGE_COLORS[Math.floor(seed / 7) % HERALDRY_CHARGE_COLORS.length],
    division: HERALDRY_DIVISIONS[Math.floor(seed / 13) % HERALDRY_DIVISIONS.length],
    symbol: HERALDRY_SYMBOLS[Math.floor(seed / 29) % HERALDRY_SYMBOLS.length],
  };
}

// ---------- Trait-Badges (§13-15) ----------
// TRAITS in data/gamedata.js trägt nur `name` + ein reines effects-Objekt,
// keine vorgeschriebenen Beschreibungssätze (siehe Recherche zu Phase 8D)
// -- die Kurzbeschreibung entsteht hier GENERISCH aus den echten
// effects-Schlüsseln (kein erfundener Fließtext pro Trait, keine
// erfundenen Zahlen: die Werte kommen direkt aus TRAITS[i].effects).
const TRAIT_EFFECT_LABEL = {
  prestigeGain: "Prestigegewinn", loyaltyMod: "Loyalität", claimAggression: "Anspruchs-Ehrgeiz",
  treasuryDrain: "Staatskasse", satisfactionBonus: "Zufriedenheit", productionBonus: "Produktion",
  advisorEffectMod: "Amtswirkung", relationshipMod: "Beziehung (fremde Sicht)",
  memoryDecayModPositive: "Verblassen guter Erinnerungen", memoryDecayModNegative: "Verblassen schlechter Erinnerungen",
  memoryWeightAmplifierNegative: "Gewicht schlechter Erinnerungen",
};
function fmtEffectValue(key, v) {
  if (key === "prestigeGain" || key === "treasuryDrain" || key === "productionBonus" || key === "advisorEffectMod") return (v >= 0 ? "+" : "") + Math.round(v * 100) + "%";
  return (v >= 0 ? "+" : "") + v;
}
function getTraitBadgeViewModel(traitId) {
  const t = TRAITS.find(x => x.id === traitId);
  if (!t) return null;
  const effectParts = Object.keys(t.effects).map(k => `${TRAIT_EFFECT_LABEL[k] || k} ${fmtEffectValue(k, t.effects[k])}`);
  return { id: traitId, name: t.name, effectText: effectParts.join(" · ") || "Keine spielmechanische Wirkung." };
}

// ---------- Anspruchs-/Beziehungs-/Loyalitäts-Beschriftung ----------
const CLAIM_STRENGTH_LABEL = { weak: "Schwacher Anspruch", strong: "Starker Anspruch", primary: "Vorrangiger Anspruch" };
const CLAIM_REASON_LABEL = {
  eldest_child: "ältestes Kind des Herrschers", child: "Kind des Herrschers",
  sibling_of_ruler: "Geschwister des Herrschers", succession_passed_over: "bei der Nachfolge übergangen",
};
// Strukturelle (nicht-memory-basierte) Beziehungsgründe aus
// computeRelationshipBreakdown() -- die memory-basierten Modifikatoren
// tragen bereits eine echte, vorformulierte Beschreibung (memory.description).
const RELATIONSHIP_STRUCTURAL_LABEL = {
  eltern_kind: "Eltern-Kind-Verhältnis", geschwister: "Geschwister", ehepartner: "Ehepartner",
  gleiches_haus: "gleiches Haus", amt_innehat: "bekleidet ein Hofamt", charisma: "Charisma",
};
function labelForRelationshipModifier(state, m) {
  if (m.memoryId && state.memories.byId[m.memoryId]) return state.memories.byId[m.memoryId].description;
  return RELATIONSHIP_STRUCTURAL_LABEL[m.source] || m.source;
}
// §17: echte, bereits vorhandene Berechnung (computeRelationshipBreakdown),
// hier nur mit Anzeige-Labels versehen -- keine neue Zahl erfunden.
function getRelationshipDisplayViewModel(state, fromId, toId) {
  const breakdown = computeRelationshipBreakdown(state, fromId, toId);
  return {
    total: breakdown.total,
    components: breakdown.modifiers.map(m => ({ label: labelForRelationshipModifier(state, m), value: Math.round(m.value * 10) / 10, year: m.year || null })),
  };
}
// §18: spiegelt computeLoyalty() rein lesend für die Anzeige -- dieselbe
// Formel wie js/characters.js, keine zweite abweichende Berechnung.
function getLoyaltyDisplayViewModel(state, characterId) {
  if (characterId === state.rulerId) return { total: 100, components: [{ label: "Der Herrscher ist sich selbst treu", value: 100 }] };
  const c = state.characters[characterId];
  if (!c) return { total: 50, components: [] };
  const rel = computeRelationshipBreakdown(state, characterId, state.rulerId);
  const components = [{ label: "Basis", value: 50 }];
  components.push({ label: "Beziehung zum Herrscher", value: Math.round(rel.total * 0.3 * 10) / 10 });
  const traitLoyalty = traitEffectSum(c, "loyaltyMod");
  if (traitLoyalty) components.push({ label: "Charakterzüge", value: traitLoyalty });
  if (c.advisorRole) components.push({ label: "Hofamt", value: 8 });
  const legTerm = Math.round((state.legitimacy - 50) * 0.1 * 10) / 10;
  if (legTerm) components.push({ label: "Legitimität des Herrschers", value: legTerm });
  const relevantClaim = c.claims.find(cl => cl.titleId === "player" && cl.strength !== "none");
  if (relevantClaim) {
    const claimBase = { weak: 4, strong: 12, primary: 20 }[relevantClaim.strength] || 0;
    const aggression = traitEffectSum(c, "claimAggression");
    components.push({ label: `Eigener Anspruch (${CLAIM_STRENGTH_LABEL[relevantClaim.strength]})`, value: -Math.round((claimBase + aggression * 0.5) * 10) / 10 });
  }
  const total = Math.round(clamp(components.reduce((s, x) => s + x.value, 0), 0, 100));
  return { total, components };
}

// ---------- Rollen-Label (wer ist diese Person für den Herrscher?) ----------
function getCharacterRoleLabel(state, characterId) {
  const c = state.characters[characterId];
  const ruler = state.characters[state.rulerId];
  if (!c) return "";
  if (characterId === state.rulerId) return c.gender === "m" ? "Herrscher" : "Herrscherin";
  const foreignRegionId = getForeignRulerRegionId(state, characterId);
  if (foreignRegionId && c.alive) {
    const rname = state.regions[foreignRegionId].name.replace(/\s*\(.*\)$/, "");
    return (c.gender === "m" ? "Herrscher von " : "Herrscherin von ") + rname;
  }
  if (!c.alive) return "Verstorben";
  if (ruler && characterId === ruler.spouseId) return c.gender === "m" ? "Gemahl" : "Gemahlin";
  if (c.advisorRole && ADVISOR_ROLES[c.advisorRole]) return ADVISOR_ROLES[c.advisorRole].name;
  const primaryClaim = c.claims.find(cl => cl.titleId === "player" && cl.strength === "primary");
  if (primaryClaim && ruler && c.parentId === state.rulerId) return c.gender === "m" ? "Thronfolger" : "Thronfolgerin";
  if (ruler && c.parentId === state.rulerId) return c.gender === "m" ? "Sohn des Herrschers" : "Tochter des Herrschers";
  if (ruler && ruler.parentId && c.parentId === ruler.parentId) return c.gender === "m" ? "Bruder des Herrschers" : "Schwester des Herrschers";
  if (ruler && c.parentId === ruler.spouseId) return c.gender === "m" ? "Stiefsohn" : "Stieftochter";
  return `Haus ${c.surname || "unbekannt"}`;
}

// §31: max. 1-2 wichtige Warnhinweise pro Karte, priorisiert -- jede
// Bedingung liest ausschließlich bereits reale Felder.
function getCharacterWarnings(state, characterId) {
  const c = state.characters[characterId];
  if (!c) return [];
  const warnings = [];
  const strongClaim = c.claims.find(cl => cl.titleId === "player" && (cl.strength === "strong" || cl.strength === "primary"));
  if (strongClaim && characterId !== state.rulerId) warnings.push({ id: "claim", text: strongClaim.strength === "primary" ? "VORRANGIGER ANSPRUCH" : "STARKER THRONANSPRUCH", severity: strongClaim.strength === "primary" ? 3 : 2 });
  if (c.rivalIds && c.rivalIds.includes(state.rulerId)) warnings.push({ id: "rival", text: "RIVALE", severity: 3 });
  if (c.traits.includes("korrupt") && c.advisorRole) warnings.push({ id: "corrupt", text: "KORRUPT", severity: 1 });
  if (characterId !== state.rulerId && c.alive) {
    const loy = c.loyalty !== undefined ? c.loyalty : computeLoyalty(state, characterId);
    if (loy < 35) warnings.push({ id: "loyalty", text: "NIEDRIGE LOYALITÄT", severity: 2 });
  }
  return warnings.sort((a, b) => b.severity - a.severity).slice(0, 2).map(w => ({ id: w.id, text: w.text }));
}

// ---------- Character Card (§9-14/30-31/86-89) ----------
function getCharacterCardViewModel(state, characterId) {
  const c = state.characters[characterId];
  if (!c) return null;
  const topTraits = c.traits.slice(0, 2).map(id => getTraitBadgeViewModel(id)).filter(Boolean);
  // §Phase-8E: "Loyalität zum Spieler-Thron" ist für einen fremden
  // Herrscher kein sinnvoller Begriff (er hat keinen) -- null statt eines
  // technisch berechenbaren, aber bedeutungslosen Werts (vgl. §5-Beispiel
  // im Auftrag: fremde Karten zeigen "Beziehung", keine Loyalität).
  const isForeign = !!getForeignRulerRegionId(state, characterId);
  return {
    id: characterId, name: c.name, surname: c.surname || "", fullName: `${c.name} ${c.surname || ""}`.trim(),
    gender: c.gender, age: c.age, alive: c.alive, ageGroup: ageGroupOf(c.age),
    roleLabel: getCharacterRoleLabel(state, characterId),
    portrait: getPortraitViewModel(state, characterId),
    topTraits,
    loyalty: (c.alive && !isForeign) ? (characterId === state.rulerId ? 100 : (c.loyalty !== undefined ? c.loyalty : computeLoyalty(state, characterId))) : null,
    warnings: c.alive ? getCharacterWarnings(state, characterId) : [],
    isRuler: characterId === state.rulerId, isForeignRuler: isForeign,
  };
}

// ---------- Character Detail (§9-25) ----------
const STAT_LABEL = {
  intelligenz: "Intelligenz", diplomatie: "Diplomatie", verwaltung: "Verwaltung", militaer: "Militär",
  handel: "Handel", charisma: "Charisma", finanzen: "Finanzen", intrige: "Intrige",
};
const MEMORY_TIMELINE_LIMIT = 8;
function getCharacterDetailViewModel(state, characterId) {
  const c = state.characters[characterId];
  if (!c) return null;
  const isRuler = characterId === state.rulerId;
  // §Phase-8E: ein fremder Herrscher hat keine "Loyalität zum eigenen Thron"
  // und keine persönliche Beziehung zum Spieler-Herrscher im Character-Core-
  // Sinn (nur eine SEPARATE diplomatische Beziehung, state.diplomacy[aiId]
  // -- die zeigt die Diplomatie-Ansicht selbst, nicht dieses Modal). Beides
  // hier zu zeigen wäre kein Fehler in der Formel, aber irreführend.
  const isForeignRuler = !!getForeignRulerRegionId(state, characterId);
  const card = getCharacterCardViewModel(state, characterId);

  const skills = Object.keys(STAT_LABEL).map(k => ({ id: k, label: STAT_LABEL[k], value: c.stats[k] }));
  const traits = c.traits.map(id => getTraitBadgeViewModel(id)).filter(Boolean);
  const claims = c.claims.filter(cl => cl.strength !== "none").map(cl => ({
    titleId: cl.titleId, strength: cl.strength, strengthLabel: CLAIM_STRENGTH_LABEL[cl.strength] || cl.strength,
    reasonLabel: CLAIM_REASON_LABEL[cl.reason] || cl.reason || "",
  }));
  const rivalries = (c.rivalIds || []).map(rid => {
    const rival = state.characters[rid];
    const originId = c.rivalryOrigin ? c.rivalryOrigin[rid] : null;
    const origin = originId ? state.memories.byId[originId] : null;
    return {
      id: rid, name: rival ? `${rival.name} ${rival.surname || ""}`.trim() : "Unbekannt", alive: rival ? rival.alive : false,
      originText: origin ? origin.description : null, originYear: origin ? origin.year : null,
    };
  });

  const allMems = getMemoriesForCharacter(state, characterId).slice().sort((a, b) => a.year - b.year);
  const relevantMems = allMems.filter(m => isChronicleWorthy(state, m).worthy);
  const shown = (relevantMems.length ? relevantMems : allMems).slice(-MEMORY_TIMELINE_LIMIT);
  const memoryTimeline = shown.map(m => ({ year: m.year, text: m.description, type: m.type }));
  const hiddenCount = Math.max(0, allMems.length - shown.length);

  const currentThread = getActiveStoryThreads(state).find(t => t.status !== "DORMANT" && t.actorIds.includes(characterId));
  const currentStory = currentThread ? {
    title: currentThread.title, icon: THREAD_ICON_BY_TYPE[currentThread.type] || "⚜",
    stageText: THREAD_STAGE_TEXT[currentThread.status] || "Die Geschichte entwickelt sich weiter.",
  } : null;

  return {
    ...card,
    house: c.surname || "", health: c.alive ? Math.round(c.health) : null,
    skills, traits, claims, rivalries,
    relationship: (!isRuler && !isForeignRuler && c.alive) ? getRelationshipDisplayViewModel(state, characterId, state.rulerId) : null,
    loyaltyBreakdown: (!isForeignRuler && c.alive) ? getLoyaltyDisplayViewModel(state, characterId) : null,
    memoryTimeline, hiddenMemoryCount: hiddenCount, totalMemoryCount: allMems.length,
    currentStory, isForeignRuler,
    spouseId: c.spouseId, parentId: c.parentId, childrenIds: c.childrenIds.slice(),
  };
}

// ---------- Hof (§27-35) ----------
function getCourtViewModel(state) {
  const ruler = state.characters[state.rulerId];
  const spouseCard = ruler && ruler.spouseId ? getCharacterCardViewModel(state, ruler.spouseId) : null;
  const heirId = ruler ? ruler.childrenIds.find(id => {
    const cl = state.characters[id] && state.characters[id].claims.find(x => x.titleId === "player" && x.strength === "primary");
    return !!cl && state.characters[id].alive;
  }) : null;
  const offices = [];
  for (const role in ADVISOR_ROLES) {
    const roleInfo = ADVISOR_ROLES[role];
    const advisorId = state.advisors[role];
    const filled = advisorId && state.characters[advisorId] && state.characters[advisorId].alive;
    offices.push({
      role, roleName: roleInfo.name, desc: roleInfo.desc, statKey: roleInfo.statKey, statLabel: STAT_LABEL[roleInfo.statKey],
      filled: !!filled, card: filled ? getCharacterCardViewModel(state, advisorId) : null,
      level: filled ? (state.advisorLevels[role] || 1) : null, maxLevel: CONFIG.advisors.maxLevel,
    });
  }
  return {
    rulerCard: ruler ? getCharacterCardViewModel(state, state.rulerId) : null,
    spouseCard, heirCard: heirId ? getCharacterCardViewModel(state, heirId) : null,
    offices,
  };
}

// ---------- Erbfolge (§44-46) ----------
// Spiegelt NUR die bereits reale Erbenermittlung aus handleSuccession()
// (js/population-dynasty.js) für eine Vorschau -- die eigentliche
// Streitwürfelung (rnd()) findet dort weiterhin ausschließlich beim
// tatsächlichen Herrschertod statt, hier wird nichts gewürfelt.
function getSuccessionViewModel(state) {
  const ruler = state.characters[state.rulerId];
  if (!ruler) return { heirs: [], disputeRisk: false };
  const heirs = ruler.childrenIds
    .map(id => state.characters[id])
    .filter(c => c && c.alive)
    .sort((a, b) => b.age - a.age)
    .map((c, idx) => {
      const id = Object.keys(state.characters).find(k => state.characters[k] === c);
      return { id, name: `${c.name} ${c.surname || ""}`.trim(), age: c.age, order: idx + 1, isPrimary: idx === 0, card: getCharacterCardViewModel(state, id) };
    });
  const disputeRisk = heirs.length > 1 && Math.abs(heirs[0].age - heirs[1].age) <= CONFIG.succession.disputeAgeClosenessYears;
  return { heirs, disputeRisk, hasHeir: heirs.length > 0 };
}

// ---------- Dynastie / Stammbaum (§36-49) ----------
function getDynastyTreeViewModel(state) {
  const ruler = state.characters[state.rulerId];
  const houseName = state.dynastyName || (ruler ? ruler.surname : "") || "";
  const parentCard = ruler && ruler.parentId && state.characters[ruler.parentId] ? getCharacterCardViewModel(state, ruler.parentId) : null;
  const siblings = ruler && ruler.parentId
    ? Object.keys(state.characters).filter(id => state.characters[id].parentId === ruler.parentId && id !== state.rulerId).map(id => getCharacterCardViewModel(state, id))
    : [];
  const children = ruler ? ruler.childrenIds.map(id => getCharacterCardViewModel(state, id)).filter(Boolean) : [];
  const eras = getRulerEras(state);
  const deceasedRulers = eras.filter(e => e.rulerId !== state.rulerId).map(e => {
    const bio = buildRulerBiography(state, e.rulerId);
    const rc = state.characters[e.rulerId];
    return {
      id: e.rulerId, name: rc ? `${rc.name} ${rc.surname || ""}`.trim() : "Unbekannt",
      startYear: e.startYear, endYear: e.endYear, bio,
      card: rc ? getCharacterCardViewModel(state, e.rulerId) : null,
    };
  });
  return {
    houseName, heraldry: getHeraldryViewModel(houseName),
    rulerCard: ruler ? getCharacterCardViewModel(state, state.rulerId) : null,
    spouseCard: ruler && ruler.spouseId ? getCharacterCardViewModel(state, ruler.spouseId) : null,
    parentCard, siblings, children,
    succession: getSuccessionViewModel(state),
    deceasedRulers,
    generations: state.stats ? state.stats.generations : 0,
  };
}

// ---------- Beraterkandidaten (§32-35) ----------
function getAdvisorCandidateViewModel(state) {
  const sel = state.pendingAdvisorSelection;
  if (!sel) return null;
  const roleInfo = ADVISOR_ROLES[sel.role];
  const candidates = sel.candidates.map((cand, idx) => {
    const c = cand.existingId ? state.characters[cand.existingId] : cand.generated;
    const originLabel = cand.existingId ? "Geschwister des Herrschers" : `Haus ${c.surname || "unbekannt"}`;
    return {
      index: idx, name: c.name, surname: c.surname || "", age: c.age, gender: c.gender,
      portrait: { gender: c.gender, ageGroup: ageGroupOf(c.age), alive: true, rank: "adel", rankOrder: 1, variant: hashStringToInt((cand.existingId || c.name + c.surname)) % 5, initials: (c.name[0] || "?") + (c.surname ? c.surname.replace(/^von\s+/, "")[0] : "") },
      originLabel, relevantSkillLabel: STAT_LABEL[roleInfo.statKey], relevantSkillValue: c.stats[roleInfo.statKey],
      traits: c.traits.map(id => getTraitBadgeViewModel(id)).filter(Boolean),
      loyalty: cand.existingId ? computeLoyalty(state, cand.existingId) : (c.loyalty !== undefined ? c.loyalty : 50),
      salaryDemand: Math.round(c.salaryDemand || sel.cost),
    };
  });
  return { role: sel.role, roleName: roleInfo.name, roleDesc: roleInfo.desc, statLabel: STAT_LABEL[roleInfo.statKey], cost: sel.cost, candidates };
}

// ============================================================
// Phase 8E: DIPLOMATIE -- "aus Beziehungszahlen werden politische
// Beziehungen". Nur vorhandene Werte/Funktionen (state.diplomacy,
// state.warState, state.vassals, region.rulerId, World Memory,
// Story Threads, Intel-Schätzung) angezeigt -- keine neue
// Diplomatiemechanik, keine veränderte Formel (§2/§42).
// ============================================================

// ---------- §6: Beziehung als natürlicher Zustand, nicht nur Zahl ----------
// Schwellen sind REINE UI-Klassifikation (§6 ausdrücklich), keine
// Gameplaywirkung -- state.diplomacy[aiId].relation bleibt unverändert die
// einzige echte Zahl.
const RELATION_TIERS = [
  { min: 75, label: "ENG VERBÜNDET" },
  { min: 40, label: "FREUNDSCHAFTLICH" },
  { min: 10, label: "POSITIV" },
  { min: -9, label: "NEUTRAL" },
  { min: -39, label: "ANGESPANNT" },
  { min: -69, label: "FEINDSELIG" },
  { min: -101, label: "ERBITTERTER GEGNER" },
];
function relationTierLabel(relation) {
  for (const tier of RELATION_TIERS) if (relation >= tier.min) return tier.label;
  return "ERBITTERTER GEGNER";
}

// ---------- §4/§10/§11: fremder Herrscher als Person ----------
// region.rulerId ist seit dieser Phase ein echter Character-Core-Charakter
// (js/core.js newGame()) -- die Karte ist deshalb wortwörtlich dieselbe
// getCharacterCardViewModel() wie im Hof, kein zweites Modell.
function getForeignRulerCardViewModel(state, aiId) {
  const region = state.regions[aiId];
  if (!region || !region.rulerId) return null;
  return getCharacterCardViewModel(state, region.rulerId);
}

// ---------- §13/14: Verträge als Siegel-/Dokumentkarten ----------
const TREATY_LABELS = {
  allianz: "BÜNDNIS", handel: "HANDELSVERTRAG", nichtangriff: "NICHTANGRIFFSPAKT",
  durchmarsch: "DURCHMARSCHRECHT", vassal: "VASALL", guarantee: "GARANTIE", marriage: "DYNASTISCHE VERBINDUNG",
};
function getTreatyViewModel(state, aiId) {
  const dip = state.diplomacy[aiId];
  if (!dip) return [];
  const out = [];
  if (dip.treaties.allianz) out.push({ id: "allianz", label: TREATY_LABELS.allianz });
  if (dip.treaties.handel) out.push({ id: "handel", label: TREATY_LABELS.handel });
  if (dip.treaties.nichtangriff) out.push({ id: "nichtangriff", label: TREATY_LABELS.nichtangriff });
  if (dip.treaties.durchmarsch) out.push({ id: "durchmarsch", label: TREATY_LABELS.durchmarsch });
  if (state.vassals[aiId]) out.push({ id: "vassal", label: TREATY_LABELS.vassal });
  if (dip.guaranteeFloor !== undefined) out.push({ id: "guarantee", label: TREATY_LABELS.guarantee });
  if (dip.dynasticMarriageFloor !== undefined) out.push({ id: "marriage", label: TREATY_LABELS.marriage });
  return out;
}

// ---------- §8/9: diplomatische World-Memory-Timeline ----------
// Dieselbe isChronicleWorthy()-Signifikanzprüfung wie die Charakter-
// Zeitleiste (js/chronicle.js) -- nur nach regionIds statt actorIds/
// targetIds gefiltert, da diplomatische Ereignisse (ALLIANCE_FORMED,
// WAR_DECLARED, PEACE_SIGNED, ...) seit Phase 5/6 bereits regionIds tragen.
function getDiplomaticMemoryTimeline(state, aiId) {
  const allMems = Object.values(state.memories.byId).filter(m => m.regionIds && m.regionIds.includes(aiId)).sort((a, b) => a.year - b.year);
  const relevant = allMems.filter(m => isChronicleWorthy(state, m).worthy);
  const shown = (relevant.length ? relevant : allMems).slice(-MEMORY_TIMELINE_LIMIT);
  return shown.map(m => ({ year: m.year, text: m.description, type: m.type }));
}

// ---------- §17: aktueller Story Thread mit dieser Macht ----------
function getDiplomaticStoryViewModel(state, aiId) {
  const thread = getActiveStoryThreads(state).find(t => t.status !== "DORMANT" && t.regionIds && t.regionIds.includes(aiId));
  if (!thread) return null;
  return {
    title: thread.title, icon: THREAD_ICON_BY_TYPE[thread.type] || "⚜",
    stageText: THREAD_STAGE_TEXT[thread.status] || "Die Geschichte entwickelt sich weiter.",
  };
}

// ---------- §15: Kriegsstatus, seit wann (aus der echten WAR_DECLARED-Memory) ----------
function getWarStatusViewModel(state, aiId) {
  const atWar = !!(state.warState && state.warState[aiId]);
  if (!atWar) return { atWar: false, sinceYear: null };
  const declarations = Object.values(state.memories.byId).filter(m => m.type === "WAR_DECLARED" && m.regionIds && m.regionIds.includes(aiId));
  const sinceYear = declarations.length ? declarations[declarations.length - 1].year : null;
  return { atWar: true, sinceYear };
}

// ---------- §27: militärische Einschätzung -- nur die bereits vorhandene,
// unsichere Intel-Schätzung (state.intel[aiId].rangeLow/High), keine neue
// Formel/exakte Zahl. ----------
function getMilitaryAssessmentLabel(state, aiId) {
  const intel = state.intel[aiId];
  if (!intel || intel.rangeLow === undefined) return "UNBEKANNT";
  const playerStrength = armyStrength(state);
  if (intel.rangeHigh < playerStrength * 0.85) return "SCHWÄCHER";
  if (intel.rangeLow > playerStrength * 1.15) return "STÄRKER";
  return "ETWA GLEICH";
}

// ---------- §23/24: Kaiserwahl-Informationen -- ausschließlich die reale,
// bereits in resolveElection()/checkElectionTrigger() verwendete Schwelle
// gespiegelt, keine neuen Deals/Versprechen. Alle drei state.diplomacy-
// Regionen sind bereits im bestehenden Wahlcode gleichberechtigte
// Kurfürsten (siehe resolveElection()), daher hier uniform true. ----------
function getElectorInfoViewModel(state, aiId) {
  const cfg = CONFIG.election;
  const dip = state.diplomacy[aiId];
  if (!dip) return null;
  let leaning;
  if (state.pendingElection) {
    const bribed = !!state.pendingElection.bribed[aiId];
    const wouldVote = bribed || dip.relation >= cfg.knownElectorVoteRelationThreshold;
    leaning = wouldVote ? (bribed ? "Unterstützt aktuell: Spieler (bestochen)" : "Unterstützt aktuell: Spieler") : "Unterstützt aktuell: nicht den Spieler";
  } else {
    leaning = dip.relation >= cfg.knownElectorVoteRelationThreshold ? "Würde derzeit den Spieler unterstützen" : "Würde derzeit nicht den Spieler unterstützen";
  }
  return { isElector: true, leaning };
}

// ---------- §7: "Warum stehen wir so zueinander?" -- die diplomatische
// Beziehung ist (anders als Character-Core-Beziehungen) ein reiner
// Drift-Akkumulator ohne gespeicherte Einzelkomponenten (js/diplomacy.js
// updateDiplomacy()) -- eine Zeile-für-Zeile-Zerlegung wie bei Charakteren
// gäbe es nicht wirklich (§7 "keine Gründe erfinden"). Reale Ersatz-
// Antwort: aktuelle Verträge/Status + die echte Memory-Zeitleiste
// (bereits oben) als "jüngste Entwicklungen mit Einfluss". ----------
function getDiplomaticRelationshipViewModel(state, aiId) {
  const dip = state.diplomacy[aiId];
  if (!dip) return null;
  const relation = Math.round(dip.relation);
  return {
    relation, tierLabel: relationTierLabel(relation),
    war: getWarStatusViewModel(state, aiId),
    treaties: getTreatyViewModel(state, aiId),
    militaryAssessment: getMilitaryAssessmentLabel(state, aiId),
    elector: getElectorInfoViewModel(state, aiId),
    memoryTimeline: getDiplomaticMemoryTimeline(state, aiId),
  };
}

// ---------- Gesamtansicht: eine Karte je Macht (§3/4) ----------
function getDiplomacyOverviewViewModel(state) {
  return Object.keys(state.diplomacy).map(aiId => {
    const region = state.regions[aiId];
    const dip = state.diplomacy[aiId];
    const relation = Math.round(dip.relation);
    const rulerCard = getForeignRulerCardViewModel(state, aiId);
    const war = getWarStatusViewModel(state, aiId);
    const warnings = [];
    if (war.atWar) warnings.push({ id: "war", text: "KRIEG" });
    if (dip.treaties.allianz) warnings.push({ id: "ally", text: "BÜNDNIS" });
    if (relation <= -40 && !war.atWar) warnings.push({ id: "hostile", text: "FEINDSELIG" });
    return {
      aiId, regionName: region.name.replace(/\s*\(.*\)$/, ""), houseName: "Haus " + region.name.replace(/\s*\(.*\)$/, ""),
      heraldry: getHeraldryViewModel(region.name), rulerCard,
      relation, tierLabel: relationTierLabel(relation),
      atWar: war.atWar, isVassal: !!state.vassals[aiId],
      treatyCount: getTreatyViewModel(state, aiId).length,
      warnings: warnings.slice(0, 2),
    };
  });
}

// ---------- Detailansicht für die ausgewählte Macht (§7-12/16-25) ----------
function getForeignPowerDetailViewModel(state, aiId) {
  const region = state.regions[aiId];
  if (!region) return null;
  return {
    aiId, regionName: region.name.replace(/\s*\(.*\)$/, ""), houseName: "Haus " + region.name.replace(/\s*\(.*\)$/, ""),
    heraldry: getHeraldryViewModel(region.name),
    rulerCard: getForeignRulerCardViewModel(state, aiId),
    relationship: getDiplomaticRelationshipViewModel(state, aiId),
    story: getDiplomaticStoryViewModel(state, aiId),
  };
}

// ============================================================
// Phase 8F: EVENTS + STORY THREADS -- "aus Textboxen werden historische
// Szenen". Nur bereits vorhandene Daten (Event-/Chain-/Thread-/Memory-
// Felder) angezeigt -- keine neue Gameplaylogik, keine Fake-Vorhersagen,
// keine invented Folgen (§17/26/27/42/61/77).
// ============================================================

// ---------- §2: Event-Hierarchie (rein visuelle Klassifikation) ----------
// Random-Events tragen keine Wichtigkeits-Zahl -- die einzige bereits
// reale Signifikanz-Markierung ist das bestehende disastersCount-Flag
// (js/advance-year.js finalizeYear(): genau diese drei IDs). Chain-
// Entscheidungen sind laut Spieldesign (Phase 5/6) grundsätzlich
// bedeutender als Flavour-Events; innerhalb einer Chain hebt die reale
// Thread-Importance/CLIMAX-Phase eine Entscheidung auf CRITICAL.
const DISASTER_EVENT_IDS = ["seuche", "rebellion", "brand_in_der_stadt"];
function getEventSeverity(state, ev) {
  if (!ev) return { level: "MINOR", label: "" };
  if (ev.source === "SUCCESSION") return { level: "CRITICAL", label: "ENTSCHEIDENDER MOMENT" };
  if (ev.source === "EVENT_CHAIN") {
    const thread = ev.chainId ? getThreadForChain(state, ev.chainId) : null;
    if (thread && (thread.status === "CLIMAX" || thread.importance >= 70)) return { level: "CRITICAL", label: "ENTSCHEIDENDER MOMENT" };
    return { level: "MAJOR", label: "BEDEUTSAM" };
  }
  if (ev.id && DISASTER_EVENT_IDS.includes(ev.id)) return { level: "IMPORTANT", label: "WICHTIG" };
  return { level: "MINOR", label: "" };
}

// ---------- §8/45/46: Illustrationskategorie + Domäne + Farbe + Symbol ----------
// EIN Tabelle statt drei getrennter -- Kategorie, Unterzeilen-Domäne,
// Akzentfarbe (auf bereits vorhandene Design-Tokens gemappt) und
// Symbolname gehören inhaltlich zusammen.
const EVENT_CATEGORY_INFO = {
  dynasty:    { domainLabel: "DYNASTIE",   accentVar: "--accent",     icon: "crown" },
  succession: { domainLabel: "DYNASTIE",   accentVar: "--accent",     icon: "crown" },
  marriage:   { domainLabel: "DYNASTIE",   accentVar: "--accent",     icon: "rings" },
  death:      { domainLabel: "DYNASTIE",   accentVar: "--panel-dark", icon: "candle" },
  rivalry:    { domainLabel: "HOF",        accentVar: "--accent",     icon: "seal" },
  advisor:    { domainLabel: "HOF",        accentVar: "--accent",     icon: "seal" },
  corruption: { domainLabel: "HOF",        accentVar: "--accent",     icon: "coin" },
  famine:     { domainLabel: "WIRTSCHAFT", accentVar: "--ochre",      icon: "wheat" },
  trade:      { domainLabel: "WIRTSCHAFT", accentVar: "--ochre",      icon: "scale" },
  diplomacy:  { domainLabel: "DIPLOMATIE", accentVar: "--blue",       icon: "scroll" },
  border:     { domainLabel: "DIPLOMATIE", accentVar: "--blue",       icon: "boundary" },
  religion:   { domainLabel: "GLAUBE",     accentVar: "--purple",     icon: "chapel" },
  war:        { domainLabel: "KRIEG",      accentVar: "--red-muted",  icon: "sword" },
  imperial:   { domainLabel: "POLITIK",    accentVar: "--gold",       icon: "crown" },
};
// §8/9: bestehende Eventtypen auf die Kategorien abgebildet -- keine
// Kategorie ohne reales Vorbild erfunden; ohne sauberen Treffer bleibt es
// bewusst ohne Eintrag (Fallback-Rahmen, §56), statt eine Kategorie zu
// erzwingen, die nicht passt.
const RANDOM_EVENT_CATEGORY = {
  kornspeicher_leer: "famine", gute_ernte: "trade", haendler_beschwerde: "trade",
  seuche: "death", adel_fordert_amt: "advisor", handwerker_innovation: "trade",
  raeuberbanden: "trade", kirche_spende: "religion", handelsroute_eroeffnet: "trade",
  wildererbande: "border", brand_in_der_stadt: "death", bettlerplage: "famine",
  handwerkerstreik: "trade", wunderheiler: "religion", fremder_gesandter: "diplomacy",
  erbstreit_adel: "succession", steuerhinterziehung: "corruption", rebellion: "war",
  ketzerei_entdeckt: "religion", wallfahrt: "religion",
};
const CHAIN_EVENT_CATEGORY = {
  passed_over_heir: "succession", grieved_advisor: "advisor", corrupt_treasurer: "corruption",
  famine_crisis: "famine", trade_conflict: "trade", border_conflict: "border",
  dynastic_marriage: "marriage", church_conflict: "religion", rising_rival: "rivalry",
  imperial_ambition: "imperial",
};
function getEventCategory(state, ev) {
  if (!ev) return null;
  if (ev.source === "SUCCESSION") return "succession";
  if (ev.source === "EVENT_CHAIN") {
    // §62/63: queueChainDecision() speichert nur chainId auf pendingEvent
    // (chainId/threadId bleiben intern, §63) -- die templateId (und damit
    // die reale Kategorie aus CHAIN_TEMPLATES) kommt aus der noch aktiven
    // Chain selbst.
    const chain = ev.chainId && state.eventChains.active[ev.chainId];
    return chain ? (CHAIN_EVENT_CATEGORY[chain.templateId] || null) : null;
  }
  if (ev.id) return RANDOM_EVENT_CATEGORY[ev.id] || null;
  return null;
}

// ---------- §13: beteiligte Charaktere (nur story-relevante Fakten,
// keine Skills) ----------
function getEventParticipantsViewModel(state, ev) {
  if (!ev) return [];
  let ids = [];
  if (ev.source === "SUCCESSION") {
    ids = [ev.oldRulerId, ev.newRulerId].filter(Boolean);
  } else if (ev.source === "EVENT_CHAIN" && ev.chainId) {
    const chain = state.eventChains.active[ev.chainId];
    if (chain) ids = chain.actorIds.concat(chain.targetIds);
  }
  const seen = new Set();
  return ids.filter(id => state.characters[id] && !seen.has(id) && seen.add(id))
    .map(id => getCharacterCardViewModel(state, id));
}

// ---------- §18/20/21: Story-/Vorgeschichte-Kontext ----------
// Nur wenn das Ereignis wirklich Teil einer Chain/eines Threads ist --
// kein Fake-Drama ohne echten Thread (§44).
function getStoryContextViewModel(state, ev) {
  if (!ev || ev.source !== "EVENT_CHAIN" || !ev.chainId) return null;
  const chain = state.eventChains.active[ev.chainId];
  if (!chain) return null;
  const thread = getThreadForChain(state, ev.chainId);
  const originMemoryId = chain.originatingMemoryIds && chain.originatingMemoryIds[0];
  const originMemory = originMemoryId ? state.memories.byId[originMemoryId] : null;
  return {
    threadTitle: thread ? thread.title : chain.name,
    stageText: thread ? (THREAD_STAGE_TEXT[thread.status] || "Die Geschichte entwickelt sich weiter.") : null,
    // §20: max. 3-4 relevante Beats aus der echten Chain-Historie.
    timeline: chain.history.slice(-4).map(h => ({ year: h.year, note: h.note || h.choice || h.event })),
    originText: originMemory ? originMemory.description : null,
  };
}

// ---------- §23/24/26/27: Entscheidungskarten ----------
// Optionen kennen nur label/outcome/apply -- keine deklarierten Folgen
// (effect ist eine Blackbox-Funktion). Ein "(-NNN Taler)"-Hinweis, der
// bereits WÖRTLICH im echten label steht (z.B. "Getreide importieren
// (-800 Taler)"), wird als eigene Kosten-Zeile herausgelöst -- keine neue
// Zahl, nur andere Darstellung derselben bereits vorhandenen Textinfo.
function getDecisionCardViewModel(option, index) {
  const label = option.label || "";
  const costMatch = label.match(/\(([+\-−]?\s?\d[\d.,]*\s*Taler[^)]*)\)\s*$/);
  const title = costMatch ? label.slice(0, costMatch.index).trim() : label;
  return {
    index, title: title || label, sentence: label,
    costText: costMatch ? costMatch[1].trim() : null,
  };
}

// ---------- §60: Gesamt-Präsentations-ViewModel für das Event-Modal ----------
function getEventPresentationViewModel(state, ev) {
  if (!ev) return null;
  const severity = getEventSeverity(state, ev);
  const category = getEventCategory(state, ev);
  const categoryInfo = category ? EVENT_CATEGORY_INFO[category] : null;
  const participants = getEventParticipantsViewModel(state, ev);
  const storyContext = getStoryContextViewModel(state, ev);
  const decisionCards = (ev.options || []).map((opt, i) => getDecisionCardViewModel(opt, i));
  return {
    title: ev.title, storyText: ev.text,
    subtitleDomain: categoryInfo ? categoryInfo.domainLabel : null,
    year: state.year,
    severity, category, categoryInfo,
    participants, storyContext, decisionCards,
    isSuccession: ev.source === "SUCCESSION",
    oldRulerId: ev.oldRulerId || null, newRulerId: ev.newRulerId || null,
  };
}

// ---------- §35-41: Story-Ansicht (Spieler-UI, keine Debug-Zahlen) ----------
// Maximal 2-4 aktuell relevante Threads (§40): DORMANT-Threads sind für
// den Spieler noch nichts Sichtbares (kein Signal ist noch zu keiner
// Geschichte geworden) -- gleiche Filterung wie getPrimaryStoryViewModel().
function getStoryViewViewModel(state) {
  const active = getActiveStoryThreads(state).filter(t => t.status !== "DORMANT")
    .sort((a, b) => b.importance - a.importance).slice(0, 4);
  const activeCards = active.map(t => ({
    id: t.id, title: t.title, icon: THREAD_ICON_BY_TYPE[t.type] || "⚜",
    years: `${t.startedYear}–`, stageText: THREAD_STAGE_TEXT[t.status] || "Die Geschichte entwickelt sich weiter.",
    participants: t.actorIds.filter(id => state.characters[id]).map(id => {
      const c = state.characters[id];
      return `${c.name} ${c.surname || ""}`.trim();
    }),
    lastEvent: t.history.length ? t.history[t.history.length - 1].note : null,
    timeline: t.history.slice(-4).map(h => ({ year: h.year, note: h.note })),
  }));
  // §41: abgeschlossene Geschichten -- nur ein kurzer Link, keine volle
  // Archivierung (das übernimmt 8H/Chronik).
  const resolved = Object.values(state.storyThreads.resolved)
    .sort((a, b) => (b.history[b.history.length - 1]?.year || 0) - (a.history[a.history.length - 1]?.year || 0))
    .slice(0, 3)
    .map(t => ({ id: t.id, title: t.title, endedYear: t.history.length ? t.history[t.history.length - 1].year : null }));
  return { activeThreads: activeCards, recentlyResolved: resolved, hasAny: activeCards.length > 0 };
}
