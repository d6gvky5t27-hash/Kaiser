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
| `js/military.js` | 329 | Berater (Anwerbung/Ausbau/Entlassung/Wirkung), Truppenaushebung, Armeestärke, Söldnerdesertion, KI-Kriegsentscheidung (`evaluateAiAggressionFactors`/`checkAiWarInitiative`), `declareWar()`, **plus toter Code**: `resolveSiegeStorm/Starve/Bribe` (siehe Abschnitt 6). |
| `js/war-map.js` | 297 | Kriegskarte: 16 Gebiete, Truppenstationierung/-verlegung, Gebietsangriff über die Kampf-Engine, KI-Garnisonserholung/-gegenangriff, Regions-Eroberung → Vasallisierung. |
| `js/advance-year.js` | 227 | **Der zentrale Orchestrator**: `advanceYear()` (jährlicher Rundenschritt, ruft praktisch jedes andere Modul auf), `applyMonthlyFinances()`, `advanceMonth()` (Monatstakt-Wrapper). |
| `js/battle-bridge.js` | 240 | Übersetzt zwischen Hauptspiel-Truppentypen und der Kampf-Engine (Armeeaufbau, Ergebnisanwendung), Geländebestimmung, **plus toter Code**: `startSiege/siegeStarve/siegeBribe` (Duplikat zu `js/military.js`, siehe Abschnitt 6). |
| `js/debug.js` | 63 | Debug-Helfer (Geld/Jahr setzen, Event/Charakter erzwingen), KI-Kriegsanalyse-Anzeige. |
| `battle-engine/battle-data.js` | 140 | Reine Kampf-Datentabellen (Einheitentypen, Konter, Gelände, Wetter, Formationen, Taktiken, Moralstufen, `BATTLE_CONFIG`). |
| `battle-engine/battle-engine.js` | 356 | Kampfberechnung: Effektivwerte, Konterboni, Verlustanwendung, Moral, Fluchtprüfung, Kommandanten-Ereignisse, KI-Formationswahl. |
| `battle-engine/battle-state-machine.js` | 292 | 6-Phasen-Zustandsautomat (Aufstellung→Fernkampf→Annäherung→Hauptkampf→Moralprüfung→Entscheidung), `simulateBattle()`. |
| `tests/battle_test.js` | 141 | 6 Testfälle für die Kampf-Engine (Gleichstand, Erfahrung, Konter, Gelände, Moral, Übermacht). Läuft autark (lädt nur `battle-engine/*` + eigenen `newTestArmy`-Helfer). |
| `tests/economy_test.js` | 61 | 20×100 Jahre Solo-Simulation, prüft Preisexplosion/Bevölkerungskollaps. **Kein fester Seed** (siehe Abschnitt 7). |
| `tests/ai_vs_ai_test.js` | 93 | 100×100 Jahre Simulation, prüft KI-Dominanzverteilung und passive Spieler-Titelprogression. **Kein fester Seed.** |
| `tests/baseline_analysis.js` | neu (Phase 1) | Siehe `BASELINE.md` — zusätzliches, additives Skript mit festen Seeds für reproduzierbare Referenzwerte. |
| `tools/data-sync.js` | 112 | Synchronisiert 9 Datentabellen zwischen `data/gamedata.js` und `data/json/*.json` (Extract/Build). **Veraltet gegenüber `gamedata.js`**, siehe Abschnitt 6. |
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
