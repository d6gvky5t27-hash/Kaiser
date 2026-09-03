// ============================================================
// PHASE 9 — Shared, composable agent behaviors.
// ============================================================
// Test infrastructure only (see engine.js header). Every function here
// takes `ctx` (from engine.js runCampaign) plus small parameter objects
// that individual archetypes (archetypes.js) configure differently — this
// is what gives 10+ distinct "personalities" without 10 independent
// reimplementations of "how do I recruit troops" etc.
//
// Perfect-information note (§7 of the master prompt): almost everything
// read here is the player's OWN kingdom (fully legitimate — a real player
// sees their own treasury/army/population/prices exactly). The two
// consciously-flagged simplifications, documented in
// PHASE9_GAMEPLAY_AUDIT.md §PERFECT-INFO:
//   1. War-target selection reads `estimateAiStrength()` directly, which
//      IS the same fuzzy estimate function the real UI's intel report
//      uses for display — legitimate, not a shortcut.
//   2. War-target selection also reads exact enemy territory `garrison`
//      counts (state.territories[id].garrison) to judge attack odds. The
//      real Kriegskarte UI shows this via the same field with no spy-
//      accuracy fuzzing applied to garrison numbers specifically (only
//      diplomatic/army-total estimates are fuzzed) — verified against
//      js/war-map.js, so this one is also legitimate, not a shortcut.
// No other hidden-state shortcuts are used.

function neighborIds(state) { return Object.keys(state.diplomacy); }

// ---------- Treasury hygiene ----------
function manageTreasuryHealth(ctx, opts) {
  opts = opts || {};
  const state = ctx.state;
  const minBuffer = opts.minBuffer !== undefined ? opts.minBuffer : 200;
  // The real game imposes NO debt ceiling (takeLoan() never rejects on
  // amount, see js/economy.js) — bankruptTreasuryThreshold (-3000 treasury,
  // not debt) is the only real limit. maxDebt here is a purely
  // self-imposed caution parameter representing "how far into debt would
  // this archetype let itself go before treating it as a crisis", not a
  // game rule. It is set generously (well above what a single loan cycle
  // needs) so this heuristic doesn't itself become the reason an agent
  // goes bankrupt — see PHASE9_GAMEPLAY_AUDIT.md for the prototyping run
  // that surfaced this (agents were going bankrupt because THIS cap was
  // too tight, not because the underlying economy is unsustainable).
  const maxDebt = opts.maxDebt !== undefined ? opts.maxDebt : 6000;
  if (state.treasury < minBuffer * 0.25 && state.debt < maxDebt) {
    const amount = Math.min(maxDebt - state.debt, Math.round(minBuffer * 2 - state.treasury));
    if (amount > 0) act(ctx, takeLoan, [amount], { category: "ECONOMY", action: "take_loan", reason: opts.reason || "treasury running low", expectedGoal: "avoid bankruptcy", meaningful: true });
  } else if (state.debt > 0 && state.treasury > minBuffer * 3) {
    const amount = Math.min(state.debt, Math.round((state.treasury - minBuffer * 2) * 0.5));
    if (amount > 20) act(ctx, repayDebt, [amount], { category: "ECONOMY", action: "repay_debt", reason: opts.reason || "healthy treasury, reduce debt", meaningful: amount > 100 });
  }
}

// ---------- Tax / governance (direct-state, no wrapping function — §A.1) ----------
function considerTax(ctx, targetRate, reason) {
  const cur = ctx.state.regions.player.taxRate;
  if (Math.abs(cur - targetRate) >= 0.03) setTaxRate(ctx, targetRate, reason);
}
function considerGovernance(ctx, targetStyle, reason) {
  const cur = ctx.state.regions.player.governanceStyle !== undefined ? ctx.state.regions.player.governanceStyle : 50;
  if (Math.abs(cur - targetStyle) >= 8) setGovernanceStyle(ctx, targetStyle, reason);
}

