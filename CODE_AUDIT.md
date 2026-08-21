# CODE AUDIT — KAISERREICH (Phase 1 des "Next Generation"-Master-Prompts)

Stand: 2026-08-21. Diese Datei ist eine Bestandsaufnahme des tatsächlich
existierenden Codes — keine Wunschliste, keine Bewertung von Spielspaß
(dafür siehe GAME_DESIGN.md/ROADMAP.md). Ziel: verstehen, bevor irgendetwas
umgebaut wird (Regel aus dem Master-Prompt, Punkt 82: "Erst verstehen").

Für eine Bewertung gegen die ursprüngliche 105-Punkte-Spezifikation siehe
die bereits bestehende `STATUS_ANALYSE.md` — sie beantwortet "was ist
umgesetzt gegenüber der Spec" bereits sehr gründlich und wird hier nicht
dupliziert. Dieses Dokument beantwortet stattdessen "wie ist der Code
strukturiert, und wo sind die technischen Schwachstellen".

---

## 1. Dateiübersicht

| Datei | Zeilen | Rolle |
|---|---|---|
| `index.html` | 8.139 | Enthält 2 `<script>`-Blöcke: Block 1 (≈5.605 Zeilen) ist das gebündelte Ergebnis aller `js/*.js`+`data/gamedata.js`+`battle-engine/*.js`-Dateien (siehe Abschnitt 3), Block 2 (≈1.746 Zeilen, 88 Funktionen, 20 `addEventListener`) ist **reiner UI-Code, der nur in index.html existiert** — DOM-Rendering, Modal-Handling, Button-Handler. Dazwischen das komplette HTML/CSS (Comic-Renaissance-Design, ≈900 CSS-Regeln geschätzt). |
| `data/gamedata.js` | 2.054 | Alle reinen Datentabellen (`CONFIG`, `GOODS`, `PRODUCTION_CHAINS`, `BUILDINGS`, `POP_GROUPS`, `TROOP_TYPES`, `FORMATIONS`, `ADVISOR_ROLES`, `EXTRA_REGIONS`, `TERRITORIES`, `START_REGIONS`, `STRINGS`, `TITLES`, `TRAITS`, `EVENTS`) plus einige kleine Hilfsfunktionen (`t()`, `randomTraits()`, `randomStat()`, `createCharacter()`). `CONFIG` allein ist 464 Zeilen (6–470). |
| `js/core.js` | 321 | RNG (Mulberry32), Gebäude-Parzellen-Utilities, `makeRegion()`, `newGame()` (baut das komplette `state`-Objekt), Speichersystem (`serializeSave`/`deserializeSave`), `logLedger()`. |
| `js/economy.js` | 492 | Wetter, Produktion, Kornbilanz/-verderb, Marktpreise, Zufriedenheit, Regionalhandel, KI-Regionsentwicklung, Infrastruktur, Staatsschulden, Landkauf, Markthandel, Bestechungsrisiko, Forschung. Größte Einzeldatei nach `index.html`/`gamedata.js`. |
| `js/population-dynasty.js` | 236 | Bevölkerungsentwicklung (Geburt/Tod/Hunger/Seuche), Stadtentwicklungsstufen, Charakteraltern, Heirat, Geburt, Tod des Herrschers, Erbfolge/Erbstreit, Migration zwischen Regionen. |
| `js/politics.js` | 156 | Titelaufstieg, alternative Siegbedingungen, Kaiserwahl (Trigger/Bestechung/Auflösung), Regierungsstil, Religion. |
| `js/diplomacy.js` | 386 | 12 diplomatische Aktionen, Beziehungsupdate, Vasallisierung, 6 Intrigenarten, Spionage/Aufklärung, Kriegsverbündete. |
| `js/military.js` | ~290 | Berater (Anwerbung/Ausbau/Entlassung/Wirkung), Truppenaushebung, Armeestärke, Söldnerdesertion, KI-Kriegsentscheidung (`evaluateAiAggressionFactors`/`checkAiWarInitiative`), `declareWar()`. Die tote Belagerungslogik (`resolveSiegeStorm/Starve/Bribe`) wurde in Phase 2 entfernt, siehe Abschnitt 14. |
| `js/war-map.js` | 297 | Kriegskarte: 16 Gebiete, Truppenstationierung/-verlegung, Gebietsangriff über die Kampf-Engine, KI-Garnisonserholung/-gegenangriff, Regions-Eroberung → Vasallisierung. |
| `js/advance-year.js` | ~275 | **Der zentrale Orchestrator**: `advanceYear()` ist seit Phase 2 (Abschnitt 14) ein 6-zeiliger Aufrufer von `applyPreProductionBonuses()`/`processAllRegions()`/`updateEconomyAndDiplomacy()`/`applyRulerAndDynastyEffects()`/`updatePoliticsAndWar()`/`finalizeYear()`, plus `applyMonthlyFinances()`/`advanceMonth()` (Monatstakt-Wrapper). |
| `js/battle-bridge.js` | ~195 | Übersetzt zwischen Hauptspiel-Truppentypen und der Kampf-Engine (Armeeaufbau, Ergebnisanwendung), Geländebestimmung (`determineWarTerrain()`). Die tote Belagerungslogik (`startSiege/siegeStarve/siegeBribe`) wurde in Phase 2 entfernt, siehe Abschnitt 14. |
| `js/debug.js` | 63 | Debug-Helfer (Geld/Jahr setzen, Event/Charakter erzwingen), KI-Kriegsanalyse-Anzeige. |
| `battle-engine/battle-data.js` | 140 | Reine Kampf-Datentabellen (Einheitentypen, Konter, Gelände, Wetter, Formationen, Taktiken, Moralstufen, `BATTLE_CONFIG`). |
| `battle-engine/battle-engine.js` | 356 | Kampfberechnung: Effektivwerte, Konterboni, Verlustanwendung, Moral, Fluchtprüfung, Kommandanten-Ereignisse, KI-Formationswahl. |
| `battle-engine/battle-state-machine.js` | 292 | 6-Phasen-Zustandsautomat (Aufstellung→Fernkampf→Annäherung→Hauptkampf→Moralprüfung→Entscheidung), `simulateBattle()`. |
| `tests/battle_test.js` | 141 | 6 Testfälle für die Kampf-Engine (Gleichstand, Erfahrung, Konter, Gelände, Moral, Übermacht). Läuft autark (lädt nur `battle-engine/*` + eigenen `newTestArmy`-Helfer). |
| `tests/economy_test.js` | 61 | 20×100 Jahre Solo-Simulation, prüft Preisexplosion/Bevölkerungskollaps. **Kein fester Seed** (siehe Abschnitt 7). |
| `tests/ai_vs_ai_test.js` | 93 | 100×100 Jahre Simulation, prüft KI-Dominanzverteilung und passive Spieler-Titelprogression. **Kein fester Seed.** |
| `tests/baseline_analysis.js` | neu (Phase 1) | Siehe `BASELINE.md` — zusätzliches, additives Skript mit festen Seeds für reproduzierbare Referenzwerte. |
| `tools/data-sync.js` | ~150 | Synchronisiert 9 Datentabellen zwischen `data/gamedata.js` und `data/json/*.json` (Extract/Build), seit Phase 2 mit Pflichtfeld-Validierung vor jedem Schreiben (Abschnitt 14). |
| `tools/build-bundle.js` | neu (Phase 2) | Fest eingerichtetes Bundle-Build-Werkzeug mit Existenz-/Syntax-/Laufzeit-Rauchtest-Validierung, ersetzt das bisherige Ad-hoc-Inline-Rebuild-Skript (Abschnitt 14.2). |
| `battle.html`, `battle_standalone.html` | 312 / 1.088 | Eigenständige Kampf-Engine-Demos/Testseiten, unabhängig vom Hauptspiel. Nicht Teil des regulären Spielablaufs. |

**Ladereihenfolge des Bundles** (aus dem wiederkehrenden Rebuild-Skript,
siehe `DEVELOPMENT.md`): `data/gamedata.js` → `js/core.js` → `js/economy.js`
→ `js/population-dynasty.js` → `js/politics.js` → `js/diplomacy.js` →
`js/military.js` → `js/debug.js` → `js/war-map.js` → `js/advance-year.js`
→ `battle-engine/battle-data.js` → `battle-engine/battle-engine.js` →
`battle-engine/battle-state-machine.js` → `js/battle-bridge.js`. Diese
Reihenfolge ist **funktional relevant** (spätere Dateien nutzen Funktionen
aus früheren, z. B. braucht `advance-year.js` fast alle vorherigen Module) —
sie ist aber nirgends automatisch erzwungen; ein Modul, das versehentlich vor
einer Abhängigkeit eingefügt wird, würde erst zur Laufzeit mit einem
`ReferenceError` auffallen (kein Build-Fehler, kein Linter, kein
Abhängigkeitsgraph). Siehe Abschnitt 5, "versteckte Abhängigkeiten".

---

## 2. GameState — Single Source of Truth

