# ROADMAP

Struktur seit Phase 1 des "KAISERREICH – Next Generation"-Master-Prompts
(Punkt 81): CURRENT / NEXT / LATER / EXPERIMENTAL. Die bereits
abgeschlossene Historie (MVP/Alpha/Beta) bleibt unten als Archiv erhalten,
da sie den bisherigen Weg dokumentiert und in `DEVELOPMENT.md` referenziert
wird.

**Arbeitsregel** (Punkt 82/83 des Master-Prompts): Neue Feature-Ideen, die
während der Arbeit an etwas anderem auftauchen, werden hier unter
EXPERIMENTAL eingetragen statt sofort implementiert. Bestehende Systeme
werden zuerst fertiggestellt/gefestigt, bevor neue Breite hinzukommt.

---

## CURRENT (gerade abgeschlossen / unmittelbare Basis)

- [x] Phase 1 (Master-Prompt "Next Generation"): Code-Audit
      (`CODE_AUDIT.md`), reproduzierbare Baseline (`BASELINE.md`,
      `tests/baseline_analysis.js`), `GAME_DESIGN.md`/`ROADMAP.md`
      aktualisiert.
- [x] **Phase 2 — Technical Stabilization** (Ergebnisse: CODE_AUDIT.md
      Abschnitt 14, Ablauf: DEVELOPMENT.md "Phase 2"): `advanceYear()` in
      6 benannte Teilschritte zerlegt (reines Extract-Method, RNG-
      Determinismus über `tests/advance_year_snapshot_test.js` — 3 feste
      Seeds, jahrgenau byte-identisch — bewiesen), Data-Sync-Drift
      (`baseCost`) behoben + Pflichtfeld-Validierung ergänzt, tote
      Belagerungslogik (military.js/battle-bridge.js + UI-Pfad) entfernt,
      `tools/build-bundle.js` als validiertes Build-Werkzeug neu
      eingerichtet. Keine Balance-/CONFIG-/Gameplay-Werte verändert,
      Kampf-Engine unangetastet. **Offen geblieben (bewusst außerhalb
      des Phase-2-Scopes, siehe unten unter NEXT):** ob `TERRITORIES`/
      `START_REGIONS` in `tools/data-sync.js` aufgenommen werden sollen.
      **Phase 3 wurde NICHT begonnen** — wartet auf ausdrückliche
      Freigabe.
- [x] **Phase 3 — Character Core** (Ergebnisse: CODE_AUDIT.md Abschnitt 15,
      GAME_DESIGN.md → "Character Core", Ablauf: DEVELOPMENT.md "Phase 3"):
      bestehendes Charaktermodell additiv erweitert (kein zweites
      paralleles Modell) — Beziehungen mit nachvollziehbaren Einzelgründen,
      Loyalität getrennt von Beziehung, vereinfachtes Claim-System (ein
      Titel, primary/strong/weak), Rivalitäten (selten, ~1,2/100-Jahre-
      Partie), 12 neue datengetriebene Traits, Berater mit echter
      Kandidatenauswahl (2-4 Personen statt Auto-Zuweisung) und
      skill/trait/loyalitätsbasierter Wirkung statt reiner Stufen-
      Multiplikation, Savegame-Migration v2→v3, neuer Charakter-Inspektor
      im Debug-Bereich. RNG-Golden-Fixture erwartungsgemäß neu erzeugt
      (altes Fixture versioniert, nicht gelöscht). Keine bestehenden
      Balance-/CONFIG-Werte außerhalb der Beratermechanik verändert,
      Kampf-Engine unangetastet. Offen geblieben (bewusst außerhalb des
      Phase-3-Scopes): `TRAITS` nicht in `tools/data-sync.js` aufgenommen
      (dieselbe offene Frage wie bei `TERRITORIES`/`START_REGIONS`, siehe
      Tech-Debt-Punkt unten).
