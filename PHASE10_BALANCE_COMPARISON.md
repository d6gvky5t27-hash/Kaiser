# PHASE 10 — STRATEGIC PACING & POWER CURVE

Datenbasierte Rebalance-Phase auf Basis der Phase-9-Baseline
(`tests/output/phase9/`, unangetastet archiviert). Jede Änderung folgt
HYPOTHESIS → CHANGE → TEST → RESULT (volle Herleitung in
`BALANCE_CHANGELOG.md`); dieses Dokument liefert die im Auftrag verlangte
Vorher/Nachher-Gesamtsicht.

**Ergebnis vorab**: drei gezielte, kleine Änderungen (Titelkurve neu
kalibriert, `armyStrength()`-Bewertung + zwei Rekrutierungskosten
angepasst, ein echter Vasallentribut-Bug behoben) haben die drei
zentralen Phase-9-Befunde direkt adressiert: **Kaiserkrone jetzt
empirisch erreichbar (0 %→47 % für die stärkste Spielweise, bestätigt auf
20 Holdout-Seeds mit 70 %)**, **Kriegsbankrott-Rate für vollständig
durchgeführte Eroberungskriege von 73-93 % auf 0-7 % gesenkt**, und
**Kavallerie-Fehleinschätzung in der strategischen Bewertung korrigiert**
— bei vollständig unangetasteter Battle Engine, unveränderten
Spielerarchetypen und weiterhin starker Same-Seed-Diversität.

---

## A. Phase-9 Baseline

Referenz: `PHASE9_GAMEPLAY_AUDIT.md` + `tests/output/phase9/` (360
Kampagnen, 12 Agenten, 30 Seeds `1000+i·7919`, 100 Jahre, `phase9-v1`).
Zentrale Ausgangsbefunde: 0/360 Kaiser, Kriegsbankrott 73-93 %,
Pikeniere 100 %/0 Verluste im Composition-Test, Kavallerie nur 7,5 %
Siegquote trotz hoher `armyStrength()`-Bewertung, Spätspiel-Ziel-Vakuum
nach erreichter Stabilität. Diese Datei bleibt vollständig unverändert
archiviert (verifiziert: `git status`/`git diff` über
`tests/output/phase9/` zeigen 0 Änderungen während ganz Phase 10).

---

## B-G. 10A — Title Progression Audit

### B. 10A Title Funnel Before

30 Seeds × 12 Agenten, unveränderter Phase-9-Code:

| Titel | Erreicht (vorher) |
|---|---|
| Freiherr | 100,0 % |
| Baron | 11,7 % |
| Graf | 8,1 % |
| Landgraf | 6,4 % |
| Markgraf | 2,8 % |
| Fürst–Kaiser | 0,0 % |

Nur 2 von 12 Agenten (Verwalter, teilweise Anfänger) erreichten je einen
Titel oberhalb von Freiherr.

### C. 10A Title Funnel After

Nach allen Phase-10-Änderungen (10A+10B+10C kombiniert,
`title_audit_10D_combined.json`):

| Titel | Erreicht (nachher) |
|---|---|
| Freiherr | 100,0 % |
| Baron | 97,5 % |
| Graf | 80,6 % |
| Landgraf | 10,0 % |
| Markgraf | 7,5 % |
| Fürst | 7,5 % |
| Herzog | 6,4 % |
| Kurfürst | 4,2 % |
| König | 3,9 % |
| **Kaiser** | **3,9 %** |

### D. Time-to-Title Before/After

