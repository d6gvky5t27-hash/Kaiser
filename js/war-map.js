// ============================================================
// KRIEGSKARTE — Risiko-artige Gebietseroberung als strategische Ebene über
// der bestehenden taktischen Kampf-Engine (§Original-Vertiefung, Nutzerwunsch:
// "wir sollten für die Kriegsphase und Militär eine Art Brettspiel wie
// Risiko anlegen"). Krieg ist jetzt ein andauernder Zustand
// (state.warState[aiId]) statt einer einmaligen Sofortauflösung: der Spieler
// erobert Gebiet für Gebiet, jeder einzelne Zusammenstoß läuft weiterhin
// über die volle interaktive Kampf-Engine (battle-engine/, battle-bridge.js).
// Muss nach core.js, military.js und battle-bridge.js geladen werden.
// ============================================================

function territoryById(id) {
  return TERRITORIES.find(t => t.id === id);
}

// Initialisiert state.territories (Besitzer + Garnison/Aufstellung) einmalig
// beim Spielstart. Muss aufgerufen werden, NACHDEM state.regions vollständig
// aufgebaut ist (estimateAiStrength braucht die fertige Region).
function initTerritories(state) {
  const cfg = CONFIG.warMap;
  state.warState = { ai1: false, ai2: false, ai3: false };
  state.territories = {};
  state.pendingTerritoryDefense = null;
  for (const t of TERRITORIES) {
    if (t.region === "player") {
      state.territories[t.id] = { owner: "player", garrison: 0, deployment: {} };
      continue;
    }
    const region = state.regions[t.region];
    const totalStrength = estimateAiStrength(region);
    const share = t.capital ? cfg.capitalGarrisonShare : cfg.provinceGarrisonShare;
    state.territories[t.id] = { owner: t.region, garrison: Math.round(totalStrength * share), deployment: {} };
  }
}

// ---------- Truppen-Reserve/Stationierung ----------

function totalDeployedOfType(state, troopType) {
  let total = 0;
  for (const id in state.territories) {
    const terr = state.territories[id];
    if (terr.owner === "player" && terr.deployment[troopType]) total += terr.deployment[troopType];
  }
  return total;
}

function reserveCountOfType(state, troopType) {
  return Math.max(0, Math.round((state.army[troopType] || 0) - totalDeployedOfType(state, troopType)));
}

function deployToTerritory(state, territoryId, troopType, count) {
  const terr = state.territories[territoryId];
  if (!terr || terr.owner !== "player") return { ok: false, reason: "Dieses Gebiet gehört dir nicht." };
  if (!TROOP_TYPES[troopType]) return { ok: false, reason: "Unbekannter Truppentyp." };
  count = Math.round(count);
  if (count <= 0) return { ok: false, reason: "Ungültige Anzahl." };
  const reserve = reserveCountOfType(state, troopType);
  if (reserve < count) return { ok: false, reason: `Nicht genug Reserve-Truppen (${reserve} verfügbar).` };
  terr.deployment[troopType] = (terr.deployment[troopType] || 0) + count;
  return { ok: true };
}

function recallFromTerritory(state, territoryId, troopType, count) {
  const terr = state.territories[territoryId];
  if (!terr || terr.owner !== "player") return { ok: false, reason: "Dieses Gebiet gehört dir nicht." };
  count = Math.round(count);
  const have = terr.deployment[troopType] || 0;
  if (count <= 0 || have < count) return { ok: false, reason: "Nicht genug Truppen in diesem Gebiet." };
  terr.deployment[troopType] -= count;
  return { ok: true };
}

function moveBetweenTerritories(state, fromId, toId, troopType, count) {
  const from = state.territories[fromId];
  const to = state.territories[toId];
  if (!from || !to || from.owner !== "player" || to.owner !== "player") {
    return { ok: false, reason: "Beide Gebiete müssen dir gehören." };
  }
  const fromDef = territoryById(fromId);
  if (!fromDef.adjacent.includes(toId)) return { ok: false, reason: "Die Gebiete grenzen nicht aneinander." };
  count = Math.round(count);
  const have = from.deployment[troopType] || 0;
  if (count <= 0 || have < count) return { ok: false, reason: "Nicht genug Truppen in diesem Gebiet." };
  from.deployment[troopType] -= count;
  to.deployment[troopType] = (to.deployment[troopType] || 0) + count;
  return { ok: true };
}

// ---------- Kampfarmeen aus Gebiets-Garnisonen aufbauen (Ergänzung zu den
// bestehenden buildPlayerBattleArmy/buildAiBattleArmy aus battle-bridge.js,
// die weiterhin für Belagerungen und von der KI selbst erklärte
// Überraschungsangriffe genutzt werden) ----------

