# STATUS-ANALYSE gegen den Master-Prompt

Diese Datei prüft den aktuellen Entwicklungsstand von KAISERREICH gegen
**jeden** der 105 Abschnitte des ursprünglichen Master-Prompts. Legende:

- ✅ erledigt / erfüllt
- 🟡 teilweise erledigt (vereinfachte oder unvollständige Umsetzung)
- ❌ noch nicht begonnen

Stand: nach Abschluss von MVP + Alpha + Beta (siehe ROADMAP.md).

---

## Teil A: Konzept & Vision (§1–5, §93–105)

| § | Thema | Status | Anmerkung |
|---|---|---|---|
| 1 | Rolle/Auftrag | ✅ | Als Leitlinie durchgehend befolgt |
| 2 | Grundidee (freie Wege zur Macht) | 🟡 | Wirtschaft, Diplomatie, Militär, Dynastie als Wege vorhanden; Kultur- und Technologie-Wege fehlen komplett |
| 3 | Unvorhersehbarkeit/Kettenreaktionen | 🟡 | Einzelne Ketten existieren (Wetter→Ernte→Zufriedenheit→Rebellion; Steuern→Unzufriedenheit; Diplomatie→Krieg), aber die volle Beispielkette (Schmuggel, Banditentum, Patrouillen) fehlt |
| 4 | Spielzeit/Kampagnenlängen | ❌ | Keine wählbare Kampagnenlänge, keine Geschwindigkeits-/Detaileinstellung |
| 5 | Historischer Rahmen | 🟡 | Start 1500 fix, keine alternativen Startjahre |
| 93 | Projektziel (Mischform) | 🟡 | Wirtschaft+Strategie+Dynastie+Aufbau vorhanden, "politisches Rollenspiel" (Hof-Intrigen zwischen NPCs) fehlt |
| 94 | Emotionaler Kern | 🟡 | Ansatzweise durch Chronik/Dynastie/Kriege erreicht, aber ohne Musik/Atmosphäre/Grafik noch dünn |
| 95 | Konkreter Auftrag (Schritte 1–15) | ✅ | Tech-Stack-Entscheidung, Ordnerstruktur, Datenmodelle, GameState, Zeitmodell, Wirtschaftsformeln, erster Prototyp — alles erledigt |
| 96 | Eigenständig entscheiden | ✅ | Durchgehend befolgt, Entscheidungen in DEVELOPMENT.md dokumentiert |
| 97 | Codequalität | 🟡 | Modular über Kommentarblöcke getrennt, aber `sim.js` (822 Zeilen) und `index.html` (645 Zeilen) wachsen — echte Datei-Modularisierung steht noch aus |
| 98 | DEVELOPMENT.md | ✅ | Laufend gepflegt |
| 99 | GAME_DESIGN.md | 🟡 | Existiert, aber seit dem MVP-Stand nicht mehr aktualisiert — veraltet gegenüber Alpha/Beta-Systemen |
| 100 | ROADMAP.md | ✅ | Laufend gepflegt (MVP/Alpha/Beta abgehakt) |
| 101 | Prioritäten | 🟡 | Informell befolgt, nie explizit gegengeprüft |
| 102 | Keine Fake-Komplexität/echte Simulation | ✅ | Alle angezeigten Werte stammen aus echten Berechnungen (mit Wirtschaftstest verifiziert) |
| 103 | Architektur für Erweiterungen | 🟡 | Daten von Code getrennt (gut für Mods), aber kein Multiplayer-/Steam-/Achievement-Grundgerüst |
| 104 | Erster testbarer Spielloop | ✅ | Vollständig umgesetzt und spielbar |
| 105 | Abschließende Vision | 🟡 | Grundprinzip ("Pixel außen, moderne Welt innen") umgesetzt, aber visuelle/akustische Tiefe noch weit vom Anspruch entfernt |

---

## Teil B: Herrscher, Dynastie, Titel (§8–12, §42–45)

