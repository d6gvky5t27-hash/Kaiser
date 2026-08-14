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
// Zeigt die Faktoren, die eine (hypothetische) Kriegsentscheidung der KI beeinflussen
// würden. Die KI erklärt in v1 selbst keinen Krieg (siehe DEVELOPMENT.md), diese
// Funktion macht aber schon jetzt sichtbar, wie eine solche Bewertung aussähe.

function evaluateAiWarDecision(state, aiId) {
  const region = state.regions[aiId];
  const dip = state.diplomacy[aiId];
  const playerStrength = armyStrength(state);
  const aiStrength = estimateAiStrength(region);

  const militaerFaktor = Math.round(((aiStrength - playerStrength) / Math.max(playerStrength, 1)) * 30);
  const beziehungFaktor = Math.round(-dip.relation / 4); // schlechte Beziehung begünstigt Krieg
  const legitimitaetFaktor = Math.round((50 - state.legitimacy) / 5); // schwacher Spieler wirkt einladend
  const paktFaktor = dip.treaties.nichtangriff ? -40 : (dip.treaties.allianz ? -100 : 0);

  const gesamt = militaerFaktor + beziehungFaktor + legitimitaetFaktor + paktFaktor;
  const wuerdeAngreifen = gesamt > 25;

  return {
    region: region.name,
    faktoren: [
      { label: "Militärische Überlegenheit", wert: militaerFaktor },
      { label: "Beziehung", wert: beziehungFaktor },
      { label: "Wahrgenommene Schwäche (Legitimität)", wert: legitimitaetFaktor },
      { label: "Bestehender Pakt", wert: paktFaktor },
    ],
    gesamt,
    entscheidung: wuerdeAngreifen ? "Würde angreifen" : "Angriff verworfen",
  };
}

// ---------- Ein voller Rundenschritt (ein Jahr) ----------