`newGame()` in `js/core.js` baut ein einziges flaches `state`-Objekt (kein
Klassensystem, konsistent mit "Vanilla JS, kein Framework" aus dem
Master-Prompt). Die wichtigsten Felder:

- **Zeit**: `year`, `month` (1–12, Monatstakt via `advanceMonth()`)
- **Wirtschaft**: `treasury`, `debt`, `landPrice`
- **Regionen**: `regions.player` + `regions.ai1/ai2/ai3` (die 4 kriegsfähigen
  Kernregionen) + dynamisch angehängte `EXTRA_REGIONS`-Einträge (aktuell
  wenige zusätzliche, nicht-kriegsfähige Nachbarn). Jede Region trägt
  Bevölkerung (pro `POP_GROUPS`-Schlüssel), Lager (`warehouse`), Gebäude
  (Array von `{type, level, plotIndex}`), Steuersatz, Zufriedenheit,
  Regierungsstil, Landfläche, Preisrauschen, KI-Kommandant.
- **Charaktere**: `characters` (flaches Dictionary `id → Character`),
  `rulerId` zeigt auf den aktuell Herrschenden. Kein separates
  "Dynastie"-Objekt — die Dynastie ist implizit über `parentId`/`childrenIds`
  im Charakter-Graph codiert plus `stats.generations` als reiner Zähler.
- **Diplomatie/Intrigen**: `diplomacy` (pro AI-Region Beziehung + Verträge),
  `intel` (Aufklärungsgenauigkeit pro AI-Region), `vassals`.
- **Militär**: `army` (Hauptspiel-Truppenzahlen, aggregiert, keine
  Einzeleinheiten), `advisors`/`advisorLevels`.
- **Kriegskarte**: `territories` (von `initTerritories()` befüllt, 16
  Gebiete), `warState` (welche Regionen im Krieg sind).
- **Meta**: `chronicle` (Array von Textzeilen, harte Kappung bei 200
  Einträgen), `ledgerLog` (Kassenbuch-Einzelposten seit letztem
  Monatswechsel, wird bei jedem `applyMonthlyFinances()` geleert),
  `pendingEvent`/`pendingBirth`/`pendingMarriage`/`pendingElection` (die UI
  pollt diese Felder nach jedem Rundenschritt, um Modals zu öffnen), `stats`
  (Höchstwerte für die Spielende-Auswertung), `gameOver` (String-Flag:
  `"defeat"`/`"bankrupt"`/`"no_heir"`/`"victory"`/`null`).

**Wichtig für Phase 4/6 des Master-Prompts (World Memory, Drama
Director)**: Es gibt aktuell **keinerlei strukturierten "Erinnerungs"-
Speicher**. Die Chronik (`state.chronicle`) ist reiner, unstrukturierter
Anzeigetext (ein String pro Eintrag, kein Typ/Jahr/Beteiligte/Stärke-Feld,
keine Verknüpfung zu Charakteren oder Ereignissen). Alles, was der
Master-Prompt unter "WorldMemorySystem"/"Rivalensystem"/"StoryThreadSystem"
beschreibt, müsste komplett neu entstehen — es gibt keine Vorstufe davon im
Code, außer dass `diplomacy[aiId].relation` als einzelner Zahlenwert
(-100..+100) grob in diese Richtung zeigt, aber ohne Aufschlüsselung nach
Gründen (das vom Master-Prompt in Punkt 12 explizit bemängelte Muster
"Wilhelm → Friedrich = -62" statt einer Ursachen-Liste ist exakt der
Ist-Zustand).

### Globale (modul-level) Variablen außerhalb von `state`

- `js/core.js`: `__rngState`, `__rngCalls` (RNG-Zustand), `__charIdCounter`
  (nächste Charakter-ID).
- `battle-engine/battle-engine.js`: `__battleRngState` (eigener, komplett
  separater RNG-Zustand für die Kampf-Engine, nicht derselbe wie `rnd()`).

