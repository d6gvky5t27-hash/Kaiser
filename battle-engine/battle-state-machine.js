// ============================================================
// BATTLE ENGINE — schrittweise Zustandsmaschine über die 6 Phasen (§14)
// Kann jederzeit zwischengespeichert werden (§38 BattleState)
// ============================================================

const BATTLE_PHASES = ["aufstellung", "fernkampf", "annaeherung", "hauptkampf", "moralpruefung", "entscheidung"];

// ---------- §38 BattleState erzeugen ----------
function createBattle(armyA, armyB, terrain, weather, seed) {
  seedBattleRng(seed);
  return {
    seed,
    armyA, armyB,
    terrain: terrain || "ebene",
    weather: weather || "klar",
    phaseIndex: 0,
    round: 0,
    log: [],
    pendingDecision: null,
    finished: false,
    result: null,
    meleeRoundsDone: 0,
  };
}

function currentPhase(state) { return BATTLE_PHASES[state.phaseIndex]; }

function logMsg(state, text) {
  state.log.push({ time: formatBattleTime(state), text });
}
function formatBattleTime(state) {
  const startHour = 8, startMinute = 0;
  const minutesElapsed = state.phaseIndex * 25 + state.meleeRoundsDone * 12 + Math.round(battleRnd() * 4);
  const total = startHour * 60 + startMinute + minutesElapsed;
  const h = Math.floor(total / 60) % 24, m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// ---------- Hauptschritt: eine Phase (oder Teilschritt) ausführen ----------
// decision: Antwort auf eine vorherige pendingDecision, falls vorhanden
function advanceBattle(state, decision) {
  if (state.finished) return state;
  if (state.pendingDecision) {
    resolveDecision(state, decision);
    if (state.pendingDecision) return state; // weitere Entscheidung nötig
  }

  const phase = currentPhase(state);
  if (phase === "aufstellung") runAufstellung(state);
  else if (phase === "fernkampf") runFernkampf(state);
  else if (phase === "annaeherung") runAnnaeherung(state);
  else if (phase === "hauptkampf") runHauptkampfRound(state);
  else if (phase === "moralpruefung") runMoralpruefung(state);
  else if (phase === "entscheidung") runEntscheidung(state);

  return state;
}

function resolveDecision(state, decision) {
  const d = state.pendingDecision;
  state.pendingDecision = null;
  if (!decision) decision = aiDecisionPolicy(state, d); // falls niemand entscheidet: KI-Standardpolitik
  if (d.type === "flankeWankt") {
    const attackerArmy = d.forArmy === "A" ? state.armyA : state.armyB;
    const defenderArmy = d.forArmy === "A" ? state.armyB : state.armyA;
    if (decision === "nachsetzen") {
      const bonusDamage = Math.round(totalSoldiers(defenderArmy) * 0.05);
      applyCasualties(defenderArmy, bonusDamage, state.log, defenderArmy.name);
      applyMoraleShift(defenderArmy, -6);
      logMsg(state, `${attackerArmy.name} nutzt die Schwäche aus und setzt nach — die Linie von ${defenderArmy.name} gerät weiter unter Druck!`);
    } else {
      logMsg(state, `${attackerArmy.name} hält die eigene Formation, statt das Risiko einzugehen.`);
    }
  } else if (d.type === "weiterkaempfenOderRueckzug") {
    const army = d.forArmy === "A" ? state.armyA : state.armyB;
    if (decision === "rueckzug") {
      army.retreatedEarly = true;
      logMsg(state, `${army.name} zieht sich geordnet vom Schlachtfeld zurück.`);
      state.phaseIndex = BATTLE_PHASES.indexOf("moralpruefung");
    } else {
      logMsg(state, `${army.name} kämpft entschlossen weiter.`);
    }
  }
}

// ---------- Phase 1: Aufstellung (§14) ----------
function runAufstellung(state) {
  if (!state.armyA.formation) {
    const choice = chooseAiFormationAndTactic(state.armyA, null, state.terrain);
    state.armyA.formation = choice.formation; state.armyA.tactic = choice.tactic;
  }
  if (!state.armyB.formation) {
    const choice = chooseAiFormationAndTactic(state.armyB, null, state.terrain);
    state.armyB.formation = choice.formation; state.armyB.tactic = choice.tactic;
  }
  logMsg(state, `${state.armyA.name} formiert sich (${BATTLE_FORMATIONS[state.armyA.formation].name}). ${state.armyB.name} formiert sich (${BATTLE_FORMATIONS[state.armyB.formation].name}).`);
  state.phaseIndex++;
}

// ---------- Phase 2: Fernkampf (§14) ----------
function runFernkampf(state) {
  const rangedDamage = (attacker, defender) => {
    let total = 0;
    for (const stack of livingStacks(attacker)) {
      if (stack.rangedAttack <= 0) continue;
      const result = computeEffectiveValue(stack, attacker, defender, state.terrain, state.weather, { ranged: true, round: 1 });
      total += result.value;
    }
    return total;
  };
  const dmgAtoB = rangedDamage(state.armyA, state.armyB);
  const dmgBtoA = rangedDamage(state.armyB, state.armyA);

  const lostB = applyCasualties(state.armyB, Math.round(dmgAtoB * 0.4), state.log, state.armyB.name);
  const lostA = applyCasualties(state.armyA, Math.round(dmgBtoA * 0.4), state.log, state.armyA.name);

  if (lostA > 0 || lostB > 0) {
    logMsg(state, `Fernkampf: ${state.armyA.name} verliert ${lostA} Soldaten, ${state.armyB.name} verliert ${lostB} Soldaten durch Pfeil- und Kanonenbeschuss.`);
  } else {
    logMsg(state, `Keine nennenswerten Fernkampfeinheiten im Einsatz — die Armeen rücken direkt vor.`);
  }
  rollCommanderEvents(state.armyA, state.armyB, state);
  state.phaseIndex++;
}

// ---------- Phase 3: Annäherung (§14) — Kavallerieflanke ----------
function runAnnaeherung(state) {
  for (const [side, army, enemy] of [["A", state.armyA, state.armyB], ["B", state.armyB, state.armyA]]) {
    if (army.formation !== "kavallerieflanke") continue;
    const cavStack = army.stacks.find(u => u.unitType === "kavallerie" && u.soldiers > 0);
    if (!cavStack) continue;
    const successChance = battleClamp(0.5 + (army.commander.tactics - 50) / 200 + (cavStack.speed - 5) / 20, 0.15, 0.85);
    if (battleRnd() < successChance) {
      const archerTarget = enemy.stacks.find(u => (u.unitType === "bogenschuetzen" || u.unitType === "artillerie") && u.soldiers > 0);
      if (archerTarget) {
        const loss = Math.round(archerTarget.soldiers * 0.35);
        archerTarget.soldiers -= loss;
        archerTarget.casualties.dead += Math.round(loss * 0.5);
        archerTarget.casualties.missing += loss - Math.round(loss * 0.5);
        applyMoraleShift(enemy, -8);
        logMsg(state, `Die Kavallerie von ${army.name} umgeht die Front und trifft ${enemy.name}s Fernkämpfer hart — ${loss} Verluste!`);
      }
    } else {
      const loss = Math.round(cavStack.soldiers * 0.20);
      cavStack.soldiers -= loss;
      cavStack.casualties.dead += loss;
      applyMoraleShift(army, -5);
      logMsg(state, `Der Flankenangriff der Kavallerie von ${army.name} schlägt fehl und kostet ${loss} Reiter.`);
    }
  }
  state.phaseIndex++;
}

// ---------- Phase 4: Hauptkampf (§14) — mehrere Nahkampfrunden ----------
function runHauptkampfRound(state) {
  const cfg = BATTLE_CONFIG;
  state.round++;
  state.meleeRoundsDone++;

  const cavalryReachedArty = (army) => army.formation === "kavallerieflanke";

  // §15: Nettoschaden ergibt sich aus Angriffsstärke UND der tatsächlichen
  // Verteidigungsstärke der Zielarmee (Rüstung/Formation/Gelände-Verteidigerbonus
  // fließen über den "defending"-Kontext ein) — vorher wurde nur der Angreifer
  // berechnet, wodurch Verteidigungsboni wirkungslos blieben (Balancing-Fund).
  const meleeExchange = (attacker, defender) => {
    let attackTotal = 0;
    for (const stack of livingStacks(attacker)) {
      if (stack.attack <= 0) continue;
      const ctx = { ranged: false, defending: false, round: state.meleeRoundsDone, cavalryReachedArtillery: cavalryReachedArty(defender) };
      attackTotal += computeEffectiveValue(stack, attacker, defender, state.terrain, state.weather, ctx).value;
    }
    let defenseTotal = 0;
    for (const stack of livingStacks(defender)) {
      const ctx = { ranged: false, defending: true, round: state.meleeRoundsDone };
      defenseTotal += computeEffectiveValue(stack, defender, attacker, state.terrain, state.weather, ctx).value;
    }
    // Verhältnisformel: hohe Verteidigung dämpft den Nettoschaden spürbar,
    // ohne ihn je auf 0 fallen zu lassen (kein "Patt")
    return attackTotal * (attackTotal / (attackTotal + defenseTotal + 1));
  };

  const dmgAtoB = meleeExchange(state.armyA, state.armyB);
  const dmgBtoA = meleeExchange(state.armyB, state.armyA);

  const lostB = applyCasualties(state.armyB, Math.round(dmgAtoB * cfg.meleeCasualtyFactor), state.log, state.armyB.name);
  const lostA = applyCasualties(state.armyA, Math.round(dmgBtoA * cfg.meleeCasualtyFactor), state.log, state.armyA.name);

  if (lostA > lostB) { applyMoraleShift(state.armyB, cfg.moraleGainOnWinningRound); applyMoraleShift(state.armyA, -cfg.moraleLossOnLosingRound); }
  else if (lostB > lostA) { applyMoraleShift(state.armyA, cfg.moraleGainOnWinningRound); applyMoraleShift(state.armyB, -cfg.moraleLossOnLosingRound); }

  logMsg(state, `Nahkampfrunde ${state.meleeRoundsDone}: ${state.armyA.name} verliert ${lostA}, ${state.armyB.name} verliert ${lostB} Soldaten.`);
  rollCommanderEvents(state.armyA, state.armyB, state);

  const moraleA = overallMorale(state.armyA), moraleB = overallMorale(state.armyB);

  // §29 wichtiger Entscheidungspunkt: eine Flanke wankt deutlich
  if (!state._decisionAsked && (moraleA < cfg.decisionTriggerMoraleThreshold || moraleB < cfg.decisionTriggerMoraleThreshold)) {
    state._decisionAsked = true;
    const weakerSide = moraleA < moraleB ? "A" : "B";
    const strongerSideKey = weakerSide === "A" ? "B" : "A";
    state.pendingDecision = {
      type: "flankeWankt", forArmy: strongerSideKey,
      text: `DIE LINKE FLANKE VON ${(weakerSide === "A" ? state.armyA.name : state.armyB.name).toUpperCase()} WANKT!`,
      options: [
        { id: "nachsetzen", label: "Nachsetzen und den Vorteil ausnutzen (Risiko/Chance)" },
        { id: "halten", label: "Stellung halten" },
      ],
    };
    return; // Entscheidung muss erst beantwortet werden, bevor es weitergeht
  }

  if (state.meleeRoundsDone >= cfg.meleeRounds || moraleA < 5 || moraleB < 5) {
    state.phaseIndex++;
  }
}

// ---------- Phase 5: Moralprüfung (§14/§18) ----------
function runMoralpruefung(state) {
  checkRouts(state.armyA, state, state.armyA.name);
  checkRouts(state.armyB, state, state.armyB.name);
  logMsg(state, `Moralprüfung: ${state.armyA.name} (${moraleTierName(overallMorale(state.armyA))}), ${state.armyB.name} (${moraleTierName(overallMorale(state.armyB))}).`);
  state.phaseIndex++;
}

// ---------- Phase 6: Entscheidung (§14/§24 Schlachtbericht) ----------
function runEntscheidung(state) {
  const startA = state.armyA.stacks.reduce((s, u) => s + u.maxSoldiers, 0);
  const startB = state.armyB.stacks.reduce((s, u) => s + u.maxSoldiers, 0);
  const nowA = totalSoldiers(state.armyA);
  const nowB = totalSoldiers(state.armyB);
  const casualtiesA = startA - nowA, casualtiesB = startB - nowB;
  const casualtyShareA = startA > 0 ? casualtiesA / startA : 0;
  const casualtyShareB = startB > 0 ? casualtiesB / startB : 0;

  let winner, outcome;
  const aRetreated = state.armyA.retreatedEarly;
  const bRetreated = state.armyB.retreatedEarly;

  if (aRetreated && !bRetreated) { winner = "B"; outcome = "geordneterRueckzugA"; }
  else if (bRetreated && !aRetreated) { winner = "A"; outcome = "geordneterRueckzugB"; }
  else if (casualtyShareA > 0.6 && casualtyShareB < 0.3) { winner = "B"; outcome = "vernichtendeNiederlageA"; }
  else if (casualtyShareB > 0.6 && casualtyShareA < 0.3) { winner = "A"; outcome = "vernichtendeNiederlageB"; }
  else if (casualtyShareA > casualtyShareB + 0.08) { winner = "B"; outcome = "siegB"; }
  else if (casualtyShareB > casualtyShareA + 0.08) { winner = "A"; outcome = "siegA"; }
  else { winner = casualtyShareA <= casualtyShareB ? "A" : "B"; outcome = "knapperSieg"; }

  const result = {
    winner, outcome,
    armyA: { name: state.armyA.name, startStrength: startA, endStrength: nowA, casualties: casualtiesA,
      dead: sumCasualtyField(state.armyA, "dead"), wounded: sumCasualtyField(state.armyA, "wounded"), missing: sumCasualtyField(state.armyA, "missing"),
      moraleStart: undefined, moraleEnd: Math.round(overallMorale(state.armyA)) },
    armyB: { name: state.armyB.name, startStrength: startB, endStrength: nowB, casualties: casualtiesB,
      dead: sumCasualtyField(state.armyB, "dead"), wounded: sumCasualtyField(state.armyB, "wounded"), missing: sumCasualtyField(state.armyB, "missing"),
      moraleStart: undefined, moraleEnd: Math.round(overallMorale(state.armyB)) },
    rounds: state.meleeRoundsDone,
    terrain: state.terrain, weather: state.weather,
  };
  state.result = result;
  state.finished = true;

  const outcomeText = {
    siegA: `SIEG ${state.armyA.name.toUpperCase()}`, siegB: `SIEG ${state.armyB.name.toUpperCase()}`,
    knapperSieg: `KNAPPER SIEG ${(winner === "A" ? state.armyA.name : state.armyB.name).toUpperCase()}`,
    vernichtendeNiederlageA: `VERNICHTENDE NIEDERLAGE FÜR ${state.armyA.name.toUpperCase()}`,
    vernichtendeNiederlageB: `VERNICHTENDE NIEDERLAGE FÜR ${state.armyB.name.toUpperCase()}`,
    geordneterRueckzugA: `${state.armyA.name.toUpperCase()} ZIEHT SICH ZURÜCK`,
    geordneterRueckzugB: `${state.armyB.name.toUpperCase()} ZIEHT SICH ZURÜCK`,
  }[outcome];
  logMsg(state, outcomeText + "!");
}

function sumCasualtyField(army, field) {
  return army.stacks.reduce((s, u) => s + u.casualties[field], 0);
}

// ---------- Komplettdurchlauf ohne UI (für Tests/Monte-Carlo/KI-vs-KI) ----------
function simulateBattle(armyA, armyB, terrain, weather, seed, decisionPolicy) {
  const state = createBattle(armyA, armyB, terrain, weather, seed);
  const policy = decisionPolicy || aiDecisionPolicy;
  let guard = 0;
  while (!state.finished && guard < 200) {
    if (state.pendingDecision) {
      const choice = policy(state, state.pendingDecision);
      advanceBattle(state, choice);
    } else {
      advanceBattle(state);
    }
    guard++;
  }
  return state;
}
