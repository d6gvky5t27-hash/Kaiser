# BALANCE_CHANGELOG — Phase 10

Jede Änderung: HYPOTHESIS → CHANGE → TEST → RESULT. Baseline-Referenz:
Phase-9-Messdaten (`tests/output/phase9/`) und die Phase-10A-Vorab-Audits
(`tests/output/phase10/title_audit_*.json`). Volle Vorher/Nachher-Tabellen
in `PHASE10_BALANCE_COMPARISON.md`.

---

## 10A — Title Progression

### 10A.1 — reqPop/reqPrestige (TITLES)

**HYPOTHESIS**: Der Titelaufstieg ist blockiert, weil `reqPop` für praktisch
jede Spielweise außer einer einzigen wirtschaftlich hyper-konservativen
unerreichbar ist, und `reqPrestige` ab "Fürst" weit über dem empirisch je
beobachteten Prestige-Höchstwert liegt.

**DATA**: Baseline-Audit (12 Agenten × 30 Seeds × 100 Jahre, unveränderter
Phase-9-Code): 10 von 12 Archetypen erreichten NIE einen Titel oberhalb
von Freiherr. Bevölkerung stagniert für die meisten Archetypen zwischen
~400 und ~3.500; nur Verwalter (Ø 15.830, Max 21.861) und Versöhner
(Ø 4.929, Max 13.266) wuchsen deutlich. Prestige-Höchstwert über alle 360
Kampagnen: 235 (Kriegsherr); alte Anforderungen für Kurfürst/König/Kaiser
(380/500/650) wurden nie annähernd erreicht.

**CHANGE** (`data/gamedata.js`, `TITLES`):

| Titel | reqPop alt→neu | reqWealth alt→neu (10A.1) | reqPrestige alt→neu |
|---|---|---|---|
| Baron | 3.000→1.500 | 1.000→500 | 20→10 |
| Graf | 6.000→2.200 | 3.000→1.500 | 50→25 |
| Landgraf | 10.000→3.200 | 6.000→3.000 | 90→45 |
| Markgraf | 15.000→4.800 | 10.000→6.000 | 140→70 |
| Fürst | 22.000→7.000 | 16.000→11.000 | 200→95 |
| Herzog | 32.000→10.000 | 25.000→18.000 | 280→115 |
| Kurfürst | 45.000→13.500 | 40.000→30.000 | 380→135 |
| König | 65.000→17.000 | 60.000→48.000 | 500→150 |
| Kaiser | 90.000→20.000 | 90.000→70.000 | 650→165 |

**TEST**: `node tests/agents/run-title-audit.js --label=10A_1` (gleiche 30
Seeds, gleiche 12 Agenten, unverändert).

**RESULT**: Baron-Erreichung 11,7 %→65,6 %, Graf 8,1 %→33,3 %, Verwalter
erreicht erstmals Kurfürst (33 %). **KEEP** — deutliche Verbesserung, aber
Diplomat/Machtpolitiker/Dynast/Versöhner weiterhin bei 0 % oberhalb
Freiherr (Grund: reqWealth, siehe 10A.2).

### 10A.2/10A.3 — reqWealth (weitere Absenkung unterer Stufen)

**HYPOTHESIS**: Aktiv-diplomatische/politische Archetypen scheitern nicht
an Bevölkerung oder Prestige, sondern an `reqWealth` — ihre Staatskasse
pendelt strukturell zwischen ~150 und ~700 Talern (Median ~220-260 über
alle simulierten Jahre, aktiv in Diplomatie/Hof investiert statt gehortet).

**DATA**: Perzentil-Analyse der Schatzkammer über alle simulierten Jahre:
Diplomat p50=222/p90=342/max=684, Machtpolitiker p50=261/p90=371/max=707,
Dynast p50=264/p90=400/max=731 (10A.1-Zwischenstand).

**CHANGE**: `reqWealth` Baron 500→150, Graf 1.500→250, Landgraf 3.000→500,
Markgraf 6.000→900, Fürst 11.000→2.000 (Herzog/Kurfürst/König/Kaiser
unverändert bei 12.000/22.000/40.000/65.000 — diese bleiben bewusst der
wirtschaftlichen Spitzenleistung vorbehalten).