Diese globalen Variablen sind der Grund, warum `deserializeSave()` den RNG
nach dem Laden manuell "vorspulen" muss (`for (let i=0; i<rngCalls; i++)
rnd();`, `js/core.js:319`) statt den Zustand einfach aus dem Save zu
übernehmen — der RNG-Zustand selbst wird nicht mitgespeichert, nur die
Aufrufzahl. Funktioniert korrekt, ist aber eine versteckte Kopplung: Zwei
gleichzeitige `state`-Instanzen (z. B. für einen zukünftigen "Vergleiche
zwei Spielstände nebeneinander"-Debug-Modus oder Multiplayer) würden sich
denselben RNG-Zustand teilen und sich gegenseitig verfälschen. Für ein
Singleplayer-Browserspiel aktuell unproblematisch, aber ein Architektur-Fakt,
den man kennen muss, bevor man z. B. eine parallele Simulation zweiter
Spielstände für einen "Was-wäre-wenn"-Vergleich baut.

---

## 3. Simulationsloop

Zwei Taktebenen, sauber getrennt (`js/advance-year.js`):

1. **`advanceMonth(state)`** — der vom Spieler ausgelöste Schritt (Button
   "Monat vergehen lassen"). Ruft `applyMonthlyFinances()` auf (Steuern,
   Unterhalt, Beratergehälter, Schuldzinsen, Vasallentribut, Kassenbuch-
   Einzelposten — alles ÷12 der Jahresformel). Nach dem 12. Monat wird
   automatisch `advanceYear()` aufgerufen.
2. **`advanceYear(state)`** — ~123 Zeilen, **eine einzige Funktion, die
   praktisch jedes andere Modul orchestriert**: Wetter, Produktion,
   Kornbilanz, Preise, Zufriedenheit, Kornverteilung/-verderb, Bevölkerung,
   KI-Regionsentwicklung, Stadtentwicklung, Landpreis, Regierungsstil,
   Regionalhandel, Migration, Diplomatie-Update, Söldnerdesertion,
   Geistlicher-Bonus, Legitimitätserholung, Dynastie-Update,
   Prestige/Palast-Bonus, Charaktereigenschaften-Effekte, Titelaufstieg,
   Kaiserwahl-Trigger, Aufklärung, Religion, KI-Kriegsinitiative,
   Gebietsverstärkung/-gegenangriff, alternative Siegbedingungen,
   Statistik-Höchstwerte, Event-Auswahl, Game-Over-Prüfung.

   Das ist eine **sehr große Funktion mit sehr vielen Verantwortlichkeiten**
   (klassisches "God function"-Muster) — funktional unproblematisch (die
   Reihenfolge ist bewusst gewählt und in Kommentaren begründet, z. B. "vor
   der Produktionsberechnung anwenden"), aber der Haupt-Kandidat für Phase 2
   (Modularisierung), falls die Systeme wachsen sollen: eine Aufteilung in
   benannte Teilschritte (`resolveWeatherAndProduction(state)`,
   `resolvePopulationAndMigration(state)`, `resolvePoliticsAndDiplomacy(state)`
   o. ä.) würde die Lesbarkeit deutlich verbessern, ohne das Verhalten zu
   ändern — reines Ausschneiden in benannte Funktionen, keine Logikänderung.

Innerhalb der Region-Schleife von `advanceYear()` läuft für **jede** Region
(Spieler UND alle KI-Regionen) derselbe Kern (Wetter→Produktion→
Kornbilanz→Preise→Zufriedenheit→Kornverteilung→Verderb→Bevölkerung→
Stadtentwicklung) — die Simulation behandelt Spieler- und KI-Regionen
bewusst gleich (kein Sonderpfad, der der KI unfaire Vorteile gäbe), mit
`if (!r.isPlayer) aiRegionDevelops(r, state);` als einzigem Zusatzschritt
für KI-Regionen (automatische Bau-/Ausbauentscheidungen).

---

## 4. Systeme im Detail (Kurzreferenz)

- **Wirtschaft** (`js/economy.js`): Angebot/Nachfrage-Preisbildung pro Ware,
  23 Waren, Produktionsketten (2 davon echt mehrstufig), Wetter×Fruchtbarkeit,
  Kornbilanz mit Lagerkapazität/Verderb, lokaler Markt + Regionalhandel mit
  Transportkosten/Räuberrisiko, KI-Händler (Preisgefälle-Abbau), Landkauf/
  -verkauf mit spekulativem Landpreis, Staatsschulden mit variablem Zinssatz,
  Infrastruktur-Ausbau, Forschung (5 Kategorien).
- **Bevölkerung** (`js/population-dynasty.js`): 10 Gruppen, geburts-/
  sterberatenwirksame Faktoren (Zufriedenheit, Kornbilanz, Hunger, Seuche),
  vollständige Ursachenaufschlüsselung pro Gruppe (`lastPopBreakdown`),
  Migration zwischen allen simulierten Regionen (nicht nur zu/von einer
  abstrakten Außenwelt).
- **Dynastie** (`js/population-dynasty.js`): Ein einzelner "aktiver"
  Charakter (der Herrscher) plus Ehepartner/Kinder als Charakterobjekte.
  Altern/Gesundheit für ALLE lebenden Familienmitglieder (nicht nur den
  Herrscher). Heirat/Geburt/Tod rein wahrscheinlichkeitsbasiert nach Alter,
  keine Spielerentscheidung außer der nachträglichen Namensvergabe.
  Erbfolge: ältestes lebendes Kind, mit Erbstreit-Risiko bei nahe
  beieinanderliegenden Geschwistern. **Kein Erbe vorhanden → sofortiges
  Game Over** (`gameOver = "no_heir"`) — siehe BASELINE.md, das ist in der
  Praxis eine der häufigsten Spielende-Ursachen.
- **Titel/Politik** (`js/politics.js`): 10-stufige Titelleiter mit
  Mehrfachbedingungen, Kaiserwahl (Kurfürstenstimmen + Bestechung),
  Regierungsstil (seit Schritt 40 ein echter beidseitiger Regler),
  Religion als einzelne Kennzahl mit Drift zur Mitte.
- **Diplomatie** (`js/diplomacy.js`): 12 Aktionen (Geschenk, Pakte,
  Vasallisierung, Tribut, dynastische Heirat, Geiseltausch, Durchmarschrecht,
  Garantie, Friedensvertrag, Gebietsforderung), 6 Intrigenarten, Spionage.
  Beziehung ist ein einzelner Zahlenwert pro AI-Region, kein Ursachen-Log.
- **KI** (`js/military.js`, `js/economy.js`): Kein eigenständiges KI-Modul
  (kein `js/ai/*.js`) — KI-Verhalten ist über die jeweiligen Fachmodule
  verteilt (`aiRegionDevelops()` in economy.js für Bauentscheidungen,
  `checkAiWarInitiative()`/`evaluateAiAggressionFactors()` in military.js für
  Kriegsentscheidungen, `reinforceAiTerritories()`/`aiTerritoryCounterAttack()`
  in war-map.js für die Kriegskarte). Funktioniert, aber es gibt keine
  zentrale "KI-Persönlichkeit" pro Region (Ziele/Strategie), die diese
  Einzelentscheidungen verbindet — jede KI-Region trifft dieselben
  Entscheidungsformeln unabhängig, nur durch eigene Werte (Beziehung,
  Stärke, Zufriedenheit) unterschieden.
- **Militär/Kampf** (`js/military.js`, `js/battle-bridge.js`,
  `battle-engine/*`): Eigenständige, gut isolierte Kampf-Engine (6 Phasen,
  Formationen, Taktiken, Konter, Gelände, Wetter, Moral, deterministischer
  eigener RNG) — sauber vom Hauptspiel getrennt (kann über `battle.html`
  auch komplett unabhängig getestet werden). Kriegskarte (`js/war-map.js`)
  ist die strategische Ebene darüber (16 Gebiete, Truppenbewegung,
  gebietsweise Eroberung → automatische Vasallisierung bei Vollständigkeit).
- **Events** (`data/gamedata.js`, `EVENTS`-Array): 23 isolierte Events,
  Schema `{id, title, text, condition(r,state), options: [{label, apply(r,s)}]}`.
  **Keine Verkettung** — kein Event referenziert ein anderes, kein Event
  hinterlässt einen Zustand, den ein späteres Event abfragen könnte (außer
  über die ohnehin vorhandenen `state`-Felder wie Zufriedenheit). Genau ein
  Event pro Jahr maximal (`advanceYear()` bricht nach dem ersten
  zutreffenden Event ab, mit 60% Auslösewahrscheinlichkeit).
- **UI** (`index.html`, Block 2): 88 Funktionen, primär `render()`
  (schreibt den kompletten sichtbaren Zustand neu in den DOM — kein
  Diffing/Virtual DOM, bei jedem Rundenschritt komplett neu gerendert) plus
  `do*()`-Handler pro Aktion (rufen die Fachmodul-Funktion auf, dann
  `render()`). Reiter-Navigation (Provinz/Berater/Wirtschaft/Diplomatie/
  Karte/Militär), mehrere Modals (Geburt, Heirat, Kassenbuch, Titelfeier,
  Kampf, Kriegskarte).
- **Speicherstände** (`js/core.js`): `serializeSave()`/`deserializeSave()`,
  JSON-Export/Import als Datei (kein Browser-Storage). `SAVE_VERSION = 2`,
  aber **keine Migrationslogik** — ein Laden mit falscher Versionsnummer
  wirft einen harten `Error` statt den Spielstand zu migrieren oder
  wenigstens verständlich zu erklären, was zu tun ist. Genau die Lücke, die
  Punkt 75 des Master-Prompts ("Migrationen schreiben") direkt anspricht.
- **Tests** (`tests/*.js`): Drei bestehende Testdateien, siehe Abschnitt 7.

---

## 5. Kopplungen & versteckte Abhängigkeiten

- **Implizite Ladereihenfolge** (siehe Abschnitt 1): Funktioniert nur, weil
  das Rebuild-Skript die Dateien in der richtigen Reihenfolge konkateniert.
  Es gibt keine `import`/`require`-Deklarationen, die diese Abhängigkeit
  sichtbar machen — ein neuer Mitarbeiter (menschlich oder KI) könnte eine
  neue Datei an der falschen Stelle in die Liste einfügen, ohne dass
  irgendein Werkzeug das vor der Laufzeit bemerkt.
- **`data-sync.js` kennt nicht alle Datentabellen mehr** (siehe Abschnitt 6)
  — eine stille Kopplung zwischen "was in `gamedata.js` steht" und "was das
  Sync-Tool zu kennen glaubt", die inzwischen auseinandergedriftet ist.
- **UI ↔ Fachlogik**: Die UI liest Fachdaten oft direkt aus verschachtelten
  `state`-Pfaden (`state.regions.player.population.bauern.satisfaction` usw.)
  statt über klar benannte Getter-Funktionen. Funktioniert, macht aber jede
  spätere Umbenennung/Restrukturierung von `state`-Feldern zu einer Suche
  über die gesamte 8.139-Zeilen-`index.html` statt einer lokalisierten
  Änderung in einem Fachmodul.
- **`advisorEffectBonus()`/`techBonus()` werden an vielen Call-Sites separat
  aufgerufen** (economy.js, military.js, advance-year.js, diplomacy.js) statt
  einmal pro Rundenschritt zentral berechnet und weitergereicht — funktional
  korrekt (die Funktionen sind billig/zustandslos), aber ein Muster, das bei
  wachsender Anzahl Berater-/Technologie-Kategorien unübersichtlich werden
  kann.

## 6. Redundanter/toter Code

- **Doppelte Belagerungslogik**: `js/military.js` (`resolveSiegeStorm`,
  `resolveSiegeStarve`, `resolveSiegeBribe`, Zeilen 261–329) und
  `js/battle-bridge.js` (`startSiege`, `siegeStarve`, `siegeBribe`, Zeilen
  129–179) implementieren **nahezu identische Logik zweimal** in zwei
  verschiedenen Dateien, mit kleinen Abweichungen (z. B. unterschiedliche
  Untergrenzen für `defenderStrengthFactor`: 0.2 vs. 0.25; die
  `battle-bridge.js`-Version pflegt `warsWon`/`warsWonAgainst` bei
  erfolgreicher Bestechung, die `military.js`-Version nicht). Beide Pfade
  sind laut eigenem Kommentar in `military.js` **seit der Kriegskarte
  (Schritt 38) unbenutzt** — die Kriegskarte ersetzt die regionsweite
  Belagerung durch gebietsweise Angriffe mit automatischem "Burg"-
  Geländebonus. ~150 Zeilen toter, zusätzlich noch redundanter Code. Kann
  bei Bedarf (Punkt 27/Friedensverhandlung des Master-Prompts könnte
  Belagerungen als Gebietsmechanik reaktivieren wollen) als Ausgangspunkt
  dienen, sollte aber nicht in beiden Dateien parallel weitergepflegt
  werden.
- **`data/json/*.json` ist stiller gegenüber `data/gamedata.js` veraltet.**
  `tools/data-sync.js` kennt nur 9 Tabellen (`GOODS`, `PRODUCTION_CHAINS`,
  `BUILDINGS`, `POP_GROUPS`, `TROOP_TYPES`, `FORMATIONS`, `ADVISOR_ROLES`,
  `EXTRA_REGIONS`, `TITLES`). Seit deren letztem `extract`-Lauf sind aber:
  - **`ADVISOR_ROLES` inhaltlich weitergewachsen** (`baseCost`-Feld pro
    Rolle seit Schritt 40, veränderte Beschreibungstexte) — `data/json/
    advisor-roles.json` enthält weiterhin die alte Struktur OHNE `baseCost`
    und mit dem alten "(Beta)"-Text beim Spionagemeister. Ein Aufruf von
    `node tools/data-sync.js build` würde **`baseCost` aus `gamedata.js`
    stillschweigend entfernen** und damit `advisorUpgradeCost()`
    (`js/military.js:19`) mit `undefined * ...` kaputt machen — eine
    tickende Zeitbombe für jeden zukünftigen Mod-Workflow.
  - **`CONFIG`, `TERRITORIES`, `START_REGIONS`, `STRINGS`, `TRAITS`,
    `EVENTS`** wurden nie in die JSON-Modding-Schicht aufgenommen, obwohl
    `TERRITORIES`/`START_REGIONS` (Schritt 37/38) ihrer Natur nach reine
    Datentabellen sind, genau wie die 9 bereits erfassten. Modding-
    Unterstützung (§65/§79 der ursprünglichen Spec, als ✅ markiert) ist
    also **teilweise nur noch für den halben Datenbestand aktuell**.
  - **Empfehlung für Phase 2**: entweder `tools/data-sync.js` um die
    fehlenden/gewachsenen Tabellen erweitern (mit `extract` neu ziehen und
    committen), oder — falls der reale Nutzen des JSON-Roundtrips seit
    Einführung gering war — das System bewusst zurückbauen, statt es weiter
    stillschweigend veralten zu lassen. Nicht in Phase 1 selbst entscheiden.
- **`generateAdvisorCandidate()`** (`js/military.js:10`) erzeugt einen
  vollständigen Charakter mit Werten/Eigenschaften, aber `hireAdvisor()`
  nutzt aktuell **immer genau einen automatisch gewürfelten Kandidaten**,
  keine Auswahl zwischen mehreren — technisch kein toter Code (wird
  aufgerufen), aber die Funktion ist bereits genau der Baustein, den Punkt
  14 des Master-Prompts ("Berater-Kandidaten", 3 Kandidaten zur Wahl)
  fordert. Ausbaufähig ohne Neubau.

## 7. Tests, Determinismus, Baseline-Tauglichkeit

Alle drei Testdateien laden Quellcode per `fs.readFileSync` + `eval()`
(kein echtes Modulsystem, kein Bundler-Import) — funktioniert, weil die
Dateien ohnehin ohne `import`/`export` geschrieben sind (globale Funktionen/
Konstanten), ist aber ungewöhnlich fragil: ein Tippfehler in der
`simModules`-Liste (z. B. ein vergessenes neues Modul) fällt nur auf, wenn
der Test danach einen `ReferenceError` wirft, nicht vorher.

**Wichtigster Befund dieses Abschnitts:** `tests/economy_test.js` und
`tests/ai_vs_ai_test.js` rufen `newGame()` **ohne festen Seed** auf — die
Funktion zieht dann `generateFreshSeed()` (`Date.now() ^ Math.random()`,
`js/core.js:33`), also **echten** Zufall. Das bedeutet:

- Zwei Läufe derselben Testdatei auf demselben Code liefern unterschiedliche
  Zahlen (in diesem Audit z. B. lief `economy_test.js` einmal mit "6/20
  vollständig durchgelaufen" und bei einem früheren Lauf mit "10/20" — reine
  Stichprobenschwankung, kein Regressionssignal).
- Der Exit-Code (`process.exitCode = 1` sobald `failures.length > 0`) ist
  bei diesem Testdesign **praktisch immer 1**, weil "Preis nahe Obergrenze"
  bei 20 Partien so gut wie immer mindestens einmal vorkommt (laut
  `DEVELOPMENT.md` liegt der akzeptierte Referenzbereich selbst bei 2–6/20).
  Ein naives CI-Gate ("grün/rot am Exit-Code") würde diese Tests dauerhaft
  als "rot" anzeigen, obwohl das Verhalten im erwarteten Rahmen liegt — die
  Tests sind für **menschliche Lektüre der gedruckten Zahlen** gedacht,
  nicht für automatisches Pass/Fail. Das ist okay, sollte aber bewusst so
  dokumentiert sein (ist es bisher nicht explizit).
- Für eine **objektiv vergleichbare Baseline** (Punkt 4 des Master-Prompts)
  ist ungesteuerter Zufall ungeeignet. Deshalb wurde in Phase 1 zusätzlich
  `tests/baseline_analysis.js` angelegt — gleiche Simulation, aber mit
  festen Seeds `0..29`, siehe `BASELINE.md`. Die drei bestehenden Testdateien
  wurden dabei **nicht verändert** (Punkt 84: "keine funktionierenden
  Systeme zerstören").

`tests/battle_test.js` verwendet dagegen bereits einen festen Seed pro
Testfall (z. B. `seedBattleRng(42)`) und ist dadurch vollständig
reproduzierbar — ein gutes Vorbild für die beiden anderen Testdateien, falls
deren fehlende Reproduzierbarkeit später behoben werden soll (nicht in
Phase 1 selbst).

---

## 8. Magic Numbers

Die großen, spielrelevanten Stellschrauben liegen zentral in `CONFIG`
(`data/gamedata.js`, 464 Zeilen) — das erfüllt den Kern des Anspruchs "keine
Magic Numbers im Balancing". Bei genauerem Hinsehen gibt es aber durchgehend
**kleinere, in Formeln eingebettete Koeffizienten**, die nicht über `CONFIG`
laufen, z. B.:

- `js/military.js:116-120`: `buildingLevelSum(..., "kaserne") * 15`,
  `"stadtmauer") * 10`, `("markt")+("muehle")) * 2` — drei Gebäude-Kampfkraft-
  Multiplikatoren direkt im Code statt in `CONFIG.military`.
- `js/economy.js:69,122,156`: wiederkehrender Faktor `* 0.01` (Bedarf pro
  Kopf, Einheiten-Umrechnung) an drei Stellen separat hingeschrieben statt
  einmal benannt.
- `js/economy.js:306-307`: Landpreis-Drift nutzt `* 0.05` und `* 0.08` direkt
  neben den bereits vorhandenen `cfg.priceDriftStrength`-Werten aus `CONFIG`
  — vermischt konfigurierte und feste Anteile in derselben Formel.
- `js/advance-year.js:82`: `state.treasury -= state.treasury *
  drain * 0.01;` — zusätzlich zum Magic-Number-Befund hier **ohne
  `Math.round()`**, siehe nächster Punkt.

Das sind überwiegend Einheiten-Umrechnungsfaktoren (z. B. "Prozent" als
`*0.01`) statt echte Balancing-Stellschrauben — pragmatisch vertretbar, aber
inkonsistent mit dem selbst gesteckten Anspruch, wenn man ihn wörtlich
nimmt. Kein akuter Bug, aber ein Punkt für eine spätere Aufräumrunde.

## 9. Kleinerer Konsistenz-Fund: unrundende Staatskasse

`js/advance-year.js:82` (Charaktereigenschaft `treasuryDrain`, z. B. beim
Trait "verschwenderisch") verändert `state.treasury` **ohne** `Math.round()`
— im Gegensatz zu praktisch jeder anderen Stelle im Code, die `treasury`
verändert. Über viele Spieljahre akkumulieren sich dadurch
Fließkomma-Nachkommastellen in der Staatskasse (in der Baseline-Analyse
sichtbar: Endwerte wie `30065.651905913302` statt einer ganzen Zahl).
Kosmetisch (wird in der UI vermutlich sowieso gerundet dargestellt), aber
ein konkretes, leicht behebbares Konsistenzproblem für eine künftige
Aufräumrunde — kein Verhaltensrisiko, da der Wert nirgends auf exakte
Ganzzahligkeit geprüft wird.

## 10. Performance

Keine akuten Probleme gefunden. Zwei Dinge, die bei weiterem Wachstum
relevant werden könnten:

- **`deserializeSave()` spult den RNG durch erneutes Aufrufen von `rnd()`
  im Batch vor** (`js/core.js:319`, `for (let i=0; i<rngCalls; i++) rnd();`).
  Bei sehr langen Partien (mehrere hundert Spieljahre, viele Rundenschritte)
  wächst `rngCalls` linear mit; das Laden eines sehr alten Spielstands würde
  dann spürbar langsamer werden. Aktuell bei 100-Jahre-Testpartien nicht
  spürbar (Sekundenbruchteile), aber ein Punkt, den man im Auge behalten
  sollte, falls Kampagnen über 1450–1650+ (Punkt 33 der ursprünglichen Spec)
  Realität werden.
- **`render()` schreibt bei jedem Rundenschritt den kompletten DOM neu**
  (kein Diffing). Bei 8.139 Zeilen `index.html` und dutzenden Panels aktuell
  nicht spürbar langsam, aber ein klassischer Kandidat, falls die UI (Phase
  10 des Master-Prompts) um eine detailliertere Weltkarte mit vielen
  Einzelelementen wächst.

---

## 11. Zusammenfassung: was ist technisch solide, was ist der größte Hebel

**Solide, ohne akuten Handlungsbedarf**: Kampf-Engine (klar isoliert, gut
getestet, deterministisch), Datentrennung (`CONFIG`/`GOODS`/… als benannte
Tabellen statt verstreuter Literale), Kassenbuch-Ledger-System, Simulations-
Kohortenmodell (Performance), grundsätzliche Modul-Aufteilung von `js/*.js`
(im Vergleich zu einer einzigen Monolith-Datei bereits ein klarer Fortschritt).

**Die fünf konkretesten technischen Schwachstellen** (siehe auch die
Zusammenfassung, die dieser Bot nach Phase 1 laut Master-Prompt Punkt 90
liefern soll):

1. `advanceYear()` als ~123-Zeilen-God-Function mit zu vielen
   Verantwortlichkeiten (Abschnitt 3).
2. Doppelte, tote Belagerungslogik in zwei Dateien (Abschnitt 6).
3. `data/json/*.json`-Modding-Schicht ist gegenüber `gamedata.js`
   auseinandergedriftet, inkl. einer konkreten Datenverlust-Falle bei
   `ADVISOR_ROLES.baseCost` (Abschnitt 6).
4. Fehlende Seeds in zwei der drei Testdateien → keine reproduzierbare
   Baseline ohne das neue `baseline_analysis.js` (Abschnitt 7).
5. `index.html` Block 2 (1.746 Zeilen UI-Code) ist die einzige verbleibende
   "Monolith"-Datei — Kandidat für die in Phase 2/10 des Master-Prompts
   vorgeschlagene Aufteilung in `js/ui/*.js`, sobald das gewünscht wird.

Keiner dieser Punkte ist ein Spiel-Blocker — alle drei automatisierten Tests
laufen grün (im Sinne von "innerhalb der erwarteten Toleranzen"), das Spiel
ist vollständig spielbar. Das sind Wartbarkeits- und Erweiterbarkeits-
Befunde für die weiteren Phasen, keine Bugs, die sofortiges Handeln
erfordern.

---

## 12. Ergänzende Audit-Ergebnisse

Nachtrag nach der ersten Gesprächsrunde zu Phase 1 — konsolidiert die
mündlich erarbeiteten Befunde zu Architektur, Kopplung, Schutzbedarf und
einer ersten Militär-Balance-Hypothese dauerhaft in dieser Datei. Keine
neuen Erkenntnisse gegenüber Abschnitt 1–11, nur strukturiert und für den
Phase-2-Plan (Abschnitt 13) referenzierbar aufbereitet.

### Architektur (Kurzfassung)

- Vanilla JS ohne Framework.
- Ein flaches `state`-Objekt als Single Source of Truth.
- 10 Fachmodule unter `js/*.js`.
- `data/gamedata.js` als reine Datentabellen-Sammlung.
- Eine isolierte, eigenständig testbare Kampf-Engine unter `battle-engine/*.js`.
- Das Bundle aus allen genannten Dateien wird in den ersten `<script>`-Block
  von `index.html` integriert (siehe Abschnitt 1, Ladereihenfolge).
- Ein zweiter, separater UI-Block mit ca. 1.746 Zeilen existiert nur in
  `index.html` selbst.
- `advanceYear()` ist aktuell eine ca. 123 Zeilen große Funktion, die
  praktisch jedes Fachmodul orchestriert ("God function").
- Die Modul-Ladereihenfolge wird **nicht** technisch über Imports/Exports
  erzwungen, sondern ausschließlich implizit durch das Rebuild-Skript
  eingehalten (siehe Abschnitt 1).

**Ausdrückliche Bewertung**: `advanceYear()` ist ein **Refactoring-
Kandidat**, weil sie viele Verantwortlichkeiten in einer Funktion bündelt
und dadurch schwerer zu lesen/erweitern ist als nötig — sie ist **nicht
fehlerhaft**. Die Reihenfolge ihrer Teilschritte ist bewusst gewählt und in
Kommentaren begründet (z. B. Berater-Produktionsbonus vor der
Produktionsberechnung), alle drei automatisierten Tests laufen grün. Ein
Refactoring dient ausschließlich der Lesbarkeit/Wartbarkeit, nicht der
Fehlerbehebung.

### Enge Kopplungen / technische Risiken

1. Die UI (`index.html`, Block 2) greift an vielen Stellen direkt auf tief
   verschachtelte `state`-Pfade zu (z. B.
   `state.regions.player.population.bauern.satisfaction`) statt über
   benannte Getter-Funktionen.
2. Dadurch würde jede Änderung an einer `state`-Datenstruktur potenziell
   sehr viele UI-Stellen gleichzeitig betreffen — eine gezielte,
   lokalisierte Änderung ist aktuell nicht garantiert, eine Suche über die
   gesamte `index.html` schon.
3. Die Bundle-Reihenfolge der 13 Quelldateien ist implizit (nur durch das
   Rebuild-Skript korrekt, kein technischer Zwang, siehe Abschnitt 1/5).
4. `tools/data-sync.js` und `data/gamedata.js` sind bereits inhaltlich
   auseinandergelaufen (siehe Abschnitt 6).
5. Konkret: Das neue `baseCost`-Feld für Berater (seit Schritt 40) fehlt in
   der JSON-Moddatei `data/json/advisor-roles.json`.
6. Ein `node tools/data-sync.js build`-Lauf würde dadurch `baseCost` aus
   `data/gamedata.js` stillschweigend entfernen und `advisorUpgradeCost()`
   (`js/military.js:19`) mit `undefined * Math.pow(...)` beschädigen.
7. Es existiert doppelte, tote Belagerungslogik in `js/military.js`
   (`resolveSiegeStorm`/`resolveSiegeStarve`/`resolveSiegeBribe`) und
   `js/battle-bridge.js` (`startSiege`/`siegeStarve`/`siegeBribe`).
8. Beide Varianten besitzen leicht unterschiedliche Berechnungen (z. B.
   unterschiedliche Untergrenzen für `defenderStrengthFactor`: 0.2 vs. 0.25;
   nur die `battle-bridge.js`-Fassung pflegt `warsWon`/`warsWonAgainst` bei
   erfolgreicher Bestechung).
9. Das ist ein reines Wartungs- und Regressionsrisiko: Wird künftig nur
   eine der beiden Kopien angepasst (z. B. weil Belagerungen als
   Gebietsmechanik reaktiviert werden sollen), driften sie weiter
   auseinander, ohne dass ein Test das bemerken würde — keiner der drei
   bestehenden Tests deckt Belagerungscode ab.
   **Ergänzender Fund bei der Vertiefung**: Der komplette alte
   Belagerungspfad ist inzwischen **auch UI-seitig unerreichbar**. Die
   Render-Verzweigung `if (state.pendingSiege) {...}` (`index.html:7076`)
   und die Buttons für `doSiegeAction('storm'/'starve'/'bribe')`
   (`index.html:7079-7083`) existieren zwar weiterhin vollständig im UI-
   Code, aber `state.pendingSiege` wird nirgends mehr auf einen Wert
   gesetzt — die einzige Stelle, die das täte
   (`startSiege(state, aiId)` in `js/battle-bridge.js:129`), wird von
   **keiner** Stelle im gesamten Projekt aufgerufen (geprüft per Volltext-
   suche über `index.html` und `js/*.js`). Es handelt sich also nicht nur
   um zwei redundante Backend-Implementierungen, sondern um einen
   kompletten, seit der Kriegskarte (Schritt 38) unerreichbaren Ast inkl.
   UI — ohne jede Funktionseinbuße entfernbar, siehe Phase-2-Plan
   (Abschnitt 13).

### Systeme, die geschützt werden müssen

**DO NOT TOUCH WITHOUT REGRESSION TEST** — vor jeder Änderung an einem
dieser Systeme müssen `battle_test.js`, `economy_test.js`,
`ai_vs_ai_test.js` UND `baseline_analysis.js` vorher und nachher laufen,
mit Ergebnisvergleich gegen `BASELINE.md`:

- `battle-engine/*.js` — die eigenständige taktische Kampf-Engine
- Das Kohorten-Bevölkerungsmodell (`updatePopulation()` in
  `js/population-dynasty.js`)
- Die Preisbildungsformel (`computeRegionalPrices()` in `js/economy.js`)
- Das Ledger-/Kassenbuch-System (`logLedger()` in `js/core.js` und dessen
  Auswertung in `applyMonthlyFinances()`)
- Alle bereits kalibrierten `CONFIG`-Werte generell (mehrfache
  Kalibrierungsrunden, siehe `DEVELOPMENT.md`)
- Die Regierungsstil-Kalibrierung (`CONFIG.governance`,
  `applyGovernanceStyle()` in `js/politics.js` — Gegenstand der erst kürzlich
  behobenen Regression aus Schritt 40)
- Die Regionalhandel-Balance (`CONFIG.interregionalTrade`, Schritt 39)

### Potential Dominant Military Strategies (BALANCE HYPOTHESES — noch nicht bestätigt)

Analytischer Befund, **keine** empirische Multi-Agenten-Messung (die wäre
Gegenstand einer späteren Phase, siehe ROADMAP.md → EXPERIMENTAL/BALANCE
RESEARCH). Reine Kostenrechnung aus `TROOP_TYPES` (`data/gamedata.js`):

**Strategische Stärke pro Taler** (`cost / strength`):

| Einheit | Kosten | Stärke | Taler/Stärke |
|---|---|---|---|
| Pikeniere | 110 | 3 | **≈ 36,7** |
| Bogenschützen | 90 | 2 | 45 |
| Ritter | 400 | 8 | 50 |
| Söldner | 200 | 4 | 50 |
| Schwere Kavallerie | 650 | 12 | ≈ 54,2 |

**Hypothese**: Pikeniere könnten auf der strategischen Ebene (dort, wo
`armyStrength()` als reiner Summenwert in KI-Kriegsentscheidungen einfließt,
`js/military.js`) überproportional effizient sein — unabhängig davon, was
in der taktischen Kampf-Engine an Konterboni greift (Pikeniere kontern dort
gezielt Kavallerie, was diese Zahl relativiert, aber nicht auf der
strategischen Stärke-Summe wirkt).

**Zusätzlicher Befund**: `CONFIG.military.recruitPopCostPerUnit = 4` gilt
**unabhängig vom Truppentyp**. Dadurch kostet eine Schwere Kavallerie
(Stärke 12) genauso viele Bevölkerungsköpfe wie eine Bauernmiliz (Stärke 1)
— pro verbrauchtem Kopf ist Schwere Kavallerie also 12× effizienter als
Miliz, begrenzt nur durch verfügbare/zufriedene Adelsbevölkerung
(`minAdelSatisfaction`).

**Einordnung**: Diese Punkte sind ausdrücklich **Balance-Hypothesen, keine
bestätigten Fehler**. Für eine belastbare Aussage fehlen handelnde
KI-Agenten mit unterschiedlichen Armee-Kompositionen (reines Passivspiel,
wie in allen bestehenden Tests, trifft nie eine Rekrutierungsentscheidung).
**Keine Werte in dieser Phase verändern.**

---

## 13. Phase 2 — Technical Stabilization: Umsetzungsplan (noch NICHT ausgeführt)

Dieser Abschnitt ist ein **Plan**, kein durchgeführtes Refactoring — es
wurde in diesem Schritt kein Produktionscode verändert. Freigabe durch den
Nutzer steht noch aus.

### 13.1 Wie `advanceYear()` aufgeteilt werden soll

Reines **Extract-Method**-Refactoring: die bestehenden, bereits durch
Kommentare markierten Abschnitte werden 1:1 (keine Umsortierung, keine
Zusammenlegung von Schleifen, keine geänderte Bedingung) in benannte
Funktionen ausgeschnitten, die `advanceYear()` in exakt derselben
Reihenfolge aufruft wie bisher die Codeblöcke selbst standen:

```js
function advanceYear(state) {
  state.year += 1;
  state.pendingEvent = null;

  applyPreProductionBonuses(state);   // Berater-/Infrastruktur-/Tech-Boni, generateResearchPoints()
  processAllRegions(state);           // die komplette for-in-Schleife über state.regions
  updateEconomyAndDiplomacy(state);   // Landpreis, Regierungsstil, Regionalhandel, Migration, Diplomatie, Söldnerdesertion
  applyRulerAndDynastyEffects(state); // Geistlicher-Bonus, Legitimität, updateDynasty(), Prestige/Charaktereigenschaften
  updatePoliticsAndWar(state);        // Titel, Kaiserwahl-Trigger, Aufklärung, Religion, KI-Kriegsinitiative, Kriegskarte
  finalizeYear(state);                // Siegbedingungen, Statistik-Höchstwerte, Event-Auswahl, Game-Over-Prüfung

  return {};
}
```

### 13.2 Neue Funktionen (Signatur, jeweils `(state)`, keine Rückgabewerte
außer wo bereits vorhanden)

`applyPreProductionBonuses`, `processAllRegions`,
`updateEconomyAndDiplomacy`, `applyRulerAndDynastyEffects`,
`updatePoliticsAndWar`, `finalizeYear` — alle in `js/advance-year.js`,
direkt oberhalb von `advanceYear()` selbst.

### 13.3 Reihenfolge, die zwingend erhalten bleiben muss

Die exakte Aufrufreihenfolge **innerhalb** jeder neuen Teilfunktion UND die
Reihenfolge der sechs Teilfunktionen **zueinander** muss identisch zur
aktuellen Zeilenreihenfolge in `advanceYear()` bleiben. Besonders kritisch,
weil `rnd()` einen einzigen globalen Zufallsstrom verbraucht (siehe 13.6):

- Innerhalb von `processAllRegions`: pro Region **in Objekt-Iterationsreihenfolge**
  (`player → ai1 → ai2 → ai3 → ai4 → ai5 → ai6 → ai7`, siehe `newGame()`) exakt
  `rollWeather() → computeProduction() → computeGrainBalance() →
  updatePriceNoise() → computeRegionalPrices() →
  consumeAndUpdateSatisfaction() → applyExtraGrainDistribution() →
  applyGrainSpoilage() → updatePopulation() → (Manipulationsjahre-Abbau) →
  aiRegionDevelops() [nur KI] → updateSettlementTier()`.
- Die sechs Teilfunktionen selbst in der oben gezeigten Reihenfolge, da
  spätere Schritte auf Ergebnissen früherer aufbauen (z. B. `r.prices` aus
  `processAllRegions` wird von nichts danach neu berechnet, aber
  `state.regions.player` wird von `applyRulerAndDynastyEffects` und
  `updatePoliticsAndWar` weiter gelesen/verändert).

### 13.4 Zu berücksichtigende Seiteneffekte

- `state.regions.player.productionBonus`/`getreideTechBonus` werden in
  `applyPreProductionBonuses` gesetzt und von `processAllRegions`
  (`computeProduction`) gelesen — Reihenfolge zwischen diesen beiden
  Teilfunktionen ist also nicht nur eine Lesbarkeits-, sondern eine echte
  Datenabhängigkeit.
- `handelsberaterBonus` (in `applyPreProductionBonuses` berechnet) wird
  aktuell auch später nochmal implizit über `r._baseProductionBonus +
  handelsberaterBonus` in den Trait-Effekten (aktuell Teil von
  `applyRulerAndDynastyEffects`) verwendet — dieser Wert muss entweder
  erneut berechnet oder als Rückgabewert/`state`-Feld durchgereicht werden;
  keine Neuberechnung mit anderer Formel.
- `addChronicle()`-Aufrufe innerhalb der Region-Schleife dürfen ihre
  Positionsreihenfolge in `state.chronicle` nicht verändern (unshift-basiert
  — Reihenfolge ist bereits jetzt "neuestes zuerst pro Aufruf", muss gleich
  bleiben, sonst ändert sich scheinbar nur die Chronik-Anzeige, aber die ist
  spielerseitig sichtbar und Teil des durch `baseline_analysis.js`
  geprüften Verhaltens).

### 13.5 Tests vor und nach dem Umbau

1. Vor dem Umbau: `node tests/battle_test.js`, `node tests/economy_test.js`,
   `node tests/ai_vs_ai_test.js`, `node tests/baseline_analysis.js` je
   einmal laufen lassen und die Ausgabe archivieren (Baseline steht bereits
   in `BASELINE.md`, zusätzlich die aktuelle `economy_test.js`/
   `ai_vs_ai_test.js`-Ausgabe als Referenzlauf sichern, da diese nicht
   geseedet sind).
2. Nach dem Umbau: dieselben vier Kommandos erneut. `baseline_analysis.js`
   MUSS **zeichengenau** dieselbe Ausgabe liefern (fester Seed,
   deterministisch) — jede Abweichung ist ein Beweis für eine RNG-
   Reihenfolgeverschiebung und blockiert den Merge, bis behoben.
   `economy_test.js`/`ai_vs_ai_test.js` dürfen im üblichen Stichproben-
   Rahmen schwanken (siehe Abschnitt 7), sollten aber grob im selben
   Bereich wie vor dem Umbau liegen.
3. Zusätzlicher, spezifisch für dieses Refactoring neu zu schreibender Test
   (Teil von Phase 2, noch nicht existent): ein kleines Skript, das `state`
   zweimal mit identischem Seed über z. B. 20 Jahre laufen lässt — einmal
   mit der alten `advanceYear()` (aus dem Git-Stand vor dem Refactoring),
   einmal mit der neuen — und danach `JSON.stringify(state)` beider
   Endzustände auf Byte-Gleichheit vergleicht. Das ist der eigentliche
   Beweis, nicht nur die Testsuiten-Zusammenfassungen.

### 13.6 Garantie für RNG-Reihenfolge/Determinismus

`rnd()` (`js/core.js`) ist ein einziger globaler Zufallsstrom ohne
Rücksetzung zwischen Aufrufen. Jede Verschiebung der Aufrufreihenfolge
ändert ab diesem Punkt **alle** nachfolgenden Zufallswerte im gesamten
restlichen Spiel (nicht nur lokal) — das Refactoring darf daher
**ausschließlich** bestehende, zusammenhängende Codeblöcke unverändert in
neue Funktionen verschieben, niemals Anweisungen umordnen, zusammenfassen
oder vorziehen, selbst wenn das auf den ersten Blick harmlos aussieht (z. B.
"die beiden `techBonus()`-Aufrufe zusammenfassen" ist erlaubt, weil
`techBonus()` selbst kein `rnd()` verwendet — aber jede Umsortierung, die
eine `rnd()`-konsumierende Funktion vor eine andere zieht, ist verboten).
Konkret betroffene `rnd()`-Aufrufer innerhalb von `advanceYear()` (direkt
oder über aufgerufene Fachfunktionen), in ihrer aktuellen Reihenfolge:
`rollWeather` → `updatePriceNoise` → `consumeAndUpdateSatisfaction`
(pro Bevölkerungsgruppe) → `aiRegionDevelops` (nur KI-Regionen, mehrere
bedingte Aufrufe) → [Schleife wiederholt sich pro Region] →
`updateLandPrice` → `runInterregionalTrade`/`rollBanditRisk` →
`updateDiplomacy` (pro KI-Region) → `checkSoeldnerDesertion` (kein `rnd()`,
zur Sicherheit mitgeprüft) → `updateDynasty` (Altern/Heirat/Geburt/Tod,
mehrere bedingte Aufrufe) → `checkElectionTrigger` → `checkAiWarInitiative`
(pro KI-Region, mehrere bedingte Aufrufe inkl. `estimateAiStrength`) →
`aiTerritoryCounterAttack` → Event-Auswahlschleife (`ev.condition()` kann
selbst `rnd()` aufrufen, z. B. beim Event `seuche`, plus der abschließende
`rnd() < 0.6`-Wurf). Der unter 13.5 Punkt 3 beschriebene Byte-Vergleichstest
ist die verbindliche Absicherung dafür — nicht nur diese manuelle Auflistung,
die als Wegweiser dient, aber Fehler enthalten könnte.

### 13.7 Absicherung von `data-sync.js`

- `tools/data-sync.js` um die fehlenden Tabellen erweitern
  (`TERRITORIES`, `START_REGIONS`) oder — falls entschieden wird, den
  JSON-Roundtrip nicht weiterzuführen — das Sync-Tool und `data/json/*`
  bewusst als "eingefroren/veraltet" kennzeichnen, statt es weiter
  stillschweigend inkonsistent zu lassen. Diese Entscheidung selbst ist
  **nicht** Teil von Phase 2 selbst, sondern eine Vorfrage, die vor der
  technischen Umsetzung zu klären ist.
- Konkrete Behebung der `baseCost`-Drift: `node tools/data-sync.js extract`
  erneut laufen lassen, damit `data/json/advisor-roles.json` das aktuelle
  `baseCost`-Feld und die aktuellen Beschreibungstexte übernimmt — danach
  committen. Das ist unabhängig von der `advanceYear()`-Aufteilung und
  risikoarm (reine Datendatei, kein Codepfad).

### 13.8 Aktive vs. tote Belagerungslogik

Bei der Vertiefung für diesen Plan bestätigt: **Beide** Implementierungen
sind tot — nicht nur redundant zueinander, sondern beide komplett
unerreichbar. `startSiege(state, aiId)` (`js/battle-bridge.js:129`, die
einzige Stelle, die `state.pendingSiege` jemals setzt) wird von **keiner**
Stelle im gesamten Projekt aufgerufen (per Volltextsuche über `index.html`
und alle `js/*.js` bestätigt). Der `declareWar()`-Pfad (`js/military.js`)
setzt seit der Kriegskarte (Schritt 38) stattdessen `state.warState[aiId] =
true`. Folglich sind auch die UI-Verzweigung `if (state.pendingSiege)`
(`index.html:7076`) und die zugehörigen `doSiegeAction()`-Buttons
unerreichbar.

**Empfehlung für Phase 2**: `resolveSiegeStorm`/`resolveSiegeStarve`/
`resolveSiegeBribe` (`js/military.js`), `startSiege`/`siegeStarve`/
`siegeBribe` (`js/battle-bridge.js`) sowie die zugehörige unerreichbare
UI-Verzweigung können vollständig entfernt werden, **ohne** jede
Verhaltensänderung am spielbaren Spiel — reine Totcode-Entfernung, kein
Konsolidierungs-Kompromiss nötig. Nicht Teil dieses Plans selbst
(Entscheidung/Umsetzung wartet auf Freigabe), hier nur als gesicherter
Befund festgehalten.

### 13.9 Betroffene Dateien

- `js/advance-year.js` (Aufteilung von `advanceYear()`)
- `js/military.js` (falls Totcode-Entfernung mitgenommen wird)
- `js/battle-bridge.js` (falls Totcode-Entfernung mitgenommen wird)
- `index.html` (falls Totcode-Entfernung mitgenommen wird: unerreichbare
  Render-Verzweigung/Buttons; unabhängig davon in jedem Fall: Bundle-Rebuild
  nach jeder Änderung an den `js/*.js`-Dateien)
- `data/json/advisor-roles.json` (falls `data-sync.js`-Drift behoben wird)
- `tools/data-sync.js` (falls um fehlende Tabellen erweitert)
- Neu: ein kleines Vergleichsskript für den Byte-Gleichheits-Test (13.5,
  Punkt 3), vermutlich unter `tests/`

Kein einziger dieser Punkte wurde in diesem Schritt umgesetzt — reine
Planung, wartet auf Freigabe.

---

## 14. Phase 2 — Ergebnisse (ausgeführt, siehe Commits)

Der obige Plan (Abschnitt 13) wurde nach Freigabe durch den Nutzer
umgesetzt. Status je Punkt aus Abschnitt 12/13:

| Befund | Status |
|---|---|
| `advanceYear()` God-Function | **RESOLVED** — in 6 benannte Teilschritte zerlegt (`applyPreProductionBonuses`, `processAllRegions`, `updateEconomyAndDiplomacy`, `applyRulerAndDynastyEffects`, `updatePoliticsAndWar`, `finalizeYear`), reines Extract-Method, RNG-Determinismus über `tests/advance_year_snapshot_test.js` (3 Seeds, jahrgenau) bewiesen unverändert. |
| Data-Sync-Drift (`baseCost` fehlte in `advisor-roles.json`) | **RESOLVED** — `data/json/advisor-roles.json` neu extrahiert, `tools/data-sync.js` validiert jetzt vor jedem Schreiben Pflichtfelder für alle 9 Tabellen (kein stilles Datenverlust-Risiko mehr). |
| Doppelte tote Belagerungslogik (`military.js`/`battle-bridge.js`) | **REMOVED** — beide Implementierungen plus der unerreichbare UI-Pfad (`index.html`) entfernt, Unerreichbarkeit vor der Entfernung erneut verifiziert. |
| Implizite Bundle-Ladereihenfolge | **TEILWEISE ADRESSIERT** — siehe 14.1/14.2: fest eingerichtetes, validierendes `tools/build-bundle.js` statt eines Ad-hoc-Inline-Skripts; die Reihenfolge selbst bleibt (bewusst, siehe 14.1) unverändert bestehen, keine ES-Module-Migration. |
| UI-State-Kopplung (tiefe `state`-Pfad-Zugriffe) | **NICHT verändert** — außerhalb des Phase-2-Scopes (Punkt 26/27 der Phase-2-Anweisung: nur vorbereiten, keine Migration). Siehe 14.3 für die vorbereitete Getter-Liste. |
| Militär-Balance-Hypothesen (Pikeniere/Kavallerie) | **UNVERÄNDERT** — ausdrücklich außerhalb des Phase-2-Scopes, keine Werte angefasst. |

### 14.1 Modul-Abhängigkeiten (Dependency-Übersicht, Punkt 29)

Kleine, manuell erstellte Übersicht statt eines automatisierten
Abhängigkeitsgraphen (§Punkt 30: "nicht unnötig eskalieren"). Wichtige
Vorbemerkung, die die Dringlichkeit dieses Punkts relativiert:
**Funktionsdeklarationen (`function foo() {}`) werden von der JS-Engine
innerhalb des gesamten gemeinsamen Auswertungsbereichs gehoisted** — da
alle 14 Dateien zu EINEM `<script>`-Block bzw. EINEM `eval()`-Aufruf
konkateniert werden, können sich Funktionen in der Praxis bereits jetzt
unabhängig von der Dateireihenfolge gegenseitig aufrufen. Die
Ladereihenfolge ist trotzdem nicht beliebig — sie ist relevant für:

- **Top-Level-`const`-Deklarationen, die beim Laden sofort einen Wert
  aus einer anderen Datei lesen** (nicht nur eine Funktion definieren).
  Das betrifft praktisch nur `data/gamedata.js` selbst: `STRINGS`,
  `TITLES`, `TRAITS`, `EVENTS` etc. sind reine Literale ohne
  Fremdreferenzen, aber `battle-engine/battle-data.js` deklariert einige
  Top-Level-Konstanten (`BATTLE_CONFIG` u. a.), die nur battle-eigene
  Werte referenzieren — daher muss `battle-data.js` vor
  `battle-engine.js`/`battle-state-machine.js` stehen (beide lesen
  Battle-Datentabellen beim Modulaufbau nicht sofort, sondern erst
  innerhalb von Funktionsaufrufen zur Laufzeit — auch hier greift die
  Hoisting-Entspannung).
- **Reine Lesbarkeit/Konvention**: `data/gamedata.js` zuerst, weil sie
  die von praktisch jeder Funktion referenzierten Datentabellen
  (`CONFIG`, `GOODS`, `POP_GROUPS`, …) enthält — auch wenn diese
  Referenzen dank Hoisting technisch erst zur Laufzeit (nicht beim Laden)
  aufgelöst werden, macht das lineare Layout die Datei leichter
  nachvollziehbar.
- **`js/advance-year.js` muss nach allen Fachmodulen stehen**, deren
  Funktionen sie direkt beim eigenen Aufbau nutzt — auch das ist wegen
  Hoisting technisch nicht zwingend, bleibt aber die etablierte,
  getestete Konvention (siehe Kommentar am Dateianfang).

**Grob zusammengefasst** (Pfeil = "wird von den Funktionen darin
verwendet"):

```
data/gamedata.js  (CONFIG, GOODS, POP_GROUPS, BUILDINGS, TROOP_TYPES, …)
      ↓
js/core.js  (rnd(), clamp(), newGame(), makeRegion(), logLedger() …)
      ↓
js/economy.js, js/population-dynasty.js, js/politics.js, js/diplomacy.js,
js/military.js, js/debug.js, js/war-map.js
      (nutzen core.js + gamedata.js + z.T. gegenseitig, z.B.
       military.js -> advisorEffectBonus() wird von advance-year.js
       gebraucht; war-map.js -> buildTerritoryBattleArmies() nutzt
       battle-bridge.js-Funktionen zur Laufzeit)
      ↓
js/advance-year.js  (orchestriert praktisch alle oben genannten Module)
      ↓
battle-engine/battle-data.js -> battle-engine.js -> battle-state-machine.js
      (eigenständig, kaum Rückbezüge zum Hauptspiel)
      ↓
js/battle-bridge.js  (Brücke zwischen Hauptspiel-Truppentypen/`state`
                       und der Kampf-Engine — braucht BEIDE Seiten)
```

**Fazit**: Die Reihenfolge ist überwiegend Konvention/Lesbarkeit, nicht
technischer Zwang (dank Hoisting) — mit der einen echten Einschränkung,
dass `battle-bridge.js` sowohl Kampf-Engine-Funktionen als auch
Hauptspiel-Funktionen aufruft und daher nach beiden Gruppen stehen muss.
Eine ES-Module-Migration (die diese Unklarheit technisch explizit machen
würde) ist bewusst **nicht** Teil von Phase 2 (§Punkt 30).

### 14.2 Build-Validierung (Punkt 31)

Neu: `tools/build-bundle.js` ersetzt das bisherige Ad-hoc-Inline-Rebuild-
Skript (das nach jeder `js/*.js`-Änderung von Hand im Terminal
eingegeben wurde, siehe die vorherigen Schritte in `DEVELOPMENT.md`)
durch ein festes, committetes Werkzeug. Prüft vor jedem Schreiben:

1. Alle 14 Quelldateien existieren.
2. Der gebündelte Code ist syntaktisch gültig (`new Function()`-Check).
3. **Laufzeit-Rauchtest**: das Bundle wird in einem `vm`-Sandbox-Kontext
   tatsächlich ausgeführt — `newGame()` + 12× `advanceMonth()` (damit
   `advanceYear()` mindestens einmal durchläuft) — und muss dabei
   fehlerfrei durchlaufen. Das ist der eigentliche Beweis für "Reihenfolge
   funktioniert", nicht nur "Syntax ist gültig" (ein reiner Syntax-Check
   hätte einen `ReferenceError` durch eine fehlende Datei nicht erkannt).

**Bei der Entwicklung dieses Prüfschritts selbst eine reale Schwachstelle
gefunden und behoben**: die erste Fassung rief `advanceMonth()` nur
einmal auf und hätte daher einen Fehler innerhalb von `advanceYear()`
NICHT erkannt (der 12. Monat, der `advanceYear()` auslöst, wurde nie
erreicht) — verifiziert durch einen bewussten Testfehler
(`rollWeather()` künstlich kaputt gemacht): die erste Fassung ließ den
Build trotzdem grün durch, die korrigierte Fassung (12× `advanceMonth()`)
erkennt denselben Fehler zuverlässig mit vollständigem Stacktrace. Beide
Testfälle (fehlende Datei, kaputte Funktion) wurden manuell durchgespielt
und danach der Originalzustand wiederhergestellt, bevor `index.html`
regulär neu gebaut wurde.

Bewusst NICHT Teil dieses Werkzeugs: ein automatischer Daten-Sync-Check
(bleibt ein eigener, bewusster Schritt über `tools/data-sync.js`, siehe
dessen Kopfkommentar) — Bundle-Build und Daten-Sync sind unterschiedliche
Aktionen mit unterschiedlicher Absicht (eine schreibt `index.html`, die
andere `data/gamedata.js`), eine automatische Kopplung würde beide
Werkzeuge unnötig verkomplizieren.

### 14.3 Vorbereitete Getter/Selector-Liste (Punkt 26/27 — NICHT umgesetzt)

Rein vorbereitend dokumentiert, keine Migration durchgeführt. Falls eine
spätere Phase die UI-State-Kopplung angeht, sind das plausible erste
Kandidaten (aus den am häufigsten wiederkehrenden `index.html`-Zugriffs-
mustern):

- `getPlayerRegion(state)` → `state.regions.player`
- `getPlayerPopulationGroup(state, groupId)` → `state.regions.player.population[groupId]`
- `getPlayerTreasury(state)` → `state.treasury`
- `getRegionEconomy(state, regionId)` → `{ prices, warehouse, taxRate }` der jeweiligen Region
- `getRuler(state)` → `state.characters[state.rulerId]`
- `getAdvisor(state, role)` → `state.characters[state.advisors[role]]` (oder `null`)

Keine dieser Funktionen wurde angelegt — reine Dokumentation für eine
spätere, separat freizugebende Phase.

---

## 15. Ergänzende Audit-Ergebnisse — Phase 3 (Character Core)

Neue Datei `js/characters.js` (siehe DEVELOPMENT.md für den vollständigen
Funktionsumfang). Keine Architektur-Regression, aber drei neue,
beobachtbare technische Punkte:

1. **O(n²)-Beziehungsaktualisierung**: `updateCharacterCore()` berechnet
   pro wichtigem Charakter die Beziehung zu jedem anderen wichtigen
   Charakter neu (verschachtelte Schleife über `getImportantCharacterIds()`).
   Bei der aktuellen Größenordnung (typischerweise 5-10 wichtige Charaktere:
   Herrscher, Ehepartner, Kinder, Geschwister, bis zu 6 Berater) unkritisch
   (siehe `phase3_metrics_test.js`: ~70ms/Partie bei 100 Jahren, keine
   spürbare Verschlechterung gegenüber Phase 2). Ein Beobachtungspunkt,
   falls "wichtige Charaktere" in einer späteren Phase deutlich wächst
   (z. B. durch mehr KI-Dynastien, §Punkt 42 des Master-Prompts).
2. **`advisor.loyalty` ist bis zu ein Jahr "veraltet"**: `loyalty` wird nur
   einmal jährlich in `updateCharacterCore()` neu berechnet, nicht bei
   jeder Aktion. Ein frisch berufener Berater hat daher bis zum nächsten
   Jahreswechsel den Default-Wert 50 (statt seiner tatsächlichen, aus
   Familie/Ereignissen abgeleiteten Loyalität) — beeinflusst
   `advisorEffectBonus()` geringfügig (Faktor 0,7-1,0×) im ersten Amtsjahr.
   Bewusst so belassen (kein zusätzlicher Rechenaufwand pro Monat für einen
   Randfall), aber hier dokumentiert, falls es später verwirrend auffällt.
3. **RNG-Verschiebung durch neue Charakterfelder**: `createCharacter()`
   würfelt jetzt 2 zusätzliche Skills (`finanzen`/`intrige`) — verschiebt
   den gesamten nachfolgenden Zufallsstrom ab dem ersten erzeugten
   Charakter. Erwartet und laut Phase-3-Auftrag ausdrücklich erlaubt
   (§Punkt 47), das alte Golden-Fixture wurde versioniert statt gelöscht
   (`tests/fixtures/advance_year_snapshot_golden_phase2.json`), ein neues
   erzeugt. Interessanter Nebenbefund: in rein passivem Spiel (keine
   Spieleraktion) werden nie Berater angeworben, wodurch die neuen
   Todes-/Kandidaten-Würfe dort nie ausgelöst werden — die reine
   Passivspiel-`no_heir`-Rate blieb dadurch exakt bei den bekannten 53%.

**DO-NOT-TOUCH-Liste aus Abschnitt 12 bleibt unverändert gültig** — keines
der geschützten Systeme wurde in Phase 3 verändert (Kampf-Engine,
Kohorten-Bevölkerungsmodell, Preisbildung, Ledger-System, kalibrierte
CONFIG-Werte, Regierungsstil-/Regionalhandel-Balance). Neu kalibrierte
CONFIG-Werte in Phase 3 (`CONFIG.advisors.tenureBonusPerLevel`) sind
ausschließlich Beratermechanik-intern und betreffen keinen der
geschützten Bereiche.