// ---------- Military recruitment ----------
// unitPriority: ordered list of TROOP_TYPES keys to prefer.
// spendShare: fraction of treasury-above-buffer this call may spend at most.
// maxArmyStrength (optional): once armyStrength() reaches this, stop
// recruiting entirely. Discovered during prototyping: without this cap, a
// "just keep a small garrison" archetype (called monthly, forever) grows
// its army — and therefore its ONGOING upkeep — without bound for 100
// years, which eventually outpaces tax income no matter how generous the
// debt ceiling is. A real cautious player recruits a garrison ONCE and
// stops; this parameter is what encodes that "enough is enough" judgment.
function recruitPreferred(ctx, unitPriority, spendShare, minBuffer, reason, expectedGoal, maxArmyStrength) {
  const state = ctx.state;
  if (maxArmyStrength !== undefined && armyStrength(state) >= maxArmyStrength) return null;
  const spendable = Math.max(0, (state.treasury - minBuffer) * spendShare);
  if (spendable < 50) return null;
  for (const type of unitPriority) {
    const def = TROOP_TYPES[type];
    if (!def) continue;
    if (def.minAdelSatisfaction && state.regions.player.population.adel && state.regions.player.population.adel.satisfaction < def.minAdelSatisfaction) continue;
    const count = Math.floor(spendable / def.cost);
    if (count <= 0) continue;
    const before = state.army[type] || 0;
    const res = act(ctx, recruitTroops, [type, count], {
      category: "MILITARY", action: "recruit_" + type, reason, expectedGoal,
      meaningful: before === 0 || count >= Math.max(3, before * 0.1),
    });
    if (res.ok) return { type, count };
    return null;
  }
  return null;
}

// ---------- Advisors ----------
function manageAdvisors(ctx, priorityRoles, minBuffer, reason) {
  const state = ctx.state;
  for (const role of priorityRoles) {
    if (state.advisors[role]) continue; // occupied
    const openRes = openAdvisorSelection(state, role);
    if (!openRes || !openRes.ok) continue;
    const sel = state.pendingAdvisorSelection;
    if (!sel || state.treasury - sel.cost < minBuffer) { state.pendingAdvisorSelection = null; continue; }
    // Pick the candidate with the highest role-relevant stat — this is the
    // same info a real player sees on the candidate cards (name/skills).
    const statKey = ADVISOR_ROLES[role].statKey;
    let bestIdx = 0, bestVal = -1;
    sel.candidates.forEach((c, i) => { const v = c.stats ? c.stats[statKey] : 0; if (v > bestVal) { bestVal = v; bestIdx = i; } });
    act(ctx, confirmAdvisorSelection, [bestIdx], {
      category: "ADVISOR", action: "appoint_" + role, reason,
      expectedGoal: "office effect + candidate quality (" + statKey + "=" + bestVal + ")",
      meaningful: true,
    });
    return role;
  }
  // Upgrade an existing, cheap-to-upgrade priority advisor if flush.
  for (const role of priorityRoles) {
    if (!state.advisors[role]) continue;
    const lvl = state.advisorLevels[role] || 0;
    if (lvl >= CONFIG.advisors.maxLevel) continue;
    const cost = advisorUpgradeCost(role, lvl);
    if (state.treasury - cost < minBuffer * 2) continue;
    act(ctx, upgradeAdvisor, [role], { category: "ADVISOR", action: "upgrade_" + role, reason: reason + " (upgrade)", meaningful: true });
    return role;
  }
  return null;
}

