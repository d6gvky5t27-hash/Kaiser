# DEVELOPMENT LOG

## Überblick: Was ist bereits implementiert (Stand: nach Schritt 11)

Diese Liste fasst alle bisherigen Entwicklungsschritte thematisch zusammen.
Das vollständige chronologische Protokoll mit allen Testergebnissen steht
weiter unten unter "Detailliertes Änderungsprotokoll". Für den Abgleich
gegen jeden einzelnen Abschnitt des Master-Prompts siehe STATUS_ANALYSE.md.

**Wirtschaft & Ressourcen**
- Angebot/Nachfrage-Preisbildung pro Region, mit vollständiger Ursachen-
  Aufschlüsselung als Tooltip (Basispreis/Nachfrage/Angebot/Multiplikator)
- 9 Waren: Getreide, Holz, Stein, Ton, Eisen, Wolle, Leder, Bier, Werkzeuge
- Produktionsketten inkl. mittelalterlicher Rohstoffe (Steinbruch, Tongrube,
  Gerberei zusätzlich zu Sägewerk/Schmiede/Brauerei)
- Bauwerke kosten echte Baustoffe (materialCost), nicht nur Taler
- Landwirtschaft: Fruchtbarkeit × regionales, probabilistisches Wetter
- Einfache Handels-KI zwischen allen Regionen (baut Preisgefälle ab,
  verstärkt durch Handelsverträge)
- Steuersystem mit spürbarer Wirkung auf Zufriedenheit/Wirtschaft/Rebellion
- Staatskasse getrennt simuliert, Bankrott-Schwelle als Niederlagebedingung

**Bevölkerung**
- 5 Gruppen (Bauern, Handwerker, Händler, Adel, Arme) mit Zufriedenheit,
  Geburten/Alterstod/Hungertoten/Seuchentoten — vollständige Ursachen-
  Aufschlüsselung pro Jahr als Tooltip

**Gebäude & Karte**
- 13 Gebäudetypen, als Parzellen-Instanzen mehrfach baubar und pro Instanz
  bis Stufe 4 ausbaubar (exponentiell steigende Ausbaukosten)
- Eigene Kartenseite: Landschaftsansicht mit organisch verstreuten Symbolen
  (angelehnt ans Original), Zeichenerklärung, Fluss/Hauptstadt-Dekoration

**Charaktere & Dynastie**
- Herrscher mit 6 Werten, 10 wählbaren/zufälligen Persönlichkeits-Traits mit
  echten Gameplay-Effekten
- Heirat, Kindergeburt, Alterung, Tod, automatische Erbfolge
- Erbfolgestreitigkeiten bei mehreren, altersnahen Erben (Kosten für
  Zufriedenheit/Taler/Prestige/Legitimität)

**Diplomatie**
- Beziehungswerte (-100..+100) zu den 3 direkten Nachbarn
- Aktionen: Geschenk, Nichtangriffspakt, Handelsvertrag, Bündnis
- KI-seitige Diplomatie-Initiative (Nachbarn handeln auch unabhängig vom
  Spieler, §86)

**Militär**
- 5 Truppentypen: Bauernmiliz, Bogenschützen, Armbrustschützen, Ritter,
  Söldner — mit echtem Unterschied zwischen Vasallendienst (braucht
  Adelszufriedenheit für Ritter) und Söldnern (nur Gold, aber Fahnenflucht-
  Risiko bei ausbleibendem Sold/niedriger Legitimität)
- Schlachtformationen mit Bonuslogik vor der Kriegserklärung
- Stärkeschätzung des Gegners als Unsicherheitsspanne (Informations-
  unsicherheit), durch Spionage genauer einstellbar

**Politik & Herrschaft**
- Adelsleiter (10 Titel, Freiherr → Kaiser) mit Mehrfachbedingungen
- Kaiserwahl: Kurfürstenstimmen (3 bekannte + 4 abstrakte), Bestechung
  möglich — einziger Weg zum Sieg, kein reiner Schwellenwert-Aufstieg mehr
- Legitimität als eigene Kennzahl (beeinflusst Rebellion/Thronfolge/
  Zufriedenheit)
- Rebellionen mit echten Ursachen (niedrige Zufriedenheit UND Legitimität)
- Intrigen: Sabotage-Aktion gegen Nachbarn
- Religion als Kennzahl mit Zufriedenheitswirkung + 2 Ereignissen
- Berater-System: 6 Ämter mit direkten Gameplay-Effekten (Steuern, Militär,
  Diplomatie, Produktion, Zufriedenheit)

**Ereignisse & Chronik**
- 24 datengetriebene Ereignisse über mehrere Kategorien
- Automatische Reichschronik

**Technik & QA**
- Deterministischer Zufalls-Seed (reproduzierbare Partien, Savegame-fest)
- Debug-Panel (Geld, Jahr, Bevölkerung, Charaktere, Events, Kriege)
- KI-Entscheidungsanalyse (Faktor-Aufschlüsselung für Kriegsentscheidungen)
- Automatisierter Wirtschaftstest (`tests/economy_test.js`)
- Zentrale Balancing-Konfiguration (keine Magic Numbers im Code)
- Speichersystem: JSON-Export/Import mit Versionsprüfung

**Präsentation & UX**
- Start-/Charaktererstellungsbildschirm (Name, Geschlecht, Dynastie,
  Schwierigkeitsgrad, 2 Persönlichkeitsschwerpunkte)
- 4 Schwierigkeitsgrade (wirken über KI-Fehlerquote, keine versteckten Boni)
- Tooltip-System für Preise, Bevölkerung, Kasse, Prestige
- CRT-Filter und Sound-Effekte, beide abschaltbar
- Localization-Grundstruktur (nur Deutsch befüllt, Architektur vorbereitet)

**Bewusst noch offen** (siehe STATUS_ANALYSE.md für die vollständige,
priorisierte Liste): Stadtentwicklungsstufen, Technologiesystem,
mehrstufige Belagerungen, weitere Siegbedingungen neben Kaiserwahl,
ausführliche Spielende-Auswertung, Staatsschulden/Kredite, mehr
Diplomatie-Aktionen (Vasallisierung, Tribut, dynastische Ehe), echtes
Sprite-/Canvas-Rendering, Musik, Intro/Easter-Eggs.

---

## Detailliertes Änderungsprotokoll

## 2026-08-07 – Schritt 1: Grundgerüst + Vertical Slice v0.1

**Implementiert:**
- Projektstruktur (data/ js/ index.html)
- Tech-Stack-Entscheidung: Vanilla HTML/CSS/JS + Canvas, Daten getrennt in JS-Objekten
- GameState mit 1 Spielerregion + 3 KI-Nachbarregionen
- Wirtschaftssystem: 6 Waren, Angebot/Nachfrage-Preisbildung, Lagerhaltung
- Produktionsketten: Getreide→Mühle→Mehl(vereinfacht in v0.1 als Direktboost),
  Holz→Sägewerk→Bretter, Eisen→Schmiede→Werkzeuge, Gerste-Substitut→Brauerei→Bier
- Bevölkerungssystem: 5 Gruppen, Zufriedenheit, Geburten/Tode/Hungertote
- Landwirtschaft: Fruchtbarkeit × zufälliges Wetter (regional, nicht global)
- Einfache Handels-KI zwischen Regionen (baut Preisgefälle ab)
- Steuersystem mit Auswirkung auf Zufriedenheit & Staatskasse
- 10 Gebäudetypen mit Baukosten und Effekten
- Event-System (datengetrieben) mit 8 Startereignissen inkl. Kornspeicher-Beispiel aus Spec §39
- Adelsleiter Freiherr→Kaiser mit Aufstiegsprüfung
- Chronik-System (automatischer Log wichtiger Vorkommnisse)
- Rundenbasierte Zeit (Jahresschritte), Retro-Pixel-UI (Canvas, 320×200 Basis,
  integer scaling, reduzierte Palette, Pixel-Look via CSS/Canvas)

**Bekannte Einschränkungen (bewusst für v0.1):**
- Kein Charakter-/Dynastiesystem, keine Diplomatie/Militär/Intrigen/Religion
- Kaiserwahl vereinfacht (Schwellenwerte statt Kurfürstenvotum)
- Kein Speichersystem (folgt Phase 2)
- Keine echten Sprites/Chiptune-Audio (folgt später)

## 2026-08-11 – Schritt 2: Charaktersystem, Dynastie, Speichersystem

**Implementiert:**
- Charaktersystem: Herrscher mit Werten (Intelligenz, Diplomatie, Verwaltung,
  Militär, Handel, Charisma), Alter, Gesundheit, 2 zufälligen Eigenschaften
  aus einem Trait-Pool (10 Traits mit echten Gameplay-Effekten auf Prestige,
  Staatskasse, Zufriedenheit, Produktion – nicht nur dekorativ, §9)
- Dynastiesystem: Heirat (Zufallschance ab 16, solange unverheiratet),
  Kindergeburt, Alterung, Sterbewahrscheinlichkeit (steigt ab 50, verstärkt
  durch schlechte Gesundheit), automatische Erbfolge (ältestes lebendes Kind);
  kein Erbe vorhanden → Game Over "Dynastie ausgestorben"
  Als HTML-Panel "HOF" sichtbar (Name, Alter, Gesundheit, Eigenschaften,
  Werte, Gemahlin/Gemahl, Kinder)
- Speichersystem: JSON-Export (Download-Button) / Import (Datei-Upload),
  bewusst kein localStorage (in Artifacts nicht erlaubt); Versionsfeld im
  Savegame für spätere Kompatibilitätsprüfung (§64)
- Getestet: 120-Jahre-Simulation lief über mehrere Generationen inkl.
  Erbfolgewechsel fehlerfrei durch; Save/Load-Zyklus verifiziert

**Nächste Schritte (siehe ROADMAP.md):**
- Balancing-Konfigurationsdatei (Werte aus Code in Datendatei auslagern)
- 20+ Ereignisse, mehr Kategorien, Diplomatie-Grundgerüst
- Automatisierter Wirtschaftstest als wiederholbares Testskript

## 2026-08-11 – Schritt 3: Balancing-Config, mehr Events, Wirtschaftstest

**Implementiert:**
- `CONFIG`-Objekt in gamedata.js: sämtliche zuvor hartkodierten Zahlen
  (Preisbildung, Wetterwahrscheinlichkeiten, Bevölkerungsraten, Handels-
  Schwellen, KI-Bauverhalten, Dynastie-Wahrscheinlichkeiten, Sieg-/Niederlage-
  Schwellen) sind jetzt zentral konfigurierbar (§71)
- 12 neue Ereignisse (insgesamt 20): Handelsroute, Gelehrtenförderung,
  Wilderer, Komet, Stadtbrand, Musiker, Bettlerplage, Handwerkerstreik,
  Wunderheiler, fremder Gesandter, Erbstreit unter Adel, Steuerhinterziehung
  — decken jetzt auch Kultur, Verbrechen, Diplomatie-Flavor ab
- `tests/economy_test.js`: automatisierter Test gemäß §77 — 20 Partien à
  100 Jahre ohne Eingriff, prüft Preisexplosionen, Bevölkerungskollaps,
  Handelsaktivität. Mit `node tests/economy_test.js` ausführbar.

**Testergebnis (wichtiger Balancing-Fund):**
Ohne Spieler-Eingriff laufen Werkzeug-/Bierpreise in 8 von 20 Partien an die
Preisobergrenze, weil die Spielerregion nie automatisch Schmiede/Brauerei
baut (nur KI-Regionen bauen autonom, §86). Das ist beabsichtigtes Verhalten,
kein Bug: Bautätigkeit muss eine echte, notwendige Spielerentscheidung
bleiben. Sterberate des Herrschers wurde separat verifiziert (~0,15%
gemessen vs. 0,2% konfiguriert im ersten Jahr — im Rahmen der Erwartung).

**Nächste Schritte (siehe ROADMAP.md):**
- Diplomatie-Grundgerüst (Beziehungen zu Nachbarregionen, erste Aktionen)
- Erbfolgestreitigkeiten (mehrere Thronanwärter statt automatisch ältestes Kind)
- Einfaches Militär-Grundgerüst

## 2026-08-11 – Schritt 4: Diplomatie-Grundgerüst

**Implementiert:**
- Beziehungswerte (-100..+100) zu allen 3 Nachbarregionen, Start bei 30
- 4 Diplomatie-Aktionen mit echten Konsequenzen und Voraussetzungen (§29):
  Geschenk senden (kostet Taler, hebt Beziehung), Nichtangriffspakt
  (ab Beziehung 20), Handelsvertrag (ab Beziehung 10, verstärkt tatsächlich
  den Warentransfer zwischen den Regionen um Faktor 2), Bündnis (ab
  Beziehung 50, gibt zusätzlich Prestige)
- Jährliche Beziehungsdynamik: Beziehungen driften ohne Zutun langsam
  Richtung neutral, bestehende Verträge wirken dem leicht entgegen,
  zufälliges Rauschen sorgt für Unvorhersehbarkeit (§30 Erinnerung/Dynamik)
- Diplomatie-UI-Panel mit Beziehungsbalken, Vertragskennzeichnung und
  Aktionsbuttons pro Nachbarregion

**Bewusste Einschränkung:** Kriegserklärung, Vasallisierung, dynastische Ehen
zwischen Höfen und KI-seitige Diplomatie-Initiative fehlen noch — dafür wird
erst das Militärsystem (Alpha) benötigt, damit Nichtangriffspakt/Bündnis
mechanisch etwas bedeuten. Aktuell wirken die Verträge nur auf Handel und
Prestige.

**Regressionstest:** 80-Jahre-Testlauf + 20×100-Jahre-Wirtschaftstest liefen
nach der Integration weiterhin stabil (keine neuen Auffälligkeiten).

**Nächste Schritte (siehe ROADMAP.md):**
- Erbfolgestreitigkeiten (mehrere Thronanwärter statt automatisch ältestes Kind)
- Einfaches Militär-Grundgerüst (damit Diplomatie mechanisch relevant wird)
- KI-seitige Diplomatie-Initiative (Nachbarn bieten selbst Verträge an)

## 2026-08-11 – Schritt 5: Gebäudesystem überarbeitet (Karte, Mehrfachbau, Ausbaustufen)

**Implementiert (auf expliziten Wunsch):**
- Gebäude sind jetzt Parzellen-Instanzen (`{type, level, plotIndex}`) statt
  einer einfachen Liste von Typen — jeder Gebäudetyp kann beliebig oft gebaut
  werden (auf unterschiedlichen Parzellen), zusätzlich pro Instanz bis Stufe
  4 ausbaubar (§26/§82: Erweiterbarkeit statt Fake-Komplexität)
- Neue eigene Seite "KARTE & GEBÄUDE" (Tab-Navigation oben, `#pagetabs`):
  4×3-Parzellenraster (12 Parzellen gesamt), leere Parzellen zum Bebauen,
  belegte zeigen Icon-Kürzel + aktuelle Stufe; Klick öffnet Detailbereich mit
  Bauoptionen bzw. Ausbau-Button und Kostenanzeige
- Produktionslogik umgestellt: Boost-Gebäude (Bauernhof, Mühle) skalieren mit
  der Summe aller Stufen aller eigenen Instanzen; "enables"-Gebäude
  (Sägewerk/Schmiede/Brauerei) erhöhen die Produktionskapazität proportional
  zur Stufensumme statt nur an/aus zu schalten
  (Rückwärtskompatibel: eine einzelne Stufe-1-Instanz verhält sich exakt wie
  das alte "gebaut ja/nein"-Modell)
- Ausbaukosten steigen exponentiell (`cost * 1.6^Stufe`), Neubau-Kosten
  bleiben konstant beim Basispreis (jede neue Instanz ist ein eigenständiges
  Gebäude)
- KI-Regionen nutzen dasselbe Modell: bauen neue Instanzen auf freien
  Parzellen oder bauen bestehende aus, wenn alle 12 Parzellen belegt sind

**Getestet:** Mehrfachbau (3 Bauernhöfe), Ausbau (Stufe 1→2), Parzellenlimit
(Baustopp bei voller Karte bzw. leerer Kasse), 80-Jahre-Regressionstest und
20×100-Jahre-Wirtschaftstest liefen nach der Umstellung weiterhin stabil.

**Nächste Schritte (siehe ROADMAP.md):**
- Erbfolgestreitigkeiten (mehrere Thronanwärter statt automatisch ältestes Kind)
- Einfaches Militär-Grundgerüst
- KI-seitige Diplomatie-Initiative

## 2026-08-11 – Schritt 6: Restliche Alpha-Themen (Erbfolgestreit, KI-Diplomatie, Militär, mehr Regionen, Berater)

**Implementiert:**
- **Erbfolgestreitigkeiten (§10/§45):** Bei mehreren Erben mit ähnlichem Alter
  (≤5 Jahre Abstand) besteht ein erhöhtes Risiko (15–50 %), dass die
  Nachfolge angefochten wird — kostet Zufriedenheit, Taler und Prestige und
  senkt die neue Kennzahl **Legitimität** (0–100, erholt sich langsam pro
  Jahr, niedrige Legitimität drückt dauerhaft die Zufriedenheit)
- **KI-seitige Diplomatie-Initiative (§30/§86):** Nachbarn senden gelegentlich
  selbst Geschenke oder bieten von sich aus Nichtangriffspakt/Handelsvertrag
  an — die Welt handelt jetzt auch diplomatisch unabhängig vom Spieler
- **Einfaches Militärsystem (§33/§34/§35):** 3 Truppentypen (Bauernmiliz,
  Infanterie, Kavallerie) mit Kosten, Unterhalt und Stärke; Rekrutierung
  zieht Bevölkerung aus der Bauernschicht ab; Kaserne/Stadtmauer erhöhen die
  eigene Stärke; Kriegserklärung löst eine sofortige, stärkevergleichs-
  basierte Schlachtauflösung aus (Beute/Prestige bei Sieg, Verluste/
  Zufriedenheitseinbruch bei Niederlage, Vertragsbruch wird bestraft) —
  macht Nichtangriffspakt/Bündnis jetzt mechanisch relevant
- **Mehr Regionen (§6):** 4 zusätzliche, vollständig simulierte Regionen
  (Bayern, Sachsen, Böhmen, Schwaben) — insgesamt 8 Regionen im Handels-
  netzwerk. Bewusste Einschränkung: nur die ursprünglichen 3 Nachbarn sind
  Ziel von Diplomatie/Krieg (UI würde sonst überladen); die neuen Regionen
  entwickeln sich eigenständig und beeinflussen Handel/Wirtschaft
- **Berater-System (§42/§43):** 6 Ämter (Schatzmeister, Marschall, Diplomat,
  Spionagemeister, Geistlicher, Handelsberater), gegen Einstellungsgebühr +
  Jahresgehalt berufbar; Werte des Beraters wirken direkt auf Steuer-
  einnahmen, Militärstärke, diplomatische Erfolge, Produktion bzw.
  Zufriedenheit. Spionagemeister ist bewusst noch ohne mechanischen Effekt
  (Platzhalter für die Informationsunsicherheit in Beta)
- Neuer Tab "⚔ MILITÄR" (Armeeübersicht, Rekrutierung, Kriegserklärung je
  Nachbar), neues Berater-Panel im Hof-Bereich der Provinz-Seite

**Getestet:** Berater-Anstellung/-Bonus, Rekrutierung, Kriegsauflösung
(Sieg/Niederlage), 8-Regionen-Wirtschaftstest (weiterhin stabil), sowie
15×150-Jahre-Lauf zur Erbfolge — 7 von 13 Thronwechseln lösten tatsächlich
einen Erbfolgestreit aus, Mechanik greift wie vorgesehen.

**Damit ist die Alpha-Phase der Roadmap abgeschlossen.** Nächster Block:
Beta-Themen (Kaiserwahl per Kurfürstenstimmen, Intrigen/Rebellionen mit
echten Ursachen, Religion, Informationsunsicherheit, Belagerungen,
Localization, CRT-Filter/Sound).

## 2026-08-11 – Schritt 7: Beta-Phase abgearbeitet

**Implementiert:**
- **Kaiserwahl (§12):** Ab Titel "Kurfürst" kann jährlich eine Kaiserwahl
  ausgelöst werden (Chronik-Banner erscheint). Der Spieler kann vor der
  Wahl einzelne Kurfürsten bestechen; abgestimmt wird mit 3 bekannten
  Stimmen (Beziehung ≥40 oder bestochen) + bis zu 4 "abstrakten" Stimmen
  weiterer Kurfürsten (an Prestige-Schwellen gekoppelt). Bei Mehrheit
  (≥4 von 7) wird der Spieler Kaiser (Sieg); bei Niederlage folgt eine
  Abklingzeit und Prestigeverlust. Der reine Schwellenwert-Aufstieg zum
  Kaiser wurde entfernt — nur die Wahl führt zum Sieg.
- **Rebellionen mit echten Ursachen (§37):** Neues Ereignis, ausgelöst bei
  gleichzeitig niedriger Zufriedenheit UND niedriger Legitimität (nicht
  zufällig) — mit 3 Optionen: militärisch niederschlagen (braucht echte
  Armee, sonst schlägt es fehl), Zugeständnisse machen (Steuersenkung) oder
  ignorieren (Bevölkerungs-/Kassenverlust)
- **Intrigen (§32):** Sabotage-Aktion gegen Nachbarregionen (reduziert deren
  Lager, Entdeckungsrisiko mit Beziehungsschaden)
- **Informationsunsicherheit (§41):** Für alle 3 Nachbarn wird die
  militärische Stärke nur noch als Spanne angezeigt ("zwischen X und Y"),
  deren Genauigkeit von einer neuen Spionage-Aktion abhängt (kostet Taler,
  Genauigkeit klingt über Jahre wieder ab)
- **Religion als politische Kraft (§46):** Neue Kennzahl `religiousInfluence`
  mit Auswirkung auf Zufriedenheit bei sehr niedrigen/hohen Werten, dazu
  zwei neue Ereignisse (Ketzerei, Wallfahrt)
- **Erweitertes Schlachtsystem:** Stadtmauer/Kaserne-Ausbaustufen fließen
  bereits in die geschätzte gegnerische Stärke ein (bestehende Mechanik aus
  Alpha, jetzt mit sichtbarer Unsicherheitsspanne statt Einzelzahl)
- **Localization-Grundstruktur (§80):** Neues `STRINGS`-Objekt mit
  `de`-Locale und `t()`-Hilfsfunktion, vorbereitet für weitere Sprachen.
  Bewusste Einschränkung: aktuell nur als Struktur/Machbarkeitsnachweis
  angelegt, noch nicht die gesamte UI durchgängig darüber geführt — vor
  einer echten Zusatzsprache müsste der komplette Text extrahiert werden
- **CRT-Filter & Chiptune-Sound (§53/§57, abschaltbar):** Checkbox für
  einen dezenten Scanline-Overlay (CSS, standardmäßig aus) und Checkbox für
  einfache Web-Audio-Bleep-Sounds bei Jahreswechsel, Bau, Spionage,
  Sabotage und Wahlausgang (standardmäßig an). Kein Musik-Soundtrack, da
  keine Audio-Assets erzeugt werden können — als spätere Ergänzung offen.

**Getestet:** Kaiserwahl-Ablauf (Bestechung → Sieg), Sabotage/Spionage
(Spionage verengt sichtbar die Schätzspanne), Rebellions-Bedingung gezielt
provoziert, 25×200-Jahre-Langzeittest (0 passive Siege — Kaiserwerdung
erfordert aktives Spiel, wie beabsichtigt), 20×100-Jahre-Wirtschaftstest
weiterhin stabil.

**Damit ist die Beta-Phase der Roadmap inhaltlich abgearbeitet.** Bewusst
vereinfacht blieben: mehrstufige Belagerungen (aktuell Sofortauflösung),
vollständige Sprachumschaltung (nur Grundstruktur), Chiptune-Musik (nur
Sound-Effekte). Nächster Block laut Roadmap: Version 1.0 (vollständige
Kampagne, mehrere Siegbedingungen, KI-gegen-KI-Testsuite, Debug-Menü).

## 2026-08-11 – Schritt 8: Priorisierte Lücken aus STATUS_ANALYSE.md abgearbeitet (Runde 1)

Nach der vollständigen Abschnitt-für-Abschnitt-Prüfung gegen den Master-Prompt
(siehe STATUS_ANALYSE.md) wurden die am höchsten priorisierten offenen Punkte
umgesetzt:

**§67 Deterministische Simulation:** Eigener Mulberry32-PRNG (`rnd()`) ersetzt
sämtliche `Math.random()`-Aufrufe (41 Stellen in beiden Dateien). Seed wird im
GameState (`state.seed`) und Aufrufzähler (`__rngCalls`) im Savegame
mitgeschrieben (SAVE_VERSION auf 2 erhöht) — ein geladener Spielstand setzt den
Zufallsstrom exakt an der Stelle fort, an der gespeichert wurde. Getestet:
gleicher Seed → bit-identischer Partieverlauf (Bevölkerung, Chronik) über 40
Jahre; unterschiedlicher Seed → unterschiedlicher Verlauf.

**§69 Debug-Funktionen:** Neues, über Checkbox "🛠 Debug" einblendbares Panel:
Geld hinzufügen, Jahr überspringen, Bevölkerungsgruppen manuell verändern,
zufälligen Charakter erzeugen, beliebiges Event gezielt auslösen, Krieg gegen
jeden Nachbarn direkt starten.

**§70 KI-Debugging:** `evaluateAiWarDecision()` zeigt für jeden Nachbarn eine
Faktor-Aufschlüsselung (militärische Überlegenheit, Beziehung, wahrgenommene
Schwäche über Legitimität, bestehender Pakt) im Spec-Format inkl.
Gesamtsumme und Entscheidung. Hinweis: Die KI erklärt in dieser Version noch
selbst keinen Krieg — das ist die Grundlage für eine spätere echte
KI-Aggression, macht aber schon jetzt nachvollziehbar, wie eine Bewertung
aussähe.

**§83 Spielerinformation:** `updatePopulation()` und `computeRegionalPrices()`
schreiben jetzt eine vollständige Ursachen-Aufschlüsselung
(`region.lastPopBreakdown`, `region.priceBreakdown`) statt nur der Endsumme.

**§84 Tooltip-Prinzip:** Reines CSS-Tooltip-System (`[data-tip]`-Attribut,
kein JS nötig) — angewendet auf alle Warenpreise (Basis/Nachfrage/Angebot/
Multiplikator/Gesamt), Bevölkerungsgruppen (Geburten/Alterstod/Hungertote/
Seuchentote), Schatzkasse und Prestige.

**§48 Schwierigkeitsgrade:** 4 Stufen (Leicht/Normal/Schwer/Experte), wirken
NICHT über versteckte KI-Ressourcenboni, sondern über KI-Fehlerquote
(`aiMistakeChance`), KI-Bautempo-Multiplikator und Spionage-Grundgenauigkeit
— exakt wie in §48 gefordert. Empirisch verifiziert: Leicht Ø11 vs. Experte
Ø23 KI-Gebäude nach 30 Jahren über 8 Seeds.

**§8/§89 Start-/Charaktererstellungsbildschirm:** Neuer Titelbildschirm
(NEUES SPIEL / SPIEL LADEN / MEHRSPIELER [deaktiviert] / CHRONIK
[deaktiviert] / OPTIONEN) vor Spielbeginn. Charaktererstellung mit Name,
Geschlecht, Dynastiename, Startregion (nur eine verfügbar, siehe unten),
Schwierigkeitsgrad und Wahl von genau 2 Persönlichkeitsschwerpunkten (Traits)
statt zufälliger Zuweisung; alternativ "Zufälliger Herrscher"-Schnellstart.
Das Spiel startet jetzt nicht mehr automatisch beim Laden der Seite.

