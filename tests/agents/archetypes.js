// ============================================================
// PHASE 9 — Player Archetypes
// ============================================================
// Test infrastructure only (see engine.js header). 10 archetypes from the
// master prompt (§8-17) + one "Anfänger" (§18) + one zero-action
// "passive" baseline (§28, mirrors the existing economy_test.js/
// ai_vs_ai_test.js passive-simulation convention) for comparison.
//
// Each agent is a plain object: { id, namePool, eventPrefs(ctx), decideMonth(ctx) }.
// decideMonth is called once per month, BEFORE that month's advanceMonth()
// — i.e. it sees exactly the state a real player would see before clicking
// "advance". eventPrefs(ctx) is called each time a pendingEvent/chain
// decision needs resolving; it may read ctx.state to react to context
// (e.g. Min-Maxer changes its bias by campaign phase) but must remain a
// pure function of state (no rnd()).

const NAME_POOL_DEFAULT = ["Friedrich", "Anna", "Wilhelm", "Elisabeth", "Konrad", "Agnes", "Ludwig", "Mathilde"];

function makeYearlyOnce(ctx, key, fn) {
  if (ctx.memory[key] === ctx.state.year) return;
  ctx.memory[key] = ctx.state.year;
  fn();
}

const AGENTS = {};

// ---------- 0. PASSIVE BASELINE (no player actions at all, §28) ----------
AGENTS.passive = {
  id: "passive",
  namePool: NAME_POOL_DEFAULT,
  eventPrefs: () => ({ aggressionBias: -1, costSensitivity: 0, reasonLabel: "passive baseline (FIRST_OPTION-equivalent)" }),
  decideMonth: function () {},
};

// ---------- 1. DER VERWALTER (Administrator) ----------
AGENTS.verwalter = {
  id: "verwalter",
  namePool: NAME_POOL_DEFAULT,
  eventPrefs: () => ({ aggressionBias: -0.6, costSensitivity: 0.3, reasonLabel: "stability-first, avoid costly harsh options", expectedGoal: "protect satisfaction and treasury" }),
  decideMonth: function (ctx) {
    manageTreasuryHealth(ctx, { minBuffer: 400, maxDebt: 5000, reason: "conservative treasury management" });
    makeYearlyOnce(ctx, "annual_verwalter", () => {
      considerTax(ctx, 0.15, "moderate, sustainable tax rate");
      considerGovernance(ctx, 30, "lenient governance to protect satisfaction");
      manageAdvisors(ctx, ["schatzmeister", "geistlicher", "spionagemeister"], 400, "administrative stability");
      considerInfrastructure(ctx, 600, "steady infrastructure growth");
    });
    tradeSurplusGoods(ctx, 400, "avoid waste, ensure food security");
    recruitPreferred(ctx, ["pikeniere", "miliz"], 0.15, 400, "minimal defensive garrison only", "deterrence, not conquest", 80);
    warCampaign(ctx, { minBuffer: 400, allowDeclareWar: false, allowPeace: true, peaceAfterYears: 3, reason: "defensive only" });
  },
};

// ---------- 2. DER KAUFMANN (Merchant) ----------
AGENTS.kaufmann = {
  id: "kaufmann",
  namePool: NAME_POOL_DEFAULT,
  eventPrefs: () => ({ aggressionBias: -0.2, costSensitivity: 0.7, reasonLabel: "protect trade margins, minimize cost", expectedGoal: "wealth accumulation" }),
  decideMonth: function (ctx) {
    manageTreasuryHealth(ctx, { minBuffer: 300, maxDebt: 5500, reason: "keep trading capital available" });
    makeYearlyOnce(ctx, "annual_kaufmann", () => {
      considerTax(ctx, 0.12, "low tax to favor merchants");
      considerGovernance(ctx, 60, "trade-friendly governance");
      manageAdvisors(ctx, ["handelsberater", "schatzmeister", "diplomat"], 300, "maximize trade/tax yield");
    });
    tradeSurplusGoods(ctx, 300, "sell surplus, buy grain shortages");
    regionalArbitrageScan(ctx, 0.10, 300, "cross-region price arbitrage");
    recruitPreferred(ctx, ["pikeniere", "miliz"], 0.08, 500, "protect trade routes, no expansion", "defense of commerce", 60);
    warCampaign(ctx, { minBuffer: 500, allowDeclareWar: false, allowPeace: true, peaceAfterYears: 2, reason: "war disrupts trade" });
  },
};

