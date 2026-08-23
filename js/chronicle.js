// ============================================================
// CHRONICLE 2.0 — Phase 7 "Narrative Calibration & Chronicle 2.0": trennt
// den bestehenden, vollständigen Chronik-String (`state.chronicle`, bleibt
// UNVERÄNDERT bestehen) konzeptionell in zwei Ebenen (§Punkt 15-17):
//
//   WORLD LOG        = `state.chronicle` selbst (Wetter, Routine, alles).
//   DYNASTY CHRONICLE = computeDynastyChronicle() — eine streng selektierte,
//                        strukturierte Sicht NUR auf tatsächlich bedeutende
//                        Ereignisse.
//
// Bewusste Architekturentscheidung: die Dynasty Chronicle wird NICHT als
// eigener, inkrementell gepflegter State-Zweig aufgebaut (das hätte 50+
// bestehende addChronicle()-Aufrufstellen in praktisch jeder Datei
// angefasst — ein Umbau-Risiko weit über den Rahmen dieser Kalibrierungs-
// Phase hinaus). Stattdessen wird sie ON DEMAND aus bereits vorhandenen,
// strukturierten Quellen ABGELEITET: World Memory (state.memories.byId)
// + Story Thread Resolutions (Phase 6). Praktisch jedes bedeutende
// Ereignis erzeugt bereits eine Memory (Geburt, Tod, Heirat, Titel, Krieg,
// Frieden, Wahl, …) — reines Wetter/Routine erzeugt dagegen NIE eine
// Memory, wodurch Regel §18 ("normales Wetter gehört nicht in die Dynasty
// Chronicle") automatisch aus der bestehenden Architektur folgt, ohne
// Text parsen zu müssen. §68 (Wetter MIT echten Folgen darf Teil der
// Geschichte sein) ist ebenso automatisch erfüllt: eine echte Hungerkrise
// erzeugt bereits eine FAMINE-Memory, unabhängig vom Wettertext selbst.
// ============================================================

// §Punkt 20/21: unabhängig vom berechneten Score IMMER chronikwürdig.
const ALWAYS_CHRONICLE_MEMORY_TYPES = new Set([
  "RULER_DIED", "SUCCESSION", "HEIR_BORN", "TITLE_GAINED",
  "WAR_DECLARED", "PEACE_SIGNED", "DYNASTY_ENDED",
]);

function chronicleCategoryForMemoryType(type) {
  const cfg = MEMORY_TYPES[type];
  if (!cfg) return "SONSTIGES";
  if (cfg.tags.includes("dynasty")) return "DYNASTIE";
  if (cfg.tags.includes("war")) return "KRIEG";
  if (cfg.tags.includes("famine") || cfg.tags.includes("disaster")) return "KRISE";
  if (cfg.tags.includes("politics")) return "POLITIK";
  if (cfg.tags.includes("diplomacy")) return "DIPLOMATIE";
  if (cfg.tags.includes("office") || cfg.tags.includes("hof")) return "HOF";
  if (cfg.tags.includes("story")) return "GESCHICHTE";
  return "SONSTIGES";
}

// §Punkt 19: SCORED CHRONICLE — additiv, nachvollziehbar (§Punkt 22 "keine
// Blackbox"), nutzt CONFIG.chronicle statt verstreuter Magic Numbers.
function computeChronicleScoreBreakdown(state, memory) {
  const cfg = CONFIG.chronicle;
  const components = [{ label: "Memory-Bedeutsamkeit", value: memory.importance }];
  let total = memory.importance;
  const add = (label, value) => { if (value) { components.push({ label, value }); total += value; } };

  const rulerInvolved = memory.actorIds.includes(state.rulerId) || memory.targetIds.includes(state.rulerId);
  add("Herrscher beteiligt", rulerInvolved ? cfg.rulerInvolvedBonus : 0);

  const ruler = state.characters[state.rulerId];
  const heirInvolved = ruler && (memory.actorIds.some(id => ruler.childrenIds.includes(id)) || memory.targetIds.some(id => ruler.childrenIds.includes(id)));
  add("Thronfolger beteiligt", heirInvolved ? cfg.heirInvolvedBonus : 0);

  const thread = getAllStoryThreads(state).find(t => t.memoryIds.includes(memory.id));
  if (thread) add(`Teil des Threads "${thread.title}" (Importance ${thread.importance})`, Math.round(thread.importance * cfg.threadLinkBonusFactor));

  return { components, total: Math.round(total) };
}

