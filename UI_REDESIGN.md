# UI_REDESIGN.md — Phase 8: Visual Identity & UI Redesign

Dieses Dokument begleitet Phase 8 ("Historical Graphic Novel × Modern
Grand Strategy × Renaissance 1500"). Es wird mit jeder Teilphase (8A–8I)
fortgeschrieben, nicht am Ende neu geschrieben — der aktuelle Stand steht
im "Screen Inventory" unten.

**Wichtig laut Auftrag (§115-118/181-186):** kein Großbang-Umbau. Erst
Audit + Wireframes, dann Design System (8A), danach Screen für Screen.
Nach jeder Teilphase bleibt das Spiel lauffähig und getestet.

## 1. UI Audit (Ausgangszustand vor Phase 8)

### 1.1 Bildschirme (Top-Level, per `display:none`-Umschaltung)

| Screen | Element-ID | Sichtbarkeitslogik |
|---|---|---|
| Intro | `#introScreen` | initial sichtbar, Klick → ausgeblendet |
| Titelbildschirm | `#titleScreen` | nach Intro |
| Charaktererstellung | `#charCreation` | von Titelbildschirm |
| Hauptspiel-Rahmen | `#frame` | nach Spielstart, enthält alle Tabs |
| Game Over | `#gameover` | Overlay, fixed |

### 1.2 Haupt-Tabs innerhalb `#frame` (`#pagetabs`, 6 Stück, exklusiv sichtbar)

`provinzPage` (Hof/Regierung/Bevölkerung/Chronik als EIN langer Panel),
`hofPage` (Berater/Technologie), `wirtschaftPage` (Preise/Handel/Land/
Schulden/Infrastruktur), `diplomatiePage`, `mapview` (Grundstücke/Gebäude-
Karte der eigenen Provinz — NICHT die strategische Weltkarte),
`militaryview` (Armee/Rekrutierung/Formation/Belagerung/Kriegserklärung).

**Befund:** "PROVINZ" bündelt aktuell vier eigentlich getrennte Anliegen
(Regierung, Bevölkerungstabelle, Chronik) in einem einzigen langen Panel —
genau die in §140 kritisierte "80 Zahlen mit Holzrahmen drum"-Situation.
Die Chronik ist Teil dieses Panels, nicht ihre eigene Ansicht (Widerspruch
zu §76 "Chronik als zentraler Bildschirm"). Es gibt noch KEINE
eigenständige Dynastie-/Stammbaum-Ansicht, KEINE Charakterkarten-Hofsicht
(nur eine Beratertabelle), KEINE Story-Thread-Sichtbarkeit im
Spieler-UI (nur im Debug-Panel) und KEINE strategische Weltkarte als
Hauptbildschirm (`mapview` zeigt nur die eigene Provinz-Bebauung, die
Kriegskarte `warMapOverlay` ist ein separates Overlay, das nur während
eines Kriegszugs geöffnet wird).

### 1.3 Modals/Overlays (fixed, per `display:flex`-Umschaltung)

`eventModal` (Entscheidungsereignisse — Event Chains UND reguläre
Zufallsevents laufen durch dasselbe Fenster), `birthModal`,
`marriageModal`, `advisorCandidatesModal`, `characterDebugModal`,
`ledgerModal` (Kassenbuch), `btOverlay` (Kampf, eigenes verschachteltes
Setup/Battle/Report-Dreiersystem), `warMapOverlay` (Kriegskarte), sowie
`titleUpBanner` (kein Modal, sondern eine temporäre Toast-Einblendung).

### 1.4 Innerhalb `#frame`: Debug-Panel

`#debugPanel` — 10 Unterabschnitte (Cheats, Event-Trigger, Kriegsstart,
KI-Analyse, Charakter-/Memory-/Chain-/Thread-/Drama-/Chronik-Inspektoren),
bereits optisch klar vom Spiel-UI getrennt (eigener Panel-Block, nur bei
aktivem Debug-Toggle sichtbar) — erfüllt §146 "Debug bleibt Debug" schon
strukturell, bekommt in 8A nur denselben Grundton wie alle Panels, keine
funktionale Änderung.

### 1.5 CSS-Struktur (Ausgangszustand)

Ein einziger `<style>`-Block (Zeile 6–391, ~385 Zeilen) direkt im
`<head>`. Bereits ein Tokens-Ansatz vorhanden (`:root { --bg; --panel;
--ink; --accent; --gold; --blue; --purple; --font-display; --font;
--fs-*; --sp-*; --r-* }`), aber inhaltlich das in Phase 8 ausdrücklich
verbotene Ziel: "Comic-Mittelalter" mit `Luckiest+Guy`-Cartoon-Zierschrift,
knalligem Rot/Grün/Blau/Gold und harten Comic-Schatten
(`box-shadow: Npx Npx 0 ...`, `text-shadow` für Sticker-Look). Google
Fonts extern via `@import` eingebunden (Font-Herkunft in 8A zu prüfen,
§104 "keine Online-Abhängigkeit" — Google Fonts ist der einzige laut
Artifact-Policy erlaubte externe Host, aber der Auftrag verlangt explizit
lokale/sichere Alternativen, siehe Entscheidung unten).

**Vorteil für die Kalibrierung:** JS-generierte Panels verwenden fast
durchgängig `var(--x)` statt hartkodierter Hex-Werte (nur 15× `#0a0c11`
für Debug-Panel-Rahmen und vereinzelte SVG-/Deko-Farben in Kartenelementen
außerhalb der UI-Chrome) — ein reines Tokens-Update in `:root` färbt daher
den GROSSTEIL der Oberfläche automatisch um, ohne dass jede einzelne
render()-Funktion angefasst werden muss.

### 1.6 JS-Struktur (Rendering)

Kein Komponentensystem — ein monolithisches `render()` plus wenige
Spezialfunktionen (`renderMap()`, `renderMilitary()`, `renderWarMap()`,
`renderWarMapDetail()`, `renderBuildingIcon()`, `renderGoodIcon()`), die
HTML-Strings direkt in `innerHTML` schreiben. Funktional stabil (durch
die komplette Testsuite abgesichert), aber jede Struktur-Änderung
(z. B. Charakterkarten statt Tabellenzeilen) bedeutet Textstring-Umbau,
kein Layout-Refactor auf Datenebene. Für Phase 8 bewusste Entscheidung:
CSS/Klassen-Änderungen an bestehenden Elementen zuerst, HTML-Struktur nur
dort verändern, wo eine Teilphase es ohnehin verlangt (§112 "kein
kompletter State-Rewrite", sinngemäß auch fürs Rendering).

### 1.7 Bekannte technische Risiken für den Redesign-Prozess

1. **Der zweite `<script>`-Block ist handgepflegt und wird vom Bundler
   NICHT angefasst** (`tools/build-bundle.js` schreibt nur den ersten
   Block aus `js/*.js`). Reine CSS-/HTML-Änderungen in Phase 8 betreffen
   in erster Linie den STATISCHEN Teil vor Zeile 851 sowie `index.html`
   selbst — funktionale JS-Änderungen (z. B. neue ViewModel-Helfer, §111)
   müssen weiterhin über `js/*.js` + Rebuild laufen, nie direkt in
   `index.html` editiert werden (sonst verliert der nächste Rebuild sie
   wieder).
2. **`var(--x)`-Referenzen sind teils in JS-Template-Strings eingebettet**
   (z. B. `style="color:var(--gold)"` in generierten Zeilen) — ein
   Tokens-Update wirkt daher automatisch, ABER manche Stellen erwarten
   implizit einen HELLEN Text auf `--panel`/`--blue`-Hintergrund; ein
   Farbwechsel muss Kontrastpaare (Text-auf-Fläche) gemeinsam prüfen, nicht
   nur einzelne Variablen isoliert.
3. **`#frame` hat eine feste Breite (960px)** und ist zentriert — das
   bestehende Layout ist NICHT responsive im Sinne von §91 (skalierbar
   1920×1080/1440×900/1366×768). Für 8A/8B wird dies dokumentiert, eine
   vollständige Responsive-Überarbeitung ist Teil von 8I (Polish).
4. **Keine erkennbare Layer-/Z-Index-Systematik** — Modals nutzen
   `z-index: 400/200/210/500` uneinheitlich benannt (kein zentrales
   Token). Wird in 8A durch ein Z-Index-Tokensystem ersetzt (§157).
5. **CRT-Filter-Feature (`#frame.crt`)** ist ein Retro-Achtziger-Overlay
   aus der VOR-Comic-Ära des Projekts — bleibt funktional erhalten
   (abschaltbarer Zusatzfilter, keine Kernidentität), wird aber nicht
   aktiv beworben, da er dem Graphic-Novel-Ziel entgegenläuft.

## 2. Wireframes (ASCII, Zielzustand)

### 2.1 Hauptscreen (Ziel für 8B, in dieser Phase als Design-Richtung
dokumentiert, NICHT in einem Rutsch umgesetzt — siehe Screen Inventory)

```
+----------------------------------------------------------------------+
| [Portrait] FRIEDRICH II. · HERZOG VON KLEVE   1523   1.240 Schatz     |
|            Prestige 68  Legitimität 82  Nahrung 91%   [!] Warnung    |
+------+-----------------------------------------------------+---------+
| Reich|                                                     | REGION  |
| Wirt.|                                                     | Kleve   |
| Handl|                 K A R T E                           | 28.420  |
| Hof  |         (65-75% der Bildschirmfläche)                | Bew.    |
| Dyn. |                                                     |         |
| Diplo|                                                     | IM REICH|
| Milit|                                                     | BEWEGT  |
| Chron|                                                     | SICH    |
| Opt. |                                                     | ETWAS:  |
|      |                                                     | "Der    |
|      |                                                     |  Anspr. |
|      |                                                     |  Wilh." |
+------+-----------------------------------------------------+---------+
|  ▶ JAHR/MONAT VOR   💾 SPEICHERN   📂 LADEN            [Debug ⚙]     |
+----------------------------------------------------------------------+
```

### 2.2 Provinzpanel (Kontextpanel bei Klick auf Region)

```
+---------------------------+
| HERZOGTUM KLEVE           |
| 28.420 Einwohner  (+2,4%) |
| Zufriedenheit  [====  ] 76%|
| Nahrung        [=====  ] 82%|
| Wohlstand      [===    ] 61%|
+---------------------------+
| Wirtschaft | Bevölkerung |
| Gebäude | Militär | Handel|
+---------------------------+
```

### 2.3 Hof

```
+----------------------------------------------------------------------+
|                     [Portrait: HERRSCHER]                             |
|      [Ehepartner]  [Erbe]        [Schatzmeister] [Marschall]         |
|      [Diplomat] [Spionagemeister] [Geistlicher] [Handelsberater]     |
+----------------------------------------------------------------------+
| ausgewählte Karte:  ALBRECHT VON SAYN — Schatzmeister — 32 Jahre     |
| Traits: [RACHSÜCHTIG] [FLEISSIG]   Loyalität [===  ] 50  Finanzen 4  |
+----------------------------------------------------------------------+
```

### 2.4 Dynastie

```
+----------------------------------------------------------------------+
|                          STAMMBAUM                                    |
|        [Vater]---[Mutter]                                             |
|              |                                                        |
|   [Geschwister] [HERRSCHER]===[Ehepartner]                            |
|                       |                                               |
|            [Erbe 1*] [Kind 2] [Kind 3]                                |
+----------------------------------------------------------------------+
| ERBFOLGE: 1. Wilhelm  2. Johann  3. Friedrich                         |
| [!] Wilhelm besitzt starken konkurrierenden Anspruch                  |
+----------------------------------------------------------------------+
```

### 2.5 Event

```
+----------------------------------------------------------------------+
| [Illustration/Fallback-Muster]  | EIN BRUDER FORDERT SEIN RECHT       |
|                                  | HOF · 1523                          |
|                                  | Wilhelm hat ... Text ...            |
|                                  +--------------------------------------+
|                                  | [ Option 1 groß ]                   |
|                                  | [ Option 2 groß ]                   |
|                                  | [ Option 3 groß ]                   |
+----------------------------------------------------------------------+
```

### 2.6 Diplomatie

```
+----------------------------------------------------------------------+
| [Portrait] MAINAU — Herzog Heinrich                                   |
| Beziehung: +32  (Hover: warum?)                                       |
| Verträge: [Handel] [Nichtangriff]                                     |
| Ansprüche: keine     Letzte Erinnerungen: ...                         |
+----------------------------------------------------------------------+
```

### 2.7 Krieg

```
+----------------------------------------------------------------------+
|  EIGENE ARMEE            GELÄNDE            FEIND                    |
|  [Pikeniere][Bogen]        (Ort)        [Ritter][Kanonen]            |
|  [Ritter]                                                             |
+----------------------------------------------------------------------+
|  Formation: ( ) Linie ( ) Defensiv ( ) Flanke                         |
+----------------------------------------------------------------------+
```

### 2.8 Chronik

```
+----------------------------------------------------------------------+
|  HERRSCHER / ZEITRAUM        |  EREIGNISSE                            |
|  Friedrich II.                |  1517  Krönung                        |
|  1517–1543                    |  1523  "Der Anspruch Wilhelms" — VERSÖHNUNG |
|  [Filter: Herrscher|Jahrzehnt|Kategorie|Thread]                       |
+----------------------------------------------------------------------+
```

## 3. Design System (Phase 8A)

Siehe `:root` in `index.html` (Zeile 8ff.) für die tatsächlichen
Token-Werte — hier nur die Entscheidungen und Begründungen:

- **Farbpalette:** ersetzt vollständig das bisherige Comic-Schema.
  Primär: tiefes Burgunderrot (`--burgundy`), dunkles Waldgrün
  (`--forest`), Nachtblau (`--night-blue`), warmes Elfenbein (`--ivory`),
  Anthrazit (`--anthracite`), Bronze (`--bronze`), gedämpftes Gold
  (`--gold-muted`). Sekundär: Ocker (`--ochre`), dunkles Braun
  (`--umber`), gedecktes Rot (`--red-muted`), entsättigtes Blau
  (`--blue-muted`), Oliv (`--olive`). Bedeutungsfarben (§7) bleiben
  eigene Tokens: `--c-positive` (Grün), `--c-danger` (Rot), `--c-prestige`
  (Gold), `--c-diplomacy` (Blau), `--c-economy` (Ocker) — bewusst
  GETRENNT von den rein dekorativen Primär-/Sekundärfarben, damit ein
  späterer Farbwechsel der Deko nicht versehentlich die Bedeutungslogik
  verschiebt.
- **Typografie:** zwei Schriftwelten (§89). DISPLAY: `'Cormorant
  Garamond'` (Google Fonts, seriös-historisch, keine Fraktur — §90) für
  Titel/Herrschernamen/Events/Chronik, mit sicherem lokalem Fallback
  (`Georgia, 'Times New Roman', serif`), falls Google Fonts nicht lädt.
  UI: `'Source Sans 3'` (gut lesbare humanistische Sans-Serif) für
  Zahlen/Tabellen/Buttons/Tooltips, Fallback `system-ui, 'Segoe UI',
  sans-serif`. Entscheidung zu §104 ("keine Online-Abhängigkeit"): Google
  Fonts bleibt die einzige externe Quelle (wie schon vorher bei
  Luckiest Guy/Baloo 2) — ein Totalverzicht auf Web Fonts würde eine
  komplette Font-Datei-Einbettung erfordern, die den Bundle-Umfang massiv
  aufbläht; stattdessen sind die Fallback-Stacks so gewählt, dass das
  Spiel bei fehlendem Netzzugriff weiterhin klar lesbar UND stilistisch
  angemessen bleibt (Serif-Fallback für Display, System-Sans für UI) —
  keine funktionale Abhängigkeit, nur eine optische Verbesserung bei
  vorhandenem Netz.
- **Abstands-/Radius-System:** `--sp-1..5` unverändert (Werte bleiben,
  Namen bleiben) — das bestehende Spacing war bereits konsistent, nur die
  Rundungen (`--r-*`) werden von "Comic-rund" (10–20px) auf "gediegen"
  (4–10px) reduziert, passend zur neuen Bildsprache.
- **Schatten:** von harten "Comic-Sticker"-Schatten (`Npx Npx 0 ...`,
  keine Weichzeichnung) auf subtile `box-shadow` mit Weichzeichnung
  umgestellt (§96 "keine moderne Material-Design-Kartenwolke" — daher
  bewusst SEHR gedämpft: kurze Distanz, geringe Deckkraft, kein
  Drop-Shadow-Stapel).
- **Button-Varianten (§160-163):** `Primary` (positive Hauptaktion,
  gedämpftes Gold NUR hier, nicht überall), `Secondary` (neutral,
  Anthrazit/Bronze-Rahmen), `Danger` (Krieg/irreversibel, Burgunderrot),
  `Ghost` (transparent, Rahmen only, für sekundäre/Abbrechen-Aktionen),
  `Imperial` (nur Titel-/Kaiserwahl-Aktionen, Gold + Kroneffekt) — als
  CSS-Klassen `.btn-primary/.btn-secondary/.btn-danger/.btn-ghost/
  .btn-imperial` NEU eingeführt, der bestehende nackte `button`-Selektor
  bleibt als Fallback/Default (entspricht `.btn-secondary`), damit keine
  bestehende `<button>`-Instanz ohne Klasse plötzlich unstilisiert wirkt.
- **Z-Index-System (§157):** neue Tokens `--z-map`, `--z-hud`,
  `--z-panel`, `--z-modal`, `--z-notification`, `--z-debug` ersetzen die
  bisherigen verstreuten Zahlenwerte (200/210/400/500).
- **Tooltip:** bestehendes `[data-tip]`-Muster bleibt (funktioniert bereits
  gut, §159 "zentraler Tooltip-Stil" ist damit schon erfüllt), nur
  farblich an die neue Palette angepasst.

## 4. Phase 8B: Main Screen + Map + HUD

Zweite Teilphase — "die Spielwelt wird zur Bühne". Umfasst ausschließlich
Hauptlayout, Welt-/Regionskarte, obere Statusleiste, Hauptnavigation,
Kontextpanel, Story Card/Warnungen, Jahreswechsel-Hinweis. Hof, Dynastie,
Event-Fenster, Diplomatie, Chronik, Kampf bleiben bewusst unangetastet
(§72-73/71/70).

**Architekturentscheidung: additiv statt ersetzend.** Die bestehenden 6
Tabs (Provinz/Hof/Wirtschaft/Diplomatie/Karte&Gebäude/Militär) bleiben
vollständig erhalten und funktional unverändert (§1 oberste Regel:
"Bestehende Funktionen müssen erhalten bleiben") — REICH ist ein NEUER,
7. Tab, der zum Standardbildschirm wird. Kein bestehender Screen wurde
entfernt oder umgebaut.

**Weltkarte wiederverwendet echte, bereits bestehende Daten.** Statt einer
neuen Kartenmechanik nutzt die neue, dauerhaft sichtbare Karte exakt
dieselbe `TERRITORIES`/`state.territories`-Struktur, die die Kriegskarte
(`js/war-map.js`) bereits seit einer früheren Ausbaustufe pflegt — 16
Gebiete, real simulierter Besitzer/Garnison/Aufstellung. Die Kriegskarte
selbst bleibt unverändert als eigenes Kriegs-Overlay bestehen; die neue
Karte ist eine zweite, permanente, eher lesende Darstellung derselben
Wahrheit. Klick auf ein Gebiet zeigt im Kontextpanel die Wirtschaftsdaten
der ES BESITZENDEN Region (`state.regions[owner]`) — ehrlich so benannt,
da die Simulation wirtschaftlich auf Regions-, nicht auf Territoriums-
Ebene rechnet.

**Neues Modul `js/ui-viewmodels.js`** (bundled, getestet in
`tests/ui_viewmodel_test.js`, 25 Prüfungen): `getHudViewModel()`,
`getWorldMapViewModel()`, `getRegionSummaryViewModel()`,
`getPrimaryStoryViewModel()`, `getAlertViewModel()`,
`getYearTransitionViewModel()` — reine Transformationen über bereits
reale state-Werte, kein `rnd()`-Aufruf (getestet), keine Gameplaylogik.
Die Story Card übersetzt `state.drama.focusThreadId`/`thread.status`
(bereits vorhanden seit Phase 6) in natürlichsprachliche Sätze statt
Debug-Werte zu zeigen. Die Warnungen sind jede einzeln auf eine bereits
bestehende Schwelle zurückgeführt (Kommentare im Code nennen die Quelle),
z. B. `grainRatio < 0.5` (dieselbe Schwelle wie ein bestehendes Debug-
Event), `treasury < 0` (dieselbe Schwelle wie `computeDramaTensionBreakdown()`s
"weakEconomy"), Titelaufstieg-Fortschritt (dieselben Felder wie der
tatsächliche `checkTitleUp()`-Vergleich in `js/politics.js`).

**Drei reale Layout-Bugs gefunden und behoben** (Playwright-Klicktest hat
sie aufgedeckt, nicht nur Screenshots — reiner visueller Vergleich hätte
sie übersehen):
1. `#worldMapSvg` erhielt versehentlich ein `z-index` über der Knoten-
   ebene und blockierte alle Klicks auf Gebiete — behoben mit
   `pointer-events: none` auf der reinen Linienebene (SVGs, die nur
   Dekoration zeichnen, sollten das grundsätzlich immer haben).
2. Die bereits bestehende generische Tooltip-Regel `[data-tip] {
   position: relative; ... }` (gleiche Selektor-Spezifität, aber später
   in der Kaskade) überschrieb `position: absolute` auf allen
   Kartenknoten, weil jeder Knoten selbst ein `data-tip`-Tooltip trägt —
   alle Knoten landeten dadurch im normalen Textfluss übereinander
   gestapelt. Behoben durch die höhere Spezifität `div.reichNode`
   statt `.reichNode`. **Wichtig für spätere Teilphasen**: JEDES neue
   Element, das gleichzeitig `data-tip` UND eine eigene `position`
   braucht, ist von genau demselben Kaskaden-Konflikt betroffen.
3. Der globale `button`-Reset setzt `margin: 3px 3px 3px 0` — in einem
   Flex-Container mit eigenem `gap` addierte sich das zur Kontextpanel-
   Tab-Reihe auf und drängte den letzten Tab aus dem sichtbaren Bereich.
   Behoben mit `margin: 0` auf den neuen Tab-/Nav-Button-Klassen.

**Responsive, per Playwright bei allen drei Pflichtauflösungen geprüft**
(1920×1080/1440×900/1366×768, siehe Screenshots): `#frame` ist jetzt
`width: min(96vw, 1440px)` statt fest 960px. Bei 1366×768 zeigte sich
zusätzlich, dass 4 Kontextpanel-Tabs nebeneinander ("ÜBERSICHT/
WIRTSCHAFT/BEVÖLKERUNG/MILITÄR") selbst im breiten Panel nicht bequem
passen — auf ein 2×2-Raster umgestellt. Die Kartenhöhe ist zusätzlich auf
`max-height: 52vh` gedeckelt, damit Story Card/Warnungen/Jahreswechsel-
Leiste bei 768px Höhe ohne Scrollen sichtbar bleiben.

**Visuell verifiziert** (5 Szenarien, §57/58): Hauptbildschirm ohne Panel,
Gebiet ausgewählt (eigenes + fremdes Territorium), aktive Geschichte
("Die Hungerjahre von Bayern" — ACTIVE, natürlichsprachlich statt
Debug-Wert), kritische Warnungen (Nahrung kritisch/Krieg/Thronfolge
ungeklärt, alle mit rotem Punkt priorisiert vor der gelben "wichtig"-
Stufe), ruhiger Zustand ("Das Reich befindet sich in ruhigen Jahren.",
nur wenn tatsächlich kein aktiver Thread existiert). Der Herrschername
ist visuell größer als jeder Ressourcenwert (§8), die Karte nimmt den
dominanten Anteil der Fläche ein (§3).

## 5. Phase 8C: Reich + Provinz + Wirtschaft

Dritte Teilphase — "aus Tabellen wird eine lesbare Herrschaftsübersicht".
Umfasst REICH-Übersicht (KPI-Leiste), PROVINZ-Tab (Bevölkerung/Nahrung/
Kassenbuch) und WIRTSCHAFT-Tab (Waren/Steuern/Handel/Risiken), sowie die
vertiefte WIRTSCHAFT/BEVÖLKERUNG-Ansicht im Kontextpanel (§48/49). Hof
komplett, Dynastie/Stammbaum, Event-Fenster, Diplomatie, Krieg, Chronik-
Buchansicht bleiben bewusst unangetastet — wie in 8B bleibt auch hier
jede bestehende Funktion vollständig erhalten (`#priceTable`/`#popTable`/
`#satBar` existieren technisch weiter, sind aber `display:none` bzw.
durch die neuen Panels ersetzt; das alte Rendering läuft im Hintergrund
harmlos mit, siehe §Phase-8C-Kommentare im Code).

**Leitprinzip: "Wie geht es meinem Reich?" zuerst, "Warum?" auf Klick,
exakte Zahlen weiterhin für Vertiefungswillige.** Die neue
`#realmKpiStrip` zeigt 6 Kennzahlen (Staatskasse/Bevölkerung/Nahrung/
Zufriedenheit/Wohlstand) mit Status-Wörtern (STABIL/ANGESPANNT/KRITISCH/
WACHSTUM/RÜCKGANG) statt Farbe allein. Die 24-Zeilen-Warentabelle wurde
durch 4 Kategorie-Karten (NAHRUNG/ROHSTOFFE/HANDWERK/LUXUS,
`GOODS[gid].category`) ersetzt; ein Klick auf eine Ware öffnet die
vollständige Preiserklärung (Formel-Zerlegung) und die Produktionskette
als einfache Karten+Pfeile (keine Tech-Baum-Grafik, §28/29). Die
10-Zeilen-Bevölkerungstabelle wurde durch Balken (Anteil in %) mit
Detail-auf-Klick (Bedarf/Steueraufkommen/Geburten/Todesfälle) ersetzt.

**"Keine Daten erfinden" wörtlich umgesetzt.** Jede neue Kennzahl ist auf
eine bereits real vorhandene state-Quelle zurückgeführt (Kommentare im
Code nennen die Quelle), z. B.:
- Kassenbuch-Trend: `state.lastMonthlyReport` (nur EIN Monat existiert
  real) — deshalb ehrlich "im letzten Monat" statt fälschlich "im letzten
  Jahr" beschriftet.
- Bevölkerungs-Jahrestrend: `r.lastPopSummary`/`r.lastNetMigration`
  (echte Deltas, keine Mehrpunkt-Historie — die gibt es im state nicht).
- Produktion/Jahr pro Ware: **eine neue, minimale Simulationsänderung**
  in `js/advance-year.js` — `computeProduction(r)`s Rückgabewert wurde
  bisher sofort verworfen; jetzt wird er zusätzlich als `r.lastProduction`
  gespeichert (exakt dasselbe Muster wie `r.lastHarvestFactor`/
  `r.lastPopBreakdown`). Keine Zahl geändert, keine neue Berechnung im
  UI (das hätte `computeProduction()`s Warenverbrauch versehentlich
  verdoppelt).
- Steuern: nur EIN regionsweiter Satz existiert (`region.taxRate`) — wird
  ehrlich als geteilter Satz je Gruppe dargestellt, keine erfundene
  Differenzierung.
- Baufortschritt-Balken (im Master-Prompt als Beispiel genannt): bewusst
  **nicht gebaut** — Gebäude werden in der Simulation sofort beim Kauf
  fertiggestellt, es existiert keine Baustellen-/Fortschritts-Mechanik,
  ein Prozentwert wäre erfunden gewesen.

**Ein realer Datenpfad-Bug gefunden und behoben:** `region.prices` wird
nur einmal PRO JAHR gesetzt (`processAllRegions()`), ist also bei einem
frischen Spiel `undefined`. Der alte, weiterhin mitlaufende
`#priceTable`-Code berechnet `region.priceBreakdown` dagegen bei JEDEM
Render neu. Die neue Warenkarte las ursprünglich `region.prices` für den
angezeigten Preis, die Preiserklärung aber `region.priceBreakdown` — bei
einem frischen Spiel liefen beide auseinander ("Holz — 6 Taler" oben,
"Warum 2 Taler?" in der Erklärung). Behoben mit `resolveGoodPrice()`
(bevorzugt `priceBreakdown[gid].gesamt`, dann `prices[gid]`, dann
`GOODS[gid].base`), konsistent in allen neuen ViewModels verwendet.
Dedizierter Regressionstest reproduziert exakt dieses Szenario.

**Kontextpanel WIRTSCHAFT/BEVÖLKERUNG vertieft (§48/49).** Beide Tabs
nutzen dieselben realen Felder wie die REICH-weiten Widgets, funktionieren
aber für JEDE Region (Spieler UND KI), da `processAllRegions()` alle
Regionen gleich behandelt: WIRTSCHAFT zeigt Top-Produktion des Jahres und
etwaige Engpässe (Produktion < 85% des Verbrauchs), BEVÖLKERUNG zeigt
Geburten/Todesfälle/Saldo des laufenden Jahres. Getestet für sowohl die
eigene Hauptstadt als auch eine fremde Hauptstadt.

**Zwei weitere reale Bugs gefunden und behoben** (wie in 8B durch
Playwright-Klicktests mit `getBoundingClientRect()`, nicht durch reine
Screenshot-Ansicht):
1. `.popGroupBarFill` ist ein `<span>` (`display: inline` per Default) —
   inline-Elemente ignorieren die CSS-Eigenschaft `width` vollständig,
   auch als Inline-`style`. Jeder Bevölkerungsbalken rendere mit 0px
   Füllbreite trotz korrektem `style="width:N%"`. Behoben mit
   `display: block` auf `.popGroupBarFill`. **Wichtig für spätere
   Teilphasen**: jedes `<span>`-basierte "Füllbalken"-Muster braucht
   diesen Override.
2. Die i18n-Wörterbücher für die 7 Seitenleisten-Labels
   (`tab_reich_label` usw.) wurden in 8B versehentlich direkt in
   `index.html` statt in ihrer echten Quelle `data/gamedata.js`
   gepflegt — beim nächsten `node tools/build-bundle.js`-Lauf dieser
   Teilphase stillschweigend überschrieben (Sidenav zeigte rohe Keys wie
   "tab_reich_labe", abgeschnitten durch die schmale Leiste). Behoben
   durch Ergänzung in `data/gamedata.js` (DE + EN). **Wichtig für spätere
   Teilphasen**: vor Hand-Edits an scheinbar statischer Konfiguration in
   `index.html` immer mit `grep -rln "<key>" js/ data/` prüfen, ob die
   eigentliche Quelle woanders liegt.

**Bundle-Größe:** 620.239 → 658.989 Zeichen (+38.750 Zeichen, +6,2%),
Block 0 (automatisch generierter erster `<script>`-Block) 444.315
Zeichen. Wachstum stammt fast vollständig aus `js/ui-viewmodels.js`
(+387 Zeilen) und dem neuen HTML/CSS für KPI-Leiste, Warenkarten,
Bevölkerungsbalken, Steuer-/Handelspanels.

**Responsive erneut bei allen drei Pflichtauflösungen geprüft**
(1920×1080/1440×900/1366×768) — kein horizontales Scrollen, KPI-Leiste
und Warenkarten-Raster bleiben bei 1366×768 in einer Spalte lesbar.

## 6. Phase 8C.1: Strategic Map Redesign

Zwischenphase vor 8D — "von der Node-Grafik zur historischen Risiko-
Brettspiel-Karte". Ersetzt ausschließlich die visuelle Darstellung der
REICH-Weltkarte (die separate Kriegskarte/`js/war-map.js`-Overlay bleibt
unangetastet, wie in jeder vorherigen Teilphase). TERRITORIES/
state.territories/adjacent/Garnison/Truppen/Wirtschaft/Battle Engine/
Savegames/RNG unverändert (§6) — reine Präsentation.

**Von Kreisen zu echten Flächen.** Die bisherigen 16 Kreis-Divs
(`div.reichNode`) plus Linien-SVG (Adjazenz als sichtbare Verbindungs-
linien) wichen 16 echten SVG-`<path>`-Territorien mit organischen,
unregelmäßigen Grenzen — Nachbarschaft wird jetzt durch gemeinsame
Grenzen sichtbar, keine Netzwerklinien mehr in der normalen Ansicht (§8).

**Geometrie ist fest, deterministisch und von Hand validiert, nicht
prozedural zufällig (§5).** Neues Offline-Dev-Tool
`tools/generate-map-geometry.js` (kein Laufzeit-Code, von Hand
ausgeführt) berechnet ein vollständiges, begrenztes Voronoi-Diagramm
(paarweise Halbebenen-Clipping) über einen eigenen, von `TERRITORIES.x/y`
unabhängigen Layout-Punktesatz und schreibt das Ergebnis als statische
Pfaddaten nach `js/map-geometry.js` (`MAP_GEOMETRY`/`MAP_WILD_GEOMETRY`,
bundled über `tools/build-bundle.js`). Die organische "handgezeichnete"
Kantenform (§49) kommt aus einer deterministischen String-Hash-
Verschiebung der Kantenkontrollpunkte — kein `Math.random()`, kein
`rnd()` (§41/42) — mit einer richtungsunabhängigen, kanonischen
Kantenidentität, damit eine GETEILTE Grenze in beiden angrenzenden
Zellen exakt denselben Kontrollpunkt verwendet (sonst klaffen die Ränder
minimal auseinander).

**"Adjazenz ist heilig" (§7) — programmatisch erzwungen, nicht nur
behauptet.** Der Generator validiert nach der Berechnung automatisch:
JEDES in `TERRITORIES.adjacent` deklarierte Paar muss eine echte
gemeinsame Kante im Diagramm besitzen; schlägt das fehl, bricht das
Skript mit Fehlermeldung ab, statt eine falsche Karte auszugeben. Die
Adjazenzliste wird dafür live aus `data/gamedata.js` gelesen (kein
separat gepflegtes Duplikat, §58 "Source of Truth").

**Vier dekorative "Wildnis"-Stützpunkte lösen einen echten geometrischen
Zielkonflikt.** Ein reines Voronoi-Diagramm der 16 Punkte allein hätte
mehrere unerwünschte Grenzen zwischen geometrisch nahen, aber im
Gameplay NICHT benachbarten Gebieten verschiedener Besitzer erzeugt
(z. B. die eigene Hauptstadt direkt neben einer weit entfernten KI-
Grenzprovinz) — eine mathematische Folge davon, dass das Gameplay-
Adjazenzgraph (Grad ≤3, 17 Kanten) deutlich dünner ist als ein
generisches Voronoi-Diagramm von 16 Punkten (≈21 Kanten). Vier
zusätzliche, NICHT spielbare Stützpunkte (`wild_nw/ne/se/sw`) füllen
genau die Zwischenräume, die sonst zwei unpassende Gebiete geteilt
hätten — gerendert als dekoratives, unbesiedeltes Gelände (Wald/Hügel-
Symbolik), nicht als Territorium (kein Besitzer, kein Klick, kein
Label). Nach Einführung dieser vier Punkte: null ungewollte Grenzen
zwischen verschiedenen Besitzern (vom Generator bei jedem Lauf erneut
geprüft).

**Farben/Grenzen/Zustände.** Dieselbe Renaissance-Besitzerpalette wie
zuvor (`REICH_OWNER_COLOR`: Gold=Spieler, Burgunderrot/Steinblau/Ocker=
KI, unverändert aus 8B). Neu: sichtbare Zustände direkt auf der
SVG-Fläche — Hover (helligkeitsverstärkt, hellerer Rand), Selected
(**cremeweißer** statt goldener Rahmen — Gold kollidiert sonst mit der
Spieler-eigenen Besitzerfarbe und wäre dort unsichtbar, ein während
dieser Teilphase gefundener und behobener Kontrastfehler), Attackable
(dezente burgunderfarben gestrichelte Kontur + kleines Schwertsymbol,
nur bei echtem `state.warState[...]` UND direkter Adjazenz zu
Spielergebiet — keine neue Mechanik, dieselbe Bedingung wie
`aiTerritoryCounterAttack()` in `js/war-map.js`), Ally (feine
gestrichelte Kontur, aus dem bereits realen
`state.diplomacy[...].treaties.allianz`).

**Hauptstädte/Gelände/Armeen als lokale Inline-SVG-Symbole statt
Emoji (§55/56).** Vier neue `<symbol>`-Definitionen (Burg, Baum, Hügel,
Schwert, Banner) im `<defs>`-Block der Karte, offline, frei skalierbar.
Burg-Symbol über dem Hauptstadt-Punkt, Name darunter (permanent
sichtbar, §16); Wald/Hügel-Symbole nur für Nicht-Hauptstädte mit
passendem `TERRITORIES.terrain` (nur reale Terrain-Typen der 16 Gebiete
illustriert, keine neue Geländemechanik, §21-25); Truppenstärke als
kleines Banner mit Zahl statt großem Kreis (§18-20, nutzt ausschließlich
den bereits vorhandenen `strength`-Wert).

**Ein reales technisches Problem gefunden und mit einer kleinen,
konsistenten Lösung behoben: das bestehende `[data-tip]:hover::after`-
CSS-Tooltip-System malt auf SVG-Geometrieelementen (`<g>`/`<path>`,
kein `foreignObject`) laut `getComputedStyle` zwar einen Box-Wert, wird
von Chromium aber tatsächlich NICHT sichtbar gerendert** — eine reine
SVG-Rendering-Einschränkung (per dediziertem Playwright-Test bestätigt:
0×0 sichtbare Fläche trotz `display:block`-Computed-Style). Behoben mit
einem neuen, aber visuell IDENTISCHEN Tooltip (`#mapTooltip`, dieselbe
dunkle Panel-Optik/Goldrand/`pre-line`), positioniert per einmalig
registrierter `mousemove`-Event-Delegation auf `#worldMapBoard` statt
CSS `::after` — das bestehende Tooltip-System bleibt damit im
Erscheinungsbild vollständig erhalten (§34), nur die technische
Umsetzung für SVG-Flächen ist neu. Nebenbei behoben: die Tooltip-Zeile
nutzte (schon in der alten Kreis-Karte) `\\n` (zwei Zeichen: Backslash +
n) statt eines echten Zeilenumbruchs `\n` im Template-Literal — sichtbar
nur als Nebeneffekt der neuen Debug-Prüfung, jetzt ein echter Umbruch.

**Kein Bridges/Pässe/Furten-Sonderfall nötig (§8).** Da die Validierung
bestätigt, dass JEDE deklarierte Adjazenz bereits eine echte geometrische
Grenze besitzt, war keine einzige visuelle Sonderverbindung (Brücke,
Pass, Furt) erforderlich — die Karte bildet den kompletten Gameplay-
Graphen allein durch Flächenränder ab.

**Playwright-Klicktests (§39/40):** alle 16 Territorien einzeln geklickt
(kein Fehler), Kontextpanel-Tabs nach Klick durchgeklickt, Schließen-
Button, Kriegssimulation (`state.warState.ai1=true` → exakt 1
attackable Gebiet, das einzige direkt an Spielerland grenzende), Bündnis-
Simulation (`treaties.allianz=true` → alle 4 Gebiete des Bündnispartners
als ally markiert), automatisierter Overlay-Scan über alle 16 Territory-
Hitboxen (`elementFromPoint()`, 0 blockierende Elemente), Hover-Tooltip
per dediziertem Zoom-Screenshot visuell bestätigt.

**Responsive** bei allen drei Pflichtauflösungen prüft zusätzlich
Kollisionen zwischen sichtbaren Hauptstadt-Labels (0 bei allen drei) und
bestätigt `#worldMapBoard` bleibt vollständig im Viewport (kein
Abschneiden, kein horizontales Scrollen) — Seitenverhältnis der Karte
von 4:3 auf 1:1 geändert (die neue 1000×1000-Geometrie ist quadratisch,
`preserveAspectRatio="xMidYMid meet"` verhindert Verzerrung).

**Bundle-Größe:** 662.919 → 677.811 Bytes (+14.892 Bytes, +2,25 %) —
primär `js/map-geometry.js` (statische Pfaddaten für 16+4 Flächen) und
das neue SVG-Rendering in `renderWorldMap()`.

**Dead Code entfernt statt liegengelassen:** die alte adjazenz-basierte
Linienliste (`getWorldMapViewModel().lines`) wurde komplett gestrichen
(inkl. zugehörigem Test) statt als toter Code stehen zu bleiben — da die
neue Geometrie jede Adjazenz bereits als echte Grenze abbildet, gibt es
für sie keinen Verwendungszweck mehr (anders als in 8C, wo die alte
`#priceTable` bewusst als harmloser Fallback erhalten blieb, weil ihr
Render-Code weiterhin unverändert mitläuft).

## 7. Phase 8C.2: Complete Map Art Redesign

Zweite Zwischenphase vor 8D. 8C.1 war technisch korrekt (Adjazenz
validiert, alle States funktionsfähig), aber visuell noch als
Voronoi-Diagramm erkennbar — gleichmäßig große Zellen, uniforme
algorithmische Randwellen. Diese Phase verwirft die Voronoi-Geometrie
vollständig als Quelle der finalen Kartenform (§37) und ersetzt sie
durch 16 **handplatzierte** Territorien.

**Warum Voronoi verworfen wurde:** ein automatisch berechnetes
Diagramm erzeugt zwangsläufig ähnlich große, ähnlich geformte Zellen
(mathematische Eigenschaft von Punktmengen-Tessellation) — genau das
Gegenteil von unregelmäßigen historischen Herrschaftsgebieten (§5/48).
Auch mit organischer Kantenverschiebung blieb die Voronoi-Struktur als
"Signatur" erkennbar (dritter Qualitätstest §58).

**Neue Methode (`tools/build-map-art.js`, ersetzt `tools/generate-map-
geometry.js` vollständig, §37):** 17 handplatzierte geteilte Grenz-
segmente (je eine Punktliste mit bewusst gewähltem, unregelmäßigem
Verlauf — Fluss-Grenzen großzügig geschwungen, übrige Grenzen moderat
organisch), zusammengesetzt zu 16 Territorien-Polygonen. Jedes
Territorium erhält eine Punktwolke (geteilte Segmentpunkte + frei
gezeichnete Außenkurven), nach Winkel um einen bewusst gewählten
Mittelpunkt sortiert — das garantiert ein einfaches, nicht selbst-
überschneidendes Polygon, ohne dass die Form dabei einer Formel folgt.
**Strukturvalidierung statt geometrischer Berechnung:** der Generator
prüft bei jedem Lauf, dass jedes in `TERRITORIES.adjacent` (live aus
`data/gamedata.js` gelesen) deklarierte Paar exakt EIN gemeinsames
Segment referenziert, und dass kein Segment existiert, das nicht
deklariert ist — bricht sonst ab.

**Landschaftskonzept aus bereits vorhandenen Namen abgeleitet (§46/47,
kein neuer Lore erfunden):** "Rheinfeld" (ai2) liegt am namensgebenden
Fluss — der zugleich exakt die drei einzigen Grenzen dieses Reiches zu
seinen Nachbarn bildet (`m_ost|r_nord`, `p_ost|r_west`, `r_sued|b_ost`).
"Bergheim" (ai3) bekommt ein südliches Gebirge. Der im Gameplay ohnehin
nachbarlose Westrand der Karte (m_west/b_west sind Sackgassen) wird zur
"Westmark"-Wildnis — eine einzige, echte benannte Landschaft statt der
vier technischen Voronoi-Lückenfüller aus 8C.1 (§36).

**Besitzerfarbe als Lasur statt Vollfarbe (§15):** `fill-opacity: 0.62`
auf jeder Territoriumsfläche — der Pergament-Untergrund und der Fluss
scheinen an den Rändern durch, statt einer sterilen 100 %-Fläche.

**Ein iteratives Konstruktionsproblem gefunden und gelöst:** die erste
Fassung (Segmente einfach in Aufzählungsreihenfolge zu einem Pfad
verkettet) erzeugte selbstüberschneidende, teils unsichtbare Polygone
(z. B. `m_sued`/`r_west` auf wenige Pixel zusammengequetscht). Ursache:
zu eng benachbarte Grenzbänder ohne Sicherheitsabstand. Behoben durch
(a) großzügige, klar getrennte Nord-Süd-/West-Ost-Bänder für jedes
Territorium und (b) die winkelbasierte Punktsortierung statt
Verkettungsreihenfolge, die Selbstüberschneidungen strukturell
ausschließt, solange die Form grob sternförmig um ihren Mittelpunkt
bleibt.

**Karte wächst von quadratisch (8C.1) zu hochformatig** (`viewBox`
neu `-60 -100 1340 1900`, Seitenverhältnis `1340/1900`) — Raum für den
Fluss als durchgehende Nord-Süd-Achse und deutlich unterschiedliche
Territoriumsgrößen (§5: keine gleichmäßigen Polygone).

**Wiederverwendet aus 8C.1, unverändert:** Besitzerfarben-Palette,
Hover/Selected/Attackable/Ally-Zustände (inkl. des dort gefundenen
Cremeweiß-statt-Gold-Kontrastfixes), Hauptstadt-/Terrain-/Banner-Symbole
(`icon-burg`/`icon-tree`/`icon-hill`/`icon-sword`/`icon-banner`), das
JS-Tooltip-System, das Kontextpanel, die Playwright-Testmethodik.

**Ein reales Overlay-Detail zusätzlich abgesichert:** `#worldMapWild`
und `#worldMapRiver` bekamen explizit `pointer-events: none` (§72) —
bei der bisherigen DOM-Reihenfolge (Wildnis/Fluss unter den Territorien)
war das bereits durch die Zeichenreihenfolge praktisch nie ein Problem,
aber die explizite Regel macht es strukturell unmöglich, unabhängig von
künftigen Änderungen an der Zeichenreihenfolge.

**Bundle-Größe:** 677.811 → 684.506 Bytes (+0,99 %).

## 8. Phase 8D: Hof + Dynastie + Charaktere

Erste Phase, die tatsächlich die MENSCHEN in den Mittelpunkt stellt statt
Regionen/Waren/Karte. Die zugrundeliegenden Systeme (Character Core,
World Memory, Story Threads, Drama Director, Chronicle 2.0) waren seit
Phase 3–7 bereits real und getestet — 8D erfindet keine neue
Spielmechanik, sondern macht Claims/Traits/Loyalität/Beziehungen/
Rivalitäten/Erinnerungen zum ersten Mal lesbar. Alle neuen ViewModels
in `js/ui-viewmodels.js` transformieren ausschließlich bereits reale
`state`-Werte — kein `rnd()`, keine neu erfundenen Zahlen.

**Portrait-Placeholder-System (§5-8):** deterministische Inline-SVG-
Büsten statt Bild-Assets. Ein `hashStringToInt()` (FNV-1a-artiger
String-Hash, kein `rnd()`) wählt aus 5 Haar-/Kopfbedeckungs-Varianten
pro Geschlecht; Alter (`ageGroupOf`) steuert Proportionen/Haarton,
Rang (`PORTRAIT_RANK`) steuert Rahmenfarbe und ein Krone/Nadel-Symbol
für Herrscher/Adel. Verstorbene Charaktere erhalten einen Graustufen-
Filter statt zu verschwinden.

**Heraldik (§49, bewusst klein gehalten — "keine Heraldik-Engine als
neues Projekt"):** `getHeraldryViewModel(houseName)` hasht den
Dynastienamen in feste kleine Paletten (6 Feldfarben, 4 Symbolfarben,
4 Teilungen, 5 Symbole) — ein Wappen-Schild pro Haus, deterministisch,
keine Engine.

**Character Card (§9-14/30-31/86-89):** WHO/Rolle/2 wichtigste Traits/
Loyalität/max. 2 priorisierte Warnbadges (Anspruch > Rivale > korrupt >
niedrige Loyalität) — explizit kein Skill-Dump. `getCharacterRoleLabel`
leitet die Rollenbezeichnung (Thronfolger/Bruder des Herrschers/
Gemahl/Hofamt/...) aus echten Verwandtschafts-/Amts-Feldern ab, nie
erfunden.

**Character Detail (§9-25):** Skills als kompaktes 8er-Grid (keine
Tabelle), Traits als Badges mit echtem Effekttext aus `TRAITS[].effects`
(Tooltip), eine echte Beziehungs-Aufschlüsselung (`computeRelationship
Breakdown` nur mit Anzeige-Labels versehen — memory-basierte
Modifikatoren zeigen wortgleich `memory.description`) und eine echte
Loyalitäts-Aufschlüsselung (`getLoyaltyDisplayViewModel` spiegelt
`computeLoyalty()` rein lesend, Zeile für Zeile, keine zweite
abweichende Formel), visuell klar getrennt (§16). Eine Erinnerungs-
Zeitleiste zeigt nur `isChronicleWorthy()`-relevante Memories (Fallback:
alle, falls keine relevant), begrenzt auf `MEMORY_TIMELINE_LIMIT = 8`,
als vertikale persönliche Historie statt Debug-Liste. Rivalitäten zeigen
den echten Ursprungstext via `rivalryOrigin → memoryId → description`.
Ansprüche werden nie erfunden — nur reale `character.claims`-Einträge
mit `strength !== "none"` erscheinen.

**Hof-Ansicht (§27-35):** Portraitwand statt 6-Text-Slot-Grid — Herrscher/
Gemahl/Thronfolger oben (`#courtRulingRow`), 6 Hofämter darunter
(`#courtOfficesGrid`), jede Karte klickbar → Character Detail.

**Beraterkandidaten-Auswahl (§32-35):** von einer einspaltigen Liste zu
einem 2-4-Wege-Nebeneinander-Vergleich (Portrait/Alter/relevanter Skill/
Traits/Loyalität/Gehaltsforderung) umgebaut — `showAdvisorCandidates()`
komplett ersetzt, `generateAdvisorCandidate(s)`/`confirmAdvisorSelection`/
alle gameplay-wirksamen Funktionen unverändert, nur die Anzeige wurde
neu gebaut.

**Dynastie-/Stammbaum-Ansicht (§36-49, komplett neu):** genealogisch
korrekte Generationenreihen (Eltern/Geschwister → Herrscher+Gemahl →
Kinder) mit einem einzigen zentrierten `.treeConnector`-Balken zwischen
den Generationen statt Node-Graph-Optik (§40) — dieselbe Lehre aus
8C.1/8C.2 (keine algorithmisch wirkende Diagramm-Optik) hier bewusst
auf die Familienstruktur angewendet. Verstorbene bleiben sichtbar,
desaturiert, mit †-Markierung, statt zu verschwinden (§42). Eine
kompakte nummerierte Thronfolgeliste (`getSuccessionViewModel`) spiegelt
exakt die reale Erbenermittlung aus `handleSuccession()` (lebende Kinder,
Alter absteigend) — kein Würfeln, das passiert weiterhin ausschließlich
beim tatsächlichen Herrschertod — plus ein rein datenbasiertes
Streit-Risiko-Flag aus `CONFIG.succession.disputeAgeClosenessYears`.
Frühere Herrscher (`getRulerEras`/`buildRulerBiography`, bereits aus
Chronicle 2.0 real vorhanden) erscheinen in einer eigenen "FRÜHERE
HERRSCHER"-Sektion.

**Story-Thread-Integration (§?, "AKTUELLE GESCHICHTE"):** wenn ein
Charakter Teil eines aktiven Story Threads ist, zeigt sein Detail den
bereits vorhandenen `THREAD_STAGE_TEXT`/`THREAD_ICON_BY_TYPE` (aus 8B)
wieder — keine neue Text-Tabelle.

**Getestet:** alle bestehenden Node-Testsuiten (`character_core_test.js`,
`world_memory_test.js`, `story_thread_test.js`, `chronicle_test.js`,
`drama_director_test.js`, `event_chain_test.js`, `economy_test.js`,
`battle_test.js`) weiterhin grün, keine Regression. `ui_viewmodel_test.js`
um einen neuen Block ergänzt: RNG-Neutralität aller 8D-ViewModels über
einen simulierten 8-Jahres-Zustand, Hash-Determinismus von Portrait/
Heraldik, "Claims nie erfunden" (Charakter ohne echten Claim zeigt
weder Badge noch Detail-Claim), Loyalitäts-Anzeige stimmt exakt mit
`computeLoyalty()` überein, Beziehungs-Aufschlüsselung nutzt wortgleich
echte Memory-Texte, Thronfolge spiegelt echte Alters-Reihenfolge,
Verstorbene bleiben im Stammbaum sichtbar. Zusätzlich umfangreiche
Playwright-Klicktests (Herrscher/Ehepartner/Berater/Kind/Geschwister/
Thronfolger/Verstorbenen öffnen, Kandidat auswählen+ernennen, Jahr
weiter mit Hofansicht-Refresh, Tastatur-Fokus + Enter öffnet Detail,
Save/Load-Rundlauf über die echten `serializeSave()`/`deserializeSave()`)
sowie die vier Sonderfälle aus dem Auftrag: Tod eines Beraters (Amt
zeigt danach korrekt `filled:false`), echte Erbfolge über
`handleSuccession()` (neuer Herrscher = designierter Erbe, alter
Herrscher bleibt als Vorgänger im Stammbaum und in "FRÜHERE HERRSCHER"
sichtbar), Rivale (Status-Badge + erreichbarer Ursprungstext bestätigt),
Claim (reale starke Ansprüche sichtbar, niemals erfunden). Performance:
150 zusätzliche Charaktere direkt in den State injiziert, Hof-/Dynastie-
Rendering blieb bei 87–95 ms pro Seitenwechsel, 0 Laufzeitfehler.
Responsive bei 1920×1080/1440×900/1366×768 geprüft, kein horizontales
Seiten-Overflow, Stammbaum bleibt bei 1366×768 layoutstabil.

**Battle Engine unverändert bestätigt** (`git diff --stat battle-engine/
js/battle-bridge.js` leer). **Kartenwerk aus 8C.2 funktional unverändert**
(kein `js/map-*.js` angefasst). **Keine neue Save-Version** — Phase 8D
liest ausschließlich bereits vorhandene Felder.

**Bundle-Größe:** 684.843 → 729.336 Bytes (+6,5 %; `tools/build-bundle.js`
meldet 725.270 Zeichen für den generierten ersten Script-Block).

## 9. Phase 8E: Diplomatie Redesign

"Aus Beziehungszahlen werden politische Beziehungen." Wie 8D bereits für
Hof/Dynastie galt: die zugrundeliegende Diplomatiemechanik (§2, komplett
in `js/diplomacy.js`/`js/politics.js`/`js/military.js`) ist seit früheren
Phasen real und bleibt unverändert — Beziehungen, Verträge, Krieg,
Kaiserwahlmechanik, Bestechung, Intrigen, World Memory, Rivalitäten,
Claims, Event Chains, Story Threads wurden NICHT angefasst. 8E macht nur
sichtbar, was schon da ist.

**Der eine strukturelle Baustein, der fehlte:** die drei diplomatisch
erreichbaren KI-Regionen (`state.diplomacy.ai1-3`) hatten bis zu dieser
Phase KEINEN Herrscher-Charakter — nur einen Namen und eine
Beziehungszahl. §10/11/38/50 des Auftrags verlangen aber ausdrücklich
eine echte Person (Portrait, Traits, Skills, anklickbare Character-Detail-
Ansicht, ein "Herrscherwechsel im Ausland"). Ohne einen echten Charakter
wäre das nur mit einer zweiten, synthetischen Portrait-/Detaillogik
möglich gewesen — ausdrücklich untersagt (§10: "keine neue zweite
Portraitlogik", §11: "keine doppelte Detailansicht"). Die gewählte
Lösung: `region.rulerId` — EIN echter Character-Core-Charakter pro
KI-Region, über exakt dieselbe `createCharacter()` erzeugt wie jeder
andere Charakter im Spiel (`js/core.js newGame()`), bewusst OHNE Familie
(keine erfundene Genealogie). Verifiziert unschädlich für jedes
bestehende System, das `state.characters` durchläuft (Event-Chain-
Kandidaten, Story-Thread-Signale, Drama-Director-Scan, Berater-
Kandidatenpool) — alle sind über echte Verwandtschaft/Claims/Memories
zum Spieler-Herrscher gated, ein familien- und claimloser fremder
Herrscher erfüllt keine dieser Bedingungen. Der einzig nötige neue
Baustein war ein Tod: `checkForeignRulerDeaths()` (`js/diplomacy.js`)
nutzt dieselbe `rollDeathChance()`-Formel wie der bestehende
Berater-Tod, mit einfacher Neubesetzung statt eines eigenen
Erbfolgesystems (das wäre eine neue Mechanik gewesen). Zwei neue
Memory-Typen (`FOREIGN_RULER_DIED`/`FOREIGN_RULER_SUCCEEDED`) aus
demselben Grund wie `DYNASTY_ENDED` in Phase 7: ohne Memory wäre das
Ereignis für die diplomatische Zeitleiste unsichtbar geblieben.

**Zwei-Ebenen-Hauptansicht (§3/4):** links/mitte eine Liste kompakter
Machtkarten (Portrait, Name, Beziehungs-Tier, max. 2 Warnungen), rechts
die Detailansicht der gewählten Macht — keine Tabelle als Standard (§32).

**Beziehung als natürlicher Zustand (§6):** eine reine UI-Klassifikation
(`RELATION_TIERS`, sieben Stufen ENG VERBÜNDET…ERBITTERTER GEGNER) über
der echten Zahl, keine Gameplaywirkung — testgestützt bestätigt
(`state.diplomacy.ai1.relation` bleibt durch die Anzeige unverändert).

**"Warum stehen wir so zueinander?" (§7):** anders als bei
Charakteren gibt es für die diplomatische Beziehung KEIN gespeichertes
Komponentenmodell — `updateDiplomacy()` ist ein reiner Drift-Akkumulator
ohne Einzelposten. Eine erfundene Zeile-für-Zeile-Zerlegung wie bei
Charakteren wäre daher erfundene Struktur gewesen (§7 "keine Gründe
erfinden"). Ehrlicher Ersatz: aktuelle Verträge/Kriegsstatus + eine echte
World-Memory-Zeitleiste (`getDiplomaticMemoryTimeline()`, nach
`regionIds` statt `actorIds`/`targetIds` gefiltert — diplomatische
Ereignisse wie ALLIANCE_FORMED/WAR_DECLARED/PEACE_SIGNED tragen das
bereits seit Phase 5/6), gefiltert über dieselbe `isChronicleWorthy()`-
Signifikanzprüfung wie die Charakter-Zeitleiste aus 8D.

**Verträge/Krieg als Siegel-/Dokumentkarten (§13-15/33/34):**
`.treatySeal` (goldener Rahmen, Punkt-Siegel) für Bündnis/Handel/
Nichtangriff/Durchmarschrecht/Vasall/Garantie/dynastische Verbindung
— alle aus echten `dip.treaties`/`state.vassals`/`dip.guaranteeFloor`/
`dip.dynasticMarriageFloor`-Feldern. `.warSeal` (rotes Wachssiegel statt
Vollbildwarnung) mit dem echten Kriegsjahr, aus der realen
WAR_DECLARED-Memory rekonstruiert (kein neues Datumsfeld nötig).

**Kaiserwahl-Informationen (§23/24):** alle drei `state.diplomacy`-
Regionen sind im bestehenden Wahlcode (`resolveElection()`) bereits
gleichberechtigte Kurfürsten — hier nur sichtbar gemacht (Kronensymbol +
eine Live-Einschätzung, exakt aus derselben
`knownElectorVoteRelationThreshold`-Schwelle wie die echte Abstimmung,
keine neuen Deals).

**Militärische Einschätzung (§27):** ausschließlich die bereits
vorhandene, unsichere Intel-Schätzung (`state.intel[aiId].rangeLow/
rangeHigh`) gegen die eigene reale Armeestärke verglichen — SCHWÄCHER/
ETWA GLEICH/STÄRKER, keine neue Formel, keine aufgedeckten Exaktwerte.

**Kartenintegration (§28/29):** "Auf Karte zeigen" ruft die bereits aus
8B bestehende `selectMapTerritory()`/Kontextpanel-Auswahl für die
Hauptstadt der gewählten Macht auf — keine neue Kartenmechanik, 8C.2
unangetastet.

**Aktionen neu geordnet, nicht neu erfunden (§19-22):** dieselben
`doDiplomacy()`-Aktionen wie zuvor, nur nach Freundschaft/Handel/Politik
gruppiert (Sekundär-/Ghost-Buttons, Bündnis als einzige "Imperial"-
Aktion). Krieg/Intrigen bleiben bewusst auf der Militär-Seite (Krieg-
Redesign ist explizit nicht Teil dieser Phase) — die Diplomatie-Detailseite
zeigt nur den realen Kriegsstatus plus einen Link zur bestehenden
Kriegskarte, dupliziert die Kriegserklärung nicht.

**Ein echter, universell nützlicher CSS-Fix unterwegs gefunden:**
`[data-tip]:hover::after` (das globale Tooltip-System aus 8B) hatte kein
`pointer-events: none` — bei eng gestapelten Listen (wie der neuen
Machtliste) konnte ein sichtbarer Tooltip Klicks auf das darunterliegende
Element abfangen. Ein Tooltip soll nie Interaktion blockieren; die
Ein-Zeilen-Korrektur behebt das strukturell für alle bestehenden und
künftigen `data-tip`-Elemente, keine Verhaltensänderung des Tooltips
selbst.

**Getestet:** komplette bestehende Node-Testsuite weiterhin grün.
`tests/ui_viewmodel_test.js` um 7 neue Prüfblöcke erweitert (echte
Character-Core-Bürger, RNG-Neutralität, Tier-Klassifikation ohne
Gameplaywirkung, Verträge/Kriegsstatus nur aus echten Feldern,
regionIds-gefilterte Memory-Timeline, Sondertest Herrscherwechsel im
Ausland, keine Loyalität/Beziehung für fremde Herrscher). Playwright:
Diplomatie öffnen, mehrere Mächte auswählen, fremden Herrscher öffnen
(echtes Character-Detail-Modal), Beziehungserklärung, Memory-Timeline,
Vertrag anzeigen, Filter/Sortierung, Kriegserklärung bis zum sichtbaren
Kriegssiegel, Jahr weiter mit korrektem Refresh, Save/Load-Rundlauf,
Tastatur-Fokus + Enter — alle bestanden, 0 Laufzeitfehler. Sondertest
Herrscherwechsel im Ausland: über wiederholte reale
`checkForeignRulerDeaths()`-Aufrufe bei erzwungen kritischer Gesundheit
bestätigt, dass die Diplomatiekarte danach den neuen Herrscher zeigt,
nie die veraltete Person. Responsive bei 1920×1080/1440×900/1366×768
geprüft, kein horizontales Seiten-Overflow.

**Bewusst NICHT Teil dieser Teilphase:** Kaiserwahl 2.0, neue
Diplomatieaktionen/Verträge/Intrigen, Event-Redesign, Krieg-Redesign,
Chronik-Buchansicht (weiterhin 8F-8H). Bundle-Größe 729.336 → 756.621
Bytes (+3,7 %). Battle Engine unverändert (leerer `git diff --stat` für
`battle-engine/` und `js/battle-bridge.js`), Kartenwerk aus 8C.2
unverändert (kein `js/map-*.js` angefasst), keine neue SAVE_VERSION.
Einzige neue `rnd()`-Verbraucher sind `newGame()`
(3 zusätzliche Charaktere) und `checkForeignRulerDeaths()` bei
tatsächlichem Herrschertod — beides reine Weltzustands-Erzeugung über
bereits bestehende, geprüfte Funktionen, keine neuen `rnd()`-Aufrufe in
irgendeinem ViewModel (testgestützt bestätigt).

## 10. Phase 8F: Events + Story Threads Redesign

"Aus Textboxen werden historische Szenen und Entscheidungen." Die
zugrundeliegende Mechanik (`js/event-chains.js`/`js/story-threads.js`/
`js/drama-director.js`, das alte `resolveEvent()`s `apply(r, s)`-Aufruf)
bleibt vollständig unverändert — jede Option führt exakt dieselbe echte
Funktion aus wie vorher, keine Fake-Vorhersagen, keine neue Formel.

**Event-Hierarchie (§2), rein aus echten Signalen abgeleitet:**
MINOR (Standard) / IMPORTANT (die drei bereits bestehenden
`disastersCount`-markierten Random-Events: Seuche/Rebellion/Großfeuer) /
MAJOR (jede Event-Chain-Entscheidung — laut Spieldesign seit Phase 5/6
grundsätzlich bedeutender als ein Flavour-Event) / CRITICAL (Chain-
Entscheidung in einem Thread mit `status === "CLIMAX"` oder
`importance >= 70`, sowie der neue Herrschertod/Erbfolge-Moment). Keine
erfundene Wichtigkeits-Zahl — die einzigen neuen Tabellen
(`DISASTER_EVENT_IDS`, die Schwellen) sind reine UI-Klassifikation.

**Illustrationssystem (§7-12/56-59):** `renderEventIllustration()` in
index.html baut deterministische "Graphic Novel Panel"-Szenen aus
Kategorie + echten Beteiligten — Hash aus Kategorie/Charakter-IDs/Jahr
(`hashStringToInt`), kein `rnd()`. 14 Kategorien
(`EVENT_CATEGORY_INFO`) mit je einer Domäne/Akzentfarbe/Symbol, auf
bereits vorhandene Design-Tokens gemappt (`--accent` Burgunder für
Dynastie/Hof, `--ochre` für Wirtschaft, `--blue` für Diplomatie,
`--purple` [Bronze] für Glaube, `--red-muted` für Krieg). Bestehende
Eventtypen wurden abgebildet: die 10 Event-Chain-Templates tragen
bereits ein reales `category`-Feld (`js/event-chains.js`), die 24
Random-Events wurden von Hand nach bestem thematischem Fit zugeordnet
(§8/9) — ohne sauberen Treffer bleibt es bewusst beim generischen
Rahmen (§56) statt einer erzwungenen Kategorie. Beteiligte Charaktere
erscheinen als Portraitbüste in der Szene — exakt dieselbe
`buildPortraitSvg()` aus 8D, keine zweite Portraitlogik (§12).

**Ein realer, während der Umsetzung gefundener Bug behoben:**
`THREAD_ICON_BY_TYPE` (aus 8B) hatte den Schlüssel `RELIGIOUS_TENSION`
statt des echten Thread-Typs `RELIGIOUS_CONFLICT` (siehe
`STORY_THREAD_TYPES`/`CHAIN_THREAD_TYPE` in `js/story-threads.js`) — ein
Tippfehler, der seit Einführung des Typs in Phase 6 jeden
RELIGIOUS_CONFLICT-Thread stumm auf das "⚜"-Fallback-Symbol
zurückfallen ließ. `THREAD_STAGE_TEXT` bekam außerdem die beiden
fehlenden Status DORMANT/RESOLVED ergänzt (§39 verlangt alle 6).

**Event-Modal neu aufgebaut (§6):** Kategorie+Jahr-Kopfzeile, bei
MAJOR/CRITICAL eine Illustrationsspalte + Titel/Story/Beteiligte
(`getCharacterCardViewModel`, nur story-relevante Fakten statt Skills,
§13), bei MINOR/IMPORTANT kompakt ohne Illustration (§3). Story-Kontext
(§18-21) nur wenn die Entscheidung wirklich zu einer Chain/einem Thread
gehört: Thread-Titel, natürlichsprachlicher Stand
(`THREAD_STAGE_TEXT`), max. 4 Timeline-Beats aus der echten
`chain.history`, eine "VORGESCHICHTE"-Zeile nur wenn eine echte
`chain.originatingMemoryIds`-Memory existiert.

**Entscheidungskarten statt Buttons (§23/24/26/27):** Optionen kennen
nur `label`/`outcome`/eine Blackbox-`effect`-Funktion — keine
deklarierten Folgen. Ein "(-NNN Taler)"-Hinweis, der bereits wörtlich im
echten Label steht, wird als eigene Kosten-Zeile herausgelöst (dieselbe
Textinfo, nur anders dargestellt) — keine Fake-Vorhersagen, keine
Gut/Böse-Farblogik (§29), da keine Ton-Tags (CONCILIATORY/PRAGMATIC/...)
im Datenmodell existieren (§28 "nur falls Tags vorhanden" — gibt es
nicht, daher konsequent weggelassen statt erfunden).

**Herrschertod + Erbfolge (§47-49/73):** bisher unsichtbar (nur eine
Chronik-Zeile) — `handleSuccession()` (`js/population-dynasty.js`)
queued jetzt am Ende einen CRITICAL `pendingEvent` (`source:
"SUCCESSION"`) mit dem alten (desaturiert, † markiert) und neuen
Herrscher als Beteiligte, reine Bestätigung ohne echte Entscheidung
(§48: der bestehende Tod-/Erbfolge-Ablauf selbst bleibt unverändert,
nur ein bereits abgeschlossenes Ergebnis wird sichtbar gemacht).
Garantiert konfliktfrei mit anderen Event-Quellen desselben Jahres, da
`updateDynasty()` vor jeder anderen Event-Quelle in `advanceYear()`
läuft und `pendingEvent` zu Jahresbeginn immer leer ist.

**Geburt/Vermählung (§50/51):** die bestehenden `birthModal`/
`marriageModal` bekamen Portraits ergänzt (Kind bzw. Herrscher+Gemahl(in)
mit Ring-Siegel) — Funktionen/Ablauf (`confirmBirthName`/
`closeMarriageAnnouncement`) komplett unverändert.

**Story-Ansicht (§35-42, neu):** `#storyViewModal`, erreichbar über die
jetzt klickbare/tastaturbedienbare Story Card aus 8B. Zeigt max. 4
aktuell relevante Threads (DORMANT ausgeschlossen, wie schon die
bestehende `getPrimaryStoryViewModel`-Filterung) mit natürlichsprachlichem
Stand, Beteiligten, letztem Ereignis, kompakter Historie, sowie einen
kurzen Link zu kürzlich abgeschlossenen Geschichten (§41) — keine
Tension-/Momentum-/Director-Zahlen (§37/93, bleiben im Debug-Panel).

**Getestet:** komplette bestehende Node-Testsuite weiterhin grün.
`tests/ui_viewmodel_test.js` um 21 neue Prüfungen ergänzt (Herrschertod/
Erbfolge als CRITICAL mit beiden Figuren, Severity nur aus echten
Signalen, Kategorie-Auflösung über die echte Chain statt eines nicht
existierenden Felds, Entscheidungskarten erfinden keine Folgen,
Story View ohne Debug-Werte, RNG-Neutralität, der Icon-Tippfehler-Fix).
Playwright: MINOR/IMPORTANT/MAJOR/CRITICAL-Events beobachtet und
geprüft, Chain-Event mit korrektem Titel/Beteiligten/Story/Optionen,
Sondertest Succession (beide Figuren korrekt), Sondertest Rivale (echte
Badges, echter Story-Kontext), Hungerkrise, Character Detail aus dem
Event öffnen, Story Context/View öffnen, Entscheidungskarten klickbar
und tastaturbedienbar (Enter), Vermählung/Geburt mit Portraits,
Save/Load mit aktivem Event (Rundlauf identisch), mehrjährige
Simulation ohne Laufzeitfehler. Responsive bei 1920×1080/1440×900/
1366×768 geprüft (Illustration verkleinert sich, Optionen stapeln sich,
Titel/Optionen bleiben sichtbar, nur der Inhaltsbereich scrollt intern).

**Bewusst NICHT Teil dieser Teilphase:** Krieg/Battle-UI-Redesign,
Chronik-Buchansicht, Kaiserwahl 2.0, neue Event Chains, veränderte
Story-/Drama-Director-Mechanik (weiterhin 8G/8H). Bundle-Größe 756.621
→ 785.147 Bytes (+3,8 %). Battle Engine unverändert, Kartenwerk aus 8C.2
unverändert, keine neue SAVE_VERSION, 0 neue `rnd()`-Aufrufe in
irgendeinem ViewModel.

## 11. Screen Inventory (Status nach Phase 8A + 8B + 8C + 8C.1 + 8C.2 + 8D + 8E + 8F)

| Screen/Bereich | Status | Anmerkung |
|---|---|---|
| Design Tokens (Farben/Typografie/Spacing/Radius/Schatten/Buttons/Z-Index) | **REDESIGNED** | 8A, siehe Abschnitt 3 |
| Titelbildschirm / Intro | **REDESIGNED** | erbt Tokens vollständig, Layout unverändert (bereits zentral/emotional, §123/124 im Kern schon erfüllt) |
| Charaktererstellung | **REDESIGNED** | erbt Tokens, Formularstruktur unverändert |
| Hauptbildschirm REICH (Karte/HUD/Nav/Kontextpanel/Story Card/Warnungen) | **REDESIGNED** | 8B, siehe Abschnitt 5 — neuer Standardbildschirm |
| Topbar (Herrscher/Jahr/Schatz/Bevölkerung/Prestige/Legitimität/Nahrung) | **REDESIGNED** | 8B — Herrscher groß/zuerst, Werte als Icon+Zahl+Tooltip |
| Hauptnavigation | **REDESIGNED** | 8B — schmale vertikale Seitenleiste statt horizontaler Tableiste, 7 Einträge (bestehende 6 + neu REICH) |
| PROVINZ-Tab (Bevölkerung/Nahrung/Kassenbuch) | **REDESIGNED** | 8C — Balken statt Tabelle, Detail-auf-Klick, Mini-Kassenbuch; Regierungs-Regler/Kornausgabe/Chronik unverändert |
| WIRTSCHAFT-Tab (Waren/Steuern/Handel/Risiken) | **REDESIGNED** | 8C — Kategorie-Karten statt 24-Zeilen-Tabelle, Preiserklärung + Produktionskette auf Klick; Regionalhandel/Arbitrage-Panel unverändert |
| Kontextpanel WIRTSCHAFT/BEVÖLKERUNG-Tabs | **REDESIGNED** | 8C — echte Top-Produktion/Engpässe/Jahreswachstum, für Spieler- UND KI-Regionen |
| Hof-Panel (Seiteninhalt) | **REDESIGNED** | 8D — Portraitwand (Herrscher/Gemahl/Thronfolger + 6 Hofämter) statt 6-Text-Slot-Grid, siehe Abschnitt 8 |
| Diplomatie-Panel (Seiteninhalt) | **REDESIGNED** | 8E — Machtkarten-Liste + Detailansicht statt Beziehungstabelle, siehe Abschnitt 9 |
| Militär-Panel (Seiteninhalt) | **REDESIGNED** (Tokens) / **LEGACY** (Struktur) | weiterhin über die Navigation erreichbar, Informationsarchitektur unverändert (das ist 8G) |
| Gebäude/Land/Schulden-Panels | **REDESIGNED** (Tokens) / **LEGACY** (Struktur) | unverändert, kein Baufortschritt (keine Datenbasis, §Abschnitt 5) |
| Event-Modal (Titel/Illustration/Story/Beteiligte/Entscheidungskarten) | **REDESIGNED** | 8F — Event-Hierarchie, deterministisches Illustrationssystem, Story-Kontext, siehe Abschnitt 10 |
| Geburt-/Heirat-Modals | **REDESIGNED** | 8F — Portraits ergänzt (Kind bzw. Herrscher+Gemahl(in) mit Ring-Siegel), Ablauf unverändert |
| Kassenbuch-Modal | **REDESIGNED** (Tokens) / **LEGACY** (Struktur) | unverändert, kein Scope dieser Phase |
| Kampf-Overlay | **REDESIGNED** (Tokens) | Battle Engine unverändert (§61 bestätigt), Strukturaufwertung ist 8G |
| Kriegskarte-Overlay | **REDESIGNED** (Tokens) | Kartenstil (handgezeichnete Landkarte) weiterhin nicht vertieft, bleibt als reines Kriegs-Overlay bestehen |
| Welt-/Regionskarte als Hauptbildschirm-Zentrum | **REDESIGNED** | 8B (Layout/HUD/Kontextpanel) + 8C.1 (Node-Grafik → politische Flächenkarte) + 8C.2 (Voronoi → handgestaltete Landschaftskarte mit Fluss/Wildnis, Abschnitt 7) |
| Charakterportraits/Placeholder-System | **REDESIGNED** | 8D — deterministisches Inline-SVG-Bust-System (Hash statt `rnd()`), rangbasierte Rahmen, siehe Abschnitt 8. Topbar-Portrait bleibt bewusst der einfache Emoji-Platzhalter (kein Scope dieser Phase) |
| Character Card / Character Detail | **REDESIGNED** | 8D — neue `#characterDetailModal`, Skills als Grid, Traits als Badges mit echtem Effekttext, echte Beziehungs-/Loyalitäts-Aufschlüsselung, Erinnerungs-Zeitleiste, siehe Abschnitt 8 |
| Dynastie-/Stammbaum-Ansicht | **REDESIGNED** | 8D — neuer `#dynastiePage`, genealogische Generationenreihen statt Node-Graph, Thronfolgeliste, frühere Herrscher, siehe Abschnitt 8 |
| Story-Thread-Spieler-UI | **REDESIGNED** | 8F — neue `#storyViewModal` ("Geschichten am Hof"), erreichbar über die jetzt klickbare Story Card aus 8B, siehe Abschnitt 10 |
| Chronik-als-Buch-Ansicht | **LEGACY** | noch nicht begonnen (8H, bestehende `#chronicle`-Liste bleibt) |
| Game Over / Dynastie-Ende-Inszenierung | **REDESIGNED** (Tokens) | Struktur unverändert |
| Debug-Panel | **REDESIGNED** (Tokens) | bewusst weiterhin optisch als Debug erkennbar (§146), keine Graphic-Novel-Anmutung gewünscht |
| Responsive/Accessibility-Politur (8I) | **PARTIAL** | 8B bereits bei 3 Pflichtauflösungen getestet und angepasst (siehe Abschnitt 5), ein finaler Accessibility-/Polish-Pass über ALLE Screens bleibt 8I vorbehalten |

**Ehrliche Einordnung:** 8A lieferte das Design-System, 8B den
map-zentrierten Hauptbildschirm mit echter HUD/Kontextpanel/Story-Card/
Warnungs-Funktionalität, 8C machte REICH/PROVINZ/WIRTSCHAFT aus rohen
Tabellen zu einer lesbaren, aber weiterhin vollständig ehrlichen
Herrschaftsübersicht (Status-Wörter, Progressive Disclosure, keine
erfundenen Trends), 8C.1 ersetzte die Node-Grafik-Optik der Weltkarte
durch eine echte politische Flächenkarte (Territorien/Grenzen/Land/
Herrschaft statt Kreise/Linien), 8C.2 verwarf die dabei noch als
Voronoi-Diagramm erkennbare Geometrie zugunsten 16 handplatzierter
Territorien mit einer eigenen Landschaftsidentität (Fluss, Gebirge,
benannte Wildnis) — fünf Teilphasen zusammen bereits ein klar
sichtbarer Wechsel weg vom "Dashboard"-Look hin zu "das ist mein Reich".
8D lieferte den in §72-73/71/70 aufgeschobenen ersten der strukturellen
Neubauten: Hof-Charakterkarten, Character-Detail mit echter Beziehungs-/
Loyalitäts-/Erinnerungs-Aufschlüsselung und der Stammbaum — der Spieler
sieht jetzt Menschen mit Rollen/Ansprüchen/Rivalitäten/Geschichte statt
Zahlenzeilen (§98). 8E überträgt dieselbe Lehre auf die Außenpolitik:
fremde Herrscher sind jetzt Personen aus derselben Charakterwelt statt
einer Beziehungstabelle, Verträge/Krieg lesen sich als Siegel/Dokumente
statt Checkboxen. 8F schließt die Kette: bedeutende Ereignisse sind
jetzt historische Momente mit Illustration, echten Beteiligten und
Story-Kontext statt Titel/Text/Button, der Herrschertod bekam nach
sechs Phasen erstmals eine sichtbare Inszenierung, und die Story Card
aus 8B öffnet jetzt eine echte Geschichten-Ansicht. Chronik-Buch und
Kampf-Neuinszenierung bleiben weiterhin bewusst NICHT Teil dieser
Teilphase — sie sind laut Auftrag selbst als 8G–8H vorgesehen.
