// ============================================================
// MEMORY — Phase 4 "World Memory": strukturierte, bedeutsame Erinnerungen
// statt nackter Beziehungszahlen. Erzeugt/liest ausschließlich
// `state.memories.byId`. KEIN Ersatz für die Chronik (menschenlesbare
// Erzählung, unverändert in index.html) — siehe memoryToChronicleCandidate()
// für die vorbereitete, aber noch nicht aktiv genutzte Brücke dorthin.
//
// Zentrale Designregel (§Punkt 2): nur BEDEUTSAME Ereignisse werden
// gespeichert. Normales Wetter, einzelne Preisänderungen usw. erzeugen
// keine Memory. Alle Aufrufer von recordWorldEvent() sind bewusst an
// konkrete, bereits bestehende Spielereignisse gebunden (Geburt, Heirat,
// Tod, Erbfolge, Amtsvergabe/-verlust, Bündnis, Krieg, Titel, Wahl,
// Rivalität, Hungersnot) — kein neuer, eigenständiger Zufallsgenerator.
//
// WICHTIG (§Punkt 53/54): Dieses Modul verbraucht KEIN `rnd()`. Es
// zeichnet bereits geschehene, deterministisch abgeleitete Ereignisse auf.
// ============================================================

// Zentraler Hook (§Punkt 23) — jede Memory-Erzeugung läuft hier durch.
// Deterministische ID (m1, m2, ...), keine Zufalls-IDs.
function recordWorldEvent(state, opts) {
  const typeCfg = MEMORY_TYPES[opts.type];
  if (!typeCfg) throw new Error("Unbekannter Memory-Typ: " + opts.type);
  const id = "m" + state.memories.nextId++;
  const memory = {
    id,
    type: opts.type,
    year: state.year,
    actorIds: opts.actorIds || [],
    targetIds: opts.targetIds || [],
    regionIds: opts.regionIds || [],
    importance: opts.importance !== undefined ? opts.importance : typeCfg.importance,
    emotionalWeight: opts.emotionalWeight !== undefined ? opts.emotionalWeight : 0,
    decayRate: opts.decayRate !== undefined ? opts.decayRate : typeCfg.decayRate,
    expiresYear: opts.expiresYear || null,
    tags: (opts.tags || []).concat(typeCfg.tags),
    metadata: opts.metadata || {},
    description: opts.description || "",
  };
  state.memories.byId[id] = memory;
  return memory;
}

// ---------- Effektive Wirkung (§Punkt 17/19/45/60/61) ----------
// Reine Funktion: liest state.year + Charakter-Traits, mutiert NICHTS
// ("keine Zeitreise" — Decay wird bei jedem Aufruf frisch berechnet,
// niemals im Memory-Objekt selbst gespeichert/verändert).
function computeEffectiveWeight(state, memory, characterId) {
  const yearsElapsed = Math.max(0, state.year - memory.year);
  let decayRate = memory.decayRate;
  const character = characterId ? state.characters[characterId] : null;
  if (character) {
    if (memory.emotionalWeight < 0) decayRate *= (1 + traitEffectSum(character, "memoryDecayModNegative"));
    else if (memory.emotionalWeight > 0) decayRate *= (1 + traitEffectSum(character, "memoryDecayModPositive"));
  }
  decayRate = clamp(decayRate, 0, 1);
  let weight = memory.emotionalWeight * Math.max(0, 1 - decayRate * yearsElapsed);
  if (character && memory.emotionalWeight < 0) {
    weight *= (1 + traitEffectSum(character, "memoryWeightAmplifierNegative"));
  }
  return Math.round(weight * 10) / 10; // eine Nachkommastelle, keine Scheinpräzision (§Punkt 83)
}

// ---------- Queries (§Punkt 15/16, bewusst einfache Funktionen statt einer Datenbank) ----------
function allMemories(state) { return Object.values(state.memories.byId); }

function getMemoriesForCharacter(state, characterId) {
  return allMemories(state).filter(m => m.actorIds.includes(characterId) || m.targetIds.includes(characterId));
}

function getMemoriesBetweenCharacters(state, aId, bId) {
  return allMemories(state).filter(m => {
    const participants = m.actorIds.concat(m.targetIds);
    return participants.includes(aId) && participants.includes(bId);
  });
}

function getMemoriesByType(state, type) {
  return allMemories(state).filter(m => m.type === type);
}

function getRecentMemories(state, years) {
  const since = state.year - years;
  return allMemories(state).filter(m => m.year >= since);
}

function getImportantMemories(state, minImportance) {
  return allMemories(state).filter(m => m.importance >= minImportance);
}

// §Punkt 76: Grundbaustein für spätere Event Chains.
function hasMemory(state, query) {
  const sinceYear = query.sinceYear !== undefined ? query.sinceYear : -Infinity;
  return allMemories(state).some(m => {
    if (query.type && m.type !== query.type) return false;
    if (query.actorId && !m.actorIds.includes(query.actorId)) return false;
    if (query.targetId && !m.targetIds.includes(query.targetId)) return false;
    if (m.year < sinceYear) return false;
    return true;
  });
}