function isChronicleWorthy(state, memory) {
  const cfg = CONFIG.chronicle;
  const always = ALWAYS_CHRONICLE_MEMORY_TYPES.has(memory.type);
  const breakdown = computeChronicleScoreBreakdown(state, memory);
  const scored = breakdown.total >= cfg.scoredThreshold;
  return { always, score: breakdown.total, scoreBreakdown: breakdown.components, scored, worthy: always || scored };
}

// §Punkt 87/88: Dedup — eine Memory, die bereits Teil einer bedeutenden,
// abgeschlossenen Thread-Geschichte ist, tritt NICHT zusätzlich einzeln
// auf (die Thread-Zusammenfassung hat Vorrang), außer sie ist selbst
// ALWAYS-CHRONICLE-würdig (ein Herrschertod bleibt sichtbar, auch wenn er
// zufällig Teil eines Threads war).
function computeDynastyChronicle(state) {
  const threads = getAllStoryThreads(state);
  const summarizedMemoryIds = new Set();
  for (const t of threads) {
    if ((t.status === "RESOLVED" || t.status === "EXPIRED") && t.importance >= CONFIG.chronicle.threadSummaryThreshold) {
      for (const mid of t.memoryIds) summarizedMemoryIds.add(mid);
    }
  }

  const entries = [];
  let nextId = 1;
  for (const mem of allMemories(state)) {
    const info = isChronicleWorthy(state, mem);
    if (!info.worthy) continue;
    if (summarizedMemoryIds.has(mem.id) && !ALWAYS_CHRONICLE_MEMORY_TYPES.has(mem.type)) continue;
    const thread = threads.find(t => t.memoryIds.includes(mem.id));
    entries.push({
      id: "ce" + nextId++, year: mem.year, category: chronicleCategoryForMemoryType(mem.type),
      importance: info.score, title: mem.type, text: mem.description || mem.type,
      characterIds: mem.actorIds.concat(mem.targetIds), regionIds: mem.regionIds.slice(),
      memoryIds: [mem.id], chainId: null, threadId: thread ? thread.id : null,
    });
  }

  for (const t of threads) {
    if ((t.status === "RESOLVED" || t.status === "EXPIRED") && t.importance >= CONFIG.chronicle.threadSummaryThreshold) {
      const endYear = t.history.length ? t.history[t.history.length - 1].year : t.startedYear;
      entries.push({
        id: "ce" + nextId++, year: endYear, category: "GESCHICHTE",
        importance: t.importance, title: t.title, text: summarizeStoryThread(t),
        characterIds: t.actorIds.slice(), regionIds: t.regionIds.slice(),
        memoryIds: t.memoryIds.slice(), chainId: null, threadId: t.id,
      });
    }
  }

  entries.sort((a, b) => a.year - b.year);
  return entries;
}

// ---------- Ruler Eras (§Punkt 28/29) ----------
// Rekonstruiert die Herrscherfolge ausschließlich aus bereits vorhandenen
// SUCCESSION-Memories — kein zusätzlicher persistenter State nötig.
function getRulerEras(state) {
  const successions = getMemoriesByType(state, "SUCCESSION").sort((a, b) => a.year - b.year);
  const gameStartYear = 1500;
  if (successions.length === 0) return [{ rulerId: state.rulerId, startYear: gameStartYear, endYear: null }];
  const eras = [];
  let cursorYear = gameStartYear;
  let cursorRulerId = successions[0].actorIds[0];
  for (const s of successions) {
    eras.push({ rulerId: cursorRulerId, startYear: cursorYear, endYear: s.year });
    cursorYear = s.year;
    cursorRulerId = s.targetIds[0];
  }
  eras.push({ rulerId: cursorRulerId, startYear: cursorYear, endYear: null });
  return eras;
}

