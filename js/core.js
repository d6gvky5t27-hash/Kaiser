// ============================================================
// CORE — Zufallszahlen, Gebäude-Parzellen-Utilities, Regions-/Spielerzeugung,
// Speichersystem (§64/§67/§26)
// ============================================================

// ============================================================
// SIMULATIONSKERN — Die Simulation ist die Wahrheit (§102)
// ============================================================

// ---------- Deterministische Simulation (§67) ----------
// Mulberry32-PRNG: schnell, gut genug für Spielzwecke, vollständig reproduzierbar.
// Der Zustand wird im Savegame mitgeschrieben (state.seed + state._rngCalls),
// sodass ein geladener Spielstand exakt an derselben Stelle im Zufallsstrom
// weiterläuft wie vor dem Speichern.
let __rngState = 0;

let __rngCalls = 0;

function seedRng(seed) {
  __rngState = seed >>> 0;
  __rngCalls = 0;
}

function rnd() {
  __rngCalls++;
  __rngState |= 0;
  __rngState = (__rngState + 0x6D2B79F5) | 0;
  let t = Math.imul(__rngState ^ (__rngState >>> 15), 1 | __rngState);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function generateFreshSeed() {
  // Nur bei echtem Neustart: einmalig eine Startzahl ziehen (kein Anspruch
  // auf Reproduzierbarkeit dieses einen Schritts — ab hier läuft alles deterministisch).
  return (Date.now() ^ Math.floor(Math.random() * 0xFFFFFFFF)) >>> 0;
}

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

// ---------- Gebäude als Parzellen-Instanzen (§26: mehrfach baubar, erweiterbar) ----------
// §Original "Kaiser": mehr Land schaltet mehr Baukapazität frei, statt eines
// fest verdrahteten Parzellenlimits

function regionPlotsAvailable(region) {
  const fromLand = Math.floor((region.land || 0) / CONFIG.land.hectaresPerPlot);
  return Math.max(1, Math.min(fromLand, 40)); // Obergrenze gegen Kartenüberladung
}

function freePlotIndex(region) {
  const used = new Set(region.buildings.map(b => b.plotIndex));
  const maxPlots = regionPlotsAvailable(region);
  for (let i = 0; i < maxPlots; i++) {
    if (!used.has(i)) return i;
  }
  return null; // keine freie Parzelle mehr — mehr Land kaufen!
}

function buildingInstances(region, type) {
  return region.buildings.filter(b => b.type === type);
}

function hasBuilding(region, type) {
  return buildingInstances(region, type).length > 0;
}

function buildingLevelSum(region, type) {
  return buildingInstances(region, type).reduce((s, b) => s + b.level, 0);
}

function upgradeCost(type, currentLevel) {
  return Math.round(BUILDINGS[type].cost * Math.pow(CONFIG.buildings.upgradeCostMultiplier, currentLevel));
}

function buildNewBuilding(state, region, type) {
  const b = BUILDINGS[type];
  if (!b) return { ok: false, reason: "Unbekannter Gebäudetyp." };
  const plot = freePlotIndex(region);
  if (plot === null) return { ok: false, reason: "Keine freie Parzelle mehr auf der Karte." };
  if (state.treasury < b.cost) return { ok: false, reason: "Nicht genug Taler in der Staatskasse." };
  // §26/mittelalterliche Baustoffe: echte Materialien statt nur Geld nötig
  const materials = b.materialCost || {};
  const missing = [];
  for (const gid in materials) {
    if ((region.warehouse[gid] || 0) < materials[gid]) {
      missing.push(`${materials[gid]} ${GOODS[gid].name} (vorhanden: ${Math.round(region.warehouse[gid]||0)})`);
    }
  }
  if (missing.length) return { ok: false, reason: `Fehlende Baustoffe: ${missing.join(", ")}.` };

  state.treasury -= b.cost;
  logLedger(state, `Neubau: ${b.name}`, -b.cost);
  for (const gid in materials) region.warehouse[gid] -= materials[gid];
  region.buildings.push({ type, level: 1, plotIndex: plot });
  addChronicle(state, `Ein neues ${b.name} wurde in ${region.name} errichtet (Parzelle ${plot + 1}).`);
  return { ok: true };
}

function upgradeBuildingAt(state, region, plotIndex) {
  const inst = region.buildings.find(b => b.plotIndex === plotIndex);
  if (!inst) return { ok: false, reason: "Auf dieser Parzelle steht kein Gebäude." };
  const b = BUILDINGS[inst.type];
  if (inst.level >= CONFIG.buildings.maxLevel) return { ok: false, reason: `${b.name} hat bereits die höchste Ausbaustufe erreicht.` };
  const cost = upgradeCost(inst.type, inst.level);
  if (state.treasury < cost) return { ok: false, reason: "Nicht genug Taler für den Ausbau." };
  state.treasury -= cost;
  logLedger(state, `Ausbau: ${b.name} (Stufe ${inst.level + 1})`, -cost);
  inst.level += 1;
  addChronicle(state, `${b.name} in ${region.name} wurde auf Stufe ${inst.level} ausgebaut.`);
  return { ok: true };
}

// ---------- Individuelle KI-Kommandanten (Content-Vertiefung): jede
// KI-Region bekommt einen benannten Hauptmann mit eigenen Werten, der über
// mehrere Schlachten hinweg bestehen bleibt (Erfahrung wächst, Tod führt zu
// einem Nachfolger) statt bei jeder Kriegserklärung neu ausgewürfelt zu werden. ----------
function generateCommander(regionName) {
  const gender = rnd() < 0.5 ? "m" : "f";
  const pool = gender === "m" ? MALE_NAMES : FEMALE_NAMES;
  const name = pool[Math.floor(rnd() * pool.length)];
  return {
    name: `Hauptmann ${name} von ${regionName}`,
    leadership: 30 + Math.round(rnd() * 50),
    courage: 30 + Math.round(rnd() * 50),
    tactics: 30 + Math.round(rnd() * 50),
    experience: 20 + Math.round(rnd() * 40),
    battlesFought: 0,
    battlesWon: 0,
    alive: true,
  };
}

function makeRegion(name, isPlayer, fertility, startPop) {
  const population = {};
  for (const gid in POP_GROUPS) {
    population[gid] = {
      count: Math.round(startPop * POP_GROUPS[gid].share),
      wealth: 50,
      satisfaction: 55,
    };
  }
  const warehouse = {};
  for (const gid in GOODS) warehouse[gid] = 0;
  Object.assign(warehouse, {
    // Getreide-Startbestand: beim Spieler unten proportional zur Startbevölkerung
    // gesetzt (~1,3 Jahresbedarf), damit die Kornbilanz-Anzeige von Anfang an
    // plausibel aussieht. KI-Regionen starten bewusst mit einem festen
    // Referenzwert statt proportional zur eigenen (leicht unterschiedlichen)
    // Fruchtbarkeit/Bevölkerung — sonst würde die anfängliche Kornmenge selbst
    // schon einen kleinen Wachstumsvorsprung für fruchtbarere KI-Regionen
    // schaffen, der sich über 100 Spieljahre zu einer unrealistischen Dominanz
    // einzelner Regionen aufschaukelt (siehe KI-gegen-KI-Testsuite).
    getreide: isPlayer ? 0 : 300,
    gemuese: 80, fleisch: 40, fisch: 30, salz: 25,
    holz: 100, stein: 40, ton: 30, eisen: 20, kohle: 20, wolle: 40, leder: 15,
    bier: 50, wein: 15, werkzeuge: 10, waffen: 5, kleidung: 10, gewuerze: 3,
  });
  const buildings = isPlayer
    ? [{ type: "bauernhof", level: 1, plotIndex: 0 }]
    : [{ type: "bauernhof", level: 1, plotIndex: 0 }, { type: "saegewerk", level: 1, plotIndex: 1 }];
  const priceNoise = {};
  for (const gid in GOODS) priceNoise[gid] = 1.0;
  const region = {
    name, isPlayer, fertility,
    population, warehouse,
    buildings,
    taxRate: 0.15,
    lastHarvestFactor: 1.0,
    plagueMitigated: null,
    productionBonus: 0,
    satisfactionAvg: 55,
    settlementTier: 0,     // §25: Stadtentwicklung
    infrastructureLevel: 0, // §27: Infrastruktur
    land: Math.round(startPop * (CONFIG.land.startHectares / 2400)), // proportional zur Startbevölkerung, 2400=Referenzgröße Spieler
    extraGrainRate: 0,      // §Original: freiwillige Kornverteilung über den Bedarf hinaus
    governanceStyle: 50,    // §Original: Regierungsstil 0=sehr fair .. 100=gierig (50=neutrale Mitte, keine Wirkung ohne Spieleraktion)
    priceNoise,             // Marktspekulation: jährliche Preisschwankung unabhängig von Angebot/Nachfrage
    commander: isPlayer ? null : generateCommander(name), // individueller KI-Hauptmann, überlebt mehrere Schlachten
  };
  computeGrainBalance(region); // liefert grainNeed für die gerade erzeugte Startbevölkerung
  if (isPlayer) region.warehouse.getreide = Math.round(region.grainNeed * CONFIG.agriculture.grainStartBufferMultiplier);
  computeGrainBalance(region); // mit dem realistischen Startbestand neu berechnen (Kornbilanz-Anzeige ist so schon vor dem ersten Jahreswechsel gefüllt)
  return region;
}

let __charIdCounter = 1;

function nextCharId() { return "c" + (__charIdCounter++); }

function newGame(options) {
  options = options || {};
  const seed = options.seed !== undefined ? options.seed : generateFreshSeed();
  seedRng(seed);

  const difficultyKey = options.difficulty || "normal";
  const diffCfg = CONFIG.difficulty[difficultyKey] || CONFIG.difficulty.normal;
  const dynastyName = options.dynastyName || "von Kaisersberg";
  // Leichte Szenario-Anpassung (§103-Ansatz): wirkt zusätzlich zum Schwierigkeitsgrad
  const capitalCfg = CONFIG.scenario.capital[options.startingCapital] || CONFIG.scenario.capital.normal;
  const stanceCfg = CONFIG.scenario.stance[options.diplomaticStance] || CONFIG.scenario.stance.neutral;
  const startRelation = clamp(CONFIG.diplomacy.startRelation + stanceCfg.relationOffset, -100, 100);
  // Startregion (§8-Vertiefung): reale europäische Herrschaftsgebiete um 1500 zur
  // Wahl, siehe START_REGIONS in gamedata.js. "player"/unbekannt = die
  // ursprüngliche namenlose Provinz (unverändertes Verhalten).
  const regionCfg = START_REGIONS.find(r => r.id === options.startRegion) || START_REGIONS[0];

  const state = {
    year: 1500,
    month: 1, // §Monatstakt: 1-12, ein Jahr vergeht erst nach dem 12. Monat vollständig (advanceMonth())
    lastMonthlyReport: null,
    pendingBirth: null, // Kind wurde geboren, wartet auf einen vom Spieler vergebenen Namen
    pendingMarriage: null, // Herrscher hat geheiratet, wartet auf die Feier-Einblendung
    ledgerLog: [], // Kassenbuch-Einzelposten seit dem letzten Monatswechsel (siehe logLedger())
    seed: seed,
    difficulty: difficultyKey,
    treasury: Math.round(1500 * diffCfg.startTreasuryMultiplier * capitalCfg.treasuryMultiplier * regionCfg.treasuryMultiplier),
    prestige: 10,
    titleIndex: 0,
    legitimacy: CONFIG.succession.legitimacyStart,
    chronicle: [],
    regions: {
      player: makeRegion(regionCfg.name, true, regionCfg.fertility, regionCfg.pop),
      ai1: makeRegion("Mainau (Nachbar)", false, 1.05, 2850),
      ai2: makeRegion("Rheinfeld (Nachbar)", false, 0.95, 2750),
      ai3: makeRegion("Bergheim (Nachbar)", false, 1.0, 2800),
    },
    diplomacy: {
      ai1: { relation: startRelation, treaties: { nichtangriff: false, handel: false, allianz: false } },
      ai2: { relation: startRelation, treaties: { nichtangriff: false, handel: false, allianz: false } },
      ai3: { relation: startRelation, treaties: { nichtangriff: false, handel: false, allianz: false } },
    },
    army: { miliz: 0, bogenschuetzen: 0, armbrustschuetzen: 0, pikeniere: 0, ritter: 0, schwere_kavallerie: 0, soeldner: 0 },
    advisors: { schatzmeister: null, marschall: null, diplomat: null, spionagemeister: null, geistlicher: null, handelsberater: null },
    advisorLevels: { schatzmeister: 0, marschall: 0, diplomat: 0, spionagemeister: 0, geistlicher: 0, handelsberater: 0 }, // §Original-Vertiefung: Berater-Ausbaustufen 0 (unbesetzt) bis maxLevel
    religiousInfluence: CONFIG.religion.startInfluence,
    intel: {
      ai1: { accuracy: clamp(CONFIG.intrigue.baseIntelAccuracy + diffCfg.intelAccuracyBonus, 0.05, 1) },
      ai2: { accuracy: clamp(CONFIG.intrigue.baseIntelAccuracy + diffCfg.intelAccuracyBonus, 0.05, 1) },
      ai3: { accuracy: clamp(CONFIG.intrigue.baseIntelAccuracy + diffCfg.intelAccuracyBonus, 0.05, 1) },
    },
    pendingElection: null,
    incomingAiWar: null, // §31: von der KI selbst ausgelöste, noch nicht ausgetragene Kriegserklärung
    aiWarCooldown: {},
    landPrice: Math.round((CONFIG.land.priceMin + CONFIG.land.priceMax) / 2),
    electionCooldown: 0,
    victoryCondition: options.victoryCondition || "kaiser",
    victoryProgressYears: 0, // §47: Jahre in Folge, in denen eine alternative Siegbedingung erfüllt ist
    debt: 0, // §24 Staatsschulden
    vassals: {}, // §29 Vasallisierung: { aiId: true }
    stats: { // §87 Spielende-Auswertung
      maxPopulation: 0, maxTreasury: 0, warsWon: 0, warsLost: 0,
      generations: 1, disastersCount: 0, highestTitleIndex: 0,
    },
    log: [],
    pendingEvent: null,
    gameOver: null,
    dynastyName: dynastyName,
    characters: {},
    rulerId: null,
  };

  for (const ext of EXTRA_REGIONS) {
    state.regions[ext.id] = makeRegion(ext.name, false, ext.fertility, ext.pop);
  }

  const gender = options.gender || (rnd() < 0.5 ? "m" : "f");
  const age = options.age || (24 + Math.floor(rnd()*12));
  const ruler = createCharacter(gender, age, dynastyName);
  if (options.rulerName) ruler.name = options.rulerName;
  if (options.chosenTraits && options.chosenTraits.length) {
    ruler.traits = options.chosenTraits.slice(0, 2);
  }
  const id = nextCharId();
  state.characters[id] = ruler;
  state.rulerId = id;

  addChronicle(state, `Im Jahre 1500 übernahm ${ruler.name} ${dynastyName} die Herrschaft über ${state.regions.player.name}.`);
  initTerritories(state); // Kriegskarte (§Original-Vertiefung): Gebietsbesitz/Garnisonen initialisieren
  return state;
}

function addChronicle(state, text) {
  state.chronicle.unshift(`${state.year}: ${text}`);
  if (state.chronicle.length > 200) state.chronicle.pop();
}

// Kassenbuch-Einzelposten (§Original-Vertiefung: Nutzerwunsch nach vollständiger
// Auflistung aller Ein-/Ausgaben, nicht nur der fünf monatlichen Sammelposten).
// Jede spielerausgelöste Transaktion (Bau, Ausbau, Land-/Warenhandel, Kredite)
// wird hier vermerkt und beim nächsten Kassenbuch-Fenster angezeigt und geleert.
function logLedger(state, label, amount) {
  if (!state.ledgerLog) state.ledgerLog = [];
  state.ledgerLog.push({ label, amount: Math.round(amount) });
}

// ---------- Landwirtschaft (§18/§19) ----------

const SAVE_VERSION = 3;

function serializeSave(state) {
  return JSON.stringify({
    saveVersion: SAVE_VERSION,
    charIdCounter: __charIdCounter,
    rngCalls: __rngCalls,
    state,
  }, null, 0);
}

// §Character-Core-Punkt 44/45: neue Charakterfelder (Skills finanzen/
// intrige, claims, relationships, loyalty, advisorRole, rivalIds,
// pendingAdvisorSelection) bekommen beim Laden eines Spielstands aus
// Version 2 feste, unmittelbar plausible Defaultwerte statt eines harten
// Ladefehlers. Bewusst FESTE statt gewürfelte Werte (kein randomStat()
// hier) — Migration läuft vor dem RNG-Wiederherstellen weiter unten, ein
// rnd()-Aufruf an dieser Stelle würde den deterministischen Zufallsstrom
// des geladenen Spielstands verfälschen.
function migrateSaveV2ToV3(parsed) {
  for (const id in parsed.state.characters) {
    const c = parsed.state.characters[id];
    if (c.stats && c.stats.finanzen === undefined) c.stats.finanzen = 10;
    if (c.stats && c.stats.intrige === undefined) c.stats.intrige = 10;
    if (!c.claims) c.claims = [];
    if (!c.relationships) c.relationships = {};
    if (c.loyalty === undefined) c.loyalty = 50;
    if (c.advisorRole === undefined) c.advisorRole = null;
    if (!c.rivalIds) c.rivalIds = [];
    if (c.salaryDemand === undefined) c.salaryDemand = null;
  }
  if (parsed.state.pendingAdvisorSelection === undefined) parsed.state.pendingAdvisorSelection = null;
  parsed.saveVersion = 3;
  return parsed;
}

function deserializeSave(json) {
  let parsed = JSON.parse(json);
  if (parsed.saveVersion === 2) parsed = migrateSaveV2ToV3(parsed);
  if (parsed.saveVersion !== SAVE_VERSION) {
    throw new Error("Inkompatible Spielstand-Version: " + parsed.saveVersion);
  }
  __charIdCounter = parsed.charIdCounter;
  // Deterministische Simulation (§67): RNG mit demselben Seed neu starten und
  // exakt so viele Schritte vorspulen, wie beim Speichern bereits verbraucht waren —
  // der Zufallsstrom setzt sich dadurch nahtlos fort.
  seedRng(parsed.state.seed);
  for (let i = 0; i < parsed.rngCalls; i++) rnd();
  return parsed.state;
}