function buildPlayerTerritoryArmy(state, territoryId) {
  const terr = state.territories[territoryId];
  const stacks = [];
  const push = (unitType, count) => { if (count > 0) stacks.push(createUnitStack(unitType, Math.round(count))); };
  const d = terr.deployment;
  push("miliz", d.miliz || 0);
  push("bogenschuetzen", (d.bogenschuetzen || 0) + (d.armbrustschuetzen || 0));
  push("pikeniere", d.pikeniere || 0);
  push("kavallerie", d.ritter || 0);
  push("schwere_kavallerie", d.schwere_kavallerie || 0);
  push("infanterie", d.soeldner || 0);
  if (stacks.length === 0) stacks.push(createUnitStack("miliz", 1));

  const ruler = state.characters[state.rulerId];
  const commander = createCommander(
    ruler ? `${ruler.name} ${ruler.surname}` : "Unbekannter Feldherr",
    ruler ? clamp(ruler.stats.diplomatie * 5, 10, 90) : 50,
    ruler ? clamp(ruler.stats.militaer * 5, 10, 95) : 50,
    ruler ? clamp(ruler.stats.charisma * 5, 10, 90) : 50,
    ruler ? clamp(ruler.age, 20, 80) : 40
  );
  const marschallBonus = advisorEffectBonus(state, "marschall");
  if (marschallBonus) commander.leadership = clamp(commander.leadership + marschallBonus * 15, 10, 99);
  return { commander, stacks };
}

function buildAiTerritoryArmy(state, territoryId) {
  const terr = state.territories[territoryId];
  const region = state.regions[terr.owner];
  const totalSoldierCount = Math.max(20, Math.round(terr.garrison));
  const kaserneLevel = buildingLevelSum(region, "kaserne");
  const hasArtillery = kaserneLevel >= 2;
  const hasPikes = kaserneLevel >= 1;
  const shares = hasArtillery
    ? { infanterie: 0.42, bogenschuetzen: 0.20, kavallerie: 0.18, artillerie: 0.08, pikeniere: 0.12 }
    : hasPikes
      ? { infanterie: 0.45, bogenschuetzen: 0.22, kavallerie: 0.18, pikeniere: 0.15 }
      : { infanterie: 0.55, bogenschuetzen: 0.25, kavallerie: 0.20 };
  const stacks = [];
  for (const unitType in shares) {
    const count = Math.round(totalSoldierCount * shares[unitType]);
    if (count > 0) stacks.push(createUnitStack(unitType, count, { morale: 55 }));
  }
  if (stacks.length === 0) stacks.push(createUnitStack("miliz", totalSoldierCount));

  if (!region.commander) region.commander = generateCommander(region.name); // defensiv für ältere Spielstände
  const persisted = region.commander;
  const commander = createCommander(persisted.name, persisted.tactics, persisted.leadership, persisted.courage, persisted.experience);
  return { commander, stacks };
}

// Baut die vollständige Kampf-Armee für einen Gebietskampf. attackerTerritoryId
// gehört immer der angreifenden Seite, defenderTerritoryId der verteidigenden
// — welche davon der Spieler ist, hängt von playerIsAttacker ab (bei einem
// KI-Gegenangriff, siehe aiTerritoryCounterAttack(), ist der Spieler Verteidiger).
function buildTerritoryBattleArmies(state, attackerTerritoryId, defenderTerritoryId, playerIsAttacker) {
  const attTerr = state.territories[attackerTerritoryId];
  const defTerr = state.territories[defenderTerritoryId];
  const attackerName = playerIsAttacker ? state.regions.player.name : state.regions[attTerr.owner].name;
  const defenderName = playerIsAttacker ? state.regions[defTerr.owner].name : state.regions.player.name;
  const attackerBuild = playerIsAttacker ? buildPlayerTerritoryArmy(state, attackerTerritoryId) : buildAiTerritoryArmy(state, attackerTerritoryId);
  const defenderBuild = playerIsAttacker ? buildAiTerritoryArmy(state, defenderTerritoryId) : buildPlayerTerritoryArmy(state, defenderTerritoryId);
  const armyA = createArmy(attackerName, attackerBuild.commander, attackerBuild.stacks, { isAttacker: true, isHomeTerritory: false });
  const armyB = createArmy(defenderName, defenderBuild.commander, defenderBuild.stacks, { isAttacker: false, isHomeTerritory: true });
  return { armyA, armyB };
}