function getChronicleForRuler(state, rulerId) {
  const era = getRulerEras(state).find(e => e.rulerId === rulerId);
  if (!era) return [];
  return computeDynastyChronicle(state).filter(e => e.year >= era.startYear && (era.endYear === null || e.year <= era.endYear));
}

// §Punkt 74: Snapshot beim Regierungsantritt — Grundlage für einen echten
// Vorher/Nachher-Vergleich ohne erfundene Werte.
function snapshotRulerEraStart(state, rulerId) {
  const r = state.regions.player;
  const totalPop = Object.values(r.population).reduce((s, g) => s + g.count, 0);
  state.rulerEraSnapshots[rulerId] = { year: state.year, population: totalPop, treasury: state.treasury, prestige: state.prestige, titleIndex: state.titleIndex };
}

// ---------- Herrscherbiografie / Regierungsabschluss (§Punkt 30/31/72-75) ----------
// §Punkt 75: fehlt ein Vorher-Wert (Altspielstand ohne Snapshot), wird er
// NICHT erfunden — das entsprechende Feld bleibt schlicht `null`.
function buildRulerBiography(state, rulerId) {
  const c = state.characters[rulerId];
  if (!c) return null;
  const eras = getRulerEras(state);
  const idx = eras.findIndex(e => e.rulerId === rulerId);
  if (idx === -1) return null;
  const era = eras[idx];
  const nextEra = eras[idx + 1];
  const startSnap = state.rulerEraSnapshots[rulerId] || null;
  const isCurrent = !nextEra;
  const r = state.regions.player;
  const currentPop = Object.values(r.population).reduce((s, g) => s + g.count, 0);
  // Das Ende von A ist derselbe Zeitpunkt wie der Start von B (Nachfolge
  // geschieht ohne Zeitversatz) — daher liefert Bs Start-Snapshot exakt
  // die End-Werte von A, ohne eine zweite Snapshot-Quelle zu benötigen.
  const endSnap = nextEra ? state.rulerEraSnapshots[nextEra.rulerId] : (isCurrent ? { population: currentPop, treasury: state.treasury, prestige: state.prestige, titleIndex: state.titleIndex } : null);

  const entries = getChronicleForRuler(state, rulerId);
  return {
    rulerId, name: `${c.name} ${c.surname || ""}`.trim(),
    alive: c.alive,
    reignStart: era.startYear, reignEnd: era.endYear,
    reignYears: era.endYear !== null ? era.endYear - era.startYear : state.year - era.startYear,
    highlights: entries.map(e => ({ year: e.year, text: e.text })),
    populationStart: startSnap ? startSnap.population : null,
    populationEnd: endSnap ? endSnap.population : null,
    treasuryStart: startSnap ? Math.round(startSnap.treasury) : null,
    treasuryEnd: endSnap ? Math.round(endSnap.treasury) : null,
    titleStart: startSnap ? TITLES[startSnap.titleIndex].name : null,
    titleEnd: endSnap ? TITLES[endSnap.titleIndex].name : null,
  };
}

// §Punkt 72/73: templatebasierte Textzusammenfassung einer Regentschaft.
function formatRulerBiography(bio) {
  if (!bio) return "";
  const lines = [];
  lines.push(bio.name.toUpperCase());
  lines.push(`Regierte ${bio.reignStart}–${bio.reignEnd !== null ? bio.reignEnd : "heute"}`);
  lines.push(`${bio.reignYears} Regierungsjahre`);
  if (bio.highlights.length) {
    lines.push("");
    lines.push("Während seiner/ihrer Herrschaft:");
    for (const h of bio.highlights) lines.push(`• (${h.year}) ${h.text}`);
  }
  if (bio.populationStart !== null && bio.populationEnd !== null) {
    lines.push("");
    lines.push(`Bevölkerung: ${bio.populationStart} → ${bio.populationEnd}`);
  }
  if (bio.treasuryStart !== null && bio.treasuryEnd !== null) {
    lines.push(`Staatskasse: ${bio.treasuryStart} → ${bio.treasuryEnd} Taler`);
  }
  return lines.join("\n");
}