| § | Thema | Status | Anmerkung |
|---|---|---|---|
| 8 | Spielstart/Charaktererstellung | 🟡 | Erstellungsbildschirm mit Name/Geschlecht/Dynastiename/Schwierigkeit/2 Traits umgesetzt; Wappen und mehrere Startregionen fehlen weiterhin (nur 1 Region spielbar) |
| 9 | Charaktersystem | 🟡 | 6 Werte (Int/Dip/Verw/Mil/Han/Cha) statt vollständiger Liste (fehlen: Intrige, Bildung, Religion, Loyalität, Ehrgeiz, Moral); 10 Traits statt ~20 aus der Spec |
| 10 | Dynastiesystem | 🟡 | Heirat, Kinder, Altern, Tod, Erbfolge (inkl. Streit) funktionieren; fehlen: Krankheit/Verletzung, Affären, uneheliche Kinder, Freundschaften/Rivalitäten, Verschwörungen |
| 11 | Adelstitel | ✅ | 10-stufige Leiter mit Mehrfachbedingungen (Bevölkerung, Wohlstand, Prestige) |
| 12 | Kaiserwahl | ✅ | Implementiert: Kurfürstenstimmen (3 bekannt + 4 abstrakt), Bestechung, Sieg/Niederlage-Konsequenzen |
| 42 | Berater | ✅ | 6 Ämter mit echten Gameplay-Effekten (Schatzmeister, Marschall, Diplomat, Spionagemeister, Geistlicher, Handelsberater) |
| 43 | Hof (politische Ebene) | 🟡 | Nur Berater-Ämter vorhanden; einfacher Adel ohne Ämter, keine Machtkämpfe um Positionen |
| 44 | Prestige | ✅ | Vollständig implementiert, viele Quellen und Senken |
| 45 | Legitimität | ✅ | Implementiert, beeinflusst Rebellion/Thronfolge/Zufriedenheit |

---

## Teil C: Bevölkerung & Wirtschaft (§13–28)

| § | Thema | Status | Anmerkung |
|---|---|---|---|
| 13 | Bevölkerungsgruppen | ✅ | Alle 10 geforderten Gruppen umgesetzt (Bauern, Landarbeiter, Handwerker, Bürger, Händler, Adel, Geistliche, Soldaten, Tagelöhner, Arme), jede mit eigenem Warenbedarf |
| 14 | Bevölkerungsentwicklung | 🟡 | Geburten/Tode/Hunger/Seuche vorhanden; keine Migration zwischen Regionen |
| 15 | Wirtschaft (Angebot/Nachfrage) | ✅ | Vollständig implementiert und getestet |
| 16 | Waren | ✅ | 23 Waren umgesetzt, inkl. Papier/Bücher/Schmuck/Seide/Glaswaren |
| 17 | Produktionsketten | ✅ | 23 Ketten; zwei echte zweistufige Ketten (Holz→Papier→Bücher, Getreide→Mehl→Brot über eigene neue Gebäude Kornmühle/Bäckerei) |
| 18 | Landwirtschaft | 🟡 | Fruchtbarkeit × Wetter wirkt; Technologie/Werkzeuge/Kriegsschäden/Krankheit als Einflussfaktoren fehlen |
| 19 | Wetter | ✅ | Regional simuliert, keine globale Zufallszahl |
| 20 | Handel (Straßen/Flüsse/Seewege) | 🟡 | Lokaler Marktplatz + gezielter Regionalhandel (Arbitrage zwischen zwei Regionen) mit Transportkosten und Räuberrisiko vorhanden; nur konkrete Straßen/Flüsse/Seewege als geografisches Wegenetz fehlen noch |
| 21 | Händler-KI | ✅ | Vereinfachte, aber funktionierende Version (Preisgefälle-Abbau zwischen Regionen) |
| 22 | Staatsfinanzen | 🟡 | Eine Staatskasse vorhanden; keine getrennte Privatschatulle der Dynastie, Einnahmen/Ausgaben-Kategorien vereinfacht |
| 23 | Steuern | ✅ | Wirken spürbar auf Zufriedenheit, Wirtschaft, Rebellion |
| 24 | Staatsschulden | ✅ | Kredite mit prestige-/legitimitätsabhängigem Zinssatz, Rückzahlung, jährliche Zinsfälligkeit |
| 25 | Stadtentwicklung (Weiler→Kaiserstadt) | ✅ | 8 Stufen, abhängig von Bevölkerung UND Infrastruktur, mit Chronik-Eintrag und Zufriedenheitsbonus |
| 26 | Bauwerke | 🟡 | 25 Typen (inkl. Kirche/Kloster/Universität/Palast/Weingut u.a.), mehrfach baubar + ausbaubar, echte Baustoffe; nur noch Hafen/Gericht/Burg/Schloss/Bibliothek/Kathedrale fehlen; keine mehrphasigen Bauzeiten |
| 27 | Infrastruktur | 🟡 | Straßen als vereinfachtes Ausbaulevel (0-6) implementiert, erhöht Handel & Produktion, Voraussetzung für Stadtentwicklung; Brücken/Häfen/Kanäle als separate Elemente fehlen weiterhin |
| 28 | Technologie | ✅ | 5 Kategorien mit Forschungspunkten aus Universität, Boni in Produktion/Militär/Steuern/Handel wirksam |