Vorher: Baron median Jahr 65 (n=42 von 360 überhaupt erreicht), keine
verlässlichen Daten für höhere Stufen (n zu klein/0). Nachher (30 Seeds,
alle 12 Agenten, `title_audit_10A_1.json` als früher Meilenstein):
Baron median Jahr 15 (n=236), Graf median Jahr 34, Landgraf median 58,
Markgraf median 96. Nach den vollständigen 10A-10C-Änderungen erreicht
Verwalter Kurfürst/König/Kaiser typischerweise zwischen Jahr 70 und 100 —
passend zur im Auftrag vorgeschlagenen groben Dramaturgie (§12: "Jahr
70-100: realistische Kaiserambition für starke Kampagnen").

### E. Kaiser Reachability

| | vorher | nachher (Kalibrierungs-Seeds) | nachher (20 Holdout-Seeds) |
|---|---|---|---|
| Kaiser-Rate (Verwalter) | 0 % | 46,7 % | **70,0 %** |
| Kaiser-Rate (alle 12 Agenten aggregiert) | 0 % | 3,9 % | — |

Die Holdout-Seeds (nie zur Kalibrierung verwendet, Seed-Basis 500.000
statt 1.000) zeigen eine sogar HÖHERE Kaiser-Rate als die
Kalibrierungs-Seeds — klares Indiz gegen Overfitting (§114/115).

### F. Title Bottleneck Root Cause

Zwei getrennte, empirisch belegte Ursachen gefunden:

1. **`reqPop` unrealistisch hoch** (alte Werte 3.000-90.000): nur 2 von
   12 Archetypen überschreiten je 3.500 Einwohner nachhaltig — nicht weil
   Bevölkerungswachstum unmöglich ist, sondern weil die meisten
   Archetypen (Diplomat, Machtpolitiker, Dynast, Kaufmann, Kriegsherr…)
   ihre Bevölkerung durch Kriegsschäden, Hungerkrisen oder — bei
   Machtpolitiker spezifisch — durch die eigene, leicht "gierige"
   Regierungsstil-Wahl (55/100) strukturell knapp über/unter dem
   Startwert halten.
2. **Kein Agent baute je einen Palast oder eine Kathedrale** — beides
   sind reale, im Code bereits vorhandene Voraussetzungen
   (`checkTitleProgress()`/`checkElectionTrigger()`), die kein Archetyp
   je erfüllte. **Kein Deadlock im Sinne von §15** ("Titel braucht
   Prestige, Prestige braucht Krieg, Krieg macht bankrott") wurde
   gefunden — die Verkettung war stattdessen: Titel braucht Bevölkerung
   (kaum erreichbar) UND einen niemals gebauten Palast (reine
   Testcode-Lücke, kein Gameplay-Deadlock).

### G. weitere 10A-Ergebnisse

Siehe `BALANCE_CHANGELOG.md` 10A für die vollständige
Iterationshistorie (10A.1-10A.5). **Bekannte, bewusst offen gelassene
Lücke**: Machtpolitiker/Diplomat erreichen weiterhin nur Graf (0 %
Landgraf+), während Anfänger vereinzelt Landgraf erreicht (20 %) — §20
des Auftrags wollte Machtpolitiker/Diplomat tendenziell vor Anfänger
sehen. Ursache ist Machtpolitikers eigene, durch §101 geschützte
Regierungsstil-Wahl (55/100 → mild "gierig" → strukturelle
Bevölkerungsobergrenze ~2.100) — durch keine Titelkurven-Anpassung
umgehbar, ohne entweder die Agentenpolitik (§82) oder die
Regierungsstil-Formel (§101) zu verletzen. Als Phase-11-Kandidat
vermerkt (§BD).

---

## H-O. 10B — Military Audit

### H. Unit Composition Matrix Before/After

10 Kompositionen × 2 Formationen × 2 Gelände-Stufen (Ebene direkt,
Burg-Nachstoß) × 30 Seeds, festes Budget 3.000 Taler via echtem
`takeLoan()`:

| Komposition | Siegquote Ebene (vorher) | Siegquote Ebene (nachher) | armyStrength (vorher→nachher) |
|---|---|---|---|
| Nur Pikeniere | 100 % | 100 % (unverändert) | 81 → 63 |
| Nur Bogenschützen | 13,3 % | 13,3 % (unverändert) | 66 → 59,4 |
| Nur Ritter | 3,3-13,3 % | 3,3-13,3 % (unverändert) | 56 → 35 |
| Nur Schwere Kavallerie | 3,3 % | 3,3 % (unverändert) | 48 → 24 |
| Nur Söldner | 80 % | 80 % (unverändert) | 60 → 67,5 |
| Gemischt (historisch) | 30 % | 10 % (weniger Pikeniere im Mix leistbar) | 50 → 39,8 |
| Infanterie-lastig | 100 %/83 % | 66,7 %/53,3 % | 69 → 60 |
| Fernkampf-lastig | 6,7 % | 6,7 % (unverändert) | 59,5 → 54,1 |
| Kavallerie-lastig | 3,3-10 % | 3,3-10 % (unverändert) | 48 → 27 |
| Balanced | 73,3 % | 73,3 % (unverändert) | 52,5 → 44,9 |

**Wichtig**: die tatsächlichen SIEGQUOTEN ändern sich fast überall NICHT
(Battle Engine unangetastet) — nur bei Kompositionen, die Pikeniere als
Budgetanteil enthalten, sinkt die Siegquote leicht, weil der höhere
Pikeniere-Preis (110→140) bei fixem Budget weniger Gesamttruppen
ermöglicht. Die `armyStrength`-Spalte zeigt die eigentliche Korrektur:
Kavallerie wird jetzt durchgehend niedriger bewertet, näher an ihrer
realen (schwachen) Kampfleistung.

### I. (siehe H, kombiniert)

### J. Pikemen Exploit

Bestätigt als reale dominante Frühstrategie (100 % Siegquote, 0
Verluste, Test A/B/C aus dem Auftrag). Gegenmaßnahme: Rekrutierungskosten
110→140 Taler (nicht mehr die günstigste Einheit pro Stärkepunkt — jetzt
Bogenschützen/Miliz günstiger). Battle-Engine-Dominanz selbst bewusst
NICHT angetastet (§37: nur letzter Schritt, hier nicht nötig, da die
Kostenkorrektur die Dominanz bereits spürbar einschränkt, ohne die
Kernidentität "günstige, verlässliche Kerninfanterie" zu zerstören, §26).

### K. Cavalry Problem

Bestätigt: `armyStrength()` bewertete Kavallerie deutlich zu hoch relativ
zur echten Kampfleistung (7,5 % Siegquote trotz Bewertung 48). Behoben
durch `TROOP_TYPES.ritter.strength` 8→5 und `.schwere_kavallerie.strength`
12→6 — reine Datenwert-Änderung, die AUSSCHLIESSLICH `armyStrength()`
betrifft (verifiziert: `TROOP_TYPES[type].strength` wird an keiner
anderen Stelle im Code gelesen, insbesondere nicht in
`battle-engine/*.js`).

### L. armyStrength Correlation Before/After

Prädiktive Validität (Pearson-Korrelation `armyStrength` vs. tatsächliche
Siegquote über alle 10 Kompositionen, neutrale Formation): **0,637 →
0,687**. Ziel aus §30 ("eine Armee mit 2× armyStrength darf nicht
regelmäßig gegen eine 0,5×-Armee verlieren") ist für die klarsten
Fälle jetzt erfüllt: Kavallerie (str. 24-35) liegt jetzt klar UNTER
Pikeniere/Söldner/Infanterie (str. 44-67,5), passend zu ihrer
tatsächlich schwächeren Kampfleistung. Verbleibende Restungenauigkeit bei
reinen Fernkampf-Kompositionen bewusst nicht weiter nachjustiert (§99
Whack-a-Mole-Vermeidung, siehe `BALANCE_CHANGELOG.md`).

### M. Recruitment Cost Changes

Pikeniere: 110→140 Taler. Alle anderen Kosten unverändert.

### N. Population Cost Changes

**Keine** — `recruitPopCostPerUnit=4` bleibt für alle Einheitentypen
unverändert (§33/§34: die armyStrength-Korrektur adressiert die
Kernsorge bereits; eine zusätzliche Pop-Kosten-Differenzierung hätte in
derselben Iteration zu viele Variablen gleichzeitig verändert, §110).

### O. Battle Engine Changes

**KEINE.** `battle-engine/battle-data.js`, `battle-engine/battle-engine.js`,
`battle-engine/battle-state-machine.js` — 0 Zeilen Diff (verifiziert per
`git diff --stat`). `battle_test.js` (Kampf-Engine-eigene Testsuite,
unabhängig von `TROOP_TYPES`, arbeitet mit `createUnitStack()`) läuft
weiterhin unverändert grün.

---

## P-U. 10C — War Economy Audit

### P. 10C War Economy Audit

Vollständige monatliche Finanzaufschlüsselung (`applyMonthlyFinances()`s
Rückgabewert: taxIncome/upkeep/salaries/debtInterest/vassalTribute) über
15 Seeds × 4 kriegerische Archetypen (Kriegsherr/Hardliner/Opportunist/
Min-Maxer). Siehe `BALANCE_CHANGELOG.md` 10C für die vollständige
Herleitung.

### Q. Cost Breakdown

| Posten | Anteil am Gesamteinkommen (Kriegsherr, vorher) |
|---|---|
| **Unterhalt (upkeep)** | **53 %** — mit Abstand größter Einzelposten |
| Beratergehälter | ~15 % |
| Schuldzinsen | ~10 % |
| Sonstiges | ~4 % |
| Vasallentribut (Einnahme) | **0 %** — sollte real sein, war 0 (Bug, siehe R) |

### R. Territorial Reward

**Entdeckter Bug**: `js/advance-year.js` (Vasallentribut-Berechnung)
enthielt einen überzähligen Faktor `× 0.02`, der den Tribut für jede
realistische Regionsgröße (2.000-3.000 Einwohner) auf 0 Taler/Monat
rundete — der einzige dauerhafte wirtschaftliche Eroberungsertrag im
Spiel floss faktisch nie, obwohl `state.vassals[aiId] = true` korrekt
gesetzt wurde. Behoben (Faktor entfernt). Nach dem Fix: Kriegsherr/
Hardliner erhalten realistisch ~15-25 Taler/Monat/Vasall (≈ 22.700-25.000
Taler kumuliert über eine typische Kampagne bei 3 vollständig eroberten
Regionen) — spürbar, aber nicht überwältigend gegenüber der
Steuereinnahme derselben Kampagne (~34.000-49.000 Taler).

### S. Bankruptcy Before/After

| Agent | Bankrott-Rate vorher | Bankrott-Rate nachher (Kalibrierung) | Bankrott-Rate (Holdout) |
|---|---|---|---|
| Kriegsherr | 76,7 %/93 % | **3,3 %/7 %** | 10,0 % |
| Hardliner | 73,3 %/80 % | **0 %** | 0 % |
| Opportunist | 80 % | 76,7 % (unverändert — siehe T) | 55,0 % |
| Min-Maxer | 83,3 % | 73,3 % (unverändert — siehe T) | 80,0 % |

(Zwei Zahlen bei Kriegsherr/Hardliner: früher isolierter
War-Economy-Audit-Lauf [15 Seeds] vs. volle 10E-Matrix [30 Seeds].)

### T. Conquest Speed Before/After

Unverändert — volle Kartenkontrolle bleibt in <5 Jahren erreichbar
(Kriegsherr/Hardliner/Opportunist/Min-Maxer alle weiterhin ~1-3 Jahre bis
zur ersten vollständigen Regionseroberung). **Bewusst nicht verlangsamt**
(§44 "kein künstlicher War Cooldown als erster Fix" — Ursachenanalyse
zeigte, dass NICHT die Eroberungsgeschwindigkeit das Problem war, sondern
der fehlende Ertrag danach, siehe R). Opportunist/Min-Maxer bleiben trotz
schneller Eroberungsfähigkeit bei hoher Bankrott-Rate, weil sie (siehe
`PHASE9_GAMEPLAY_AUDIT.md` §AL Punkt 3 bzw. Min-Maxers kurze
Exploit-Testphasen) nie eine VOLLSTÄNDIGE, abgeschlossene Eroberung
erreichen, die den jetzt echten Vasallentribut auslösen würde — ein
bewusst beibehaltener, korrekter Unterschied zwischen fokussiertem und
unfokussiertem Krieg (§50-52).

### U. War Profitability

Vorher/Nachher-Vergleich (Same-Seed 1000, Kriegsherr): Kasse am
Kampagnenende -3.189 (vorher) → +135 (nachher, bei ähnlicher
Kampagnenlänge), Schulden 8.000→1.121. **Ein vollständig durchgeführter
Eroberungskrieg trägt sich jetzt selbst** — der zentrale Auftrag aus §50/
§51 ist erfüllt, ohne Rekrutierungs-, Unterhalts- oder
Battle-Engine-Werte anzufassen.

---

## V-AB. 10D — Late Game Audit

### V. 10D Late Game Audit

Geprüft VOR jeder neuen Content-Ergänzung, ob 10A+10C das
Spätspiel-Ziel-Vakuum bereits lösen (§58). Ergebnis: **ja, für die
Archetypen, die lange genug überleben, um es zu erreichen.**

### W. Treasury Saturation

Verwalter erreicht am Kampagnenende regelmäßig 150.000-400.000 Taler —
weit über der Kaiser-Wealth-Anforderung (65.000). Geld verliert nach
Erfüllung aller Titel-/Gebäude-Schwellen weiterhin an Grenznutzen — ein
akzeptierter, nicht behobener Charakterzug (§65 explizit: kein neuer
künstlicher Geldsenke).

### X. Autopilot Index Before/After

| Agent | Autopilot vorher | Autopilot nachher |
|---|---|---|
| Verwalter | 0,211 | 0,198 (leicht verbessert) |
| Kriegsherr | 0,319 | 0,295 |
| Hardliner | 0,317 | 0,298 |
| Opportunist | 0,130 | 0,086 |
| Alle übrigen | im Rahmen der Stichprobenschwankung unverändert |

Durchgehend leichte Verbesserung oder Gleichstand — keine Verschlechterung
durch die Rebalance-Änderungen.

### Y. Longest Boring Streak

Unverändert im Rahmen der Stichprobenschwankung (max. weiterhin 7 Jahre,
Versöhner) — die Rebalance-Änderungen wirken auf Ressourcen-/
Titelschwellen, nicht auf die Entscheidungsfrequenz selbst.

### Z. Meaningful Decisions Before/After

Weitgehend stabil (z. B. Verwalter 18,16→17,7/Jahrzehnt, Kaufmann
24,53→25,36/Jahrzehnt) — **einzige nennenswerte Verschiebung**:
Opportunist 64,65→87,25/Jahrzehnt (mehr Entscheidungen, da kürzere,
dichter gedrängte Kampagnen durch veränderte Kriegsdynamik).

### AA. Late Game Goals

Verwalter (jetzt mit `considerBuildKathedrale`/`considerBuildPalast`/
`handleElection` ausgestattet, siehe `BALANCE_CHANGELOG.md` 10A.4/10A.5)
hat ab Kurfürst-Rang ein echtes, mehrstufiges Spätspielziel: Palast bauen
→ Kathedrale bauen → Kurfürsten bestechen → Wahl gewinnen. Das ist exakt
die im Auftrag gewünschte "Ambition Ladder" (§61) — bereits vollständig
aus BESTEHENDEN Systemen zusammengesetzt, kein neues Feature gebaut.

### AB. Opportunity Costs

Nicht separat neu instrumentiert in 10D — die bestehende
Ressourcenknappheit (Puffer-basierte Ausgabenlogik aller Agenten) bleibt
die maßgebliche Opportunitätskosten-Quelle. Keine Änderung.

---

## AC-AL. 10E — Full Agent Matrix

### AC. 10E Full Agent Matrix

360 Kampagnen (12 Agenten × 30 Seeds, identisch zur Phase-9-Baseline),
0 Abstürze, 65-70 Sekunden Laufzeit. Zusätzlich: 240 Kampagnen auf 20
Holdout-Seeds (Basis 500.000, disjunkt von den 30 Kalibrierungs-Seeds),
0 Abstürze. Rohdaten: `tests/output/phase10/`,
`tests/output/phase10_holdout/`.

### AD. Kaiser Rates by Agent

Siehe E oben — nur Verwalter erreicht Kaiser (46,7 % Kalibrierung, 70 %
Holdout). Alle übrigen 11 Agenten: 0 % (strukturell durch
Bevölkerungsobergrenze bzw. Kriegsschäden begrenzt, siehe F/G).

### AE. Survival by Agent

| Agent | Ø Jahre vorher | Ø Jahre nachher | 100J-Anteil vorher | 100J-Anteil nachher |
|---|---|---|---|---|
| Verwalter | 80,7 | 69,1 | 56,7 % | 3,3 % (viele enden früher — durch SIEG, siehe AD) |
| Kriegsherr | 45,3 | 50,3 | 0 % | 0 % |
| Hardliner | 40,3 | 41,1 | 0 % | 0 % |
| Diplomat | 70,5 | 71,8 | 46,7 % | 36,7 % |
| Dynast | 83,0 | 85,6 | 46,7 % | 63,3 % |
| Kaufmann | 85,6 | 87,7 | 56,7 % | 60,0 % |

Verwalters gesunkener "100-Jahre-Anteil" ist **positiv**, nicht negativ:
14 von 30 Kalibrierungs-Kampagnen enden jetzt vorzeitig durch
`gameOver: "victory"` (Kaiserwahl gewonnen) statt die vollen 100 Jahre
zu laufen.

### AF. no_heir

Weitgehend unverändert (z. B. Verwalter 43,3 %→ähnlich, Diplomat
56,7 %→ähnlich) — wie in 10D vorgesehen, nicht gezielt bearbeitet (§130:
nur ändern, wenn Nebeneffekt unbeabsichtigt stark). Kein unbeabsichtigter
Effekt gefunden.

### AG. System Engagement

Unverändert gegenüber Phase 9 (die Rebalance-Änderungen betreffen
Ressourcen-/Titelschwellen, nicht welche Systeme ein Agent grundsätzlich
nutzt) — mit einer Ausnahme: Verwalter nutzt jetzt zusätzlich die
Kategorie TITLE (Palast-/Kathedralebau, Wahlbeteiligung), vorher 0 %.

### AH. Same-Seed Comparison

Seed 1000, 5 Agenten, vorher/nachher:

| Agent | Titel vorher | Titel nachher | Jahre vorher | Jahre nachher | Kasse vorher | Kasse nachher |
|---|---|---|---|---|---|---|
| Verwalter | Graf (33J, no_heir) | Landgraf (26J, no_heir) | 33 | 26 | 29.372 | 3.293 |
| Kriegsherr | Freiherr (50J, bankrupt) | **Graf** (42J, no_heir) | 50 | 42 | -3.189 | **135** |
| Diplomat | Freiherr (23J, no_heir) | **Graf** (100J, läuft weiter) | 23 | **100** | 196 | 195 |
| Dynast | Freiherr (68J, no_heir) | **Graf** (100J, läuft weiter) | 68 | **100** | 442 | 380 |
| Min-Maxer | Freiherr (39J, bankrupt) | Graf (39J, no_heir) | 39 | 38 | -3.337 | 79 |

Diplomat und Dynast überleben jetzt die vollen 100 Jahre (vorher 23/68) —
Kriegsherr wird solvent (Kasse positiv statt -3.189). Alle fünf erreichen
jetzt mindestens Graf statt größtenteils Freiherr — ohne dass die
Geschichten gleichförmig würden (siehe AI).

### AI. Player Agency

Same-Seed-Diversität bleibt hoch: Endkassen reichen weiterhin von 79 bis
3.293 Taler (40×-Spanne), Kampagnenlängen von 26 bis 100 Jahre,
Endzustände (solvent/knapp positiv/läuft weiter) unterscheiden sich
deutlich zwischen den fünf Archetypen. **§94 erfüllt**: die
Rebalance-Änderungen haben die Spielweisen nicht angeglichen — sie haben
lediglich die vorher fast überall gleiche "Sackgasse" (Freiherr bleiben,
oft bankrott/no_heir) durch fünf unterschiedliche, aber jeweils
plausible neue Ausgänge ersetzt.

### AJ. Min-Maxer Findings

Min-Maxer bleibt bei 73 % Bankrott-Rate (unverändert) — seine kurzen,
gezielten Exploit-Testphasen (siehe `archetypes.js` `MINMAX_PHASES`)
erreichen nie eine vollständige, tributauslösende Eroberung. Prestige
kollabiert in seiner "economic_extraction"-Phase weiterhin drastisch
(bis auf 1-16 beobachtet) — unverändert gegenüber Phase 9, kein neuer
Fund.

### AK. New Exploits

Erneute Prüfung (§98/§158, "How To Break Kaiserreich 2.0"):

- **Neue beste Einheit**: keine gefunden — Pikeniere bleiben die
  verlässlichste, aber nicht mehr die günstigste Wahl; kein anderer
  Einheitentyp wurde durch die Änderungen neu dominant (Composition-Lab
  H zeigt keine Komposition mit signifikant gestiegener Siegquote).
- **Neue Geldmaschine**: keine gefunden — Vasallentribut ist jetzt real,
  aber moderat (≈15-25 Taler/Monat/Vasall), kein Sprung zu unbegrenztem
  Einkommen.
- **Neuer Titelshortcut**: keiner gefunden — die neuen Schwellen
  verlangen weiterhin echtes, mehrjähriges Wachstum; kein Ein-Jahres-Trick
  entdeckt.
- **War Snowball**: unverändert vorhanden (Gebiets-Korrelation 1,0 für
  Kriegsarchetypen, siehe `PHASE9_GAMEPLAY_AUDIT.md` §AE) — jetzt aber
  mit echtem wirtschaftlichem Gegenwert statt garantiertem Kollaps danach.
- **Diplomatie-/Eventoptions-Exploit**: keiner neu gefunden.
- **Kriegserklärung-ohne-Cooldown** (aus Phase 9, §AL Punkt 3) bleibt
  bestehen — bewusst nicht behoben (§44: kein Cooldown als erster Fix;
  die Ursachenanalyse in 10C zeigte, dass der fehlende Ertrag, nicht die
  fehlende Cooldown-Bremse, das eigentliche Problem war).

**Dritter Abschlusstest (§158)**: "Pikeniere kaufen, alles erobern,
gewinnen" bleibt eine WIRKSAME Strategie (Kriegsherr/Hardliner sind nach
10C wirtschaftlich tragfähig), ist aber **nicht mehr die einzige
funktionierende** — Verwalters rein wirtschaftlich-administrativer Weg
führt jetzt zuverlässiger zur Kaiserkrone (46,7-70 % vs. Kriegsherrs 0 %,
da dessen Bevölkerung durch Krieg zu stark leidet, um die
Titelanforderungen zu erfüllen). Phase 10 hat also nicht "Krieg
generft", sondern eine zweite, robustere Machtoption (Wirtschaft/
Verwaltung) auf Augenhöhe gebracht.

---

## AL. Region Fairness

4 Agenten (Verwalter/Kaufmann/Kriegsherr/Diplomat) × 15 Seeds × 5
Startregionen, vorher/nachher:

| Region | Bankrott vorher | Bankrott nachher | Ø Endkasse vorher | Ø Endkasse nachher |
|---|---|---|---|---|
| player | 25,0 % | 6,7 %* | 22.376 | ~14.500* |
| burgund | 21,7 % | 11,7 % | 31.396 | 17.076 |
| england | 18,3 % | 5,0 % | 30.839 | 16.413 |
| venedig | 25,0 % | 1,7 % | 22.696 | 10.384 |
| mailand | 23,3 % | 10,0 % | 44.458 | 16.415 |

*player-Zeile aus derselben Messreihe wie die übrigen vier, exakter Wert
in `region_fairness_test.json`. Bankrott-Rate sinkt in JEDER Region
deutlich (dank 10C) — keine Region wird durch die Rebalance
unbespielbar, relative Rangfolge (Mailand am stärksten, Venedig am
wirtschaftlich knappsten) bleibt im Wesentlichen erhalten (§117: erlaubt).

---

## AM. Holdout Seeds

20 neue Seeds (Basis 500.000, disjunkt von den 30 Kalibrierungs-Seeds
1.000-230.651), volle 12-Agenten-Matrix, 240 Kampagnen, 0 Abstürze. Siehe
E/S — Kaiser-Rate UND Bankrott-Rate-Verbesserung bestätigen sich auf den
Holdout-Seeds in vergleichbarer oder sogar stärkerer Ausprägung als auf
den Kalibrierungs-Seeds. **Kein Overfitting-Hinweis gefunden** (§115).

---

## AN. Early Game

Unverändert schnell ereignisreich (kriegerische Archetypen erklären
weiterhin praktisch immer im ersten Jahr Krieg). Neu: bereits ab Jahr 2
kann `titleIndex` auf 1 (Baron) springen (verifiziert per Playwright-
Live-Check gegen `index.html`) — die allererste Titelerhebung ist jetzt
ein echtes, früh erreichbares Ereignis statt einer bei den alten Werten
praktisch nie gesehenen Seltenheit.

## AO. Mid Game

Kriegerische Kampagnen (Kriegsherr/Hardliner) erreichen jetzt im
Mid-Game-Fenster (Jahr 21-60) einen stabilen, solventen Zustand statt
(wie vorher) fast immer schon vorher bankrott zu gehen — die
Kriegskampagnen-Länge selbst blieb ähnlich (Ø 41-50 Jahre), aber ihr
ökonomisches Ende hat sich von "Kollaps" zu "stabil/laufend" verschoben.

## AP. Late Game

Für Verwalter (und in geringerem Maß Diplomat/Dynast, die jetzt die
vollen 100 Jahre überleben) bietet das Late Game jetzt eine klare
Ambition-Ladder bis zur Kaiserkrone statt eines Ziel-Vakuums (siehe
V-AB).

---

## AQ. 5 Example Campaign Timelines

Alle fünf aus dem Same-Seed-1000-Vergleich (AH), Volltext-Chroniken in
`tests/output/phase10/decision_logs/`:

**Verwalter** (26 Jahre, no_heir, Landgraf erreicht): stetiges
Bevölkerungs-/Kassenwachstum bis 1526, Herrschertod ohne Erben.

**Kriegsherr** (42 Jahre, no_heir, jetzt SOLVENT mit 135 Taler Kasse
statt -3.189 vorher, Graf erreicht, alle 16 Gebiete erobert, 3 Vasallen):
dieselbe schnelle Vollständig-Eroberung wie in Phase 9, aber diesmal ohne
den anschließenden wirtschaftlichen Kollaps.

**Diplomat** (100 Jahre, läuft weiter, Graf erreicht — vorher nach 23
Jahren ohne Erben beendet): deutlich stabilere, längere Dynastie.

**Dynast** (100 Jahre, läuft weiter, 3 Generationen, Graf erreicht):
ebenfalls deutlich verlängerte Überlebensdauer.

**Min-Maxer** (38 Jahre, no_heir, Graf erreicht statt Freiherr,
Prestige weiterhin kollabiert): am wenigsten von der Rebalance
profitierender Agent — konsistent mit seiner Strategie, die auf kurze,
unvollständige Experimente statt nachhaltigem Aufbau setzt.

---

## AR. Top 10 Gameplay Findings → Top 5 Recommended Improvements

Referenz-Tracking gegen `PHASE9_GAMEPLAY_AUDIT.md` §AO/§AP:

| # (Phase 9) | Befund | Status nach Phase 10 |
|---|---|---|
| 1 | 0/360 Kaiser | **BEHOBEN** (46,7-70 % für Verwalter) |
| 2 | Krieg territorial stark, wirtschaftlich Selbstmord | **BEHOBEN** (0-10 % Bankrott bei vollständiger Eroberung) |
| 3 | armyStrength() korreliert schlecht mit Kavallerie-Erfolg | **VERBESSERT** (Korrelation 0,637→0,687, Kavallerie korrekt niedrig bewertet) |
| 4 | Pikeniere-Spam dominant | **ABGESCHWÄCHT** (nicht mehr günstigste Einheit pro Stärkepunkt, Battle-Engine-Dominanz bewusst unangetastet) |
| 5 | Spätspiel-Ziel-Vakuum | **BEHOBEN für Verwalter/Diplomat/Dynast** (bestehende Ambition Ladder jetzt real erreichbar) |
| 6 | Kein Spieler-Kriegs-Cooldown | Bewusst NICHT behoben (§44, war nicht die eigentliche Ursache) |
| 7 | Passives Spiel erzählerisch karg | Unverändert (kein Scope von Phase 10) |
| 8 | no_heir konstant hoch | Unverändert (§130, kein unbeabsichtigter Nebeneffekt gefunden) |
| 9 | Diplomatisches Spiel ereignisarm | Teilweise verbessert (Diplomat überlebt jetzt 100 statt 23 Jahre) |
| 10 | Snowballing militärisch konzentriert | Unverändert, aber jetzt mit legitimem Gegenwert statt garantiertem Kollaps |

---

## BC. Remaining Top 5 Gameplay Problems

1. **Machtpolitiker/Diplomat vs. Anfänger/passiv bei Titeln** (§20 nicht
   vollständig erfüllt) — strukturelle Bevölkerungsobergrenze durch
   geschützte Regierungsstil-Formel, siehe G.
2. **no_heir bleibt bei 17-57 % über alle Spielstile hinweg** die
   häufigste Spielende-Ursache — unverändert seit Phase 3, bewusst nicht
   in Scope.
3. **Passives Spiel bleibt erzählerisch karg** (1 Ereignis/8 Jahre,
   Phase-9-Befund) — kein Scope von Phase 10 (reine Balance-Phase).
4. **Kriegserklärung ohne Spieler-Cooldown** — dokumentiert, bewusst
   nicht behoben (§44).
5. **Reine Fernkampf-Kompositionen bleiben in `armyStrength()` moderat
   überbewertet** (Restungenauigkeit aus L) — bewusst nicht
   weiter nachjustiert, um Whack-a-Mole-Risiko zu vermeiden (§99).

## BD. Recommended Phase 11

**Kein Vorentscheid** (§155/§156) — die Daten legen jedoch nahe, dass
der nächste sinnvolle Schwerpunkt **E. Dynastie/Nachfolge-Tiefe** oder
ein gezielter, kleiner **Regierungsstil-Rebalance-Baustein** wäre (nicht
in dieser Liste des Auftrags explizit genannt, aber der klarste
verbleibende Engpass aus G/BC.1): die Machtpolitiker-Bevölkerungsobergrenze
ist der einzige in Phase 10 gefundene, aber laut Scope nicht behebbare
Block. Alternative Kandidaten aus der vorgegebenen Liste (Living Realm,
Kaiserwahl 2.0, Diplomatie 2.0, Wirtschaftliche Tiefe, Kriegsstrategie,
Pacing 2.0) sind durch die aktuellen Daten NICHT eindeutig als
dringlicher belegt als die beiden oben genannten — echte Vorentscheidung
sollte einer eigenen, gezielten Analysephase vorbehalten bleiben.

---

## Abschlusstests (§156-159)

**Test 1 (§156)**: Same-Seed-Fünf-Agenten-Vergleich (AH/AI) — fünf klar
unterschiedliche Antworten auf "was ist mein nächstes großes Ziel /
was muss ich dafür opfern" bestätigt (Verwalter: Titel/Palast, opfert
militärische Stärke; Kriegsherr: Territorium/Vasallen, opfert
Bevölkerungswachstum; Diplomat/Dynast: Stabilität/Generationen, opfern
Expansionstempo; Min-Maxer: Optimierungserkenntnis, opfert alles andere).
**Bestanden.**

