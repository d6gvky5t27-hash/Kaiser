// ============================================================
// POLITICS — Titel-Aufstieg, Kaiserwahl, Regierungsstil, Religion,
// alternative Siegbedingungen (§11/§12/§46/§47)
// ============================================================

function checkTitleProgress(state) {
  const r = state.regions.player;
  const totalPop = Object.values(r.population).reduce((s,g)=>s+g.count,0);
  const nextIdx = state.titleIndex + 1;
  if (nextIdx >= TITLES.length) return null;
  const next = TITLES[nextIdx];
  // Der letzte Schritt zum Kaiser erfolgt ausschließlich über die Kaiserwahl (§12),
  // nicht automatisch per Schwellenwert.
  if (next.id === "kaiser") return null;
  // §Original "Kaiser" (C64): König nur, wenn der Palast fertiggestellt ist
  if (next.id === "koenig" && !hasBuilding(r, "palast")) return null;
  if (totalPop >= next.reqPop && state.treasury >= next.reqWealth && state.prestige >= next.reqPrestige) {
    state.titleIndex = nextIdx;
    addChronicle(state, `Du wurdest zum ${next.name} erhoben!`);
    return next;
  }
  return null;
}

// ---------- Dynastiesystem (§9/§10) ----------

function checkAlternativeVictory(state) {
  if (state.gameOver) return;
  const cond = state.victoryCondition;
  if (!cond || cond === "kaiser" || cond === "endlos") return; // Kaiser läuft über Kaiserwahl, Endlos hat kein Ziel

  const cfg = CONFIG.victoryConditions[cond];
  let met = false;
  if (cond === "reichtum") {
    met = state.treasury >= cfg.treasuryTarget;
  } else if (cond === "handelsmacht") {
    const r = state.regions.player;
    let value = 0;
    for (const gid in GOODS) value += (r.warehouse[gid] || 0) * GOODS[gid].base;
    met = value >= cfg.warehouseValueTarget;
  } else if (cond === "militaer") {
    const wonAgainst = state.warsWonAgainst || {};
    met = ["ai1", "ai2", "ai3"].every(id => wonAgainst[id]);
  }

  if (met) {
    state.victoryProgressYears = (state.victoryProgressYears || 0) + 1;
    if (state.victoryProgressYears >= (cfg.sustainYears || 1)) {
      state.gameOver = "victory";
      addChronicle(state, `Sieg errungen: ${cfg.name}!`);
    }
  } else {
    state.victoryProgressYears = 0;
  }
}

// ---------- Staatsschulden (§24) ----------

function checkElectionTrigger(state) {
  if (state.pendingElection) return;
  if (state.electionCooldown > 0) { state.electionCooldown--; return; }
  const currentTitleId = TITLES[state.titleIndex].id;
  const titleRank = TITLES.findIndex(t => t.id === currentTitleId);
  const kurfuerstRank = TITLES.findIndex(t => t.id === "kurfuerst");
  if (titleRank < kurfuerstRank) return; // erst ab Kurfürst wahlberechtigt
  // §Original "Kaiser" (C64): Kaiserwürde nur, wenn die Kathedrale fertiggestellt ist
  if (!hasBuilding(state.regions.player, "kathedrale")) return;
  if (rnd() < CONFIG.election.triggerChancePerYear) {
    state.pendingElection = { bribed: { ai1: false, ai2: false, ai3: false } };
    addChronicle(state, "Der amtierende Kaiser ist verstorben oder abgesetzt worden: Eine Kaiserwahl steht bevor!");
  }
}

function bribeElector(state, aiId) {
  if (!state.pendingElection) return { ok: false, reason: "Derzeit steht keine Wahl an." };
  if (state.pendingElection.bribed[aiId]) return { ok: false, reason: "Dieser Kurfürst wurde bereits bestochen." };
  const cfg = CONFIG.election;
  if (state.treasury < cfg.bribeCost) return { ok: false, reason: "Nicht genug Taler für die Bestechung." };
  state.treasury -= cfg.bribeCost;
  state.pendingElection.bribed[aiId] = true;
  state.diplomacy[aiId].relation = clamp(state.diplomacy[aiId].relation + cfg.bribeRelationGain, -100, 100);
  addChronicle(state, `${state.regions[aiId].name} wurde vor der Kaiserwahl bestochen.`);
  return { ok: true };
}

