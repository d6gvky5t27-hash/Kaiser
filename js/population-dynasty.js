// ============================================================
// POPULATION & DYNASTY — Bevölkerungsentwicklung, Migration,
// Stadtentwicklung, Charaktere/Heirat/Erbfolge (§9/§10/§13/§14/§25)
// ============================================================

function updatePopulation(region) {
  const cfg = CONFIG.population;
  region.lastPopBreakdown = {};
  let totalBirths = 0, totalDeaths = 0;
  // Direkter Korn-Effekt (siehe computeGrainBalance() in economy.js, vor der
  // Verteilung berechnet): Überschuss hebt die Geburtenrate, Mangel hebt die
  // Sterberate — zusätzlich zum bereits bestehenden, über die Zufriedenheit
  // vermittelten Effekt (Getreide ist Teil von POP_GROUPS.needs).
  const grainRatio = region.grainRatio !== undefined ? region.grainRatio : 1;
  const grainBirthBonus = grainRatio > 1 ? Math.min(grainRatio - 1, 1) * cfg.grainBirthBonusMax : 0;
  // Schwellenbasiert statt eines durchgehenden Effekts: ein chronischer, milder
  // Kornmangel (Verhältnis z.B. 0.4–0.9) ist im Grundspiel ohne aktives
  // Kornmanagement bereits der Normalfall über Jahrzehnte (siehe
  // DEVELOPMENT.md) — nur eine echte Hungersnot (Verhältnis unter
  // grainFamineThreshold) soll als zusätzlicher, spürbarer Sterberate-Effekt
  // wirken, statt über lange Zeit einen zweiten, kaum sichtbaren Dauerdruck
  // parallel zum bestehenden zufriedenheitsbasierten Effekt aufzubauen.
  const grainDeathBonus = grainRatio < cfg.grainFamineThreshold
    ? ((cfg.grainFamineThreshold - grainRatio) / cfg.grainFamineThreshold) * cfg.grainDeathBonusMax
    : 0;
  for (const pid in region.population) {
    const grp = region.population[pid];
    const startCount = grp.count;
    const satFactor = (grp.satisfaction - 50) / 100; // -0.5..+0.5
    const birthRate = cfg.baseBirthRate + satFactor * cfg.satisfactionBirthSwing + grainBirthBonus;
    const deathRate = cfg.baseDeathRate - satFactor * cfg.satisfactionDeathSwing + grainDeathBonus;
    let hungerDeaths = 0;
    if (grp.satisfaction < cfg.hungerThreshold) hungerDeaths = grp.count * cfg.hungerDeathRate;
    const plagueDeaths = region.plagueMitigated === false ? grp.count * cfg.plagueUnmitigatedDeathRate :
                          region.plagueMitigated === true ? grp.count * cfg.plagueMitigatedDeathRate : 0;
    const naturalDeaths = grp.count * deathRate;
    const births = grp.count * birthRate;
    const deaths = naturalDeaths + hungerDeaths + plagueDeaths;
    grp.count = Math.max(0, Math.round(grp.count + births - deaths));
    // §83: Ursachen der Veränderung transparent festhalten statt nur der Endsumme
    region.lastPopBreakdown[pid] = {
      geburten: Math.round(births),
      alterstod: -Math.round(naturalDeaths),
      hungertote: -Math.round(hungerDeaths),
      seuchentote: -Math.round(plagueDeaths),
      gesamt: grp.count - startCount,
    };
    totalBirths += Math.round(births);
    totalDeaths += Math.round(naturalDeaths + hungerDeaths + plagueDeaths);
  }
  region.plagueMitigated = null;
  // Regionsweite Summe fürs Kassenbuch (Nutzerwunsch: Geburten-/Todesrate und
  // Zu-/Abwanderung nach jeder Runde sichtbar) — Wanderungssaldo wird von
  // applyInterRegionalMigration() ergänzt, das nach updatePopulation() läuft.
  region.lastPopSummary = { geburten: totalBirths, todesfaelle: totalDeaths };
}

// ---------- Staatsfinanzen (nur Spieler) ----------

