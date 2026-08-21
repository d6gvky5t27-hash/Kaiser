# KAISERREICH — Game Design Document

Stand: 2026-08-21 (nach Schritt 40). Diese Datei beschreibt **die
tatsächlich implementierte Mechanik**, nicht eine Wunschliste — das ist per
Master-Prompt Punkt 80 ausdrücklich gefordert. Für offene Ideen/nächste
Schritte siehe `ROADMAP.md`. Für eine Datei-für-Datei-Beschreibung des
Codes siehe `CODE_AUDIT.md`. Für eine 105-Punkte-Spec-Abdeckungsprüfung
siehe `STATUS_ANALYSE.md`.

Die vorherige Fassung dieses Dokuments (v0.1-Vertical-Slice-Stand) ist damit
ersetzt — sie beschrieb ein Canvas-/Pixel-Font-Rendering und Modulnamen
(`state.js`, `agriculture.js`, `ai.js`, `ui.js`/`render.js`), die im
tatsächlichen Code nie so existiert haben oder seither umbenannt wurden
(siehe `CODE_AUDIT.md` Abschnitt 1 für die echten Dateinamen).

---

## Design-Philosophie

Comic-Renaissance-Optik (siehe unten, "Präsentation") über einer echten,
deterministischen Simulation — die Simulation ist die Wahrheit, die UI
stellt sie nur dar (jeder angezeigte Wert stammt aus einer echten
Berechnung, keine Blackbox-Zahlen, siehe die "Warum passiert etwas"-
Tooltip-Aufschlüsselungen bei Preisen/Bevölkerung/Kasse).

## Kernschleife

Start 1500, eine von 10 wählbaren realen europäischen Startregionen →
Provinz betrachten (Bevölkerung/Vorräte/Zufriedenheit) → Steuersatz/
Kornverteilung/Regierungsstil einstellen, Gebäude bauen/ausbauen, Berater
anwerben/ausbauen, Truppen ausheben, Diplomatie betreiben → Monat vergehen
lassen (12×/Jahr, mit sofort sichtbarer Kassenbuch-Wirkung) → nach dem 12.
Monat: Ernte, Bevölkerungsentwicklung, Preise, Diplomatie-Update, KI-
Regionsentwicklung, ggf. Ereignis, Kaiserwahl-Prüfung, KI-Kriegsinitiative →
erneute Entscheidung. Fernziel: Kaiser werden (Kaiserwahl als Kurfürst) —
oder eine von vier alternativen Siegbedingungen (Reichtum, Handelsmacht,
militärische Dominanz, Endlosmodus).

## Systeme (siehe `CODE_AUDIT.md` für die genaue Datei-Zuordnung)

- `core.js` — GameState-Erzeugung (`newGame()`), RNG, Gebäude-Parzellen,
  Speichersystem
- `economy.js` — Angebot/Nachfrage-Preisbildung, Produktionsketten, Wetter,
  Kornbilanz/-verderb, Regionalhandel, KI-Regionsentwicklung, Forschung
- `population-dynasty.js` — Bevölkerungsgruppen (Geburt/Tod/Hunger/Seuche),
  Migration, Charaktere/Heirat/Erbfolge
- `politics.js` — Titelaufstieg, Kaiserwahl, Regierungsstil, Religion
- `diplomacy.js` — 12 diplomatische Aktionen, Beziehungen, 6 Intrigenarten
- `military.js` — Berater, Truppenaushebung, Armeestärke, KI-Kriegsentscheidung
- `war-map.js` — strategische Kriegskarte (16 Gebiete), Truppenbewegung,
  gebietsweise Eroberung
- `advance-year.js` — der zentrale Runden-Orchestrator (Monats-/Jahrestakt)
- `battle-bridge.js` + `battle-engine/*.js` — eigenständige taktische
  Kampf-Engine (6 Phasen, Formationen, Taktiken, Gelände, Moral)