**TEST**: `run-title-audit.js --label=10A_2` und `--label=10A_3`.

**RESULT**: Baron 65,6 %→99,2 %, Graf 33,3 %→78,6 %. Diplomat/
Machtpolitiker/Dynast erreichen jetzt zuverlässig Graf (100 %/100 %/97 %,
vorher 0 %/0 %/0 %). **KEEP.**

### 10A.4/10A.5 — Palast-/Kathedrale-Lücke im Testcode geschlossen (AGENT_POLICY_VERSION → phase10-v1)

**HYPOTHESIS**: Kein Agent baut je einen Palast oder eine Kathedrale —
`checkTitleProgress()` gated "König" hinter einem gebauten Palast (analog
zur Phase-9-Kathedrale-Voraussetzung für die Kaiserwahl), und
`checkElectionTrigger()` gated die Kaiserwahl selbst hinter Kurfürst-Rang
+ Kathedrale. Das ist eine Testcode-Lücke, keine Spielschwierigkeit.

**DATA**: Verwalter erreichte in 10A.3 wiederholt pop/wealth/prestige-Werte
weit über den König-Anforderungen (bis zu pop=20.403, wealth=202.569,
prestige=179 bei König-Anforderung pop=17.000/wealth=48.000/prestige=150),
blieb aber bei Kurfürst stehen — Ursache: kein Palast gebaut.

**CHANGE**: `considerBuildPalast()` neu in `shared-behaviors.js`, verdrahtet
in Verwalter/Diplomat/Machtpolitiker/Opportunist/Min-Maxer.
`considerBuildKathedrale()` + `handleElection()` zusätzlich in Verwalter
verdrahtet (bisher nur bei titelfokussierten Agenten). `AGENT_POLICY_VERSION`
`phase9-v1`→`phase10-v1` (technische Ergänzung, keine Balanceänderung an
den Agenten selbst — Begründung siehe `engine.js`-Kommentar).

**TEST**: `run-title-audit.js --label=10A_4` und `--label=10A_5`.

**RESULT**: König-Erreichung 0 %→53 % (Verwalter, 10A_4). Nach Ergänzung
von Kathedrale+Wahl bei Verwalter: **Kaiser-Erreichung 0 %→47 % (Verwalter,
10A_5)** — die erste Kaiserkrone in der gesamten Phase-9/10-Historie.
Aggregierte Kaiser-Rate über alle 12 Agenten: 3,9 %. **KEEP.**

**Bekannte offene Einschränkung** (nicht weiter verfolgt in dieser
Teilphase, siehe PHASE10_BALANCE_COMPARISON.md §G): Machtpolitiker/Diplomat
erreichen weiterhin nur Graf (0 % Landgraf+), während Anfänger vereinzelt
Landgraf erreicht (20 %) — §20 des Auftrags wollte Machtpolitiker/Diplomat
tendenziell vor Anfänger/passiv sehen. Ursache ist eine bei Machtpolitiker
strukturelle Bevölkerungsobergrenze (~2.100, verursacht durch dessen
eigene — laut §101 geschützte — Regierungsstil-Wahl von 55/100), die durch
keine Titelkurven-Anpassung umgangen werden kann, ohne entweder die
Agentenpolitik (§82 verboten) oder die Regierungsstil-Formel (§101
verboten) anzufassen. Als Befund dokumentiert, nicht behoben.

---

## 10B — Military Strategic Balance

**HYPOTHESIS**: Pikeniere sind universell dominant, weil sie am
kostengünstigsten pro Stärkepunkt sind. Kavallerie wird von `armyStrength()`
überbewertet, weil die Formel simpel `Anzahl × strength` aufsummiert und
dabei ignoriert, dass kleine Einheitenzahlen (Kavallerie ist teuer, daher
wenige Einheiten pro Budget) in der Kampf-Engine überproportional
verlieren (Masse/Moral-Dynamik).

**DATA** (erweitertes Composition Lab, 10 Kompositionen × 2 Formationen ×
2 Gelände-Stufen × 30 Seeds = 600 Versuche je Durchlauf, fixes Budget
3.000 Taler via echtem `takeLoan()`):