- [x] **Phase 4 — World Memory** (Ergebnisse: GAME_DESIGN.md → "World
      Memory (Phase 4)", Ablauf: DEVELOPMENT.md "Phase 4"): neues Modul
      `js/memory.js` (`recordWorldEvent()` als zentraler Hook, 23
      Erinnerungstypen über Dynastie/Hof/Diplomatie/Krieg/Politik,
      Zerfall ohne Löschen, Trait-Einfluss auf Zerfall/Gewichtung). Die
      drei bisherigen Phase-3-Beziehungs-Fixwerte (Amt verweigert,
      Erbfolge übergangen, Rivalität) wurden vollständig auf live
      zerfallende Memory-Werte umgestellt (keine Doppelbuchführung).
      Savegame-Migration v3→v4 (leerer Speicher für Altspielstände, keine
      retroaktive Fiktion). Verbraucht nachweislich 0 zusätzliche
      `rnd()`-Aufrufe (Golden-Fixture bestätigt: nur zwei neue,
      erwartete Chronik-Zeilen, keine numerische Abweichung — altes
      Fixture versioniert, nicht gelöscht). Memory-Debug-Panel +
      Charakter-Inspektor-Erweiterung ("ERINNERUNGEN"-Abschnitt). World
      Memory bleibt ausdrücklich getrennt von der Chronik (95%-Wetter-
      Problem aus `BASELINE.md` unangetastet). Offen geblieben (bewusst
      außerhalb des Phase-4-Scopes): `MEMORY_TYPES` nicht in
      `tools/data-sync.js` aufgenommen (dieselbe offene Frage wie bei
      `TRAITS`, siehe Tech-Debt-Punkt unten).
- [x] **Phase 5 — Event Chains** (Ergebnisse: GAME_DESIGN.md → "Event
      Chains (Phase 5)", Ablauf: DEVELOPMENT.md "Phase 5"): neues Modul
      `js/event-chains.js` mit 10 hochwertigen, mehrjährigen Ketten (Der
      übergangene Erbe, Der gekränkte Berater, Unregelmäßigkeiten in der
      Staatskasse, Hungerkrise, Handelskonflikt, Grenzzwischenfall,
      Heiratsangebot, Kirchlicher Konflikt, Aufsteigender Rivale,
      Kaiserliche Ambitionen) statt der bisherigen 23 isolierten
      Einzelevents. Läuft über die bestehende Event-UI (kein zweites
      Eventsystem), nutzt World Memory als Auslöser UND Folge, höchstens
      3 aktive Ketten gleichzeitig, KEIN Drama Director. Savegame-
      Migration v4→v5 (leerer Chain-Speicher, keine retroaktive Fiktion).
      RNG-Golden-Fixture erwartungsgemäß neu erzeugt (Phase-4-Fixture
      versioniert, nicht gelöscht) — Event Chains verbrauchen bewusst neue
      `rnd()`-Aufrufe, anders als Phase 4. Event-Chain-Debug-Panel +
      "warum (nicht) gestartet?"-Prüfer.
- [x] **Phase 6 — Story Threads + Drama Director** (Ergebnisse:
      GAME_DESIGN.md → "Story Threads & Drama Director (Phase 6)", Ablauf:
      DEVELOPMENT.md "Phase 6"): neue Module `js/story-threads.js` (8
      Thread-Typen, RNG-freie Signal-Erkennung, DORMANT→BUILDING→ACTIVE→
      CLIMAX→AFTERMATH→RESOLVED/EXPIRED, Dedup pro Typ+Beteiligte,
      Reaktivierung Jahrzehnte später möglich) und `js/drama-director.js`
      (reiner Kurator — priorisiert nur bereits plausible Entwicklungen,
      erfindet nie welche; konfigurierbare Tension-Formel statt Blackbox;
      ersetzt Phase 5s feste Chain-Startreihenfolge durch einen
      Director-Score, OHNE die Eligibility-Wahrheit anzutasten). Beide
      zentralen Anti-Rubberbanding-Tests aus dem Auftrag bestanden: ein
      durchweg stabiler, erfolgreicher Zustand erzeugt nachweislich keine
      neue Chain/keinen neuen Konfliktthread; ein objektiv dramatischer
      Zustand wird zuverlässig als Fokus-Thread mit hoher Tension erkannt.
      Savegame-Migration v5→v6 (leere Speicher, keine retroaktive
      Fiktion). RNG-Golden-Fixture erwartungsgemäß neu erzeugt
      (Phase-5-Fixture versioniert, nicht gelöscht) — Thread
      Discovery/Director selbst sind RNG-frei, aber die Director-basierte
      Chain-Auswahl kann den bestehenden Phase-5-Timing-Wurf auf eine
      andere Chain verschieben. Story-Thread- + Drama-Director-Debug-Panel.
      Offen geblieben (bewusst dokumentiert, nicht in dieser bereits sehr
      umfangreichen Phase zusätzlich vertieft): Thread-`resolution`
      unterscheidet noch nicht zwischen friedlichem und eskalations-
      bedingtem Ende. **Phase 7 wurde NICHT automatisch begonnen** —
      wartet auf ausdrückliche Freigabe (§Phase-6-Punkt 113/119).
- [x] **Phase 7 — Narrative Calibration & Chronicle 2.0** (Ergebnisse:
      GAME_DESIGN.md → "Dynasty Chronicle 2.0 (Phase 7)", Ablauf:
      DEVELOPMENT.md "Phase 7"): reine Kalibrierungs-Phase, keine neuen
      Spielsysteme. Importance 2.0 (additive, nachvollziehbare
      12-Komponenten-Formel statt einer Blackbox, behebt einen
      Null-Varianz-Bug, der `SUCCESSION_CONFLICT`/`PERSONAL_RIVALRY`-
      Threads pro Typ auf exakt denselben Wert eingefroren hatte — Anteil
      `importance>=50` steigt von 2,6% auf 56% im 30×100-Jahre-Audit).
      Resolution 2.0 (`thread.resolution` jetzt strukturiert:
      type/tone/outcome/consequences, ausschließlich aus echten Daten
      abgeleitet, nie gewürfelt). Neues Modul `js/chronicle.js`: World Log
      (`state.chronicle`, unverändert vollständig, ~64% Wetteranteil) vs.
      Dynasty Chronicle (`computeDynastyChronicle()`, ON DEMAND aus World
      Memory + Thread-Zusammenfassungen abgeleitet, 0% Wetteranteil bei Ø
      30 Einträgen/100-Jahre-Partie), Ruler Eras/Herrscherbiografien,
      Dynasty Milestones/Summary, 4-Policy-Vergleich (FIRST_OPTION/
      RANDOM_VALID_OPTION/CONCILIATORY/neu: HARDLINE) bestätigt FIRST_OPTIONs
      frühere 64%-QUIET-Messung als Policy-Artefakt statt Balance-Problem.
      Trade-Off-Audit aller 10 Event Chains (keine dominante Option
      bewiesen, daher keine CONFIG-Änderung). Savegame-Migration v6→v7.
      Entscheidender Qualitätstest bestanden (§Punkt 98): 5 vollständige
      echte 100-Jahre-Dynastie-Chroniken lesen sich als zusammenhängende
      Geschichte statt als Wetterprotokoll (siehe
      `tests/phase7_chronicle_metrics_test.js`). Chronicle-Debug-Panels
      (Kandidaten/Dynasty Chronicle/Herrscher-Biografie/Dynasty Summary).
      **Phase 8 wurde NICHT automatisch begonnen** — wartet auf
      ausdrückliche Freigabe (§Phase-7-Punkt 97).
- [x] **Phase 8 — Visual Identity & UI-Redesign** (Teilphasen 8A-8I,
      vollständig abgeschlossen; Details/Design-System/Screen-Inventory/
      Final-QA-Findings siehe `UI_REDESIGN.md`, Ablauf je Teilphase siehe
      DEVELOPMENT.md "Phase 8A" bis "Phase 8I"): 8A Design-System (Farb-/
      Typografie-/Spacing-/Button-/Z-Index-Tokens). 8B Hauptbildschirm neu
      um eine kartenzentrierte Ansicht mit HUD/Kontextpanel/Story-Card.
      8C Reich/Provinz/Wirtschaft von Rohtabellen zu lesbaren Karten-
      Ansichten. 8C.1/8C.2 Weltkarte von Node-Grafik zu einer echten,
      handgestalteten politischen Landschaftskarte. 8D Hof/Dynastie/
      Charaktere mit deterministischem Portraitsystem und echtem
      Stammbaum. 8E Diplomatie als Personen-/Machtkarten statt
      Beziehungstabelle. 8F Events/Story-Threads mit Illustrationssystem
      und echter Story-Kontextanzeige. 8G Kriegskarte + Kampf-Overlay
      komplett neu inszeniert (Battle Engine unangetastet). 8H Chronik als
      illustriertes, durchblätterbares Dynastiebuch (Chronicle 2.0 als
      Source of Truth unverändert). 8I reine Qualitäts-/Konsistenz-Politur
      über alle Vorphasen (Responsive/Klickblocker-Scan, 30-Minuten-
      Playtest, 50-Jahre-Test, Human-Flow-Test, Titelbildschirm-Korrektur,
      `--text-on-dark`-Token) — 0 Critical/High-Findings. Über alle
      Teilphasen: keine neue SAVE_VERSION, Battle Engine und
      Kartengameplay unverändert, Golden-Determinism-Tests durchgehend
      grün. Bundle-Größe Phase-8-Start → Phase-8-Ende: 589.045 → 870.089
      Bytes (+47,7 %). **Ausdrückliches STOPP nach Phase 8I** — Phase 9
      wurde NICHT automatisch begonnen, wartet auf ausdrückliche Freigabe.

## NEXT (nach Freigabe, in der vom Master-Prompt vorgeschlagenen Reihenfolge)

- [ ] Tech Debt (klein, aus Phase 2 zurückgestellt, seither um `TRAITS`
      aus Phase 3 und `MEMORY_TYPES` aus Phase 4 erweitert): Entscheiden,
      ob `tools/data-sync.js` um `TERRITORIES`/`START_REGIONS`/`TRAITS`/
      `MEMORY_TYPES` erweitert oder die JSON-Modding-Schicht bewusst als
      begrenzt dokumentiert wird (siehe CODE_AUDIT.md Abschnitt 6).
- [ ] Phase 9 — Kaiserwahl 2.0: Wahlkampf, Versprechen, Kurfürsten-
      Interessen statt reiner Bestechung/Beziehungsschwelle.
- [ ] Phase 10 (Politik/Krieg-Nummerierung dieser Liste) — War & Peace 2.0:
      Friedensverhandlung statt automatischer Vasallisierung bei
      Vollständigkeit, Versorgungsmechanik auf der Kriegskarte, echte
      Annexionsoption mit Konsequenzen.
- [ ] Politik: Regierungsstil-Regler um weitere Stellschrauben ergänzen
      (Bauernabgaben/Handelszölle/Adelsprivilegien/Kirchenrechte) statt
      eines einzelnen Reglers, politische Interessengruppen.

## LATER

### Narrative Systems

Historischer Befund (85-Year-Chronicle-Test, `BASELINE.md`): 95% der
Chronik war ursprünglich Wetter-Flavourtext, nur ~1 relevantes Ereignis
alle 8 Jahre bei passivem Spiel (siehe `GAME_DESIGN.md` → "Narrative
Density"/"Emergent Storytelling Gap"). **World Memory ist seit Phase 4
erledigt, Event Chains seit Phase 5, Story Threads/Drama Director seit
Phase 6, die bedeutungsbasierte Chronik (World Log/Dynasty Chronicle)
seit Phase 7 erledigt** (siehe CURRENT oben, `GAME_DESIGN.md` → "Dynasty
Chronicle 2.0 (Phase 7)") — alle vier daher hier nicht mehr aufgeführt:

- [ ] Aktivere KI-Dynastien (mehr eigenständig sichtbare Lebensereignisse
      bei KI-Regionen, nicht nur beim Spieler). Einziger noch offener
      Punkt dieser Gruppe.

**Noch NICHT implementieren** — dieser Punkt ist Zieldefinition, kein
aktueller Auftrag.

### UI & Fun Pass

- [x] ~~UI-Redesign (Historical-Graphic-Novel-Look, Weltkarte als
      Hauptbildschirm-Zentrum, sichtbare Weltzustände)~~ — erledigt als
      Phase 8A-8I, siehe CURRENT oben und `UI_REDESIGN.md`. Der frühere
      Platzhaltername "Phase 10" für diesen Punkt (aus der Vor-Master-
      Prompt-Nummerierung) ist damit hinfällig.
- [ ] Fun Pass (noch kein fester Phasenname/keine feste Nummer
      zugewiesen — der frühere Platzhalter "Phase 11" bezog sich auf die
      alte, inzwischen durch Phase 8 überholte Nummerierung): 100+
      Simulationen mit unterschiedlichen KI-Strategien (economic/
      military/diplomatic/dynastic/balanced) zur Dominanzanalyse,
      Story-Metriken (`majorEventsPerDecade` u. ä.), automatisierte
      Chronik-Langweiligkeits-Prüfung.
- [ ] Dynastie-Aussterberate senken oder bewusst als Spielhebel gestalten
      (Baseline: 53% aller rein passiven 100-Jahre-Partien enden mit
      `no_heir` — siehe BASELINE.md, unverändert nach Phase 3, siehe
      `phase3_metrics_test.js`). Jetzt sinnvoll angehbar (Phase 3
      Character Core ist abgeschlossen, liefert Claims/Loyalität/
      Rivalitäten als Bausteine für z. B. Heiratspolitik-Entscheidungen),
      aber bewusst NICHT in Phase 3 selbst gefixt (§Punkt 57: kein
      künstlicher "kein Erbe → Kind erzeugen"-Fix).
- [x] Savegame-Migrationslogik — seit Phase 3 teilweise vorhanden
      (`migrateSaveV2ToV3()` in `js/core.js`, getestet). Bleibt als
      offener Punkt, falls eine generische Mehrschritt-Migration (statt
      des aktuellen fest verdrahteten Einzelschritts v2→v3) für spätere
      Versionssprünge gewünscht ist.
- [ ] Größere KI-Regionsanzahl (30–50 politische Einheiten) mit
      Level-of-Simulation (nahe Regionen voll simuliert, entfernte
      vereinfacht) — deutlich später, nach Konsolidierung der bestehenden
      4+wenige Extra-Regionen.

## EXPERIMENTAL (Ideen, noch nicht eingeplant — Sammelbecken statt Sofort-Umsetzung)

### Balance Research

Aus der Militäranalyse in CODE_AUDIT.md Abschnitt 12 ("Potential Dominant
Military Strategies") — ausdrücklich **Hypothesen, keine bestätigten
Fehler**. Erfordert handelnde KI-Agenten, die aktuellen Tests spielen alle
rein passiv (keine Rekrutierungs-/Diplomatie-/Bauentscheidungen):

- [ ] Pikeniere-Spam testen (36,7 Taler/Stärkepunkt — günstigster Wert
      aller Truppentypen, siehe CODE_AUDIT.md für die volle Tabelle).
- [ ] Kavallerie-Bevölkerungseffizienz testen (`recruitPopCostPerUnit`
      ist unabhängig vom Truppentyp — Schwere Kavallerie könnte pro
      verbrauchtem Bevölkerungskopf deutlich überlegen sein).
- [ ] Economic/Military/Diplomatic/Dynastic KI-Agenten (Vorstufe zu
      Phase 11 "Fun Pass") — je Strategieprofil mindestens 100 Partien,
      Erfolgsraten vergleichen.
- [ ] Dominante Strategien empirisch messen, bevor an
      Kosten-/Stärkewerten etwas verändert wird.

**Keine Werte verändern, bevor diese Messungen vorliegen.**

- [ ] Mehrere Herrscher gleichzeitig spielbar/vergleichbar (setzt eine
      Lösung für die globalen RNG-/Charakter-ID-Zähler voraus, siehe
      CODE_AUDIT.md Abschnitt 2).
- [ ] Charaktereigenschaften-Vererbung über Generationen (Rivalität erbt
      sich, kann durch Heirat enden).
- [ ] Belagerungsmechanik als echte Gebietsmechanik reaktivieren (bestehender
      toter Code in military.js/battle-bridge.js als möglicher
      Ausgangspunkt, siehe CODE_AUDIT.md Abschnitt 6).
- [ ] Herrscher-Todesursachen differenzieren (Kampf/Meuchelmord/Krankheit
      statt nur Alter/Gesundheit).

---

## Archiv: bereits abgeschlossene Phasen (vor der "Next Generation"-Initiative)

### MVP
- [x] Vertical Slice: 1 Region, 3 KI-Nachbarn, 6 Waren, 5 Bevölkerungsgruppen,
      10 Gebäude, Wirtschaft, Steuern, Landwirtschaft, einfache Handels-KI,
      8 Ereignisse, Adelsleiter, Chronik, Retro-UI
- [x] Speichersystem (Export/Import als JSON-Datei)
- [x] Charaktersystem (Werte, Eigenschaften mit echten Effekten, Alter, Tod)
- [x] Dynastiesystem (Heirat, Kinder, automatische Erbfolge)
- [x] Balancing-Konfigurationsdatei (keine Magic Numbers mehr im Code)
- [x] 20+ Ereignisse, mehr Kategorien
- [x] Automatisierter Wirtschaftstest (100 Jahre ohne Eingriff, Preisstabilität)
- [x] Gebäude als Parzellen-Karte, mehrfach baubar, mit Ausbaustufen

### Alpha
- [x] Diplomatie-Grundgerüst (Beziehungen, Geschenk, Nichtangriffspakt, Handelsvertrag, Bündnis)
- [x] Erbfolgestreitigkeiten (mehrere Thronanwärter, Legitimität)
- [x] KI-seitige Diplomatie-Initiative (Nachbarn bieten selbst Verträge an)
- [x] Einfaches Militär (Truppentypen, Unterhalt, Kriegserklärung mit Schlachtauflösung)
- [x] Karte Mitteleuropa (8 Regionen statt 4, davon 3 diplomatisch erreichbar)
- [x] Berater-System (6 Ämter mit echten Gameplay-Effekten)

### Beta
- [x] Kaiserwahl (Kurfürstenstimmen statt Schwellenwert)
- [x] Intrigen (Sabotage), Rebellionen mit echten Ursachen (Zufriedenheit+Legitimität)
- [x] Religion als politische Kraft (Kennzahl + Ereignisse)
- [x] Informationsunsicherheit (Spionageberichte als Spanne statt exakter Zahlen)
- [x] Erweitertes Schlachtsystem (Stadtmauer/Kaserne in Stärkeschätzung, Unsicherheitsspanne)
- [x] Localization-Grundstruktur (DE befüllt, Architektur vorbereitet — UI noch nicht vollständig durchgezogen)
- [x] CRT-Filter, Chiptune-Sound-Effekte (optional, abschaltbar; kein Musik-Soundtrack)

### Version 1.0
- [x] Eigenständige taktische Kampf-Engine (6 Phasen, Formationen, Taktiken,
      Konter, Gelände, Wetter, Moral) statt reinem Stärkevergleich
- [x] KI-gegen-KI-Testsuite (100 Partien, Balancing-Auswertung)
- [x] Ausführliches Debug-Menü, KI-Entscheidungs-Inspektor
- [x] Strategische Kriegskarte (16 Gebiete, Truppenbewegung, gebietsweise
      Eroberung) über der taktischen Kampf-Engine
- [x] Mehrere Sieg-/Zielbedingungen (Kaiser/Reichtum/Handelsmacht/Militär/Endlos)
- [x] Comic-Renaissance-UI-Neugestaltung (siehe DEVELOPMENT.md)
- [ ] Vollständige Kampagne 1450–1650+ (aktuell fest 1500-Start, keine
      wählbare Zeitspanne) — verschoben nach LATER

### Post-Launch (unverändert offen, siehe LATER/EXPERIMENTAL oben für die
aktualisierte Fassung)
- [ ] Modding-Loader für JSON-Datendateien (teilweise vorhanden, aber
      veraltet — siehe CODE_AUDIT.md Abschnitt 6, jetzt unter NEXT/Phase 2)
- [ ] Erweiterte Karte (ganz Europa)
- [ ] Mehrspieler
- [ ] Szenarioeditor