- `index.html` (2. Script-Block) — DOM-Rendering, Modals, Eingabe-Handler

## Datenmodell (aktueller Stand)

**Region** (`state.regions.player` / `.ai1-3` / Extra-Regionen):
`name`, `isPlayer`, `fertility`, `population{10 Gruppen}`,
`warehouse{23 Waren}`, `buildings[]` (Parzellen-Instanzen mit Level),
`taxRate`, `governanceStyle` (0–100, 50=neutral), `extraGrainRate`,
`land`, `infrastructureLevel`, `settlementTier`, `priceNoise`,
`commander` (nur KI-Regionen), plus zahlreiche pro-Jahr berechnete
Anzeigefelder (`lastPopBreakdown`, `lastPopSummary`, `lastNetMigration`,
`grainRatio`, `prices`, …).

**Charakter**: `name`, `surname`, `gender`, `age`, `health`, `stats{6 Werte:
Intelligenz/Diplomatie/Verwaltung/Militär/Handel/Charisma}`, `traits[]`
(bis zu 2, aus 10 möglichen), `spouseId`, `parentId`, `childrenIds[]`,
`alive`. Ein Charakter-Dictionary (`state.characters`) für Herrscher,
Ehepartner, Kinder UND Berater (letztere zusätzlich mit `advisorRole`).

**Ware**: 23 Stück (`GOODS`), inkl. zweistufiger Produktionsketten
(Holz→Papier→Bücher, Getreide→Mehl→Brot).

**Gebäude**: 25 Typen (`BUILDINGS`), mehrfach baubar (Parzellen-System,
Kapazität abhängig von Landfläche) und einzeln ausbaubar (Level 1..
`CONFIG.buildings.maxLevel`).

**Berater**: 6 Ämter (`ADVISOR_ROLES`) — Schatzmeister, Marschall, Diplomat,
Spionagemeister, Geistlicher, Handelsberater. Jedes Amt hat einen eigenen
Grundpreis und ist bis Stufe 3 ausbaubar (`CONFIG.advisors.maxLevel`),
Wirkung skaliert linear mit der Stufe.

**Kriegsgebiet**: 16 `TERRITORIES` über die 4 kriegsfähigen Regionen
(Spieler + ai1/ai2/ai3), mit Nachbarschaftsgraph (`adjacent[]`),
Geländetyp, Hauptstadt-Flag.

## Preisbildung (Kernformel)

```
demandFactor = (Nachfrage - Angebot) / max(Angebot, 1)
price = basePrice * clamp(1 + demandFactor * 0.6, 0.4, priceMax) * priceNoise
```
Angebot = Lagerbestand + Produktion dieser Runde. Nachfrage =
Bevölkerungsbedarf (pro Gruppe unterschiedlich gewichtet, `POP_GROUPS[pid].needs`).
`priceNoise` (Marktspekulation) driftet unabhängig von Angebot/Nachfrage
leicht Jahr für Jahr.

## Steuersystem

Steuerkraft je Bevölkerungsgruppe unterscheidet sich
(`POP_GROUPS[pid].weight` — Adel/Händler/Bürger tragen anteilig mehr bei
als Bauern/Tagelöhner/Arme) statt eines pauschalen Pro-Kopf-Satzes. Läuft
monatlich (÷12 der Jahresformel), moduliert durch Schatzmeister-Bonus und
Verwaltungs-Technologie.

## Regierungsstil

Ein echter, beidseitiger Regler (0=sehr fair .. 50=neutral/wirkungsfrei ..
100=gierig): fair kostet Staatseinnahmen, hebt aber Zufriedenheit/
Legitimität; gierig umgekehrt. Live-Vorschau im UI zeigt die jährliche
Wirkung in Talern/Zufriedenheit/Legitimität, bevor der Spieler den Regler
loslässt.

## Adelsleiter

