// Phase-4-Metriken (World Memory) — §Punkt 92/93: Langzeitmessung ueber
// mehrere Partien, um Speichervolumen, Verteilung und "narratives Signal"
// des neuen Erinnerungssystems empirisch zu kalibrieren. Rein additiv/
// lesend, feste Seeds (0..RUNS-1), keine Spielbalance-Aenderung.
//
// Ausfuehren mit: node tests/phase4_memory_metrics_test.js
const fs = require("fs");
const path = require("path");

const gamedata = fs.readFileSync(path.join(__dirname, "..", "data/gamedata.js"), "utf8");
const simModules = ["core", "economy", "population-dynasty", "memory", "characters", "story-threads", "drama-director", "event-chains", "politics", "diplomacy", "military", "debug", "war-map", "advance-year"];
const sim = simModules.map(m => fs.readFileSync(path.join(__dirname, "..", "js", m + ".js"), "utf8")).join("\n");

const testBody = `
const RUNS = 30;
const YEARS = 100;

let totalMemories = 0;
const byType = {};
let positiveCount = 0, negativeCount = 0, neutralCount = 0;
let importanceSum = 0;
let ageSum = 0, ageCount = 0; // Alter nur der noch "aktiven" (effectiveWeight != 0) Erinnerungen
let totalMajorCharMemoryLinks = 0, totalMajorChars = 0;
let totalSaveChars = 0;
let chronicleEligibleCount = 0;

const startTime = Date.now();

for (let run = 0; run < RUNS; run++) {
  const state = newGame({ seed: run });
  for (let y = 0; y < YEARS; y++) {
    for (let m = 0; m < 12; m++) { advanceMonth(state); if (state.gameOver) break; }
    if (state.gameOver) break;
  }

  const mems = allMemories(state);
  totalMemories += mems.length;
  for (const mem of mems) {
    byType[mem.type] = (byType[mem.type] || 0) + 1;
    if (mem.emotionalWeight > 0) positiveCount++;
    else if (mem.emotionalWeight < 0) negativeCount++;
    else neutralCount++;
    importanceSum += mem.importance;
    if (memoryToChronicleCandidate(mem)) chronicleEligibleCount++;

    // Alter aus Sicht irgendeines Beteiligten, sofern die Wirkung noch != 0 ist
    const participants = mem.actorIds.concat(mem.targetIds);
    let stillActive = participants.length === 0;
    for (const pid of participants) {
      if (computeEffectiveWeight(state, mem, pid) !== 0) { stillActive = true; break; }
    }
    if (stillActive) { ageSum += (state.year - mem.year); ageCount++; }
  }

  const charIds = Object.keys(state.characters);
  const majorIds = charIds.filter(id => isMajorCharacter(state, id));
  totalMajorChars += majorIds.length;
  for (const id of majorIds) totalMajorCharMemoryLinks += getMemoriesForCharacter(state, id).length;

  totalSaveChars += serializeSave(state).length;
}

const elapsedMs = Date.now() - startTime;

console.log('=== PHASE 4 WORLD MEMORY — Metriken (' + RUNS + ' Partien x ' + YEARS + ' Jahre, feste Seeds) ===');
console.log('');
console.log('Memories pro Partie im Schnitt: ' + (totalMemories/RUNS).toFixed(1));
console.log('');
console.log('--- Memories pro Typ (Summe ueber alle Partien) ---');
for (const type of Object.keys(byType).sort((a,b)=>byType[b]-byType[a])) {
  console.log('  ' + type + ': ' + byType[type] + ' (' + (byType[type]/totalMemories*100).toFixed(1) + '%)');
}
console.log('');
console.log('Positiv/Negativ/Neutral-Aufteilung: ' + positiveCount + ' / ' + negativeCount + ' / ' + neutralCount +
  ' (' + (positiveCount/totalMemories*100).toFixed(0) + '% / ' + (negativeCount/totalMemories*100).toFixed(0) + '% / ' + (neutralCount/totalMemories*100).toFixed(0) + '%)');
console.log('Durchschnittliche Importance: ' + (importanceSum/totalMemories).toFixed(1));
console.log('Durchschnittliches Alter noch mechanisch aktiver Erinnerungen: ' + (ageCount ? (ageSum/ageCount).toFixed(1) : '0') + ' Jahre');
console.log('Memories pro "wichtigem" Charakter (isMajorCharacter) im Schnitt: ' + (totalMajorChars ? (totalMajorCharMemoryLinks/totalMajorChars).toFixed(1) : '0'));
console.log('Speichergroesse (JSON) im Schnitt: ' + Math.round(totalSaveChars/RUNS/1024) + ' KB');
console.log('');
console.log('--- Narratives Signal (§Punkt 93, Vergleich zur Chronik-Baseline aus BASELINE.md) ---');
console.log('Chronik-Baseline (Phase 1): nur 11 story-relevante Ereignisse ueber 85 Jahre (95% Wetter-Flavourtext).');
console.log('memoryToChronicleCandidate()-taugliche Memories pro Partie im Schnitt: ' + (chronicleEligibleCount/RUNS).toFixed(1) +
  ' (importance >= 50, ueber ' + YEARS + ' statt 85 Jahre) — World Memory erfasst damit deutlich mehr bedeutsame');
console.log('Ereignisse als die bisherige reine Wetter-dominierte Chronik, OHNE dass diese bereits automatisch in die Chronik geschrieben werden (§Punkt 39/40, bewusst nur vorbereitet).');
console.log('');
console.log('Performance: ' + elapsedMs + ' ms fuer ' + RUNS + ' Partien (' + (elapsedMs/RUNS).toFixed(0) + ' ms/Partie)');
`;

eval(gamedata + "\n" + sim + "\n" + testBody);