// ---------- 3. DER KRIEGSHERR (Warlord) ----------
AGENTS.kriegsherr = {
  id: "kriegsherr",
  namePool: NAME_POOL_DEFAULT,
  eventPrefs: () => ({ aggressionBias: 0.8, costSensitivity: 0.1, reasonLabel: "assert dominance, accept cost", expectedGoal: "military prestige" }),
  decideMonth: function (ctx) {
    manageTreasuryHealth(ctx, { minBuffer: 150, maxDebt: 8000, reason: "war chest, tolerate debt for army" });
    makeYearlyOnce(ctx, "annual_kriegsherr", () => {
      considerTax(ctx, 0.20, "high tax funds the army");
      considerGovernance(ctx, 70, "martial governance");
      manageAdvisors(ctx, ["marschall", "schatzmeister", "spionagemeister"], 150, "maximize army strength");
    });
    recruitPreferred(ctx, ["schwere_kavallerie", "ritter", "pikeniere"], 0.6, 150, "build the strongest affordable army", "overwhelming force");
    warCampaign(ctx, {
      minBuffer: 150, allowDeclareWar: true, opportunistic: true, strengthMargin: 1.1,
      attackMargin: 0.6, allowPeace: true, peaceAfterYears: 8, formation: "aggressiv", tactic: "frontalangriff",
      reason: "expansion via conquest",
    });
  },
};

// ---------- 4. DER DIPLOMAT ----------
AGENTS.diplomat = {
  id: "diplomat",
  namePool: NAME_POOL_DEFAULT,
  eventPrefs: () => ({ aggressionBias: -0.8, costSensitivity: 0.3, reasonLabel: "seek peaceful resolution", expectedGoal: "relationship preservation" }),
  decideMonth: function (ctx) {
    manageTreasuryHealth(ctx, { minBuffer: 300, maxDebt: 5000, reason: "diplomatic gifts require liquidity" });
    makeYearlyOnce(ctx, "annual_diplomat", () => {
      considerTax(ctx, 0.15, "balanced tax");
      considerGovernance(ctx, 50, "neutral governance");
      manageAdvisors(ctx, ["diplomat", "geistlicher", "schatzmeister"], 300, "maximize diplomatic reach");
    });
    maintainDiplomacy(ctx, ["gift", "nonaggr", "trade", "alliance", "guarantee"], 60, 300, "build durable alliances");
    considerBuildKathedrale(ctx, 300, "the crown requires a kathedrale first");
    handleElection(ctx, CONFIG.election.bribeCost, 300, "diplomatic path to the crown");
    recruitPreferred(ctx, ["pikeniere"], 0.05, 500, "token defense only", "credibility, not aggression", 40);
    warCampaign(ctx, { minBuffer: 500, allowDeclareWar: false, allowPeace: true, peaceAfterYears: 1, reason: "war is a diplomatic failure" });
  },
};

// ---------- 5. DER DYNAST ----------
AGENTS.dynast = {
  id: "dynast",
  namePool: ["Heinrich", "Adelheid", "Sigismund", "Kunigunde", "Otto", "Gertrud", "Albrecht", "Irmgard"],
  eventPrefs: () => ({ aggressionBias: -0.4, costSensitivity: 0.4, reasonLabel: "preserve family harmony and succession", expectedGoal: "dynastic stability" }),
  decideMonth: function (ctx) {
    manageTreasuryHealth(ctx, { minBuffer: 350, maxDebt: 5000, reason: "court stability requires solvency" });
    makeYearlyOnce(ctx, "annual_dynast", () => {
      considerTax(ctx, 0.15, "moderate tax, avoid unrest that threatens the throne");
      considerGovernance(ctx, 45, "balanced court governance");
      manageAdvisors(ctx, ["geistlicher", "schatzmeister", "diplomat"], 350, "court stability and loyalty");
    });
    // Distinctive to this archetype: the diplomatic 'marriage' treaty (dynastic bond,
    // §3 of the catalog) is prioritized ahead of alliance-building for its own sake.
    maintainDiplomacy(ctx, ["gift", "marriage", "hostage", "nonaggr"], 50, 350, "bind neighboring houses through marriage and hostages");
    tradeSurplusGoods(ctx, 350, "steady household finances");
    recruitPreferred(ctx, ["pikeniere", "miliz"], 0.1, 400, "household guard only", "protect the dynasty, not conquest", 60);
    warCampaign(ctx, { minBuffer: 400, allowDeclareWar: false, allowPeace: true, peaceAfterYears: 2, reason: "war endangers heirs" });
  },
};