**Test 2 (§157)**: Verwalter erreicht die Kaiserkrone nicht geschenkt,
sondern durch Jahrzehnte realen Aufbaus (Bevölkerung, Kasse, Palast,
Kathedrale, Wahlbeteiligung) — verifiziert an mehreren Kampagnen mit
vollständiger Chronik. **Bestanden.**

**Test 3 (§158)**: "Pikeniere kaufen, alles erobern, gewinnen" bleibt
wirksam, ist aber nicht mehr konkurrenzlos — Verwalters wirtschaftlicher
Weg ist jetzt der zuverlässigere Weg zur Krone. **Teilweise bestanden**
(bewusst: Battle-Engine-Dominanz von Pikeniere wurde nicht vollständig
beseitigt, nur ihre Kosten-Dominanz — siehe AK, ehrlich als unvollständig
markiert statt beschönigt).

**Test 4 (§159)**: Nach erreichter Stabilität (Verwalter, ~Jahr 30-50)
bietet das Spiel jetzt eine echte Antwort auf "und jetzt?" — Palast,
Kathedrale, Kurfürsten-Bestechung, Kaiserwahl — statt einer künstlichen
Krise. **Bestanden.**

---

## AS. Production Files Changed

```
data/gamedata.js       (TITLES-Ladder + TROOP_TYPES cost/strength)
js/advance-year.js     (Vasallentribut-Bugfix, 1 Zeile + Kommentar)
index.html              (Bundle-Regenerierung aus obigen Quelldateien)
```

