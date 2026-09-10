// Phase-6-Metriken (Story Threads + Drama Director) — §Punkt 90-101/91.
// 30x100-Jahre-Langzeitmessung plus 10 echte Kampagnen-Timelines und 5
// detaillierte Story Threads, direkt aus Simulationsdaten gezogen (nicht
// erfunden). Rein additiv/lesend, feste Seeds.
//
// Ausführen mit: node tests/phase6_story_metrics_test.js
const fs = require("fs");
const path = require("path");

const gamedata = fs.readFileSync(path.join(__dirname, "..", "data/gamedata.js"), "utf8");
const simModules = ["core", "economy", "population-dynasty", "memory", "characters", "estates", "imperial-politics", "story-threads", "drama-director", "event-chains", "chronicle", "politics", "diplomacy", "military", "debug", "war-map", "advance-year"];
const sim = simModules.map(m => fs.readFileSync(path.join(__dirname, "..", "js", m + ".js"), "utf8")).join("\n");

const testBody = `
const RUNS = 30;
const YEARS = 100;
const POLICY = "FIRST_OPTION";

let totalStarted = 0, totalResolved = 0, totalExpired = 0;
const byType = {};
let durationSum = 0, durationCount = 0;
let climaxCount = 0;
let activeSum = 0, activeSamples = 0;
let overlapSum = 0; // Jahre mit >=2 gleichzeitig aktiven (nicht-DORMANT) Threads
let chainsPerThreadSum = 0, threadsWithChains = 0;
let memoriesPerThreadSum = 0;
let peacefulThreadCount = 0, escalatedThreadCount = 0;
const pacingCounts = { QUIET: 0, BUILDING: 0, HIGH_TENSION: 0, CRISIS: 0, RECOVERY: 0 };
let totalChronicleEntries = 0, meaningfulStoryEntries = 0;
const timelines = []; // §Punkt 95/96: 10 echte Kampagnen-Timelines
const detailedThreads = []; // §Punkt 97: 5 vollständige Story-Thread-Historien

const startTime = Date.now();

for (let run = 0; run < RUNS; run++) {
  const state = newGame({ seed: run });
  let yearsSimulated = 0;
  for (let y = 0; y < YEARS; y++) {
    for (let m = 0; m < 12; m++) {
      advanceMonth(state);
      resolvePendingEventWithPolicy(state, POLICY);
      if (state.gameOver) break;
    }
    yearsSimulated++;
    pacingCounts[state.drama.pacing] = (pacingCounts[state.drama.pacing] || 0) + 1;
    const nonDormant = getActiveStoryThreads(state).filter(t => t.status !== "DORMANT").length;
    activeSum += nonDormant; activeSamples++;
    if (nonDormant >= 2) overlapSum++;
    if (state.gameOver) break;
  }
  totalChronicleEntries += state.chronicle.length;

  const allThreads = getAllStoryThreads(state);
  totalStarted += allThreads.length;
  for (const t of allThreads) {
    byType[t.type] = (byType[t.type] || 0) + 1;
    if (t.status === "RESOLVED") { totalResolved++; }
    if (t.status === "EXPIRED") totalExpired++;
    if (t.history.some(h => h.status === "CLIMAX")) climaxCount++;
    if (t.status === "RESOLVED" || t.status === "EXPIRED") {
      const lastYear = t.history.length ? t.history[t.history.length - 1].year : t.startedYear;
      durationSum += (lastYear - t.startedYear);
      durationCount++;
      if (t.resolution && t.resolution.outcome === "POSITIVE") peacefulThreadCount++;
      else if (t.resolution && t.resolution.outcome === "NEGATIVE") escalatedThreadCount++;
    }
    if (t.chainIds.length) { chainsPerThreadSum += t.chainIds.length; threadsWithChains++; }
    memoriesPerThreadSum += t.memoryIds.length;
    if (t.importance >= 50) meaningfulStoryEntries++;
  }

  // §Punkt 95/96: 10 echte Kampagnen-Timelines aus unterschiedlichen Seeds
  if (timelines.length < 10 && allThreads.length) {
    const sorted = allThreads.slice().sort((a, b) => a.startedYear - b.startedYear);
    timelines.push({
      seed: run,
      lines: sorted.map(t => {
        const endYear = (t.status === "RESOLVED" || t.status === "EXPIRED") && t.history.length ? t.history[t.history.length - 1].year : null;
        return \`\${t.startedYear}\${endYear ? "–" + endYear : "–"}\\n\${t.title}\\n-> \${t.status}\${t.resolution ? " (" + t.resolution.type + ")" : ""}\`;
      }),
    });
  }

  // §Punkt 97: 5 vollständige Detailgeschichten (nur "richtige" Threads mit
  // mehreren History-Einträgen, damit sie tatsächlich etwas zu erzählen haben)
  if (detailedThreads.length < 5) {
    for (const t of allThreads) {
      if (detailedThreads.length >= 5) break;
      if (t.history.length >= 3) detailedThreads.push(summarizeStoryThread(t));
    }
  }
}

const elapsedMs = Date.now() - startTime;

console.log('=== PHASE 6 STORY THREADS + DRAMA DIRECTOR — Metriken (' + RUNS + ' Partien x ' + YEARS + ' Jahre, Policy: ' + POLICY + ') ===');
console.log('');
console.log('Threads gestartet pro Partie im Schnitt: ' + (totalStarted/RUNS).toFixed(2));
console.log('Threads RESOLVED pro Partie im Schnitt: ' + (totalResolved/RUNS).toFixed(2));
console.log('Threads EXPIRED pro Partie im Schnitt: ' + (totalExpired/RUNS).toFixed(2));
console.log('Threads mit mindestens einem CLIMAX: ' + climaxCount + ' von ' + totalStarted);
console.log('Durchschnittliche Thread-Dauer (abgeschlossen): ' + (durationCount ? (durationSum/durationCount).toFixed(1) : '0') + ' Jahre');
console.log('Durchschnittlich gleichzeitig aktive (nicht-dormante) Threads: ' + (activeSamples ? (activeSum/activeSamples).toFixed(2) : '0'));
console.log('Jahre mit Story-Überlappung (>=2 aktive Threads): ' + overlapSum + ' von ' + activeSamples + ' (' + Math.round(100*overlapSum/activeSamples) + '%)');
console.log('Chains pro Thread (nur Threads mit >=1 Chain): ' + (threadsWithChains ? (chainsPerThreadSum/threadsWithChains).toFixed(2) : '0'));
console.log('Memories pro Thread im Schnitt: ' + (totalStarted ? (memoriesPerThreadSum/totalStarted).toFixed(2) : '0'));
console.log('Friedliche Thread-Resolutions: ' + peacefulThreadCount + ' / Konfliktorientierte: ' + escalatedThreadCount);
console.log('');
console.log('--- Threads pro Typ (Summe ueber alle Partien) ---');
for (const type of Object.keys(byType).sort((a,b)=>byType[b]-byType[a])) console.log('  ' + type + ': ' + byType[type]);
console.log('');
console.log('--- Pacing-Verteilung (Anteil simulierter Jahre) ---');
const pacingTotal = Object.values(pacingCounts).reduce((a,b)=>a+b,0);
for (const p of ['QUIET','BUILDING','HIGH_TENSION','CRISIS','RECOVERY']) {
  console.log('  ' + p + ': ' + Math.round(100*(pacingCounts[p]||0)/pacingTotal) + '%');
}
console.log('');
console.log('--- Story Signal Ratio (§Punkt 100/101) ---');
console.log('bedeutsame Story-Threads (importance>=50) / alle gestarteten Threads: ' + meaningfulStoryEntries + ' / ' + totalStarted);
console.log('Chronik-Eintraege gesamt (alle Partien): ' + totalChronicleEntries + ' (Chronik bleibt unveraendert Wetter-dominiert, §Punkt 100 — nur gemessen, nicht manipuliert)');
console.log('');
console.log('Performance: ' + elapsedMs + ' ms fuer ' + RUNS + ' Partien (' + (elapsedMs/RUNS).toFixed(0) + ' ms/Partie)');

console.log('');
console.log('=== §Punkt 96: 10 echte Kampagnen-Timelines ===');
for (const tl of timelines) {
  console.log('');
  console.log('SEED ' + tl.seed);
  for (const line of tl.lines) { console.log(''); console.log(line); }
}

console.log('');
console.log('=== §Punkt 97: 5 detaillierte Story Threads ===');
for (const summary of detailedThreads) {
  console.log('');
  console.log(summary);
}
`;

eval(gamedata + "\n" + sim + "\n" + testBody);