// ---------- Dynasty Milestones (§Punkt 34/35) ----------
function computeDynastyMilestones(state) {
  const milestones = [];
  const titleMemories = getMemoriesByType(state, "TITLE_GAINED").sort((a, b) => a.year - b.year);
  const seenTitles = new Set();
  for (const m of titleMemories) {
    const titleId = m.metadata && m.metadata.titleId;
    if (!titleId || seenTitles.has(titleId)) continue;
    seenTitles.add(titleId);
    milestones.push({ type: "TITLE_" + titleId.toUpperCase(), year: m.year, text: m.description });
  }
  if (state.stats.maxPopulation) milestones.push({ type: "MAX_POPULATION", value: state.stats.maxPopulation, text: `Höchster Bevölkerungsstand: ${state.stats.maxPopulation}` });
  if (state.stats.maxTreasury) milestones.push({ type: "MAX_TREASURY", value: Math.round(state.stats.maxTreasury), text: `Höchste Staatskasse: ${Math.round(state.stats.maxTreasury)} Taler` });
  if (state.stats.maxLand) milestones.push({ type: "MAX_LAND", value: Math.round(state.stats.maxLand), text: `Größtes Territorium: ${Math.round(state.stats.maxLand)} Hektar` });

  const eras = getRulerEras(state);
  let longest = null;
  for (const e of eras) {
    const years = (e.endYear !== null ? e.endYear : state.year) - e.startYear;
    if (!longest || years > longest.years) longest = { rulerId: e.rulerId, years };
  }
  if (longest && state.characters[longest.rulerId]) {
    const c = state.characters[longest.rulerId];
    milestones.push({ type: "LONGEST_REIGN", rulerId: longest.rulerId, value: longest.years, text: `Längste Regentschaft: ${c.name} ${c.surname || ""} (${longest.years} Jahre)`.replace(/\s+/g, " ") });
  }
  return milestones;
}

// ---------- Dynasty Summary (§Punkt 77-79) ----------
function computeDynastySummary(state) {
  const eras = getRulerEras(state);
  const threads = getAllStoryThreads(state);
  const concluded = threads.filter(t => t.status === "RESOLVED" || t.status === "EXPIRED");
  const byImportance = (a, b) => b.importance - a.importance;

  const biggestCrisis = concluded.slice().sort(byImportance)[0] || null;
  const mostSignificantWar = threads.filter(t => t.type === "FOREIGN_CONFLICT").sort(byImportance)[0] || null;
  const mostImportantRival = threads.filter(t => t.type === "PERSONAL_RIVALRY" || t.type === "SUCCESSION_CONFLICT").sort(byImportance)[0] || null;
  const marriageThreads = threads.filter(t => t.type === "DYNASTIC_ALLIANCE" && t.status === "RESOLVED" && t.resolution && t.resolution.type === "MARRIED");
  const longestReign = computeDynastyMilestones(state).find(m => m.type === "LONGEST_REIGN") || null;

  return {
    rulerCount: eras.length,
    generations: state.stats.generations,
    longestReign,
    biggestCrisis: biggestCrisis ? { title: biggestCrisis.title, importance: biggestCrisis.importance, resolution: biggestCrisis.resolution } : null,
    mostSignificantWar: mostSignificantWar ? { title: mostSignificantWar.title, importance: mostSignificantWar.importance, resolution: mostSignificantWar.resolution } : null,
    mostImportantRivalry: mostImportantRival ? { title: mostImportantRival.title, importance: mostImportantRival.importance, resolution: mostImportantRival.resolution } : null,
    importantMarriages: marriageThreads.length,
    highestTitleIndex: state.stats.highestTitleIndex,
    highestTitleName: TITLES[state.stats.highestTitleIndex] ? TITLES[state.stats.highestTitleIndex].name : null,
    maxPopulation: state.stats.maxPopulation,
    maxTreasury: Math.round(state.stats.maxTreasury),
    endedByNoHeir: state.gameOver === "no_heir",
  };
}

// ---------- Debug (§Punkt 56-58) ----------
function explainChronicleCandidate(state, memoryId) {
  const memory = state.memories.byId[memoryId];
  if (!memory) return null;
  const info = isChronicleWorthy(state, memory);
  return { memory, always: info.always, score: info.score, scoreBreakdown: info.scoreBreakdown, worthy: info.worthy };
}