function updateSettlementTier(region) {
  const tiers = CONFIG.settlement.tiers;
  const totalPop = Object.values(region.population).reduce((s,g)=>s+g.count,0);
  let newTier = 0;
  for (let i = 0; i < tiers.length; i++) {
    if (totalPop >= tiers[i].reqPop && region.infrastructureLevel >= tiers[i].reqInfra) newTier = i;
  }
  const leveledUp = newTier > (region.settlementTier || 0);
  region.settlementTier = newTier;
  return leveledUp ? tiers[newTier].name : null;
}

// ---------- Infrastruktur (§27) — Straßen/Brücken vereinfacht als Ausbaulevel ----------

function traitEffectSum(character, key) {
  let sum = 0;
  for (const tid of character.traits) {
    const t = TRAITS.find(x => x.id === tid);
    if (t && t.effects[key]) sum += t.effects[key];
  }
  return sum;
}

// Gemeinsame Sterbewahrscheinlichkeits-Formel für den Herrscher UND (seit
// Phase 3) Berater — §Character-Core-Punkt 30: "wenn bereits Alters-/
// Todessystem existiert: integrieren, keine zweite Alterungslogik bauen".
// Reiner Formelbaustein ohne RNG-Verbrauch (der rnd()-Aufruf bleibt beim
// jeweiligen Aufrufer) — verhält sich für den Herrscher exakt wie zuvor.
function rollDeathChance(character) {
  const cfg = CONFIG.dynasty;
  let deathChance = cfg.deathBaseChance;
  if (character.age > cfg.deathAgeThreshold) deathChance += (character.age - cfg.deathAgeThreshold) * cfg.deathAgeFactor;
  if (character.health < cfg.deathLowHealthThreshold) deathChance += cfg.deathLowHealthBonus;
  return deathChance;
}

function updateDynasty(state) {
  const ruler = state.characters[state.rulerId];
  if (!ruler || !ruler.alive) return;
  const cfg = CONFIG.dynasty;

  // Alle noch lebenden Mitglieder der Dynastie (Herrscher, Gemahl/Gemahlin,
  // Kinder) altern gemeinsam — vorher wurde nur ruler.age erhöht, wodurch
  // Ehepartner und Kinder für immer im Geburtsalter eingefroren blieben
  // (das verzerrte u.a. auch die Erbfolgestreit-Prüfung, die auf realistischen
  // Altersabständen zwischen Geschwistern beruht).
  for (const cid in state.characters) {
    const c = state.characters[cid];
    if (!c.alive) continue;
    c.age += 1;
    const decay = c.age > cfg.healthDecayBaseAge ? (c.age - cfg.healthDecayBaseAge) * cfg.healthDecayPerYear : 0;
    c.health = clamp(c.health - 1 - decay * 0.1 + (rnd() * 4 - 2), 0, 100);
  }

  // Heirat, falls unverheiratet und im heiratsfähigen Alter
  if (!ruler.spouseId && ruler.age >= cfg.marriageMinAge && ruler.age <= cfg.marriageMaxAge && rnd() < cfg.marriageChance) {
    const spouse = createCharacter(ruler.gender === "m" ? "f" : "m", 16 + Math.floor(rnd()*20), "");
    const sid = nextCharId();
    state.characters[sid] = spouse;
    ruler.spouseId = sid;
    spouse.spouseId = state.rulerId;
    addChronicle(state, `${ruler.name} ${ruler.surname} vermählte sich mit ${spouse.name}.`);
    state.pendingMarriage = sid;
    recordWorldEvent(state, {
      type: "MARRIAGE", actorIds: [state.rulerId, sid], targetIds: [state.rulerId, sid],
      emotionalWeight: 40,
      description: `${ruler.name} ${ruler.surname} vermählte sich mit ${spouse.name}.`,
    });
  }

  // Geburt eines Kindes — der voreingestellte Zufallsname bleibt als Fallback
  // (z.B. für die Node-Tests ohne UI), state.pendingBirth lässt die Oberfläche
  // aber ein Fenster zum eigenen Umbenennen anzeigen (auf Nutzerwunsch).
  if (ruler.spouseId && ruler.age >= cfg.birthMinAge && ruler.age <= cfg.birthMaxAge && rnd() < cfg.birthChance) {
    const isFirstChild = ruler.childrenIds.length === 0; // §Punkt 8: Geburt DES Thronfolgers vs. eines weiteren Kindes
    const child = createCharacter(rnd() < 0.5 ? "m" : "f", 0, ruler.surname);
    child.parentId = state.rulerId;
    const cid = nextCharId();
    state.characters[cid] = child;
    ruler.childrenIds.push(cid);
    const birthDesc = `${ruler.gender === "m" ? "Dem Herrscherpaar" : "Der Herrscherin"} wurde ein Kind geboren: ${child.name} ${ruler.surname}.`;
    addChronicle(state, birthDesc);
    state.pendingBirth = cid;
    recordWorldEvent(state, {
      type: isFirstChild ? "HEIR_BORN" : "CHILD_BORN",
      actorIds: [state.rulerId, ruler.spouseId], targetIds: [cid],
      emotionalWeight: isFirstChild ? 45 : 25,
      description: birthDesc,
    });
  }

  // Sterbewahrscheinlichkeit
  if (rnd() < rollDeathChance(ruler)) {
    ruler.alive = false;
    const deathDesc = `${ruler.name} ${ruler.surname} verstarb im Alter von ${ruler.age} Jahren.`;
    addChronicle(state, deathDesc);
    recordWorldEvent(state, {
      type: "RULER_DIED", actorIds: [state.rulerId], targetIds: [],
      emotionalWeight: -50, metadata: { age: ruler.age },
      description: deathDesc,
    });
    handleSuccession(state);
  }
}