---

## Teil D: Diplomatie, KI, Militär, Intrigen (§29–37, §46–48)

| § | Thema | Status | Anmerkung |
|---|---|---|---|
| 29 | Diplomatische Aktionen | ✅ | 12 von 12 Aktionen umgesetzt (zuletzt: Durchmarschrecht mit echter Handelsanbindung, Garantie, Friedensvertrag, Gebietsforderung) |
| 30 | Beziehungssystem | ✅ | -100..+100, viele Einflussfaktoren, "Erinnerung" durch persistenten Wert |
| 31 | KI-Herrscher | 🟡 | Einfache Heuristiken (Bauverhalten, Diplomatie-Initiative); jede KI-Region hat jetzt einen individuellen, benannten Hauptmann mit eigenen Werten, der über mehrere Schlachten hinweg besteht (Erfahrung wächst, Tod führt zu einem Nachfolger) — aber weiterhin keine echte Herrscher-Persönlichkeit/Risikoprofil/Chancen-Risiko-Abwägung vor Kriegserklärungen (KI erklärt selbst nie Krieg) |
| 32 | Intrigen | 🟡 | Nur Sabotage vorhanden; Gerüchte, Erpressung, Verschwörung, Dokumentenfälschung, Rebellenunterstützung, politische Manipulation fehlen |
| 33 | Militär (Truppentypen) | 🟡 | Rekrutierung: 7 Hauptspiel-Typen (Vasall-vs-Söldner-Unterscheidung, jetzt inkl. Pikeniere und Schwerer Kavallerie); Kampfebene: eigene Kampf-Engine mit 7 Einheitentypen (Infanterie/Bogen/Kavallerie/Artillerie/Miliz/Pikeniere/Schwere Kavallerie), mit echter individueller Moral/Erfahrung/Disziplin pro Einheit; Pikeniere kontern (schwere) Kavallerie als historischer Hartkonter |
| 34 | Armeeversorgung | 🟡 | Unterhaltskosten (Geld) + Söldner-Fahnenflucht bei ausbleibendem Sold/niedriger Legitimität; in der Kampf-Engine zusätzlich Fatigue-Feld vorbereitet (noch ungenutzt); keine Nahrungsversorgung/Krankheit/Plünderung |
| 35 | Schlachtsystem | ✅ | Eigenständige Kampf-Engine vollständig integriert: 6 Kampfphasen, 5 Formationen + 7 Taktiken, Schere-Stein-Papier-Konter, 6 Geländearten, 5 Wettertypen, Moralsystem mit Fluchtmechanik, Kommandanten-Ereignisse, Entscheidungspunkte während der Schlacht, deterministischer Seed, Debug-Modus, 6 automatisierte Tests — kein reiner Stärkevergleich mehr |
| 36 | Belagerungen | ✅ | Mehrjährige Belagerung UND Kampf-Engine kombiniert: Sturmangriff eröffnet die volle interaktive Schlacht, Aushungern schwächt die spätere Kampf-Engine-Armee real (Soldaten + Moral), Bestechung weiterhin möglich |
| 37 | Rebellionen mit Ursachen | ✅ | Implementiert: erfordert niedrige Zufriedenheit UND niedrige Legitimität, nicht zufällig |
| 46 | Religion als politische Kraft | 🟡 | Eine Kennzahl (`religiousInfluence`) + 2 Ereignisse; kein Konfessionssystem, keine Bischöfe/Papst/Reformbewegungen |
| 47 | Siegbedingungen | 🟡 | 5 wählbare Ziele bei Charaktererstellung (Kaiser/Reichtum/Handelsmacht/Militär/Endlos); kulturelle Dominanz und historische Herausforderungen fehlen weiterhin |
| 48 | Schwierigkeitsgrade | ✅ | 4 Stufen, wirken über KI-Fehlerquote/Bautempo/Spionagegenauigkeit statt versteckter Ressourcenboni — exakt wie gefordert |

---

## Teil E: Events, Information, Chronik (§38–41, §61–63, §83–85)

