// BUILD-BUNDLE (Phase 2, Punkt 29-31) — konsolidiert das bisher nur als
// Ad-hoc-Inline-Skript existierende Rebuild-Kommando (siehe DEVELOPMENT.md,
// wiederholt nach jeder Änderung an js/*.js/data/gamedata.js von Hand
// ausgeführt) zu einem festen, versionierten Werkzeug mit Build-
// Validierung. Ersetzt keinen Bundler, führt keine neue Abhängigkeit ein
// (§Phase-2-Punkt 28) — reine Vanilla-Node-Konkatenation wie zuvor, nur
// nicht mehr "nur implizit durch Ad-hoc-Kopieren garantiert" (§CODE_AUDIT.md
// Abschnitt 1/5/12).
//
// Nutzung:
//   node tools/build-bundle.js
//
// Prüft vor dem Schreiben:
//   1. Alle 14 Quelldateien existieren.
//   2. Nach der Konkatenation sind beide <script>-Blöcke syntaktisch gültig
//      (new Function()-Parse-Check).
//   3. Laufzeit-Rauchtest: das gebündelte Spiel lässt sich tatsächlich
//      starten (newGame()) und einen Monat weiterschalten (advanceMonth()),
//      ohne ReferenceError/TypeError — das ist der eigentliche Beweis, dass
//      die Ladereihenfolge stimmt (nicht nur "syntaktisch gültig", sondern
//      "funktioniert wirklich").
//
// Kein automatischer Daten-Sync-Check hier (bewusst getrennt gehalten,
// siehe tools/data-sync.js) — Daten-Sync ist ein eigener, bewusster
// Schritt (JSON -> gamedata.js), kein impliziter Teil jedes Bundle-Builds.

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.join(__dirname, "..");
const INDEX_PATH = path.join(ROOT, "index.html");

// Ladereihenfolge — siehe CODE_AUDIT.md "Modul-Abhängigkeiten" für die
// Begründung. Funktionsdeklarationen sind innerhalb eines gemeinsamen
// eval-Scopes hoisting-bedingt reihenfolgeunabhängig; echte Reihenfolge-
// Empfindlichkeit besteht nur für die wenigen Top-Level-`const`-Werte, die
// beim Laden sofort aus einer anderen Datei gelesen werden (v. a. alles,
// was `data/gamedata.js`s Tabellen referenziert, muss daher nach ihr
// stehen). Diese Reihenfolge ist die etablierte, getestete Referenz —
// nicht ohne Grund verändern.
const FILES = [
  "data/gamedata.js",
  "js/core.js",
  "js/economy.js",
  "js/population-dynasty.js",
  "js/politics.js",
  "js/diplomacy.js",
  "js/military.js",
  "js/debug.js",
  "js/war-map.js",
  "js/advance-year.js",
  "battle-engine/battle-data.js",
  "battle-engine/battle-engine.js",
  "battle-engine/battle-state-machine.js",
  "js/battle-bridge.js",
];

function fail(msg) {
  console.error("BUILD FEHLGESCHLAGEN: " + msg);
  process.exit(1);
}

// ---------- 1. Existenzprüfung ----------
const missing = FILES.filter(f => !fs.existsSync(path.join(ROOT, f)));
if (missing.length) fail("Fehlende Quelldateien: " + missing.join(", "));

const contents = FILES.map(f => fs.readFileSync(path.join(ROOT, f), "utf8"));
const bundled = "\n" + contents.join("\n") + "\n";

// ---------- 2. Syntax-Check ----------
try {
  new Function(bundled);
} catch (e) {
  fail("Gebündelter Code ist syntaktisch ungültig: " + e.message);
}

// ---------- 3. Laufzeit-Rauchtest (der eigentliche Beweis für "Reihenfolge gültig") ----------
try {
  const sandbox = {};
  vm.createContext(sandbox);
  vm.runInContext(bundled + `
    globalThis.__SMOKE__ = (function() {
      const state = newGame({ seed: 1 });
      // 12x advanceMonth(), damit auch advanceYear() (nach dem 12. Monat)
      // mindestens einmal wirklich durchläuft — ein einzelner
      // advanceMonth()-Aufruf allein würde advanceYear() NICHT auslösen
      // und Fehler darin (z. B. eine kaputte Ladereihenfolge) unentdeckt
      // lassen.
      for (let m = 0; m < 12; m++) advanceMonth(state);
      return { year: state.year, treasury: state.treasury };
    })();
  `, sandbox, { filename: "bundle-smoke-test.js" });
  const result = sandbox.__SMOKE__;
  if (!result || typeof result.year !== "number") fail("Laufzeit-Rauchtest lieferte kein plausibles Ergebnis.");
  console.log("Laufzeit-Rauchtest OK (Jahr " + result.year + ", Kasse " + result.treasury + ").");
} catch (e) {
  fail("Laufzeit-Rauchtest schlug fehl (Bundle startet nicht sauber): " + e.stack);
}

// ---------- Bundle in index.html einsetzen ----------
if (!fs.existsSync(INDEX_PATH)) fail("index.html nicht gefunden.");
let html = fs.readFileSync(INDEX_PATH, "utf8");
const scriptBlocks = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
if (scriptBlocks.length < 2) fail("index.html enthält nicht die erwarteten zwei <script>-Blöcke.");
const firstBlock = scriptBlocks[0];
const newHtml = html.slice(0, firstBlock.index) + "<script>" + bundled + "</script>" + html.slice(firstBlock.index + firstBlock[0].length);

// Zur Sicherheit: auch den finalen index.html-Zustand syntaktisch prüfen
// (deckt z. B. versehentlich mitkopierte </script>-Tags in Datenstrings ab).
const finalBlocks = [...newHtml.matchAll(/<script>([\s\S]*?)<\/script>/g)];
for (let i = 0; i < finalBlocks.length; i++) {
  try { new Function(finalBlocks[i][1]); }
  catch (e) { fail(`index.html-Block ${i} nach dem Einsetzen syntaktisch ungültig: ` + e.message); }
}

fs.writeFileSync(INDEX_PATH, newHtml);
console.log("index.html aktualisiert (" + newHtml.length + " Zeichen, Block 0: " + bundled.length + " Zeichen).");