// ---------- Ergebnis eines Gebietskampfs anwenden ----------
// playerIsAttacker: true = normaler Spielerangriff (armyA=Spieler); false =
// KI-Gegenangriff, bei dem der Spieler verteidigt (armyB=Spieler).

function applyTerritoryBattleResult(state, attackerTerritoryId, defenderTerritoryId, battleResult, playerIsAttacker) {
  const cfg = CONFIG.military;
  const attTerr = state.territories[attackerTerritoryId];
  const defTerr = state.territories[defenderTerritoryId];
  const r = battleResult.result;
  const playerWon = playerIsAttacker ? r.winner === "A" : r.winner === "B";

  const playerArmy = playerIsAttacker ? battleResult.armyA : battleResult.armyB;
  const survivalRatio = {};
  for (const stack of playerArmy.stacks) {
    survivalRatio[stack.unitType] = stack.maxSoldiers > 0 ? stack.soldiers / stack.maxSoldiers : 1;
  }
  const applyRatio = (unitType, fallback) => (survivalRatio[unitType] !== undefined ? survivalRatio[unitType] : fallback);
  const playerTerr = playerIsAttacker ? attTerr : defTerr;
  const d = playerTerr.deployment;
  d.miliz = Math.round((d.miliz || 0) * applyRatio("miliz", 0.9));
  const rangedRatio = applyRatio("bogenschuetzen", 0.9);
  d.bogenschuetzen = Math.round((d.bogenschuetzen || 0) * rangedRatio);
  d.armbrustschuetzen = Math.round((d.armbrustschuetzen || 0) * rangedRatio);
  d.pikeniere = Math.round((d.pikeniere || 0) * applyRatio("pikeniere", 0.9));
  d.ritter = Math.round((d.ritter || 0) * applyRatio("kavallerie", 0.9));
  d.schwere_kavallerie = Math.round((d.schwere_kavallerie || 0) * applyRatio("schwere_kavallerie", 0.9));
  d.soeldner = Math.round((d.soeldner || 0) * applyRatio("infanterie", 0.9));

  const aiTerr = playerIsAttacker ? defTerr : attTerr;
  const aiArmy = playerIsAttacker ? battleResult.armyB : battleResult.armyA;
  const aiRatios = aiArmy.stacks.map(s => (s.maxSoldiers > 0 ? s.soldiers / s.maxSoldiers : 1));
  const avgAiRatio = aiRatios.length ? aiRatios.reduce((a, b) => a + b, 0) / aiRatios.length : 0.85;
  const aiId = aiTerr.owner;
  const dip = state.diplomacy[aiId];
  const territoryName = territoryById(playerIsAttacker ? defenderTerritoryId : attackerTerritoryId).name;

  if (playerWon) {
    if (playerIsAttacker) {
      const originalOwner = aiTerr.owner;
      aiTerr.owner = "player";
      aiTerr.garrison = 0;
      aiTerr.deployment = {};
      state.prestige += Math.round(cfg.victoryPrestigeGain * 0.5);
      addChronicle(state, `${territoryName} (${state.regions[originalOwner].name}) erobert!`);
      checkRegionConquest(state, originalOwner);
    } else {
      // Verteidigt: der KI-Angreifer wird zurückgeschlagen, das Gebiet bleibt beim Spieler
      aiTerr.garrison = Math.round(aiTerr.garrison * avgAiRatio);
      state.prestige += Math.round(cfg.victoryPrestigeGain * 0.3);
      addChronicle(state, `Der Angriff auf ${territoryName} wurde erfolgreich abgewehrt!`);
    }
  } else {
    if (playerIsAttacker) {
      aiTerr.garrison = Math.round(aiTerr.garrison * avgAiRatio);
      state.prestige = Math.max(0, state.prestige - Math.round(cfg.defeatPrestigeLoss * 0.5));
      addChronicle(state, `Angriff auf ${territoryName} gescheitert.`);
    } else {
      const originalOwner = "player";
      defTerr.owner = aiId; // aiTerr === defTerr in diesem Zweig
      defTerr.garrison = Math.round((estimateAiStrength(state.regions[aiId]) * CONFIG.warMap.provinceGarrisonShare) * 0.5);
      defTerr.deployment = {};
      state.prestige = Math.max(0, state.prestige - cfg.defeatPrestigeLoss);
      for (const pid in state.regions.player.population) {
        state.regions.player.population[pid].satisfaction = clamp(state.regions.player.population[pid].satisfaction - cfg.loseSatisfactionPenalty * 0.5, 0, 100);
      }
      addChronicle(state, `${territoryName} wurde von ${state.regions[aiId].name} erobert!`);
    }
  }
  if (dip) dip.relation = clamp(dip.relation + cfg.warRelationCrash * 0.3, -100, 100);
  checkAlternativeVictory(state);
}