function handleSuccession(state) {
  const oldRuler = state.characters[state.rulerId];
  state.stats.generations++;
  const heirs = oldRuler.childrenIds
    .map(id => state.characters[id])
    .filter(c => c && c.alive)
    .sort((a,b) => b.age - a.age); // ältestes Kind zuerst

  if (heirs.length === 0) {
    state.gameOver = "no_heir";
    const desc = `Mit dem Tod ${oldRuler.name} ${oldRuler.surname || ""}s im Jahre ${state.year} erlosch das Haus ${oldRuler.surname || ""} in direkter Linie.`.replace(/\s+/g, " ");
    addChronicle(state, desc);
    // §Phase-7-Punkt 83/84: das Aussterben der Dynastie ist der größtmögliche
    // Schlusspunkt der gesamten Geschichte — bisher gab es dafür KEINE
    // Memory (nur den Chronik-String), wodurch Dynasty Chronicle 2.0 dieses
    // zentrale Ereignis nicht hätte finden können. Einziger neuer
    // Memory-Typ dieser Phase (§Punkt 19-Analogon: nur wirklich nötig).
    recordWorldEvent(state, {
      type: "DYNASTY_ENDED", actorIds: [state.rulerId], targetIds: [],
      emotionalWeight: -70, metadata: { surname: oldRuler.surname || "" },
      description: desc,
    });
    return;
  }
  const heir = heirs[0];
  const heirId = Object.keys(state.characters).find(id => state.characters[id] === heir);

  // Erbfolgestreit (§10/§45): mehrere Erben nahe beieinander im Alter erhöhen
  // das Risiko, dass die Thronfolge angefochten wird.
  const cfg = CONFIG.succession;
  if (heirs.length > 1) {
    const rival = heirs[1];
    const closeInAge = Math.abs(heir.age - rival.age) <= cfg.disputeAgeClosenessYears;
    const disputeChance = cfg.disputeBaseChance + (closeInAge ? cfg.disputeCloseBonus : 0);
    if (rnd() < disputeChance) {
      const r = state.regions.player;
      for (const pid in r.population) r.population[pid].satisfaction = clamp(r.population[pid].satisfaction - cfg.disputeSatPenalty, 0, 100);
      state.treasury -= cfg.disputeTreasuryCost;
      state.prestige = Math.max(0, state.prestige - cfg.disputePrestigePenalty);
      state.legitimacy = Math.max(0, state.legitimacy - cfg.legitimacyDisputeLoss);
      addChronicle(state, `Ein Erbfolgestreit erschüttert die Dynastie: ${rival.name} erhob Anspruch gegen ${heir.name}. Der Konflikt wurde mit Mühe und Kosten beigelegt.`);
    }
  }

  // §Character-Core-Punkt 22: bestehendes Erbfolge-Ergebnis (ältestes
  // lebendes Kind erbt) bleibt unverändert. Zusätzlich (neu, Phase 3):
  // übergangene Geschwister bekommen einen dauerhaften, nachvollziehbaren
  // Groll (Anspruch wird auf "strong" angehoben und NICHT von
  // updateClaims() wieder auf "weak" zurückgestuft, siehe js/characters.js)
  // statt einfach zu verschwinden — die Grundlage für spätere
  // Erbfolgekrisen-Eventketten (Phase 5+), noch OHNE automatischen
  // Bürgerkrieg (§Punkt 22 ausdrücklich: "noch keinen vollständigen
  // Bürgerkrieg automatisch auslösen").
  const oldRulerId = state.rulerId;
  for (const passedOver of heirs.slice(1)) {
    const passedOverId = Object.keys(state.characters).find(id => state.characters[id] === passedOver);
    if (!passedOverId) continue;
    setClaim(passedOver, "player", "strong", "succession_passed_over");
    const memory = recordWorldEvent(state, {
      type: "PASSED_OVER_IN_SUCCESSION", actorIds: [heirId], targetIds: [passedOverId],
      emotionalWeight: -45, metadata: { titleId: "player" },
      description: `${passedOver.name} ${passedOver.surname || ""} wurde bei der Nachfolge von ${heir.name} übergangen.`.replace(/\s+/g, " "),
    });
    refreshRelationship(state, passedOverId, heirId);
    addChronicle(state, memory.description);
  }

  state.rulerId = heirId;
  snapshotRulerEraStart(state, heirId); // §Phase-7-Punkt 74: Vorher/Nachher-Grundlage für die Regentschaftszusammenfassung
  addChronicle(state, `${heir.name} ${heir.surname} tritt im Alter von ${heir.age} Jahren die Nachfolge an.`);
  recordWorldEvent(state, {
    type: "SUCCESSION", actorIds: [oldRulerId], targetIds: [heirId],
    emotionalWeight: 20, metadata: { heirsPassedOver: heirs.length - 1 },
    description: `${heir.name} ${heir.surname} trat im Alter von ${heir.age} Jahren die Nachfolge an.`,
  });
  // §Phase-5-Punkt 59: aktive Event Chains über den Herrscherwechsel
  // informieren. Ketten referenzieren "den Herrscher" bewusst live über
  // state.rulerId statt über eine eingefrorene ID (siehe DEVELOPMENT.md
  // "Phase 5" für die Begründung) — hier wird nur ein nachvollziehbarer
  // History-Eintrag ergänzt, keine ID-Umschreibung nötig.
  notifyEventChainsOfSuccession(state, oldRulerId, heirId);
  notifyStoryThreadsOfSuccession(state, oldRulerId, heirId); // §Phase-6

  // §Character-Core-Punkt 30: Berater können durch den Herrscherwechsel ihr
  // Amt verlieren — abhängig von ihrer (zuletzt gegenüber dem alten
  // Herrscher berechneten) Loyalität. Niedrige Loyalität = höheres Risiko,
  // vom neuen Herrscher nicht übernommen zu werden.
  for (const role in state.advisors) {
    const advId = state.advisors[role];
    if (!advId) continue;
    const adv = state.characters[advId];
    if (!adv || !adv.alive) continue;
    const dismissChance = clamp((50 - adv.loyalty) / 100, 0, 0.4);
    if (rnd() < dismissChance) {
      addChronicle(state, `${adv.name} ${adv.surname || ""} verlor mit dem Herrscherwechsel das Amt des ${ADVISOR_ROLES[role].name}.`.replace(/\s+/g, " "));
      state.advisors[role] = null;
      state.advisorLevels[role] = 0;
      adv.advisorRole = null;
    }
  }

  // §Phase-8F-Punkt 47-49/73: Herrschertod + Erbfolge sind der bedeutsamste
  // Moment des Spiels, bisher aber unsichtbar (nur eine Chronik-Zeile).
  // Nutzt das bereits vorhandene pendingEvent-Fenster (§48 "bestehender
  // Tod-/Succession-Ablauf bleibt" -- hier wird NICHTS neu berechnet, nur
  // ein bereits abgeschlossenes Ergebnis sichtbar gemacht, reine
  // Bestätigung statt einer echten Entscheidung). state.pendingEvent ist an
  // dieser Stelle im Jahresablauf garantiert leer (advanceYear() setzt es
  // zu Beginn zurück, updateDynasty() läuft vor jeder anderen Event-Quelle)
  // -- der Guard bleibt trotzdem als Sicherheitsnetz.
  if (!state.pendingEvent) {
    const oldRuler = state.characters[oldRulerId];
    state.pendingEvent = {
      title: `${heir.name} ${heir.surname || ""} folgt auf den Thron`.replace(/\s+/g, " "),
      text: `${oldRuler ? (oldRuler.name + " " + (oldRuler.surname || "")).trim() : "Der Herrscher"} ist tot. ${heir.name} ${heir.surname || ""} besteigt im Alter von ${heir.age} Jahren den Thron.`.replace(/\s+/g, " "),
      source: "SUCCESSION", oldRulerId, newRulerId: heirId,
      options: [{ label: "Die Herrschaft antreten", apply: () => {} }],
    };
  }
}

