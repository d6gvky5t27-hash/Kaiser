// ============================================================
// POPULATION & DYNASTY — Bevölkerungsentwicklung, Migration,
// Stadtentwicklung, Charaktere/Heirat/Erbfolge (§9/§10/§13/§14/§25)
// ============================================================

function updatePopulation(region) {
  const cfg = CONFIG.population;
  region.lastPopBreakdown = {};
  for (const pid in region.population) {
    const grp = region.population[pid];
    const startCount = grp.count;
    const satFactor = (grp.satisfaction - 50) / 100; // -0.5..+0.5
    const birthRate = cfg.baseBirthRate + satFactor * cfg.satisfactionBirthSwing;
    const deathRate = cfg.baseDeathRate - satFactor * cfg.satisfactionDeathSwing;
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
  }
  region.plagueMitigated = null;
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

  ruler.age += 1;
  // Gesundheit sinkt mit dem Alter, stärker nach der Schwellenaltersgrenze
  const ageDecay = ruler.age > cfg.healthDecayBaseAge ? (ruler.age - cfg.healthDecayBaseAge) * cfg.healthDecayPerYear : 0;
  ruler.health = clamp(ruler.health - 1 - ageDecay * 0.1 + (rnd()*4-2), 0, 100);

  // Heirat, falls unverheiratet und im heiratsfähigen Alter
  if (!ruler.spouseId && ruler.age >= cfg.marriageMinAge && ruler.age <= cfg.marriageMaxAge && rnd() < cfg.marriageChance) {
    const spouse = createCharacter(ruler.gender === "m" ? "f" : "m", 16 + Math.floor(rnd()*20), "");
    const sid = nextCharId();
    state.characters[sid] = spouse;
    ruler.spouseId = sid;
    spouse.spouseId = state.rulerId;
    addChronicle(state, `${ruler.name} ${ruler.surname} vermählte sich mit ${spouse.name}.`);
  }

  // Geburt eines Kindes
  if (ruler.spouseId && ruler.age >= cfg.birthMinAge && ruler.age <= cfg.birthMaxAge && rnd() < cfg.birthChance) {
    const child = createCharacter(rnd() < 0.5 ? "m" : "f", 0, ruler.surname);
    child.parentId = state.rulerId;
    const cid = nextCharId();
    state.characters[cid] = child;
    ruler.childrenIds.push(cid);
    addChronicle(state, `${ruler.gender === "m" ? "Dem Herrscherpaar" : "Der Herrscherin"} wurde ein Kind geboren: ${child.name} ${ruler.surname}.`);
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

function applyMigration(state, r) {
  const totalPop = Object.values(r.population).reduce((s,g)=>s+g.count,0);
  if (totalPop <= 0) return;
  const satFactor = (r.satisfactionAvg - 50) * CONFIG.migration.factor;
  const bonusFactor = r._migrationBonus || 0;
  const netRate = satFactor + bonusFactor;
  r._migrationBonus = 0;
  if (Math.abs(netRate) < 0.0001) return;
  for (const pid in r.population) {
    const grp = r.population[pid];
    const share = totalPop > 0 ? grp.count / totalPop : 0;
    const migrants = Math.round(totalPop * netRate * share);
    grp.count = Math.max(0, grp.count + migrants);
  }
}

// ---------- Regierungsstil: "Sehr fair" bis "Gierig" (§Original-Justizregler) ----------
