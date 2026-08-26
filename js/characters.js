// ============================================================
// CHARACTERS — Phase 3 "Character Core": Beziehungen, Loyalität,
// dynastische Ansprüche (Claims), Rivalitäten. Erweitert das bestehende
// Charaktermodell (state.characters, createCharacter() in data/gamedata.js)
// additiv — KEIN zweites paralleles Modell (§Phase-3-Punkt 2).
//
// Seit Phase 4 (World Memory): Beziehungsgründe kommen aus zwei Quellen —
// STRUKTURELLE Modifikatoren (Geschwister/Ehepartner/gleiches Haus/
// Charisma) werden jedes Jahr neu aus dem aktuellen Zustand berechnet
// (deterministisch, kein RNG), und EREIGNIS-Modifikatoren kommen jetzt aus
// `state.memories` statt aus früher (Phase 3) direkt auf dem Charakter
// gespeicherten Fixwerten — SINGLE SOURCE OF TRUTH (§Phase-4-Punkt 25/27),
// mit echtem Verfall über die Zeit (js/memory.js: computeEffectiveWeight()).
// Die alten, in Phase 3 eingeführten `addPersistentRelationshipModifier()`/
// `PERSISTENT_MODIFIER_SOURCES` sind damit entfallen — ersetzt durch
// Memory-Einträge (DENIED_OFFICE/PASSED_OVER_IN_SUCCESSION/RIVALRY_BEGAN),
// keine doppelte Zählung (§Punkt 26).
// ============================================================

// Berechnet, wie `fromId` über `toId` denkt — kombiniert frisch berechnete
// strukturelle Modifikatoren mit den aktuell noch wirksamen (verfallenen)
// Memory-Effekten, klammert auf -100..100. Schreibt NICHT in state — reiner
// Leseweg, siehe refreshRelationship() für die Stelle, die das Ergebnis
// tatsächlich zurück in relationships[] speichert.
function computeRelationshipBreakdown(state, fromId, toId) {
  if (fromId === toId) return { modifiers: [], total: 0 };
  const from = state.characters[fromId];
  const to = state.characters[toId];
  if (!from || !to) return { modifiers: [], total: 0 };

  const modifiers = [];
  if (from.parentId === toId || to.parentId === fromId) modifiers.push({ source: "eltern_kind", value: 15 });
  if (from.parentId && from.parentId === to.parentId) modifiers.push({ source: "geschwister", value: 15 });
  if (from.spouseId === toId) modifiers.push({ source: "ehepartner", value: 25 });
  if (from.surname && from.surname === to.surname) modifiers.push({ source: "gleiches_haus", value: 5 });
  if (from.advisorRole && toId === state.rulerId) modifiers.push({ source: "amt_innehat", value: 10 });
  const charismaBonus = traitEffectSum(to, "relationshipMod");
  if (charismaBonus) modifiers.push({ source: "charisma", value: charismaBonus });

  for (const memory of getMemoriesForRelationship(state, fromId, toId)) {
    const weight = computeEffectiveWeight(state, memory, fromId);
    if (weight !== 0) modifiers.push({ source: memory.type, value: weight, memoryId: memory.id, year: memory.year });
  }

  const total = clamp(modifiers.reduce((s, m) => s + m.value, 0), -100, 100);
  return { modifiers, total };
}

// Schreibt das Ergebnis von computeRelationshipBreakdown() zurück in
// character.relationships[targetId] (für Debug-UI/Kassenbuch-artige
// Aufschlüsselung und als Cache für computeLoyalty()).
function refreshRelationship(state, fromId, toId) {
  const from = state.characters[fromId];
  if (!from) return;
  const breakdown = computeRelationshipBreakdown(state, fromId, toId);
  from.relationships[toId] = breakdown;
}