// ---------- 6. DER MACHTPOLITIKER (Power Politician) ----------
AGENTS.machtpolitiker = {
  id: "machtpolitiker",
  namePool: NAME_POOL_DEFAULT,
  eventPrefs: () => ({ aggressionBias: 0.3, costSensitivity: 0.2, reasonLabel: "protect prestige and legitimacy", expectedGoal: "title progression" }),
  decideMonth: function (ctx) {
    manageTreasuryHealth(ctx, { minBuffer: 300, maxDebt: 5500, reason: "prestige projects need funds" });
    makeYearlyOnce(ctx, "annual_machtpolitiker", () => {
      considerTax(ctx, 0.18, "fund prestige projects");
      considerGovernance(ctx, 55, "balanced, image-conscious governance");
      manageAdvisors(ctx, ["diplomat", "schatzmeister", "marschall"], 300, "maximize prestige/legitimacy levers");
      considerInfrastructure(ctx, 500, "visible prosperity");
    });
    maintainDiplomacy(ctx, ["gift", "nonaggr", "alliance", "guarantee"], 55, 300, "diplomatic standing supports the crown");
    considerBuildKathedrale(ctx, 300, "prestige building and Kaiserwahl prerequisite");
    handleElection(ctx, CONFIG.election.bribeCost, 300, "the crown is the ultimate prestige goal");
    recruitPreferred(ctx, ["ritter", "pikeniere"], 0.25, 300, "credible but selective military", "power projection", 200);
    warCampaign(ctx, {
      minBuffer: 300, allowDeclareWar: true, opportunistic: false, hostileRelationThreshold: 10,
      strengthMargin: 1.5, attackMargin: 1.0, allowPeace: true, peaceAfterYears: 4,
      formation: "defensiv", tactic: "halten", reason: "selective, justified war only",
    });
  },
};

// ---------- 7. DER OPPORTUNIST ----------
AGENTS.opportunist = {
  id: "opportunist",
  namePool: NAME_POOL_DEFAULT,
  eventPrefs: function (ctx) {
    // No fixed moral stance (§14): bias drawn fresh from the agent's own
    // deterministic RNG each time, representing "whatever seems good right now".
    const bias = ctx.rng() * 2 - 1;
    return { aggressionBias: bias, costSensitivity: ctx.rng(), reasonLabel: "reassessed every decision, no fixed doctrine", expectedGoal: "maximize immediate advantage" };
  },
  decideMonth: function (ctx) {
    const state = ctx.state;
    manageTreasuryHealth(ctx, { minBuffer: 250, maxDebt: 5500, reason: "opportunistic liquidity" });
    makeYearlyOnce(ctx, "annual_opportunist", () => {
      // Re-derive priorities every year from current state rather than a fixed plan.
      const strongMilitarily = armyStrength(state) > neighborIds(state).reduce((s, id) => s + estimateAiStrength(state.regions[id]), 0) / 3;
      considerTax(ctx, strongMilitarily ? 0.20 : 0.13, "tax follows current strength, not a fixed doctrine");
      considerGovernance(ctx, 50, "no fixed governance philosophy");
      manageAdvisors(ctx, strongMilitarily ? ["marschall", "schatzmeister", "diplomat"] : ["handelsberater", "schatzmeister", "diplomat"], 250, "whichever office currently pays off most");
    });
    tradeSurplusGoods(ctx, 250, "opportunistic liquidation of surplus");
    if (ctx.rng() < 0.5) regionalArbitrageScan(ctx, 0.12, 250, "chase the best margin this month");
    considerBuildKathedrale(ctx, 250, "the crown is worth grabbing if it becomes reachable");
    recruitPreferred(ctx, ["schwere_kavallerie", "pikeniere", "miliz"], 0.3, 250, "whichever unit currently looks strongest", "flexible power", 400);
    warCampaign(ctx, {
      minBuffer: 250, allowDeclareWar: true, opportunistic: true, strengthMargin: 1.2,
      attackMargin: 0.75, allowPeace: true, peaceAfterYears: 5, reason: "war when the numbers favor it, peace when they don't",
    });
    handleElection(ctx, CONFIG.election.bribeCost, 250, "crown is worth grabbing if affordable");
  },
};