// ---------- Diplomatie (§29/§30) ----------

// §14: Migration zwischen den 8 simulierten Regionen statt nur einer
// abstrakten Zu-/Abwanderung zur "Außenwelt". Wer eine unzufriedene Region
// verlässt, landet mehrheitlich (`interRegionalShare`) tatsächlich in einer
// der zufriedeneren Nachbarregionen — proportional zu deren Attraktivität
// (positive Netto-Wanderungsrate) — statt einfach zu verschwinden. Der Rest
// bleibt weiterhin Wanderung zur/von der Außenwelt (kein künstlich perfekt
// geschlossenes System). Läuft einmal pro Jahr über alle Regionen hinweg,
// nach demselben Muster wie runInterregionalTrade() in economy.js.
function applyInterRegionalMigration(state) {
  const cfg = CONFIG.migration;
  const regionIds = Object.keys(state.regions);
  const netRates = {};
  const totalPops = {};
  for (const id of regionIds) {
    const r = state.regions[id];
    totalPops[id] = Object.values(r.population).reduce((s, g) => s + g.count, 0);
    const satFactor = (r.satisfactionAvg - 50) * cfg.factor;
    const bonusFactor = r._migrationBonus || 0;
    r._migrationBonus = 0;
    netRates[id] = satFactor + bonusFactor;
  }

  // Auswanderer: die Gesamtmenge, die eine Region verlässt, bleibt wie im
  // bisherigen Modell berechnet — neu ist nur, dass ein Teil davon gezielt
  // in eine der attraktiveren Regionen fließt statt komplett zu verschwinden.
  let pool = 0;
  const netMigrants = {};
  for (const id of regionIds) {
    if (netRates[id] >= 0) continue;
    const leaving = Math.round(totalPops[id] * -netRates[id]);
    netMigrants[id] = -leaving;
    pool += leaving * cfg.interRegionalShare;
  }

  let totalPositiveNetRate = 0;
  for (const id of regionIds) if (netRates[id] > 0) totalPositiveNetRate += netRates[id];

  for (const id of regionIds) {
    if (netRates[id] <= 0) continue;
    const share = totalPositiveNetRate > 0 ? netRates[id] / totalPositiveNetRate : 0;
    const fromPool = Math.round(pool * share);
    // Der übrige Zuzug kommt weiterhin "von außen" hinzu — der interRegionalShare-
    // Anteil ist ja bereits über den Pool gedeckt, daher hier nur der Rest.
    const fromOutside = Math.round(totalPops[id] * netRates[id] * (1 - cfg.interRegionalShare));
    netMigrants[id] = fromPool + fromOutside;
  }

  for (const id of regionIds) {
    const migrants = netMigrants[id] || 0;
    state.regions[id].lastNetMigration = migrants; // Nutzerwunsch: Zu-/Abwanderer im Kassenbuch sichtbar
    if (!migrants) continue;
    const r = state.regions[id];
    const totalPop = totalPops[id];
    for (const pid in r.population) {
      const grp = r.population[pid];
      const share = totalPop > 0 ? grp.count / totalPop : 0;
      grp.count = Math.max(0, grp.count + Math.round(migrants * share));
    }
  }
}

// ---------- Regierungsstil: "Sehr fair" bis "Gierig" (§Original-Justizregler) ----------
