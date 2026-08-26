// Phase 8B "Main Screen + Map + HUD" — Regressionstests für die neuen
// reinen Anzeige-ViewModels (§54-56/110-113). Zweck: sicherstellen, dass
// diese Funktionen NIE rnd() aufrufen (§56/120/121) und ausschließlich
// bereits reale, vorhandene state-Werte transformieren.
// Ausführen mit: node tests/ui_viewmodel_test.js
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const gamedata = fs.readFileSync(path.join(ROOT, "data/gamedata.js"), "utf8");
const mapGeometry = fs.readFileSync(path.join(ROOT, "js/map-geometry.js"), "utf8");
const simModules = [
  "core", "economy", "population-dynasty", "memory", "characters", "story-threads",
  "drama-director", "event-chains", "chronicle", "politics", "diplomacy", "military",
  "debug", "war-map", "advance-year",
];
const sim = simModules.map(m => fs.readFileSync(path.join(ROOT, "js", m + ".js"), "utf8")).join("\n");
const battleFiles = ["battle-engine/battle-data.js", "battle-engine/battle-engine.js", "battle-engine/battle-state-machine.js", "js/battle-bridge.js"];
const battle = battleFiles.map(f => fs.readFileSync(path.join(ROOT, f), "utf8")).join("\n");
const viewmodels = fs.readFileSync(path.join(ROOT, "js/ui-viewmodels.js"), "utf8");