// ---------- Diplomacy maintenance ----------
// ladder: ordered list of doDiplomacy-equivalent action strings to try, cheapest/lowest-commitment first.
const DIPLO_FN = {
  gift: sendGift, nonaggr: proposeNonAggression, trade: proposeTradeTreaty, alliance: proposeAlliance,
  vassalize: vassalize, tribute: demandTribute, marriage: dynasticMarriage, hostage: hostageExchange,
  transit: grantTransitRights, guarantee: guaranteeRegion, peace: proposePeaceTreaty, territory: demandTerritory,
};
function maintainDiplomacy(ctx, ladder, minRelationTarget, minBuffer, reason) {
  const state = ctx.state;
  let acted = false;
  for (const aiId of neighborIds(state)) {
    if (state.warState && state.warState[aiId]) continue; // wars handled by warCampaign
    const dip = state.diplomacy[aiId];
    if (dip.relation >= minRelationTarget && dip.treaties.allianz) continue;
    for (const action of ladder) {
      if (action === "alliance" && dip.treaties.allianz) continue;
      if (action === "trade" && dip.treaties.handel) continue;
      if (action === "nonaggr" && dip.treaties.nichtangriff) continue;
      if (state.treasury < minBuffer) break;
      const fn = DIPLO_FN[action];
      const res = act(ctx, fn, [aiId], { category: "DIPLOMACY", action, reason, meaningful: false });
      if (res.ok) { acted = true; break; }
    }
  }
  return acted;
}

// ---------- Trade ----------
const TRADE_SELL_THRESHOLD = 250; // roughly: sell surplus once warehouse exceeds this
function tradeSurplusGoods(ctx, minBuffer, reason) {
  const state = ctx.state;
  const region = state.regions.player;
  let acted = null;
  for (const gid in GOODS) {
    if (gid === "getreide") continue; // never dump the food reserve
    const stock = region.warehouse[gid] || 0;
    if (stock > TRADE_SELL_THRESHOLD) {
      const qty = Math.round((stock - TRADE_SELL_THRESHOLD) * 0.5);
      if (qty > 0) {
        const res = act(ctx, sellGoodToMarket, [region, gid, qty], { category: "TRADE", action: "sell_" + gid, reason, meaningful: qty * currentGoodPrice(region, gid) > 100 });
        if (res.ok) acted = { gid, qty, dir: "sell" };
      }
    }
  }
  if (region.grainRatio !== undefined && region.grainRatio < 0.7 && state.treasury > minBuffer + 300) {
    const qty = 100;
    const res = act(ctx, buyGoodFromMarket, [region, "getreide", qty], { category: "TRADE", action: "buy_getreide", reason: "grain shortage (" + Math.round(region.grainRatio * 100) + "%)", expectedGoal: "avoid famine", meaningful: true });
    if (res.ok) acted = { gid: "getreide", qty, dir: "buy" };
  }
  return acted;
}

// Simple arbitrage scan: compare own-region price vs. each diplomatically-reachable
// neighbor's price for every good, export the single best-margin opportunity if
// transit/trade relations allow and stock exists.
function regionalArbitrageScan(ctx, minMarginShare, minBuffer, reason) {
  const state = ctx.state;
  const region = state.regions.player;
  let best = null;
  for (const aiId of neighborIds(state)) {
    const target = state.regions[aiId];
    for (const gid in GOODS) {
      const ownPrice = currentGoodPrice(region, gid);
      const theirPrice = currentGoodPrice(target, gid);
      const stock = region.warehouse[gid] || 0;
      if (gid === "getreide" || stock < 20) continue;
      const margin = (theirPrice - ownPrice) / ownPrice;
      if (margin > minMarginShare && (!best || margin > best.margin)) {
        best = { aiId, gid, margin, qty: Math.min(Math.round(stock * 0.4), 150) };
      }
    }
  }
  if (best && best.qty > 0) {
    const res = act(ctx, exportGoodToRegion, [best.aiId, best.gid, best.qty], {
      category: "TRADE", action: "export_arbitrage", reason,
      expectedGoal: "margin " + Math.round(best.margin * 100) + "%",
      meaningful: true,
    });
    if (res.ok) return best;
  }
  return null;
}