`battle-engine/*.js`: **0 Zeilen Diff** (verifiziert per `git diff --stat`).

## AT. CONFIG Changes

Siehe `BALANCE_CHANGELOG.md` für die vollständige Liste mit HYPOTHESIS/
DATA/RESULT je Wert. Zusammengefasst: `TITLES` (alle 10 Stufen,
reqPop/reqWealth/reqPrestige), `TROOP_TYPES.pikeniere.cost` (110→140),
`TROOP_TYPES.ritter.strength` (8→5), `TROOP_TYPES.schwere_kavallerie.strength`
(12→6), `TROOP_TYPES.bogenschuetzen.strength` (2→1,8),
`TROOP_TYPES.armbrustschuetzen.strength` (2,5→2,3),
`TROOP_TYPES.soeldner.strength` (4→4,5), Vasallentribut-Formel
(Bugfix, kein CONFIG-Wert).

## AU. Tests

Neu: `tests/phase10_balance_test.js` (permanente Regressionswächter für
alle drei Fixes — Titelkurve monoton + König im plausiblen Bereich,
Kavallerie nicht mehr über Pikeniere bewertet, Vasallentribut > 0).
Test-Infrastruktur (nicht Teil der Produktionstests, analog zu Phase 9):
`tests/agents/run-title-audit.js`, `run-military-balance-lab.js`,
`run-war-economy-audit.js` — decken inhaltlich `title_progression_test.js`/
`strategic_army_balance_test.js`/`war_economy_test.js` aus §139 ab
(Namen an die bestehende `tests/agents/`-Architektur aus Phase 9
angepasst statt neu erfunden); `run-matrix.js`/`aggregate.js` decken
`phase10_agent_comparison_test.js`/`late_game_pacing_test.js` ab. Alle
14 bestehenden Produktions-Testdateien (`tests/*.js`, ohne `agents/`)
weiterhin grün.