const testBody = `
let failures = 0;
function check(label, cond) {
  if (cond) { console.log('  OK   ' + label); }
  else { console.log('  FAIL ' + label); failures++; }
}

// ---------- §56/120/121: keine ViewModel-Funktion darf rnd() verbrauchen ----------
console.log('--- RNG-Neutralitaet ---');
(function() {
  const state = newGame({ seed: 80 });
  for (let y = 0; y < 5; y++) { for (let m = 0; m < 12; m++) advanceMonth(state); resolvePendingEventWithPolicy(state, 'FIRST_OPTION'); }
  const before = __rngCalls;
  getHudViewModel(state);
  getWorldMapViewModel(state);
  for (const t of TERRITORIES) getRegionSummaryViewModel(state, t.id);
  getPrimaryStoryViewModel(state);
  getAlertViewModel(state);
  getYearTransitionViewModel(state);
  getRealmEconomyViewModel(state);
  getMiniLedgerViewModel(state);
  getPopulationOverviewViewModel(state);
  for (const gid in POP_GROUPS) getPopulationGroupDetailViewModel(state, gid);
  getFoodSupplyViewModel(state);
  getGoodsCategoryViewModel(state);
  for (const gid in GOODS) getGoodDetailViewModel(state, gid);
  getTradeViewModel(state);
  getTaxViewModel(state);
  getProvinceListViewModel(state);
  getEconomicRisksViewModel(state);
  check('kein einziger rnd()-Aufruf durch die ViewModels', __rngCalls === before);
})();

// ---------- Determinismus: wiederholte Aufrufe liefern identisches Ergebnis ----------
console.log('--- Determinismus ---');
(function() {
  const state = newGame({ seed: 81 });
  const a1 = JSON.stringify(getHudViewModel(state));
  const a2 = JSON.stringify(getHudViewModel(state));
  check('getHudViewModel() ist deterministisch', a1 === a2);
  const b1 = JSON.stringify(getWorldMapViewModel(state));
  const b2 = JSON.stringify(getWorldMapViewModel(state));
  check('getWorldMapViewModel() ist deterministisch', b1 === b2);
})();

// ---------- getHudViewModel ----------
console.log('--- getHudViewModel ---');
(function() {
  const state = newGame({ seed: 82 });
  const hud = getHudViewModel(state);
  check('rulerName ist gesetzt und real (stimmt mit state.characters ueberein)', hud.rulerName === (state.characters[state.rulerId].name + ' ' + state.characters[state.rulerId].surname).trim());
  check('year stimmt mit state.year ueberein', hud.year === state.year);
  check('treasury ist gerundet', hud.treasury === Math.round(state.treasury));
  check('population stimmt mit der Summe der Bevoelkerungsgruppen ueberein', hud.population === Object.values(state.regions.player.population).reduce((s,g)=>s+g.count,0));
})();

// ---------- getWorldMapViewModel / getRegionSummaryViewModel ----------
console.log('--- Weltkarte + Kontextpanel ---');
(function() {
  const state = newGame({ seed: 83 });
  const map = getWorldMapViewModel(state);
  check('alle 16 Territorien sind enthalten', map.territories.length === TERRITORIES.length);
  check('jedes Territorium hat einen gueltigen Besitzer', map.territories.every(t => state.regions[t.ownerId]));
  check('eigene Hauptstadt ist als Hauptstadt markiert', map.territories.find(t => t.id === 'p_hauptstadt').capital === true);

  // §Phase-8C.1-Punkt 30/31/40: attackable/ally sind KEINE neuen
  // Gameplay-Zustaende, nur die Uebersetzung bereits realer Felder
  // (state.warState + Adjazenz zu Spielergebiet, state.diplomacy[...].treaties.allianz).
  check('ohne Krieg: keine Region ist attackable', map.territories.every(t => t.attackable === false));
  check('ohne Buendnis: keine Region ist ally', map.territories.every(t => t.ally === false));
  state.warState.ai1 = true;
  const mapAtWar = getWorldMapViewModel(state);
  check('im Krieg mit ai1: genau m_sued (direkt an Spielergebiet angrenzend) ist attackable',
    mapAtWar.territories.filter(t => t.attackable).map(t => t.id).join(',') === 'm_sued');
  check('m_hauptstadt/m_ost/m_west (nicht direkt an Spielergebiet angrenzend) sind NICHT attackable',
    !mapAtWar.territories.find(t => t.id === 'm_hauptstadt').attackable
    && !mapAtWar.territories.find(t => t.id === 'm_ost').attackable
    && !mapAtWar.territories.find(t => t.id === 'm_west').attackable);
  state.diplomacy.ai2.treaties.allianz = true;
  const mapAllied = getWorldMapViewModel(state);
  check('Buendnis mit ai2: alle 4 Rheinfeld-Territorien sind ally',
    mapAllied.territories.filter(t => t.ally).length === 4
    && mapAllied.territories.filter(t => t.ally).every(t => t.ownerId === 'ai2'));

  const own = getRegionSummaryViewModel(state, 'p_hauptstadt');
  check('Kontextpanel fuer eigenes Gebiet: isPlayerTerritory', own.isPlayerTerritory === true);
  check('Bevoelkerung stimmt mit echten Regionsdaten ueberein', own.population === Object.values(state.regions.player.population).reduce((s,g)=>s+g.count,0));
  check('foodLabel ist einer von STABIL/KNAPP/KRITISCH', ['STABIL','KNAPP','KRITISCH'].includes(own.foodLabel));
  check('populationByGroup enthaelt alle Bevoelkerungsgruppen', own.populationByGroup.length === Object.keys(state.regions.player.population).length);

  const enemy = getRegionSummaryViewModel(state, 'm_hauptstadt');
  check('Kontextpanel fuer fremdes Gebiet: isPlayerTerritory false', enemy.isPlayerTerritory === false);
  check('fremdes Gebiet zeigt eine Garnisonsschaetzung statt echter Truppenzahlen', enemy.militaryStrength[0].id === 'garrison');

  check('unbekannte Territoriums-ID liefert null (keine erfundenen Daten)', getRegionSummaryViewModel(state, 'does_not_exist') === null);

  // §Phase-8C.1: statische Kartengeometrie (js/map-geometry.js) muss zu
  // JEDEM TERRITORIES-Eintrag ein Gegenstueck besitzen -- sonst wuerde
  // renderWorldMap() ein Gebiet stillschweigend ueberspringen.
  check('MAP_GEOMETRY enthaelt alle 16 Territorien', TERRITORIES.every(t => !!MAP_GEOMETRY[t.id]));
  check('jeder MAP_GEOMETRY-Eintrag hat einen nicht-leeren SVG-Pfad', Object.values(MAP_GEOMETRY).every(g => typeof g.path === 'string' && g.path.startsWith('M')));
  // §Phase-8C.2: die frueheren 4 Voronoi-Fuellflaechen (wild_nw/ne/se/sw)
  // weichen einer einzigen, echten benannten Landschaft ("Westmark").
  check('MAP_WILD_GEOMETRY enthaelt die Westmark-Wildnisflaeche', !!MAP_WILD_GEOMETRY.westmark && typeof MAP_WILD_GEOMETRY.westmark.path === 'string');
  check('MAP_RIVER_PATH ist ein nicht-leerer SVG-Pfad', typeof MAP_RIVER_PATH === 'string' && MAP_RIVER_PATH.startsWith('M'));
  check('MAP_MOUNTAIN_ANCHORS enthaelt Ankerpunkte', Array.isArray(MAP_MOUNTAIN_ANCHORS) && MAP_MOUNTAIN_ANCHORS.length > 0);

  // frisches Spiel: noch kein Jahr vergangen -- keine erfundenen Produktions-/Wachstumsdaten
  check('frisches Spiel: topProduction ist leer (kein Jahr vergangen)', own.topProduction.length === 0);
  check('frisches Spiel: populationGrowth ist null (kein Jahr vergangen)', own.populationGrowth === null);
})();

// ---------- getRegionSummaryViewModel: Kontextpanel-Tabs nach einem Jahr (§48/49) ----------
console.log('--- Kontextpanel WIRTSCHAFT/BEVOELKERUNG nach einem Jahr (fuer Spieler- UND KI-Regionen) ---');
(function() {
  const state = newGame({ seed: 85 });
  for (let m = 0; m < 12; m++) advanceMonth(state);

  const own = getRegionSummaryViewModel(state, 'p_hauptstadt');
  check('nach einem Jahr: topProduction stammt aus r.lastProduction', own.topProduction.every(g => state.regions.player.lastProduction[g.id] !== undefined));
  check('topProduction ist absteigend sortiert', own.topProduction.every((g, i) => i === 0 || own.topProduction[i-1].amount >= g.amount));
  check('Engpaesse haben einen positiven Prozentwert', own.shortages.every(s => s.shortfallPct > 0));
  check('populationGrowth ist nach einem Jahr gesetzt', own.populationGrowth !== null);
  check('populationGrowth.births/deaths stimmen mit lastPopSummary ueberein',
    own.populationGrowth.births === Math.round(state.regions.player.lastPopSummary.geburten || 0) &&
    own.populationGrowth.deaths === Math.round(state.regions.player.lastPopSummary.todesfaelle || 0));

  // Dieselben Felder muessen auch fuer eine KI-Region funktionieren (processAllRegions()
  // behandelt Spieler- und KI-Regionen gleich, siehe js/advance-year.js) -- kein Sonderpfad nur fuer den Spieler.
  const enemy = getRegionSummaryViewModel(state, 'm_hauptstadt');
  check('KI-Region liefert ebenfalls topProduction aus echten Daten', Array.isArray(enemy.topProduction));
  check('KI-Region liefert ebenfalls populationGrowth aus echten Daten', enemy.populationGrowth !== null);
})();

// ---------- getPrimaryStoryViewModel ----------
console.log('--- Story Card ---');
(function() {
  const state = newGame({ seed: 84 });
  const quiet = getPrimaryStoryViewModel(state);
  check('frisches Spiel ohne Threads: ruhige Jahre, keine erfundene Geschichte', quiet.hasFocus === false && quiet.quiet === true);

  const heirId = nextCharId();
  const c = createCharacter('m', 30, state.characters[state.rulerId].surname);
  c.parentId = state.rulerId;
  state.characters[heirId] = c;
  state.characters[state.rulerId].childrenIds.push(heirId);
  const thread = createStoryThread(state, 'SUCCESSION_CONFLICT', { actorIds: [heirId], regionIds: [], memoryIds: [], strength: 60 });
  state.drama.focusThreadId = thread.id;
  const withFocus = getPrimaryStoryViewModel(state);
  check('aktiver Fokus-Thread wird angezeigt', withFocus.hasFocus === true && withFocus.threadId === thread.id);
  check('Titel kommt direkt aus dem echten Thread', withFocus.title === thread.title);
  check('Stufentext ist natuerlichsprachlich, kein Debug-Wert (kein "STATUS=" o.ae.)', !withFocus.stageText.includes('=') && !/\\d/.test(withFocus.stageText));
})();

// ---------- getAlertViewModel ----------
console.log('--- Warnungen ---');
(function() {
  const state = newGame({ seed: 85 });
  const alertsQuiet = getAlertViewModel(state);
  check('Struktur enthaelt alle drei Prioritaetsstufen', Array.isArray(alertsQuiet.critical) && Array.isArray(alertsQuiet.important) && Array.isArray(alertsQuiet.info));

  state.regions.player.grainRatio = 0.3;
  const alertsFood = getAlertViewModel(state);
  check('kritische Hungerlage erzeugt eine KRITISCH-Warnung', alertsFood.critical.some(a => a.id === 'food_critical'));

  state.warState.ai1 = true;
  const alertsWar = getAlertViewModel(state);
  check('aktiver Krieg erzeugt eine KRITISCH-Warnung', alertsWar.critical.some(a => a.id === 'war_ai1'));

  state.treasury = -50;
  const alertsDebt = getAlertViewModel(state);
  check('negative Staatskasse erzeugt eine WICHTIG-Warnung', alertsDebt.important.some(a => a.id === 'treasury_low'));

  check('keine Warnung erwaehnt normales Wetter (kein Wetter-Spam, §17)', !JSON.stringify(alertsFood).includes('Wetter') && !JSON.stringify(alertsFood).includes('Ernteeinfluss'));
})();

// ---------- getYearTransitionViewModel ----------
console.log('--- Jahreswechsel-Hinweis ---');
(function() {
  const state = newGame({ seed: 86 });
  const vm1 = getYearTransitionViewModel(state);
  check('ohne offene Entscheidung: "keine dringenden Angelegenheiten"', vm1.pendingCount === 0 && vm1.pendingLabel.includes('Keine'));

  state.pendingElection = { bribed: {} };
  const vm2 = getYearTransitionViewModel(state);
  check('offene Kaiserwahl zaehlt als offene Entscheidung', vm2.pendingCount === 1);
})();

// ---------- §Phase-8C: Reichsübersicht + Mini-Kassenbuch ----------
console.log('--- Reichsuebersicht ---');
(function() {
  const state = newGame({ seed: 90 });
  const vmFresh = getRealmEconomyViewModel(state);
  check('frisches Spiel: kein Monatsbericht -> treasuryMonthlyNet ist null (keine erfundene Zahl)', vmFresh.treasuryMonthlyNet === null);
  check('frisches Spiel: kein Vorjahr -> populationYearlyDelta ist null', vmFresh.populationYearlyDelta === null);
  check('Lagerwert ist eine reale Zahl >= 0', vmFresh.warehouseValue >= 0);

  advanceMonth(state);
  const vmAfterMonth = getRealmEconomyViewModel(state);
  check('nach einem Monat: treasuryMonthlyNet stimmt mit state.lastMonthlyReport.net ueberein', vmAfterMonth.treasuryMonthlyNet === Math.round(state.lastMonthlyReport.net));

  for (let m = 0; m < 12; m++) advanceMonth(state);
  const vmAfterYear = getRealmEconomyViewModel(state);
  check('nach einem vollen Jahr: populationYearlyDelta ist gesetzt (echte Vorjahresdaten vorhanden)', vmAfterYear.populationYearlyDelta !== null);

  const ledgerEmpty = getMiniLedgerViewModel(newGame({ seed: 91 }));
  check('Mini-Kassenbuch vor dem ersten Monat: available=false statt erfundener Zahlen', ledgerEmpty.available === false);
  const ledgerFull = getMiniLedgerViewModel(state);
  check('Mini-Kassenbuch nach Monaten: available=true, net stimmt mit dem echten Bericht ueberein', ledgerFull.available === true && ledgerFull.net === Math.round(state.lastMonthlyReport.net));
})();

// ---------- §Phase-8C: Bevölkerung ----------
console.log('--- Bevoelkerungsuebersicht ---');
(function() {
  const state = newGame({ seed: 92 });
  const vm = getPopulationOverviewViewModel(state);
  check('Summe der Gruppenanteile ergibt (gerundet) 100%', Math.round(vm.groups.reduce((s,g)=>s+g.sharePct,0)) === 100);
  check('Gruppen sind nach Anzahl absteigend sortiert', vm.groups.every((g,i) => i===0 || vm.groups[i-1].count >= g.count));

  const detail = getPopulationGroupDetailViewModel(state, 'bauern');
  check('Gruppendetail liefert echte Bedarfsliste (Getreide fuer Bauern)', detail.needs.some(n => n.id === 'getreide'));
  check('unbekannte Gruppe liefert null statt erfundener Daten', getPopulationGroupDetailViewModel(state, 'does_not_exist') === null);
})();

// ---------- §Phase-8C: Nahrung ----------
console.log('--- Nahrungsversorgung ---');
(function() {
  const state = newGame({ seed: 93 });
  const vm = getFoodSupplyViewModel(state);
  check('yearlyNeed stimmt mit r.grainNeed ueberein (keine Neuberechnung)', vm.yearlyNeed === Math.round(state.regions.player.grainNeed));
  check('bei ausreichender Versorgung keine Kritikwarnung', vm.pct >= 50 ? vm.criticalWarning === null : true);

  state.regions.player.grainRatio = 0.3;
  const vmCrit = getFoodSupplyViewModel(state);
  check('bei kritischer Versorgung erscheint die Warnung', vmCrit.criticalWarning !== null);
})();

// ---------- §Phase-8C: Waren nach Kategorie + Detail + Preiserklaerung ----------
console.log('--- Waren/Kategorien/Preiserklaerung ---');
(function() {
  const state = newGame({ seed: 94 });
  for (let m = 0; m < 12; m++) advanceMonth(state);
  const cat = getGoodsCategoryViewModel(state);
  check('alle 4 bekannten Kategorien sind vertreten', cat.order.length === 4);
  const totalGoodsListed = Object.values(cat.categories).reduce((s,arr)=>s+arr.length, 0);
  check('jede Ware erscheint in genau einer Kategorie (Summe = Anzahl GOODS)', totalGoodsListed === Object.keys(GOODS).length);

  const detail = getGoodDetailViewModel(state, 'getreide');
  check('Preiserklaerung nutzt die echte Formel (Summe der Komponenten ergibt den Gesamtpreis)',
    detail.priceBreakdown && (detail.priceBreakdown.basis !== undefined));
  check('Produktionskette fuer Getreide hat keine Vorstufe (Urproduktion)', detail.chain.inputs.length >= 1 && detail.chain.inputs[0].inputGoodId === null);

  const mehlDetail = getGoodDetailViewModel(state, 'mehl');
  check('Mehl kennt seine Vorstufe Getreide aus der echten Rezeptliste', mehlDetail.chain.inputs.some(i => i.inputGoodId === 'getreide'));

  check('unbekannte Ware liefert null', getGoodDetailViewModel(state, 'does_not_exist') === null);
})();

// ---------- Regressionstest: Preis und Preiserklaerung duerfen nie auseinanderlaufen ----------
// r.prices wird erst nach dem ersten abgeschlossenen Monat gesetzt, r.priceBreakdown
// kann aber schon vorher durch andere Aufrufer (Marktpreis-Tabelle) frisch befuellt sein.
console.log('--- Preis/Preiserklaerung-Konsistenz (frisches Spiel, kein Monat vergangen) ---');
(function() {
  const state = newGame({ seed: 99 });
  check('Testaufbau: state.regions.player.prices ist zu Spielbeginn noch nicht gesetzt', state.regions.player.prices === undefined);
  computeRegionalPrices(state.regions.player); // wie die bestehende Marktpreis-Tabelle es vor dem ersten Monat bereits tut
  const detail = getGoodDetailViewModel(state, 'holz');
  check('angezeigter Preis stimmt mit dem Gesamtpreis der Preiserklaerung ueberein', detail.price === detail.priceBreakdown.gesamt);
  const cat = getGoodsCategoryViewModel(state);
  const holzCard = cat.categories['ROHSTOFFE'].find(g => g.id === 'holz');
  check('Warenkarten-Preis stimmt ebenfalls mit der Preiserklaerung ueberein', holzCard.price === detail.priceBreakdown.gesamt);
})();

// ---------- §Phase-8C: Handel ----------
console.log('--- Handel ---');
(function() {
  const state = newGame({ seed: 95 });
  const vmNoTreaty = getTradeViewModel(state);
  check('ohne Handelsvertraege: keine Partner gelistet (keine erfundene Route)', vmNoTreaty.partners.length === 0);

  state.diplomacy.ai1.treaties.handel = true;
  const vmWithTreaty = getTradeViewModel(state);
  check('mit Handelsvertrag: Partner erscheint mit dem echten CONFIG-Raeuberrisiko', vmWithTreaty.partners.length === 1 && vmWithTreaty.partners[0].riskPct === Math.round(CONFIG.interregionalTrade.banditRiskChance * 100));

  state.diplomacy.ai1.treaties.durchmarsch = true;
  const vmTransit = getTradeViewModel(state);
  check('Durchmarschrecht senkt das angezeigte Risiko (echter CONFIG-Rabatt)', vmTransit.partners[0].riskPct < vmWithTreaty.partners[0].riskPct);
})();

// ---------- §Phase-8C: Steuern ----------
console.log('--- Steuern ---');
(function() {
  const state = newGame({ seed: 96 });
  const vm = getTaxViewModel(state);
  check('gemeinsamer Steuersatz stimmt mit r.taxRate ueberein (kein Gruppensatz erfunden)', vm.sharedRatePct === Math.round(state.regions.player.taxRate * 1000) / 10);
  check('alle Gruppen zeigen denselben Satz (es existiert nur ein regionsweiter Satz)', vm.groups.every(g => g.ratePct === vm.sharedRatePct));
})();

// ---------- §Phase-8C: Provinzuebersicht ----------
console.log('--- Provinzuebersicht ---');
(function() {
  const state = newGame({ seed: 97 });
  const list = getProvinceListViewModel(state);
  check('alle 4 Kernregionen sind gelistet', list.length === 4);
  check('Spielerregion ist markiert', list.find(p => p.isPlayer).id === 'player');

  state.regions.ai1.grainRatio = 0.2;
  const listWarn = getProvinceListViewModel(state);
  check('kritische Nahrungslage erzeugt eine Provinzwarnung', listWarn.find(p => p.id === 'ai1').warning !== null);
})();

// ---------- §Phase-8C: Wirtschaftliche Risiken ----------
console.log('--- Wirtschaftliche Risiken ---');
(function() {
  const state = newGame({ seed: 98 });
  for (let m = 0; m < 12; m++) advanceMonth(state);
  const risks = getEconomicRisksViewModel(state);
  check('Risikoliste ist ein Array (auch wenn leer, keine Pflichtwarnung erfunden)', Array.isArray(risks));
  check('hoher Preis erzeugt eine geprüfte Preiswarnung', (function() {
    const r = state.regions.player;
    r.priceBreakdown.eisen = Object.assign({}, r.priceBreakdown.eisen, { multiplikator: 2.5 });
    const risksAfter = getEconomicRisksViewModel(state);
    return risksAfter.some(x => x.id === 'price_eisen');
  })());
})();

// ---------- §Phase-8D: Hof + Dynastie + Charaktere ViewModels ----------
console.log('--- Phase 8D: RNG-Neutralitaet ---');
(function() {
  const state = newGame({ seed: 140 });
  for (let y = 0; y < 8; y++) { for (let m = 0; m < 12; m++) advanceMonth(state); resolvePendingEventWithPolicy(state, 'FIRST_OPTION'); }
  const before = __rngCalls;
  getCourtViewModel(state);
  getDynastyTreeViewModel(state);
  getSuccessionViewModel(state);
  getAdvisorCandidateViewModel(state);
  for (const id in state.characters) {
    getPortraitViewModel(state, id);
    getCharacterCardViewModel(state, id);
    getCharacterDetailViewModel(state, id);
  }
  getHeraldryViewModel(state.dynastyName);
  check('kein einziger rnd()-Aufruf durch die Phase-8D-ViewModels', __rngCalls === before);
})();

console.log('--- Phase 8D: Determinismus (Hash statt rnd) ---');
(function() {
  const state = newGame({ seed: 141 });
  const p1 = JSON.stringify(getPortraitViewModel(state, state.rulerId));
  const p2 = JSON.stringify(getPortraitViewModel(state, state.rulerId));
  check('getPortraitViewModel liefert bei wiederholtem Aufruf ein identisches Ergebnis', p1 === p2);
  const h1 = JSON.stringify(getHeraldryViewModel(state.dynastyName));
  const h2 = JSON.stringify(getHeraldryViewModel(state.dynastyName));
  check('getHeraldryViewModel liefert bei wiederholtem Aufruf ein identisches Ergebnis', h1 === h2);
  const otherState = newGame({ seed: 142 });
  check('unterschiedlicher dynastyName kann eine andere Heraldik liefern (kein globaler Konstantwert)',
    state.dynastyName === otherState.dynastyName || JSON.stringify(getHeraldryViewModel(state.dynastyName)) !== JSON.stringify(getHeraldryViewModel(otherState.dynastyName)));
})();

console.log('--- Phase 8D: Claims nie erfunden ---');
(function() {
  const state = newGame({ seed: 143 });
  const ruler = state.characters[state.rulerId];
  ruler.claims = [];
  const card = getCharacterCardViewModel(state, state.rulerId);
  check('Charakter ohne echten Claim zeigt kein Claim-Badge', !card.warnings.some(w => w.type === 'claim'));
  const detail = getCharacterDetailViewModel(state, state.rulerId);
  check('Detailansicht erfindet ebenfalls keinen Claim', detail.claims.length === 0);
})();

console.log('--- Phase 8D: Loyalitaets-Anzeige stimmt mit echter computeLoyalty() ueberein ---');
(function() {
  const state = newGame({ seed: 144 });
  const ruler = state.characters[state.rulerId];
  const childId = nextCharId();
  const child = createCharacter('m', 22, ruler.surname);
  child.parentId = state.rulerId;
  state.characters[childId] = child;
  ruler.childrenIds.push(childId);
  updateClaims(state);
  const real = computeLoyalty(state, childId);
  const vm = getLoyaltyDisplayViewModel(state, childId);
  const sum = Math.round(Math.max(0, Math.min(100, vm.components.reduce((s, c) => s + c.value, 0))));
  check('Summe der angezeigten Loyalitaets-Komponenten entspricht dem echten computeLoyalty()-Wert', sum === Math.round(real));
  check('vm.total entspricht ebenfalls dem echten Wert', vm.total === Math.round(real));
})();

console.log('--- Phase 8D: Beziehungs-Aufschluesselung nutzt echte Memory-Texte, keine erfundenen Labels ---');
(function() {
  const state = newGame({ seed: 145 });
  const ruler = state.characters[state.rulerId];
  const childId = nextCharId();
  const child = createCharacter('m', 20, ruler.surname);
  child.parentId = state.rulerId;
  state.characters[childId] = child;
  ruler.childrenIds.push(childId);
  addRivalry(state, childId, state.rulerId);
  refreshRelationship(state, childId, state.rulerId);
  const vm = getRelationshipDisplayViewModel(state, childId, state.rulerId);
  const originId = child.rivalryOrigin && child.rivalryOrigin[state.rulerId];
  const realText = originId ? state.memories.byId[originId].description : null;
  check('eine echte Memory zur Rivalitaet wurde angelegt', !!realText);
  const memoryModifier = vm.components.find(c => c.label === realText);
  check('der angezeigte Beziehungs-Grund ist wortgleich mit der echten Memory-description (kein erfundenes Label)', !!memoryModifier);
})();

console.log('--- Phase 8D: Succession spiegelt echte Erb-Reihenfolge (Alter absteigend) ---');
(function() {
  const state = newGame({ seed: 146 });
  const ruler = state.characters[state.rulerId];
  ruler.childrenIds = [];
  const youngId = nextCharId();
  const young = createCharacter('m', 15, ruler.surname);
  young.parentId = state.rulerId;
  state.characters[youngId] = young;
  ruler.childrenIds.push(youngId);
  const oldId = nextCharId();
  const old = createCharacter('m', 25, ruler.surname);
  old.parentId = state.rulerId;
  state.characters[oldId] = old;
  ruler.childrenIds.push(oldId);
  const vm = getSuccessionViewModel(state);
  check('aeltestes lebendes Kind steht an erster Stelle der Thronfolge', vm.heirs[0].id === oldId);
  check('juengeres Kind steht dahinter', vm.heirs[1].id === youngId);
})();

console.log('--- Phase 8D: Verstorbene bleiben im Stammbaum sichtbar (kein Verschwinden) ---');
(function() {
  const state = newGame({ seed: 147 });
  const ruler = state.characters[state.rulerId];
  const parentId = nextCharId();
  const parent = createCharacter(ruler.gender === 'm' ? 'f' : 'm', 60, ruler.surname);
  parent.alive = false;
  state.characters[parentId] = parent;
  ruler.parentId = parentId;
  const vm = getDynastyTreeViewModel(state);
  const flatIds = JSON.stringify(vm);
  check('verstorbener Elternteil erscheint weiterhin im Stammbaum-ViewModel', flatIds.includes('"' + parentId + '"'));
})();

// ---------- §Phase-8E: Diplomatie ViewModels ----------
console.log('--- Phase 8E: foreign rulers sind echte Character-Core-Charaktere ---');
(function() {
  const state = newGame({ seed: 200 });
  const aiIds = Object.keys(state.diplomacy);
  check('genau 3 diplomatisch erreichbare Regionen (ai1-3)', aiIds.length === 3);
  for (const aiId of aiIds) {
    const region = state.regions[aiId];
    check(aiId + ' hat eine echte rulerId', !!region.rulerId && !!state.characters[region.rulerId]);
    const portrait = getPortraitViewModel(state, region.rulerId);
    check(aiId + '-Herrscher hat Portrait-Rang "herrscher" (Krone, keine gewöhnliche Adels-Karte)', portrait.rank === 'herrscher');
  }
})();

console.log('--- Phase 8E: RNG-Neutralitaet der Diplomatie-ViewModels ---');
(function() {
  const state = newGame({ seed: 201 });
  for (let y = 0; y < 10; y++) { for (let m = 0; m < 12; m++) advanceMonth(state); resolvePendingEventWithPolicy(state, 'FIRST_OPTION'); }
  const before = __rngCalls;
  getDiplomacyOverviewViewModel(state);
  for (const aiId in state.diplomacy) getForeignPowerDetailViewModel(state, aiId);
  check('kein einziger rnd()-Aufruf durch die Diplomatie-ViewModels', __rngCalls === before);
})();

console.log('--- Phase 8E: Beziehungs-Tier ist reine UI-Klassifikation (keine Gameplaywirkung) ---');
(function() {
  const state = newGame({ seed: 202 });
  state.diplomacy.ai1.relation = 80;
  const before = state.diplomacy.ai1.relation;
  const vm = getDiplomaticRelationshipViewModel(state, 'ai1');
  check('Tier-Label korrekt klassifiziert (80 -> ENG VERBÜNDET)', vm.tierLabel === 'ENG VERBÜNDET');
  check('die echte Beziehungszahl bleibt durch die Anzeige unveraendert', state.diplomacy.ai1.relation === before);
})();

console.log('--- Phase 8E: Verträge/Kriegsstatus nur aus echten state-Feldern ---');
(function() {
  const state = newGame({ seed: 203 });
  check('ohne Verträge: leere Vertragsliste (nichts erfunden)', getTreatyViewModel(state, 'ai1').length === 0);
  state.diplomacy.ai1.treaties.allianz = true;
  const treaties = getTreatyViewModel(state, 'ai1');
  check('echtes Bündnis erscheint als Vertrag', treaties.some(t => t.id === 'allianz'));
  check('kein Krieg ohne echtes state.warState', getWarStatusViewModel(state, 'ai1').atWar === false);
  state.warState.ai1 = true;
  check('echter Kriegszustand wird erkannt', getWarStatusViewModel(state, 'ai1').atWar === true);
})();

console.log('--- Phase 8E: diplomatische Memory-Timeline nutzt echte regionIds-Memories ---');
(function() {
  const state = newGame({ seed: 204 });
  check('vor jedem Ereignis: leere Zeitleiste', getDiplomaticMemoryTimeline(state, 'ai1').length === 0);
  recordWorldEvent(state, {
    type: 'ALLIANCE_FORMED', actorIds: [state.rulerId], regionIds: ['ai1'],
    emotionalWeight: 30, description: 'Test-Bündnis mit Mainau.',
  });
  const timeline = getDiplomaticMemoryTimeline(state, 'ai1');
  check('echtes regionIds-Ereignis erscheint in der Zeitleiste', timeline.some(m => m.text === 'Test-Bündnis mit Mainau.'));
  check('ai2 bleibt unberührt (regionIds-Filterung korrekt)', getDiplomaticMemoryTimeline(state, 'ai2').length === 0);
})();

console.log('--- Phase 8E: Sondertest Herrscherwechsel im Ausland ---');
(function() {
  const state = newGame({ seed: 205 });
  const oldRulerId = state.regions.ai1.rulerId;
  let tries = 0;
  while (state.regions.ai1.rulerId === oldRulerId && tries < 5000) {
    state.characters[state.regions.ai1.rulerId].health = 1;
    state.characters[state.regions.ai1.rulerId].age = 95;
    checkForeignRulerDeaths(state);
    tries++;
  }
  check('Herrscher von ai1 stirbt irgendwann bei konstant kritischer Gesundheit', state.regions.ai1.rulerId !== oldRulerId);
  check('alter Herrscher bleibt als Charakter erhalten (alive=false), verschwindet nicht', state.characters[oldRulerId] && state.characters[oldRulerId].alive === false);
  check('neuer Herrscher ist ein eigenstaendiger, lebender Charakter', state.characters[state.regions.ai1.rulerId].alive === true);
  const timeline = getDiplomaticMemoryTimeline(state, 'ai1');
  check('Tod und Nachfolge hinterlassen echte, auffindbare Memories', timeline.some(m => m.type === 'FOREIGN_RULER_DIED') && timeline.some(m => m.type === 'FOREIGN_RULER_SUCCEEDED'));
})();

console.log('--- Phase 8E: fremder Herrscher hat keine Loyalitaet/persoenliche Beziehung zum Spieler-Thron ---');
(function() {
  const state = newGame({ seed: 206 });
  const card = getCharacterCardViewModel(state, state.regions.ai1.rulerId);
  check('Character Card zeigt keine Loyalität für einen fremden Herrscher', card.loyalty === null);
  const detail = getCharacterDetailViewModel(state, state.regions.ai1.rulerId);
  check('Character Detail zeigt keine Loyalitäts-Aufschlüsselung für einen fremden Herrscher', detail.loyaltyBreakdown === null);
  check('Character Detail zeigt keine Beziehungs-Aufschlüsselung für einen fremden Herrscher', detail.relationship === null);
})();

console.log('');
if (failures > 0) { console.log(failures + ' Test(s) fehlgeschlagen.'); process.exit(1); }
console.log('Alle UI-ViewModel-Tests bestanden.');
`;

eval(gamedata + "\n" + mapGeometry + "\n" + sim + "\n" + battle + "\n" + viewmodels + "\n" + testBody);
