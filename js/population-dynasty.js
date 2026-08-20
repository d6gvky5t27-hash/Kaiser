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
  }

  // Geburt eines Kindes — der voreingestellte Zufallsname bleibt als Fallback
  // (z.B. für die Node-Tests ohne UI), state.pendingBirth lässt die Oberfläche
  // aber ein Fenster zum eigenen Umbenennen anzeigen (auf Nutzerwunsch).
  if (ruler.spouseId && ruler.age >= cfg.birthMinAge && ruler.age <= cfg.birthMaxAge && rnd() < cfg.birthChance) {
    const child = createCharacter(rnd() < 0.5 ? "m" : "f", 0, ruler.surname);
    child.parentId = state.rulerId;
    const cid = nextCharId();
    state.characters[cid] = child;
    ruler.childrenIds.push(cid);
    addChronicle(state, `${ruler.gender === "m" ? "Dem Herrscherpaar" : "Der Herrscherin"} wurde ein Kind geboren: ${child.name} ${ruler.surname}.`);
    state.pendingBirth = cid;
  }

  // Sterbewahrscheinlichkeit
  let deathChance = cfg.deathBaseChance;
  if (ruler.age > cfg.deathAgeThreshold) deathChance += (ruler.age - cfg.deathAgeThreshold) * cfg.deathAgeFactor;
  if (ruler.health < cfg.deathLowHealthThreshold) deathChance += cfg.deathLowHealthBonus;
  if (rnd() < deathChance) {
    ruler.alive = false;
    addChronicle(state, `${ruler.name} ${ruler.surname} verstarb im Alter von ${ruler.age} Jahren.`);
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
    addChronicle(state, `Die Dynastie ${oldRuler.surname} stirbt ohne Erben aus. Deine Herrschaft endet.`);
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

  state.rulerId = heirId;
  addChronicle(state, `${heir.name} ${heir.surname} tritt im Alter von ${heir.age} Jahren die Nachfolge an.`);
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
