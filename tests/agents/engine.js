// ============================================================
// PHASE 9 — GAMEPLAY INTELLIGENCE LAB — Agent Engine
// ============================================================
// Test infrastructure ONLY. NOT part of the production bundle (not listed
// in tools/build-bundle.js FILES[]). This file is concatenated (plain
// text, like js/*.js) into a Node `eval()` sandbox together with the real
// game source (data/gamedata.js + js/*.js + battle-engine/*.js), so it can
// call the exact same state-mutating functions a real player's UI click
// calls (see PHASE9_GAMEPLAY_AUDIT.md §A for the full action catalog this
// was built from). It never edits `state` directly except for the two
// documented cases where no wrapping function exists in the real game
// (taxRate / governanceStyle sliders — see setTaxRate/setGovernanceStyle
// below, which mirror the exact index.html slider-input-listener logic).
//
// Determinism (§26/27 of the Phase 9 master prompt): agents NEVER call the
// real gameplay RNG (`rnd()`/`seedRng()`/`battleRnd()`). Every agent gets
// its own private, string-seeded Mulberry32 stream via makeAgentRng() for
// any tie-breaking choice it needs to make. Same agent + same seed always
// produces an identical decision log and identical final state.

// phase11-v1 (was phase10-v1): Phase 11 "Living Realm" adds a genuinely
// new player decision (a Landstände demand, surfaced through the same
// pendingEvent window every other event/chain uses). Without any archetype
// change, every agent already resolves these safely through the existing
// generic agent.eventPrefs(ctx) fallback (verified: a full 100-year
// verwalter campaign ran cleanly end-to-end with zero special-casing). This
// bump documents the addition of `agent.estateEventPrefs(ctx)`, an OPTIONAL
// per-archetype override consulted only when the pending decision is one of
// the 6 estate chains (see pendingEstateIds() below) — added to the 8
// archetypes the Phase 11 master prompt names explicitly (Verwalter,
// Kaufmann, Kriegsherr, Diplomat, Dynast, Hardliner, Versöhner, Min-Maxer);
// every other archetype (passive/machtpolitiker/opportunist/anfaenger)
// keeps using its regular eventPrefs() for estate decisions too, which is a
// deliberate choice, not an oversight — a passive/beginner/no-fixed-stance
// agent has no principled estate-specific position beyond its general one.
const AGENT_POLICY_VERSION = "phase11-v1";

// Prior version history (phase10-v1, was phase9-v1): added
// considerBuildPalast() to verwalter/diplomat/machtpolitiker/opportunist/
// minmaxer. Phase 10A's title-progression audit found checkTitleProgress()
// gates "König" behind a built palast — analogous to the Phase 9
// kathedrale/Kaiserwahl gate — which no agent built, artificially zeroing
// the König/Kaiser reachability measurement. This is the SAME category of
// fix as Phase 9's kathedrale addition (closing a test-agent competence
// gap, not a balance change) — see PHASE10_BALANCE_COMPARISON.md §G. Also
// added considerBuildKathedrale()+handleElection() to verwalter
// specifically: with the recalibrated TITLES ladder verwalter now
// regularly reaches Kurfürst+ rank, which per checkElectionTrigger() is
// the actual (only) path to Kaiser — checkTitleProgress() explicitly
// excludes "kaiser" (`if (next.id === "kaiser") return null`), so the
// Kaiser row in TITLES is display-only; the real gate is kurfuerst rank +
// kathedrale + resolveElection(), unrelated to reqPop/reqWealth/reqPrestige.