function resolveElection(state) {
  if (!state.pendingElection) return { ok: false, reason: "Keine Wahl anhängig." };
  const cfg = CONFIG.election;
  let votesFor = 0;
  const details = [];
  for (const aiId in state.diplomacy) {
    const dip = state.diplomacy[aiId];
    const votedFor = state.pendingElection.bribed[aiId] || dip.relation >= cfg.knownElectorVoteRelationThreshold;
    if (votedFor) votesFor++;
    else {
      dip.relation = clamp(dip.relation + cfg.lossRelationPenalty, -100, 100);
    }
    details.push(`${state.regions[aiId].name}: ${votedFor ? "dafür" : "dagegen"}`);
  }
  for (const threshold of cfg.abstractVotePrestigeThresholds) {
    if (state.prestige >= threshold) votesFor++;
  }
  const totalVotes = 3 + cfg.abstractVotePrestigeThresholds.length;
  const won = votesFor >= cfg.votesNeededForMajority;

  state.pendingElection = null;
  addChronicle(state, `Kaiserwahl: ${votesFor} von ${totalVotes} Stimmen für dich (${details.join(", ")}).`);

  if (won) {
    state.titleIndex = TITLES.findIndex(t => t.id === "kaiser");
    state.gameOver = "victory";
    addChronicle(state, "Die Kurfürsten haben entschieden: Du wurdest zum Kaiser gewählt!");
  } else {
    state.electionCooldown = cfg.cooldownYearsAfterLoss;
    state.prestige = Math.max(0, state.prestige - cfg.lossPrestigePenalty);
    addChronicle(state, "Die Wahl ist verloren. Ein anderer Fürst besteigt vorerst den Kaiserthron.");
  }
  return { ok: true, won, votesFor, totalVotes };
}

// ---------- Intrigen (§32) ----------

function applyGovernanceStyle(state, r) {
  const cfg = CONFIG.governance;
  const style = clamp(r.governanceStyle || 0, 0, 100) / 100; // 0..1
  const totalPop = Object.values(r.population).reduce((s,g)=>s+g.count,0);
  const extraIncome = Math.round(totalPop * cfg.incomeFactorAtGreedy * style);
  state.treasury += extraIncome;
  const satPenalty = cfg.satisfactionPenaltyAtGreedy * style;
  if (satPenalty) for (const pid in r.population) r.population[pid].satisfaction = clamp(r.population[pid].satisfaction - satPenalty * 0.15, 0, 100);
  state.legitimacy = clamp(state.legitimacy - cfg.legitimacyPenaltyAtGreedy * style, 0, 100);
  return extraIncome;
}

// ---------- Kriegsverbündete: Nachbarn unterstützen, bleiben neutral oder helfen dem Gegner
// (§Original: "ob er unterstützen, Durchmarsch gewähren oder neutral bleiben will") ----------
// ---------- Belagerung (§36) ----------

function updateReligion(state, r) {
  const cfg = CONFIG.religion;
  // Kirche/Kloster stärken den kirchlichen Einfluss aktiv (§26 Gebäudeeffekt)
  const kirchenBonus = buildingLevelSum(r, "kirche") * BUILDINGS.kirche.value + buildingLevelSum(r, "kloster") * BUILDINGS.kloster.value;
  if (kirchenBonus) state.religiousInfluence = clamp(state.religiousInfluence + kirchenBonus * 0.05, 0, 100);

  if (state.religiousInfluence < cfg.lowInfluenceThreshold) {
    for (const pid in r.population) r.population[pid].satisfaction = clamp(r.population[pid].satisfaction - cfg.lowInfluenceSatPenalty * 0.3, 0, 100);
  } else if (state.religiousInfluence > cfg.highInfluenceThreshold) {
    for (const pid in r.population) r.population[pid].satisfaction = clamp(r.population[pid].satisfaction + cfg.highInfluenceSatBonus * 0.2, 0, 100);
  }
  // langsame Drift Richtung Mitte, sofern kein Ereignis eingreift
  state.religiousInfluence = clamp(state.religiousInfluence + (55 - state.religiousInfluence) * 0.02, 0, 100);
}

// ---------- Debug-Funktionen (§69) — nur für Entwicklung/QA gedacht ----------