Freiherr → Baron → Graf → Landgraf → Markgraf → Fürst → Herzog → Kurfürst →
König → Kaiser (`TITLES`, 10 Stufen). Aufstieg erfordert eine Kombination
aus Bevölkerung, Staatskasse und Prestige (Schwellenwerte pro Stufe); König
zusätzlich einen fertiggestellten Palast. Der letzte Schritt zum Kaiser
läuft ausschließlich über die Kaiserwahl (Kurfürstenstimmen + Bestechung),
nicht automatisch per Schwellenwert. **Bewusst so kalibriert, dass rein
passives Spiel (keine Spieleraktion) praktisch nie über den Startitel
"Freiherr" hinauskommt** — siehe `BASELINE.md`, 30/30 passive Läufe
bestätigen das.

## Kriegskarte (strategische Ebene über der taktischen Kampf-Engine)

"Krieg erklären" eröffnet eine andauernde Kampagne statt einer
Sofortschlacht: der Spieler stationiert/verschiebt Truppen zwischen den 16
Gebieten und greift benachbarte gegnerische Gebiete an, jeder einzelne
Zusammenstoß läuft über die volle interaktive Kampf-Engine (Formation,
Taktik, Gelände, Moral, Entscheidungspunkte während der Schlacht). KI-
Regionen erholen ihre Garnisonen jährlich und können selbst ein
Grenzgebiet des Spielers zurückangreifen. Erobert der Spieler alle
Heimatgebiete einer Region, unterwirft sie sich automatisch als Vasall.

## Dynastiesystem

Ein einzelner "aktiver" Charakter (der Herrscher) altert, heiratet (rein
wahrscheinlichkeitsbasiert im heiratsfähigen Alter), bekommt Kinder,
stirbt (alters-/gesundheitsbasierte Wahrscheinlichkeit). Beim Tod erbt das
älteste noch lebende Kind; mehrere nahe beieinander liegende Erben können
einen Erbfolgestreit auslösen (Zufriedenheits-/Prestige-/Legitimitäts-
kosten). **Ohne lebenden Erben endet die Partie sofort** (`gameOver =
"no_heir"`) — laut Baseline mit 53% die häufigste Game-Over-Ursache bei
rein passivem Spiel. Kein Spielerhebel, das aktiv zu beeinflussen (Heirat/
Geburt sind nicht steuerbar) — ein bewusst dokumentierter Designpunkt für
eine mögliche spätere Vertiefung, kein aktueller Bug.

## Bekannte, bewusste Vereinfachungen (nicht implementiert, siehe ROADMAP.md)

Charaktereigenschaften mit spürbaren Effekten existieren bereits (10
Traits), aber kein Beziehungs-Ursachen-Log zwischen einzelnen Charakteren,
kein Rivalensystem über Generationen, keine World-Memory-Struktur, keine
Eventketten (23 isolierte Events statt verketteter Handlungsstränge), keine
Berater-Kandidatenauswahl (ein Kandidat wird automatisch zugewiesen statt
mehrerer zur Wahl), keine differenzierten Herrscher-Todesursachen (nur
Alter/Gesundheit). Diese Lücken sind absichtlich hier dokumentiert, weil sie
genau die Bereiche sind, die der "Next Generation"-Master-Prompt als
nächste Vertiefungsrichtung vorschlägt — siehe ROADMAP.md, Abschnitt
EXPERIMENTAL.

## Entscheidungsregel für neue Mechaniken

Erzeugt sie eine interessante Entscheidung oder eine erinnerungswürdige
Geschichte? Wechselwirkt sie mit anderen Systemen? Ermöglicht sie mehrere
sinnvolle Strategien? Kann die KI sie sinnvoll nutzen? Hat sie langfristige
Konsequenzen? — Wenn nein: vereinfachen, überarbeiten oder weglassen, statt
sie trotzdem hinzuzufügen (Kernregel aus dem "Next Generation"-Master-Prompt,
Abschnitt 88/89: Qualität vor Quantität).
