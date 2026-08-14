// ============================================================
// KAMPF-ENGINE — LOGIK (§37: vollständig von der UI getrennt)
// ============================================================

// ---------- §36 Deterministischer Seed ----------
let __battleRngState = 0;
function seedBattleRng(seed) { __battleRngState = seed >>> 0; }
function battleRnd() {
  __battleRngState |= 0;
  __battleRngState = (__battleRngState + 0x6D2B79F5) | 0;
  let t = Math.imul(__battleRngState ^ (__battleRngState >>> 15), 1 | __battleRngState);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function battleClamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

// ---------- §4 UnitStack ----------
let __stackIdCounter = 1;
function createUnitStack(unitType, soldiers, opts) {
  opts = opts || {};
  const base = UNIT_TYPES[unitType];
  if (!base) throw new Error("Unbekannter Einheitentyp: " + unitType);
  return {
    id: "u" + (__stackIdCounter++),
    unitType, name: base.name,
    soldiers, maxSoldiers: soldiers,
    attack: base.attack, defense: base.defense, rangedAttack: base.rangedAttack, armor: base.armor,
    speed: base.speed,
    morale: opts.morale !== undefined ? opts.morale : base.moraleBase,
    experience: opts.experience !== undefined ? opts.experience : 35,
    discipline: opts.discipline !== undefined ? opts.discipline : base.disciplineBase,
    supply: opts.supply !== undefined ? opts.supply : 100,
    fatigue: 0,
    terrainBonus: 0, commanderBonus: 0,
    casualties: { dead: 0, wounded: 0, missing: 0 },
    routed: false,
  };
}

// ---------- §8 Befehlshaber ----------
function createCommander(name, tactics, leadership, courage, experience) {
  return { name, tactics, leadership, courage, experience, alive: true };
}

// ---------- §7 Armee ----------
function createArmy(name, commander, stacks, opts) {
  opts = opts || {};
  return {
    name, commander, stacks, // Array von UnitStacks aller 5 Typen gemischt
    foodSupply: opts.foodSupply !== undefined ? opts.foodSupply : 100,
    ammunition: opts.ammunition !== undefined ? opts.ammunition : 100,
    fatigue: 0,
    position: opts.position || "feld",
    isAttacker: !!opts.isAttacker,
    isHomeTerritory: !!opts.isHomeTerritory,
    formation: null, tactic: null,
  };
}

function totalSoldiers(army) { return army.stacks.reduce((s, u) => s + u.soldiers, 0); }
function livingStacks(army) { return army.stacks.filter(u => u.soldiers > 0 && !u.routed); }
function overallMorale(army) {
  const total = totalSoldiers(army);
  if (total <= 0) return 0;
  return army.stacks.reduce((s, u) => s + u.morale * u.soldiers, 0) / total;
}
function overallExperience(army) {
  const total = totalSoldiers(army);
  if (total <= 0) return 0;
  return army.stacks.reduce((s, u) => s + u.experience * u.soldiers, 0) / total;
}
function moraleTierName(morale) {
  for (const tier of MORALE_TIERS) if (morale >= tier.min) return tier.name;
  return MORALE_TIERS[MORALE_TIERS.length - 1].name;
}

// ---------- §15 Kampfmathematik ----------
// effectiveAttack = base * soldierFactor * moraleFactor * experienceFactor
//                  * formationModifier * terrainModifier * commanderModifier
//                  * counterModifier * randomModifier
// Gibt { value, breakdown } zurück (breakdown fürs §40 Debug-Menü)
function computeEffectiveValue(stack, army, opponentArmy, terrain, weather, context) {
  const cfg = BATTLE_CONFIG;
  const base = context.ranged ? stack.rangedAttack : (context.defending ? stack.defense : stack.attack);
  if (base <= 0) return { value: 0, breakdown: { base: 0 } };

  const soldierFactor = stack.soldiers / 100;

  const moraleFactor = cfg.moraleFactorAtZero +
    (stack.morale / 100) * (cfg.moraleFactorAtHundred - cfg.moraleFactorAtZero);

  const experienceFactor = cfg.experienceFactorAtZero +
    (stack.experience / 100) * (cfg.experienceFactorAtHundred - cfg.experienceFactorAtZero);

  const formation = BATTLE_FORMATIONS[army.formation] || BATTLE_FORMATIONS.ausgewogen;
  let formationModifier = 1;
  if (context.ranged) formationModifier += (formation.rangedMod || 0);
  else formationModifier += context.defending ? (formation.defenseMod || 0) : (formation.attackMod || 0);
  if (formation.meleeStartMod && !context.ranged && context.round === 1) formationModifier += formation.meleeStartMod;

  const tactic = TACTICS[army.tactic] || TACTICS.halten;
  if (context.ranged) formationModifier += (tactic.rangedMod || 0);
  else if (!context.defending) formationModifier += (tactic.attackMod || 0);
  else formationModifier += (tactic.defenseMod || 0);

  // Gelände
  const terr = TERRAIN_TYPES[terrain] || TERRAIN_TYPES.ebene;
  let terrainModifier = 1;
  const tMod = terr.unitMods[stack.unitType];
  if (tMod) {
    if (context.ranged && tMod.rangedAttack) terrainModifier += tMod.rangedAttack;
    if (!context.ranged && tMod.attack) terrainModifier += tMod.attack;
    if (context.defending && tMod.defense) terrainModifier += tMod.defense;
  }
  if (context.defending) terrainModifier += (terr.defenderBonus || 0);

  // Wetter
  const weat = WEATHER_TYPES[weather] || WEATHER_TYPES.klar;
  if (context.ranged && weat.rangedMalus) terrainModifier += weat.rangedMalus;
  const wMod = weat.unitMods && weat.unitMods[stack.unitType];
  if (wMod) {
    if (context.ranged && wMod.rangedAttack) terrainModifier += wMod.rangedAttack;
    if (!context.ranged && wMod.attack) terrainModifier += wMod.attack;
  }

  // Kommandant: Führung wirkt moderat, Taktik-Attribut erhöht bei erfahrenen Kommandanten leicht
  const commanderModifier = 1 + (army.commander.leadership - 50) / cfg.commanderLeadershipDivisor
    + (army.commander.experience - 50) / (cfg.commanderLeadershipDivisor * 2);

  // §6 Konter (Schere-Stein-Papier) — abhängig von der gegnerischen Zusammensetzung
  let counterModifier = 1 + computeCounterBonus(stack, opponentArmy, context);

  // Heimvorteil für Miliz
  if (stack.unitType === "miliz" && army.isHomeTerritory) {
    counterModifier += UNIT_COUNTERS.miliz.heimatBonus;
  }

  const randomModifier = battleClamp(
    cfg.randomModifierMin + battleRnd() * (cfg.randomModifierMax - cfg.randomModifierMin),
    cfg.randomModifierMin, cfg.randomModifierMax
  );

  const value = Math.max(0, base * soldierFactor * moraleFactor * experienceFactor *
    formationModifier * terrainModifier * commanderModifier * counterModifier * randomModifier);

  return {
    value,
    breakdown: {
      base, soldierFactor: round2(soldierFactor), moraleFactor: round2(moraleFactor),
      experienceFactor: round2(experienceFactor), formationModifier: round2(formationModifier),
      terrainModifier: round2(terrainModifier), commanderModifier: round2(commanderModifier),
      counterModifier: round2(counterModifier), randomModifier: round2(randomModifier),
    },
  };
}
function round2(v) { return Math.round(v * 100) / 100; }

// ---------- §40 Debug-Modus: Kampfberechnung nachvollziehbar aufschlüsseln ----------
function debugPrintEffectiveValue(stack, army, opponentArmy, terrain, weather, context) {
  const { value, breakdown } = computeEffectiveValue(stack, army, opponentArmy, terrain, weather, context);
  const lines = [`${UNIT_TYPES[stack.unitType].name} ${context.ranged ? "Fernkampf" : "Angriff"}`, ""];
  lines.push(`Basis: ${breakdown.base}`);
  if (breakdown.soldierFactor !== undefined) {
    lines.push(`Soldaten: ×${breakdown.soldierFactor}`);
    lines.push(`Moral: ×${breakdown.moraleFactor}`);
    lines.push(`Erfahrung: ×${breakdown.experienceFactor}`);
    lines.push(`Formation/Taktik: ×${breakdown.formationModifier}`);
    lines.push(`Gelände/Wetter: ×${breakdown.terrainModifier}`);
    lines.push(`Kommandant: ×${breakdown.commanderModifier}`);
    lines.push(`Konter: ×${breakdown.counterModifier}`);
    lines.push(`Zufall: ×${breakdown.randomModifier}`);
  }
  lines.push("", `Effektive Stärke: ${round2(value)}`);
  return lines.join("\n");
}


function computeCounterBonus(stack, opponentArmy, context) {
  let bonus = 0;
  const opponentSoldiersByType = {};
  for (const u of opponentArmy.stacks) {
    if (u.soldiers <= 0) continue;
    opponentSoldiersByType[u.unitType] = (opponentSoldiersByType[u.unitType] || 0) + u.soldiers;
  }
  const totalOpp = Object.values(opponentSoldiersByType).reduce((a, b) => a + b, 0) || 1;

  if (stack.unitType === "kavallerie") {
    const c = UNIT_COUNTERS.kavallerie;
    for (const type in c) {
      const share = (opponentSoldiersByType[type] || 0) / totalOpp;
      bonus += c[type] * share;
    }
  }
  if (stack.unitType === "bogenschuetzen") {
    if (context.ranged) {
      const share = (opponentSoldiersByType.infanterie || 0) / totalOpp;
      bonus += UNIT_COUNTERS.bogenschuetzen.infanterie * share;
    } else {
      bonus += ARCHER_MELEE_MALUS; // im Nahkampf immer benachteiligt
    }
  }
  if (stack.unitType === "artillerie" && context.ranged) {
    const hasLargeFormation = opponentArmy.stacks.some(u => u.soldiers >= LARGE_FORMATION_SOLDIER_THRESHOLD);
    if (hasLargeFormation) bonus += UNIT_COUNTERS.artillerie.grossFormationBonus;
    if (context.cavalryReachedArtillery) bonus += UNIT_COUNTERS.artillerie.kavallerieErreichtMalus;
  }
  return bonus;
}

// ---------- §20/§21 Verlustsystem ----------
function applyCasualties(army, totalCasualties, log, side) {
  const cfg = BATTLE_CONFIG;
  const alive = livingStacks(army);
  const totalAlive = alive.reduce((s, u) => s + u.soldiers, 0);
  if (totalAlive <= 0 || totalCasualties <= 0) return 0;
  let actuallyLost = 0;
  for (const stack of alive) {
    const share = stack.soldiers / totalAlive;
    let lost = Math.round(totalCasualties * share);
    lost = Math.min(lost, stack.soldiers);
    stack.soldiers -= lost;
    actuallyLost += lost;
    const dead = Math.round(lost * (1 - cfg.woundedShareOfCasualties - cfg.missingShareOfCasualties));
    const wounded = Math.round(lost * cfg.woundedShareOfCasualties);
    const missing = lost - dead - wounded;
    stack.casualties.dead += dead;
    stack.casualties.wounded += wounded;
    stack.casualties.missing += missing;
    // Verluste drücken die Moral proportional zum Anteil der verlorenen Soldaten dieses Stacks
    const lossShareOfStack = stack.maxSoldiers > 0 ? lost / stack.maxSoldiers : 0;
    stack.morale = battleClamp(stack.morale - lossShareOfStack * cfg.moraleLossPerCasualtyShare, 0, 100);
  }
  return actuallyLost;
}

// ---------- §16/§17 Moralsystem ----------
function applyMoraleShift(army, delta) {
  for (const stack of livingStacks(army)) {
    stack.morale = battleClamp(stack.morale + delta, 0, 100);
  }
}

// ---------- §18 Flucht ----------
function checkRouts(army, state, sideLabel) {
  const cfg = BATTLE_CONFIG;
  let routedSoldiers = 0;
  for (const stack of livingStacks(army)) {
    if (stack.morale >= cfg.routMoraleThreshold) continue;
    const deficitFactor = (cfg.routMoraleThreshold - stack.morale) / cfg.routMoraleThreshold;
    const fleeChance = battleClamp(
      cfg.routCheckBaseChance + deficitFactor * 0.5 - stack.discipline * cfg.disciplineFleeReduction,
      0, 0.9
    );
    if (battleRnd() < fleeChance) {
      const extraLoss = Math.round(stack.soldiers * BATTLE_CONFIG.fleeingExtraCasualtyShare);
      stack.soldiers -= extraLoss;
      stack.casualties.missing += extraLoss;
      stack.routed = true;
      routedSoldiers += stack.soldiers + extraLoss;
      logMsg(state, `${stack.name} (${sideLabel}) gerät in Panik und flieht vom Schlachtfeld!`);
    }
  }
  return routedSoldiers;
}

// ---------- §23 Kommandantenereignisse (selten) ----------
function rollCommanderEvents(armyA, armyB, state) {
  const cfg = BATTLE_CONFIG;
  const events = [];
  if (battleRnd() < cfg.commanderEventChancePerPhase) {
    const target = battleRnd() < 0.5 ? armyA : armyB;
    if (target.commander.alive) {
      const severe = battleRnd() < 0.3;
      if (severe) {
        target.commander.alive = false;
        applyMoraleShift(target, -cfg.commanderDeathMoraleLoss);
        logMsg(state, `⚔ ${target.commander.name} fällt in der Schlacht! Die Truppen von ${target.name} sind erschüttert.`);
        events.push("commander_death");
      } else {
        applyMoraleShift(target, -Math.round(cfg.commanderDeathMoraleLoss / 2));
        logMsg(state, `${target.commander.name} wird verwundet, bleibt aber im Kommando.`);
        events.push("commander_wounded");
      }
    }
  } else if (battleRnd() < cfg.commanderEventChancePerPhase) {
    const target = battleRnd() < 0.5 ? armyA : armyB;
    const artilleryStack = target.stacks.find(u => u.unitType === "artillerie" && u.soldiers > 0);
    if (artilleryStack) {
      const loss = Math.round(artilleryStack.soldiers * 0.2);
      artilleryStack.soldiers -= loss;
      artilleryStack.casualties.dead += loss;
      logMsg(state, `Eine Explosion reißt Teile der Artillerie von ${target.name} in den Tod!`);
      events.push("artillery_explosion");
    }
  }
  return events;
}

// ---------- §34 Kampf-KI (bewertet, ohne verbotenes Wissen zu nutzen — §35) ----------
function chooseAiFormationAndTactic(army, knownEnemyEstimate, terrain) {
  const commander = army.commander;
  const aggressive = commander.courage > 60;
  const cavalryShare = totalSoldiers(army) > 0
    ? army.stacks.filter(u => u.unitType === "kavallerie").reduce((s, u) => s + u.soldiers, 0) / totalSoldiers(army)
    : 0;

  let formation = "ausgewogen";
  if (aggressive && cavalryShare > 0.15 && terrain !== "wald" && terrain !== "stadt") {
    formation = "kavallerieflanke";
  } else if (aggressive) {
    formation = "aggressiv";
  } else if (commander.courage < 35) {
    formation = "defensiv";
  } else {
    const rangedShare = totalSoldiers(army) > 0
      ? army.stacks.filter(u => u.unitType === "bogenschuetzen" || u.unitType === "artillerie").reduce((s, u) => s + u.soldiers, 0) / totalSoldiers(army)
      : 0;
    formation = rangedShare > 0.3 ? "fernkampfstellung" : "ausgewogen";
  }

  let tactic = "halten";
  if (formation === "kavallerieflanke") tactic = "flankenangriff";
  else if (formation === "aggressiv") tactic = "frontalangriff";
  else if (formation === "defensiv") tactic = "verteidigen";
  else if (formation === "fernkampfstellung") tactic = "fernkampf";

  return { formation, tactic };
}

// Standard-Entscheidungspolitik für die KI (und für automatisierte Tests/Monte-Carlo)
function aiDecisionPolicy(battleState, decision) {
  const army = decision.forArmy === "A" ? battleState.armyA : battleState.armyB;
  if (decision.type === "flankeWankt") {
    return army.commander.courage > 50 ? "nachsetzen" : "halten";
  }
  if (decision.type === "weiterkaempfenOderRueckzug") {
    return army.commander.courage > 40 ? "weiterkaempfen" : "rueckzug";
  }
  return "halten";
}

// ---------- §9 Vor-der-Schlacht-Info (§41 Informationsunsicherheit auch für den Spieler) ----------
function estimateEnemyComposition(enemyArmy, scoutingAccuracy) {
  const acc = battleClamp(scoutingAccuracy !== undefined ? scoutingAccuracy : 0.4, 0.1, 1);
  const byType = {};
  for (const u of enemyArmy.stacks) {
    byType[u.unitType] = (byType[u.unitType] || 0) + u.soldiers;
  }
  const estimate = {};
  for (const type in byType) {
    const real = byType[type];
    const spread = real * (1 - acc) * 0.6;
    estimate[type] = { low: Math.max(0, Math.round(real - spread)), high: Math.round(real + spread) };
  }
  return estimate;
}