**Nebenbei gefundener und behobener Bug:** Beim gezielten Testen der
Schwierigkeitsgrad-Wirkung fiel auf, dass KI-Regionen seit dem Gebäude-Update
(Schritt 5) praktisch nie mehr neue Gebäude bauten — der "Wohlstands"-Näherungswert
basierte nur auf volatilen Kornlagern, die durch den laufenden
Bevölkerungsverbrauch tendenziell sanken und die Bauschwelle nie mehr
erreichten. Fix: Die Formel bezieht jetzt zusätzlich die Bevölkerungsgröße
ein (wachsende Regionen bauen wieder zuverlässig aus, §86). Vorher/Nachher
über 8 Seeds × 30 Jahre: 6 Gebäude gesamt (eingefroren) → 9–29 Gebäude
(aktive Entwicklung, differenziert nach Schwierigkeitsgrad).

**Getestet:** Determinismus, Save/Load-Kontinuität, Charaktererstellungs-Werte
(Name/Geschlecht/Dynastie/Traits/Schwierigkeit korrekt übernommen),
Schwierigkeitsgrad-Wirkung auf KI-Bautätigkeit, 80-Jahre-Regressionstest,
20×100-Jahre-Wirtschaftstest — alles weiterhin stabil bzw. verbessert.

**Nächste Punkte aus STATUS_ANALYSE.md (Runde 2):** mehr Bevölkerungsgruppen/
Waren/Produktionsketten/Gebäude (§13/§16/§17/§26), Stadtentwicklungsstufen
(§25), Infrastruktur (§27), Technologiesystem (§28), Belagerungen/tieferes
Schlachtsystem (§35/§36), mehrere Siegbedingungen (§47), Spielende-Auswertung
(§87).

## 2026-08-11 – Schritt 9: Gebäude-Karte ans Original angelehnt (auf Nutzerwunsch)

Auf Basis von Screenshots des ursprünglichen C64-Spiels wurde die Kartenansicht
der Gebäude überarbeitet:

- Von starrem 4×3-Raster auf eine **Landschaftskarte mit organisch verstreuten
  Gebäude-Symbolen** umgestellt (feste, aber unregelmäßige Positionen statt
  Gitterzellen) — näher am Original, aber mit modernem Hover-/Klick-Verhalten
- Terrain-Hintergrund (Grünverlauf), dezenter Fluss/Grenzverlauf als SVG-Pfad,
  Hauptstadt-Symbol (🏰) fix positioniert, ein paar dekorative Grasbüschel
- Neue **Zeichenerklärung** unterhalb der Karte, die jedes Gebäude-Icon mit
  Namen auflistet — direkt angelehnt an "Die Symbole und ihre Bedeutung" aus
  dem Original
- Bau-/Ausbaulogik unverändert (getestet, weiterhin funktionsfähig)

## 2026-08-11 – Schritt 10: Mittelalterliche Baustoffe (auf Nutzerhinweis, §16/§26)

Auf Hinweis, dass echte mittelalterliche Ressourcen (Holz, Stein, Ton, Metall,
Leder, Wolle) das tägliche Leben und Bauen prägten, wurde das Warensystem
erweitert:

- **3 neue Waren:** Stein, Ton, Leder (zusätzlich zu Holz/Eisen/Wolle) — damit
  9 von den ursprünglich geforderten 20+ Waren abgedeckt (§16)
- **3 neue Gebäude:** Steinbruch, Tongrube, Gerberei (analog zu Sägewerk/
  Schmiede — "enables"-Gebäude, die die jeweilige Rohstoffproduktion
  freischalten)
- **Bauwerke kosten jetzt echte Baustoffe, nicht nur Taler:** Jedes Gebäude
  hat einen `materialCost` (z. B. Stadtmauer: 50 Stein; Schmiede: 20 Stein +
  5 Eisen; Bauernhof: 20 Holz). Fehlen Materialien, scheitert der Bau mit
  konkreter Fehlermeldung, welche Ressource in welcher Menge fehlt. Das
  verknüpft Wirtschaft und Bautätigkeit spürbar (§3 Kettenreaktionen): ohne
  Steinbruch keine Stadtmauer, ohne Sägewerk kein Wachstum überhaupt.
  Ausbaustufen bleiben bewusst reine Geldkosten (Vereinfachung).
- **Leder als Verbrauchsgut:** Handwerker/Händler/Adel haben jetzt auch
  Lederbedarf (analog zu Werkzeugen), Stein/Ton werden dagegen ausschließlich
  als Baustoff verbraucht, nicht von der Bevölkerung konsumiert (historisch
  korrekt: Baumaterial vs. Alltagsgut)
- UI: Baumenü auf der Kartenseite zeigt jetzt die nötigen Materialien pro
  Gebäude an, fehlende Mengen werden rot hervorgehoben

**Getestet:** Materialkosten-Prüfung (Bau schlägt korrekt fehl bei fehlendem
Stein), 80-Jahre-Regressionstest und 20×100-Jahre-Wirtschaftstest weiterhin
stabil.

## 2026-08-11 – Schritt 11: Feudales Militärsystem (auf Nutzerhinweis, §33/§34/§35)

Auf Hinweis, dass mittelalterliche Militärs von Vasallenheeren, Söldnern und
dezentraler Kriegsführung (keine stehende Armee) geprägt waren, wurde das
Militärsystem grundlegend überarbeitet:

- **5 statt 3 Truppentypen:** Bauernmiliz, Bogenschützen, Armbrustschützen,
  Ritter, Söldner — mit klarer Herkunftsunterscheidung
- **Vasallentruppen vs. Söldner (§33/§34):** Bauernmiliz/Bogenschützen/
  Armbrustschützen werden aus der Bauernschaft ausgehoben (Bevölkerungskosten,
  keine Zufriedenheitsvoraussetzung). **Ritter erfordern echte Lehenstreue** —
  ohne ausreichende Adelszufriedenheit (≥45) verweigert der Adel den
  Ritterdienst, mit klarer Fehlermeldung. **Söldner** sind dagegen jederzeit
  gegen reines Gold verfügbar, ohne Bevölkerungskosten oder Zufriedenheits-
  voraussetzung — dafür unzuverlässig.
- **Fahnenflucht-Mechanik (neu):** Söldner desertieren mit Grundwahrschein-
  lichkeit jedes Jahr, deutlich häufiger wenn der Sold nicht mehr gedeckt ist
  (Staatskasse negativ) oder die Legitimität niedrig ist — Vasallentruppen
  sind davon nicht betroffen (Lehenstreue statt Bezahlung).
- **Schlachtformationen (§35):** Vor der Kriegserklärung wählbar — "Ritter im
  Zentrum" (Bonus nur mit vorhandenen Rittern), "Schützen als Vorhut" (Bonus
  nur mit Bogen-/Armbrustschützen), "Gleichmäßig verteilt" (kein Bonus, aber
  auch kein Malus). Keine echte taktische Simulation, aber eine
  nachvollziehbare Vorentscheidung mit Konsequenz.

**Getestet:** Lehenstreue-Verweigerung bei niedriger Adelszufriedenheit,
Söldner-Anwerbung unabhängig davon, erzwungene Fahnenflucht bei negativer
Kasse (5→2 Söldner in einem Testfall), Formationsboni (24,0 → 27,6 Stärke
mit passender Formation), 80-Jahre-Regressionstest und
20×100-Jahre-Wirtschaftstest weiterhin stabil.

## 2026-08-11 – Schritt 12: Systematische Abarbeitung STATUS_ANALYSE.md (Runde 2, Teil 1)

Beginn der vollständigen, punktweisen Abarbeitung aller in STATUS_ANALYSE.md
verbliebenen offenen Punkte, wie vom Nutzer gewünscht ("nach und nach").
Dieser Schritt deckt die ersten beiden Prioritätspunkte ab:

**§13/§16/§17/§26 Content-Erweiterung:**
- **18 statt 9 Waren:** neu Gemüse, Fleisch, Fisch, Salz (Grundnahrung),
  Kohle (Rohstoff), Wein, Waffen, Kleidung (Verarbeitet), Gewürze (Luxus —
  bewusst ohne heimische Produktionskette, reines Importgut)
- **10 statt 5 Bevölkerungsgruppen:** neu Landarbeiter, Bürger, Geistliche,
  Soldaten, Tagelöhner — jede Gruppe mit eigenem Warenbedarf und
  Bevölkerungsanteil (`share`), Summe exakt 1.0 geprüft
- **25 statt 13 Gebäudetypen:** neu Gemüsegarten, Viehweide, Fischerteich,
  Weingut, Kohlebergwerk, Salzsiederei, Waffenschmiede, Weberei, Kirche,
  Kloster, Universität, Palast
- **17 Produktionsketten** (vorher 8), jetzt mit `workerGroup`-Feld — jede
  Kette bezieht ihre Arbeitskraft aus der historisch passenden
  Bevölkerungsgruppe (Bauern/Landarbeiter Vollzeit-Urproduktion, Handwerker
  Teilzeit-Gewerbe) statt pauschal aus einer einzigen Gruppe
- Kirche/Kloster stärken jetzt aktiv den kirchlichen Einfluss, Palast liefert
  passives Prestige — beide über echte Ausbaustufen skalierend

**§25 Stadtentwicklung:** 8 Stufen (Weiler → Kaiserstadt) gemäß Spec-Vorgabe,
abhängig von Bevölkerung UND Infrastrukturstufe (nicht nur einem Wert),
jährlich geprüft, mit Chronik-Eintrag beim Stufenaufstieg und kleinem
Zufriedenheitsbonus je erreichter Stufe.

**§27 Infrastruktur:** Neue Ausbauleiste (0–6), kostet Taler + Stein/Holz,
jede Stufe erhöht Handelsvolumen (+8 %) und Produktion (+2 %) und ist
Voraussetzung für höhere Stadtentwicklungsstufen — echte Kopplung der
beiden Systeme.

**Kleiner Fund während des Tests:** Eine grammatisch falsche
Chronik-Meldung ("zu einer Dorf herangewachsen" statt "zu einem Dorf") beim
ersten Stufenaufstieg entdeckt und auf eine geschlechtsneutrale Formulierung
umgestellt ("hat die Entwicklungsstufe „Dorf“ erreicht").

**Getestet:** Warenanzahl (18), Bevölkerungsgruppen (10), Gebäudetypen (25)
und Produktionsketten (17) verifiziert; Summe der Bevölkerungsanteile exakt
1,0; Bau-/Materialkostenprüfung für neue Gebäude; Save/Load mit erweitertem
Datenmodell; Infrastrukturausbau inkl. Stufenaufstieg gezielt provoziert;
80-Jahre-Regressionstest und 20×100-Jahre-Wirtschaftstest weiterhin stabil
(etwas mehr Preisdruck an der Obergrenze durch die vielen neuen Waren ohne
automatischen Gebäudebau — erwartbar, dieselbe Ursache wie bereits in
Schritt 3 dokumentiert).

**Noch offen aus Runde 2 (folgt in den nächsten Schritten):**
Technologiesystem (§28), Belagerungen (§36), mehrere Siegbedingungen (§47),
Spielende-Auswertung (§87), Staatsschulden/Kredite (§24), erweiterte
Diplomatie-Aktionen (§29), KI-gegen-KI-Testsuite (§78).

## 2026-08-11 – Schritt 12: Ausrichtung am Original "Kaiser" (C64, 1984)

Auf Nutzerwunsch am originalen Spielprinzip von "Kaiser" (CCD/Ariolasoft,
1984) orientiert — recherchiert über C64-Wiki und Wikipedia. Folgende
Original-Mechaniken wurden ergänzt:

- **Land als Handelsware:** `region.land` (Start: proportional zur
  Bevölkerung, Referenz 10.000 Hektar), schwankender Landpreis (16–70 Taler,
  wie im Original), Kauf/Verkauf mit 10 % Verkaufsprovision (Original-Detail).
  Baugrundstücks-Anzahl ist jetzt **dynamisch aus dem Landbesitz** abgeleitet
  (mehr Land = mehr Baukapazität) statt fest auf 12 verdrahtet.
- **Kornverteilung über den Bedarf hinaus:** neuer Regler, kostet Getreide,
  hebt Zufriedenheit und lockt Zuwanderer an (Original-Strategietipp).
- **Regierungsstil-Regler** ("Sehr fair" bis "Gierig"): zusätzlicher Hebel
  neben der Steuer — mehr Einnahmen bei "gierig", aber Zufriedenheits- und
  Legitimitätsverlust.
- **Kriegsverbündete-Abfrage:** Vor jeder Kriegserklärung wird bei den
  übrigen bekannten Nachbarn abgefragt, ob sie dich unterstützen, den Gegner
  unterstützen oder neutral bleiben — abhängig von der Beziehung (statistisch
  über 500 Läufe verifiziert). Genau das originale "Bündnis"-Feature, das in
  Kritiken als einzige diplomatische Tiefe des Originals hervorgehoben wurde.
