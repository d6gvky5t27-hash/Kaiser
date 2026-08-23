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

function getRegionSummaryViewModel(state, territoryId) {
  const t = territoryById(territoryId);
  if (!t) return null;
  const terr = state.territories[territoryId];
  const ownerId = terr.owner;
  const r = state.regions[ownerId];
  const totalPop = Object.values(r.population).reduce((s, g) => s + g.count, 0);
  const weightedWealth = totalPop > 0
    ? Object.values(r.population).reduce((s, g) => s + g.wealth * g.count, 0) / totalPop
    : 0;
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

  return {
    territoryId, territoryName: t.name, terrainName: terrain.name, isCapital: !!t.capital,
    ownerId, ownerName: r.name, isPlayerTerritory,
    population: totalPop, satisfactionPct: Math.round(r.satisfactionAvg !== undefined ? r.satisfactionAvg : 55),
    satisfactionLabel: levelLabel(r.satisfactionAvg !== undefined ? r.satisfactionAvg : 55),
    foodPct, foodLabel: foodStatusLabel(foodPct),
    wealthPct: Math.round(weightedWealth), wealthLabel: levelLabel(weightedWealth),
    topGoods, populationByGroup, militaryStrength,
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
