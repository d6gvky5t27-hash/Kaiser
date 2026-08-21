// ============================================================
// DATA-SYNC (§65/§79) — hält die reinen Datentabellen in data/json/*.json
// (extern, modding-freundlich) und den entsprechenden Abschnitt von
// data/gamedata.js (vom Spiel/den Tests tatsächlich geladen) synchron.
//
// Warum nicht direkt per fetch() aus index.html laden? index.html muss
// weiterhin als einzelne, per file:// geöffnete Datei funktionieren
// (browserseitiges fetch() auf lokale Dateien scheitert dort an CORS) —
// die JSON-Dateien sind daher die *Bearbeitungsquelle* für Mods, während
// data/gamedata.js die daraus *erzeugte*, sofort ladbare Laufzeitdatei bleibt.
//
// Nutzung:
//   node tools/data-sync.js extract   Tabellen aus gamedata.js -> data/json/*.json
//   node tools/data-sync.js build     data/json/*.json -> Tabellen in gamedata.js einsetzen
//
// Nach "build" IMMER auch das Build-Skript für index.html erneut ausführen
// (siehe DEVELOPMENT.md), damit das gebündelte Spiel die neuen Daten enthält.
// ============================================================

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.join(__dirname, "..");
const GAMEDATA_PATH = path.join(ROOT, "data", "gamedata.js");
const JSON_DIR = path.join(ROOT, "data", "json");

// Reihenfolge = Reihenfolge im Quelltext (relevant fürs Wiedereinsetzen).
// "kind" + "required" beschreiben die minimale Form jeder Tabelle (kein
// großes Schema-Framework, nur Vanilla-JS-Prüfung "Pflichtfeld vorhanden?")
// — Absicherung gegen genau die Art von stillem Feldverlust, die beim
// Berater-Feld `baseCost` aufgetreten ist (Phase 2, Priorität 2).
const TABLES = [
  { name: "GOODS", file: "goods.json", kind: "object", required: ["name", "base", "category"] },
  { name: "PRODUCTION_CHAINS", file: "production-chains.json", kind: "array", required: ["input", "output", "ratioPerWorker", "building", "workerGroup"] },
  { name: "BUILDINGS", file: "buildings.json", kind: "object", required: ["name", "cost", "effect", "value"] },
  { name: "POP_GROUPS", file: "population-groups.json", kind: "object", required: ["name", "needs", "weight", "share"] },
  { name: "TROOP_TYPES", file: "troop-types.json", kind: "object", required: ["name", "cost", "upkeep", "strength", "source"] },
  { name: "FORMATIONS", file: "formations.json", kind: "object", required: ["name", "requiresTroop", "bonus"] },
  { name: "ADVISOR_ROLES", file: "advisor-roles.json", kind: "object", required: ["name", "statKey", "desc", "baseCost"] },
  { name: "EXTRA_REGIONS", file: "extra-regions.json", kind: "array", required: ["id", "name", "fertility", "pop"] },
  { name: "TITLES", file: "titles.json", kind: "array", required: ["id", "name", "reqPop", "reqWealth", "reqPrestige"] },
];

