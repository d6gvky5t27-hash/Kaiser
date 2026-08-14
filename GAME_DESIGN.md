# KAISERREICH – Aufstieg einer Dynastie (Arbeitstitel)

Design-Philosophie: **1986 außen – 2026 innen.** Retro-Pixel-Optik (320×200-Basis,
integer scaling), moderne Simulationstiefe darunter. Die Simulation ist die
Wahrheit, die UI stellt sie nur dar.

## Kernschleife (v0.1 Vertical Slice)
Start 1500 → Region betrachten (Bevölkerung/Vorräte) → Landwirtschaft/Steuern
festlegen → Gebäude bauen → Jahr vergeht → Ernte & Bevölkerung & Preise werden
berechnet → Nachbarn handeln/entwickeln sich autonom → ggf. Ereignis →
erneute Entscheidung.

## Systeme (Module, siehe js/)
- `state.js` – GameState (Single Source of Truth)
- `economy.js` – Preisbildung aus Angebot/Nachfrage, Produktionsketten
- `population.js` – Bevölkerungsgruppen, Zufriedenheit, Geburten/Tode/Hunger
- `agriculture.js` – Ernte abhängig von Fruchtbarkeit × Wetter
- `trade.js` – einfache Händler-KI zwischen Regionen (Preisgefälle abbauen)
- `buildings.js` – Bauwerke, Baukosten, Effekte
- `events.js` – datengetriebenes Event-System (Trigger/Bedingung/Optionen/Folgen)
- `ai.js` – Nachbarregionen handeln unabhängig vom Spieler
- `titles.js` – Adelsleiter (Freiherr → Kaiser), Aufstiegsbedingungen
- `chronicle.js` – automatische Reichschronik
- `ui.js` / `render.js` – Canvas-Rendering, Pixel-Font-Ersatz, Menüs

## Datenmodell (v0.1)
**Region**: name, owner("player"|aiId), population{gruppen}, fields, fertility,
warehouse{ware:menge}, buildings[], taxRate, satisfaction, treasury(nur player),
prestige(nur player)

**Ware**: id, name, basePrice, category
Waren v0.1: Getreide, Holz, Eisen, Wolle, Bier, Werkzeuge

**Bevölkerungsgruppe**: id, name, count, wealth, satisfaction
Gruppen v0.1: Bauern, Handwerker, Händler, Adel, Arme

**Gebäude**: id, name, cost, buildTime, effect (z.B. +Getreideproduktion)
v0.1: Bauernhof, Getreidespeicher, Markt, Mühle, Sägewerk, Schmiede, Brauerei,
Rathaus, Kaserne, Stadtmauer (10 Typen gemäß Spec §72)

## Preisbildung (Kern-Formel v0.1)
```
demandFactor = (Nachfrage - Angebot) / max(Angebot, 1)
price = basePrice * clamp(1 + demandFactor * 0.6, 0.4, 3.0)
```
Angebot = Lagerbestand + Produktion dieser Runde.
Nachfrage = Bevölkerungsbedarf (pro Gruppe unterschiedlich gewichtet).

## Adelsleiter
Freiherr → Baron → Graf → Landgraf → Markgraf → Fürst → Herzog → Kurfürst →
König → Kaiser. Aufstieg erfordert Kombination aus Bevölkerung, Wohlstand,
Prestige, Zufriedenheit der Nachbarn (v0.1: vereinfachte Schwellenwerte,
Kaiserwahl-Mechanik folgt in Phase 10).

## Nicht in v0.1 (folgt in späteren Phasen, siehe ROADMAP.md)
Charaktersystem/Dynastie, Diplomatie, Militär/Schlachten, Intrigen, Religion,
Kaiserwahl, Informationsunsicherheit, Berater, Hof, Speichersystem,
Localization, Modding-Loader (Daten sind aber schon als JS-Objekte getrennt).

## Entscheidungsregel für neue Mechaniken (§81 der Spec)
1. Erzeugt sie interessante Entscheidungen? 2. Wechselwirkungen mit anderen
Systemen? 3. Mehrere sinnvolle Strategien? 4. Kann die KI sie nutzen?
5. Langfristige Konsequenzen? — Sonst überarbeiten.
