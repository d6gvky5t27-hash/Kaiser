// ============================================================
// KAMPF-ENGINE — DATENSCHICHT (§39: alles konfigurierbar, keine
// Magic Numbers tief im Code)
// ============================================================

// ---------- §5 Truppentypen ----------
const UNIT_TYPES = {
  infanterie: {
    name: "Infanterie", attack: 6, defense: 7, rangedAttack: 0, armor: 4,
    speed: 3, moraleBase: 65, disciplineBase: 55, costPerSoldier: 1.0,
  },
  bogenschuetzen: {
    name: "Bogenschützen", attack: 2, defense: 3, rangedAttack: 7, armor: 2,
    speed: 3, moraleBase: 55, disciplineBase: 45, costPerSoldier: 1.5,
  },
  kavallerie: {
    name: "Kavallerie", attack: 9, defense: 4, rangedAttack: 0, armor: 5,
    speed: 8, moraleBase: 70, disciplineBase: 60, costPerSoldier: 4.0,
  },
  artillerie: {
    name: "Artillerie", attack: 1, defense: 2, rangedAttack: 10, armor: 1,
    speed: 1, moraleBase: 50, disciplineBase: 50, costPerSoldier: 6.0,
  },
  miliz: {
    name: "Miliz", attack: 3, defense: 3, rangedAttack: 0, armor: 1,
    speed: 3, moraleBase: 40, disciplineBase: 30, costPerSoldier: 0.4,
  },
};

// ---------- §6 Schere-Stein-Papier-Konter (additive Modifikatoren) ----------
// counterModifier(A, B) = wie stark A im Kampf gegen B verstärkt/geschwächt wird
const UNIT_COUNTERS = {
  kavallerie: { bogenschuetzen: 0.40, infanterie: -0.25 },
  bogenschuetzen: { infanterie: 0.20 }, // gilt nur in der Fernkampfphase, siehe meleeMalus unten
  artillerie: { grossFormationBonus: 0.30, kavallerieErreichtMalus: -0.50 },
  miliz: { heimatBonus: 0.25 },
};
// Bogenschützen im direkten Nahkampf (Hauptkampfphase) sind stark benachteiligt
const ARCHER_MELEE_MALUS = -0.40;
// "Große Formation" für den Artillerie-Bonus: Gegner hat mehr als dieser Anteil an Soldaten in einem einzigen Stack
const LARGE_FORMATION_SOLDIER_THRESHOLD = 400;

// ---------- §12 Gelände ----------
const TERRAIN_TYPES = {
  ebene:  { name: "Ebene",  desc: "Offenes Feld — ideal für Reiterei.",
    unitMods: { kavallerie: { attack: 0.20 } }, defenderBonus: 0 },
  wald:   { name: "Wald",   desc: "Dichter Wald — hemmt Kavallerie, begünstigt Schützen.",
    unitMods: { kavallerie: { attack: -0.30 }, bogenschuetzen: { rangedAttack: 0.10 } }, defenderBonus: 0.05 },
  huegel: { name: "Hügel",  desc: "Erhöhte Stellung — Verteidiger und Artillerie im Vorteil.",
    unitMods: { artillerie: { rangedAttack: 0.10 } }, defenderBonus: 0.20 },
  sumpf:  { name: "Sumpf",  desc: "Morastiger Boden — alle Einheiten stark verlangsamt.",
    unitMods: {}, defenderBonus: 0.10, speedMalus: 0.5 },
  stadt:  { name: "Stadt",  desc: "Enge Gassen — Infanterie im Vorteil, Kavallerie stark behindert.",
    unitMods: { infanterie: { defense: 0.15 }, kavallerie: { attack: -0.40 } }, defenderBonus: 0.15 },
  burg:   { name: "Burg",   desc: "Befestigte Stellung — der Verteidiger ist massiv im Vorteil.",
    unitMods: {}, defenderBonus: 0.50 },
};

// ---------- §13 Wetter ----------
const WEATHER_TYPES = {
  klar:  { name: "Klar",  unitMods: {} },
  regen: { name: "Regen", unitMods: { bogenschuetzen: { rangedAttack: -0.15 }, artillerie: { rangedAttack: -0.10 }, kavallerie: { attack: -0.05 } } },
  nebel: { name: "Nebel", rangedMalus: -0.30, surpriseBonus: 0.15 },
  schnee:{ name: "Schnee", speedMalus: 0.25 },
  sturm: { name: "Sturm",  unitMods: { bogenschuetzen: { rangedAttack: -0.25 }, artillerie: { rangedAttack: -0.20 } } },
};

