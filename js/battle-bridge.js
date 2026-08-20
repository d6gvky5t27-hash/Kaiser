// ============================================================
// KRIEGS-BRÜCKE — verbindet das Hauptspiel-Militärsystem mit der
// vollständigen Kampf-Engine (battle-engine/). Ersetzt die bisherige
// Sofortauflösung durch den vollen interaktiven Kampfbildschirm.
// ============================================================

// Umrechnung: Hauptspiel-Truppentypen (5) -> Kampf-Engine-Einheitentypen (5).
// Bogenschützen und Armbrustschützen werden zu einer Fernkampf-Einheit
// zusammengefasst, Söldner kämpfen als Linieninfanterie, Ritter als
// Kavallerie — die Kampf-Engine kennt keine Vasall-/Söldner-Unterscheidung
// mehr, die bleibt eine reine Rekrutierungs-Eigenschaft des Hauptspiels.
// opts.defending: true, wenn der Spieler eine von der KI selbst ausgelöste
// Kriegserklärung abwehrt (§31) statt selbst anzugreifen — wirkt sich auf
// isAttacker/isHomeTerritory aus (u.a. Miliz-Heimvorteil, §Konter-System).
function buildPlayerBattleArmy(state, opts) {
  opts = opts || {};
  const r = state.regions.player;
  const stacks = [];
  const push = (unitType, count) => { if (count > 0) stacks.push(createUnitStack(unitType, Math.round(count))); };

  push("miliz", state.army.miliz);
  push("bogenschuetzen", state.army.bogenschuetzen + state.army.armbrustschuetzen);
  push("pikeniere", state.army.pikeniere);
  push("kavallerie", state.army.ritter);
  push("schwere_kavallerie", state.army.schwere_kavallerie);
  push("infanterie", state.army.soeldner);

  // Kaserne/Markt/Mühle-Bonus (bisher ein abstrakter Stärkewert) wird als
  // zusätzliche, gut ausgebildete Miliz übersetzt, damit er in der neuen
  // Engine weiterhin spürbar bleibt.
  const kaserneBonus = buildingLevelSum(r, "kaserne") * 15;
  const autoMilizBonus = (buildingLevelSum(r, "markt") + buildingLevelSum(r, "muehle")) * 2;
  const extraMiliz = Math.round(kaserneBonus + autoMilizBonus);
  if (extraMiliz > 0) push("miliz", extraMiliz);

  if (stacks.length === 0) stacks.push(createUnitStack("miliz", 1)); // nie eine leere Armee antreten lassen

  const ruler = state.characters[state.rulerId];
  const commander = createCommander(
    ruler ? `${ruler.name} ${ruler.surname}` : "Unbekannter Feldherr",
    ruler ? clamp(ruler.stats.diplomatie * 5, 10, 90) : 50,   // tactics
    ruler ? clamp(ruler.stats.militaer * 5, 10, 95) : 50,     // leadership
    ruler ? clamp(ruler.stats.charisma * 5, 10, 90) : 50,     // courage
    ruler ? clamp(ruler.age, 20, 80) : 40                      // experience
  );

  const marschallBonus = advisorEffectBonus(state, "marschall");
  if (marschallBonus) commander.leadership = clamp(commander.leadership + marschallBonus * 15, 10, 99);

  return createArmy(r.name, commander, stacks, { isAttacker: !opts.defending, isHomeTerritory: !!opts.defending });
}

// Für KI-Regionen existieren keine echten Truppenstapel (nur der abstrakte
// estimateAiStrength-Wert) — hier wird eine plausible, aber nicht exakte
// Zusammensetzung generiert, die ungefähr dieselbe Größenordnung ergibt.
// opts.attacking: true, wenn diese KI-Region selbst den Krieg erklärt hat
// (§31) statt vom Spieler angegriffen zu werden — flippt isAttacker/
// isHomeTerritory entsprechend um (der Spieler verliert dann seinen sonst
// impliziten Heimvorteil-Nachteil beim Gegner, siehe buildPlayerBattleArmy).
function buildAiBattleArmy(state, aiId, weakenFactor, opts) {
  opts = opts || {};
  const region = state.regions[aiId];
  const totalPop = Object.values(region.population).reduce((s, g) => s + g.count, 0);
  const kaserneLevel = buildingLevelSum(region, "kaserne");
  const mobilizationRate = 0.02 + kaserneLevel * 0.003;
  const totalSoldierCount = Math.max(80, Math.round(totalPop * mobilizationRate));

  // Pikeniere treten erst mit einer gewissen militärischen Grundausbildung
  // (Kaserne) als eigener Anteil in Erscheinung — vorher stellt die KI-Region
  // nur die drei ursprünglichen Grundtypen.
  const hasArtillery = kaserneLevel >= 2;
  const hasPikes = kaserneLevel >= 1;
  const shares = hasArtillery
    ? { infanterie: 0.42, bogenschuetzen: 0.20, kavallerie: 0.18, artillerie: 0.08, pikeniere: 0.12 }
    : hasPikes
      ? { infanterie: 0.45, bogenschuetzen: 0.22, kavallerie: 0.18, pikeniere: 0.15 }
      : { infanterie: 0.55, bogenschuetzen: 0.25, kavallerie: 0.20 };

  const factor = weakenFactor !== undefined ? weakenFactor : 1.0;
  const stacks = [];
  for (const unitType in shares) {
    const count = Math.round(totalSoldierCount * shares[unitType] * factor);
    if (count > 0) stacks.push(createUnitStack(unitType, count, { morale: Math.round(50 * factor + 20) }));
  }
  if (stacks.length === 0) stacks.push(createUnitStack("miliz", Math.max(10, Math.round(50 * factor))));

  // Individueller, über mehrere Schlachten persistenter Hauptmann (statt bei
  // jeder Kriegserklärung neu ausgewürfelt) — siehe generateCommander() in core.js.
  if (!region.commander) region.commander = generateCommander(region.name); // defensiv für ältere Spielstände
  const persisted = region.commander;
  const commander = createCommander(persisted.name, persisted.tactics, persisted.leadership, persisted.courage, persisted.experience);

  return createArmy(region.name, commander, stacks, { isAttacker: !!opts.attacking, isHomeTerritory: !opts.attacking });
}