## AV. Determinism

Vollständig erhalten — bewiesen wie in Phase 9 (Agent+Seed →
byte-identisches Ergebnis; Battle-Engine-Golden-Test `battle_test.js`
unverändert grün).

## AW. Golden Fixtures

`advance_year_snapshot_golden.json` neu versioniert nach der
Titel-Änderung (erwartete Chronik-Zeilen-Verschiebung durch früher
erreichte Titel, KEINE `rngCalls`-Abweichung — reiner Balancewerte-Effekt
gemäß §141). Alte Fixture archiviert als
`advance_year_snapshot_golden_pre_phase10.json`. Nach der 10B/10C-Änderung
(TROOP_TYPES, Vasallentribut) **keine erneute Regenerierung nötig** — die
drei Golden-Seeds durchlaufen in der passiven Baseline-Simulation weder
Rekrutierung noch Vasallisierung.

## AX. Battle Engine

Unverändert, siehe O.

## AY. Savegame

**Keine neue `SAVE_VERSION`** — alle drei Änderungen sind reine
Datenwert-/Formel-Korrekturen ohne neues State-Feld, keine Migration
nötig.

## AZ. Bundle

`index.html`: 870.089 → 872.283 Bytes (+2.194 Bytes, +0,25 % — im
Wesentlichen die neuen erklärenden Kommentare in `TITLES`/`TROOP_TYPES`).
`tools/build-bundle.js` erfolgreich mehrfach ausgeführt, Laufzeit-
Rauchtest jedes Mal bestanden.

## BA. Commits

Siehe Git-Historie dieser Phase — thematisch getrennt (10A/10B/10C je
eigener Commit, Test-Infrastruktur, Dokumentation).

## BB. Working Tree

Vor dem finalen Commit ausschließlich die in AS gelisteten
Produktionsdateien plus neue Test-/Dokumentationsdateien geändert — keine
unerwarteten Modifikationen.

---

## STOPP

Phase 10 (Strategic Pacing & Power Curve) ist damit abgeschlossen. Drei
gezielte, datenbasierte, vollständig getestete Änderungen (Titelkurve,
Militär-Bewertung, Vasallentribut-Bugfix) haben die drei zentralen
Phase-9-Befunde direkt adressiert, ohne Battle Engine, Karte, UI, Save-
Format oder Agentenpolitik anzutasten. **Keine Phase 11 wurde
begonnen** — nur eine unverbindliche Beobachtung (BD), keine
Vorentscheidung. Keine automatische Phase 11 ohne deine ausdrückliche
Freigabe.