// Nur für die wichtigen Charaktere (§Punkt 5/42: nicht jeden Einwohner) —
// Herrscher, Ehepartner, Kinder, Geschwister des Herrschers, aktuelle
// Berater. Historische (tote) Charaktere werden nicht mehr aktualisiert,
// bleiben aber für die Genealogie erhalten (§Punkt 41).
function getImportantCharacterIds(state) {
  const ids = new Set();
  const ruler = state.characters[state.rulerId];
  if (ruler) {
    ids.add(state.rulerId);
    if (ruler.spouseId) ids.add(ruler.spouseId);
    for (const cid of ruler.childrenIds) ids.add(cid);
    if (ruler.parentId) {
      for (const id in state.characters) {
        if (state.characters[id].parentId === ruler.parentId) ids.add(id);
      }
    }
  }
  for (const role in state.advisors) {
    if (state.advisors[role]) ids.add(state.advisors[role]);
  }
  return [...ids].filter(id => state.characters[id] && state.characters[id].alive);
}

// ---------- Loyalität (§Punkt 16/17: getrennt von "Beziehung") ----------
// "Beziehung": mag die Person den Herrscher? "Loyalität": bleibt sie ihm
// politisch treu? Ein Charakter kann eine gute Beziehung, aber wegen eines
// starken eigenen Anspruchs trotzdem niedrige Loyalität haben.
function computeLoyalty(state, characterId) {
  if (characterId === state.rulerId) return 100; // der Herrscher ist sich selbst treu
  const c = state.characters[characterId];
  if (!c) return 50;
  const rel = computeRelationshipBreakdown(state, characterId, state.rulerId);

  let loyalty = 50;
  loyalty += rel.total * 0.3;
  loyalty += traitEffectSum(c, "loyaltyMod");
  if (c.advisorRole) loyalty += 8;
  loyalty += (state.legitimacy - 50) * 0.1;

  const relevantClaim = c.claims.find(cl => cl.titleId === "player" && cl.strength !== "none");
  if (relevantClaim) {
    const claimBase = { weak: 4, strong: 12, primary: 20 }[relevantClaim.strength] || 0;
    const aggression = traitEffectSum(c, "claimAggression");
    loyalty -= claimBase + aggression * 0.5;
  }

  return Math.round(clamp(loyalty, 0, 100));
}

// ---------- Dynastische Ansprüche (§Punkt 18-20) ----------
// Vereinfacht auf den einzigen Titel, der im Spiel mechanisch existiert
// (die Nachfolge der eigenen Provinz, titleId "player") statt eines vollen
// Mehrtitel-Anspruchsgraphen — §Punkt 19: "Spielbarkeit ist wichtiger als
// perfektes mittelalterliches Erbrecht".
function setClaim(character, titleId, strength, reason) {
  const existing = character.claims.find(c => c.titleId === titleId);
  if (existing) { existing.strength = strength; existing.reason = reason; }
  else character.claims.push({ titleId, strength, reason, inheritedFrom: null });
}

// Läuft jährlich, rein deterministisch (kein RNG) — leitet Ansprüche direkt
// aus der aktuellen Familienstruktur ab. Ansprüche mit reason
// "succession_passed_over" (siehe handleSuccession() in
// population-dynasty.js) werden NICHT wieder auf "weak" heruntergestuft,
// da sie ein historisches, dauerhaftes Ereignis abbilden.
function updateClaims(state) {
  const ruler = state.characters[state.rulerId];
  if (!ruler) return;
  const livingChildren = ruler.childrenIds
    .map(id => state.characters[id])
    .filter(c => c && c.alive)
    .sort((a, b) => b.age - a.age);
  livingChildren.forEach((c, idx) => {
    setClaim(c, "player", idx === 0 ? "primary" : "strong", idx === 0 ? "eldest_child" : "child");
  });
  if (ruler.parentId) {
    for (const id in state.characters) {
      const sib = state.characters[id];
      if (!sib.alive || sib === ruler || sib.parentId !== ruler.parentId) continue;
      const existing = sib.claims.find(cl => cl.titleId === "player");
      if (!existing) setClaim(sib, "player", "weak", "sibling_of_ruler");
    }
  }
}