// Aktualisiert den persistenten KI-Kommandanten nach einer ausgetragenen
// Schlacht: Erfahrung/Führung wachsen mit jedem Gefecht leicht, ein
// gefallener Kommandant wird durch einen neu benannten Nachfolger ersetzt.
function updateAiCommanderAfterBattle(state, aiId, battleResult) {
  const region = state.regions[aiId];
  if (!region.commander) return;
  const foughtCommander = battleResult.armyB.commander;
  const won = battleResult.result.winner === "B";
  region.commander.battlesFought += 1;
  if (won) region.commander.battlesWon += 1;
  if (!foughtCommander.alive) {
    const oldName = region.commander.name;
    region.commander = generateCommander(region.name);
    addChronicle(state, `${oldName} ist in der Schlacht gefallen. ${region.commander.name} übernimmt fortan das Kommando über die Truppen von ${region.name}.`);
  } else {
    region.commander.experience = clamp(region.commander.experience + 3, 20, 95);
    region.commander.leadership = clamp(region.commander.leadership + 1, 10, 99);
  }
}

// Ermittelt das Gelände aus dem Befestigungsgrad der Zielregion (§12/§36
// des ursprünglichen Kampf-Engine-Auftrags: Burg gibt dem Verteidiger einen
// sehr starken Bonus).
function determineWarTerrain(region) {
  if (buildingLevelSum(region, "stadtmauer") > 0) return "burg";
  return "ebene";
}

// ---------- Mehrjährige Belagerung (§36), jetzt kombiniert mit der Kampf-Engine:
// die Belagerung selbst bleibt eine mehrjährige strategische Entscheidung
// (Aushungern schwächt den Verteidiger, Bestechung kann sie ohne Schlacht
// beenden), aber ein Sturmangriff wird über die volle interaktive
// Kampf-Engine ausgetragen statt über eine reine Wahrscheinlichkeitsformel.
function startSiege(state, aiId) {
  const cfg = CONFIG.siege;
  const region = state.regions[aiId];
  const wallLevel = buildingLevelSum(region, "stadtmauer");
  const duration = Math.min(cfg.maxDuration, wallLevel * cfg.durationPerWallLevel);
  state.pendingSiege = { targetId: aiId, duration, defenderStrengthFactor: 1.0 };
  addChronicle(state, `Die Belagerung von ${region.name} beginnt (Stadtmauer verteidigt, bis zu ${duration} Jahre möglich).`);
  return { ok: true, duration };
}

function siegeStarve(state) {
  if (!state.pendingSiege) return { ok: false, reason: "Keine Belagerung im Gange." };
  const cfg = CONFIG.siege;
  const s = state.pendingSiege;
  const region = state.regions[s.targetId];
  s.defenderStrengthFactor = Math.max(0.25, s.defenderStrengthFactor - cfg.starveStrengthDrainPerYear);
  let upkeep = 0;
  for (const type in state.army) upkeep += state.army[type] * TROOP_TYPES[type].upkeep * cfg.starveUpkeepShare;
  state.treasury -= Math.round(upkeep);
  s.duration -= 1;
  addChronicle(state, `Die Belagerung von ${region.name} zieht sich hin — der Verteidiger schwächt sich (Faktor ${s.defenderStrengthFactor.toFixed(2)}).`);
  if (s.duration <= 0) {
    addChronicle(state, `Die maximale Belagerungsdauer ist erreicht — ein Sturmangriff ist jetzt unausweichlich.`);
  }
  return { ok: true, forced: s.duration <= 0 };
}