| § | Thema | Status | Anmerkung |
|---|---|---|---|
| 38 | Event-System (Architektur) | ✅ | Modular: Trigger/Bedingung/Text/Optionen/Konsequenzen — genau wie gefordert |
| 39 | Beispielereignis "Kornspeicher leer" | ✅ | 1:1 aus der Spec übernommen und implementiert |
| 40 | Ereigniskategorien | 🟡 | Abgedeckt: Wirtschaft, Dynastie (implizit), Diplomatie-Flavor, Verbrechen, Religion, Gesellschaft; fehlen als eigene Kategorien: Wissenschaft, Krieg-Ereignisse, dedizierte Naturkatastrophen-Serie, Politik, persönliche Ereignisse |
| 41 | Informationsunsicherheit | ✅ | Gegnerische Stärke wird als Spanne angezeigt, Genauigkeit über Spionage verbesserbar |
| 61 | Statistiken | 🟡 | Basis-Tabellen (Preise, Bevölkerung, Armee) vorhanden; keine Verlaufsgrafiken/Trends |
| 62 | Chronik | ✅ | Automatisch geschriebene Ereignisliste, wächst mit dem Spiel |
| 63 | Emergentes Storytelling | 🟡 | Ansätze vorhanden (Heirat+Krieg+Erbfolge verweben sich bereits), aber noch nicht so reichhaltig wie das Spec-Beispiel |
| 83 | "Warum passiert etwas" (Aufschlüsselung) | ✅ | Bevölkerungs- und Preisänderungen werden vollständig in Einzelursachen aufgeschlüsselt (als Tooltip) |
| 84 | Tooltip-Prinzip | 🟡 | CSS-Tooltip-System umgesetzt, angewendet auf Preise/Bevölkerung/Kasse/Prestige; noch nicht auf jede einzelne Zahl im UI |
| 85 | Unvorhersehbar aber fair | 🟡 | Ereignisse/Wetter sind wahrscheinlichkeitsbasiert und in der Chronik nachvollziehbar, aber es gibt keine expliziten Vorwarnungen/Gegenmaßnahmen-Hinweise vor Katastrophen |

---

## Teil F: Technik & Qualitätssicherung (§64–79)

| § | Thema | Status | Anmerkung |
|---|---|---|---|
| 64 | Speichersystem | 🟡 | JSON-Export/Import mit Versionsnummer funktioniert; keine mehreren benannten Speicherstände, kein Autosave/Quicksave/Ironman-Modus |
| 65 | Modding (Datentrennung) | 🟡 | Daten in `gamedata.js` von der Logik in `sim.js` getrennt — aber als JS-Objekte, nicht als externe JSON-Dateien wie explizit gefordert |
| 66 | Technische Architektur (Module) | 🟡 | Alle geforderten Systeme existieren, aber gebündelt in zwei Dateien statt eigenständiger Module — bei weiterem Wachstum sollte das aufgeteilt werden |
| 67 | Deterministische Simulation (Seed) | ✅ | Eigener Mulberry32-PRNG, Seed + Aufrufzähler im Savegame, geladene Stände laufen deterministisch weiter |
| 68 | Performance (Kohorten) | ✅ | Bevölkerung als Gruppenmodell, nur wichtige Charaktere einzeln simuliert |
| 69 | Debugging-Funktionen | ✅ | Debug-Panel: Geld, Jahr, Bevölkerung, Charakter erzeugen, Event auslösen, Krieg starten |
| 70 | KI-Debugging (Entscheidungsgründe) | 🟡 | Faktor-Aufschlüsselung für hypothetische Kriegsentscheidung im Spec-Format vorhanden; KI erklärt selbst noch keinen Krieg (Analyse ohne Konsequenz) |
| 71 | Balancing-Konfiguration | ✅ | Zentrales `CONFIG`-Objekt, keine Magic Numbers im Code |
| 72 | Erster technischer Meilenstein | ✅ | Vertical Slice mit allen Kernsystemen erreicht (3 statt 5 Nachbarn, 6 statt 10 Waren — im MVP bewusst reduziert, seitdem aber ausgebaut) |
| 73 | Erster spielbarer Prototyp | 🟡 | Fast alles erfüllt; "Land kaufen" (Gebietskauf/-erweiterung) fehlt weiterhin |
| 74 | Entwicklungsphasen | ✅ | Phasenweise abgearbeitet (dokumentiert in DEVELOPMENT.md) |
| 75 | Inkrementelles Arbeiten | ✅ | Spiel blieb nach jedem Schritt lauffähig, mit Regressionstests abgesichert |
| 76 | Automatisierte Tests | 🟡 | Nur der Wirtschaftstest ist als Datei dauerhaft vorhanden (`tests/economy_test.js`); Tests für Bevölkerung/Erbschaft/Diplomatie/Speicherstände/Ereignisse liefen nur ad-hoc während der Entwicklung, sind nicht als wiederholbare Testdateien abgelegt |
| 77 | Wirtschaftstest | ✅ | `tests/economy_test.js` — 20×100 Jahre automatisiert, deckt bereits ein echtes Balancing-Thema auf |
| 78 | KI-gegen-KI-Test | ✅ | `tests/ai_vs_ai_test.js` — 100 Partien automatisiert, deckte bereits einen echten Start-Ungleichgewichts-Bug auf und wurde zur Behebung genutzt |
| 79 | Content nicht hardcoden (JSON-Dateien) | 🟡 | Datentrennung im Prinzip vorhanden, aber nicht als externe `/data/*.json`-Dateien wie explizit gefordert, sondern als JS-Objekte in `gamedata.js` |