- **Automatische Bürgermiliz:** Armeestärke erhält jetzt einen Bonus aus der
  Anzahl von Markt/Mühle-Gebäuden — genau wie im Original ("Die Miliz ist
  eine Bürgerwehr, die Sie automatisch, abhängig von der Menge an
  Marktplätzen und Kornmühlen, erhalten").
- **Palast-Pflicht für König, Kathedrale-Pflicht für Kaiserwahl:** Neues
  Gebäude Kathedrale ergänzt; die Beförderung zum König ist jetzt an einen
  gebauten Palast gebunden, die Kaiserwahl kann erst nach Bau einer
  Kathedrale ausgelöst werden — direkt aus dem Original übernommen (per Test
  verifiziert: Beförderung/Wahl bleiben ohne die Gebäude blockiert).
- **Migration (schließt zusätzlich die §14-Lücke):** hohe Zufriedenheit
  zieht jetzt Zuwanderer an, niedrige vertreibt Bevölkerung.

## 2026-08-11 – Schritt 13: Kritischer Balancing-Bug behoben (Bevölkerungskollaps)

Beim Abschluss-Test der "Kaiser"-Original-Erweiterung fiel ein **schwerwiegender
Regressionsfehler** auf: 0 von 20 Wirtschaftstest-Partien liefen noch vollständig
durch — jede Partie kollabierte auf ~20–200 Einwohner. Vier zusammenwirkende
Ursachen wurden gefunden und behoben:

1. **Bauernanteil zu niedrig:** Die Content-Erweiterung (Schritt 12 der
   vorherigen Zählung/Runde 2) hatte den Bauernanteil von 45 % auf 24 %
   gesenkt, ohne die Getreideproduktion entsprechend anzupassen. Korrigiert
   auf 40 % Bauern + 8 % Landarbeiter (nahe am historischen Original-Anteil).
2. **Unbegrenzt aufsummierte Bedarfsstrafen:** Mit bis zu 8 Warenbedarfen pro
   Gruppe (z. B. Adel) addierten sich die Einzelstrafen bei Mangel unbegrenzt
   auf, statt wie früher (max. 1–2 Bedarfe) begrenzt zu bleiben. Umgestellt auf
   eine gewichtete Durchschnittsdefizit-Berechnung — die Gesamtstrafe bleibt
   dadurch unabhängig von der Anzahl der Bedarfsarten vergleichbar mit vorher.
3. **Fehlende Homöostase:** Zufriedenheit hatte grundsätzlich keine
   stabilisierende Rückkehrkraft — jede noch so kleine Dauerbelastung (allein
   schon der Standard-Steuersatz) führte unweigerlich in eine Todesspirale
   Richtung 0. Eine milde Rückkehrkraft zur Mitte (Zielwert 50) wurde ergänzt,
   die echte Schocks (Hunger, Kriegsniederlage, Rebellion) unverändert
   durchschlagen lässt.
4. **Migrationsfaktor um Faktor 10 zu stark:** Der in Schritt 12 neu
   eingeführte Migrationsmechanismus (§14) ließ bei nur mäßig niedriger
   Zufriedenheit (35 statt 50) bereits ~6 % der Bevölkerung pro Jahr
   abwandern. Auf ein realistisches Maß reduziert.

**Ergebnis:** 20×100-Jahre-Wirtschaftstest läuft jetzt wieder sauber durch —
16 von 20 Partien erreichen das Testende ganz ohne jedes Abbruchereignis, die
übrigen 4 enden ausschließlich an "kein Erbe" (normale Dynastie-Varianz),
**keine einzige mehr an Bevölkerungskollaps oder Bankrott**. Diese Art von
Fund ist genau der Zweck des automatisierten Wirtschaftstests aus §77 — ohne
ihn wäre dieser Bug erst im Spielverlauf aufgefallen.

**Lehre für weitere Content-Erweiterungen:** Jede neue Bevölkerungsgruppe mit
mehreren Warenbedarfen und jeder neue Dauerhebel (Steuer, Regierungsstil,
Migration) muss gegen den automatisierten Wirtschaftstest laufen, bevor er
als abgeschlossen gilt — nicht nur gegen einen einzelnen 80-Jahre-Lauf, der
Kollaps-Trends noch nicht zuverlässig zeigt.

## 2026-08-12 – Schritt 14: Restliche STATUS_ANALYSE.md-Punkte abgearbeitet

Die komplette verbliebene Prioritätenliste wurde umgesetzt:

**§28 Technologiesystem:** 5 Kategorien (Landwirtschaft, Handwerk, Militär,
Verwaltung, Handel), je bis Stufe 5 ausbaubar. Forschungspunkte entstehen aus
Universität-Gebäuden (+ passivem Grundwert), investierbar über ein neues
UI-Panel. Boni wirken direkt in Getreideproduktion, allgemeiner Produktion,
Armeestärke, Steuereinnahmen und Handelsvolumen — keine reine Zahlenkosmetik.

**§36 Belagerungen:** Kriegserklärung gegen eine Region mit Stadtmauer löst
jetzt eine mehrjährige Belagerung aus (Dauer abhängig von der Mauerstufe)
statt einer Sofortschlacht. Drei Spieleraktionen während der Belagerung:
Sturmangriff (riskanter, höhere Verluste, sofortige Entscheidung), Aushungern
(schwächt den Verteidiger schrittweise, kostet weiterhin reduzierten
Unterhalt), Bestechung der Garnison (Geld gegen Erfolgschance, bei Fehlschlag
Beziehungsschaden). Unbefestigte Ziele bleiben Sofortschlachten.

**§47 Mehrere Siegbedingungen:** Bei der Charaktererstellung wählbar:
Kaiser werden (klassisch, Kaiserwahl), Reichste Dynastie (Schatzkasse-Ziel,
5 Jahre halten), Größte Handelsmacht (Lagerwert-Ziel, 5 Jahre halten),
Militärische Dominanz (alle 3 Nachbarn im Krieg besiegen), Endlosmodus
(kein Sieg-Ziel).

**§87 Spielende-Auswertung:** Der Game-Over-Bildschirm zeigt jetzt eine
vollständige Chronik-Zusammenfassung: Regierungsjahre, Dynastiegenerationen,
höchster erreichter Titel, größte je erreichte Bevölkerung/Staatskasse,
Kriegsbilanz (gewonnen/verloren), überstandene Katastrophen, erreichte
Stadtentwicklungsstufe. Alle Werte werden laufend in `state.stats`
mitgeschrieben, nicht erst am Ende berechnet.

**§24 Staatsschulden:** Kredite aufnehmbar, Zinssatz hängt von Prestige und
Legitimität ab (bessere Herrschaft = günstigere Kredite), jährlich fällige
Zinszahlung, Teilrückzahlung möglich. Eigenes UI-Panel neben dem Landhandel.

**§29 Erweiterte Diplomatie:** Vasallisierung (ab hoher Beziehung, liefert
danach laufenden Tribut), Tribut fordern (Erfolgschance, bei Fehlschlag
Beziehungsschaden), dynastische Ehe (setzt eine dauerhafte Beziehungs-
Untergrenze, die auch bei negativer Drift nicht mehr unterschritten wird),
Geiselaustausch (einfacher Beziehungsschub).

**§78 KI-gegen-KI-Testsuite:** Neues `tests/ai_vs_ai_test.js` — lässt 100
Partien über je 100 Jahre komplett ohne Spielereingriff laufen und prüft,
ob eine der 7 KI-Regionen unangemessen häufig zur bevölkerungsreichsten
wird (Hinweis auf einen unbeabsichtigten Startvorteil, §81 "keine Strategie
darf nahezu immer gewinnen"). Prüft zusätzlich, dass der Spieler bei rein
passivem Spiel nicht versehentlich gewinnen kann.

**Wichtiger Fund durch die neue Testsuite:** Der erste Lauf deckte auf, dass
Bayern (ai4) in 57 von 100 Partien die bevölkerungsreichste KI-Region wurde —
verursacht durch zu große Unterschiede in der Startbevölkerung zwischen den
7 KI-Regionen (2200–4200 Einwohner). Alle Regionen wurden auf einen engeren
Bereich (2700–2900) mit Fruchtbarkeit als verbleibender Differenzierung
angeglichen. Nach der Korrektur: höchste Dominanz-Häufigkeit einer einzelnen
Region nur noch 27 % (vorher 57 %), keine kritische Auffälligkeit mehr.
Ohne die neue Testsuite wäre dieses Ungleichgewicht nicht aufgefallen — genau
der Zweck von §78.

**Getestet:** Alle neuen Funktionen (Technologie-Investition, Belagerung mit
allen drei Aktionen, alle 4 neuen Diplomatie-Aktionen, Kredit-Auf-/Abnahme,
alternative Siegbedingungen) einzeln verifiziert; 100-Jahre-Regressionstest,
20×100-Jahre-Wirtschaftstest und 100×100-Jahre-KI-Testsuite laufen alle
stabil ohne kritische Befunde.

**Damit sind alle Punkte aus STATUS_ANALYSE.md, die in der letzten
Prioritätenliste genannt wurden, abgearbeitet.** Verbleibende, bewusst nicht
umgesetzte Punkte (siehe STATUS_ANALYSE.md für die vollständige Liste):
echtes Sprite-/Canvas-Rendering, Chiptune-Musik, Intro-Sequenz, Easter Eggs,
vollständige Sprachumschaltung — allesamt laut Spec selbst niedrigste
Priorität (§101).

## 2026-08-12 – Schritt 15: Marktplatz — direkter Warenkauf/-verkauf (§20/§21/§73)

Auf Nutzeranfrage ergänzt: Der Spieler kann Waren jetzt direkt kaufen und
verkaufen, statt nur indirekt über Produktion und die automatische
KI-Handelslogik zwischen Regionen zu wirtschaften — schließt eine seit dem
ursprünglichen Prototyp offene Anforderung aus §73 ("Getreide kaufen",
"Getreide verkaufen").

- Neues Marktplatz-Panel: Warenauswahl (alle 18 Waren), Mengenfeld,
  Kaufen-/Verkaufen-Buttons
- Transaktionen laufen zum aktuellen Regionalpreis, mit Aufschlag beim Kauf
  (+8 %) bzw. Provision beim Verkauf (−8 %) — bewusst analog zur bereits
  bestehenden 10 %-Provision beim Landverkauf, für ein konsistentes Bild
- Bewusst **kein separates Preismodell**: Käufe/Verkäufe verändern nur den
  Lagerbestand, der Preis reagiert ganz normal übers bestehende Angebot/
  Nachfrage-System im nächsten Jahr — keine Doppelbuchführung nötig
- Damit hat der Spieler einen dritten echten Wirtschaftshebel neben Steuern
  und Regierungsstil: gezielt Engpässe überbrücken (z. B. Getreide in einer
  Hungersnot zukaufen) oder Überschüsse zu Geld machen

**Getestet:** Kauf/Verkauf-Logik direkt verifiziert (inkl. Fehlerfall bei zu
geringem Lagerbestand), 80-Jahre-Regressionstest, 20×100-Jahre-Wirtschaftstest
(19/20 vollständig ohne Abbruch) und 100×100-Jahre-KI-Testsuite laufen alle
weiterhin stabil ohne kritische Befunde.

**Mögliche spätere Erweiterung (nicht umgesetzt):** echter Handel zwischen
zwei konkreten Regionen mit Preisunterschied als bewusste Arbitrage-Strategie
(näher am §21-Beispiel mit Getreidepreisen in Köln/Mainz/München) — aktuell
handelt der Spieler pauschal "mit dem Markt seiner eigenen Region", nicht
gezielt mit einem bestimmten Nachbarn.

## 2026-08-12 – Schritt 16: Regionalhandel — echte Arbitrage zwischen zwei Regionen (§20/§21)

Direkt im Anschluss auf Nutzerwunsch umgesetzt: der Spieler kann jetzt gezielt
mit einer bestimmten anderen Region handeln, nicht mehr nur pauschal mit dem
eigenen lokalen Markt — genau das Beispiel aus §21 der Spec (unterschiedliche
Getreidepreise in Köln/Mainz/München gezielt ausnutzen).

- Neues Panel "Regionalhandel (Arbitrage)": Ware + Zielregion wählbar (alle
  7 KI-Regionen erreichbar, nicht nur die 3 diplomatisch bekannten Nachbarn —
  Handel setzt keine Grenznähe voraus), zeigt Preis bei dir und dort direkt
  nebeneinander mit Handlungsempfehlung ("dort teurer → Export lohnt sich")
- **Exportieren:** Ware aus dem eigenen Lager wird zum Preis der Zielregion
  verkauft (abzüglich Transportkosten)
- **Importieren:** Ware wird zum Preis der Zielregion gekauft und ins eigene
  Lager gebracht (zuzüglich Transportkosten)
- Transportkosten (12 %) höher als beim lokalen Markt (8 %) — Fernhandel ist
  teurer, aber bei großen Preisunterschieden trotzdem lohnend
- **Räuberrisiko (§20 "Gefahren: Räuber, Piraten...")**: ca. 6 % Chance, dass
  ein Handelszug überfallen wird und nur ein Teil der Ware ankommt bzw.
  verkauft werden kann — macht Fernhandel spürbar riskanter als den
  Lokalmarkt, ohne ihn unspielbar zu machen
- Export/Import verändern tatsächlich den Lagerbestand beider beteiligter
  Regionen — wirkt sich über das bestehende Angebot/Nachfrage-System auch auf
  deren künftige Preise aus (echte Marktdynamik, keine isolierte Transaktion)

**Getestet:** Export/Import-Logik direkt verifiziert (inkl. Fehlerfällen bei
zu geringem Lagerbestand/Guthaben), Räuberrisiko statistisch bestätigt
(6,7 % über 2000 Würfe, erwartet ~6 %), 80-Jahre-Regressionstest,
20×100-Jahre-Wirtschaftstest und 100×100-Jahre-KI-Testsuite laufen weiterhin
stabil ohne kritische Befunde.

## 2026-08-12 – Schritt 17: Gebäude-Karte visuell aufgewertet (Pixel-Art-Icons)

Auf Nutzerwunsch ("mehr bildliche Darstellung") wurde die Kartenansicht
grundlegend überarbeitet:

- **26 individuelle Pixel-Art-Icons**, ein eigenes für jeden Gebäudetyp
  (Bauernhof, Windmühle mit Flügeln, Steinbruch als gestufte Felsblöcke,
  Schmiede mit Amboss, Waffenschmiede mit gekreuzten Schwertern, Kathedrale
  mit Rosette, Palast mit goldenen Türmen, uvm.) — aus einfachen Rechtecken/
  Polygonen auf 20×20-Pixelraster zusammengesetzt, konsistent mit der
  reduzierten Retro-Palette (keine Verläufe, harte Kanten, §49–52)
- **Pixel-Art-Schloss statt Emoji** für die Hauptstadt — Emojis rendern
  plattformabhängig und passen nicht zum einheitlichen 8-Bit-Look
  (eigenes SVG mit drei Türmen und Wappentürmchen)
- **Landschaftsdeko erweitert**: Bäume, Büsche und angedeutete Hügel als
  Pixel-Art statt der bisherigen Text-Symbole (♣), Terrain zusätzlich mit
  dezenter Diagonal-Textur statt reinem Farbverlauf
- **Ausbaustufe jetzt visuell statt als Text**: kleine Punkte-Anzeige
  (gefüllt = erreichte Stufe) statt "St. X/Y"-Beschriftung
- Icons konsistent auch in der Zeichenerklärung, der Bauauswahl-Liste und
  der Grundstücks-Detailansicht verwendet — nicht nur auf der Karte selbst

**Getestet:** Vollständigkeit verifiziert (alle 26 Gebäudetypen haben ein
eigenes Icon, kein Rückfall auf Platzhalter), Syntaxprüfung beider Script-
Blöcke nach den umfangreichen Template-String-Änderungen, Regressionstest
inkl. Bauaktion weiterhin fehlerfrei.

## 2026-08-12 – Schritt 18: Siedler-Ästhetik (Wege, Holzrahmen, mehr Naturdeko)

Auf Nutzer-Screenshot ("Die Siedler") hin die Kartenansicht weiter Richtung
verbundene, natürliche Spielwelt entwickelt (echte Siedler-Sprite-Qualität
würde den Rahmen sprengen, aber Bildsprache übernommen):

- **Holzrahmen um die Karte**: gemasertes Holzmuster als Rand mit vier
  Metall-Nieten in den Ecken (reines CSS, keine Bildassets)
- **Wege zwischen Hauptstadt und jedem bebauten Grundstück**: leicht
  geschwungene, gestrichelte Feldwege (SVG-Pfade), dynamisch neu berechnet
  bei jedem Kartenaufbau — verbindet die Szene optisch wie im Vorbild
- **Felsen als weitere Landschaftsdeko** (4 Positionen) zusätzlich zu Bäumen/
  Büschen/Hügeln aus Schritt 17
- **Schlagschatten unter jedem Gebäude-Marker** (dunkle Ellipse), verstärkt
  den Eindruck, dass die Gebäude auf dem Terrain "stehen" statt zu schweben

**Getestet:** Syntaxprüfung beider Script-Blöcke, Regressionstest weiterhin
fehlerfrei.

## 2026-08-12 – Schritt 19: Eigene Icons für alle 18 Handelswaren

Auf Nutzerwunsch bekommt jetzt auch jede Ware ein individuelles Pixel-Art-
Symbol (bisher hatten nur Gebäude eigene Icons) — Getreide als Ährenbund,
Fisch als Silhouette mit Flosse, Bier als Krug mit Henkel und Schaum, Wein
als Flasche, Werkzeuge als gekreuzter Hammer/Schraubenschlüssel, Waffen als
Schwert, Gewürze als Sack mit bunten Punkten, uvm. — alle 18 Waren einzeln
unterscheidbar, im selben 20×20-Pixelraster-Stil wie die Gebäude-Icons.

- Preistabelle zeigt jetzt Icon + Name pro Zeile statt nur Text
- Marktplatz- und Regionalhandel-Panel zeigen eine größere Icon-Vorschau der
  aktuell gewählten Ware neben dem Auswahlmenü
- Palette um sechs weitere Farbtöne erweitert (Orange, Fleischtöne, Lila,
  Gelb, Creme, Silber) für mehr visuelle Unterscheidbarkeit zwischen den
  Warenkategorien

**Getestet:** Vollständigkeit verifiziert (alle 18 Waren haben ein eigenes
Icon), Syntaxprüfung, Regressionstest weiterhin fehlerfrei.

## 2026-08-12 – Schritt 20: Design-Bereinigung — einheitliches Design-System

Auf Nutzerhinweis ("sieht alles ziemlich durcheinander aus") das komplette
Erscheinungsbild aufgeräumt. Eine Bestandsaufnahme zeigte den Grund klar:
nach 19 Entwicklungsschritten hatten sich **13 verschiedene Schriftgrößen**
(7–32px, oft nur 1px auseinander), **12 verschiedene Abstandswerte** und eine
abweichende Schriftart (`monospace` statt der Pixel-Schrift) im Tooltip
angesammelt — jede neue Funktion hatte ihre eigenen Ad-hoc-Werte mitgebracht.

- **Design-System eingeführt:** feste Typografie-Skala (`--fs-micro` 7px bis
  `--fs-logo` 32px, 7 Stufen statt 13 wild gestreuter Werte) und
  Abstands-Skala (`--sp-1` bis `--sp-5`) als CSS-Variablen im `:root`-Block
- **Alle 45 Schriftgrößen- und 33 Abstands-Deklarationen** im gesamten
  Dokument (sowohl im `<style>`-Block als auch in den dynamisch generierten
  Inline-Styles der JS-Render-Funktionen) automatisiert auf die neuen Tokens
  umgestellt — keine harten Pixelwerte mehr verstreut im Code
- **Eine einzige Schriftart konsequent überall** (`var(--font)` = Press
  Start 2P), die abweichende `monospace`-Deklaration im Preis-Tooltip behoben
- **Neue `.subhead`-Komponente** für klare Unterabschnitte: Land,
  Staatsschulden und Infrastruktur waren bisher ohne eigene Überschrift
  einfach unter "Deine Provinz" durchgereicht worden und wirkten wie ein
  undifferenzierter Textblock — jetzt klar als eigene Abschnitte
  gekennzeichnet
- Überflüssige, sich wiederholende Inline-`margin-top`-Overrides an den
  Panel-Überschriften entfernt — eine zentrale CSS-Regel
  (`.panel h2.title:not(:first-child)`) sorgt jetzt automatisch für
  einheitliche Abstände zwischen Abschnitten

**Getestet:** Syntaxprüfung beider Script-Blöcke nach den umfangreichen,
automatisiert über das gesamte Dokument angewendeten Ersetzungen,
80-Jahre-Regressionstest und 20×100-Jahre-Wirtschaftstest weiterhin stabil.

**Nächster sinnvoller Schritt** (nicht in diesem Durchgang umgesetzt): den
Kampfbildschirm (`battle.html`) auf dasselbe Design-System umstellen, sowie
ggf. die stark gewachsene Provinz-Seite in Unterreiter (Hof/Wirtschaft/
Diplomatie) statt einer langen Zweispalten-Liste aufzuteilen, falls weiterhin
Unübersichtlichkeit empfunden wird.

## 2026-08-12 – Schritt 21: Provinz-Seite in eigene Reiter aufgeteilt

Auf Nutzerwunsch die bisherige Zweispalten-Sammelseite (Hof, Berater,
Technologie, Bevölkerung, Regierung, Land, Schulden, Infrastruktur links;
Preise, Markt, Handel, Diplomatie, Chronik rechts — alles auf einmal
sichtbar) in sechs klar getrennte Reiter aufgeteilt:

- **🏰 PROVINZ** (erste Seite, wie gewünscht nur diese Inhalte): Hof,
  Regierung (Steuersatz/Regierungsstil/Kornausgabe), Bevölkerungstabelle,
  Zufriedenheit, Siedlungsstufe
- **📚 BERATER & FORSCHUNG**: Berater-Ämter, Technologie
- **💰 WIRTSCHAFT**: Marktpreise/Lager, Marktplatz, Regionalhandel, Land,
  Staatsschulden, Infrastruktur
- **🤝 DIPLOMATIE**: Diplomatie-Panel, Reichschronik
- **🗺 KARTE & GEBÄUDE** und **⚔ MILITÄR** unverändert

Technisch risikoarm umgesetzt: alle Panel-Inhalte (Element-IDs) wurden nur in
neue Container-`<div>`s verschoben, ohne die IDs selbst zu ändern — die
komplette `render()`-Logik greift weiterhin unverändert per `getElementById`
darauf zu, unabhängig davon, in welchem Reiter das Element gerade sichtbar
ist. Tab-Leiste ist jetzt umbruchfähig gestaltet (6 statt 3 Reiter bei
gleichbleibender Breite).

**Getestet:** Statischer Abgleich aller 82 im Code referenzierten
Element-IDs gegen die tatsächlich vorhandenen IDs im Dokument — keine einzige
fehlt. Syntaxprüfung beider Script-Blöcke, Regressionstest und
20×100-Jahre-Wirtschaftstest weiterhin fehlerfrei.

## 2026-08-12 – Schritt 22: Chronik auf die Provinz-Seite verschoben

Kurze Nachbesserung auf Nutzerhinweis: die Reichschronik gehörte laut
Rückmeldung ebenfalls auf die erste Seite (Provinz), nicht zur Diplomatie.
Verschoben — Provinz-Reiter zeigt jetzt Hof, Regierung, Bevölkerung und
Chronik zusammen; Diplomatie-Reiter enthält nur noch das Diplomatie-Panel.

## 2026-08-12 – Schritt 23: Marktspekulation — Preise schwanken jetzt auch ohne Angebots-/Nachfrageänderung

Auf Nutzerwunsch ("Marktpreise sollen sich Jahr für Jahr verändern, wie auf
einem richtigen Markt"): Bisher waren Preise rein mechanisch aus Angebot und
Nachfrage berechnet — blieb die Lagermenge stabil, blieb auch der Preis
stabil, was sich träge anfühlte.

- Neue **Marktstimmungs-Komponente** pro Ware und Region: ein
  mittelwert-rückkehrender Zufallsprozess (0,75×–1,35×), der sich jedes Jahr
  leicht verschiebt — technisch dieselbe Art von Mechanik wie bereits beim
  Landpreis aus Schritt 12, jetzt auch für alle 18 Waren einzeln
- Preis-Tooltip zeigt die Marktstimmung jetzt als eigene Zeile neben
  Nachfrage/Angebot — bleibt damit weiterhin vollständig nachvollziehbar
  (§84), nicht einfach ein unsichtbarer Zufallsfaktor
- Bewusst moderat kalibriert: spürbare Schwankungen von Jahr zu Jahr, aber
  keine Verzerrung der Wirtschaftsbalance (mit Wirtschaftstest verifiziert)

**Getestet:** Preisverlauf über mehrere Jahre beobachtet (z. B. Gewürze
26→24→24…, Waffen 19→20→19→18…) — sichtbare, aber maßvolle Bewegung.
80-Jahre-Regressionstest und 20×100-Jahre-Wirtschaftstest weiterhin stabil
ohne kritische Auffälligkeiten.

## 2026-08-12 – Schritt 24: Kampf-Engine ins Hauptspiel integriert

Die separat entwickelte Kampf-Engine (`battle-engine/`) ersetzt jetzt die
bisherige Sofortauflösung im Militär-Reiter vollständig. Eine
Kriegserklärung öffnet den vollen interaktiven Kampfbildschirm (Formation,
Taktik, Gelände-abhängiger Verteidigerbonus, Moral, Entscheidungspunkte,
Schlachtbericht) statt nur einen simplen Stärkevergleich zu würfeln.

**Technische Umsetzung:**
- **Namenskollision behoben:** Beide Systeme hatten eine eigene `FORMATIONS`-
  Konstante mit unterschiedlichem Aufbau — die der Kampf-Engine wurde
  durchgängig zu `BATTLE_FORMATIONS` umbenannt (in allen drei Engine-Dateien
  und `battle.html`), damit sie beim Zusammenführen nicht die
  Hauptspiel-Version überschreibt.
- **Neue Brücken-Datei `js/battle-bridge.js`:**
  - `buildPlayerBattleArmy()` — rechnet die 5 Hauptspiel-Truppentypen
    (Miliz/Bogenschützen/Armbrustschützen/Ritter/Söldner) auf die 5
    Kampf-Engine-Einheitentypen um (Bogen- und Armbrustschützen werden zu
    einer Fernkampf-Einheit zusammengefasst, Ritter→Kavallerie,
    Söldner→Infanterie); Kaserne-/Markt-/Mühle-Bonus wird als zusätzliche
    ausgebildete Miliz übersetzt; der Kommandant entsteht aus den
    Herrscherwerten (Militär→Führung, Diplomatie→Taktik, Charisma→Mut)
  - `buildAiBattleArmy()` — da KI-Regionen keine echten Truppenstapel
    besaßen (nur einen abstrakten Stärkewert), wird eine plausible
    Zusammensetzung aus Bevölkerung und Kaserne-Ausbaustufe generiert
  - `determineWarTerrain()` — eine Stadtmauer beim Verteidiger löst jetzt
    das Gelände "Burg" mit dessen eingebautem, sehr starkem
    Verteidigerbonus aus, statt der bisherigen separaten mehrjährigen
    Belagerungs-Zustandsmaschine
  - `applyBattleResultToGame()` — rechnet die Truppenverluste anteilig
    zurück auf die ursprünglichen Hauptspiel-Truppentypen, verbucht Beute/
    Prestige/Beziehungsschaden/Zufriedenheitsverlust, aktualisiert die
    Kriegsstatistik für die Siegbedingung "Militärische Dominanz" und die
    Spielende-Auswertung
- **UI:** Neues Overlay (`#btOverlay`) mit Aufstellung, Schlachtfeld
  (Truppenblöcke mit Moralbalken), Kampfprotokoll, Entscheidungspunkten und
  Schlachtbericht — konsequent mit den bestehenden Design-Tokens
  (`--fs-*`, `--sp-*`) des Hauptspiels gestaltet, nicht mit eigenen Werten
  wie im ursprünglichen `battle.html`-Prototyp
- **Bewusste Vereinfachung:** Die bisherige mehrjährige Belagerungs-
  Zustandsmaschine (Sturmangriff/Aushungern/Bestechung über mehrere Jahre)
  wurde entfernt zugunsten des Gelände-basierten Festungsbonus in der neuen
  Engine — zwei parallele, unabhängig komplexe Belagerungssysteme
  gleichzeitig zu pflegen hätte den Umfang gesprengt. Die alten Funktionen
  (`resolveSiegeStorm` usw.) bleiben unbenutzt im Code stehen, falls das
  Konzept später wieder aufgegriffen werden soll.

**Getestet:** Truppenumrechnung in beide Richtungen verifiziert (Rekrutierung
→ Kampfarmee → Rückübertragung nach Schlacht), vollständige Beispielschlacht
end-to-end durchlaufen (alle 6 Phasen, Ergebnis korrekt zurückverbucht:
Truppenverluste, Beute, Prestige, Beziehungseinbruch), globaler ID-Abgleich
(keine doppelten, keine fehlenden IDs im ganzen Dokument), 80-Jahre-
Regressionstest, 20×100-Jahre-Wirtschaftstest und 100×100-Jahre-
KI-Testsuite weiterhin stabil ohne kritische Befunde.

## 2026-08-12 – Schritt 25: Startbildschirm-Grafik durch goldene Krone ersetzt

Auf Nutzerwunsch die bisherige ASCII-Art (Berge, Schloss-Emoji, Stadtraster,
"FLUSS"-Text) auf dem Startbildschirm durch ein einziges, sauberes
Pixel-Art-Krone-Symbol in Gold ersetzt — im selben Stil wie die 26
Gebäude- und 18 Waren-Icons aus den Schritten 17/19 (SVG aus einfachen
Formen, reduzierte Palette, harte Kanten, mit Schlagschatten).

## 2026-08-12 – Schritt 26: Datei-Modularisierung (`sim.js` in 8 Module aufgeteilt)

Auf Nutzerwunsch Punkt 8 der offenen Prioritätenliste umgesetzt: `sim.js` war
auf über 1600 Zeilen angewachsen und wurde zunehmend unübersichtlich.

**Vorgehen (risikoarm, automatisiert statt von Hand kopiert):** Ein
Python-Skript hat alle 98 Top-Level-Funktionen/Konstanten samt ihrer
Kommentarblöcke automatisiert aus `sim.js` extrahiert und anhand einer
Namenszuordnung auf 8 fachlich kohärente Module verteilt:

- **`js/core.js`** — Zufallszahlen (§67), Gebäude-Parzellen-Utilities (§26),
  Regions-/Spielerzeugung, Speichersystem (§64)
- **`js/economy.js`** — Produktion, Preise (inkl. Marktspekulation), Handel
  (Markt/Regionalhandel/Land), Steuern, Infrastruktur, Staatsschulden,
  Technologie
- **`js/population-dynasty.js`** — Bevölkerungsentwicklung, Migration,
  Stadtentwicklung, Charaktere/Heirat/Erbfolge
- **`js/politics.js`** — Titel-Aufstieg, Kaiserwahl, Regierungsstil,
  Religion, alternative Siegbedingungen
- **`js/diplomacy.js`** — Verträge, Vasallen/Tribut/Ehe/Geiseln, Intrigen,
  Kriegsverbündete
- **`js/military.js`** — Berater, Truppen, Armeestärke, Unterhalt,
  KI-Stärkeschätzung (alte, seit der Kampf-Engine-Integration unbenutzte
  Sofort-/Belagerungsauflösung bleibt hier als toter Code stehen)
- **`js/debug.js`** — Entwicklungs-/QA-Werkzeuge, KI-Entscheidungsanalyse
- **`js/advance-year.js`** — der zentrale jährliche Rundenschritt, der alle
  anderen Module orchestriert (muss zuletzt geladen werden)

**Verifikation (entscheidend bei einer reinen Umstrukturierung ohne
Verhaltensänderung):** Ein automatisierter Vergleichstest hat dieselbe
60-Jahre-Partie mit identischem Seed und identischen Aktionen einmal mit dem
alten `sim.js` und einmal mit den neuen, zusammengefügten Modulen laufen
lassen — das Ergebnis (kompletter Spielzustand als JSON) war **bitweise
identisch**. Erst danach wurde die alte `sim.js` gelöscht.

**Angepasst:** `index.html`-Build (8 `<script>`-Tags statt einem), beide
Testsuiten (`economy_test.js`, `ai_vs_ai_test.js`) lesen jetzt alle 8 Module
statt der alten Einzeldatei ein.

**Getestet:** Bitweiser Determinismus-Vergleich alt/neu (bestanden),
Syntaxprüfung aller 8 Module einzeln und kombiniert, globaler
ID-Abgleich im HTML, 80-Jahre-Regressionstest inkl. Kampf-Engine-Bridge,
20×100-Jahre-Wirtschaftstest und 100×100-Jahre-KI-Testsuite — alle weiterhin
fehlerfrei.

## 2026-08-12 – Schritt 27: Fehlende Waren + Produktionsketten ergänzt (§16/§17)

Erster Punkt der neuen, selbst vorgeschlagenen Prioritätenliste: die letzte
Content-Lücke bei Waren/Produktionsketten geschlossen.

- **5 neue Waren**: Papier, Bücher, Schmuck, Seide, Glaswaren (damit 23 statt
  18 Waren gesamt)
- **4 neue Gebäude**: Papiermühle, Buchbinderei, Goldschmiede, Glasbläserei
  (damit 30 statt 26 Gebäude gesamt), jeweils mit eigenem Pixel-Icon und
  Baustoffkosten
- **Erste echte zweistufige Produktionskette** (bisher nur einstufige
  Ketten): Holz → Papier → Bücher, mit Buchbinderei-Arbeitskraft aus den
  Geistlichen — passend zum historischen Vorbild klösterlicher
  Buchherstellung
- Seide bewusst ohne heimische Produktionskette (wie Gewürze) — reines
  Importluxusgut
- Bevölkerungsbedarfe entsprechend erweitert: Bürger/Händler/Adel/Geistliche
  bekommen kleine Bedarfe an den neuen Luxusgütern

**Gefundenes und behobenes Balancing-Problem:** Die erste Kalibrierung der
Papier-Produktionsrate war zu niedrig, sodass praktisch kein Papier für die
Bücherkette übrig blieb (Lagerbestand blieb nahe 0). Nach Erhöhung der
Papiermühlen-Produktionsrate (0,15 → 0,4 pro Arbeiter) fließt jetzt
tatsächlich Papier in die Bücherproduktion. Die verbleibende geringe
Büchermenge (Geistliche sind mit 3 % Bevölkerungsanteil eine kleine Gruppe)
ist bewusst so belassen — passt zum historischen Bild seltener, wertvoller
Bücher.

**Getestet:** Icon-Vollständigkeit verifiziert (alle 23 Waren, alle 30
Gebäude haben ein eigenes Icon), Produktionskette isoliert nachgerechnet,
80-Jahre-Regressionstest und 20×100-Jahre-Wirtschaftstest weiterhin stabil,
globaler ID-Abgleich ohne Duplikate.

**Nächste Punkte der Reihenfolge** (angekündigt, noch nicht umgesetzt):
fehlende Diplomatie-Aktionen (Durchmarschrecht, Garantien, Friedensvertrag,
Gebietsforderungen), danach Belagerungen mit der Kampf-Engine kombinieren.

## 2026-08-12 – Schritt 28: Fehlende Diplomatie-Aktionen ergänzt (§29)

Zweiter Punkt der Reihenfolge: die restlichen 4 der 12 in der Spec genannten
Diplomatie-Aktionen ergänzt — bewusst nicht als isolierte Textbausteine,
sondern an bereits aktive Systeme angebunden statt an den seit der
Kampf-Engine-Integration toten `rollWarAllies`-Code:

- **Durchmarschrecht**: neuer Vertragstyp `treaties.durchmarsch`; halbiert
  Transportkosten UND Räuberrisiko beim Regionalhandel mit der betreffenden
  Region (echte Kopplung an das aktive Handelssystem aus Schritt 16, nicht
  nur eine kosmetische Beziehungs-Aktion)
- **Garantie**: setzt wie die dynastische Ehe eine dauerhafte
  Beziehungs-Untergrenze (`guaranteeFloor`), aber günstiger und ohne
  Heiratsvoraussetzung — sichtbar als "Garantiert"-Badge
- **Friedensvertrag**: großer einmaliger Beziehungssprung; die Kosten
  steigen automatisch, je schlechter die aktuelle Beziehung ist (mehr
  Zugeständnisse nötig für eine echte Aussöhnung)
- **Gebietsforderung**: fordert Land von einer Region — Erfolgschance hängt
  vom Kräfteverhältnis ab (`armyStrength` vs. `estimateAiStrength`), bei
  Erfolg wandert echtes Land vom Ziel zur Spielerregion (dieselbe
  Land-Ressource wie beim Landhandel aus dem Original "Kaiser"), bei
  Misserfolg Beziehungsschaden

**Getestet:** Alle 4 Funktionen einzeln verifiziert (inkl. Erfolgs- und
Fehlschlagfällen), UI-Buttons und Vertragskennzeichnungen ergänzt,
80-Jahre-Regressionstest, 20×100-Jahre-Wirtschaftstest weiterhin stabil,
globaler ID-Abgleich ohne Duplikate.

**Nächster Punkt der Reihenfolge:** Belagerungen mit der Kampf-Engine
kombinieren (§36).

## 2026-08-12 – Schritt 29: Belagerungen mit der Kampf-Engine kombiniert (§36)

Dritter und letzter Punkt der Reihenfolge: die in Schritt 24 bewusst
zurückgebaute mehrjährige Belagerung ist jetzt wieder da — diesmal richtig
kombiniert statt als zwei getrennte Systeme.

- **Kriegserklärung gegen eine befestigte Region** (Stadtmauer) löst wieder
  eine mehrjährige Belagerung aus (Dauer abhängig von der Mauerstufe) statt
  sofort in die Schlacht zu gehen
- **Neues Belagerungs-Panel** im Militär-Reiter mit drei Aktionen:
  - **Sturmangriff** — eröffnet die volle interaktive Kampf-Engine-Schlacht
    (Formation/Taktik/Moral/Entscheidungspunkte), nicht mehr die alte reine
    Wahrscheinlichkeitsformel
  - **Aushungern** — ein Jahr warten, schwächt den Verteidiger spürbar
    (Soldatenzahl UND Moral sinken tatsächlich in der später generierten
    Kampf-Engine-Armee, nicht nur kosmetisch), kostet reduzierten Unterhalt
  - **Garnison bestechen** — Chance auf kampflosen Sieg gegen Gold
- **Echte Verzahnung statt Nebeneinander**: `buildAiBattleArmy()` akzeptiert
  jetzt einen Schwächungsfaktor, den `Aushungern` tatsächlich beeinflusst —
  eine ausgehungerte Garnison tritt beim Sturmangriff mit weniger Soldaten
  und niedrigerer Moral an. Solange eine Belagerung läuft, ist eine weitere
  Kriegserklärung gesperrt (ein Konflikt nach dem anderen)

**Getestet:** Komplette Kette isoliert durchgespielt (Belagerung starten →
Aushungern → geschwächte Armee verifiziert → Bestechungsversuch), Syntax
aller geänderten Dateien, globaler ID-Abgleich, 80-Jahre-Regressionstest,
20×100-Jahre-Wirtschaftstest und 100×100-Jahre-KI-Testsuite — alle weiterhin
stabil ohne kritische Befunde.

**Damit ist die selbst vorgeschlagene Dreier-Reihenfolge
(Content-Lücken → Diplomatie-Aktionen → Belagerungen) vollständig
abgearbeitet.**

## 2026-08-14 – Schritt 30: Content-Tiefe (Runde 3) + erster Aufschlag Intro/Easter Eggs

Nach der Übernahme des Projekts in ein eigenständiges Git-Repository (siehe
vorherige Session: `data/`, `js/`, `battle-engine/`, `tests/`-Struktur
rekonstruiert, `index.html` als Build aus den Modulen verifiziert) wurde
Punkt 7 der zuletzt offenen Prioritätenliste aus STATUS_ANALYSE.md
vollständig abgearbeitet, dazu ein erster echter Aufschlag bei Punkt 3
(Intro-Sequenz & Easter Eggs, zuvor komplett ❌):

**Zwei neue Truppentypen — Pikeniere & Schwere Kavallerie (§33):**
- Hauptspiel (`TROOP_TYPES`): Pikeniere (110 Taler, aus der Bauernschaft
  wie Miliz/Bogenschützen) und Schwere Kavallerie (650 Taler, erfordert wie
  Ritter Lehenstreue des Adels, aber mit höherer Schwelle ≥55 statt ≥45 —
  eine noch elitärere Rittertruppe)
- Kampf-Engine (`UNIT_TYPES`/`UNIT_COUNTERS`): Pikeniere sind der
  historische Hartkonter gegen (schwere) Kavallerie (+50 %/+35 % Bonus je
  nach Kavallerietyp), umgekehrt erleiden beide Kavallerietypen einen
  spürbaren Malus gegen Pikeniere — schwere Kavallerie dank dickerer Rüstung
  etwas weniger stark als leichte. Schwere Kavallerie selbst ist der stärkste
  Nahkämpfer im Spiel (Angriff 11, Rüstung 8), dafür langsamer als leichte
  Kavallerie und in Wald/Stadt noch stärker behindert
- Neue Hauptspiel-Formation `pikenwall` (Bonus nur mit ausgehobenen
  Pikenieren), analog zu den bestehenden formationsabhängigen Boni
- `js/battle-bridge.js`: beide Typen fließen in `buildPlayerBattleArmy()`
  ein; KI-Regionen erhalten ab einer gewissen Kasernen-Ausbaustufe ebenfalls
  einen Pikeniere-Anteil in `buildAiBattleArmy()`, statt nur die
  ursprünglichen drei Grundtypen zu würfeln

**Zweite echte zweistufige Produktionskette — Getreide → Mehl → Brot (§17):**
- Bewusst über zwei **neue** Gebäude (Kornmühle, Bäckerei) statt der
  bestehenden Mühle umgesetzt, die weiterhin ausschließlich ein reiner
  Getreide-Ertragsbooster bleibt — dadurch bleiben alle bestehenden
  Spielstände und der automatisierte Wirtschaftstest unberührt, die neue
  Kette wirkt sich nur aus, wenn die neuen Gebäude aktiv gebaut werden
  (gleiches Muster wie bereits bei Holz→Papier→Bücher in Schritt 27)
- Brot als neuer, bewusst kleiner Nebenbedarf bei Handwerkern/Bürgern/
  Händlern/Adel/Geistlichen/Soldaten (0,1–0,15, analog zu den bestehenden
  Luxus-Nebenbedarfen) — **nicht** als Ersatz für den bestehenden
  Getreide-Grundbedarf, um den in Schritt 13 behobenen
  Bevölkerungskollaps-Bug nicht erneut zu riskieren
- Verifiziert: 20×100-Jahre-Wirtschaftstest weiterhin stabil (17/20 bzw.
  16-19/20 je nach Seed-Lauf vollständig ohne Abbruch, im bisherigen Rahmen),
  Vergleichslauf mit/ohne die neuen Gebäude zeigt nur Rauschen-Niveau-
  Unterschied bei Zufriedenheit/Getreidebestand — keine Regression

**Individuelle KI-Kommandanten mit Namen/Persönlichkeit (§31, Vertiefung):**
- Jede KI-Region erhält bei Erzeugung (`makeRegion()` in `core.js`) einen
  persistenten, benannten Hauptmann (`region.commander`: Name, Führung,
  Mut, Taktik, Erfahrung, Schlachten/Siege-Zähler) statt bislang bei jeder
  Kriegserklärung einen komplett neu ausgewürfelten
- `buildAiBattleArmy()` nutzt jetzt diesen persistenten Kommandanten für die
  Schlacht (mit defensivem Fallback für ältere Spielstände ohne das Feld);
  `updateAiCommanderAfterBattle()` lässt Erfahrung/Führung nach jeder
  Schlacht leicht wachsen (Veteranenstatus) und ersetzt einen in der
  Schlacht gefallenen Kommandanten durch einen neu benannten Nachfolger samt
  Chronik-Eintrag — der Diplomatie/Militär-Reiter zeigt Name und
  Schlachtbilanz jeder KI-Region an
- Verifiziert: End-to-End-Testschlacht zeigt Erfahrungszuwachs (33→36) und
  Führungszuwachs (79→80) beim überlebenden Kommandanten nach einem Gefecht,
  Name und Zähler bleiben zwischen Schlachten konsistent

**Intro-Sequenz & Easter Eggs (§88/§90, erster Aufschlag):**
- Kurzer, überspringbarer Text-Vorspann vor dem Titelbildschirm (vier
  einblendende Zeilen, endet automatisch nach ~6 Sekunden oder per Klick) —
  kein animiertes Sprite-Intro, aber eine echte, funktionierende Sequenz statt
  der bisherigen kompletten Leerstelle
- Easter Egg 1: eine augenzwinkernde, einmalige Chronik-Anekdote im Jahr 1986
  ("Ein seltsames Kribbeln in der Luft") als Anspielung auf die
  Design-Philosophie "1986 außen – 2026 innen" aus GAME_DESIGN.md
- Easter Egg 2: die Krone auf dem Titelbildschirm 7× anklicken enthüllt eine
  versteckte Nachricht und gewährt einen bescheidenen Startbonus (+500 Taler)
  für die nächste Partie

**Technische Umsetzung/Konsistenz:** Alle Änderungen wurden zuerst in den
Modul-Quelldateien (`data/gamedata.js`, `js/*.js`, `battle-engine/*.js`)
vorgenommen und automatisiert gegen alle drei Testsuiten geprüft, danach wurde
der erste `<script>`-Block von `index.html` (der spielbare Build) durch
erneutes Zusammenfügen exakt derselben 13 Dateien neu erzeugt — dadurch bleibt
die Übereinstimmung zwischen Modulen und Build byteweise nachweisbar statt
manuell dupliziert. UI-Änderungen (neue Truppen-Icons/Kürzel, Gebäude-/
Waren-Icons für Kornmühle/Bäckerei/Mehl/Brot, Intro/Easter-Egg-Markup) wurden
direkt im UI-Teil von `index.html` ergänzt, da dieser (bewusst, siehe
GAME_DESIGN.md) nicht modularisiert ist. `battle.html` (eigenständige
Kampf-Engine-Demo) wurde um dieselben zwei Einheitentypen in Kürzel und
Beispielarmeen ergänzt; `battle_standalone.html` (die zweite, komplett
inline gebündelte Demo-Variante) wurde bewusst **nicht** synchronisiert, um
den Umfang zu begrenzen — sie bleibt für die beiden neuen Einheitentypen ein
funktionierender, aber nicht nachgeführter Snapshot.

**Getestet:** `node tests/battle_test.js`, `node tests/economy_test.js` und
`node tests/ai_vs_ai_test.js` laufen weiterhin ohne kritische Befunde;
zusätzlich ein Browser-Smoke-Test (Playwright, Chromium headless) gegen das
tatsächliche `index.html`: Intro-Sequenz erscheint und lässt sich
überspringen, Kronen-Easter-Egg löst nach 7 Klicks aus und der Bonus
erscheint korrekt in der Startkasse, der Militär-Reiter zeigt die neuen
Rekrutierungs-Buttons, Rekrutierung beider neuer Truppentypen funktioniert,
mehrere Jahreswechsel laufen ohne Fehler, eine vollständige Kriegserklärung
inklusive Kampf-Engine-Schlacht und Rückübertragung der Verluste läuft
fehlerfrei durch, keine JavaScript-Fehler in der Konsole. Ebenso
`battle.html` im Browser verifiziert (neue Einheitenkürzel PIK/SKV korrekt
im Schlachtfeld sichtbar).

**Nächste Punkte** (siehe STATUS_ANALYSE.md für die vollständige,
priorisierte Liste): der verbleibende Rest ist bewusst niedrigste Priorität
laut Spec selbst (§101) — echtes Sprite-/Canvas-Rendering, Chiptune-Musik,
vollständige Sprachumschaltung, externe JSON-Datendateien,
Multiplayer/Steam/Szenarioeditor (Post-Launch).

## 2026-08-19 – Schritt 31: Die KI erklärt jetzt selbst Krieg (§31) + zwei weitere Intrigen-Arten (§32)

Nächster Punkt aus der Runde-3-Restliste: §31 war der am häufigsten
wiederkehrende echte Gameplay-Blindfleck in STATUS_ANALYSE.md — die KI wägte
über `evaluateAiWarDecision()` (debug.js) zwar Faktoren ab, "erklärte" aber
nie wirklich Krieg. Diese Analysefunktion bekommt jetzt eine echte Wirkung.

**KI-Kriegsinitiative (§31):**
- `evaluateAiAggressionFactors()` (neu, `js/military.js`) berechnet dieselben
  vier Faktoren wie zuvor (militärische Überlegenheit, Beziehung,
  wahrgenommene Schwäche über Legitimität, bestehender Pakt) — die alte
  Debug-Funktion `evaluateAiWarDecision()` ruft sie jetzt auf, statt die
  Berechnung zu duplizieren
- `checkAiWarInitiative()` prüft jährlich für alle 3 direkten Nachbarn: Ist
  die Gesamtsumme über der Schwelle, würfelt Schwierigkeitsgrad
  (`aiMistakeChance`, §48) und eine zusätzliche Zufallschance mit, ob die
  Gelegenheit tatsächlich genutzt wird; ein Cooldown (6 Jahre) verhindert
  Kriegserklärungs-Spam nach jedem Ausgang
- **Wichtiger Kalibrierungsfund beim eigenen Testen:** Die erste Fassung
  ließ in 50 von 50 automatisierten Testpartien schon innerhalb der ersten
  15 Jahre einen KI-Krieg ausbrechen — weil ein Spieler ganz ohne Heer
  (in den ersten Jahrzehnten einer wirtschaftsorientierten Partie völlig
  normal) den militärischen Faktor rechnerisch explodieren ließ und dabei
  sogar ein aktives Bündnis (Faktor -100) überstimmen konnte. Behoben durch:
  einen Mindestnenner bei der Stärkevergleichsformel
  (`aiWarStrengthFloor`, verhindert die Explosion nahe Null), eine
  Ober-/Untergrenze für den militärischen Faktor selbst, und vor allem eine
  neue harte Vorbedingung — militärische Schwäche allein reicht nicht mehr,
  es braucht zusätzlich eine wirklich schlechte Beziehung
  (`aiWarMaxRelationForAggression`, unter dem Schwellenwert für einen
  Nichtangriffspakt). Nach der Korrektur: 0/50 Testpartien mit KI-Krieg
  innerhalb von 15 Jahren bei normalem Spielverlauf, aber 28/30 bei gezielt
  herbeigeführter militärischer Schwäche **und** schlechter Beziehung (-80) —
  und 40/40 sichere Partien über 20 Jahre trotz militärischer Schwäche, wenn
  die Beziehung gepflegt wird (60). Diplomatie wird dadurch spürbar zu einem
  echten Schutzmechanismus statt nur kosmetisch zu sein.
- **UI-Integration:** Löst die Schlacht selbst nicht auf, sondern setzt nur
  `state.incomingAiWar` — die bestehende, bereits ausgereifte interaktive
  Kampf-Engine übernimmt den Rest. Nach `advanceYear()` prüft der
  "Jahr vergehen lassen"-Handler das Flag, zeigt eine Warnung und öffnet den
  Kampfbildschirm direkt als Verteidigung. `buildPlayerBattleArmy()` und
  `buildAiBattleArmy()` bekamen dafür einen neuen `opts`-Parameter
  (`defending`/`attacking`), der `isAttacker`/`isHomeTerritory` korrekt
  umdreht — der Spieler bekommt beim Verteidigen jetzt tatsächlich den
  Miliz-Heimvorteil, den er beim Angreifen nicht hätte, und das Gelände
  richtet sich nach der Befestigung der eigenen statt der gegnerischen
  Region. Diplomatische Konsequenzen (Vertragsbruch, Beziehungscrash) laufen
  weiterhin ausschließlich über `applyBattleResultToGame()` — unabhängig
  davon, wer erklärt hat, damit es keine doppelte Bestrafung gibt.

**Zwei weitere Intrigen-Arten (§32):** Gerüchte streuen (billig, schädigt
gezielt die Zufriedenheit von Adel/Bürgertum der Zielregion statt Warenlager,
geringeres Entdeckungsrisiko als Sabotage) und Erpressung (teurer und
riskanter, nutzt die eigene Spionage-Genauigkeit als Druckmittel für höhere
Erfolgschancen, schadet der Beziehung aber so oder so — anders als das
bestehende `demandTribute`, das nur bei bereits akzeptabler Beziehung
funktioniert).

**Getestet:** `node tests/battle_test.js`, `node tests/economy_test.js`
(19/20 vollständig ohne Abbruch, 0 Bevölkerungskollaps) und
`node tests/ai_vs_ai_test.js` weiterhin ohne kritische Befunde. Gezielte
Kalibrierungstests wie oben beschrieben. Browser-Smoke-Test (Playwright):
ein erzwungenes feindseliges Schwäche-Szenario löst zuverlässig eine
KI-Kriegserklärung mit korrektem "VERTEIDIGUNG GEGEN..."-Titel und
korrekt geflippten Angreifer-/Verteidiger-Rollen aus, die Schlacht lässt
sich automatisch auflösen und der Bildschirm schließt sich danach korrekt;
beide neuen Intrigen-Buttons erscheinen im Militär-Reiter und funktionieren.
Wie zuvor wurde zuerst in den Modul-Quelldateien entwickelt und getestet,
danach `index.html`s Build-Skriptblock erneut byteweise aus denselben
Dateien zusammengesetzt.

**Nächste Punkte** (siehe STATUS_ANALYSE.md): Migration zwischen den eigenen
8 Regionen (§14), verbleibende Intrigen-Arten, danach wieder die bewusst
niedrigste Priorität laut Spec selbst (Grafik/Sound/Sprache/Post-Launch).

## 2026-08-19 – Schritt 32: Migration zwischen Regionen (§14) + restliche Intrigen-Arten (§32)

Auf Wunsch ("mach alles selbstständig fertig") die verbleibenden Punkte der
letzten Restliste komplett abgearbeitet.

**Migration zwischen den 8 Regionen (§14):** Die bisherige `applyMigration()`
lief pro Region unabhängig und ließ Bevölkerung einfach zur/von einer
abstrakten "Außenwelt" verschwinden/erscheinen — nie tatsächlich zwischen den
8 simulierten Regionen. Neu: `applyInterRegionalMigration()` (nach demselben
Muster wie das bestehende `runInterregionalTrade()` einmal pro Jahr über alle
Regionen hinweg statt pro Region einzeln) sammelt die Auswanderer aus
unzufriedenen Regionen in einem gemeinsamen Pool und verteilt einen Anteil
davon (`interRegionalShare`, 60 %) proportional zur Attraktivität auf die
zufriedeneren Regionen — der Rest bleibt bewusst weiterhin Wanderung zur/von
der Außenwelt, damit das System nicht künstlich perfekt geschlossen wirkt.
Verifiziert: eine erzwungen unzufriedene Spielerregion neben einer
erzwungen hochzufriedenen Nachbarregion zeigt spürbaren Bevölkerungsfluss
in die richtige Richtung; 20×100-Jahre-Wirtschaftstest und
100×100-Jahre-KI-Testsuite weiterhin stabil ohne kritische Befunde.

**Restliche vier Intrigen-Arten (§32):**
- **Verschwörung** — teuer, seltener Erfolg, aber bei Erfolg wird ein
  zufälliges Gebäude der Zielregion beschädigt (Ausbaustufe -1) oder bei
  Stufe 1 komplett niedergebrannt; bei Aufdeckung ein handfester Skandal
  (harter Beziehungs- UND Prestigeverlust für den Spieler selbst)
- **Dokumentenfälschung** — einzige nicht gegen eine Region gerichtete
  Intrige: stärkt bei Erfolg die eigene Legitimität, schadet ihr bei
  Auffliegen der Fälschung stärker, als der Erfolg gebracht hätte (echtes
  Risiko/Chance-Verhältnis)
- **Rebellenunterstützung** — der härteste gezielte Eingriff neben Sabotage:
  finanziert Unruhestifter, trifft Arme/Tagelöhner der Zielregion hart
  (Zufriedenheit UND ein kleiner dauerhafter Bevölkerungsverlust durch
  Unruhen), bei Aufdeckung ein Beziehungscrash fast auf Kriegsniveau
- **Politische Manipulation** — schwächer als die anderen drei, dafür mit
  mehrjähriger Wirkung statt eines einmaligen Schlags: leichte
  Zufriedenheitsdämpfung über die gesamte Bevölkerung plus mehrere Jahre
  gelähmte Verwaltung (`aiRegionDevelops()` baut währenddessen deutlich
  seltener) — die einzige der sechs Intrigen mit einem echten Nachwirkungs-
  Timer statt sofortiger Einmalwirkung

**Getestet:** alle vier Funktionen einzeln verifiziert (inkl. Erfolgs- und
Fehlschlagfällen, Gebäudezerstörung, Bautätigkeits-Unterdrückung über
mehrere simulierte Jahre), `node tests/battle_test.js`,
`node tests/economy_test.js` und `node tests/ai_vs_ai_test.js` weiterhin
ohne kritische Befunde, Browser-Smoke-Test (Playwright) bestätigt alle
sechs Intrigen-Buttons im Militär-Reiter und ihre Funktionsfähigkeit ohne
JavaScript-Fehler. Wie immer zuerst in den Modul-Quelldateien entwickelt,
danach `index.html`s Build-Skriptblock erneut byteweise zusammengesetzt.

**Damit sind alle in der letzten Restliste genannten Content-/Gameplay-Punkte
abgearbeitet.** Verbleibend, wie in STATUS_ANALYSE.md dokumentiert, nur noch
die laut Spec selbst niedrigste Priorität (§101): echtes Sprite-/Canvas-
Rendering, Chiptune-Musik, vollständige Sprachumschaltung, externe
JSON-Datendateien, Multiplayer/Steam/Szenarioeditor (Post-Launch).

## 2026-08-19 – Schritt 33: Chiptune-Musik, externe JSON-Daten, Sprachumschaltung, Szenario-Anpassung

Auf ausdrücklichen Wunsch ("mach alles selbstständig fertig") die letzte
verbliebene Prioritätenliste komplett durchgearbeitet, so weit dies ohne
unverhältnismäßiges Risiko oder externe Werkzeuge sauber möglich ist.

**Chiptune-Musik (§58):** Ein selbst komponierter, zweistimmiger 8-Bit-Loop
(Melodie: Rechteckwelle, Bass: Dreieckwelle, ca. 8 Sekunden, endet auf der
Tonika) wird rein aus Web-Audio-Oszillatoren synthetisiert — exakt derselbe
technische Ansatz wie die bereits bestehenden `playBeep()`-Soundeffekte,
also kein externes Audio-Asset nötig. Ein präzises Scheduling
(`AudioContext.currentTime`-basierte Notenzeiten statt `setInterval`-Drift)
sorgt für lückenloses Loopen. Standardmäßig aus (Browser-Autoplay-Regeln
verlangen ohnehin eine Nutzerinteraktion), über einen neuen Musik-Schalter
aktivierbar. Ein Tippfehler beim ersten Testen (fehlender `A5`-Eintrag in
der Frequenztabelle → "non-finite AudioParam"-Fehler) wurde durch den
Playwright-Browsertest sofort aufgedeckt und behoben.

**Externe JSON-Datendateien (§65/§79):** Die neun reinen Datentabellen
(Waren, Produktionsketten, Gebäude, Bevölkerungsgruppen, Truppentypen,
Formationen, Berater, Zusatzregionen, Titel) liegen jetzt als echte externe
JSON-Dateien in `data/json/` vor — die eigentliche Bearbeitungsquelle für
Mods. Ein neues Skript `tools/data-sync.js` hält sie mit `data/gamedata.js`
synchron: `node tools/data-sync.js extract` zieht die Tabellen einmalig aus
`gamedata.js` (per Node-`vm`-Sandbox ausgewertet, keine Handabschrift nötig,
also kein Transkriptionsrisiko), `node tools/data-sync.js build` setzt sie
umgekehrt wieder ein (Klammerntiefen-basiertes Parsen der `const NAME = ...`-
Deklaration, kein fragiles Regex). Bewusste Einschränkung: `index.html` lädt
die JSON-Dateien nicht per `fetch()` zur Laufzeit — das würde beim direkten
Öffnen als lokale Datei an CORS scheitern und den Kernanspruch "einzelne
Datei, sofort spielbar" brechen. Die Trennung wirkt daher zur Build-Zeit
(Mod bearbeitet JSON → Skript ausführen → `gamedata.js` neu → `index.html`
neu bündeln), nicht zur Laufzeit. Kleiner, aber realer Verlust beim
Umbau: vier Inline-Kommentare zu einzelnen Waren gingen unter (JSON kennt
keine Kommentare) — durch einen neuen Kopfkommentar direkt über der
`GOODS`-Deklaration in `gamedata.js` ersetzt, der dieselbe Information
festhält, statt sie stillschweigend zu verlieren.

**Sprachumschaltung deutlich ausgebaut (§80):** Die bisherige `STRINGS`/`t()`-
Struktur wurde tatsächlich nirgends in der UI verwendet (reine
Grundstruktur ohne Wirkung). Jetzt läuft die komplette statische UI-Hülle
darüber: Titelbildschirm, Charaktererstellung (inkl. aller Auswahloptionen),
alle 6 Spielreiter, die drei Hauptaktions-Buttons, die Kopfzeile
(Jahr/Schatz/Prestige-Beschriftungen) und die Einstellungen — mit
vollständiger deutscher UND englischer Übersetzung. Technisch über ein
`data-i18n`-Attribut-Konzept gelöst (`applyI18n()` durchsucht
`[data-i18n]`/`[data-i18n-title]`/`[data-i18n-placeholder]` und setzt Text/
Titel/Platzhalter aus `t()`), dazu zwei synchron gehaltene Sprachwähler
(Titelbildschirm und laufendes Spiel — wichtig, weil der Titelbildschirm
sonst nur nach Spielstart umschaltbar gewesen wäre). Bewusste Einschränkung,
klar dokumentiert: dynamisch generierte Spielinhalte (Chronik, Ereignistexte,
Tabellen, Tooltip-Aufschlüsselungen) bleiben Deutsch — eine vollständige
Zweitübersetzung wäre eine sehr umfangreiche Fleißarbeit über hunderte
Text-Templates, die die Spec selbst hinter Spielspaß/Simulation/KI/
Wirtschaft einordnet (§101).

**Leichte Szenario-Anpassung (§103-Ansatz):** Bei der Charaktererstellung
jetzt zusätzlich wählbar: Startkapital (Arm/Normal/Reich, ×0,4/×1,0/×2,2 auf
die Staatskasse, wirkt zusätzlich zum Schwierigkeitsgrad) und diplomatische
Ausgangslage (Freundlich/Neutral/Angespannt, ±30/0/−35 auf die
Start-Beziehung zu allen 3 Nachbarn). Kein vollständiger Szenarioeditor mit
eigenem Kartenlayout, aber ein echter, spürbarer erster Baustein statt eines
fest verdrahteten Standardstarts.

**Bewusst nicht umgesetzt** (Begründung siehe STATUS_ANALYSE.md): echtes
Sprite-/Canvas-Rendering (würde eine vollständige Neuentwicklung der
mehrere Tausend Zeilen umfassenden Präsentationsschicht bedeuten, für das
laut Spec selbst am niedrigsten priorisierte Feature) sowie echtes
Mehrspieler/Steam/Achievements (erfordert Server- bzw.
Steamworks-Plattform-Infrastruktur, die für ein lokales Browser-Spiel ohne
Backend nicht seriös nachbildbar ist).

**Getestet:** wie immer zuerst in den Modul-Quelldateien entwickelt (Musik
ist reiner UI-Code, direkt in `index.html`), `node tests/battle_test.js`,
`node tests/economy_test.js` und `node tests/ai_vs_ai_test.js` weiterhin
ohne kritische Befunde nach jedem Teilschritt. Umfangreicher
Browser-Smoke-Test (Playwright): Musik startet/stoppt fehlerfrei und loopt
lückenlos über mehrere Zyklen; `data/json/*.json` → `gamedata.js`-Rebuild
liefert ein funktional identisches Spiel (gleiche Testergebnisse vorher/
nachher); Sprachumschaltung live vor UND nach Spielstart getestet,
inklusive Synchronität beider Sprachwähler und Weiterspielen nach dem
Umschalten; Szenario-Auswahl (Startkapital/Ausgangslage) wirkt sich korrekt
auf Staatskasse und Beziehungswerte aus. Wie immer wurde `index.html`s
Build-Skriptblock nach jeder Modul-Änderung erneut byteweise aus den
Quelldateien zusammengesetzt.

**Damit sind alle Punkte der Prioritätenliste bearbeitet, bei denen der
Aufwand in einem vernünftigen Verhältnis zur von der Spec selbst
zugewiesenen niedrigsten Priorität steht.** Die drei verbleibenden, bewusst
nicht angegangenen Punkte (echtes Sprite-Rendering, echtes Mehrspieler/
Steam, vollständige 100%ige Zweitübersetzung) sind in STATUS_ANALYSE.md
mit Begründung dokumentiert.

## 2026-08-19 – Schritt 34: Bugfix Dynastie-Alterung, Titel-Aufstiegsfeier, ausgebaute Kornverteilung

Auf Nutzer-Feedback beim ersten echten Antesten der Datei.

**Bugfix: Ehepartner und Kinder wurden nie älter.** `updateDynasty()`
(population-dynasty.js) erhöhte bisher nur `ruler.age`, nicht das Alter der
übrigen `state.characters`-Einträge. Solange jemand Kind oder Gemahl/Gemahlin
war, blieb er für immer im Geburts-/Erstellungsalter eingefroren — erst beim
Antritt der Nachfolge begann die Alterung (da ab dann `state.rulerId` auf sie
zeigte). Nebenwirkung: die Erbfolgestreit-Prüfung (`disputeAgeClosenessYears`)
verglich damit meist nahezu gleich alte (nämlich alle nahe 0) Geschwister,
was die Streitwahrscheinlichkeit künstlich verzerrte. Fix: Alle lebenden
Mitglieder der Dynastie altern jetzt gemeinsam pro Jahr (inkl. der bereits
bestehenden Gesundheits-Abnahme-Formel). Verifiziert mit gleichen
Zufallssaaten vorher/nachher: moderater, plausibler Effekt auf die
"Dynastie stirbt aus"-Rate (ca. 6→8 von 20 Testpartien) — späte Erben sind
jetzt realistisch älter/gebrechlicher statt ewig jung, keine Regression bei
den harten Testinvarianten (0 unkontrollierte Bevölkerungskollapse ohne
Game-Over-Flag, weiterhin).

**Titel-Aufstieg wird jetzt gefeiert.** `checkTitleProgress()` (politics.js)
schrieb bislang nur eine Chronik-Zeile — im laufenden Spiel fiel ein Aufstieg
zu Baron, Graf usw. dadurch kaum auf. Neu: eine kurze, nicht-blockierende
Einblendung (`#titleUpBanner`, 4 Sekunden, goldener Rahmen) mit einer
kleinen aufsteigenden Fanfare (3 Töne via Web Audio, derselbe Ansatz wie
die bestehenden Soundeffekte). Rein UI-seitig gelöst (Vergleich von
`state.titleIndex` vor/nach `advanceYear()` im Klick-Handler) — keine
Änderung an der Simulationslogik nötig.

**Kornverteilung ausgebaut (§Original-Vertiefung).** Auf Wunsch: eine neue
Kornbilanz macht sichtbar, wie viel Getreide pro Jahr vor der Verteilung zur
Verfügung steht, wie hoch der reine Grundbedarf ist, und wie viel tatsächlich
ans Volk abgegeben wird (Grundbedarf + freiwillige Kornausgabe) — als eigenes
Panel direkt unter dem Kornausgabe-Regler, mit Tooltip zur Erklärung.
Wichtiger: das Verhältnis (`grainRatio` = verfügbar/Grundbedarf) wirkt jetzt
auch direkt auf Geburten- und Sterberate, zusätzlich zum bereits bestehenden,
über die Zufriedenheit vermittelten Effekt:
- Überschuss (Verhältnis > 100 %) hebt die Geburtenrate leicht an
  (`grainBirthBonusMax`, linear bis Verhältnis 200 %).
- Erst eine echte Hungersnot (Verhältnis unter `grainFamineThreshold`,
  15 %) hebt die Sterberate spürbar (`grainDeathBonusMax`) — bewusst nicht
  schon bei jedem milden Mangel, siehe Kalibrierungsfund unten.

**Kalibrierungsfund (wichtig, gleiche Lehre wie Schritt 13):** Eine erste,
lineare Fassung (jeder Mangel unterhalb 100 % erhöht sofort anteilig die
Sterberate) trieb im 20×100-Jahre-Wirtschaftstest mehrere zuvor stabile
Partien in einen echten Bevölkerungskollaps — weil das Grundspiel ganz ohne
aktives Kornmanagement bereits jahrzehntelang chronisch mit 20–50 % Kornmangel
läuft (siehe frühere DEVELOPMENT.md-Einträge: das ist beabsichtigt, keine
Regression). Ein kleiner, aber über Jahrzehnte *durchgehend* wirkender
Sterbe-Bonus kumuliert sich exponentiell und kippt bereits knapp stabile
Partien. Nach Analyse der tatsächlichen Testkriterien stellte sich heraus:
der automatisierte Wirtschaftstest bewertet ein korrekt geflaggtes
"Niederlage"-Ende (Bevölkerung < 200, `state.gameOver = "defeat"`) gar nicht
als Fehler — nur einen *unkontrollierten* Kollaps *ohne* gesetztes
Game-Over-Flag. Die eigentliche Lehre war also nicht "keine Partie darf
kollabieren", sondern "ein Kornmangel-Effekt darf nicht als **durchgehender
Dauerdruck** über Jahrzehnte wirken". Lösung: Schwellenbasiert statt linear
— nur eine wirkliche Hungersnot (< 15 % Grundbedarf gedeckt) löst den
Effekt überhaupt aus, chronischer milder Mangel (40–90 %, der Normalfall bei
passivem Spiel) bleibt wirkungslos für diesen speziellen Mechanismus.
Verifiziert: 0/60 unkontrollierte Kollapse über eine breitere Seed-Stichprobe;
gezielter Vergleichstest (künstlicher Vollüberschuss vs. künstliche
Nulllagerbestand-Hungersnot) zeigt den Effekt klar und in beide Richtungen
(960→972 Bauern bei Überschuss, 960→938 bei Hungersnot, gleicher Seed).

**Getestet:** wie immer zuerst in den Modul-Quelldateien, `node
tests/battle_test.js`/`economy_test.js`/`ai_vs_ai_test.js` nach jeder
Kalibrierungsrunde erneut geprüft, danach `index.html`s Build-Skriptblock neu
zusammengesetzt. Browser-Smoke-Test (Playwright): Kinder altern sichtbar
(z. B. 13/10/9/5/2/0 Jahre nach 15 Spieljahren statt dauerhaft 0), die
Kornbilanz-Anzeige ist von Jahr 0 an gefüllt (nicht erst nach dem ersten
Jahreswechsel), eine erzwungene Baron-Beförderung löst die neue
Feier-Einblendung korrekt aus, keine JavaScript-Fehler.


## 2026-08-20 – Schritt 35: Monatstakt mit Kassenbuch, Nachwuchs-Namensvergabe, Landeroberung im Krieg

Wieder auf Nutzer-Feedback nach weiterem Antesten — vier Wünsche in einer Runde.

**1 Runde = 1 Monat statt 1 Jahr.** Größte Architektur-Änderung dieser Runde.
Ziel: mehr spielbare Züge pro Herrscherleben, ohne die sorgfältig kalibrierte
*jährliche* Wirtschafts-/Bevölkerungssimulation anzufassen (gleiche Vorsicht
wie bei den Lehren aus Schritt 13 und Schritt 34). Lösung: `advanceYear()`
bleibt als reine Jahres-Makrosimulation vollständig unverändert (Wetter/Ernte,
Bevölkerungswachstum, Migration, Diplomatie-Drift, Wahlen, Alterung,
Forschung, KI-Kriegsinitiative, Events, Ausbaustufe usw.) — nur die fünf
bisherigen Schatzkammer-Zahlungsaufrufe (`collectTaxes`, `payArmyUpkeep`,
`payAdvisorSalaries`, `payDebtInterest`, `collectVassalTribute`) wurden aus
ihr entfernt. Neu: `applyMonthlyFinances(state)` (advance-year.js) berechnet
Steuereinnahmen/Heeresunterhalt/Berater-Gehälter/Schuldzinsen/Vasallentribut
mit denselben Formeln ÷12, jeden Monat. `advanceMonth(state)` ruft das auf,
zählt `state.month` (1–12) hoch und stößt auf Monat 12 automatisch das
unveränderte `advanceYear()` an. Die Söldner-Desertionsprüfung
(`checkSoeldnerDesertion`, vorher in `payArmyUpkeep` verschachtelt) wird
bewusst weiterhin nur einmal pro Jahr aufgerufen (jetzt direkt aus
`advanceYear`) — sonst würde ein monatlicher Aufruf die jährlich kalibrierte
Desertionswahrscheinlichkeit verzwölffachen. `economy_test.js`/
`ai_vs_ai_test.js` wurden auf `12× advanceMonth()` pro simuliertem Jahr
umgestellt, damit sie weiterhin "N Jahre Spielzeit" korrekt simulieren, jetzt
aber auch den echten monatlichen Finanzpfad mitprüfen.

**Kassenbuch-Fenster nach jedem Monat.** Neues `#ledgerModal`: zeigt nach
jedem Klick auf "▶ MONAT VERGEHEN LASSEN" Steuereinnahmen, Heeresunterhalt,
Berater-Gehälter, Schuldzinsen, Vasallentribut, die monatliche
Nettoveränderung und den neuen Kassenstand — Werte aus dem von
`applyMonthlyFinances` zurückgegebenen Report. Titel-Aufstiegsfeier,
KI-Kriegserklärung, Event- und Geburts-Fenster reihen sich danach wie bisher
in eine Prioritätskette ein (`closeLedger()`).

**Nachwuchs: Namensvergabe durch den Spieler + Ankündigungsfenster.** Bei
einer Geburt setzt `updateDynasty()` (population-dynasty.js) jetzt zusätzlich
`state.pendingBirth` auf die neue Charakter-ID (der zufällig vorbelegte Name
bleibt als Fallback für die Node-Tests ohne UI). Neues `#birthModal` zeigt
"Dir wurde ein Sohn/eine Tochter geboren!", ein Textfeld vorbelegt mit dem
Zufallsnamen, und ein Bestätigen-Button (`confirmBirthName()`), der den Namen
im `state.characters`-Eintrag überschreibt.

**Landeroberung als Kriegsbeute.** Bisher gab ein gewonnener Kampf nur Beute
(Taler) und Ansehen — Landbesitz änderte sich nur über den bereits
bestehenden Landkauf (`buyLand`) oder die rein diplomatische Gebietsforderung
(`demandTerritory`, §29). Neu: `applyBattleResultToGame()` (battle-bridge.js)
überträgt bei einem Sieg zusätzlich `CONFIG.military.warConquestHectares`
(300) Hektar von der besiegten Region auf den Spieler — genau wie bei
`demandTerritory` durch ein Minimum (`warConquestMinDefenderLand`, 1000
Hektar) gedeckelt, damit eine KI-Region nie land- bzw. baugrundlos wird. Die
bestehende `#landPanel`-Anzeige (Hektar, mögliche Baugrundstücke, Landpreis)
zeigt den Zuwachs automatisch an, keine weitere UI-Änderung nötig.

**Getestet:** `node tests/battle_test.js`/`economy_test.js`/`ai_vs_ai_test.js`
nach dem Umbau erneut grün (0/20 unkontrollierte Bevölkerungskollapse,
Preis-/Dominanz-Werte im bekannten Rahmen). Playwright-Smoke-Test:
Button-Beschriftung korrekt, Kassenbuch erscheint bereits nach dem ersten
Klick mit plausiblen Werten, Jahr/Monat zählen korrekt hoch und Jahr 1500
wechselt nach 12 Klicks korrekt zu 1501/Monat 1, erzwungene Geburt zeigt das
Namensfenster mit dem Vorschlagsnamen und übernimmt den eingegebenen Namen
korrekt in `state.characters`. Landeroberung separat per Node-Skript
verifiziert: 300 Hektar wandern bei einem simulierten Sieg vom KI- zum
Spielerkonto, Chronik-Eintrag stimmt, und im Grenzfall (Verteidiger nahe am
Minimum) wird das 1000-Hektar-Minimum korrekt eingehalten statt unterschritten.

## 2026-08-20 – Schritt 36: Komplettes Comic-Redesign (Mittelalter-Look statt 80er-Retro)

Auf Nutzerwunsch: "das sieht alles so nach 1985 aus, es muss moderner werden."
Nach zwei präsentierten Zwischenschritten (erst eine reine Lesbarkeits-
Überarbeitung der Retro-Optik, dann drei Mockup-Vorschläge — komplett modern,
Neo-Retro, Comic) hat sich der Nutzer für den **Comic-Look** entschieden.

**Umsetzung:** Das komplette `<style>`-Element in `index.html` wurde
überarbeitet — alle CSS-Variablennamen (`--bg`, `--panel`, `--panel-dark`,
`--ink`, `--accent`, `--accent2`, `--gold`, `--blue`) blieben bewusst
unverändert, nur ihre Werte wurden auf eine warme Pergament-Palette mit
kräftigen Comicfarben (Rot, Grün, Gold, Himmelblau, neu: Lila) umgestellt —
dadurch übernehmen auch alle ~40 Stellen, an denen JS-generierte Inline-Styles
`var(--accent)` &co. referenzieren, automatisch die neue Palette, ohne dass
ein einziger Script-Block angefasst werden musste. Der Pixel-Font (Press
Start 2P) wurde ersetzt durch zwei neue Rollen: `--font-display` (Luckiest
Guy, für Titel/Buttons/Tabs/Panel-Köpfe) und `--font` (Baloo 2, für
Fließtext) — mit soliden System-Font-Fallbacks, falls Google Fonts beim
Spieler nicht lädt. Durchgehend wurden harte Pixel-Kanten durch abgerundete
Ecken ersetzt (neue Tokens `--r-sm/--r-md/--r-lg`), harte Schlagschatten
durch weichere Comic-Offset-Schatten, und der Seitenhintergrund bekam ein
dezentes Halbton-Punktraster (Comic-Druck-Optik). Neu: ein Herrscher-Avatar
(🤴/👸 je nach Geschlecht) im Hof-Panel als kleines illustratives Element.

**Nebenbefund behoben:** Das Namensfeld im Geburts-Fenster
(`#birthBox input[type=text]`) hatte einen alten Kontrast-Bug — dunkler Text
auf dunklem Hintergrund (`--panel-dark`/`--ink` fast identisch dunkel), der
das Feld de facto unlesbar machte. Beim Reskin auf helle Pergament-Farbe
korrigiert.

**Bewusst nicht angetastet:** Spielstruktur, Simulationslogik, alle 13
Modul-Quelldateien — reine CSS-/eine-Zeile-JS-Änderung (Avatar-Wrapper im
Hof-Panel-Rendering). Kein Rebuild des Skript-Bundles nötig, da die Module
selbst unverändert blieben.

**Getestet:** Playwright-Durchlauf durch alle Hauptbildschirme (Titel,
Charaktererstellung, alle 6 Tabs, Kassenbuch-Modal, Geburts-Modal,
Kriegserklärung → Formationswahl → volles Schlachtfeld mit Truppenblöcken)
— keine Layout-Überläufe, keine Konsolenfehler. Hinweis: In der
Test-Sandbox sind Google Fonts nicht erreichbar (Netzwerk-Policy), daher
zeigen die Screenshots System-Font-Fallbacks statt der eigentlich
vorgesehenen Comic-Schriften — im normalen Browser des Spielers lädt
Google Fonts regulär und die Schrift wird wie geplant angezeigt.

## 2026-08-20 – Schritt 37: Heiratsfenster, Kornbilanz-Fix, vollständiges Kassenbuch, Steuerreform, wählbare Startregionen

Wieder ein Bündel aus fünf Nutzerwünschen nach weiterem Antesten.

**1. Heirat öffnet jetzt ein Fenster.** Analog zur Geburtsankündigung: `updateDynasty()`
setzt bei einer Vermählung `state.pendingMarriage`, ein neues `#marriageModal`
(„💍 Vermählung am Hof! 💍“) zeigt Namen von Herrscher und Gemahl/Gemahlin mit
kurzer Fanfare. Reiht sich vor der Geburtsankündigung in die bestehende
Prioritätskette ein (beides kann im selben Jahr eintreten, da eine frische
Heirat noch im selben Durchlauf eine Geburt auslösen kann).

**2. Kornbilanz-Fehlkalibrierung behoben.** Ursachenanalyse: Verbrauch war
schon immer exakt auf den Grundbedarf gedeckelt (`consumeAndUpdateSatisfaction`),
aber es gab **keinerlei Obergrenze oder Schwund** für den Lagerbestand — jeder
Produktionsüberschuss sammelte sich über Jahrzehnte unbegrenzt an (Startwert
war zudem pauschal 300, unabhängig von der tatsächlichen Bevölkerungsgröße).
Ergebnis: ein von Jahr 1 an absurdes Verhältnis (1273 % im gemeldeten Fall),
das mit der Zeit nur weiter wuchs. Neu: `region.grainStorageCap` (≈4
Jahresbedarfe ohne Lagerhaus) plus `applyGrainSpoilage()` — Getreide über der
Kapazität verdirbt größtenteils, selbst darunter geht ein kleiner Teil durch
Schwund verloren. Der bislang komplett ungenutzte Gebäudetyp „Kornspeicher“
(`storage_boost`, existierte nur als totes Datenfeld) bekommt dadurch einen
echten Zweck: mehr/höhere Kornspeicher erhöhen die Kapazität. Kalibrierungsfund
(wieder die Schritt-13-Lehre): die KI-gegen-KI-Testsuite zeigte, dass eine
CONSTANT auch nur leicht unterschiedliche Fruchtbarkeit zwischen KI-Regionen
über 100 Jahre exponentiell zu Dominanz aufschaukelt, sobald Getreide
tatsächlich (statt wie zuvor praktisch immer gesättigt) variiert. Gegenmaßnahmen:
Geburts-/Sterbe-Bonus aus der Kornbilanz halbiert, der jährliche
Basis-Schwund selbst innerhalb der Kapazität stark reduziert (0,08→0,03), und
KI-Regionen starten bewusst mit einem festen Referenzwert statt einem zur
eigenen Bevölkerung proportionalen (das hätte fruchtbareren Regionen einen
unbeabsichtigten Frühstart verschafft) — der Spieler-Startwert bleibt
proportional zur eigenen Bevölkerung, damit die Anzeige von Jahr 1 an plausibel
aussieht. Ergebnis nach Kalibrierung: KI-Dominanz 46 % (Schwelle 50 %,
vorher kurzzeitig 54-57 % während der Fehlersuche), 0/20 unkontrollierte
Bevölkerungskollapse weiterhin.

**3. Vollständiges Kassenbuch.** Neue `logLedger(state, label, amount)`-Funktion
(core.js) protokolliert jede spielerausgelöste Transaktion einzeln:
Gebäudebau/-ausbau, Infrastrukturausbau, Land-/Marktkauf/-verkauf, Import/
Export zwischen Regionen, Kreditaufnahme/-tilgung. Das Kassenbuch-Fenster zeigt
diese Posten jetzt zusätzlich zu den fünf monatlichen Sammelposten unter
„Weitere Ein-/Ausgaben diesen Monat“, danach wird das Log geleert. Dazu ein
Tooltip auf „Steuereinnahmen“ mit der Aufschlüsselung nach Bevölkerungsgruppe
(siehe Punkt 4). Diplomatie-/Intrigen-Kosten (Geschenke, Bestechungen,
Spionage) sind bewusst noch nicht einzeln erfasst — auf Wunsch in einer
weiteren Runde ergänzbar.

**4. Steuerreform.** Zwei Befunde: Erstens behandelte die Steuerformel jede
Bevölkerungsgruppe identisch, obwohl `POP_GROUPS[pid].weight` (Adel=2,
Bürger=1,4, Arme=0,5 usw.) als Datenfeld längst existierte — nur ungenutzt.
Jetzt fließt dieses Gewicht direkt in die Steuerkraft jeder Gruppe ein (Adel/
Händler/Bürger tragen anteilig mehr bei als Bauern/Tagelöhner/Arme). Zweitens
war `treasuryTaxWealthFactor` mit 0,02 grob unterkalibriert — eine
Startregion kam damit auf ca. 1 Taler/Monat, kaum spürbar und unfähig, auch
nur eine kleine Garnison zu tragen. Neu kalibriert auf 3,0, damit eine
Startregion (~2.400 Einwohner, 15 % Steuersatz) auf ca. 90-100 Taler/Monat
kommt (verifiziert: 94 Taler im Test).

**5. Wählbare Startregionen für 1500.** Neue Datentabelle `START_REGIONS`
(gamedata.js) mit zehn real existierenden europäischen Herrschaftsgebieten um
1500 plus der bisherigen namenlosen Standardoption: Herzogtum Burgund,
Königreich England, Republik Venedig, Herzogtum Mailand, Krone Kastilien,
Königreich Portugal, Königreich Polen, Königreich Ungarn, Alte Eidgenossenschaft,
Herzogtum Bretagne — jede mit eigener Fruchtbarkeit, Startbevölkerung,
Startkapital-Multiplikator und kurzer historischer Beschreibung (z. B. Venedig:
hohe Handelseinnahmen, aber wenig Ackerland). Die „Startregion“-Auswahl in der
Charaktererstellung war bereits als deaktiviertes UI-Element vorbereitet und
wird jetzt dynamisch aus `START_REGIONS` befüllt; die gewählte Region bestimmt
Name/Fruchtbarkeit/Bevölkerung/Startkapital der Spielerprovinz. Bewusste
Vereinfachung: die Nachbarregionen (ai1-ai7) bleiben für jede Wahl identisch —
eine vollständige, region-abhängige Nachbarschaftskarte wäre ein deutlich
größeres, eigenständiges Vorhaben.

**Getestet:** `node tests/battle_test.js`/`economy_test.js`/`ai_vs_ai_test.js`
nach jeder Kalibrierungsrunde erneut geprüft (0/20 unkontrollierte
Bevölkerungskollapse, KI-Dominanz 46 % unter der 50 %-Schwelle). Playwright:
Heirat erzwungen → Fenster erscheint mit korrektem Text; Kornbilanz zeigt nach
einem Jahr realistische Werte (z. B. 130-184 % statt drei- bis
zwölfstelliger Prozentzahlen) inkl. sichtbarer Lagerkapazität/Schwund;
Kassenbuch zeigt nach einem Gebäudekauf korrekt „Neubau: Bauernhof −200“
unter „Weitere Ein-/Ausgaben“, Steuereinnahmen sind jetzt spürbar (+94 statt
+1); Startregion „Republik Venedig“ ausgewählt → Topbar/Zustand zeigen
korrekt Name, Fruchtbarkeit 0,85, Bevölkerung 2.200, Startkapital 2.100 Taler.

## 2026-08-20 – Schritt 38: Kriegskarte — Risiko-artige Gebietseroberung

Auf Nutzerwunsch: "wir sollten für die Kriegsphase und Militär eine Art
Brettspiel wie Risiko anlegen." Größter Einzelschritt bisher.

**Umfang geklärt statt geraten:** Zwei echte Architekturentscheidungen wurden
vorab mit dem Nutzer geklärt (nicht selbst geraten): (1) eine "echte
Mehrgebiets-Karte" statt nur die 8 bestehenden Regionen als Felder, (2) die
bestehende taktische Kampf-Engine bleibt für jeden Zusammenstoß erhalten,
die Kriegskarte ist nur die neue strategische Ebene darüber.

**Umsetzung:** Neue Datentabelle `TERRITORIES` (gamedata.js) — 16 Gebiete,
vier pro kriegsfähiger Region (Spieler + ai1 Mainau + ai2 Rheinfeld + ai3
Bergheim, die einzigen mit echter Diplomatie; ai4-ai7 bleiben reine
Hintergrundregionen). Jede Region hat eine befestigte Hauptstadt (Gelände
"Burg", starke Verteidigung über die bestehenden Geländeboni der Kampf-
Engine) und drei Provinzgebiete, davon je eines an eine Nachbarregion
grenzend, plus Querverbindungen zwischen den KI-Regionen für eine
zusammenhängende kleine Karte. Neues Modul `js/war-map.js` verwaltet
Besitzer/Garnison pro Gebiet (`state.territories`), Truppenstationierung aus
der bestehenden Rekruten-Reserve, Verlegung zwischen eigenen Nachbargebieten,
und baut Kampfarmeen aus den Gebiets-Garnisonen statt aus der gesamten
Region auf.

**Krieg wird ein andauernder Zustand.** "Krieg erklären" löste bisher sofort
eine abstrakte Alles-oder-nichts-Schlacht aus (`declareWar()` in
military.js). Diese Funktion wurde umgebaut: sie bricht weiterhin Verträge/
crash die Beziehung wie zuvor, setzt aber jetzt `state.warState[aiId] =
true` und eröffnet die Kriegskarte, statt eine Schlacht sofort aufzulösen.
Der Spieler erobert danach Gebiet für Gebiet, jeder Angriff läuft über die
volle interaktive Kampf-Engine (Formation/Taktik/Gelände/Moral, exakt wie
zuvor). Ein Friedensvertrag beendet die Kampagne (bereits eroberte Gebiete
bleiben beim Eroberer). Erobert der Spieler ALLE Heimatgebiete einer Region,
unterwirft sie sich automatisch als Vasall (nutzt das bereits bestehende,
getestete Vasallentribut-System weiter statt eine neue Wirtschafts-
Zusammenführung zu bauen).

**KI bleibt kein Punchingball.** Im Krieg befindliche KI-Regionen erholen
ihre Garnisonen langsam (jährliche Annäherung an die Zielstärke) und können
mit einer Jahreswahrscheinlichkeit selbst ein Grenzgebiet des Spielers
angreifen (`aiTerritoryCounterAttack`) — löst denselben interaktiven
Verteidigungsbildschirm aus wie ein KI-Überraschungskrieg (§31), nur
gebietsscharf statt regionsweit.

**Bewusste Vereinfachungen (Scope-Entscheidungen, transparent gehalten):**
- Von der KI selbst erklärte Überraschungskriege (§31, `incomingAiWar`)
  bleiben unverändert eine regionsweite Sofortschlacht — nur die vom Spieler
  ausgelösten Kriege laufen über die neue Kriegskarte. Setzt aber ebenfalls
  `state.warState`, damit danach auf der Kriegskarte weitergekämpft werden
  kann.
- Die alte, regionsweite Belagerungsmechanik (Aushungern/Bestechen vor einem
  Sturmangriff) wird nicht mehr ausgelöst — eine befestigte Hauptstadt
  bekommt stattdessen automatisch den "Burg"-Geländebonus, wenn sie als
  Gebiet angegriffen wird. Der alte Code bleibt unbenutzt erhalten (gleiches
  Vorgehen wie schon bei der alten Sofort-Kriegsauflösung zuvor).
- Kriegsverbündete (rollWarAllies) werden weiterhin gewürfelt und im
  Kriegschronik-Text erwähnt, wirken sich aber (noch) nicht mechanisch auf
  einzelne Gebietskämpfe aus.

**Getestet:** `node tests/battle_test.js`/`economy_test.js`/`ai_vs_ai_test.js`
(beide Letzteren um das neue `war-map`-Modul in der Bündelungsreihenfolge
ergänzt) — 0/20 unkontrollierte Bevölkerungskollapse, KI-Dominanz 47 % unter
der 50 %-Schwelle, keine Regression. Node-Skript verifiziert
`checkRegionConquest` (alle 4 Gebiete einer Region erobert → Vasallisierung,
Prestige/Taler-Bonus, Krieg endet) und `aiTerritoryCounterAttack` (löst
zuverlässig `state.pendingTerritoryDefense` aus). Playwright-Durchlauf durch
den kompletten Spielerangriff (Krieg erklären → Karte öffnet automatisch →
Truppen aus der Reserve stationieren → Nachbargebiet angreifen → Kampf-
Engine → Sieg → Gebiet wechselt den Besitzer → zurück zur Karte) und die
KI-Verteidigung (KI greift Spielergebiet an → Warnhinweis →
Verteidigungsbildschirm mit korrekt beschrifteten Seiten → Kampf → Ergebnis
korrekt angewendet) — keine JavaScript-Fehler. Ein Layout-Bug beim ersten
Rendern behoben: die Kartenknoten überlappten stark, weil der Kartenrahmen
ein anderes Seitenverhältnis hatte als die x/y-Koordinaten der Gebiete
(behoben durch ein quadratisches Kartenraster, in dem Prozentwerte auf
beiden Achsen gleich skalieren) — sowie ein Beschriftungsfehler, bei dem der
Verteidigungsbildschirm fälschlich das angreifende KI-Gebiet statt des
verteidigten Spielergebiets im Titel zeigte.

## 2026-08-20 – Schritt 39: Markthandel in die Marktpreise-Tabelle integriert, Regionalhandel-Risiko/Ertrag überarbeitet

Zwei kleinere Nutzerwünsche nach weiterem Antesten der Kriegskarte.

**Markthandel jetzt Teil der Marktpreise-Tabelle.** Der bisher separate
"MARKTPLATZ"-Block (ein Dropdown zur Warenwahl + Kaufen/Verkaufen für genau
eine Ware) ist entfallen — jede Zeile der Marktpreise-Tabelle hat jetzt
direkt eigene Kaufen-/Verkaufen-Buttons, mit einer gemeinsamen Mengenangabe
im Tabellenkopf. `doMarketTrade(action)` (las die Ware aus einem separaten
Dropdown) wurde zu `doMarketTrade(gid, action)`, das die Warenkennung direkt
von der jeweiligen Zeile bekommt.

**Regionalhandel: höheres Risiko, aber auch höherer Ertrag.** Nutzer-
Feedback: der Regionalhandel lohnte sich kaum gegenüber dem sicheren
lokalen Markt — 12% Transportkosten plus ein erwarteter Räuberverlust von
6%×35% ≈ 2% ergaben zusammen mehr Abzug als die pauschalen 8% Auf-/Abschlag
beim lokalen Markt, ohne kompensierenden Mehrwert. Neu kalibriert:
Transportkosten von 12% auf 7% gesenkt (mehr vom Preisunterschied bleibt als
Gewinn), dafür Räuberrisiko von 6% auf 12% verdoppelt und der Verlust bei
einem Überfall von 35% auf 50% der Ladung erhöht — ein echtes Risiko-Ertrag-
Profil statt eines strikt schlechteren Ablegers des lokalen Markts. Die
Anzeige im Regionalhandel-Panel nennt jetzt explizit den möglichen
Ladungsverlust bei einem Überfall.

**Getestet:** `node tests/economy_test.js` erneut grün (0/20 unkontrollierte
Bevölkerungskollapse — die Regionalhandel-Kalibrierung betrifft ohnehin nur
spielergesteuerte Aktionen, die der passive Test nicht auslöst).
Playwright: alle 18 Warenzeilen zeigen korrekt Kaufen-/Verkaufen-Buttons,
ein Testkauf über die neue Zeilen-Schaltfläche erhöht den Lagerbestand
korrekt, keine JavaScript-Fehler.

## 2026-08-20 – Schritt 40: Beraterstufen, Bevölkerungsentwicklung im Kassenbuch, spürbarer Regierungsstil

Drei Nutzerwünsche nach weiterem Antesten: "die berater können verschiedene
stufen haben und haben auch andere beraterkosten, der einfluß muss auch
spürbar sein", "die geburtenrate, todesrate, zuwanderer und abwandrrer soll
nach jeder runde mit angezeigt werden", "welchen sinn macht der
regierungsstil, da muss mehr einfluß aufs spiel geben".

**Berater mit drei Stufen statt An/Aus.** Jede der 6 Beraterrollen hat jetzt
einen eigenen Grundpreis (`ADVISOR_ROLES[role].baseCost`, 120–220 Taler statt
pauschal 150) und lässt sich bis Stufe 3 ausbauen
(`advisorUpgradeCost(role, level) = baseCost * 1.8^level`, dasselbe Muster
wie beim bestehenden Gebäude-Ausbau). `advisorEffectBonus()` skaliert jede
Rollenwirkung linear mit der Stufe. Der bisher komplett wirkungslose
Spionagemeister (nur ein "Beta"-Textstub) hebt jetzt tatsächlich die
Aufklärungsgenauigkeit über Nachbarregionen (`updateIntel`-Untergrenze).
Der Geistliche-Bonus lief vorher über eine vom Beratersystem losgelöste
Extra-Formel mit einer nie benutzten Variable — jetzt läuft er korrekt über
`advisorEffectBonus`. Nebenbei einen Skalierungsfehler beim Marschall
behoben: der Anführungs-Bonus multiplizierte mit ×100 statt einem kleinen
Faktor und sättigte dadurch die 10–99-Obergrenze bereits bei Stufe 1 —
Stufe 2/3 hätten sich für diesen Effekt nicht bemerkbar gemacht. Das
Berater-Panel zeigt jetzt pro Rolle Stufe, aktuelle Wirkung in Klartext
("+34% Steuereinnahmen" usw.), Jahresgehalt (skaliert mit Stufe) sowie
"Ausbauen"/"Entlassen"-Buttons.

**Bevölkerungsentwicklung im Kassenbuch.** `updatePopulation()` summiert
jetzt Geburten/Todesfälle über alle Bevölkerungsgruppen
(`region.lastPopSummary`), `applyInterRegionalMigration()` setzt
`lastNetMigration` neu für jede Region statt nur bei Wanderungsbewegung. Das
Kassenbuch-Fenster zeigt am Jahresende (nicht in den übrigen 11 Monaten,
da sich diese Werte nur einmal pro Jahr ändern) einen neuen Abschnitt
"Bevölkerungsentwicklung dieses Jahr" mit Geburten, Todesfällen,
Zu-/Abwanderung und der resultierenden Gesamtbevölkerung.

**Regierungsstil jetzt ein echter beidseitiger Regler.** Die alte Formel
wirkte nur in Richtung "gierig" (Regler 0–100 wurde effektiv 0–50 gierig,
darunter praktisch kein Effekt) und mit sehr kleinen Konfigwerten — kaum
spürbar, wie vom Nutzer bemängelt. Neu: `swing = (Regler/100 - 0.5) * 2`
läuft von −1 (sehr fair) über 0 (Mitte) bis +1 (gierig) und wirkt in beide
Richtungen auf Staatskasse, Zufriedenheit und Legitimität; die Konfigwerte
wurden spürbar angehoben (`incomeFactorAtGreedy` 0,03→0,15,
`legitimacyPenaltyAtGreedy` 1,5→3). Eine neue Live-Vorschau
(`updateGovernanceInfo()`) zeigt direkt unter dem Regler die jährliche
Wirkung in Talern/Zufriedenheit/Legitimität, live aktualisiert beim
Ziehen.

**Regressionsfund und Fix.** Nach der Umstellung auf den symmetrischen
Regler zeigte `node tests/ai_vs_ai_test.js` einen schweren Rückfall: die
Spieler-Titelverteilung nach 100 rein passiven Jahren (Referenzwert seit
Schritt 13: praktisch immer "Freiherr", da der Spieler nichts tut) sprang
auf `Landgraf 21/100, Freiherr 15/100, Baron 33/100, Graf 31/100`, und
"Preise nahe Obergrenze" in `economy_test.js` verdoppelte sich. Ursache: der
Startwert `governanceStyle` blieb bei `15` (kalibriert für die alte,
einseitige Formel) — unter der neuen, symmetrischen und deutlich stärkeren
Formel liegt 15 weit im "fairen" Bereich und erzeugt dadurch automatisch,
jedes Jahr, ohne jede Spieleraktion einen Zufriedenheits-/Legitimitätsbonus
(+5,6/+2,1 pro Jahr) — genau die Art von unauffällig wirkendem, sich über
100 Jahre aufsummierendem Effekt, vor der Schritt 13 bereits gewarnt hatte.
Fix: Startwert auf `50` (den echten wirkungsfreien Mittelpunkt der neuen
Formel) gesetzt und die Regler-Beschriftungsschwellen (bisher asymmetrisch
bei 25/50/75) auf ein neues 5-stufiges Schema mit "Ausgewogen" in der Mitte
(20/40/60/80) umgestellt, damit der neue Standardwert nicht fälschlich als
"Streng" erscheint.

**Getestet:** `node tests/battle_test.js` unverändert grün. Nach dem Fix
`node tests/economy_test.js`: "Preise nahe Obergrenze" wieder bei 3/20
(Referenzbereich), 0/20 unkontrollierte Bevölkerungskollapse.
`node tests/ai_vs_ai_test.js`: Spieler-Titelverteilung wieder "Freiherr:
100/100", Spieler-Siege 0/100 wie erwartet bei rein passivem Spiel —
Regression bestätigt behoben. Playwright: Berater anwerben und ausbauen
(Kosten korrekt von 220 auf 396 Taler gestiegen, Stufe 1→2, Wirkungstext
aktualisiert), ein volles Jahr durchlaufen und das Kassenbuch zeigt die
neue Bevölkerungssektion mit korrekten Werten, Regierungsstil-Regler auf
"Gierig" (90) gezogen zeigt sofort +288 Taler/−6,4 Zufriedenheit/−2,4
Legitimität in der Live-Vorschau — keine JavaScript-Fehler.

## 2026-08-21 – Phase 2 (KAISERREICH-Next-Generation-Master-Prompt): Technical Stabilization

Reines Behavior-Preserving Refactoring nach abgeschlossener Phase 1
(Code-Audit, siehe CODE_AUDIT.md/BASELINE.md/GAME_DESIGN.md/ROADMAP.md).
Oberste Regel dieser Phase: identisches Spielverhalten, kein einziger
Balance-/Gameplay-Wert verändert — "besserer Code, identisches Spiel".

**Priorität 1 — `advanceYear()` entzerrt.** Die ~123 Zeilen lange
Orchestrator-Funktion (nicht fehlerhaft, aber ein Refactoring-Kandidat,
siehe CODE_AUDIT.md Abschnitt 12) wurde per reinem Extract-Method in 6
benannte Teilschritte zerlegt: `applyPreProductionBonuses()`,
`processAllRegions()`, `updateEconomyAndDiplomacy()`,
`applyRulerAndDynastyEffects()`, `updatePoliticsAndWar()`,
`finalizeYear()` — `advanceYear()` selbst ist jetzt ein 6-zeiliger
Aufrufer in exakt der bisherigen Reihenfolge. Keine Logik neu geschrieben,
keine Bedingungen vereinfacht, keine RNG-Aufrufe verschoben. Die einzigen
Nicht-1:1-Anpassungen sind ein erneutes `const r = state.regions.player`
und eine erneute (reine, RNG-freie) `advisorEffectBonus(state,
"handelsberater")`-Berechnung in den Funktionen, die diese Werte später
brauchen — beides liefert exakt denselben Wert wie zuvor.

Dafür neu angelegt: `tests/advance_year_snapshot_test.js` — ein
dauerhafter Determinismus-Regressionstest mit 3 festen Seeds (101/202/303),
der pro simuliertem Jahr Staatskasse/Bevölkerung/Preise/Dynastie/Prestige/
Legitimität/Kriege/Beziehungen/volle Chronik/Game-Over-Zustand gegen ein
Golden-Fixture (`tests/fixtures/advance_year_snapshot_golden.json`,
erzeugt aus dem Code-Stand VOR dem Refactoring) vergleicht und bei der
ersten Abweichung exakt Jahr und Feld benennt. Ergebnis nach dem
Refactoring: alle 3 Seeds jahrgenau byte-identisch (bis zu 100 simulierte
Jahre). `battle_test.js`- und `baseline_analysis.js`-Ausgabe ebenfalls
byte-identisch vorher/nachher; `economy_test.js`/`ai_vs_ai_test.js`
(unseeded) blieben im etablierten Referenzbereich.

**Priorität 2 — Data-Sync abgesichert.** Der zuvor gefundene Drift
(`data/json/advisor-roles.json` fehlte das `baseCost`-Feld seit Schritt 40)
wurde behoben (`node tools/data-sync.js extract`, keine Kostenwerte
verändert — nur die Moddatei an den bereits bestehenden `gamedata.js`-Stand
angeglichen). `tools/data-sync.js` validiert jetzt vor jedem Schreiben
Pflichtfelder für alle 9 getrackten Tabellen und bricht bei einem
fehlenden Feld mit klarer Fehlermeldung ab, statt still zu überschreiben.
Verifiziert: ein voller Extract→Build-Roundtrip lässt `gamedata.js`
byte-identisch, ein absichtlich entferntes `baseCost`-Feld lässt den Build
kontrolliert fehlschlagen (gamedata.js bleibt unverändert) — exakt der
Fehler, der ursprünglich unbemerkt geblieben wäre, ist jetzt hart
abgesichert.

**Priorität 3 — Tote Belagerungslogik entfernt.** Vor der Entfernung
projektweit erneut nach Aufrufstellen/String-Referenzen/dynamischem
Dispatch gesucht (bestätigt: `startSiege()` — die einzige Stelle, die
`state.pendingSiege` je setzte — wurde von nichts im Projekt aufgerufen).
Entfernt: `resolveSiegeStorm/Starve/Bribe` (`js/military.js`),
`startSiege/siegeStarve/siegeBribe` (`js/battle-bridge.js`), die
zugehörige unerreichbare UI-Verzweigung in `index.html` (Render-Zweig +
`doSiegeAction()`). Bewusst NICHT angefasst: zwei harmlose, dauerhaft
falsche `state.pendingSiege`-Schutzabfragen in noch aktivem Code
(`checkAiWarInitiative`, `applyBattleResultToGame`) sowie `CONFIG.siege`
in `gamedata.js` (jetzt unbenutzt, aber CONFIG-Werte waren explizit außer
Scope für diese Phase). `determineWarTerrain()` bleibt aktiv (Kriegskarten-
Geländebonus).

**Zusätzlich (Punkt 29–31 der Phase-2-Anweisung): Build-Infrastruktur.**
Neues `tools/build-bundle.js` ersetzt das bisherige Ad-hoc-Inline-Rebuild-
Skript durch ein committetes Werkzeug mit echter Validierung: Existenz-
prüfung der 14 Quelldateien, Syntax-Check, und ein Laufzeit-Rauchtest (das
Bundle wird in einer `vm`-Sandbox tatsächlich gestartet und 12× per
`advanceMonth()` einen vollen Jahreswechsel durchlaufen lassen). Beim Bau
dieses Prüfschritts selbst eine echte Schwäche gefunden: ein einzelner
`advanceMonth()`-Aufruf erreicht `advanceYear()` nie (erst der 12. Aufruf
löst den Jahreswechsel aus) — die erste Fassung des Rauchtests hätte
Fehler innerhalb von `advanceYear()` daher nicht erkannt. Mit zwei
bewussten Fehlereinspielungen (fehlende Datei, kaputter Funktionsaufruf)
verifiziert, dass das korrigierte Werkzeug beide zuverlässig mit klarer
Fehlermeldung erkennt, ohne `index.html` zu beschädigen. CODE_AUDIT.md
Abschnitt 14 enthält zusätzlich eine kleine Modul-Abhängigkeitsübersicht
(mit dem Hinweis, dass Funktions-Hoisting die Ladereihenfolge weniger
strikt macht als zunächst angenommen) und eine vorbereitete, aber nicht
umgesetzte Getter/Selector-Liste für eine mögliche spätere UI-Entkopplung.

**Nicht verändert (bewusst, per Auftrag):** keine Balance-/CONFIG-Werte,
keine Gameplay-Regeln, keine neuen Events/Systeme, keine UI-Migration, die
Kampf-Engine (`battle-engine/*.js`) unangetastet.

**Commits** (klein, nachvollziehbar, keine Feature-Commits):
`test: add deterministic yearly simulation regression baseline` →
`refactor: extract advanceYear phases without behavior changes` →
`build: rebuild index.html bundle after advanceYear extraction` →
`fix: preserve advisor baseCost during data sync` →
`cleanup: remove unreachable siege implementation` →
`build: add validated bundle build tool + module dependency overview` →
diese Dokumentation. Working Tree nach jedem Schritt sauber, alle Tests
zwischendurch grün.

## 2026-08-21 – Phase 3 (KAISERREICH-Next-Generation-Master-Prompt): Character Core

Erste Phase mit bewusst neuen/vertieften Gameplay-Mechaniken (kein reines
Refactoring mehr wie Phase 2). Ziel laut Auftrag: "Der Spieler soll Personen
statt nur Zahlen wahrnehmen." Kein zweites paralleles Charaktermodell — das
bestehende `state.characters`/`createCharacter()` wurde additiv erweitert.

**Architektur zuerst.** Vor der Umsetzung geprüft: Charaktere lebten bereits
als flaches `state.characters`-Dictionary mit stabilen IDs (`c1`, `c2`, …,
nie wiederverwendet — erfüllte die geforderte dauerhafte ID bereits ohne
Änderung), 6 Werten (`stats`, Bereich 3-17), 2 zufälligen Traits, Eltern-/
Kinder-/Ehepartner-Links. Berater waren technisch bereits vollständige
Charaktere (`generateAdvisorCandidate()` rief `createCharacter()` auf),
wurden aber ohne Auswahl automatisch zugewiesen, und ihre Wirkung kam
ausschließlich aus einer reinen `× Ausbaustufe`-Multiplikation. Kein
Beziehungs-Ursachen-Log, kein Loyalitätsbegriff getrennt von "Beziehung",
kein Claim-System, keine Rivalitäten — das waren die tatsächlichen Lücken.

**Neues Modul `js/characters.js`.** Beziehungen (`computeRelationshipBreakdown`
kombiniert dauerhaft gespeicherte Ereignis-Modifikatoren mit jährlich frisch
berechneten strukturellen — Geschwister/Ehepartner/gleiches Haus/Charisma),
Loyalität (`computeLoyalty`, bewusst getrennt von Beziehung: Basis 50 +
0,3×Beziehung + Trait-Modifikatoren + Amtsbonus + Legitimitätsfaktor − Claim-
Malus), Claims (`updateClaims`, vereinfacht auf den einzigen im Spiel
mechanisch existierenden Titel "player" statt eines vollen Mehrtitel-Graphen
— primary/strong/weak je nach Verwandtschaftsgrad), Rivalitäten
(`updateRivalries`, zwei Auslösepfade: echter Groll allein, oder Ehrgeiz +
starker Claim bei bereits angespannter statt zwingend tiefer Beziehung —
erste Kalibrierung war zu streng, siehe unten). Alles läuft über EINEN
neuen Aufruf `updateCharacterCore(state)` direkt nach `updateDynasty()` in
`applyRulerAndDynastyEffects()` — `advanceYear()` selbst bleibt bei 6 Zeilen
(Phase-2-Struktur unangetastet, §Punkt 89).

**Traits datengetrieben erweitert.** 12 neue Traits ergänzt (loyal,
barmherzig, mutig, feige, intelligent, naiv, charismatisch, paranoid,
arrogant, bescheiden, korrupt, rachsüchtig) zu den 10 bestehenden — 4 davon
(ehrgeizig/großzügig/geizig/grausam) bekamen zusätzliche, rein additive
neue `effects`-Schlüssel (`loyaltyMod`/`claimAggression`/`advisorEffectMod`/
`relationshipMod`), ihre bisherige Wirkung (`prestigeGain` etc.) bleibt
exakt gleich. Alles über die bereits bestehende, generische
`traitEffectSum(character, key)` gelesen — keine neue if-Kette. Offensicht­
lich widersprüchliche Kombinationen (mutig+feige, großzügig+geizig,
bescheiden+arrogant) werden bei der Vergabe ausgeschlossen.

**Skills: bewusst kein Rescaling.** `stats` behält den bestehenden
Wertebereich 3-17 und seine 6 bisherigen Schlüssel exakt bei — jede
bestehende, kalibrierte Formel bleibt dadurch unverändert. Zwei neue,
bislang nicht existierende Felder (`finanzen`, `intrige`) ergänzt für die
vom Auftrag geforderten Skills "Finanzen"/"Intrige". `ADVISOR_ROLES.
schatzmeister`/`.spionagemeister` wurden von `verwaltung`/`intelligenz` auf
diese neuen, thematisch treffenderen Felder umgestellt (keine bestehenden
Werte verändert — beide Felder hatten zuvor keine Kalibrierungshistorie).

**Berater: echte Kandidatenauswahl statt Level-Skalierung.** Bei einer
Vakanz werden jetzt 2-4 echte, unterschiedliche Kandidaten erzeugt
(`generateAdvisorCandidates`/`openAdvisorSelection`/
`confirmAdvisorSelection`), der Spieler wählt über ein neues Modal
(`#advisorCandidatesModal`). Gelegentlich (40%-Chance) ist ein lebender,
erwachsener, amtsloser Geschwisterteil des Herrschers unter den Kandidaten
— wird er nicht gewählt, entsteht eine dauerhafte "Amt verweigert"-Spannung
(exakt das Wilhelm-Beispiel aus dem Auftrag). Das bisherige Ausbausystem
(`upgradeAdvisor`, `baseCost`, Kosten) bleibt vollständig erhalten, wirkt
aber jetzt als moderater Amtserfahrungsbonus (`tenureBonusPerLevel: 0.15`,
neuer, separat kalibrierter CONFIG-Wert) statt einer reinen
`× Ausbaustufe`-Skalierung — die eigentliche Wirkung
(`advisorEffectBonus()`) kommt jetzt primär aus Skill × Trait-Modifikator ×
Loyalitätsfaktor (0,7-1,0×). Berater altern (liefen bereits über die
gemeinsame Alterungsschleife) und sterben jetzt auch (`checkAdvisorDeaths()`,
dieselbe `rollDeathChance()`-Formel wie beim Herrscher — keine zweite
Alterungslogik). Herrscherwechsel kann Berater je nach ihrer zuletzt
berechneten Loyalität zum alten Herrscher das Amt kosten.

**Erbfolge unangetastet, nur ergänzt.** Das bestehende Ergebnis (ältestes
lebendes Kind erbt) wurde nicht verändert. Neu: übergangene Geschwister
bekommen einen dauerhaften Claim-Upgrade (`strong`, reason
"succession_passed_over") plus einen persistenten Beziehungs-Malus
("erbfolge_uebergangen": −25) — die Grundlage für spätere Erbfolgekrisen
(Phase 5+), noch ohne automatischen Bürgerkrieg.

**Kalibrierungsrunde (Rivalitäten).** Erste Fassung der Rivalitäts-
Bedingung (Beziehung ≤ −30 UND starker Claim/Ehrgeiz) löste in 30×100-Jahre-
Testläufen NIE aus — die familiäre Grundsympathie (Geschwister +15 +
gleiches Haus +5 = +20 Basis) machte −30 praktisch unerreichbar ohne
mehrere zusätzliche Grollereignisse. Nach `tests/phase3_metrics_test.js`
angepasst auf zwei Pfade (echter Groll ≤ −25 allein, ODER Ehrgeiz + starker
Claim bei einer bereits angespannten statt zwingend tief negativen
Beziehung) — liefert jetzt realistisch ~1,2 Rivalitäten pro 100-Jahre-Partie
im Schnitt (§Punkt 85: weder "nie" noch "Flut").

**Savegame-Migration.** `SAVE_VERSION` 2 → 3. `migrateSaveV2ToV3()` füllt
fehlende Felder (`stats.finanzen`/`.intrige`, `claims`, `relationships`,
`loyalty`, `advisorRole`, `rivalIds`) mit festen (nicht gewürfelten —
`rnd()` während der Migration würde den deterministischen Zufallsstrom des
geladenen Spielstands verfälschen) Defaultwerten. Getestet: ein simulierter
"echter" Version-2-Spielstand (Felder manuell entfernt) lädt fehlerfrei und
lässt sich danach weiterspielen.

**RNG-Auswirkung (§Punkt 47, ausdrücklich erlaubt).** `createCharacter()`
würfelt jetzt 2 zusätzliche Skills (`finanzen`/`intrige`) — das verschiebt
den GESAMTEN nachfolgenden Zufallsstrom ab dem allerersten erzeugten
Charakter (dem Herrscher in `newGame()`). Das alte Phase-2-Golden-Fixture
wurde daher NICHT einfach überschrieben, sondern nach
`tests/fixtures/advance_year_snapshot_golden_phase2.json` archiviert; ein
neues Fixture wurde erzeugt und ist gegen sich selbst erneut deterministisch
(3 Seeds, bis zu 100 Jahre, jahrgenau byte-identisch). Interessanter
Nebenbefund: in rein PASSIVEM Spiel (keine Spieleraktion, wie in
`ai_vs_ai_test.js`/`baseline_analysis.js`) werden nie Berater angeworben —
`checkAdvisorDeaths()` durchläuft dann nur leere Ämter und verbraucht keinen
einzigen `rnd()`-Aufruf, wodurch die reine Passivspiel-`no_heir`-Rate exakt
bei den bekannten 53% blieb (nicht künstlich gefixt, §Punkt 57).

**Neue Tests.** `tests/character_core_test.js` (22 Einzelfälle: Charakter-
generator-Determinismus, Beziehungssumme/-gründe/-klammerung, 5 Traits mit
tatsächlicher Wirkung, 4 Claim-Szenarien, Loyalitätsvergleich A/B, 8
Berater-Fälle inkl. Tod-macht-Amt-frei) — alle grün.
`tests/phase3_metrics_test.js` (30×100 Jahre): ~7 aktive Charaktere am
Spielende, Ø 2,00 Traits/Charakter, ~1,2 Rivalitäten/Partie, Ø Loyalität
~48, no_heir-Rate unverändert 53%. Performance: `ai_vs_ai_test.js` (100×100
Jahre) läuft in ~7s (~70ms/Partie) — keine spürbare Verschlechterung.

**UI-Erweiterungen (kein Redesign).** Neues Kandidatenauswahl-Modal
(`#advisorCandidatesModal`), Berater-Panel zeigt jetzt Alter/Haus/
Eigenschaften/Loyalität, ein technischer Charakter-Inspektor im
bestehenden Debug-Bereich (Auswahl-Dropdown + vollständige Aufschlüsselung:
Skills/Traits/Claims/Beziehung-zum-Herrscher mit Einzelgründen/Loyalität/
Rivalen — keine Blackbox, §Punkt 62).

**Data-Sync.** `ADVISOR_ROLES` neu extrahiert (die zwei `statKey`-Änderungen
nachgezogen), Roundtrip-stabil (byte-identisch) verifiziert. `TRAITS`
bewusst NICHT in `tools/data-sync.js` aufgenommen (keine neue Tabelle ohne
sauberen Extract→Build-Support, §Punkt 70 — bleibt als offener Punkt für
eine spätere, bewusste Entscheidung dokumentiert, analog zu
`TERRITORIES`/`START_REGIONS` aus Phase 2).

**Bewusst NICHT umgesetzt (§Punkt 35-37, 99):** World Memory, Drama
Director, Event Chains, große UI-Überarbeitung. Battle Engine
(`battle-engine/*.js`) unverändert — Charakter-Militärskill wird noch nicht
in die Kampf-Engine eingespeist.

## 2026-08-21 – Phase 4 (KAISERREICH-Next-Generation-Master-Prompt): World Memory

Zentrale Zielsetzung laut Auftrag: "KAISERREICH soll sich bedeutende
Ereignisse merken" — nicht "Beziehung zu Wilhelm = −52", sondern "Wilhelm
wurde 1518 bei der Vergabe des Marschallamtes übergangen." Zentrale
Designregel (§Punkt 2): NUR bedeutsame Ereignisse werden gespeichert, kein
Gedächtnis für Wetter/Preisrauschen. Kein zweites paralleles System — World
Memory ersetzt die bisherigen Phase-3-Statik-Modifikatoren als einzige
Quelle der Wahrheit, ist aber ausdrücklich NICHT die Chronik (die bleibt
unverändert, weiterhin mit dem bekannten 95%-Wetter-Problem aus
`BASELINE.md`, siehe unten).

**Neues Modul `js/memory.js`.** Zentraler Hook `recordWorldEvent(state,
opts)` — jede Memory-Erzeugung läuft ausschließlich hier durch, deterministische
IDs (`m1`, `m2`, …, nie wiederverwendet). Memory-Objekt: `id`, `type`,
`year`, `actorIds`/`targetIds`/`regionIds` (KI-Regionen besitzen keine
individuellen Herrscher-Charaktere — Diplomatie-/Kriegsereignisse referenzieren
deshalb bewusst `regionIds` statt erfundener Charakter-IDs), `importance`
(1-100, wie bedeutsam), `emotionalWeight` (−100..100, wie sehr freut/ärgert
es), `decayRate`, `expiresYear`, `tags`, `metadata`, `description`. Neue
Datentabelle `MEMORY_TYPES` (23 Einträge über Dynastie/Hof/Diplomatie/Krieg/
Politik) liefert je Typ Default-`importance`/`decayRate`/`tags` sowie ein
neues `direction`-Feld (`target_to_actor`/`symmetric`/`none`), das steuert,
ob und wie ein Ereignis (asymmetrisch oder gegenseitig) in die Beziehungs-
berechnung einfließt — löst den Zielkonflikt zwischen einem einzelnen
`emotionalWeight`-Feld im Schema und der geforderten
perspektivenabhängigen Wirkung (§Punkt 21).

**Zerfall ohne Löschen (§Punkt 17-19).** `computeEffectiveWeight(state,
memory, characterId)` ist eine reine Funktion — liest `state.year` und
optional Charakter-Traits, verändert nie das Memory-Objekt selbst ("keine
Zeitreise": Zerfall wird bei jedem Aufruf frisch berechnet). Lineare
Verblassung (`emotionalWeight × max(0, 1 − decayRate × Jahre)`), geklammert
auf eine Zerfallsrate zwischen 0 und 1. Manche Typen (RULER_DIED, SUCCESSION,
MARRIAGE, PEACE_SIGNED, TITLE_GAINED) haben `decayRate: 0` — historische
Fakten, die bewusst nie verblassen. Memories bleiben IMMER in
`state.memories.byId` stehen, auch wenn ihre mechanische Wirkung längst auf 0
gefallen ist (historisch vs. aktuell-wirksam ist eine reine Leseunterscheidung,
keine Speicherunterscheidung).

**Traits beeinflussen Zerfall/Gewichtung.** 3 neue, additive Effekt-
Schlüssel auf bestehenden Traits: `loyal` → `memoryDecayModPositive: -0.3`
(gute Erinnerungen verblassen langsamer), `barmherzig` →
`memoryDecayModNegative: 0.5` (vergibt schneller), `paranoid` →
`memoryWeightAmplifierNegative: 0.3` (empfindet Kränkungen stärker),
`rachsüchtig` → `memoryDecayModNegative: -0.4` (vergisst Kränkungen
langsamer/nie). Alles über die bestehende, generische `traitEffectSum()`
gelesen — keine neue if-Kette.

**Single Source of Truth statt Doppelbuchführung (§Punkt 25).** Die drei
bisherigen Phase-3-Statik-Modifikatoren (Amt verweigert, Erbfolge übergangen,
Rivalität) wurden vollständig auf live aus Memories berechnete Werte
umgestellt — nicht als zusätzliche Parallel-Buchführung beibehalten. Grund:
die eigenen Beispielwerte des Auftrags (§Punkt 87/102, "1518 –
Marschallamt verweigert: −11 aktuell", abklingend von ursprünglich −20)
verlangen selbst eine live zerfallende Berechnung. `PERSISTENT_MODIFIER_SOURCES`
und `addPersistentRelationshipModifier()` wurden entfernt;
`computeRelationshipBreakdown()` liest jetzt zusätzlich zu den weiterhin
bestehenden strukturellen Modifikatoren (Geschwister/Ehepartner/Haus/Charisma)
`getMemoriesForRelationship(state, fromId, toId)` und berechnet pro Memory
`computeEffectiveWeight()`. Rivalitäten (`addRivalry()`) und übergangene
Nachfolge (`handleSuccession()`) legen jetzt selbst eine `RIVALRY_BEGAN`-
bzw. `PASSED_OVER_IN_SUCCESSION`-Memory an und speichern deren ID zusätzlich
in `character.rivalryOrigin[rivalId]` (§Punkt 32, `originMemoryId`-Referenz).

**Hooks in bestehenden Systemen (kein neuer Zufallsgenerator, §Punkt 6).**
Jeder `recordWorldEvent()`-Aufruf hängt an einem bereits bestehenden
Spielereignis: Geburt (`HEIR_BORN` beim ersten Kind des Herrschers,
sonst `CHILD_BORN`), Heirat, Herrschertod, Erbfolge (inkl. übergangene
Geschwister), Amtsvergabe/-verweigerung/-entlassung/Tod im Amt,
Bündnisschluss/-bruch, Hilfegewährung/-verweigerung, Kriegserklärung,
entscheidender Schlachtsieg/-niederlage (`battle-bridge.js`, sowie
vollständige Gebietseroberung in `checkRegionConquest()`, `war-map.js`),
Friedensschluss, Titelaufstieg, Kaiserwahl-Unterstützung, Rivalitätsbeginn,
Hungerkrise (`checkFamineMemory()`, neue Schwelle: ≥1% der Regionsbevölkerung
an Hungertod — läuft direkt nach `updatePopulation()` in
`processAllRegions()`). `ELECTION_PROMISE_BROKEN` ist bewusst nur in
`MEMORY_TYPES` vorbereitet, aber unverdrahtet — es existiert kein
Versprechen-Tracking in der aktuellen Kaiserwahl ("Kaiserwahl 2.0" wäre
ein eigenständiges, hier nicht beauftragtes Feature).

**Determinismus: null zusätzliche `rnd()`-Aufrufe (§Punkt 53-55).**
World Memory ist reine Buchführung bereits deterministisch entschiedener
Ereignisse. Geprüft mit dem bestehenden Golden-Snapshot-Test: `rngCalls`
und alle numerischen Felder blieben über alle 3 Seeds/100 Jahre exakt
identisch zum Phase-3-Fixture. Einzige Abweichung: zwei neue Chronik-Zeilen
(aus den neuen `addChronicle()`-Aufrufen in `addRivalry()`/
`handleSuccession()`, keine Chronik-Automatisierung durch Memories selbst)
— eine gewollte Erzähl-Verbesserung, kein RNG-Drift. Golden-Fixture daher
neu erzeugt, das Phase-3-Fixture NICHT gelöscht, sondern versioniert unter
`tests/fixtures/advance_year_snapshot_golden_phase3.json` archiviert.

**Savegame-Migration.** `SAVE_VERSION` 3 → 4. `migrateSaveV3ToV4()` legt
für alte Spielstände einen LEEREN `state.memories`-Speicher an (§Punkt 51:
ausdrückliches Verbot retroaktiver Fiktion — keine rückwirkend erfundene
Geschichte für Ereignisse, die vor der Migration bereits passiert sind) und
ergänzt fehlendes `character.rivalryOrigin`. Alte, in Phase 3 dauerhaft in
`character.relationships[x].modifiers` gespeicherte Ereignis-Modifikatoren
werden von der neuen memory-basierten `computeRelationshipBreakdown()`
ohnehin nicht mehr gelesen — sie bleiben als harmlose ungenutzte Altlast im
Save stehen statt künstlich in Memories umgedeutet zu werden (dieselbe
Nicht-Erfindungs-Regel).

**Chronik-Brücke vorbereitet, nicht aktiv (§Punkt 39/40/74).**
`memoryToChronicleCandidate(memory)` liefert nur einen Kandidaten-Text
(`importance >= 50`) für eine spätere, bedeutungsbasierte Chronik — schreibt
nichts automatisch in `state.chronicle`. Das bestehende 95%-Wetter-Problem
aus `BASELINE.md` bleibt in dieser Phase bewusst unangetastet.

**API-Oberflächen für spätere Phasen vorbereitet, nicht genutzt (§Punkt 76-78).**
`hasMemory()`, `getNegativeMemoryPressure()`, `getDynastyMemoryPressure()`,
`getRecentConflictMemories()`, `isMajorCharacter()` — Grundbausteine für
später mögliche Event Chains/Drama Director, hier nur bereitgestellt, von
keinem aktuellen Code aufgerufen außer den Metriktests.

**Neue Tests.** `tests/world_memory_test.js` (10 Fallgruppen aus §Punkt 58
plus die Beziehungsintegrations-Beispielrechnung aus §Punkt 59: Erzeugung,
Teilnehmer, Importance-Default/-Override, positive/negative Memory, Zerfall,
`rachsüchtig`-Wirkung, alle Query-Funktionen, Save/Load-Erhalt, Migration
v3→v4) — alle grün. `tests/phase4_memory_metrics_test.js` (30×100 Jahre):
Ø 22,9 Memories/Partie, Verteilung über 8 tatsächlich ausgelöste Typen
(FAMINE 20,8%, CHILD_BORN 18,2%, PASSED_OVER_IN_SUCCESSION 14,6%,
RIVALRY_BEGAN 14,1%, MARRIAGE/RULER_DIED je 8,9%, HEIR_BORN 8,0%, SUCCESSION
6,6%), 42%/58% positiv/negativ, Ø Importance 55,8, Ø Speichergröße ~84 KB,
~89ms/Partie (keine spürbare Verschlechterung ggü. Phase 3). Narratives
Signal (§Punkt 93): Ø 18,7 chronik-taugliche Memories (`importance >= 50`)
pro 100-Jahre-Partie — deutlich mehr als die 11 story-relevanten
Chronik-Ereignisse der ursprünglichen 85-Jahre-Baseline (`BASELINE.md`),
ohne dass diese bereits automatisch in die Chronik geschrieben werden.
Bestehende Regressionstests (`character_core_test.js`,
`advance_year_snapshot_test.js`, `ai_vs_ai_test.js`, `economy_test.js`,
`battle_test.js`, `phase3_metrics_test.js`) unverändert grün.

**UI-Erweiterungen (kein Redesign, §Punkt 41-44).** Charakter-Inspektor um
einen neuen Abschnitt "ERINNERUNGEN" ergänzt (chronologisch, mit aktueller
zerfallener Wirkung aus Sicht des jeweiligen Charakters). Neues,
eigenständiges Memory-Debug-Panel (`#memoryDebugOutput`) mit Filtern nach
Charakter/Typ/Mindest-Bedeutsamkeit/Vorzeichen, tabellarische Ausgabe mit
Tooltip (Beschreibung, Bedeutsamkeit, ursprüngliche/aktuelle Wirkung,
Zerfallsrate, Tags) — keine Blackbox.

**Data-Sync.** `MEMORY_TYPES` bewusst NICHT in `tools/data-sync.js`
aufgenommen — analog zur bestehenden, bereits dokumentierten Entscheidung
bei `TRAITS` in Phase 3 (kein Extract→Build-Support ohne eigene, bewusste
Entscheidung).

**Bewusst NICHT umgesetzt (§Punkt 101):** Event Chains, Drama Director,
Story Threads, UI-Redesign. Die vorbereiteten API-Oberflächen
(`hasMemory()` etc.) warten auf eine spätere, gesondert freigegebene Phase.

## 2026-08-21 – Phase 5 (KAISERREICH-Next-Generation-Master-Prompt): Event Chains

Ziel laut Auftrag: aus Simulation werden Geschichten — eine Entscheidung im
Jahr 1518 soll im Jahr 1524 noch Konsequenzen besitzen. Ausdrücklich KEIN
Drama Director (§Punkt 2): keine Funktion "Spiel ist langweilig -> erzeuge
Krise". Jede Kette braucht plausible, tatsächlich erfüllte
Simulationsvoraussetzungen aus World Memory/Charakteren/Beziehungen.

**Architektur.** Neues, schlankes Modul `js/event-chains.js` (keine
God-Class, §Punkt 6): jede der 10 Ketten ist ein Eintrag in
`CHAIN_TEMPLATES` mit zwei Funktionen — `checkEligibility(state)` liefert
`{checks, eligible, payload}` (dieselbe Struktur dient sowohl dem
Runtime-Scheduler als auch dem Debug-Panel, §Punkt 45/46 "eine Quelle der
Wahrheit"), `advance(state, chain)` schreibt eine bereits aktive Kette
fort (Verzögerungen prüfen, ggf. eine Entscheidung anbieten, auflösen/
ablaufen lassen). Texte/Optionen sind Daten, komplexe Bedingungen bleiben
JS (§Punkt 11) — keine generische Story-DSL. `state.eventChains = {active,
resolved, nextId, cooldowns}`. Chain-Objekt exakt wie im Auftrag
vorgeschlagen (`id, templateId, status, startedYear, lastAdvancedYear,
actorIds, targetIds, regionIds, stage, variables, originatingMemoryIds,
history, urgency, expiresYear`), plus `resolution` (Endergebnis, z. B.
`RECONCILED`/`ESCALATED`/`MARRIED`).

**Wiederverwendung der bestehenden Event-UI (§Punkt 63/64/86).** Kein
zweites Eventsystem: Chain-Entscheidungen laufen über exakt dasselbe
`state.pendingEvent`/`showEvent()`/`resolveEvent()`-Fenster wie die
bisherigen 23 Flavour-Events — `index.html` musste dafür NICHT verändert
werden. `queueChainDecision()` baut ein `{title, text, source:
"EVENT_CHAIN", chainId, options: [{label, apply}]}`-Objekt, dessen
`apply()`-Funktionen die Kette fortschreiben (History-Eintrag, Memory
erzeugen, ggf. auflösen). Reguläre Events tragen jetzt `source: "RANDOM"`
zur Unterscheidung. In `finalizeYear()` (`js/advance-year.js`) läuft
`updateEventChains(state)` VOR der bestehenden EVENTS-Schleife — eine
bedeutsame Chain-Entscheidung hat Vorrang vor einem beliebigen Wetter-/
Kleinevent; die EVENTS-Schleife läuft nur noch, wenn `state.pendingEvent`
noch nicht belegt ist.

**Priorität ohne Drama Director (§Punkt 39/40).** Jedes Jahr: (1) ALLE
bereits aktiven Ketten zuerst fortschreiben (Fortsetzung hat Vorrang vor
Neustarts), (2) höchstens EINE neue Kette pro Jahr, nach einer festen
Priorität (`CHAIN_PRIORITY_ORDER`), nur wenn `CONFIG.eventChains.maxActive`
(3) noch nicht erreicht ist UND dieses Jahr noch keine Entscheidung das
Event-Fenster belegt. Cooldowns (`state.eventChains.cooldowns`, Schlüssel
Template+beteiligte Charaktere) verhindern sofortige Neustarts derselben
Geschichte (§Punkt 41); Charakter-Bindung (`characterInActiveChain()`)
verhindert, dass eine Person gleichzeitig in mehreren Ketten gebunden ist
(§Punkt 42).

**Sparsamer RNG-Verbrauch (§Punkt 52-54).** Erst alle Bedingungen prüfen
(keine RNG), DANN höchstens ein gezielter Wurf, ob eine bereits als
plausibel erkannte Kette dieses Jahr tatsächlich beginnt. Ein
Implementierungsfehler wurde dabei selbst gefunden und behoben: zwei der
`checkEligibility()`-Funktionen (passed_over_heir, grieved_advisor)
würfelten ursprünglich bereits beim reinen Prüfen (Verzögerungsjahr für
die Nutzlast) — das widersprach der eigenen Sparsamkeits-Regel, weil dann
auch bei einem gescheiterten Start-Wurf schon ein rnd()-Aufruf verbraucht
war. Behoben: die Verzögerung wird jetzt erst beim ersten tatsächlichen
`advance()`-Aufruf einer bereits gestarteten Kette gewürfelt.

**Die 10 implementierten Ketten** (Details siehe `GAME_DESIGN.md` →
"Event Chains (Phase 5)"): Der übergangene Erbe (`passed_over_heir`), Der
gekränkte Berater (`grieved_advisor`), Unregelmäßigkeiten in der
Staatskasse (`corrupt_treasurer`), Hungerkrise (`famine_crisis`), Die
Händlergilde beschwert sich (`trade_conflict`), Zwischenfall an der
Grenze (`border_conflict`), Ein Heiratsangebot (`dynastic_marriage`), Die
Kirche erhebt Einspruch (`church_conflict`), Der aufsteigende Rivale
(`rising_rival`), Kaiserliche Ambitionen (`imperial_ambition`).

**World Memory als Ursache UND Folge (§Punkt 31/32/33).** Alle
Eligibility-Prüfungen nutzen die Phase-4-Query-API direkt
(`hasMemory()`, `getMemoriesByType()`) — z. B. `famine_crisis` startet
NUR, wenn tatsächlich eine echte `FAMINE`-Memory aus `js/memory.js`
existiert (keine eigene, zweite Hungersnot-Schwelle, §Punkt 16 "keine
künstliche Hungersnot"). Wichtige Entscheidungen erzeugen wiederum neue
Memories — drei neue, wirklich benötigte Typen (§Punkt 32, keine
Memory-Typ-Explosion): `DEMAND_ACCEPTED`, `DEMAND_REFUSED`,
`PUBLICLY_HUMILIATED`. Ketten speichern `originatingMemoryIds` (§Punkt 33
— nachvollziehbar, warum eine Geschichte begann).

**Charaktere: Traits/Loyalität/Beziehungen sind echte Faktoren, keine
Determinismus (§Punkt 34-37).** Beispiel `passed_over_heir`: die
Eskalations-vs-Versöhnungs-Wahrscheinlichkeit in der `escalation`-Stufe
kombiniert `ehrgeizig`/`rachsüchtig` (erhöht Eskalationschance) und
`loyal`/`bescheiden` (erhöht Versöhnungschance) mit der aktuellen, live
aus World Memory berechneten Beziehung — ein Bruder mit starkem Claim,
aber Beziehung +75 und Loyalität 90 (Trait `loyal`) erreicht in
`canStartPassedOverHeirChain()` schon die Eligibility-Schwelle nicht
(Beziehung muss < -15 UND Loyalität < 45 sein) und rebelliert nicht
grundlos (§Punkt 37, per Test verifiziert — siehe unten).

**Savegame-Migration.** `SAVE_VERSION` 4 → 5. `migrateSaveV4ToV5()` legt
für alte Spielstände einen LEEREN `state.eventChains`-Speicher an (§Punkt
61/62: ausdrückliches Verbot retroaktiver Fiktion — nach dem Laden eines
alten Saves wird NICHT plötzlich behauptet, eine Krise liefe schon seit
Jahren) und ergänzt `character.appointedYear = null` (neues Feld für die
Amtsdauer-Prüfung der Korruptions-Kette — `null` bedeutet "unbekannt,
nicht blockierend", nicht "gerade erst berufen").

**Herrscherwechsel/Tod (§Punkt 58/59).** Ketten referenzieren "den
Herrscher" bewusst LIVE über `state.rulerId` statt einer eingefrorenen
ID — ein Herrscherwechsel überträgt eine laufende Geschichte dadurch von
selbst, ohne ID-Umschreibung (`notifyEventChainsOfSuccession()` in
`handleSuccession()` ergänzt nur einen nachvollziehbaren History-Eintrag).
Stirbt ein anderer Beteiligter, prüft `updateEventChains()` jedes Jahr
zuerst `chainParticipantsAlive()` und beendet die Kette sauber als
`EXPIRED` — keine Events über tote Charaktere.

**Test-Policies (§Punkt 72/73, NICHT die KI des fertigen Spiels).**
`resolvePendingEventWithPolicy(state, policy)` mit vier Policies
(`FIRST_OPTION`, `RANDOM_VALID_OPTION`, `CONCILIATORY`, `AGGRESSIVE`) —
alle 10 Chain-Templates sortieren ihre Optionen bewusst von großzügig zu
hart, wodurch "erste Option" = CONCILIATORY und "letzte Option" =
AGGRESSIVE eine sinnvolle Näherung sind, ohne dass Optionen einen eigenen
Metadaten-Tag brauchen. Nebenbefund beim Verdrahten: die bestehenden
Langzeittests (`ai_vs_ai_test.js`, `phase3_metrics_test.js`,
`baseline_analysis.js`, `economy_test.js`) hatten `state.pendingEvent`
zuvor NIE aufgelöst — reguläre Events waren dort seit jeher rein
dekorativ (ihre `apply()`-Effekte wurden nie tatsächlich angewendet). Da
`updateEventChains()` jetzt vor der EVENTS-Schleife läuft und diese nur
noch bei freiem `pendingEvent` startet, hätte eine unaufgelöste
Chain-Entscheidung ab ihrem ersten Auftreten ALLE weiteren Events/Ketten
einer Partie dauerhaft blockiert. Behoben, indem alle vier genannten
Headless-Tests nach jedem `advanceMonth()` `resolvePendingEventWithPolicy(state,
"FIRST_OPTION")` aufrufen — das aktiviert nebenbei erstmals auch die
`apply()`-Effekte der regulären Events in diesen Tests, was einzelne
Metriken (insbesondere die `no_heir`-Rate, siehe unten) spürbar
verschiebt.

**RNG-Auswirkung, ausdrücklich erlaubt (§Punkt 50/51/91).** Anders als
Phase 4 verbraucht Phase 5 bewusst neue `rnd()`-Aufrufe. Golden-Fixture
neu erzeugt (Phase-4-Fixture archiviert unter
`tests/fixtures/advance_year_snapshot_golden_phase4.json`). Die
`no_heir`-Rate in `phase3_metrics_test.js` sank spürbar (53 % → 20 % über
dieselben 30 Seeds) — per Vergleichslauf (Event Chains testweise
deaktiviert, aber mit derselben neuen Test-Policy) verifiziert, dass dies
ÜBERWIEGEND aus der oben beschriebenen erstmaligen Aktivierung reguläre
Event-Effekte in Headless-Tests stammt (ohne Chains: 37 % über dieselben
Seeds; mit Chains: 20 % — der Rest ist der erwartete
Schmetterlingseffekt aus zusätzlichem `rnd()`-Verbrauch, kein
Logikfehler). Keine der 10 Ketten greift mechanisch in
Heirat/Geburt/Tod des Herrschers ein.

**Neue Tests.** `tests/event_chain_test.js` (§Punkt 74-82, 10
Fallgruppen: positiver Charakter-Chain-Test, Negativtest gegen
grundlose Rebellion, Hunger-Test gegen künstliche Hungersnot,
Korruptions-Test gegen Automatismus, Determinismus, Save/Load mitten in
einer Kette, Chain-History, Memory-Erzeugung ohne Duplikate,
Beziehungswirkung — plus ein ergänzender Smoke-Test, der alle 10
Templates × jede Option synthetisch durchspielt, weil reines Passivspiel
nur 4 der 10 Ketten je erreicht) — alle grün.
`tests/phase5_event_chain_metrics_test.js` (30×100 Jahre, Policy
FIRST_OPTION, plus ein 15×100-Jahre-Vergleichslauf mit
RANDOM_VALID_OPTION): Ø 9,7 gestartete Ketten/Partie, 100 % friedliche
Lösung mit FIRST_OPTION vs. 61 %/39 % friedlich/eskaliert mit
RANDOM_VALID_OPTION (Beweis: das System KANN eskalieren, tut es aber
nicht zwangsläufig, §Punkt 24), Ø 1,85 chronikwürdige Chain-Ereignisse
pro Jahrzehnt, Ø Kettendauer 2,5 Jahre, ~126 ms/Partie (keine spürbare
Verschlechterung). Enthält außerdem 8 echte, aus der Simulation gezogene
Beispielgeschichten (§Punkt 98) im exakt geforderten Format ("1521 –
Hungerkrise", "1522 – buy_grain", "1524 – Die Versorgungslage hat sich
erholt."). Bestehende Regressionstests weiterhin grün.

**UI-Erweiterungen (kein Redesign, §Punkt 86/44-46).** Zwei neue
Debug-Panels: Event-Chain-Inspektor (alle Rohfelder inkl. History für
eine gewählte aktive/abgeschlossene Kette) und ein "warum (nicht)
gestartet?"-Prüfer, der für jedes der 10 Templates dieselbe
`checkEligibility()`-Logik wie der Runtime-Scheduler anzeigt (eine
Quelle der Wahrheit statt zweier Debug-Implementierungen). Die bestehende
Event-Anzeige selbst wurde NICHT verändert.

**Bewusst NICHT umgesetzt (§Punkt 100):** Drama Director, Story Threads
außerhalb dessen, was die Ketten intern brauchen, UI-Redesign, Kaiserwahl
2.0. Battle Engine (`battle-engine/*.js`, `js/battle-bridge.js`) technisch
unverändert.

## 2026-08-21 – Phase 6 (KAISERREICH-Next-Generation-Master-Prompt): Story Threads + Drama Director

Ziel: aus einzelnen Event Chains wird eine lebendige Kampagne. Zentraler
Grundsatz (§Punkt 2): der Drama Director ist KURATOR, NICHT AUTOR — er
erfindet keine Krisen, sondern priorisiert nur bereits plausible,
tatsächlich im Weltzustand vorhandene Entwicklungen.

**Story Threads (`js/story-threads.js`).** 8 Thread-Typen
(SUCCESSION_CONFLICT, PERSONAL_RIVALRY, ECONOMIC_CRISIS, FOOD_CRISIS,
FOREIGN_CONFLICT, RELIGIOUS_CONFLICT, IMPERIAL_AMBITION,
DYNASTIC_ALLIANCE), jeder mit genau einer `detect(state)`-Funktion, die
Signal-Kandidaten (Beteiligte/Regionen/Memories + grobe Anfangsstärke)
liefert — KEIN RNG (§Punkt 37/38): ein Thread existiert, weil seine
Voraussetzungen objektiv im Zustand vorhanden sind, nie per Würfel.
`discoverStoryThreads()` legt für noch nicht abgedeckte Kandidaten neue
Threads an, `advanceStoryThread()` bewertet jährlich Tension/Momentum/
Importance neu und führt die Statusmaschine DORMANT → BUILDING → ACTIVE
→ CLIMAX → AFTERMATH → RESOLVED (zusätzlich EXPIRED bei Tod eines
Beteiligten). Klimax entsteht rein aus Tension ≥ 80 (§Punkt 15: nie
erzwungen), Auflösung erfolgt automatisch, sobald das zugrunde liegende
Signal verschwindet — friedliche Enden (z. B. Versöhnung) sind genauso
häufig vorgesehen wie Eskalation.

**Dedup + Reaktivierung (§Punkt 12/33/34).** Neue Signale werden zuerst
gegen bereits bestehende Threads DESSELBEN Typs mit überlappenden
Beteiligten/Regionen abgeglichen (`findExistingThreadForCandidate()`) —
mehrere passende Memories derselben Person erzeugen nie mehrere fast
identische Threads. Ein DORMANT-Thread kann durch eine neue passende
Memory Jahre/Jahrzehnte später wieder auf BUILDING/ACTIVE springen
(generationenübergreifende Geschichten technisch möglich, ohne eigene
Haus-Rivalitäts-KI). Ein bereits RESOLVED-Thread bleibt bewusst terminal
— eine erneut relevante Familiengeschichte erzeugt einen NEUEN Thread
(§Punkt 35 "nicht zwingend derselbe Thread").

**Verknüpfung mit Event Chains (§Punkt 47-49).** `startEventChain()`
ruft jetzt `attachChainToThread()` auf (verknüpft mit einem bestehenden
oder neu erzeugten Thread anhand der Typ-Zuordnung
`CHAIN_THREAD_TYPE`), `endEventChain()` ruft `notifyThreadOfChainResolution()`
auf. Ein Thread kann mehrere Chains über Jahre sammeln (`thread.chainIds`);
die eigentliche Auflösungsprüfung übernimmt weiterhin `advanceStoryThread()`
im nächsten Zyklus anhand des dann bereits veränderten Weltzustands, nicht
die Chain-Auflösung selbst.

**Thread-Titel (§Punkt 51/52).** Vollständig dynamisch aus State generiert
(`generateThreadTitle()`) — keine Hardcodes, Namen kommen live aus
`state.characters`/`state.regions`.

**Drama Director (`js/drama-director.js`).**
`computeDramaTensionBreakdown()` ist eine additive, vollständig
konfigurierbare Formel (`CONFIG.drama.tensionWeights`, §Punkt 22/107 —
keine verstreuten Magic Numbers): Rivalitäten, niedrige Loyalität
einflussreicher Personen, ungeklärte Ansprüche, Hunger, schwache
Wirtschaft, Krieg, schlechte Beziehungen, Herrschergesundheit, unsichere
Erbfolge, aktive Event Chains, bevorstehende Kaiserwahl, religiöse
Spannung — jeweils POSITIV; Frieden, stabile Dynastie, volle
Kornspeicher, gute Wirtschaft, hohe Legitimität, hohe Loyalität, kürzlich
gelöste Krisen — jeweils NEGATIV. `state.drama.tensionBreakdown` macht
jede Komponente einzeln nachvollziehbar (§Punkt 21/22 "keine Blackbox").
Tension ist ausdrücklich KEINE Katastrophen-Wahrscheinlichkeit (§Punkt 18).

**Pacing (§Punkt 23/26/27).** Rein deskriptiv abgeleitet
(QUIET/BUILDING/HIGH_TENSION/CRISIS/RECOVERY) — beeinflusst NUR die
Priorisierung optionaler Chains, nie die physische Realität: Herrschertod,
echte Hungersnot und alle anderen system-kritischen Vorgänge laufen
komplett unverändert außerhalb des Director-Systems weiter (dieselben
Codepfade wie vor Phase 6). Ein `systemCritical: true`-Flag (bisher nur
auf `famine_crisis`) markiert die einzige system-kritische Event Chain —
sie wird im Recovery-Fenster nie zurückgestaffelt, alle 9 übrigen
(optionalen) Ketten können es.

**Fokus (§Punkt 28/29).** `computeFocusThread()` wählt deterministisch den
höchstbewerteten aktiven (nicht-dormanten) Thread, wechselt aber nur bei
klar höherer Dringlichkeit (`CONFIG.drama.focusSwitchThreshold`) oder wenn
der bisherige Fokus resolved/nicht mehr vorhanden ist — kein jährlicher
Wechsel.

**Chain-Priorisierung ohne Eligibility-Verletzung (§Punkt 41-46).** Phase
5s feste `CHAIN_PRIORITY_ORDER`-Reihenfolge für NEUE Chain-Starts wurde
durch `computeChainDirectorScore()` ersetzt (Basis 30, + Fokus-Bonus, +
anteilige Thread-Tension, + Jahre seit Thread-Aktivität, − Recovery-Malus
für optionale Ketten) — `collectEligibleChainCandidates()`
(js/event-chains.js) liefert dabei UNVERÄNDERT exakt dieselben
Eligibility-/Cooldown-/Bindungs-Kandidaten wie in Phase 5; der Director
wählt nur unter den bereits eligiblen aus, kann nie eine ineligible Kette
starten (§Punkt 42, per Test verifiziert). **Entscheidung zum
Phase-5-Zufallswurf (§Punkt 45/46, wie gefordert dokumentiert):** der
bestehende `rnd() < startChance`-Wurf ("startet die score-höchste Chain
dieses Jahr tatsächlich?") bleibt UNVERÄNDERT bestehen — er steuert seit
Phase 5 bewusst nur das TIMING innerhalb eines bereits plausiblen Jahres,
nicht die Auswahl selbst, und genau das empfiehlt der Auftrag ausdrücklich
("ein geringer RNG-Faktor darf eventuell Timing variieren"). Nur die
Auswahl, WELCHE Chain diesen Wurf überhaupt bekommt, ist jetzt
Score- statt Reihenfolge-basiert.

**Determinismus.** Thread Discovery und Drama Director selbst verbrauchen
nachweislich kein `rnd()`. Der bestehende Chain-Start-Wurf verschiebt sich
aber ggf. auf eine andere Chain als in Phase 5 (score- statt
reihenfolgebasiert), was den nachfolgenden Zufallsstrom verändern kann —
Golden-Fixture daher neu erzeugt (Phase-5-Fixture archiviert unter
`tests/fixtures/advance_year_snapshot_golden_phase5.json`).

**Savegame-Migration.** `SAVE_VERSION` 5 → 6. `migrateSaveV5ToV6()` legt
leere `state.storyThreads`/`state.drama`-Speicher an. Alte Memories
fließen ab dem nächsten Simulationsschritt ganz normal in die
Signal-Erkennung ein (das ist reales, bereits existierendes Material,
keine Fiktion, §Punkt 77) — aber `thread.startedYear` ist immer das
Jahr der ENTDECKUNG, nie rückwirkend behauptet (§Punkt 78:
`thread.memoryIds` kann auf deutlich ältere Memories verweisen als
`thread.startedYear`). Bestehende Event Chains aus Version 5 bekommen
`threadId: null`.

**Neue Tests.** `tests/story_thread_test.js` (§Punkt 80-84 + 2 Zusatzfälle:
Discovery, Negativtest — mit der wichtigen Klarstellung, dass "kein
Konfliktthread" nicht "gar kein Thread" bedeutet, da ein unverheirateter
Erbe objektiv weiterhin ein gültiges DYNASTIC_ALLIANCE-Signal ist —, Dedup,
Reaktivierung, Auflösung, Thread↔Chain-Verknüpfung, Zusammenfassung) — alle
grün. `tests/drama_director_test.js` (§Punkt 85-88 + die zwei zentralen
Anti-Cheat-Tests §116/117): akute Hungerkrise bekommt mindestens so hohe
Priorität wie ein optionaler Beraterstreit; Recovery-Fenster staffelt nur
optionale Ketten zurück; ein extrem stabiler, erfolgreicher Zustand erzeugt
niedrige Tension statt einer Bestrafung; ganz ohne plausible Voraussetzung
startet nichts, auch nach 30 Jahren Ruhe nicht; **§116 bestätigt**: ein
durchweg stabiler Zustand (reich, 95 Legitimität, volle Nahrung, kein
Rivale, gesicherte UND VERHEIRATETE Erbfolge, gute Beziehungen, Frieden)
erzeugt über 5 Jahre nachweislich keine einzige neue Chain und keinen
neuen Konfliktthread; **§117 bestätigt**: ein Zustand mit kranker
Herrschergesundheit, starkem Rivalen-Claim, alten Demütigungs-Memories,
niedriger Loyalität und schlechten Beziehungen erzeugt sofort hohe globale
Tension UND wird korrekt als Fokus-Thread erkannt. (Bemerkenswerter
Nebenbefund beim ersten §116-Testentwurf: ein unverheirateter erwachsener
Erbe bei guten Beziehungen ist selbst bei sonst perfekter Stabilität ein
objektiv gültiges, nicht-manufakturiertes DYNASTIC_ALLIANCE-Signal — exakt
das in §Punkt 67 ausdrücklich als legitime "ruhige Phase"-Entwicklung
genannte Beispiel "Eheverhandlung läuft", kein Bug. Der Test wurde
entsprechend mit einem bereits verheirateten Erben aufgesetzt, um wirklich
ALLE Signalquellen auszuschließen.)
`tests/phase6_story_metrics_test.js` (30×100 Jahre, FIRST_OPTION): Ø 13,8
gestartete Threads/Partie, Ø 1,69 gleichzeitig aktive Threads, 38 % der
simulierten Jahre mit Story-Überlappung (≥2 aktive Threads), Ø
Thread-Dauer 7,0 Jahre, 111 von 415 Threads erreichen mindestens einmal
CLIMAX, Pacing-Verteilung 64 % QUIET / 25 % RECOVERY / 10 % BUILDING / 0 %
HIGH_TENSION / 0 % CRISIS (erwartungsgemäß bei der durchgehend
großzügigen FIRST_OPTION-Politik — RANDOM_VALID_OPTION-Läufe aus Phase 5
zeigen bereits, dass echte Eskalation möglich ist), ~155 ms/Partie. Enthält
10 echte Kampagnen-Timelines und 5 vollständige Thread-Historien direkt
aus Simulationsdaten (§Punkt 96/97, nicht erfunden). Bestehende
Regressionstests weiterhin grün.

**Beobachtete Grenzen, ehrlich dokumentiert (§Punkt 98-Analyse).**
DYNASTIC_ALLIANCE dominiert mengenmäßig deutlich (210 von 415 Threads in
den Metriken) — unverheiratete erwachsene Verwandte sind einfach häufig,
die Erkennungsschwelle (Stärke ≥ 20) ist bewusst niedrig gehalten (§Punkt
10 verlangt nur "keine Kleinigkeiten", keine hohe Schwelle). Nur 11 von
415 Threads erreichen `importance >= 50` (Story Signal Ratio, §Punkt 101,
nur gemessen, nicht manipuliert). Thread-`resolution` unterscheidet aktuell
NICHT zwischen friedlichem Verblassen und eskalationsbedingtem Ende (immer
"RESOLVED"/"FADED", nie z. B. "ESCALATED") — die zugrunde liegenden Event
Chains selbst kennen diese Unterscheidung sehr wohl (RESOLVED/FAILED/
EXPIRED, siehe Phase-5-Metriken: 61 %/39 % friedlich/eskaliert unter
RANDOM_VALID_OPTION), sie wird nur noch nicht auf die Thread-Ebene
durchgereicht — als bewusst offener Punkt in CODE_AUDIT.md vermerkt statt
in dieser bereits sehr umfangreichen Phase zusätzlich vertieft.

**UI-Erweiterungen (kein Redesign, §Punkt 102/53/54).** Zwei neue
Debug-Panels: Story-Thread-Inspektor (alle Rohfelder + History für einen
gewählten Thread) und Drama-Director-Panel (globale Tension-Aufschlüsselung,
Pacing, Fokus-Thread, alle eligiblen Chains mit ihrem vollständigen
Director-Score). Die bestehende Event-/Spiel-Oberfläche wurde NICHT
verändert.

**Bewusst NICHT umgesetzt (§Punkt 119):** Kaiserwahl 2.0, komplettes
UI-Redesign, Kriegssystem-Erweiterung, politische Interessengruppen, neue
Waren. Battle Engine (`battle-engine/*.js`, `js/battle-bridge.js`)
technisch unverändert.

## 2026-08-23 – Phase 7 (KAISERREICH-Next-Generation-Master-Prompt): Narrative Calibration & Chronicle 2.0

Reine Kalibrierungs-Phase (§Punkt 1: KEINE Feature-Erweiterung) — macht aus
der bestehenden Simulation eine lesbare Dynastie-Geschichte, ohne neue
Spielsysteme. Kernarbeit: Thread-Importance neu berechnen, Thread-
Resolution strukturieren, und aus World Memory + Story Threads eine
selektierte "Dynasty Chronicle" ableiten, getrennt vom vollständigen
"World Log" (`state.chronicle`, bleibt unverändert bestehen).

**Importance 2.0 — Audit zuerst, dann Fix (§Punkt 2-7).** Ein erster
30×100-Jahre-Audit-Lauf bestätigte GENAU den in der Auftragsbeschreibung
genannten Missstand: alle 115 gemessenen `SUCCESSION_CONFLICT`-Threads
hatten exakt denselben Importance-Wert (43), alle 36
`PERSONAL_RIVALRY`-Threads ebenso (20) — keine Streuung innerhalb eines
Typs. Ursache gefunden: `computeThreadImportance()` prüfte
`thread.actorIds.includes(state.rulerId)`, aber der Herrscher wird per
Architekturentscheidung aus Phase 5/6 NIE in `actorIds` gespeichert
(immer live über `state.rulerId` referenziert) — der Bonus konnte für
genau die Thread-Typen, die strukturell IMMER den Herrscher betreffen, nie
greifen. Ersetzt durch `threadInvolvesRuler()`/`threadInvolvesHeir()`
(js/story-threads.js), die den Herrscher-/Erben-Bezug semantisch statt
über reine ID-Mitgliedschaft prüfen. Die neue Importance ist eine additive
Summe aus 12 einzeln benannten, nachvollziehbaren Komponenten (keine
Blackbox, §Punkt 6): Basis, Herrscher beteiligt, Thronfolger betroffen,
starker Anspruch, Rivalität, Krieg, Herrscherwechsel während der
Geschichte, wirtschaftlicher/Versorgungsschaden, Dauer (gedeckelt),
bedeutende Memories (gedeckelt), Kaiser-/Titelbezug, CLIMAX erreicht,
Event-Chains (gedeckelt) — abrufbar über `explainThreadImportance()` fürs
Debug-Panel. Zusätzlich behoben: `PERSONAL_RIVALRY`-Threads aus
`grieved_advisor`-Ketten verblassten strukturell nach genau 1 Jahr, weil
weder Memories noch der generische Signal-Detector eine frisch gestartete
Chain als gültiges Signal erkannten — `advanceStoryThread()` zählt eine
aktive angehängte Chain jetzt selbst als Signal.

**Vorher/Nachher (30×100 Jahre, FIRST_OPTION, identischer Audit-Aufbau):**
Threads mit `importance >= 50`: 11 von 415 (2,6 %, der in der
Auftragsbeschreibung genannte Ausgangsbefund) → 234 von 415 (56 %) nach
dem Fix, mit echter Streuung innerhalb jedes Typs (z. B.
`SUCCESSION_CONFLICT` vorher konstant 43, nachher Min 67/Max 100;
`DYNASTIC_ALLIANCE` Min 33/Max 63; `FOOD_CRISIS` Min 31/Max 80). Ehrlich
mitgemessen statt verschwiegen: `SUCCESSION_CONFLICT` liegt jetzt eher am
oberen Ende (Ø 95, 113 von 115 ≥ 75) — der Thread-Typ ist architektonisch
fast immer herrscher-/erben-relevant UND langlebig genug, um die
Dauer-/Memory-Komponenten auszureizen; keine künstliche Deckelung
eingezogen, um diese realen Werte zu verstecken.

**Resolution 2.0 (§Punkt 8-14).** `thread.resolution` ist jetzt ein
strukturiertes Objekt `{type, tone, outcome, year, primaryActorId,
consequences: [], sourceChainIds: []}` statt eines bloßen Strings.
`classifyThreadResolution()` (js/story-threads.js) leitet Typ/Ton
AUSSCHLIESSLICH aus bereits vorhandenen echten Daten ab, nie aus Würfeln:
Tod eines Beteiligten übersticht alles (DIED/TRAGIC), ein
FOREIGN_CONFLICT-Thread liest den tatsächlichen `state.warState`
(WAR/PEACE), sonst wird der letzte abgeschlossene Event-Chain-Ausgang über
`CHAIN_OUTCOME_RESOLUTION_MAP` (alle ~30 möglichen Chain-Ausgänge aus den
10 Templates) auf eine von 14 Typen (RECONCILED/ESCALATED/SUPPRESSED/
COMPROMISE/FAILED/SUCCESS/MARRIED/APPOINTED/EXILED/DIED/WAR/PEACE/
ABANDONED/NATURAL_END) und einen von 5 rein dramaturgischen (keine
moralische Wertung, §Punkt 10/42) Tönen (PEACEFUL/CONFLICT/TRAGIC/
TRIUMPHANT/AMBIGUOUS) abgebildet; ohne abgeschlossene Chain entscheidet
die aktuelle Beziehung zwischen Hauptakteur und Herrscher. Resolved
Threads bleiben unverändert vollständig in `state.storyThreads.resolved`
erhalten (kein Löschen).

**World Log / Dynasty Chronicle — Architekturentscheidung (§Punkt 15-27).**
Bewusst KEIN neuer, inkrementell gepflegter State-Zweig: das hätte 50+
bestehende `addChronicle()`-Aufrufstellen in praktisch jeder Datei
anfassen müssen — ein Umbaurisiko weit über den Rahmen dieser
Kalibrierungs-Phase hinaus. Stattdessen `computeDynastyChronicle(state)`
(neues `js/chronicle.js`), das die Dynasty Chronicle ON DEMAND aus bereits
strukturierten Quellen ABLEITET: World Memory + Story-Thread-
Zusammenfassungen. World Log = `state.chronicle` selbst, bleibt
unverändert vollständig (Wetter, Routine, alles). Diese Architektur
erfüllt §18 ("kein Wetter in der Dynasty Chronicle") automatisch, ohne
Text zu parsen: reines Wetter erzeugt strukturell NIE eine Memory — nur
Hungerkrisen mit echten Toten tun das (`FAMINE`, ab 1 % hungerbedingter
Sterblichkeit, js/memory.js, unverändert aus Phase 4). Damit ist auch §68
("Wetter MIT echten Folgen darf Teil der Geschichte sein") automatisch
erfüllt: eine echte Hungerkrise erzeugt bereits eine `FAMINE`-Memory,
unabhängig vom Wettertext selbst.

Zwei Aufnahme-Pfade (§Punkt 19-22): `ALWAYS_CHRONICLE_MEMORY_TYPES`
(RULER_DIED, SUCCESSION, HEIR_BORN, TITLE_GAINED, WAR_DECLARED,
PEACE_SIGNED, DYNASTY_ENDED — immer aufgenommen, unabhängig vom Score) und
SCORED CHRONICLE (`computeChronicleScoreBreakdown()`: Memory-Bedeutsamkeit
+ Herrscher-beteiligt-Bonus + Thronfolger-beteiligt-Bonus +
Thread-Zugehörigkeits-Bonus, additiv über `CONFIG.chronicle`, Schwelle
`scoredThreshold: 45` — keine feste 50-Punkte-only-Regel, §Punkt 22).
Dedup (§Punkt 87/88): eine Memory, die bereits Teil einer bedeutsamen,
abgeschlossenen Thread-Zusammenfassung ist (`importance >=
threadSummaryThreshold: 50`), erscheint NICHT zusätzlich einzeln —
außer sie ist selbst Always-Chronicle-würdig (ein Herrschertod bleibt
sichtbar, auch wenn er zufällig Teil eines Threads war). Kein harter
200er-Deckel (der alte Cap ließ Wetter echte Geschichte verdrängen) — das
World Log wird ohnehin nie gekürzt, die Dynasty Chronicle ist durch die
Selektion selbst schon klein genug.

**Zwei neue Memory-Hooks, die vorher fehlten.** Ein Kaiserwahl-Sieg
erzeugte bisher KEINE Memory (nur einen Chronik-String) —
`resolveElection()` (js/politics.js) erzeugt jetzt `TITLE_GAINED`. Das
Aussterben der Dynastie (kein Erbe) ebenso — `handleSuccession()`
(js/population-dynasty.js) erzeugt jetzt `DYNASTY_ENDED` (neuer, einziger
neuer Memory-Typ dieser Phase) mit einem informativeren Chronik-Text
("Mit dem Tod X im Jahre Y erlosch das Haus Z in direkter Linie." statt
"Die Dynastie ... stirbt ohne Erben aus."). Ohne diese beiden Hooks hätte
Dynasty Chronicle 2.0 zwei der wichtigsten denkbaren Abschlusspunkte einer
Dynastie-Geschichte gar nicht finden können.

**Ruler Eras / Herrscherbiografie (§Punkt 28-33/72-75).**
`getRulerEras(state)` rekonstruiert die vollständige Herrscherfolge
AUSSCHLIESSLICH aus bereits vorhandenen `SUCCESSION`-Memories — kein neuer
persistenter Herrscher-Historie-State nötig. `getChronicleForRuler(state,
rulerId)` filtert die Dynasty Chronicle auf den Zeitraum einer Ära.
`buildRulerBiography()`/`formatRulerBiography()` liefern eine
templatebasierte Regierungszusammenfassung (Name, Regierungsjahre,
Highlights aus der echten Chronik, Bevölkerung/Staatskasse
vorher→nachher). Vorher/Nachher-Werte kommen aus `snapshotRulerEraStart()`
— aufgerufen bei `newGame()` und bei jeder `handleSuccession()`. Bewusst
NUR Start-Snapshots nötig: das Ende von Regent A ist derselbe Zeitpunkt
wie der Start von Regent B (Nachfolge geschieht ohne Zeitversatz), also
liefert B's Start-Snapshot bereits A's Endwerte, ohne eine zweite
Snapshot-Quelle zu brauchen. Für Altspielstände/historische Regenten ohne
Snapshot bleibt das Feld explizit `null` statt eines erfundenen Wertes
(§Punkt 75 "keine falsche Exaktheit").

**Dynasty Milestones & Dynasty Summary (§Punkt 34-35/76-79).**
`computeDynastyMilestones()`: erster Titelaufstieg je Titelstufe (aus
`TITLE_GAINED`-Memories), höchste Bevölkerung/Staatskasse/größtes
Territorium (`state.stats.maxPopulation/maxTreasury/maxLand` — `maxLand`
ist neu, wird analog zu den beiden bestehenden Trackern in
`js/advance-year.js` mitgeführt), längste Regentschaft (aus
`getRulerEras()`). `computeDynastySummary()`: Anzahl Herrscher/
Generationen, größte Krise/bedeutendster Krieg/wichtigste Rivalität —
ALLE drei ausschließlich über Story-Thread-`importance` ermittelt (nie
über Flavor-Text, §Punkt 79), höchster Titel, Bevölkerungs-/
Wohlstandsspitzen, Anzahl bedeutender Ehen, `no_heir`-Endstatus. Reine
Analyse ohne neue Spielwirkung.

**Policy-Vergleich (§Punkt 43-49).** Neue Test-Policy `HARDLINE` in
`resolvePendingEventWithPolicy()` (js/event-chains.js) — bewusst ein
semantischer Alias von `AGGRESSIVE` (immer die härteste/letzte Option),
nur unter dem im Auftrag verlangten Namen, ohne die 10 Chain-Templates mit
eigenen CONCILIATORY/PRAGMATIC/HARDLINE/RISKY-Metadaten-Tags umzubauen
(§Punkt 46 "ohne großen Umbau", die bestehende großzügig→hart-Sortierung
der Optionen reicht für einen klar messbaren Policy-Unterschied). 30×100
Jahre je Policy bestätigen die Vermutung aus dem Auftrag: FIRST_OPTION und
CONCILIATORY sind mit Index 0 identisch (64 % QUIET, 0 % HIGH_TENSION/
CRISIS, 211 friedliche/0 konfliktorientierte Thread-Resolutions) — das
ist ein reines POLICY-Artefakt der immer-großzügigsten Auswahl, keine
verdeckte Balance-Schwäche. RANDOM_VALID_OPTION (13,70 Threads/Partie,
111 friedlich/8 konfliktorientiert) und besonders HARDLINE (8,53
Threads/Partie — Ketten enden häufiger vorzeitig eskaliert statt sich
über mehrere Stufen zu entwickeln —, nur 2 friedlich/13
konfliktorientiert, `no_heir`-Rate 53 % statt 20 %) zeigen deutlich mehr
Eskalation/Anspannung. Siehe `tests/phase7_chronicle_metrics_test.js` für
die vollständige Tabelle.

**Trade-Off-Audit der 10 Event Chains (§Punkt 50-52, rein lesende
Code-Analyse, keine automatisierte Messung nötig — die Kosten stehen
direkt im Code).** Mit echten, dokumentierten Kosten auf der großzügigsten
Option: `famine_crisis` (-600 Taler für "Korn kaufen"), `trade_conflict`
(dauerhafte Zollsenkung bzw. -250 Taler Sonderprivileg), `church_conflict`
(-200 Taler volles Zugeständnis), `dynastic_marriage` (-300 Taler höhere
Mitgift), `corrupt_treasurer` (öffentliche Anklage ohne Beweis kostet
Prestige — echtes Risiko, kein Freifahrtschein). Ohne jeden
Taler-/Ressourcenpreis auf allen Optionen, aber ohne klar bewiesene
Dominanz (die Optionen unterscheiden sich in ANDEREN Dimensionen —
Amt vs. keine Beziehung, Prestige vs. Diplomatie): `rising_rival`,
`imperial_ambition`, `passed_over_heir` (großzügigste Option "Amt
anbieten" ist kostenlos). Da keine der 10 Ketten eine Option zeigt, die in
JEDER Dimension einer anderen strikt überlegen ist, bleibt es laut
§Punkt 51/52 bei der Dokumentation — keine CONFIG-/Wirtschaftssystem-
Änderung.

**Chronicle Debug Panel (§Punkt 56-58).** Vier neue, rein funktionale
Debug-Ansichten (kein visuelles Redesign, §Punkt 80-82): Chronik-
Kandidaten (Memory/Immer-chronikwürdig?/Score-Aufschlüsselung/
Aufgenommen?/Warum — nutzt `explainChronicleCandidate()`, dieselbe Logik
wie `computeDynastyChronicle()` selbst), Dynasty-Chronicle-Ansicht,
Herrscher-Chronik/Biografie-Ansicht, Dynasty-Summary/Meilensteine-Ansicht.

**Savegame-Migration.** `SAVE_VERSION` 6 → 7. `migrateSaveV6ToV7()`
klassifiziert bereits abgeschlossene Phase-6-Threads (deren `resolution`
noch ein reiner String war) NACHTRÄGLICH über dieselbe
`classifyThreadResolution()`-Funktion neu — das ist KEINE Fiktion: die
Funktion liest ausschließlich bereits real gespeicherte Fakten
(abgeschlossene Chains, aktuelle Beziehungen), mit dem ursprünglichen Jahr
aus der Thread-Historie statt dem Migrationsjahr, und bewahrt den
ursprünglichen String zusätzlich als `resolution.legacyLabel`.
`state.rulerEraSnapshots` wird als LEERES Objekt angelegt — kein
erfundener Vorher-Wert für bereits vergangene Regentschaften (§Punkt 75).

**Determinismus & Performance (§Punkt 62/64).** Importance 2.0, Resolution
2.0 und die gesamte Chronicle-2.0-Ableitung verbrauchen nachweislich
keinen `rnd()`-Aufruf (per Test bestätigt: `__rngCalls` unverändert vor/
nach `computeDynastyChronicle()`/`computeDynastySummary()`/
`computeDynastyMilestones()`, und wiederholte Aufrufe liefern
byte-identische Ergebnisse). Kein `AI`-Texterzeugung — vollständig lokal,
deterministisch, templatebasiert. Zwei neue `recordWorldEvent()`-Aufrufe
(TITLE_GAINED bei Kaiserwahl-Sieg, DYNASTY_ENDED bei ausgestorbener
Dynastie) verschieben den nachfolgenden RNG-Fingerprint bzw. Chronik-Text
— Golden-Fixture daher neu erzeugt, Phase-6-Fixture archiviert unter
`tests/fixtures/advance_year_snapshot_golden_phase6.json`. Keine neue
O(n²)-Vollhistorienabfrage pro Jahr: `computeDynastyChronicle()` wird nur
bei Bedarf (Debug-Panel/Metriken) aufgerufen, nicht bei jedem
`advanceYear()`.

**Neue Tests.** `tests/chronicle_test.js` (§Punkt 86-89, Regressionstests:
Importance Breakdown, Resolution Mapping, Always/Scored Chronicle, Wetter
ausgeschlossen, echte Wetterkrise eingeschlossen, Herrschertod in Chronik,
Thread-Summary + Dedup, Ruler Era Query, Save Migration v6→v7,
Determinismus, Herrscherbiografie — 33 Prüfungen, alle grün).
`tests/phase7_chronicle_metrics_test.js` (§Punkt 65-70/97/98): 30×100
Jahre World Log vs. Dynasty Chronicle — Ø 189,8 World-Log-Zeilen/Partie
(64 % Wetteranteil, unverändert) vs. Ø 30,1 Dynasty-Chronicle-Einträge/
Partie (3,01 pro Jahrzehnt, 0 % Wetteranteil), 62 Herrschertode/55
Thronfolgen/33 Krisen/265 Thread-Zusammenfassungen über 30 Partien;
Policy-Vergleich (s. o.); ein vollständiges Dynasty-Summary-Beispiel; und
**§Punkt 98, der entscheidende Test**: 5 vollständige, echte
100-Jahre-Dynastie-Chroniken direkt aus Simulationsdaten. Ergebnis lesbar
als tatsächliche Dynastiegeschichte — Beispiel aus Seed 701: Heirat →
Kind → vier Hungerkrisen in Folge → Herrschertod → übergangener Bruder bei
der Nachfolge → Rivalität entsteht → Amt zugestanden → Versöhnung
angeboten → "Der Streit mit Ludwig von Kaisersberg" schließt RECONCILED/
PEACEFUL → weitere Ehen der nächsten Generation. Alle bestehenden
Regressionstests weiterhin grün (bis auf die bekannte, unseeded
`economy_test.js`-Flakiness, unverändert seit Phase 4).

**Ehrlich mitgemessen, bewusst NICHT gefixt (§Punkt 83-85).** Die
`no_heir`-Rate bleibt bei ca. 20 % unter FIRST_OPTION im 100-Jahre-Lauf
dieser Phase (RANDOM_VALID_OPTION 33 %, HARDLINE 53 % — Ketten-Eskalation
wirkt sich sichtbar auf die Erbfolgesicherheit aus) — wie im Auftrag
verlangt nur gemessen, nicht korrigiert; das ist eine bewusst separate,
spätere Entscheidung.

**UI-Erweiterungen (kein Redesign, §Punkt 80-82).** Vier neue
Chronicle-Debug-Panels (s. o.). Die bestehende Event-/Spiel-Oberfläche
wurde NICHT verändert; einzige Korrektur an der bestehenden Story-Thread-
Debug-Anzeige: `thread.resolution` wird jetzt als `TYPE (TONE)` statt als
rohes Objekt dargestellt (Resolution 2.0 hat die Feldform geändert).

**Bewusst NICHT umgesetzt (§Punkt 97 STOPP):** Kaiserwahl 2.0,
Kriegssystem-Erweiterung, politisches Interessengruppensystem, neue
Waren, große Weltkartenerweiterung, finales Renaissance-/Comic-UI-
Redesign (folgt erst nach expliziter Freigabe als Phase 8). Battle Engine
(`battle-engine/*.js`, `js/battle-bridge.js`) technisch unverändert.

## 2026-08-23 – Phase 8A (KAISERREICH-Next-Generation-Master-Prompt): Visual Identity — Design System

Erste, bewusst kleine Teilphase von Phase 8 ("Historical Graphic Novel ×
Modern Grand Strategy × Renaissance 1500", §115-118 verlangt ausdrücklich
gestufte Teilphasen statt eines Großbangs). Vollständiger Ablauf +
Wireframes + Screen-Inventar in `UI_REDESIGN.md`.

**Audit zuerst.** `index.html` hat genau einen `<style>`-Block (~385
Zeilen) mit einem bereits vorhandenen Tokens-Ansatz (`:root { --bg;
--panel; --ink; --accent; --gold; ... }`), der aber inhaltlich das jetzt
ausdrücklich verbotene "Comic-Mittelalter"-Schema trug (Luckiest-Guy-
Zierschrift, knallige Primärfarben, harte Sticker-Schatten). Entscheidender
Befund: JS-generierte Panels referenzieren fast durchgängig `var(--x)`
statt hartkodierter Hex-Werte (nur vereinzelte Kartendekorations-/
Debug-Rahmenfarben ausgenommen) — ein reines Werte-Update in `:root`
reskinnt dadurch fast die GESAMTE Oberfläche automatisch, ohne
Render-Funktionen anzufassen.

**Design System (Farben/Typografie/Abstände/Radien/Schatten/Z-Index/
Buttons).** Variablennamen bewusst unverändert (werden aus JS-
Template-Strings referenziert), nur Werte ersetzt: Burgunderrot/
Waldgrün/Nachtblau/Elfenbein/Anthrazit/Bronze/gedämpftes Gold als
Primärpalette, Ocker/Umbra/gedecktes Rot/entsättigtes Blau/Oliv als
Sekundärpalette, plus fünf eigene Bedeutungsfarben-Tokens
(`--c-positive/-danger/-prestige/-diplomacy/-economy`), bewusst getrennt
von den Deko-Tokens (§7). Typografie: `Cormorant Garamond` (Display,
Serif, historisch-seriös statt Fraktur) + `Source Sans 3` (UI), beide via
Google Fonts mit sicherem lokalem Fallback-Stack (Georgia/System-Sans),
falls kein Netzzugriff. Rundungen von "Comic-rund" (10–20px) auf gediegen
(4–10px) reduziert. Harte `Npx Npx 0`-Comic-Schatten durch drei
weichgezeichnete Schatten-Tokens ersetzt. Neues Z-Index-Tokensystem
(`--z-map/-hud/-panel/-tooltip/-overlay-battle/-overlay-warmap/-modal/
-notification/-debug`) ersetzt verstreute literale Werte, Werte bewusst
identisch zu vorher gewählt (keine Stapelreihenfolgen-Änderung). Neue
Button-Varianten `.btn-primary/-danger/-ghost/-imperial` ergänzen den
bestehenden nackten `button`-Selektor (bleibt der sichere Secondary-
Default für jede bestehende Instanz ohne eigene Klasse) — `.btn-primary`
exemplarisch auf die einzige eindeutige Hauptaktion angewendet
(`#btnAdvance`, "Monat vergehen lassen"); Debug-Panel-Buttons bewusst
NICHT umklassifiziert (§146 "Debug bleibt Debug").

**Verifiziert per Screenshot** (Playwright/Chromium, vier Bildschirme:
Titel, Charaktererstellung, Hauptspiel/Hof, Berater sowie ein
Event-Modal) — durchgängig kohärente Renaissance-Anmutung ohne
Comic-Elemente, Kontraste intakt, Primary-Button klar erkennbar.

**Bewusst NICHT Teil dieser Teilphase (siehe Screen Inventory in
UI_REDESIGN.md):** die strukturellen Neubauten aus §10-58/76-82
(Karten-Hauptbildschirm, Charakterportraits, Stammbaum-Ansicht,
Story-Thread-Spieler-UI, Chronik-als-Buch) — das sind eigene, spätere
Teilphasen (8B–8H), deren gleichzeitige Umsetzung genau den in §116
verbotenen Großbang darstellen würde. Kein einziger `js/*.js`-Quelltext
geändert — reine `index.html`-Änderung (Tokens + eine Button-Klasse),
kein Bundle-Rebuild nötig. Bundle-Größe 589.045 → 592.280 Bytes (+0,5%,
nur CSS-Tokens/Kommentare). Alle Tests weiterhin grün (außer der
bekannten unseeded `economy_test.js`-Flakiness), keine neuen
`rnd()`-Aufrufe, Battle Engine unverändert (bestätigt per Diff),
Savegames unverändert (keine neue SAVE_VERSION nötig, da keine
State-Struktur geändert wurde).