// ---------- Rivalitäten (§Punkt 31-34) ----------
// Bewusst selten (§Punkt 33): nur bei klaren, engen Zuständen — schlechte
// Beziehung UND (starker eigener Anspruch ODER ehrgeiziger/rachsüchtiger/
// arroganter Charakterzug). Keine große zufällige Rivalitätenflut.
function addRivalry(state, aId, bId) {
  const a = state.characters[aId], b = state.characters[bId];
  if (!a || !b) return;
  if (!a.rivalIds.includes(bId)) a.rivalIds.push(bId);
  if (!b.rivalIds.includes(aId)) b.rivalIds.push(aId);
  const memory = recordWorldEvent(state, {
    type: "RIVALRY_BEGAN",
    actorIds: [aId, bId],
    targetIds: [aId, bId],
    emotionalWeight: -30,
    metadata: { characterA: aId, characterB: bId },
    description: `${a.name} ${a.surname || ""} und ${b.name} ${b.surname || ""} gelten fortan als Rivalen.`.replace(/\s+/g, " ").trim(),
  });
  // §Punkt 32: Ursprung der Rivalität dauerhaft und direkt abrufbar speichern
  // (UI muss nicht bei jedem Aufruf danach suchen).
  a.rivalryOrigin[bId] = memory.id;
  b.rivalryOrigin[aId] = memory.id;
  refreshRelationship(state, aId, bId);
  refreshRelationship(state, bId, aId);
  addChronicle(state, memory.description);
}

function updateRivalries(state) {
  const rulerId = state.rulerId;
  const ruler = state.characters[rulerId];
  if (!ruler) return;
  for (const id of getImportantCharacterIds(state)) {
    if (id === rulerId) continue;
    const c = state.characters[id];
    if (c.rivalIds.includes(rulerId)) continue; // bereits Rivalen
    const rel = computeRelationshipBreakdown(state, id, rulerId);
    const hasStrongClaim = c.claims.some(cl => cl.titleId === "player" && (cl.strength === "strong" || cl.strength === "primary"));
    const isAmbitious = traitEffectSum(c, "claimAggression") > 0;
    // Zwei Pfade zur Rivalität (§Punkt 32/34): ein echter Groll allein
    // reicht (unabhängig von Anspruch/Trait), ODER ein ehrgeiziger
    // Charakter mit starkem eigenem Anspruch braucht nur eine bereits
    // spürbar angespannte (nicht zwingend tief negative) Beziehung —
    // die familiäre Grundsympathie (Geschwister/gleiches Haus, meist
    // +20) allein soll keine Rivalität mit einem ambitionierten
    // Thronanwärter verhindern, siehe Beispiel in §Punkt 9.
    const grievancePath = rel.total <= -25;
    const ambitionPath = isAmbitious && hasStrongClaim && rel.total < 15;
    if (grievancePath || ambitionPath) addRivalry(state, id, rulerId);
  }
}

// ---------- Jahresschritt (§Punkt 89: in einen bestehenden advanceYear()-
// Teilschritt integrieren, keine neue God-Function, advanceYear() selbst
// bleibt unverändert bei 6 Zeilen — siehe js/advance-year.js) ----------
function updateCharacterCore(state) {
  const importantIds = getImportantCharacterIds(state);
  for (const id of importantIds) {
    for (const otherId of importantIds) {
      if (id !== otherId) refreshRelationship(state, id, otherId);
    }
    if (id !== state.rulerId) refreshRelationship(state, id, state.rulerId);
  }
  updateClaims(state);
  for (const id of importantIds) {
    if (id === state.rulerId) continue;
    state.characters[id].loyalty = computeLoyalty(state, id);
  }
  updateRivalries(state);
  checkAdvisorDeaths(state);
  checkForeignRulerDeaths(state); // §Phase-8E: siehe js/diplomacy.js
}