// ---------- War campaign ----------
// Returns true if any war-related action was taken this call.
function warCampaign(ctx, opts) {
  opts = opts || {};
  const state = ctx.state;
  const minBuffer = opts.minBuffer !== undefined ? opts.minBuffer : 300;
  let acted = false;

  // 1. Declare war on an eligible weak/hostile neighbor if aggression conditions met.
  if (opts.allowDeclareWar) {
    for (const aiId of neighborIds(state)) {
      if (state.warState[aiId]) continue;
      const dip = state.diplomacy[aiId];
      const ownStrength = armyStrength(state);
      const theirStrength = estimateAiStrength(state.regions[aiId]);
      const strongEnough = ownStrength > theirStrength * (opts.strengthMargin || 1.3);
      const justified = dip.relation < (opts.hostileRelationThreshold !== undefined ? opts.hostileRelationThreshold : 15);
      if (strongEnough && (opts.opportunistic || justified)) {
        act(ctx, declareWar, [aiId], {
          category: "WAR", action: "declare_war", reason: opts.reason || "favorable strength ratio",
          expectedGoal: "territorial conquest", meaningful: true,
        });
        acted = true;
        break;
      }
    }
  }

  // 2. Deploy reserve troops to border territories of any active war.
  const activeWars = neighborIds(state).filter(id => state.warState[id]);
  if (activeWars.length) {
    for (const type in TROOP_TYPES) {
      const reserve = reserveCountOfType(state, type);
      if (reserve <= 0) continue;
      // find a player border territory adjacent to one of the AI regions we're at war with
      let targetTerr = null;
      for (const tid in state.territories) {
        if (state.territories[tid].owner !== "player") continue;
        const def = territoryById(tid);
        if (def.adjacent.some(aid => activeWars.includes(state.territories[aid].owner))) { targetTerr = tid; break; }
      }
      if (!targetTerr) continue;
      const res = act(ctx, deployToTerritory, [targetTerr, type, reserve], { category: "WAR", action: "deploy_" + type, reason: "reinforce border for active war", meaningful: false });
      if (res.ok) acted = true;
    }
  }

  // 3. Attack across a border where we have deployed troops, if odds look favorable.
  if (activeWars.length) {
    const borders = findAttackableBorders(state);
    for (const b of borders) {
      const defTerr = state.territories[b.toId];
      const myTerr = state.territories[b.fromId];
      const myStrengthEst = Object.entries(myTerr.deployment).reduce((s, [t, c]) => s + (TROOP_TYPES[t] ? TROOP_TYPES[t].strength * c : 0), 0);
      const theirGarrisonEst = defTerr.garrison;
      if (myStrengthEst > theirGarrisonEst * (opts.attackMargin || 0.8)) {
        resolveTerritoryAttack(ctx, b.fromId, b.toId, opts.formation || "ausgewogen", opts.tactic || "frontalangriff", { reason: opts.reason || "favorable local odds", expectedGoal: "conquer " + b.toId });
        acted = true;
        break; // one battle per month keeps this from spiraling in a single tick
      }
    }
  }

  // 4. Sue for peace once we've won something and relation math looks costly to continue, or if we're losing badly.
  if (opts.allowPeace) {
    for (const aiId of activeWars) {
      const wantsPeace = opts.peaceAfterYears !== undefined && ctx.memory["warStart_" + aiId] !== undefined && state.year - ctx.memory["warStart_" + aiId] >= opts.peaceAfterYears;
      if (wantsPeace) {
        const res = act(ctx, proposePeaceTreaty, [aiId], { category: "WAR", action: "sue_for_peace", reason: "war has run long enough", meaningful: true });
        if (res.ok) acted = true;
      }
    }
  }
  for (const aiId of activeWars) if (ctx.memory["warStart_" + aiId] === undefined) ctx.memory["warStart_" + aiId] = state.year;

  return acted;
}