| Komposition | Ø Armystrength (alt) | Siegquote Ebene (alt) | Siegquote Ebene (neu) |
|---|---|---|---|
| Nur Pikeniere | 81 | 100 % | 100 % (unverändert — Battle Engine nicht angetastet) |
| Nur Schwere Kavallerie | 48 | 3,3 % | 3,3 % (unverändert) |
| Nur Söldner | 60 | 80 % | 80 % (unverändert) |

Vorher/Nachher zeigt: die tatsächlichen Schlachtergebnisse ändern sich
NICHT (Battle Engine unangetastet, `battle_test.js` weiterhin grün) — nur
die STRATEGISCHE `armyStrength()`-Schätzung wird ehrlicher. Prädiktive
Validität (Pearson-Korrelation `armyStrength` vs. tatsächliche Siegquote
über alle 10 Kompositionen): **0,637 (Baseline) → 0,687 (nach Rekalibrierung)**.

**Ursachentrennung** (§23): `TROOP_TYPES[type].strength` wird
ausschließlich von `armyStrength()` in `js/military.js:244` gelesen —
keine andere Datei, insbesondere kein `battle-engine/*.js`, referenziert
dieses Feld (verifiziert per Grep). Ursache B (Rekrutierungskosten) und C
(strategische armyStrength) sind damit sauber von Ursache D
(Battle-Engine-Matchups) trennbar; nur B und C wurden verändert, D
bleibt vollständig unangetastet.

**CHANGE** (`data/gamedata.js`, `TROOP_TYPES`, keine Battle-Engine-Änderung):

| Einheit | cost alt→neu | strength alt→neu | Begründung |
|---|---|---|---|
| Pikeniere | 110→140 | 3 (unverändert) | reduziert die reine Kosten-Dominanz, ohne die tatsächliche Kampfleistung zu verändern |
| Bogenschützen | 90 (unverändert) | 2→1,8 | armyStrength überschätzte die tatsächliche Leistung (13 % Siegquote) |
| Armbrustschützen | 130 (unverändert) | 2,5→2,3 | dieselbe Korrektur für den zweiten Fernkampftyp |
| Ritter | 400 (unverändert) | 8→5 | größter Ursache-C-Fund: 3,3-13,3 % Siegquote bei alter Bewertung 56 |
| Schwere Kavallerie | 650 (unverändert) | 12→6 | dito, 3,3 % Siegquote bei alter Bewertung 48 |
| Söldner | 200 (unverändert) | 4→4,5 | performte empirisch BESSER (80 %) als die alte Bewertung nahelegte |

**TEST**: `run-military-balance-lab.js --label=10B_2` (identische Methodik
wie Baseline, gleiche 30 Seeds).

**RESULT**: Prädiktive Validität 0,637→0,687 (**KEEP**). Kavallerie wird
jetzt in der strategischen Schätzung korrekt als schwach ausgewiesen
(armyStrength 48→24 für Schwere Kavallerie) statt fälschlich stark. Reine
Fernkampf-Kompositionen (Bogenschützen/Ranged-heavy) bleiben die
verbleibende Restungenauigkeit (Ø Armystrength weiterhin höher als ihre
13,3 %/6,7 % Siegquote nahelegt) — bewusst NICHT weiter nachjustiert
(§99 Kein Whack-a-Mole: eine dritte/vierte Korrekturrunde an ohnehin
selten alleine gespielten Reinformationen hätte das Risiko neuer
Verzerrungen an anderer Stelle erhöht, für einen bereits klar erreichten
Kernbefund — Kavallerie-Überbewertung behoben). Pikeniere bleiben nach
wie vor die verlässlichste frühe Infanterie (100 % Siegquote unverändert,
da Battle Engine nicht angetastet), aber nicht mehr die günstigste Wahl
pro Stärkepunkt (Bogenschützen/Miliz jetzt günstiger) — adressiert §90
("nicht mehr universell dominant") auf der einzigen im Scope erlaubten
Ebene (Kosten/Bewertung), ohne die Battle Engine zu berühren.

