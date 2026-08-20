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
