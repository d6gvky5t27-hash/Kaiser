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
      aktualisiert. **Noch kein Gameplay-Refactoring** — wartet auf
      Freigabe für Phase 2.

## NEXT (nach Freigabe, in der vom Master-Prompt vorgeschlagenen Reihenfolge)

- [ ] Phase 2 — Modularisierung: `advanceYear()` (aktuell eine ~123-Zeilen-
      Funktion, siehe CODE_AUDIT.md Abschnitt 3) in benannte Teilschritte
      aufteilen, ohne Verhalten zu ändern. `index.html`-Block-2-UI-Code
      (1.746 Zeilen) ggf. in `js/ui/*.js`-Dateien auslagern. Tote
      Belagerungslogik (military.js/battle-bridge.js-Duplikat) bereinigen
      oder bewusst konsolidieren. `tools/data-sync.js` gegenüber
      `gamedata.js` nachziehen (fehlt: `baseCost` bei Beratern, komplett
      fehlende Tabellen `TERRITORIES`/`START_REGIONS`).
- [ ] Phase 3 — Character Core: Berater-Kandidatenauswahl (3 Kandidaten
      statt automatischer Zuweisung — `generateAdvisorCandidate()` existiert
      bereits als Baustein), Beziehungs-Ursachen-Log statt eines einzelnen
      Zahlenwerts, Rivalen-Grundgerüst.
- [ ] Phase 4 — World Memory: strukturierter Erinnerungsspeicher
      (Typ/Jahr/Beteiligte/Stärke/Decay), Verknüpfung mit der Chronik.
- [ ] Phase 5 — Event Chains: 23 isolierte Events → mindestens 10
      hochwertige, mehrjährige Eventketten mit echten Vorbedingungen/
      Folgeevents statt vieler neuer Einzelevents.
- [ ] Phase 6 — Drama Director: Spannungswerte aus echtem Weltzustand
      ableiten, plausible Krisen priorisieren statt willkürlich erzeugen.
- [ ] Phase 7 — Kaiserwahl 2.0: Wahlkampf, Versprechen, Kurfürsten-
      Interessen statt reiner Bestechung/Beziehungsschwelle.
- [ ] Phase 8 — War & Peace 2.0: Friedensverhandlung statt automatischer
      Vasallisierung bei Vollständigkeit, Versorgungsmechanik auf der
      Kriegskarte, echte Annexionsoption mit Konsequenzen.
- [ ] Phase 9 — Politik: Regierungsstil-Regler um weitere Stellschrauben
      ergänzen (Bauernabgaben/Handelszölle/Adelsprivilegien/Kirchenrechte)
      statt eines einzelnen Reglers, politische Interessengruppen.

## LATER

- [ ] Phase 10 — UI-Redesign (erst wenn Gameplay-Systeme aus Phase 2–9
      stabil sind): Historical-Graphic-Novel-Look, Weltkarte als
      Hauptbildschirm-Zentrum, sichtbare Weltzustände (Gebäude/Straßen auf
      der Karte).
- [ ] Phase 11 — Fun Pass: 100+ Simulationen mit unterschiedlichen
      KI-Strategien (economic/military/diplomatic/dynastic/balanced) zur
      Dominanzanalyse, Story-Metriken (`majorEventsPerDecade` u. ä.),
      automatisierte Chronik-Langweiligkeits-Prüfung.
- [ ] Dynastie-Aussterberate senken oder bewusst als Spielhebel gestalten
      (Baseline: 53% aller rein passiven 100-Jahre-Partien enden mit
      `no_heir` — siehe BASELINE.md). Erst nach Phase 3 (Character Core)
      sinnvoll angehbar.
- [ ] Savegame-Migrationslogik (aktuell wirft `deserializeSave()` bei
      Versionsmismatch nur einen harten Fehler, siehe CODE_AUDIT.md
      Abschnitt 4/6).
- [ ] Größere KI-Regionsanzahl (30–50 politische Einheiten) mit
      Level-of-Simulation (nahe Regionen voll simuliert, entfernte
      vereinfacht) — deutlich später, nach Konsolidierung der bestehenden
      4+wenige Extra-Regionen.

## EXPERIMENTAL (Ideen, noch nicht eingeplant — Sammelbecken statt Sofort-Umsetzung)

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