---

## Teil G: Präsentation, Grafik, Sound, UX (§49–60, §86–92)

| § | Thema | Status | Anmerkung |
|---|---|---|---|
| 49–52 | 80er-Grafik/Pixel-Art/Palette | 🟡 | Retro-gestylte UI (harte Kanten, reduzierte Palette, Pixel-Font-Import), aber kein echtes Low-Res-Canvas/Sprite-Rendering bei 320×200 |
| 53 | CRT-Modus | ✅ | Als abschaltbarer Scanline-Filter umgesetzt (Standard: aus) |
| 54 | Schrift | 🟡 | Pixel-Web-Font eingebunden, aber kein eigenes Bitmap-Font-Rendering |
| 55 | Hauptbildschirm-Layout | 🟡 | Kopfzeile (Name/Titel/Jahr/Kasse/Prestige) vorhanden; Layout nutzt Tabs statt exaktem Links-Karte/Rechts-Statistik/Unten-Menü-Schema |
| 56 | Menüfenster-Optik | 🟡 | Kastenförmige Panels im Retro-Look, aber nicht die exakte ASCII-Box-Optik aus dem Beispiel |
| 57 | Sounds | 🟡 | Einfache Web-Audio-Bleeps bei einigen Aktionen; keine unterschiedlichen Münz-/Fanfaren-/Schlacht-/Glocken-Sounds |
| 58 | Musik | ❌ | Kein Chiptune-Soundtrack (keine Audio-Assets erzeugbar) |
| 59 | Echter Retro-Modus | ❌ | Nicht als eigener Modus umgesetzt |
| 60 | Moderne Bedienung | 🟡 | Maus/Touch funktioniert; keine Tastaturkürzel, kein Controller-Support |
| 86 | Welt spielt ohne Spieler | ✅ | KI-Regionen bauen, entwickeln sich, handeln diplomatisch — unabhängig vom Spieler |
| 87 | Spielende-Auswertung | ✅ | Vollständige Chronik-Zusammenfassung (Regierungsjahre, Generationen, höchster Titel, Höchstwerte, Kriegsbilanz, Katastrophen, Stadtstufe) |
| 88 | Easter Eggs | 🟡 | Zwei versteckte Anspielungen: eine Chronik-Anekdote im Jahr 1986 (Anspielung auf "1986 außen – 2026 innen"), ein Klick-Geheimnis auf dem Titelbildschirm (Krone 7× anklicken → Startbonus für die nächste Partie) |
| 89 | Startbildschirm | ✅ | Titelbildschirm mit Neues Spiel/Laden/Optionen; Mehrspieler/Chronik bewusst deaktiviert (noch nicht existent) |
| 90 | Intro-Sequenz | 🟡 | Kurzer Text-Vorspann vor dem Titelbildschirm (überspringbar per Klick/Auto-Weiterschaltung); kein animiertes Sprite-Intro |
| 91 | Kein visueller Modernismus | ✅ | Eingehalten (keine Neumorphism, keine Gradients, harte Kanten) |
| 92 | Moderne UX-Komfortfunktionen | 🟡 | Speichern/Laden vorhanden; Undo, Tastenkürzel, Suche, Filter, Pause/Geschwindigkeit, Autosave, UI-Scaling, Barrierefreiheit fehlen |