// ---------- 8. DER HARDLINER ----------
AGENTS.hardliner = {
  id: "hardliner",
  namePool: NAME_POOL_DEFAULT,
  eventPrefs: () => ({ aggressionBias: 1.0, costSensitivity: 0.0, reasonLabel: "HARDLINE policy: always the harshest option", expectedGoal: "maximum immediate leverage" }),
  decideMonth: function (ctx) {
    manageTreasuryHealth(ctx, { minBuffer: 150, maxDebt: 7000, reason: "hardline treasury tolerance" });
    makeYearlyOnce(ctx, "annual_hardliner", () => {
      considerTax(ctx, 0.24, "extract maximum revenue");
      considerGovernance(ctx, 85, "authoritarian governance");
      manageAdvisors(ctx, ["marschall", "spionagemeister", "schatzmeister"], 150, "coercive statecraft");
    });
    // Deliberately skips gift-based relationship maintenance; prefers coercive levers.
    for (const aiId of neighborIds(ctx.state)) {
      if (ctx.state.warState[aiId]) continue;
      if (ctx.state.diplomacy[aiId].relation < 20) act(ctx, demandTerritory, [aiId], { category: "DIPLOMACY", action: "demand_territory", reason: "coerce weaker neighbors", meaningful: true });
    }
    recruitPreferred(ctx, ["schwere_kavallerie", "ritter", "pikeniere"], 0.55, 150, "overwhelming coercive force", "submission through strength");
    warCampaign(ctx, {
      minBuffer: 150, allowDeclareWar: true, opportunistic: true, strengthMargin: 1.0,
      attackMargin: 0.55, allowPeace: false, formation: "aggressiv", tactic: "frontalangriff",
      reason: "hardline: press every advantage",
    });
  },
};

// ---------- 9. DER VERSÖHNER (Conciliator) ----------
AGENTS.versoehner = {
  id: "versoehner",
  namePool: NAME_POOL_DEFAULT,
  eventPrefs: () => ({ aggressionBias: -1.0, costSensitivity: 0.5, reasonLabel: "CONCILIATORY policy: always the most generous option", expectedGoal: "stability and goodwill" }),
  decideMonth: function (ctx) {
    manageTreasuryHealth(ctx, { minBuffer: 350, maxDebt: 4500, reason: "conciliatory, low-risk finances" });
    makeYearlyOnce(ctx, "annual_versoehner", () => {
      considerTax(ctx, 0.13, "gentle taxation");
      considerGovernance(ctx, 25, "most lenient governance");
      manageAdvisors(ctx, ["geistlicher", "diplomat", "schatzmeister"], 350, "harmony and goodwill");
    });
    maintainDiplomacy(ctx, ["gift", "nonaggr", "trade", "alliance", "guarantee", "hostage"], 70, 350, "generosity toward every neighbor");
    tradeSurplusGoods(ctx, 350, "stable provisioning");
    recruitPreferred(ctx, ["pikeniere", "miliz"], 0.08, 450, "minimal, purely defensive", "never provoke", 50);
    warCampaign(ctx, { minBuffer: 450, allowDeclareWar: false, allowPeace: true, peaceAfterYears: 1, reason: "peace at nearly any cost" });
  },
};