// Für js/characters.js: welche Memories fließen in die Beziehung
// fromId -> toId ein? (§Punkt 27/28, ersetzt die alten, statischen
// Phase-3-Beziehungsereignisse — siehe computeRelationshipBreakdown()).
function getMemoriesForRelationship(state, fromId, toId) {
  return allMemories(state).filter(m => {
    const cfg = MEMORY_TYPES[m.type];
    if (!cfg || cfg.direction === "none") return false;
    if (cfg.direction === "target_to_actor") return m.targetIds.includes(fromId) && m.actorIds.includes(toId);
    if (cfg.direction === "symmetric") {
      const participants = m.actorIds.concat(m.targetIds);
      return participants.includes(fromId) && participants.includes(toId);
    }
    return false;
  });
}

// ---------- Aggregate für spätere Phasen (§Punkt 78, hier nur vorbereitet) ----------
function getNegativeMemoryPressure(state, characterId) {
  let sum = 0;
  for (const m of getMemoriesForCharacter(state, characterId)) {
    const w = computeEffectiveWeight(state, m, characterId);
    if (w < 0) sum += -w;
  }
  return Math.round(sum * 10) / 10;
}

function getDynastyMemoryPressure(state, houseName) {
  let sum = 0;
  for (const m of allMemories(state)) {
    const involvesHouse = [...m.actorIds, ...m.targetIds].some(id => state.characters[id] && state.characters[id].surname === houseName);
    if (!involvesHouse) continue;
    if (m.emotionalWeight < 0) sum += -m.emotionalWeight;
  }
  return Math.round(sum * 10) / 10;
}

function getRecentConflictMemories(state, years) {
  return getRecentMemories(state, years).filter(m => m.tags.includes("grievance") || m.tags.includes("betrayal") || m.tags.includes("rivalry") || m.tags.includes("war"));
}

// ---------- Major Character (§Punkt 84/85) ----------
// Zentrale Definition statt verstreuter Einzelprüfungen. "Fremder
// Herrscher" (§Punkt 85) fehlt bewusst als Kriterium: KI-Regionen besitzen
// aktuell keine individuell simulierten Herrscher-Charaktere (nur
// `region.commander`, ein reiner Militärposten) — kann erst geprüft
// werden, wenn eine spätere Phase das ergänzt.
function isMajorCharacter(state, characterId) {
  const c = state.characters[characterId];
  if (!c) return false;
  if (getImportantCharacterIds(state).includes(characterId)) return true;
  if (c.rivalIds.length > 0) return true;
  if (c.claims.some(cl => cl.strength === "strong" || cl.strength === "primary")) return true;
  return false;
}

// ---------- Chronik-Brücke (§Punkt 39/40/74, vorbereitet, nicht aktiv genutzt) ----------
// World Memory ist NICHT die Chronik. Diese Funktion liefert nur einen
// KANDIDATEN-Text, den eine spätere Phase (bedeutungsbasierte Chronik,
// siehe GAME_DESIGN.md) tatsächlich einspeisen könnte — sie schreibt
// nichts automatisch in state.chronicle.
function memoryToChronicleCandidate(memory) {
  if (memory.importance < 50 || !memory.description) return null;
  return `${memory.year}: ${memory.description}`;
}

// ---------- Hungersnot-Erkennung (§Punkt 2/64) ----------
// Läuft nach updatePopulation() (in processAllRegions(), advance-year.js) —
// liest nur das dort bereits berechnete r.lastPopBreakdown, verändert
// keine Bevölkerungsformel. Normales Wetter/normale Dürre erzeugt KEINE
// Memory — erst wenn der Hungertod-Anteil eine spürbare Schwelle
// überschreitet.
const FAMINE_DEATH_SHARE_THRESHOLD = 0.01; // 1% der Regionsbevölkerung an Hunger gestorben

function checkFamineMemory(state, regionId, region) {
  if (!region.lastPopBreakdown) return;
  let hungerDeaths = 0, totalPop = 0;
  for (const pid in region.population) totalPop += region.population[pid].count;
  for (const pid in region.lastPopBreakdown) hungerDeaths += -(region.lastPopBreakdown[pid].hungertote || 0);
  if (totalPop <= 0 || hungerDeaths / totalPop < FAMINE_DEATH_SHARE_THRESHOLD) return;
  recordWorldEvent(state, {
    type: "FAMINE",
    regionIds: [regionId],
    emotionalWeight: -Math.round(clamp(hungerDeaths / totalPop * 1000, 20, 90)),
    metadata: { hungerDeaths: Math.round(hungerDeaths), region: region.name },
    description: `Eine Hungerkrise in ${region.name} forderte etwa ${Math.round(hungerDeaths)} Menschenleben.`,
  });
}