---

## Zusammenfassung: Was ist solide erledigt?

Vollständig oder nahezu vollständig (✅): Wirtschaft (Angebot/Nachfrage), Wetter,
Händler-KI, Steuerwirkung, Adelstitel-Leiter, Kaiserwahl, Beziehungssystem,
Rebellionen mit Ursachen, Event-System-Architektur, Informationsunsicherheit,
Berater, Prestige, Legitimität, Chronik, Balancing-Konfiguration, Performance
(Kohorten), inkrementelle Entwicklung, Wirtschaftstest, "Welt spielt ohne
Spieler", kein visueller Modernismus, CRT-Filter.

## Die größten echten Lücken (empfohlene nächste Prioritäten)

Aktualisiert nach Runde 1 (§8/§48/§67/§69/§70/§83/§84/§89), den Nachbesserungen
zu Baustoffen (§16/§26) und feudalem Militär (§33/§34/§35) auf Nutzerhinweis,
der Ausrichtung am Original "Kaiser" (Land/Kornverteilung/Regierungsstil/
Kriegsverbündete/Palast-Kathedrale-Pflicht), sowie Runde 2
(§24/§28/§29/§36/§47/§78/§87 aus dieser Liste selbst).

**Damit ist die zuletzt vereinbarte Prioritätenliste vollständig abgearbeitet.**
Seitdem zusätzlich umgesetzt: Marktplatz + Regionalhandel/Arbitrage (§20/§21/
§73), Marktspekulation (jährliche Preisschwankung unabhängig von Angebot/
Nachfrage), eine vollständige eigenständige Kampf-Engine (§35 jetzt ✅ statt
🟡 — 6 Phasen, Formationen, Taktiken, Konter, Gelände, Wetter, Moral,
Entscheidungspunkte) inklusive Integration ins Hauptspiel, ein komplettes
Design-System (einheitliche Typografie/Abstände, Reiter-Struktur, Pixel-Icons
für alle 30 Gebäude und 23 Waren, Siedler-Bildsprache auf der Karte), Datei-
Modularisierung, 5 neue Waren mit erster zweistufiger Produktionskette,
alle 12 Diplomatie-Aktionen, und die Wiederverzahnung mehrjähriger
Belagerungen mit der Kampf-Engine.

**Runde 3 umgesetzt** (siehe DEVELOPMENT.md Schritt 30): die komplette
Content-Tiefe aus Punkt 7 der vorherigen Liste (Pikeniere/schwere Kavallerie,
Mehl→Brot-Kette, individuelle KI-Kommandanten) sowie ein erster Aufschlag bei
Punkt 3 (Intro-Sequenz & Easter Eggs — bewusst als schlanke, aber echte
Umsetzung statt der zuvor komplett fehlenden Funktion).

Verbleibende bewusst offene Punkte, allesamt laut Spec selbst niedrigste
Priorität (§101 — Grafik/Sound/Content-Menge stehen hinter Spielspaß/
Simulation/KI/Wirtschaft):

1. **Echtes Sprite-/Canvas-Rendering statt CSS-Retro-Optik (§49–52)**
2. **Chiptune-Soundtrack statt reiner Sound-Effekte (§58)** — keine
   Audio-Assets erzeugbar, nur mit externen Tools möglich
3. **Vollständige Sprachumschaltung (§80)** — Grundstruktur (`STRINGS`/`t()`)
   existiert, aber nicht die gesamte UI ist darüber geführt
4. **Multiplayer, Steam, Achievements, Szenarioeditor (§103, Post-Launch)**
5. **Externe JSON-Datendateien statt JS-Objekte (§65/§79)** — Daten sind
   bereits von der Logik getrennt, aber noch nicht als eigenständige Dateien
6. **Weitere Content-Tiefe** (optional, kein blinder Fleck mehr): eine echte
   Herrscher-KI-Persönlichkeit mit Risikoprofil vor Kriegserklärungen (§31,
   die KI erklärt weiterhin selbst nie Krieg), Migration zwischen Regionen
   (§14 nur Zu-/Abwanderung zur Außenwelt, nicht zwischen den 8 Regionen),
   weitere Intrigen-Arten neben Sabotage (§32)

Sag mir, mit welchem Punkt ich weitermachen soll — oder ich schlage eine
Reihenfolge vor und arbeite sie eigenständig ab.