// ---------- 10. DER MIN-MAXER ----------
// Systematically rotates through concrete exploit hypotheses across fixed
// year-phases of the SAME campaign (deterministic phase boundaries, not
// randomized) so its behavior stays reproducible while still "trying
// different strategies" as required by §17/§115/§152. Each phase's
// `reason` string names exactly which hypothesis is under test — this is
// what the "How To Break Kaiserreich" report section is built from.
const MINMAX_PHASES = [
  { from: 0, to: 20, name: "economic_extraction", tax: 0.30, gov: 75, units: ["pikeniere"], recruitShare: 0.2 },
  { from: 20, to: 40, name: "pikemen_cost_spam", tax: 0.20, gov: 60, units: ["pikeniere"], recruitShare: 0.7 },
  { from: 40, to: 60, name: "cavalry_pop_efficiency", tax: 0.20, gov: 60, units: ["schwere_kavallerie"], recruitShare: 0.7 },
  { from: 60, to: 80, name: "advisor_stacking", tax: 0.20, gov: 60, units: ["pikeniere"], recruitShare: 0.15 },
  { from: 80, to: 100, name: "kaiserwahl_bribery_rush", tax: 0.20, gov: 60, units: ["pikeniere"], recruitShare: 0.1 },
];
function minmaxPhaseFor(year0Based) {
  for (const p of MINMAX_PHASES) if (year0Based >= p.from && year0Based < p.to) return p;
  return MINMAX_PHASES[MINMAX_PHASES.length - 1];
}
AGENTS.minmaxer = {
  id: "minmaxer",
  namePool: NAME_POOL_DEFAULT,
  eventPrefs: function (ctx) {
    const yearsIn = ctx.state.year - 1500;
    const phase = minmaxPhaseFor(yearsIn);
    const bias = phase.name === "economic_extraction" || phase.name === "advisor_stacking" ? -0.5 : 0.5;
    return { aggressionBias: bias, costSensitivity: 0.8, reasonLabel: "min-max exploit test: " + phase.name };
  },
  decideMonth: function (ctx) {
    const yearsIn = ctx.state.year - 1500;
    const phase = minmaxPhaseFor(yearsIn);
    manageTreasuryHealth(ctx, { minBuffer: 100, maxDebt: 9000, reason: "min-max: minimal buffer, maximal deployment" });
    makeYearlyOnce(ctx, "annual_minmaxer", () => {
      considerTax(ctx, phase.tax, "exploit test: " + phase.name);
      considerGovernance(ctx, phase.gov, "exploit test: " + phase.name);
      if (phase.name === "advisor_stacking") {
        manageAdvisors(ctx, ["schatzmeister", "marschall", "diplomat", "handelsberater", "spionagemeister", "geistlicher"], 100, "exploit test: stack every office and upgrade aggressively");
      } else {
        manageAdvisors(ctx, ["schatzmeister"], 200, "exploit test: minimal overhead during " + phase.name);
      }
    });
    considerBuildKathedrale(ctx, 100, "exploit test: build the Kaiserwahl prerequisite early so the bribery-rush phase can actually trigger an election");
    if (phase.name === "kaiserwahl_bribery_rush") {
      handleElection(ctx, CONFIG.election.bribeCost, 100, "exploit test: rush the crown via bribery");
    }
    if (phase.name === "economic_extraction") {
      tradeSurplusGoods(ctx, 100, "exploit test: liquidate everything");
      regionalArbitrageScan(ctx, 0.05, 100, "exploit test: aggressive low-margin arbitrage volume");
    }
    recruitPreferred(ctx, phase.units, phase.recruitShare, 100, "exploit test: " + phase.name, "measure cost/strength or pop/strength efficiency at scale");
    warCampaign(ctx, {
      minBuffer: 100, allowDeclareWar: phase.name === "pikemen_cost_spam" || phase.name === "cavalry_pop_efficiency",
      opportunistic: true, strengthMargin: 1.0, attackMargin: 0.5, allowPeace: true, peaceAfterYears: 5,
      formation: "ausgewogen", tactic: "frontalangriff", reason: "exploit test: " + phase.name,
    });
  },
};

// ---------- ANFÄNGER (Beginner, §18, optional but included) ----------
AGENTS.anfaenger = {
  id: "anfaenger",
  namePool: NAME_POOL_DEFAULT,
  eventPrefs: () => ({ aggressionBias: -1, costSensitivity: 0, reasonLabel: "always picks the first/topmost option, like a first-time player", expectedGoal: "" }),
  decideMonth: function (ctx) {
    const state = ctx.state;
    const region = state.regions.player;
    // Reacts to visible red warnings only — no forward planning.
    if (state.treasury < 0) act(ctx, takeLoan, [Math.round(-state.treasury + 100)], { category: "ECONOMY", action: "take_loan", reason: "treasury went negative", meaningful: true });
    if (region.grainRatio !== undefined && region.grainRatio < 0.5 && state.treasury > 150) {
      act(ctx, buyGoodFromMarket, [region, "getreide", 50], { category: "TRADE", action: "buy_getreide", reason: "saw the food warning", meaningful: true });
    }
    makeYearlyOnce(ctx, "annual_anfaenger", () => {
      if (state.treasury > 1000 && !state.advisors.schatzmeister) {
        manageAdvisors(ctx, ["schatzmeister"], 500, "heard advisors help, tries one occasionally");
      }
    });
    // Never declares war; if forced to defend, resolvePendingQueue's default
    // handling (untouched formation/tactic assumptions) applies.
  },
};

const AGENT_LIST = ["passive", "verwalter", "kaufmann", "kriegsherr", "diplomat", "dynast", "machtpolitiker", "opportunist", "hardliner", "versoehner", "minmaxer", "anfaenger"];