**Nicht verändert** (bewusst, §33/§34): `recruitPopCostPerUnit` bleibt
für alle Einheitentypen bei 4 (unverändert) — die armyStrength-Korrektur
adressiert bereits die Kernsorge ("Kavallerie täuscht strategisch vor,
stark zu sein"); eine zusätzliche Differenzierung der Bevölkerungskosten
hätte in derselben Iteration zu viele Variablen gleichzeitig verändert
(§110).

---

## 10C — War Economy

**HYPOTHESIS**: Die 73-93 % Bankrott-Rate aggressiver Archetypen (Phase 9)
hat einen einzelnen dominanten Kostenpunkt, nicht diffus "Krieg ist
teuer" — vermutlich laufender Unterhalt statt einmaliger Rekrutierung.

**DATA** (neuer `run-war-economy-audit.js`: vollständige monatliche
`applyMonthlyFinances()`-Aufschlüsselung — taxIncome/upkeep/salaries/
debtInterest/vassalTribute — über 15 Seeds × 4 kriegerische Archetypen):
**Unterhalt ("upkeep") ist mit 34-53 % Anteil am Gesamteinkommen der
mit Abstand größte einzelne erfasste Abfluss** — 1,5-2× so groß wie
Zinsen oder Beratergehälter. **Zusätzlicher, unerwarteter Fund**:
`avgTotalVassalTribute` war für ALLE vier Archetypen exakt **0**, obwohl
Kriegsherr/Hardliner regelmäßig ganze Regionen vollständig erobern und
vasallisieren (`state.vassals[aiId] = true`, bestätigt per
Reproduktionsskript). Ursache gefunden: `applyMonthlyFinances()`
(`js/advance-year.js:277`) berechnete Tribut als
`totalPop * vassalizeTributeShare * 0.02 / 12` — der überzählige Faktor
`× 0.02` lässt das Ergebnis für jede realistische Regionsgröße
(2.000-3.000 Einwohner, `vassalizeTributeShare=0.08`) auf 0 Taler/Monat
runden (nötig wären >3.750 Einwohner für auch nur 1 Taler). **Das ist ein
echter Bug**, kein Balance-Werkzeug: der einzige dauerhafte
wirtschaftliche Eroberungsertrag im Spiel floss faktisch nie.

**CHANGE**: `js/advance-year.js` — erroneous `* 0.02`-Faktor entfernt:
`tribute = Math.round(totalPop * vcfg.vassalizeTributeShare / 12)`. Reine
Bugfix-Korrektur (ein offensichtlicher Formelfehler, keine neu erfundene
Zahl) — `vassalizeTributeShare` (0,08) selbst unverändert, exakt wie im
Kommentar "Anteil der KI-Wirtschaftskraft, der jährlich als Tribut
fließt" beschrieben, jetzt aber tatsächlich wirksam.

**TEST**: `run-war-economy-audit.js --label=10C_1` (identische Methodik,
gleiche 15 Seeds).

**RESULT**:

| Agent | Bankrott-Rate alt | Bankrott-Rate neu | Ø Vasallentribut (Kampagne) |
|---|---|---|---|
| Kriegsherr | 93 % | **7 %** | 25.055 |
| Hardliner | 80 % | **0 %** | 22.688 |
| Opportunist | 80 % | 73 % | 4.928 |
| Min-Maxer | 73 % | 73 % | 0 |

**KEEP.** Dramatische Verbesserung für die beiden Archetypen, die
zuverlässig VOLLSTÄNDIGE Regionseroberungen abschließen (Kriegsherr,
Hardliner) — genau das vom Auftrag gewünschte Muster: **ein gut
durchgeführter, abgeschlossener Krieg trägt sich jetzt selbst** (§51).
Opportunist (wiederholte Kriegserklärung-Friedensvertrag-Zyklen ohne
volle Eroberung, siehe PHASE9_GAMEPLAY_AUDIT.md §AL Punkt 3) und
Min-Maxer (kurze, gezielte Exploit-Testphasen ohne abgeschlossene
Eroberung) bleiben bei hoher Bankrott-Rate — **das ist beabsichtigt und
korrekt**: unfokussierter/unvollendeter Krieg bleibt teuer und riskant
(§52 "Schlechter Krieg muss wehtun"), nur der abgeschlossene, gewonnene
Krieg wird nachhaltig. Kein `battle-engine/*.js` und keine Rekrutierungs-
/Unterhaltskosten selbst angefasst — reiner Territorial-Ertrags-Bugfix
(§136 explizit erlaubt).

**Nicht verändert**: Unterhaltskosten (`TROOP_TYPES[*].upkeep`) selbst
bleiben unangetastet — sie sind weiterhin der größte laufende Abfluss,
aber das ist jetzt durch echten Eroberungsertrag ausgleichbar statt
strukturell unausgleichbar. Eine zusätzliche Unterhalts-Senkung hätte in
derselben Iteration zu viele Variablen gleichzeitig verändert (§110) und
war nach diesem Fund auch nicht mehr nötig, um das Kernproblem
("Boom → Kollaps") zu lösen.

---

## 10D — Late Game Incentives

**HYPOTHESIS**: Das in Phase 9 gefundene Spätspiel-Ziel-Vakuum (§AK des
Phase-9-Berichts) ist zu einem erheblichen Teil eine FOLGE des
Titelaufstieg-Flaschenhalses (10A) und der Kriegsökonomie-Sackgasse (10C)
— nicht eines fehlenden Systems. Prüfung VOR jeder neuen Content-Ergänzung
(§58): reichen die bestehenden Systeme (Titel/Prestige/Dynastie/
Kaiserwahl/Diplomatie/Handel/Chronik), sobald 10A/10C wirken?

**DATA**: Titel-Audit nach 10A+10B+10C kombiniert (`title_audit_10D_combined.json`,
gleiche 30 Seeds): Verwalter erreicht weiterhin zuverlässig Kurfürst (50 %),
König (47 %) und **Kaiser (47 %)** — die Titelleiter bietet dieser
Spielweise jetzt über die gesamte Kampagne hinweg echte, erreichbare
nächste Ziele bis zum Schluss, nicht nur in den ersten Jahrzehnten.
Kriegsherr/Hardliner (jetzt wirtschaftlich tragfähig dank 10C) haben mit
vollständiger Kartenkontrolle + Vasallentribut ein reales, erreichbares
Mittel-/Spätspielziel, auch wenn ihre Titelprogression durch die eigene
kriegsbedingte Bevölkerungsdezimierung begrenzt bleibt (siehe X-Verweis
`PHASE9_GAMEPLAY_AUDIT.md` — thematisch stimmig: reine Eroberungspolitik
baut keine demografische Größe auf, die für höchste Titel nötig wäre).

**Geldsättigung (§67-69)**: Verwalter erreicht am Spielende regelmäßig
150.000-400.000 Taler — weit über der Kaiser-Anforderung (65.000). Sobald
Titel-/Gebäudeschwellen erfüllt sind, verliert zusätzliches Geld
tatsächlich an Bedeutung (§69 träfe unverändert zu). **Bewusst KEIN neuer
Geldsenke/keine neue Luxussteuer erfunden** (§65 explizit verboten) — dies
bleibt ein akzeptierter, nicht dringender Charakterzug bestehender
Systeme, kein neuer Befund, der in dieser Phase behoben werden muss.

**CHANGE**: **Keine zusätzliche Produktionsänderung** — die Prüfung
bestätigt, dass 10A (Titelkurve) und 10C (Kriegsökonomie) das
Spätspiel-Ziel-Vakuum bereits für die Archetypen lösen, die überhaupt
lange genug überleben, um es zu erreichen (Verwalter, Kriegsherr,
Hardliner). Kein neues Gebäude, keine neue Ressource, kein Quest-System
(§62/§70 explizit ausgeschlossen).

**RESULT**: **KEEP as-is.** Verbleibende Lücke (Diplomat/Machtpolitiker/
Dynast/Versöhner erreichen keine Spätspiel-Titel) ist dieselbe strukturelle
Bevölkerungsobergrenze aus 10A — als Phase-11-Kandidat vermerkt (siehe
PHASE10_BALANCE_COMPARISON.md §BD), nicht in 10D behoben (würde
Agentenpolitik oder Regierungsstil-Formel erfordern, beide außerhalb des
Scopes, siehe §82/§101).