// ---------- §10 Formationen ----------
const BATTLE_FORMATIONS = {
  ausgewogen:       { name: "Ausgewogen",           attackMod: 0,     defenseMod: 0,     desc: "Keine starken Boni oder Mali." },
  defensiv:         { name: "Defensive Linie",      attackMod: -0.15, defenseMod: 0.20,  desc: "Sicherer, aber weniger Schlagkraft." },
  aggressiv:        { name: "Aggressiver Angriff",  attackMod: 0.20,  defenseMod: -0.15, casualtyMod: 0.15, desc: "Mehr Schlagkraft, aber höhere eigene Verluste." },
  kavallerieflanke: { name: "Kavallerieflanke",     attackMod: 0,     defenseMod: -0.10, flankManeuver: true, desc: "Hohes Risiko, hohe Belohnung — Kavallerie umgeht die Front." },
  fernkampfstellung:{ name: "Fernkampfstellung",    rangedMod: 0.20,  meleeStartMod: -0.10, desc: "Schützen/Artillerie verstärkt, Nahkämpfer starten defensiver." },
};

// ---------- §11 Taktik ----------
const TACTICS = {
  halten:         { name: "Gegner halten" },
  frontalangriff: { name: "Frontalangriff", attackMod: 0.10, casualtyMod: 0.10 },
  flankenangriff: { name: "Flankenangriff", flankSynergy: true },
  fernkampf:      { name: "Fernkampf",      rangedMod: 0.15 },
  verteidigen:    { name: "Verteidigen",    defenseMod: 0.15 },
  ermueden:       { name: "Gegner ermüden", enemyMoraleDrain: 0.03 },
  rueckzugVorbereiten: { name: "Rückzug vorbereiten", retreatSafety: 0.20 },
};

// ---------- §33 Taktische Konter zwischen Formationen ----------
const FORMATION_COUNTERS = [
  { attacker: "kavallerieflanke", defender: "defensiv", effect: "flankWeakened", value: -0.35 },
  { attacker: "fernkampfstellung", defender: "aggressiv", effect: "defenderClosesDistance", value: 0.10 },
];

// ---------- §17 Moralstufen ----------
const MORALE_TIERS = [
  { min: 80, name: "Kampfstark" },
  { min: 60, name: "Stabil" },
  { min: 40, name: "Unsicher" },
  { min: 20, name: "Wankend" },
  { min: 0,  name: "Fluchtgefahr" },
];

// ---------- Balancing-Konfiguration (§39) ----------
const BATTLE_CONFIG = {
  randomModifierMin: 0.85, randomModifierMax: 1.15,
  moraleFactorAtZero: 0.5, moraleFactorAtHundred: 1.5,
  experienceFactorAtZero: 0.7, experienceFactorAtHundred: 1.3,
  commanderLeadershipDivisor: 200, // Führung wirkt moderat auf Moral/Angriff
  meleeRounds: 3,
  meleeCasualtyFactor: 1.3,
  winnerCasualtyRange: [0.05, 0.20],
  loserCasualtyRange: [0.10, 0.35],
  catastropheCasualtyMax: 0.55,
  woundedShareOfCasualties: 0.45,
  missingShareOfCasualties: 0.15, // Rest = gefallen
  moraleLossPerCasualtyShare: 60, // Moralverlust proportional zum Anteil eigener Verluste
  moraleGainOnWinningRound: 4,
  moraleLossOnLosingRound: 7,
  commanderDeathMoraleLoss: 20,
  encirclementMoraleLoss: 15,
  lowSupplyMoraleLossPerRound: 3,
  routMoraleThreshold: 20,       // darunter: hohe Fluchtwahrscheinlichkeit
  routCheckBaseChance: 0.10,     // Basis-Fluchtchance/Runde unterhalb der Schwelle
  disciplineFleeReduction: 0.006,// pro Disziplinpunkt sinkt die Fluchtchance
  commanderEventChancePerPhase: 0.05,
  fleeingExtraCasualtyShare: 0.10,
  decisionTriggerMoraleThreshold: 50, // ab hier: "Flanke wankt"-Entscheidungspunkt
};
