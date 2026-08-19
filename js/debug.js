// ============================================================
// DEBUG — Entwicklungs-/QA-Werkzeuge, KI-Entscheidungsanalyse (§69/§70)
// ============================================================

function debugAddMoney(state, amount) {
  state.treasury += amount;
  addChronicle(state, `[Debug] ${amount} Taler der Staatskasse hinzugefügt.`);
}

function debugSetYear(state, year) {
  state.year = year;
  addChronicle(state, `[Debug] Jahr auf ${year} gesetzt.`);
}

function debugTriggerEvent(state, eventId) {
  const ev = EVENTS.find(e => e.id === eventId);
  if (!ev) return { ok: false, reason: "Unbekanntes Event." };
  state.pendingEvent = ev;
  return { ok: true };
}

function debugChangePopulation(state, groupId, delta) {
  const grp = state.regions.player.population[groupId];
  if (!grp) return { ok: false, reason: "Unbekannte Bevölkerungsgruppe." };
  grp.count = Math.max(0, grp.count + delta);
  addChronicle(state, `[Debug] ${groupId}: ${delta >= 0 ? "+" : ""}${delta}.`);
  return { ok: true };
}

function debugCreateCharacter(state) {
  const c = createCharacter(rnd() < 0.5 ? "m" : "f", 18 + Math.floor(rnd()*40), state.dynastyName);
  const cid = nextCharId();
  state.characters[cid] = c;
  addChronicle(state, `[Debug] Charakter erzeugt: ${c.name} ${c.surname}.`);
  return c;
}

// ---------- KI-Debugging (§70) — Entscheidungsgründe transparent machen ----------
// Zeigt die Faktoren, die die Kriegsentscheidung der KI beeinflussen (dieselbe
// Berechnung wie in checkAiWarInitiative/military.js — seit §31 keine reine
// Analyse mehr ohne Konsequenz: die KI erklärt inzwischen tatsächlich Krieg,
// wenn `gesamt` die Schwelle überschreitet und Zufall/Schwierigkeit mitspielen).

function evaluateAiWarDecision(state, aiId) {
  const region = state.regions[aiId];
  const f = evaluateAiAggressionFactors(state, aiId);
  const relationOk = state.diplomacy[aiId].relation < CONFIG.military.aiWarMaxRelationForAggression;
  const wuerdeAngreifen = relationOk && f.gesamt > CONFIG.military.aiWarThreshold;

  return {
    region: region.name,
    faktoren: [
      { label: "Militärische Überlegenheit", wert: f.militaerFaktor },
      { label: "Beziehung", wert: f.beziehungFaktor },
      { label: "Wahrgenommene Schwäche (Legitimität)", wert: f.legitimitaetFaktor },
      { label: "Bestehender Pakt", wert: f.paktFaktor },
    ],
    gesamt: f.gesamt,
    entscheidung: wuerdeAngreifen ? "Würde angreifen" : "Angriff verworfen",
  };
}

// ---------- Ein voller Rundenschritt (ein Jahr) ----------
