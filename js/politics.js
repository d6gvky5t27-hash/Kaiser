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
    // §Punkt 36: je höher der Titel, desto höher die Bedeutung.
    recordWorldEvent(state, {
      type: "TITLE_GAINED", actorIds: [state.rulerId], targetIds: [],
      importance: Math.min(100, 45 + nextIdx * 6),
      emotionalWeight: 35, metadata: { titleId: next.id },
      description: `${state.characters[state.rulerId].name} wurde zum ${next.name} erhoben.`,
    });
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

// ---------- Kaiserwahl (§Phase-12 "Imperial Politics") ----------
// checkElectionTrigger()/bribeElector()/resolveElection() sind seit Phase 12
// nach js/imperial-politics.js verschoben und dort durch ein echtes,
// mehrkandidatenfähiges Score-Modell ersetzt (checkImperialCandidacyEligibility/
// declareImperialCandidacy/giftElector/checkImperialElectionTiming/
// resolveImperialElection) -- s. dort für die vollständige Herleitung
// (PHASE12_IMPERIAL_POLITICS_REPORT.md, Abschnitt "Election 1.0 Audit").

// ---------- Intrigen (§32) ----------

function applyGovernanceStyle(state, r) {
  const cfg = CONFIG.governance;
  // -1 (Regler=0, sehr fair) .. 0 (Regler=50, Mitte) .. +1 (Regler=100, gierig) —
  // ein echter, beidseitiger Regler statt nur einer Wirkung Richtung "gierig".
  const swing = (clamp(r.governanceStyle || 0, 0, 100) / 100 - 0.5) * 2;
  const totalPop = Object.values(r.population).reduce((s,g)=>s+g.count,0);
  const extraIncome = Math.round(totalPop * cfg.incomeFactorAtGreedy * swing);
  state.treasury += extraIncome;
  const satDelta = -cfg.satisfactionPenaltyAtGreedy * swing;
  if (satDelta) for (const pid in r.population) r.population[pid].satisfaction = clamp(r.population[pid].satisfaction + satDelta, 0, 100);
  state.legitimacy = clamp(state.legitimacy - cfg.legitimacyPenaltyAtGreedy * swing, 0, 100);
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
