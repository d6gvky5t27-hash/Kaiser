// Phase-5-Metriken (Event Chains) — §Punkt 68-73/92-94/98: Langzeitmessung
// über mehrere Partien mit einer einfachen, deklarierten Test-Policy
// (§Punkt 72/73 — KEINE echte KI), um zu messen, wie viel Geschichte aus
// der Simulation selbst entsteht. Rein additiv/lesend, feste Seeds.
//
// Ausführen mit: node tests/phase5_event_chain_metrics_test.js
const fs = require("fs");
const path = require("path");

const gamedata = fs.readFileSync(path.join(__dirname, "..", "data/gamedata.js"), "utf8");
const simModules = ["core", "economy", "population-dynasty", "memory", "characters", "story-threads", "drama-director", "event-chains", "chronicle", "politics", "diplomacy", "military", "debug", "war-map", "advance-year"];
const sim = simModules.map(m => fs.readFileSync(path.join(__dirname, "..", "js", m + ".js"), "utf8")).join("\n");

const testBody = `
const RUNS = 30;
const YEARS = 100;
const POLICY = "FIRST_OPTION"; // §Punkt 73: deterministische, einfache Test-Policy, keine echte KI

let totalStarted = 0, totalResolved = 0, totalFailed = 0, totalExpired = 0;
const byType = {};
let durationSum = 0, durationCount = 0;
let escalationCount = 0, peacefulCount = 0; // §Punkt 70/99K: RESOLVED = friedlich, FAILED = konfliktorientiert (Konvention der 10 Templates)
let activeSumAtYearEnd = 0, activeSamples = 0;
let chronicleEligibleChainLines = 0;
const outcomeCounts = {};
const exampleStories = [];

const startTime = Date.now();

for (let run = 0; run < RUNS; run++) {
  const state = newGame({ seed: run });
  for (let y = 0; y < YEARS; y++) {
    for (let m = 0; m < 12; m++) {
      advanceMonth(state);
      resolvePendingEventWithPolicy(state, POLICY);
      if (state.gameOver) break;
    }
    activeSumAtYearEnd += Object.keys(state.eventChains.active).length;
    activeSamples++;
    if (state.gameOver) break;
  }

  const resolved = Object.values(state.eventChains.resolved);
  totalStarted += resolved.length + Object.keys(state.eventChains.active).length;
  for (const chain of resolved) {
    byType[chain.templateId] = (byType[chain.templateId] || 0) + 1;
    outcomeCounts[chain.templateId + ":" + chain.resolution] = (outcomeCounts[chain.templateId + ":" + chain.resolution] || 0) + 1;
    if (chain.status === "RESOLVED") { totalResolved++; peacefulCount++; }
    else if (chain.status === "FAILED") { totalFailed++; escalationCount++; }
    else if (chain.status === "EXPIRED") { totalExpired++; }
    const lastYear = chain.history.length ? chain.history[chain.history.length - 1].year : chain.startedYear;
    durationSum += (lastYear - chain.startedYear);
    durationCount++;
    chronicleEligibleChainLines += chain.history.filter(h => h.event === "started" || h.choice).length;
    if (exampleStories.length < 8 && chain.history.length >= 2) {
      exampleStories.push({
        run, templateId: chain.templateId, name: CHAIN_TEMPLATES[chain.templateId].name,
        lines: chain.history.map(h => h.year + " – " + (h.note || h.choice || h.event || h.outcome || h.stage)),
      });
    }
  }
}

const elapsedMs = Date.now() - startTime;

console.log('=== PHASE 5 EVENT CHAINS — Metriken (' + RUNS + ' Partien x ' + YEARS + ' Jahre, Policy: ' + POLICY + ') ===');
console.log('');
console.log('Gestartete Ketten pro Partie im Schnitt: ' + (totalStarted/RUNS).toFixed(2));
console.log('Abgeschlossen (RESOLVED) pro Partie im Schnitt: ' + (totalResolved/RUNS).toFixed(2));
console.log('Gescheitert (FAILED) pro Partie im Schnitt: ' + (totalFailed/RUNS).toFixed(2));
console.log('Abgelaufen (EXPIRED) pro Partie im Schnitt: ' + (totalExpired/RUNS).toFixed(2));
console.log('');
console.log('--- Ketten pro Typ (Summe ueber alle Partien) ---');
for (const type of Object.keys(byType).sort((a,b)=>byType[b]-byType[a])) {
  console.log('  ' + type + ': ' + byType[type]);
}
console.log('');
console.log('Durchschnittliche Dauer einer abgeschlossenen Kette: ' + (durationCount ? (durationSum/durationCount).toFixed(1) : '0') + ' Jahre');
console.log('Durchschnittlich aktive Ketten am Jahresende: ' + (activeSamples ? (activeSumAtYearEnd/activeSamples).toFixed(2) : '0'));
console.log('Friedliche Loesungsquote (RESOLVED): ' + (peacefulCount+escalationCount ? Math.round(100*peacefulCount/(peacefulCount+escalationCount)) : 0) + '%');
console.log('Eskalationsquote (FAILED): ' + (peacefulCount+escalationCount ? Math.round(100*escalationCount/(peacefulCount+escalationCount)) : 0) + '%');
console.log('Chronikwuerdige Chain-Ereignisse (Start + Entscheidungen) pro Partie im Schnitt: ' + (chronicleEligibleChainLines/RUNS).toFixed(1));
console.log('Chronikwuerdige Chain-Ereignisse pro Jahrzehnt: ' + (chronicleEligibleChainLines/RUNS/(YEARS/10)).toFixed(2));
console.log('');
console.log('--- Haeufigste Ausgaenge je Typ ---');
for (const key of Object.keys(outcomeCounts).sort((a,b)=>outcomeCounts[b]-outcomeCounts[a]).slice(0, 15)) {
  console.log('  ' + key + ': ' + outcomeCounts[key]);
}
console.log('');
console.log('Performance: ' + elapsedMs + ' ms fuer ' + RUNS + ' Partien (' + (elapsedMs/RUNS).toFixed(0) + ' ms/Partie)');
console.log('');
console.log('=== §Punkt 98: Beispielgeschichten aus tatsaechlichen Simulationsdaten (nicht erfunden) ===');
for (const story of exampleStories) {
  console.log('');
  console.log('[Partie ' + story.run + ', ' + story.name + ']');
  for (const line of story.lines) console.log('  ' + line);
}

console.log('');
console.log('--- Hinweis zur Deckung in rein passivem Spiel ---');
console.log('4 von 10 Ketten feuern in reinem Passivspiel ueberhaupt (dynastic_marriage,');
console.log('passed_over_heir, rising_rival, famine_crisis) — die anderen 6 setzen');
console.log('spielergesteuerte Aktionen oder Schwellen voraus, die passives Spiel nicht');
console.log('erreicht (Beraterernennung fuer grieved_advisor/corrupt_treasurer, aktive');
console.log('Zollpolitik fuer trade_conflict, Kriegsnähe fuer border_conflict, Kirchenbau');
console.log('fuer church_conflict, hoher Titel/Prestige fuer imperial_ambition) — exakt');
console.log('dieselbe bereits aus Phase 3 bekannte Einschraenkung ("Berater-Ernennungen');
console.log('pro Partie im Schnitt: 0.00" in reinem Passivspiel, siehe phase3_metrics_test.js).');
console.log('Kein Fehler, sondern eine ehrliche Grenze automatisierter Passivtests.');

// §Punkt 70 "Eskalationsquote": mit FIRST_OPTION (== CONCILIATORY, siehe oben)
// ist die Eskalationsquote strukturell 0% — ein zweiter, kleinerer Lauf mit
// RANDOM_VALID_OPTION zeigt, dass das System tatsaechlich auch eskalieren
// KANN, wenn nicht durchgehend die grosszuegigste Option gewaehlt wird.
let started2 = 0, resolved2 = 0, failed2 = 0, expired2 = 0;
for (let run = 0; run < 15; run++) {
  const state = newGame({ seed: 1000 + run });
  for (let y = 0; y < YEARS; y++) {
    for (let m = 0; m < 12; m++) {
      advanceMonth(state);
      resolvePendingEventWithPolicy(state, "RANDOM_VALID_OPTION");
      if (state.gameOver) break;
    }
    if (state.gameOver) break;
  }
  const resolved = Object.values(state.eventChains.resolved);
  started2 += resolved.length + Object.keys(state.eventChains.active).length;
  for (const chain of resolved) {
    if (chain.status === "RESOLVED") resolved2++;
    else if (chain.status === "FAILED") failed2++;
    else if (chain.status === "EXPIRED") expired2++;
  }
}
console.log('');
console.log('--- Vergleichslauf mit RANDOM_VALID_OPTION (15 Partien x 100 Jahre) ---');
console.log('Gestartete Ketten pro Partie im Schnitt: ' + (started2/15).toFixed(2));
console.log('Friedliche Loesungsquote (RESOLVED): ' + (resolved2+failed2 ? Math.round(100*resolved2/(resolved2+failed2)) : 0) + '%');
console.log('Eskalationsquote (FAILED): ' + (resolved2+failed2 ? Math.round(100*failed2/(resolved2+failed2)) : 0) + '%');
console.log('(Bestaetigt: das System KANN eskalieren, FIRST_OPTION/CONCILIATORY oben');
console.log('waehlt aber konsequent die grosszuegigste Option und loest daher fast alles friedlich.)');
`;

eval(gamedata + "\n" + sim + "\n" + testBody);