// Prüft, ob der Spieler jetzt ALLE Heimatgebiete einer Region kontrolliert —
// dann unterwirft sich die Region als Vasall (nutzt das bestehende, bereits
// getestete Vasallentribut-System aus applyMonthlyFinances() weiter).
function checkRegionConquest(state, aiId) {
  const region = state.regions[aiId];
  if (!region || region.conquered) return false;
  const homeTerritoryIds = TERRITORIES.filter(t => t.region === aiId).map(t => t.id);
  const allPlayerOwned = homeTerritoryIds.every(id => state.territories[id].owner === "player");
  if (!allPlayerOwned) return false;
  const cfg = CONFIG.warMap;
  region.conquered = true;
  state.warState[aiId] = false;
  state.vassals[aiId] = true;
  state.prestige += cfg.conquestPrestigeGain;
  state.treasury += cfg.conquestTreasuryGain;
  state.stats.warsWon++;
  addChronicle(state, `${region.name} ist vollständig erobert und unterwirft sich als Vasall!`);
  // §Punkt 38: die vollständige Eroberung einer Region ist das klarste
  // definierte Kriegsergebnis der Kriegskarte und daher bedeutsam genug
  // für eine eigene Erinnerung (die einzelnen Gebietsscharmützel selbst
  // bleiben bewusst unterhalb der Bedeutsamkeitsschwelle).
  recordWorldEvent(state, {
    type: "MAJOR_BATTLE_WON", actorIds: [state.rulerId], regionIds: [aiId],
    importance: 85, emotionalWeight: 45, metadata: { conquest: true },
    description: `${state.characters[state.rulerId].name} eroberte ${region.name} vollständig und machte es zum Vasallen.`,
  });
  return true;
}

// ---------- Jährliche KI-Aktivität auf der Kriegskarte (aus advanceYear()) ----------

// Garnisonen ohne Spielerbesitz nähern sich langsam ihrer rechnerischen
// Zielstärke wieder an (Rekrutierung/Nachschub der KI-Region), begrenzt
// durch reinforceRate — verhindert, dass ein einmal geschwächtes Gebiet für
// immer wehrlos bleibt, ohne den Krieg trivial zu machen.
function reinforceAiTerritories(state) {
  const cfg = CONFIG.warMap;
  for (const t of TERRITORIES) {
    if (t.region === "player") continue;
    const terr = state.territories[t.id];
    if (terr.owner !== t.region) continue; // vom Spieler eroberte Gebiete werden nicht für die Ursprungsregion verstärkt
    const region = state.regions[t.region];
    if (region.conquered) continue;
    const targetStrength = estimateAiStrength(region) * (t.capital ? cfg.capitalGarrisonShare : cfg.provinceGarrisonShare);
    terr.garrison = Math.round(terr.garrison + (targetStrength - terr.garrison) * cfg.reinforceRate);
  }
}

// Eine im Krieg befindliche KI-Region kann ein eigenes Grenzgebiet nutzen, um
// ein angrenzendes Spieler-Gebiet anzugreifen — löst NICHT selbst die
// Schlacht auf (Sache der interaktiven Kampf-Engine), sondern markiert nur
// state.pendingTerritoryDefense, das die UI beim nächsten Rendern aufgreift.
function aiTerritoryCounterAttack(state) {
  const cfg = CONFIG.warMap;
  if (state.pendingTerritoryDefense) return null;
  if (state.incomingAiWar) return null; // dieses Jahr schon eine erzwungene Verteidigung fällig, kein zweiter Überfall
  for (const aiId in state.warState) {
    if (!state.warState[aiId]) continue;
    if (state.regions[aiId].conquered) continue;
    if (rnd() > cfg.counterAttackChance) continue;
    const borderTerritories = TERRITORIES.filter(t =>
      t.region === aiId && state.territories[t.id].owner === aiId &&
      t.adjacent.some(adjId => state.territories[adjId].owner === "player")
    );
    if (!borderTerritories.length) continue;
    const attacker = borderTerritories[Math.floor(rnd() * borderTerritories.length)];
    const targets = attacker.adjacent.filter(adjId => state.territories[adjId].owner === "player");
    const targetId = targets[Math.floor(rnd() * targets.length)];
    state.pendingTerritoryDefense = { attackerTerritoryId: attacker.id, defenderTerritoryId: targetId };
    addChronicle(state, `${state.regions[aiId].name} greift ${territoryById(targetId).name} an!`);
    return state.pendingTerritoryDefense;
  }
  return null;
}