function siegeBribe(state) {
  if (!state.pendingSiege) return { ok: false, reason: "Keine Belagerung im Gange." };
  const cfg = CONFIG.siege;
  if (state.treasury < cfg.bribeCost) return { ok: false, reason: "Nicht genug Taler für die Bestechung." };
  state.treasury -= cfg.bribeCost;
  const s = state.pendingSiege;
  const region = state.regions[s.targetId];
  const dip = state.diplomacy[s.targetId];
  if (rnd() < cfg.bribeSuccessChance) {
    const loot = Math.round((region.warehouse.getreide || 0) * 0.1);
    state.treasury += loot;
    state.prestige += Math.round(CONFIG.military.victoryPrestigeGain * 0.6);
    state.stats.warsWon++;
    if (!state.warsWonAgainst) state.warsWonAgainst = {};
    state.warsWonAgainst[s.targetId] = true;
    addChronicle(state, `Die Garnison von ${region.name} wurde bestochen und übergibt die Stadt kampflos!`);
    state.pendingSiege = null;
    return { ok: true, won: true };
  } else {
    dip.relation = clamp(dip.relation + cfg.bribeRelationPenalty, -100, 100);
    addChronicle(state, `Der Bestechungsversuch bei ${region.name} wurde entdeckt und schlug fehl.`);
    return { ok: true, won: false };
  }
}

function applyBattleResultToGame(state, aiId, battleResult) {
  const cfg = CONFIG.military;
  const dip = state.diplomacy[aiId];
  const region = state.regions[aiId];
  const r = battleResult.result;
  const won = r.winner === "A";

  // Eine laufende Belagerung dieser Region endet mit dem Sturmangriff, egal wie er ausgeht
  if (state.pendingSiege && state.pendingSiege.targetId === aiId) state.pendingSiege = null;

  // Truppenverluste anteilig auf die tatsächlichen Hauptspiel-Truppentypen zurückrechnen
  const survivalRatio = {};
  for (const stack of battleResult.armyA.stacks) {
    survivalRatio[stack.unitType] = stack.maxSoldiers > 0 ? stack.soldiers / stack.maxSoldiers : 1;
  }
  const applyRatio = (unitType, fallback) => (survivalRatio[unitType] !== undefined ? survivalRatio[unitType] : fallback);
  state.army.miliz = Math.round(state.army.miliz * applyRatio("miliz", 0.9));
  const rangedRatio = applyRatio("bogenschuetzen", 0.9);
  state.army.bogenschuetzen = Math.round(state.army.bogenschuetzen * rangedRatio);
  state.army.armbrustschuetzen = Math.round(state.army.armbrustschuetzen * rangedRatio);
  state.army.pikeniere = Math.round(state.army.pikeniere * applyRatio("pikeniere", 0.9));
  state.army.ritter = Math.round(state.army.ritter * applyRatio("kavallerie", 0.9));
  state.army.schwere_kavallerie = Math.round(state.army.schwere_kavallerie * applyRatio("schwere_kavallerie", 0.9));
  state.army.soeldner = Math.round(state.army.soeldner * applyRatio("infanterie", 0.9));

  updateAiCommanderAfterBattle(state, aiId, battleResult);

  // Diplomatische/wirtschaftliche Konsequenzen wie zuvor
  const hadPact = dip.treaties.nichtangriff || dip.treaties.allianz;
  dip.treaties.nichtangriff = false; dip.treaties.allianz = false; dip.treaties.handel = false;
  dip.relation = clamp(dip.relation + cfg.warRelationCrash, -100, 100);
  if (hadPact) state.prestige = Math.max(0, state.prestige - cfg.breakPactPrestigePenalty);

  if (won) {
    const loot = Math.round((region.warehouse.getreide || 0) * cfg.lootShareOnWin * 2 +
      Object.values(region.population).reduce((s, g) => s + g.count, 0) * 0.05);
    state.treasury += loot;
    state.prestige += cfg.victoryPrestigeGain;
    state.stats.warsWon++;
    if (!state.warsWonAgainst) state.warsWonAgainst = {};
    state.warsWonAgainst[aiId] = true;
    // Ein erkämpfter Sieg im offenen Feld/bei der Belagerung bringt zusätzlich
    // eroberte Ländereien ein — die Region darf dabei nie unter ihr Minimum fallen.
    const conqueredHectares = Math.min(cfg.warConquestHectares, Math.max(0, region.land - cfg.warConquestMinDefenderLand));
    if (conqueredHectares > 0) {
      region.land -= conqueredHectares;
      state.regions.player.land += conqueredHectares;
    }
    addChronicle(state, `Sieg in der Schlacht gegen ${region.name}! Beute: ${loot} Taler.` +
      (conqueredHectares > 0 ? ` Zudem werden ${conqueredHectares} Hektar Land erobert.` : ""));
  } else {
    state.prestige = Math.max(0, state.prestige - cfg.defeatPrestigeLoss);
    state.stats.warsLost++;
    for (const pid in state.regions.player.population) {
      state.regions.player.population[pid].satisfaction = clamp(state.regions.player.population[pid].satisfaction - cfg.loseSatisfactionPenalty, 0, 100);
    }
    addChronicle(state, `Niederlage in der Schlacht gegen ${region.name}. Schwere Verluste.`);
  }
  checkAlternativeVictory(state);
}