// Prüft nur, ob die Pflichtfelder VORHANDEN sind (auch ein expliziter
// `null`-Wert zählt als vorhanden, z. B. `input: null` bei
// PRODUCTION_CHAINS) — verändert nie einen Wert, füllt nie einen Default
// auf. Wirft bei einem fehlenden Feld einen klaren Fehler mit Tabellen-
// name, Eintrags-ID/-Index und fehlendem Feld, statt die Tabelle
// stillschweigend zu übernehmen (§Phase-2-Regel: "Sync darf nicht
// stillschweigend Daten löschen").
function validateTable(table, value) {
  if (table.kind === "array") {
    if (!Array.isArray(value)) throw new Error(`${table.name}: erwartet ein Array, bekam ${typeof value}.`);
    value.forEach((entry, idx) => {
      if (!entry || typeof entry !== "object") throw new Error(`${table.name}[${idx}]: kein gültiges Objekt.`);
      for (const field of table.required) {
        if (!(field in entry)) throw new Error(`${table.name}[${idx}] (id=${entry.id ?? "?"}): Pflichtfeld "${field}" fehlt.`);
      }
    });
  } else {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${table.name}: erwartet ein Objekt, bekam ${typeof value}.`);
    for (const key in value) {
      const entry = value[key];
      if (!entry || typeof entry !== "object") throw new Error(`${table.name}.${key}: kein gültiges Objekt.`);
      for (const field of table.required) {
        if (!(field in entry)) throw new Error(`${table.name}.${key}: Pflichtfeld "${field}" fehlt.`);
      }
    }
  }
}

// Findet "const NAME = <Literal>;" per Klammerntiefen-Zählung (robust genug
// für einfache Objekt-/Array-Literale ohne Regex-Literale/Template-Strings,
// die hier in den reinen Datentabellen nicht vorkommen).
function findDeclaration(src, name) {
  const marker = `const ${name} = `;
  const start = src.indexOf(marker);
  if (start === -1) throw new Error(`Deklaration "const ${name} = " nicht gefunden.`);
  const litStart = start + marker.length;
  let depth = 0, inString = null, i = litStart;
  for (; i < src.length; i++) {
    const ch = src[i];
    if (inString) {
      if (ch === "\\") { i++; continue; }
      if (ch === inString) inString = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") { inString = ch; continue; }
    if (ch === "{" || ch === "[") depth++;
    else if (ch === "}" || ch === "]") {
      depth--;
      if (depth === 0) { i++; break; }
    }
  }
  if (depth !== 0) throw new Error(`Unausgeglichene Klammern beim Parsen von ${name}.`);
  let end = i;
  if (src[end] === ";") end++;
  return { start, litStart, litEnd: i, declEnd: end };
}

function extract() {
  const src = fs.readFileSync(GAMEDATA_PATH, "utf8");
  const sandbox = {};
  vm.createContext(sandbox);
  // Top-Level "const" landet bei vm.runInContext NICHT als Property auf dem
  // Sandbox-Objekt (anders als "var"/Funktionsdeklarationen) — daher am Ende
  // explizit einsammeln. Ruft keine Funktionen auf (nur Literale/Funktions-
  // definitionen im Skript), daher unproblematisch ohne core.js/rnd() vorher zu laden.
  const collector = "\nthis.__RESULT__ = { " + TABLES.map(t => t.name).join(", ") + " };\n";
  vm.runInContext(src + collector, sandbox, { filename: "gamedata.js" });
  const result = sandbox.__RESULT__;

  // Erst ALLE Tabellen validieren, dann erst schreiben — ein fehlerhafter
  // gamedata.js-Stand soll nicht teilweise nach data/json/ durchsickern.
  for (const t of TABLES) {
    const value = result[t.name];
    if (value === undefined) throw new Error(`Tabelle ${t.name} nach dem Auswerten nicht gefunden.`);
    validateTable(t, value);
  }

  fs.mkdirSync(JSON_DIR, { recursive: true });
  for (const t of TABLES) {
    const value = result[t.name];
    fs.writeFileSync(path.join(JSON_DIR, t.file), JSON.stringify(value, null, 2) + "\n");
    console.log("extrahiert:", t.file);
  }
}

function build() {
  let src = fs.readFileSync(GAMEDATA_PATH, "utf8");
  const parsed = [];
  // Erst ALLE JSON-Dateien einlesen und validieren — bei einem fehlenden
  // Pflichtfeld (wie zuletzt `baseCost` bei den Beratern) bricht der Build
  // hier mit einem klaren Fehler ab, BEVOR irgendetwas in gamedata.js
  // geschrieben wird. Kein stillschweigendes Überschreiben mit
  // unvollständigen Daten.
  for (const t of TABLES) {
    const jsonPath = path.join(JSON_DIR, t.file);
    if (!fs.existsSync(jsonPath)) throw new Error(`${t.file} fehlt in data/json/ — zuerst "extract" ausführen.`);
    const value = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
    validateTable(t, value);
    parsed.push({ table: t, value });
  }
  for (const { table: t, value } of parsed) {
    const { litStart, declEnd } = findDeclaration(src, t.name);
    const newLiteral = JSON.stringify(value, null, 2);
    src = src.slice(0, litStart) + newLiteral + ";" + src.slice(declEnd);
  }
  fs.writeFileSync(GAMEDATA_PATH, src);
  console.log("data/gamedata.js aus data/json/*.json aktualisiert.");
}

const mode = process.argv[2];
if (mode === "extract") extract();
else if (mode === "build") build();
else {
  console.error("Nutzung: node tools/data-sync.js extract|build");
  process.exit(1);
}