// ---------- Kathedrale (Kaiserwahl-Voraussetzung, §69) ----------
// Discovered during prototyping: checkElectionTrigger() requires BOTH
// kurfuerst+ title rank AND a built kathedrale (js/politics.js). No
// archetype naturally buys the raw materials (stein/holz) it needs, so
// without this helper NO agent could ever reach Kaiserwahl eligibility —
// that would make any "Kaiserkrone erreichbar?" measurement (§17/§69/§70)
// artificially zero regardless of the real game's difficulty. This is an
// agent-design fix, not a game-balance change (all three calls below are
// real, unmodified player functions).
function considerBuildKathedrale(ctx, minBuffer, reason) {
  const state = ctx.state;
  const region = state.regions.player;
  if (hasBuilding(region, "kathedrale")) return false;
  const b = BUILDINGS.kathedrale;
  if (state.treasury < b.cost + minBuffer) return false;
  for (const gid in b.materialCost) {
    const need = b.materialCost[gid] - (region.warehouse[gid] || 0);
    if (need > 0) act(ctx, buyGoodFromMarket, [region, gid, need], { category: "ECONOMY", action: "buy_building_material_" + gid, reason: "materials for kathedrale", meaningful: false });
  }
  const res = act(ctx, buildNewBuilding, [region, "kathedrale"], { category: "TITLE", action: "build_kathedrale", reason, expectedGoal: "unlock Kaiserwahl eligibility", meaningful: true });
  return !!(res && res.ok);
}

// ---------- Palast (König-Titelvoraussetzung, entdeckt in Phase 10A) ----------
// checkTitleProgress() (js/politics.js) gated "König" zusätzlich zu
// Bevölkerung/Vermögen/Prestige hinter einem gebauten Palast — genau
// dasselbe Muster wie die in Phase 9 gefundene Kathedrale-Voraussetzung
// für die Kaiserwahl. Ohne diese Ergänzung bliebe die König-/Kaiser-
// Erreichbarkeitsmessung in Phase 10 durch eine Testcode-Lücke verzerrt
// (kein Agent baute je einen Palast), nicht durch echte Spielschwierigkeit.
function considerBuildPalast(ctx, minBuffer, reason) {
  const state = ctx.state;
  const region = state.regions.player;
  if (hasBuilding(region, "palast")) return false;
  const b = BUILDINGS.palast;
  if (state.treasury < b.cost + minBuffer) return false;
  for (const gid in b.materialCost) {
    const need = b.materialCost[gid] - (region.warehouse[gid] || 0);
    if (need > 0) act(ctx, buyGoodFromMarket, [region, gid, need], { category: "ECONOMY", action: "buy_building_material_" + gid, reason: "materials for palast", meaningful: false });
  }
  const res = act(ctx, buildNewBuilding, [region, "palast"], { category: "TITLE", action: "build_palast", reason, expectedGoal: "unlock König title eligibility", meaningful: true });
  return !!(res && res.ok);
}

// ---------- Kaiserwahl ----------
function handleElection(ctx, briberyBudgetPerElector, minBuffer, reason) {
  const state = ctx.state;
  if (!state.pendingElection) return false;
  let acted = false;
  for (const aiId of neighborIds(state)) {
    if (state.pendingElection.bribed[aiId]) continue;
    if (state.treasury - CONFIG.election.bribeCost < minBuffer) continue;
    const res = act(ctx, bribeElector, [aiId], { category: "TITLE", action: "bribe_elector", reason, meaningful: true });
    if (res.ok) acted = true;
  }
  act(ctx, resolveElection, [], { category: "TITLE", action: "resolve_election", reason: "cast the vote", meaningful: true });
  return true;
}

// ---------- Misc systems (kept in the loop so "ignored system" measurement is honest) ----------
function considerInfrastructure(ctx, minBuffer, reason) {
  const state = ctx.state;
  const region = state.regions.player;
  if (state.treasury > minBuffer * 4) {
    act(ctx, upgradeInfrastructure, [region], { category: "ECONOMY", action: "upgrade_infrastructure", reason, meaningful: true });
  }
}
function considerResearch(ctx, categories, reason) {
  const state = ctx.state;
  if (!state.researchPoints || state.researchPoints < 1) return;
  const cat = categories[Math.floor(ctx.rng() * categories.length)];
  act(ctx, investResearch, [cat], { category: "ECONOMY", action: "invest_research_" + cat, reason, meaningful: false });
}