// ---------- Deterministic agent-private RNG (never touches state.rng) ----------
function hashSeedString(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}
function makeAgentRng(seedStr) {
  let a = hashSeedString(String(seedStr)) || 0xdeadbeef;
  return function agentRng() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- Decision log ----------
// Every attempted action is logged (ok:true/false). `meaningful` is set by
// the caller per §29-31 of the master prompt (a routine, repeated,
// zero-thought action is NOT meaningful even if it succeeds).
function logDecision(ctx, entry) {
  ctx.decisionLog.push({
    year: ctx.state.year,
    month: ctx.state.month,
    agent: ctx.agentId,
    seed: ctx.seed,
    category: entry.category,
    action: entry.action,
    params: entry.params !== undefined ? entry.params : null,
    reason: entry.reason || "",
    expectedGoal: entry.expectedGoal || "",
    ok: entry.ok !== undefined ? entry.ok : true,
    meaningful: entry.meaningful !== undefined ? entry.meaningful : true,
  });
}

// Generic wrapper around a state-mutating function that returns {ok,reason}.
// Logs the attempt either way. Returns the function's result.
function act(ctx, fn, args, meta) {
  const result = fn.apply(null, [ctx.state].concat(args));
  const ok = result && typeof result === "object" && "ok" in result ? result.ok : true;
  logDecision(ctx, Object.assign({}, meta, { ok, params: meta.params !== undefined ? meta.params : args }));
  return result;
}

// The two documented exceptions with NO wrapping function in the real game
// (index.html's #taxSlider/#govSlider input listeners write these fields
// directly — see PHASE9_GAMEPLAY_AUDIT.md §A.1).
function setTaxRate(ctx, rate, reason) {
  rate = Math.max(0, Math.min(1, rate));
  const before = ctx.state.regions.player.taxRate;
  ctx.state.regions.player.taxRate = rate;
  logDecision(ctx, { category: "TAX", action: "set_tax_rate", params: { from: before, to: rate }, reason, meaningful: Math.abs(before - rate) >= 0.03 });
}
function setGovernanceStyle(ctx, style, reason) {
  style = Math.max(0, Math.min(100, style));
  const before = ctx.state.regions.player.governanceStyle !== undefined ? ctx.state.regions.player.governanceStyle : 50;
  ctx.state.regions.player.governanceStyle = style;
  logDecision(ctx, { category: "TAX", action: "set_governance_style", params: { from: before, to: style }, reason, meaningful: Math.abs(before - style) >= 8 });
}

// ---------- Event / event-chain option choice ----------
// No lookahead-by-execution is used: several option .apply()/.effect()
// bodies call rnd() (verified during research — e.g. spouse generation in
// event-chains.js), so cloning state and trial-applying an option to see
// its outcome would silently burn real gameplay RNG calls on a branch that
// never happens, corrupting determinism for the rest of the campaign. This
// mirrors the constraint that made the project's own existing test
// policies (resolvePendingEventWithPolicy in js/event-chains.js)
// position/label-based rather than lookahead-based. We reuse that same
// established, audited convention: option index 0 is written as the most
// conciliatory/generous, the last index as the most aggressive/harsh (see
// the comment above resolvePendingEventWithPolicy). `aggressionBias` in
// [-1,1] selects a base index along that axis; `costSensitivity` in [0,1]
// nudges toward whichever nearby option's label mentions the smallest (or
// no) Taler cost. Fully deterministic, no rnd() of any kind.
function pickEventOptionIndex(ev, prefs, agentRng) {
  const n = ev.options.length;
  if (n <= 1) return 0;
  const bias = prefs.aggressionBias !== undefined ? prefs.aggressionBias : 0;
  let idx = Math.round(((bias + 1) / 2) * (n - 1));
  idx = Math.max(0, Math.min(n - 1, idx));
  const costSens = prefs.costSensitivity || 0;
  if (costSens > 0) {
    const costOf = (label) => {
      const m = /-\s*([\d.]+)\s*Taler/.exec(label || "");
      return m ? parseFloat(m[1].replace(/\./g, "")) : 0;
    };
    const candidates = [idx];
    if (idx > 0) candidates.push(idx - 1);
    if (idx < n - 1) candidates.push(idx + 1);
    let best = idx, bestCost = costOf(ev.options[idx].label);
    for (const c of candidates) {
      const cost = costOf(ev.options[c].label);
      if (cost < bestCost - 1) { best = c; bestCost = cost; }
    }
    if (agentRng() < costSens) idx = best;
  }
  return idx;
}

// ---------- §Phase-11: Landstände-Erkennung fürs Event-Policy-Routing ----------
// Reuses js/estates.js's own ESTATE_CHAIN_TEMPLATE_IDS (already loaded into
// this sandbox) instead of duplicating the list of the 6 chain ids here.
// Returns the estate id(s) involved (0, 1, or 2 for staende_gegeneinander),
// purely a read — no rnd(), safe to call from an eventPrefs()-style function.
function pendingEstateIds(ctx) {
  const ev = ctx.state.pendingEvent;
  if (!ev || ev.source !== "EVENT_CHAIN" || !ev.chainId) return [];
  const chain = ctx.state.eventChains.active[ev.chainId];
  if (!chain || !ESTATE_CHAIN_TEMPLATE_IDS.includes(chain.templateId)) return [];
  const v = chain.variables || {};
  if (v.estateIds) return v.estateIds;
  if (v.estateId) return [v.estateId];
  return [];
}

function resolvePendingEventAsPlayer(ctx, prefs) {
  const state = ctx.state;
  const ev = state.pendingEvent;
  if (!ev || !ev.options || !ev.options.length) { state.pendingEvent = null; return; }
  const idx = pickEventOptionIndex(ev, prefs, ctx.rng);
  ev.options[idx].apply(state.regions.player, state);
  addChronicle(state, `Ereignis "${ev.title}": Option "${ev.options[idx].label}" gewählt.`);
  logDecision(ctx, {
    category: "EVENT", action: "resolve_event",
    params: { title: ev.title, chosenIndex: idx, optionCount: ev.options.length, label: ev.options[idx].label },
    reason: prefs.reasonLabel || "archetype event policy",
    expectedGoal: prefs.expectedGoal || "",
    meaningful: ev.options.length > 1,
  });
  state.pendingEvent = null;
}

// ---------- Birth / marriage announcements (no real gameplay effect beyond ack) ----------
function resolvePendingBirth(ctx, namePool) {
  const state = ctx.state;
  const childId = state.pendingBirth;
  if (!childId) return;
  const c = state.characters[childId];
  if (c && namePool && namePool.length) {
    // Real UI reads a free-text name field; headless agents pick from a
    // small deterministic pool keyed by their own RNG. Not a "meaningful"
    // decision (cosmetic only, no mechanical effect).
    const name = namePool[Math.floor(ctx.rng() * namePool.length)];
    c.name = name;
  }
  state.pendingBirth = null;
}
function resolvePendingMarriage(ctx) {
  // closeMarriageAnnouncement() in the real UI only clears the flag.
  ctx.state.pendingMarriage = null;
}

// ---------- War: territory attack (mirrors wmDoAttack -> openTerritoryBattleSetup
// -> btStartBattle -> createBattle/advanceBattle loop -> applyTerritoryBattleResult) ----------
function resolveTerritoryAttack(ctx, fromId, toId, formation, tactic, meta) {
  const state = ctx.state;
  const defTerr = state.territories[toId];
  const aiIdBefore = defTerr.owner;
  const armies = buildTerritoryBattleArmies(state, fromId, toId, true);
  const terrain = territoryById(toId).terrain;
  armies.armyA.formation = formation || "ausgewogen";
  armies.armyA.tactic = tactic || "halten";
  const seed = Math.floor(rnd() * 0xFFFFFFFF); // real gameplay RNG, exactly like btStartBattle()
  let bstate = createBattle(armies.armyA, armies.armyB, terrain, "klar", seed);
  let steps = 0;
  while (!bstate.finished && steps < 500) { bstate = advanceBattle(bstate); steps++; }
  applyTerritoryBattleResult(state, fromId, toId, bstate, true);
  const won = bstate.result && bstate.result.winner === "A";
  logDecision(ctx, Object.assign({
    category: "WAR", action: "attack_territory",
    params: { fromId, toId, defenderRegion: aiIdBefore, formation, tactic, won },
    meaningful: true,
  }, meta));
  return { won, battleResult: bstate };
}

function resolveIncomingAiWar(ctx) {
  const state = ctx.state;
  const aiId = state.incomingAiWar;
  state.incomingAiWar = null;
  const armyA = buildPlayerBattleArmy(state, { defending: true });
  const armyB = buildAiBattleArmy(state, aiId, undefined, { attacking: true });
  const terrain = determineWarTerrain(state.regions.player);
  armyA.formation = "defensiv"; armyA.tactic = "verteidigen";
  const seed = Math.floor(rnd() * 0xFFFFFFFF);
  let bstate = createBattle(armyA, armyB, terrain, "klar", seed);
  let steps = 0;
  while (!bstate.finished && steps < 500) { bstate = advanceBattle(bstate); steps++; }
  applyBattleResultToGame(state, aiId, bstate);
  const won = bstate.result && bstate.result.winner === "A";
  logDecision(ctx, { category: "WAR", action: "defend_surprise_attack", params: { aiId, won }, reason: "forced defense (AI-initiated)", meaningful: true });
}

function resolvePendingTerritoryDefense(ctx) {
  const state = ctx.state;
  const def = state.pendingTerritoryDefense;
  state.pendingTerritoryDefense = null;
  const { attackerTerritoryId, defenderTerritoryId } = def;
  const armies = buildTerritoryBattleArmies(state, attackerTerritoryId, defenderTerritoryId, false);
  const terrain = territoryById(defenderTerritoryId).terrain;
  armies.armyB.formation = "defensiv"; armies.armyB.tactic = "verteidigen";
  const seed = Math.floor(rnd() * 0xFFFFFFFF);
  let bstate = createBattle(armies.armyA, armies.armyB, terrain, "klar", seed);
  let steps = 0;
  while (!bstate.finished && steps < 500) { bstate = advanceBattle(bstate); steps++; }
  applyTerritoryBattleResult(state, attackerTerritoryId, defenderTerritoryId, bstate, false);
  const won = bstate.result && bstate.result.winner === "B";
  logDecision(ctx, { category: "WAR", action: "defend_territory", params: { attackerTerritoryId, defenderTerritoryId, won }, reason: "forced defense (AI territory counter-attack)", meaningful: true });
}

// A player-owned territory adjacent to an enemy-owned one, with SOME
// deployed troops (attacking with 0 deployed troops is legal but pointless
// — buildPlayerTerritoryArmy() falls back to nothing and the real UI would
// warn the player; agents skip empty attacks).
function findAttackableBorders(state) {
  const out = [];
  for (const id in state.territories) {
    const terr = state.territories[id];
    if (terr.owner !== "player") continue;
    const def = territoryById(id);
    const deployedTotal = Object.values(terr.deployment || {}).reduce((a, b) => a + b, 0);
    if (deployedTotal <= 0) continue;
    for (const adjId of def.adjacent) {
      const adjTerr = state.territories[adjId];
      if (adjTerr.owner !== "player") out.push({ fromId: id, toId: adjId, aiId: adjTerr.owner });
    }
  }
  return out;
}

// Priority order matches advanceToNextPendingScreen() in index.html exactly.
function resolvePendingQueue(ctx, agent) {
  const state = ctx.state;
  let guard = 0;
  while (guard++ < 20) {
    if (state.incomingAiWar) { resolveIncomingAiWar(ctx); continue; }
    if (state.pendingTerritoryDefense) { resolvePendingTerritoryDefense(ctx); continue; }
    if (state.pendingMarriage) { resolvePendingMarriage(ctx); continue; }
    if (state.pendingBirth) { resolvePendingBirth(ctx, agent.namePool); continue; }
    if (state.pendingEvent) {
      // §Phase-11: an optional, archetype-specific estate lean takes over
      // ONLY for the 6 Landstände chains, when the archetype defines one —
      // every other pendingEvent (and every archetype without
      // estateEventPrefs) keeps using the regular, already-established
      // eventPrefs(ctx).
      const useEstatePrefs = agent.estateEventPrefs && pendingEstateIds(ctx).length > 0;
      resolvePendingEventAsPlayer(ctx, useEstatePrefs ? agent.estateEventPrefs(ctx) : agent.eventPrefs(ctx));
      continue;
    }
    break;
  }
}

// ---------- Yearly/campaign snapshot for metrics ----------
function armyTotalStrength(state) {
  let s = 0;
  for (const t in TROOP_TYPES) s += (state.army[t] || 0) * TROOP_TYPES[t].strength;
  return s;
}
function territoriesOwnedByPlayer(state) {
  let n = 0;
  for (const id in state.territories) if (state.territories[id].owner === "player") n++;
  return n;
}
function atWarCount(state) {
  let n = 0;
  for (const id in state.warState) if (state.warState[id]) n++;
  return n;
}
function avgSatisfaction(region) {
  const groups = Object.values(region.population);
  if (!groups.length) return 0;
  return groups.reduce((s, g) => s + g.satisfaction, 0) / groups.length;
}
function snapshotYear(state) {
  const r = state.regions.player;
  const totalPop = Object.values(r.population).reduce((s, g) => s + g.count, 0);
  return {
    year: state.year,
    treasury: Math.round(state.treasury),
    debt: Math.round(state.debt),
    totalPopulation: totalPop,
    prestige: state.prestige,
    legitimacy: state.legitimacy,
    titleIndex: state.titleIndex,
    landHectares: Math.round(r.land || 0),
    armyStrength: Math.round(armyTotalStrength(state)),
    territoriesOwned: territoriesOwnedByPlayer(state),
    atWarCount: atWarCount(state),
    avgSatisfaction: Math.round(avgSatisfaction(r) * 10) / 10,
    grainRatio: r.grainRatio !== undefined ? Math.round(r.grainRatio * 100) / 100 : null,
    warsWon: state.stats.warsWon,
    warsLost: state.stats.warsLost,
    generations: state.stats.generations,
    activeThreads: getAllStoryThreads ? getAllStoryThreads(state).filter(t => t.status !== "RESOLVED" && t.status !== "EXPIRED" && t.status !== "DORMANT").length : null,
    vassalCount: Object.keys(state.vassals || {}).length,
    gameOver: state.gameOver,
  };
}

// ---------- Campaign runner ----------
// options: { seed, startRegion, years (default 100), yearlyHardCap }
function runCampaign(agent, options) {
  options = options || {};
  const seed = options.seed !== undefined ? options.seed : 1;
  const years = options.years || 100;
  const state = newGame({ seed: seed, startRegion: options.startRegion || "player", dynastyName: options.dynastyName });
  const ctx = {
    agentId: agent.id,
    seed: seed,
    state: state,
    rng: makeAgentRng(agent.id + ":" + seed + ":" + AGENT_POLICY_VERSION),
    decisionLog: [],
    memory: {}, // free-form scratch space an archetype may use across years (e.g. min-maxer experiment tracking)
  };
  if (agent.init) agent.init(ctx);

  const yearSnapshots = [];
  let crashed = null;
  try {
    for (let y = 0; y < years; y++) {
      for (let m = 0; m < 12; m++) {
        if (state.gameOver) break;
        if (agent.decideMonth) agent.decideMonth(ctx);
        const res = advanceMonth(state);
        resolvePendingQueue(ctx, agent);
        if (state.gameOver) break;
      }
      yearSnapshots.push(snapshotYear(state));
      if (state.gameOver) break;
    }
  } catch (e) {
    crashed = { message: e.message, stack: String(e.stack || "").split("\n").slice(0, 6).join(" | ") };
  }

  return {
    agentId: agent.id,
    seed: seed,
    policyVersion: AGENT_POLICY_VERSION,
    startRegion: options.startRegion || "player",
    yearsRequested: years,
    yearsSimulated: yearSnapshots.length,
    crashed: crashed,
    decisionLog: ctx.decisionLog,
    yearSnapshots: yearSnapshots,
    finalState: crashed ? null : summarizeFinalState(state),
  };
}

function summarizeFinalState(state) {
  const ruler = state.characters[state.rulerId];
  return {
    year: state.year,
    gameOver: state.gameOver,
    titleIndex: state.titleIndex,
    titleName: TITLES[state.titleIndex] ? TITLES[state.titleIndex].name : null,
    treasury: Math.round(state.treasury),
    debt: Math.round(state.debt),
    prestige: state.prestige,
    legitimacy: state.legitimacy,
    totalPopulation: Object.values(state.regions.player.population).reduce((s, g) => s + g.count, 0),
    landHectares: Math.round(state.regions.player.land || 0),
    territoriesOwned: territoriesOwnedByPlayer(state),
    vassalCount: Object.keys(state.vassals || {}).length,
    warsWon: state.stats.warsWon,
    warsLost: state.stats.warsLost,
    generations: state.stats.generations,
    rulerAlive: ruler ? ruler.alive : null,
    dynastyChronicleLength: (state.chronicle || []).length,
  };
}
