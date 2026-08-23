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

## 5. Screen Inventory (Status nach Phase 8A + 8B)

| Screen/Bereich | Status | Anmerkung |
|---|---|---|
| Design Tokens (Farben/Typografie/Spacing/Radius/Schatten/Buttons/Z-Index) | **REDESIGNED** | 8A, siehe Abschnitt 3 |
| Titelbildschirm / Intro | **REDESIGNED** | erbt Tokens vollständig, Layout unverändert (bereits zentral/emotional, §123/124 im Kern schon erfüllt) |
| Charaktererstellung | **REDESIGNED** | erbt Tokens, Formularstruktur unverändert |
| Hauptbildschirm REICH (Karte/HUD/Nav/Kontextpanel/Story Card/Warnungen) | **REDESIGNED** | 8B, siehe Abschnitt 5 — neuer Standardbildschirm |
| Topbar (Herrscher/Jahr/Schatz/Bevölkerung/Prestige/Legitimität/Nahrung) | **REDESIGNED** | 8B — Herrscher groß/zuerst, Werte als Icon+Zahl+Tooltip |
| Hauptnavigation | **REDESIGNED** | 8B — schmale vertikale Seitenleiste statt horizontaler Tableiste, 7 Einträge (bestehende 6 + neu REICH) |
| Provinz/Hof/Wirtschaft/Diplomatie/Militär-Panels (Seiteninhalt) | **REDESIGNED** (Tokens) / **LEGACY** (Struktur) | weiterhin über die Navigation erreichbar, Informationsarchitektur innerhalb der einzelnen Seiten unverändert (das ist 8C/8D/8E/8G) |
| Event-/Geburt-/Heirat-/Kassenbuch-Modals | **REDESIGNED** (Tokens) / **LEGACY** (Struktur) | kein Illustrationsbereich (§56-58), das ist 8F |
| Kampf-Overlay | **REDESIGNED** (Tokens) | Battle Engine unverändert (§61 bestätigt), Strukturaufwertung ist 8G |
| Kriegskarte-Overlay | **REDESIGNED** (Tokens) | Kartenstil (handgezeichnete Landkarte) weiterhin nicht vertieft, bleibt als reines Kriegs-Overlay bestehen |
| Welt-/Regionskarte als Hauptbildschirm-Zentrum | **REDESIGNED** | 8B — siehe Abschnitt 5 |
| Charakterportraits/Placeholder-System | **LEGACY** | noch nicht begonnen (8D) — Topbar-Portrait ist bewusst nur ein einfacher Emoji-Platzhalter |
| Dynastie-/Stammbaum-Ansicht | **LEGACY** | noch nicht begonnen (8D) |
| Story-Thread-Spieler-UI | **REDESIGNED** (Story Card, Kurzform) / **LEGACY** (volle Ansicht) | 8B liefert nur die kompakte Fokus-Karte auf dem Hauptbildschirm (§12-15/43), eine vollständige Story-Thread-Liste/-Historie im Spieler-UI ist 8F |
| Chronik-als-Buch-Ansicht | **LEGACY** | noch nicht begonnen (8H, bestehende `#chronicle`-Liste bleibt) |
| Game Over / Dynastie-Ende-Inszenierung | **REDESIGNED** (Tokens) | Struktur unverändert |
| Debug-Panel | **REDESIGNED** (Tokens) | bewusst weiterhin optisch als Debug erkennbar (§146), keine Graphic-Novel-Anmutung gewünscht |
| Responsive/Accessibility-Politur (8I) | **PARTIAL** | 8B bereits bei 3 Pflichtauflösungen getestet und angepasst (siehe Abschnitt 5), ein finaler Accessibility-/Polish-Pass über ALLE Screens bleibt 8I vorbehalten |

**Ehrliche Einordnung:** 8A lieferte das Design-System, 8B den
map-zentrierten Hauptbildschirm mit echter HUD/Kontextpanel/Story-Card/
Warnungs-Funktionalität — beide zusammen bereits ein klar sichtbarer
Wechsel weg vom "Dashboard"-Look hin zu "das ist mein Reich". Die in
§72-73/71/70 explizit aufgeschobenen STRUKTURELLEN Neubauten (Hof-
Charakterkarten, Stammbaum, Event-Illustrationen, Diplomatie-Umbau,
Chronik-Buch, Kampf-Neuinszenierung) sind weiterhin bewusst NICHT Teil
dieser Teilphase — sie sind laut Auftrag selbst als 8C–8H vorgesehen.
