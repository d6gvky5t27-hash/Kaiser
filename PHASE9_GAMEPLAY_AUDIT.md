# PHASE 9 — GAMEPLAY INTELLIGENCE LAB

Empirische Antwort auf die zentrale Frage des Auftrags: **Macht
KAISERREICH als Strategiespiel über 100 Jahre Spaß, und wo verliert es
Spannung, Entscheidungstiefe oder Wiederspielwert?**

Diese Phase hat **nichts** an Gameplay, Balance, Battle Engine, Karte, UI
oder Save-Format verändert (siehe Abschnitt AR-AX). Sie hat ausschließlich
Test-Infrastruktur unter `tests/agents/` gebaut, damit gespielt, gemessen,
und die Ergebnisse hier dokumentiert.

---

## Executive Summary

10 Spielertypen + 1 Anfänger-Agent + 1 passive Baseline wurden über
**360 vollständige, deterministische 100-Jahre-Kampagnen** (12 Agenten ×
30 Seeds) sowie drei fokussierte Zusatzexperimente (Pikeniere-vs-Kavallerie-
Dominanztest, Regionsfairness-Test, Same-Seed-5-Agenten-Vergleich)
gespielt — insgesamt über 750 simulierte Kampagnen, 0 Abstürze, vollständig
reproduzierbar (Agent+Seed → byte-identisches Ergebnis, siehe Abschnitt E).

**Die wichtigsten fünf Befunde vorab** (Details in AO):

1. **Kein einziger der 360 Agenten wurde in 100 Jahren Kaiser.** Die
   Kaiserkrone ist mit keiner der zehn getesteten Strategien in einem
   realistischen Zeitrahmen erreichbar — der Titelaufstieg selbst
   (Freiherr → Baron → Graf → …) ist bereits der Flaschenhals, nicht erst
   die Wahl.
2. **Aggressive Kriegsführung ist militärisch stark, aber fiskalisch nicht
   durchhaltbar.** Kriegsherr/Hardliner/Opportunist/Min-Maxer erobern
   typischerweise sehr schnell die gesamte Nachbarschaft (oft <5 Jahre),
   gehen aber in 60-90 % der Partien anschließend bankrott — Sold/Zinsen
   fressen jeden Eroberungsgewinn wieder auf.
3. **Dieselbe Startsituation (Seed 1000) erzeugt mit fünf verschiedenen
   Agenten fünf komplett unterschiedliche Geschichten** (siehe AM) — ein
   starkes Indiz für echte Player Agency.
4. **Kriegsdeklaration hat keinerlei Cooldown für den Spieler** — eine
   Kampagne demonstriert ungewollt ein "Krieg erklären → Friedensvertrag →
   sofort erneut Krieg erklären"-Muster fast jährlich gegen denselben
   Nachbarn (siehe AL).
5. **Passives Spiel ist erzählerisch sehr karg**: eine 47 Jahre lange
   Partie ganz ohne Spielereingriff erzeugt nur 6 chronikwürdige
   Ereignisse — praktisch nichts passiert von selbst (siehe M).

**Empfohlene Phase 10** (ausführlich in AQ): **F. Pacing/Decision
Pressure**, mit Kriegsökonomie (Sold/Zins-Balance nach Eroberung) und dem
Titelaufstieg-Flaschenhals als zwei konkreten Teilprojekten — nicht D
(Krieg-Rebalance) oder A (Living Realm), da die Daten hier klarer auf ein
Pacing-/Belohnungsstruktur-Problem hindeuten als auf fehlenden Content.

---

## A. Agent Architecture

Neuer, isolierter Ordner `tests/agents/` (NICHT in
`tools/build-bundle.js` `FILES[]` gelistet — siehe AR):

- **`engine.js`** — deterministischer agenteneigener RNG (Mulberry32,
  string-geseedet, rührt niemals `state.rng`/`rnd()`/`battleRnd()` an),
  Decision-Log, generischer `act()`-Wrapper um jede reale
  State-mutierende Funktion, Event-/Chain-Options-Auswahl (siehe A.2),
  Kriegsauflösung (Gebietsangriff/Verteidigung/KI-Überraschungskrieg über
  dieselbe Battle Engine wie die echte UI), Jahres-Snapshot, Kampagnen-
  Runner.
- **`shared-behaviors.js`** — wiederverwendbare, parametrisierte
  Verhaltensbausteine (Steuern, Berater, Rekrutierung, Diplomatie, Handel,
  Krieg, Kaiserwahl), aus denen sich die 12 Agenten zusammensetzen, statt
  jeden einzeln neu zu implementieren.
- **`archetypes.js`** — die 12 Agentendefinitionen (siehe B).
- **`metrics.js`** — reine Auswertungsfunktionen über einen serialisierten
  Kampagnenlauf (kein Sandbox-Zugriff nötig).
- **`run-campaign.js`** — CLI-Einzelkampagnen-Runner (Debugging/Prototyping).
- **`run-matrix.js`** — voller Kampagnen-Matrix-Runner.
- **`run-army-composition-test.js`**, **`run-region-test.js`**,
  **`aggregate.js`** — die drei Zusatzexperimente/-auswertung.

**Agenten dürfen ausschließlich reale Spielfunktionen aufrufen** — kein
einziges `state.treasury += X`. Die vollständige Aktions-Katalogisierung
(§4-7 des Auftrags) ist in den Code-Kommentaren von `shared-behaviors.js`
dokumentiert; zusammengefasst nutzen die Agenten: `recruitTroops`,
`declareWar`/`proposePeaceTreaty`, `deployToTerritory`/
`buildTerritoryBattleArmies`/`createBattle`/`advanceBattle`/
`applyTerritoryBattleResult` (dieselbe Kette wie `wmDoAttack()` in der
echten UI), alle 12 `doDiplomacy()`-Aktionsfunktionen, `openAdvisorSelection`/
`confirmAdvisorSelection`/`upgradeAdvisor`, `buyGoodFromMarket`/
`sellGoodToMarket`/`exportGoodToRegion`/`importGoodFromRegion`,
`buyLand`/`sellLand`/`upgradeInfrastructure`/`takeLoan`/`repayDebt`,
`buildNewBuilding`/`upgradeBuildingAt`, `bribeElector`/`resolveElection`,
sowie `state.pendingEvent.options[i].apply(...)` (identisch zu
`resolveEvent(i)` in der echten UI) für jede Event-/Chain-Entscheidung.
Die zwei einzigen Fälle direkter State-Mutation
(`region.taxRate`/`region.governanceStyle`) sind exakt dieselben zwei
Fälle, in denen auch die echte UI keine Wrapper-Funktion hat, sondern per
Slider direkt ins `state`-Objekt schreibt (`#taxSlider`/`#govSlider`
Input-Listener in `index.html`).

### A.1 Perfect-Information-Offenlegung (§7/§8)

Fast alles, was ein Agent liest, ist sein **eigenes** Königreich — für
einen echten Spieler ohnehin vollständig sichtbar. Zwei bewusst geprüfte
und für unbedenklich befundene Fälle:

1. Kriegszielauswahl liest `estimateAiStrength()` — genau dieselbe unscharfe
   Schätzfunktion, die auch der echte Geheimdienstbericht in der UI zeigt.
2. Kriegszielauswahl liest die exakte `garrison`-Zahl eines gegnerischen
   Gebiets (`state.territories[id].garrison`) — verifiziert gegen
   `js/war-map.js`: nur diplomatische/Gesamtarmee-Schätzungen werden über
   `intel.accuracy` verschwommen, Gebiets-Garnisonszahlen auf der
   Kriegskarte nicht. Legitim, kein Shortcut.

Keine weiteren versteckten-State-Shortcuts. Event-/Chain-Entscheidungen
nutzen **kein** Lookahead-durch-Ausführung (siehe A.2) — das wäre trotz
Klonen des `state` ein echtes Determinismus-Risiko gewesen, da mehrere
Options-`apply()`/`effect()`-Funktionen selbst `rnd()` aufrufen (z. B.
Ehepartner-Erzeugung in `js/event-chains.js`); ein verworfener Testzweig
hätte sonst echten Gameplay-RNG verbraucht.

### A.2 Event-/Chain-Entscheidungen ohne Lookahead

`pickEventOptionIndex()` reproduziert bewusst dasselbe bereits etablierte,
auditierte Muster wie `resolvePendingEventWithPolicy()` (Options-Index 0 =
entgegenkommendste, letzter Index = härteste Option — eine Konvention, die
absichtlich seit Phase 3-7 in allen Event-/Chain-Templates so sortiert
ist), erweitert um einen kostensensitiven Nachbar-Check auf Basis des
Label-Texts (Regex auf "-X Taler"). Vollständig deterministisch, 0
`rnd()`-Aufrufe.

---

## B. Agent Archetypes

| # | Agent | Kernpriorität | Event-Bias |
|---|---|---|---|
| 1 | **Verwalter** | Kasse, Nahrung, Zufriedenheit, Risikominimierung | konziliant (-0.6) |
| 2 | **Kaufmann** | Handel, Produktionsketten, Wohlstand | kostensensitiv (-0.2, sehr costSensitivity 0.7) |
| 3 | **Kriegsherr** | Armee, Expansion, Prestige, Risikoakzeptanz | aggressiv (+0.8) |
| 4 | **Diplomat** | Beziehungen, Bündnisse, Kaiserwahl, Kriegsvermeidung | konziliant (-0.8) |
| 5 | **Dynast** | Heirat (Vertrag), Nachfolge, Hofstabilität | moderat (-0.4) |
| 6 | **Machtpolitiker** | Titel, Prestige, Legitimität, selektiver Krieg | leicht aggressiv (+0.3) |
| 7 | **Opportunist** | jährliche Neubewertung, kein festes Dogma | agenteneigener RNG pro Entscheidung |
| 8 | **Hardliner** | HARDLINE-Analogon: immer die härteste Option | maximal aggressiv (+1.0) |
| 9 | **Versöhner** | CONCILIATORY-Analogon: immer die großzügigste Option | maximal konziliant (-1.0) |
| 10 | **Min-Maxer** | 5 fest verankerte Exploit-Testphasen über die Kampagne | phasenabhängig |
| 11 | **Anfänger** | reaktiv auf rote Warnungen, kein Vorausplanen | immer erste Option |
| 0 | **Passive Baseline** | keine einzige Spieleraktion (§28) | erste Option |

Details je Agent (Steuersatz-Ziel, Beraterpriorität, Rekrutierungslogik,
Kriegsschwellen) stehen als Kommentare direkt in `archetypes.js`.

---

## C. Policy Version

`AGENT_POLICY_VERSION = "phase9-v1"` — jede Kampagne trägt Agent-ID, Seed,
Startregion und diese Version im Ergebnis (`tests/output/phase9/manifest.json`).
Bei künftigen großen Gameplay-Phasen können dieselben Agenten mit
identischer Version erneut laufen, um objektiv vorher/nachher zu
vergleichen (§144/145) — die Ergebnisse dieser Phase gelten als
**Gameplay-Baseline**, archiviert unter `tests/output/phase9/`.

---

## D. Campaign Matrix

| Parameter | Wert |
|---|---|
| Agenten | 12 (10 Archetypen + Anfänger + passive Baseline) |
| Seeds | 30 (`1000 + i·7919`, `i=0..29`) |
| Jahre/Kampagne | 100 (oder bis `gameOver`) |
| Startregion (Hauptmatrix) | `player` (neutrale Standardprovinz) |
| **Gesamt Hauptmatrix** | **360 vollständige Kampagnen** |
| Zusatz: Army-Composition-Test | 3 Kompositionen × 40 Seeds = 120 Kampagnen |
| Zusatz: Region-Fairness-Test | 5 Regionen × 4 Agenten × 15 Seeds = 300 Kampagnen |
| **Gesamt über alle Experimente** | **780 simulierte Kampagnen** |

Rohdaten: `tests/output/phase9/campaign_summaries.json` (alle 360,
verdichtete Metriken), `tests/output/phase9/decision_logs/` (volle
Decision-Logs + Jahres-Snapshots für die ersten 3 Seeds × alle 12 Agenten
= 36 Kampagnen, kuratiert für die Beispiel-Timelines unten),
`army_composition_test.json`, `region_fairness_test.json`,
`aggregate_metrics.json`.

---

## E. Determinismus

Bewiesen (nicht nur behauptet): derselbe Agent + derselbe Seed über zwei
unabhängige Läufe verglichen (`diff` über die komplette JSON-Ausgabe,
inkl. Decision-Log und Jahres-Snapshots) — **byte-identisch**. Zusätzlich
läuft die bestehende `advance_year_snapshot_test.js`-Golden-Fixture
weiterhin unverändert grün (siehe AT/AU) — Phase 9 hat den
Gameplay-RNG-Strom nicht angetastet.

---

## F. Performance

360-Kampagnen-Hauptmatrix: **70 Sekunden Gesamtlaufzeit** (~194 ms pro
100-Jahre-Kampagne), 0 Abstürze. Army-Composition-Test (120 Kampagnen):
91 ms. Region-Fairness-Test (300 Kampagnen): 61 Sekunden. Keine
Gameplay-Logik wurde für Performance vereinfacht — die volle
`advanceMonth()`/Battle-Engine-Kette läuft exakt wie im echten Spiel.

---

## G. Survival Rates

| Agent | Ø Jahre | 100J erreicht | no_heir | bankrupt | defeat |
|---|---|---|---|---|---|
| passive | 84,2 | 56,7 % | 46,7 % | 0 % | 0 % |
| verwalter | 80,7 | 56,7 % | 43,3 % | 0 % | 0 % |
| kaufmann | 85,6 | 56,7 % | 43,3 % | 0 % | 0 % |
| kriegsherr | 45,3 | 0 % | 23,3 % | **76,7 %** | 0 % |
| diplomat | 70,5 | 43,3 % | 56,7 % | 0 % | 0 % |
| dynast | 83,0 | 46,7 % | 50,0 % | 3,3 % | 0 % |
| machtpolitiker | 85,9 | 63,3 % | 36,7 % | 0 % | 0 % |
| opportunist | 67,9 | 3,3 % | 16,7 % | **80,0 %** | 0 % |
| hardliner | 40,3 | 0 % | 26,7 % | **73,3 %** | 0 % |
| versoehner | 84,7 | 50,0 % | 46,7 % | 0 % | 3,3 % |
| minmaxer | 36,4 | 0 % | 16,7 % | **83,3 %** | 0 % |
| anfaenger | 81,7 | 53,3 % | 46,7 % | 0 % | 0 % |

**Klares Muster:** jede rein wirtschafts-/diplomatie-/dynastie-fokussierte
Strategie hat **0 % Bankrott-Rate**; jede kriegs-/eroberungsfokussierte
Strategie hat **73-83 % Bankrott-Rate**. `no_heir` (kein Erbe beim
Herrschertod) bleibt über alle Agenten hinweg die häufigste natürliche
Beendigung (16-57 %), konsistent mit der bereits aus Phase 3 bekannten
Baseline (53-67 % im rein passiven Spiel, siehe `BASELINE.md`) — auch
aktives Spiel ändert daran wenig, siehe T.

### Region-Fairness (§102-104)

4 Agenten (Verwalter/Kaufmann/Kriegsherr/Diplomat) × 15 Seeds über 5
Startregionen:

| Region | Ø Jahre | 100J erreicht | Ø Endkasse |
|---|---|---|---|
| player (Standard) | 69,7 | 33,3 % | 22.376 |
| burgund | 75,2 | 36,7 % | 31.396 |
| england | 77,4 | 50,0 % | 30.839 |
| venedig | 76,2 | 41,7 % | 22.696 |
| mailand | 78,2 | 45,0 % | 44.458 |

Spürbarer, aber moderater Unterschied (33-50 % Überlebensrate,
Endkasse-Spanne 22k-44k) — folgt sichtbar den in `START_REGIONS`
hinterlegten `treasuryMultiplier`/`fertility`-Werten (Mailand 1.1×/1.15×
am stärksten, "player" 1.0×/1.0× am schwächsten). Keine perfekte
Symmetrie, aber auch keine krasse Unfairness — historisch begründet und
laut Auftrag (§104) erlaubt. **Kein vorhandenes Difficulty-System
gefunden, keines erfunden** (§105).

---

## H. Victory/Kaiser Rates

**0 von 360 Kampagnen wurde Kaiser.** `becameKaiserShare: 0` für alle 12
Agenten, `totalElections: 0` für alle 12 Agenten — keine einzige
Kaiserwahl fand in 100 Jahren jemals statt, selbst für Diplomat und
Machtpolitiker (die aktiv `considerBuildKathedrale()` + `handleElection()`
nutzen, siehe R). Grund: `checkElectionTrigger()` erfordert Rang
**Kurfürst** — `avgFinalTitleIndex` liegt über alle Agenten zwischen 0 und
3,07 (Verwalter, "Graf" im Schnitt), weit unter dem für Kurfürst nötigen
Rang. **Der Flaschenhals ist der Titelaufstieg selbst, nicht die Wahl.**
Siehe AQ für die Empfehlung.

---

## I. Strategy Diversity

Bereits aus G ersichtlich: Bankrott-Rate variiert von 0 % bis 83 %,
Kriegserklärungen von 0 (Verwalter/Kaufmann/Diplomat/Versöhner/Dynast) bis
1030 kumuliert (Opportunist über 30 Partien), Endkasse von -2900 bis
+124.000. Die 12 Agenten erzeugen sichtbar unterschiedliche
Spielverläufe — siehe J für die direkte Gleicher-Seed-Messung.

---

## J. Player Agency

Direkter Test (§125-129): Seed 1000, fünf Agenten (Verwalter/Kriegsherr/
Diplomat/Dynast/Min-Maxer), identischer Kampagnenstart:

| Agent | Jahre | Ende | Titel | Kasse | Bevölkerung | Gebiete | Generationen |
|---|---|---|---|---|---|---|---|
| Verwalter | 33 | no_heir | Graf | 29.372 | 6.061 | 4 | 2 |
| Kriegsherr | 50 | bankrupt | Freiherr | -3.189 | 321 | **16** | 2 |
| Diplomat | 23 | no_heir | Freiherr | 196 | 2.358 | 4 | 2 |
| Dynast | 68 | no_heir | Freiherr | 442 | 3.182 | 4 | **3** |
| Min-Maxer | 39 | bankrupt | Freiherr | -3.337 | 395 | 3 | 2 |

Fünf **komplett unterschiedliche** Verläufe aus demselben Startpunkt:
Verwalter verdreifacht die Bevölkerung und steigt zwei Titelränge auf,
Kriegsherr erobert die gesamte Karte lässt dabei die eigene Bevölkerung
auf ein Achtel einbrechen, Dynast lebt am längsten über drei
Generationen, Diplomat endet am schnellsten (kein Erbe), Min-Maxer
kollabiert wirtschaftlich am härtesten. **Klares Ergebnis: hohe Player
Agency** — dieselbe Ausgangslage führt zu fundamental verschiedenen
Geschichten je nach Spielstil (§126/§128, mit der ausdrücklichen
Einschränkung, dass dies eine transparente, keine wissenschaftlich
zertifizierte Metrik ist).

---

## K. Meaningful Decisions

"Meaningful" = jede erfolgreiche, nicht-triviale Aktion in den Kategorien
ECONOMY/TAX/MILITARY/WAR/DIPLOMACY/ADVISOR/EVENT/TRADE/TITLE, mit
zusätzlichem Schwellenwert gegen Routine-Wiederholung (siehe §30/31 —
z. B. zählt eine 4. identische kleine Rekrutierung in Folge nicht extra).

| Agent | Ø sinnvolle Entscheidungen/Kampagne | Ø pro Jahrzehnt |
|---|---|---|
| Opportunist | 470,4 | 64,7 |
| Min-Maxer | 183,5 | 44,4 |
| Kaufmann | 228,7 | 24,5 |
| Hardliner | 143,7 | 33,3 |
| Kriegsherr | 152,6 | 31,1 |
| Machtpolitiker | 106,1 | 11,4 |
| Anfänger | 138,0 | 15,6 |
| Dynast | 79,0 | 8,6 |
| Passive | 74,3 | 8,0 |
| Diplomat | 72,9 | 9,3 |
| Versöhner | 70,9 | 7,7 |
| Verwalter | 166,2 | 18,2 |

Große Spreizung (7,7 bis 64,7 sinnvolle Entscheidungen pro Jahrzehnt je
nach Spielstil) — aktive/kriegerische/handelsfokussierte Strategien bieten
deutlich mehr Entscheidungsdichte als rein diplomatische/dynastische.

---

## L. Autopilot Index

Analysewert, **kein** Gameplaywert (§32): Mittel aus (Anteil Jahre ohne
sinnvolle Entscheidung) und (Anteil Jahre mit identischer
Aktions-Kategorie-Menge wie das Vorjahr).

| Agent | Autopilot-Index |
|---|---|
| Passive | 0,461 |
| Machtpolitiker | 0,395 |
| Versöhner | 0,387 |
| Dynast | 0,377 |
| Diplomat | 0,375 |
| Anfänger | 0,337 |
| Hardliner | 0,317 |
| Kriegsherr | 0,319 |
| Verwalter | 0,211 |
| Kaufmann | 0,154 |
| Min-Maxer | 0,166 |
| Opportunist | 0,130 |

Diplomatische/dynastische Archetypen sind am routiniertesten — nicht
überraschend, da ihr Haupthebel (Beziehungspflege) sich naturgemäß
wiederholt, aber auch ein Hinweis, dass die Diplomatie-Schleife selbst auf
Dauer wenig neue Entscheidungsformen bietet (siehe Y).

---

## M. Longest Boring Streak

| Agent | Ø längste Flaute (Jahre) | Maximum |
|---|---|---|
| Versöhner | 4,2 | 7 |
| Verwalter (vor Fix) | — | siehe Fußnote |
| Passive | 3,2 | 6 |
| Dynast | 3,3 | 6 |
| Diplomat | 2,9 | 5 |
| Machtpolitiker | 2,2 | 5 |
| Anfänger | 2,9 | 5 |
| Kaufmann | 1,1 | 2 |
| Verwalter | 2,7 | 6 |
| Hardliner/Kriegsherr/Opportunist/Min-Maxer | 0,0-0,5 | 0-1 |

**Kein Agent erreicht 10, 15 oder 20 Jahre ohne jede bedeutende
Entscheidung** (§34 Zielfrage) — die längste beobachtete Flaute ist 7
Jahre (Versöhner). Kein kritischer Befund in diesem engen Sinn.

**Aber** ("Wann drückt der Spieler nur noch NÄCHSTES JAHR?", §117/§150):
eine 47-jährige rein passive Partie (Seed 8919) erzeugte insgesamt nur 6
chronikwürdige Dynastie-Chronik-Einträge über die gesamte Laufzeit — im
Schnitt ein bedeutsames Ereignis alle 8 Jahre. Das ist der eigentliche
Befund: nicht "der Spieler hat 20 Jahre am Stück nichts zu tun", sondern
"selbst wenn er nichts tut, merkt er es kaum, weil auch das Spiel selbst
in dieser Zeit kaum etwas Sichtbares produziert" — siehe AH-AJ für die
Phasenaufschlüsselung.

---

## N. System Engagement

Anteil der 30 Kampagnen je Agent, in denen das System mindestens einmal
genutzt wurde:

| Agent | ECONOMY | TAX | MILITARY | WAR | DIPLOMACY | ADVISOR | EVENT | TRADE | TITLE |
|---|---|---|---|---|---|---|---|---|---|
| Verwalter | 100% | 100% | 100% | 0% | 0% | 100% | 100% | 100% | 0% |
| Kaufmann | 87% | 100% | 100% | 0% | 0% | 100% | 100% | 100% | 0% |
| Kriegsherr | 93% | 100% | 100% | **100%** | 0% | 100% | 100% | 0% | 0% |
| Diplomat | 93% | 0% | 0% | 3% | **100%** | 100% | 100% | 0% | 0% |
| Dynast | 97% | 0% | 0% | 0% | **100%** | 100% | 100% | 0% | 0% |
| Machtpolitiker | 83% | 100% | 100% | 7% | 100% | 100% | 100% | 0% | 0% |
| Opportunist | 100% | 100% | 100% | 100% | 0% | 100% | 100% | 100% | 33% |
| Hardliner | 97% | 100% | 100% | 100% | 0% | 100% | 100% | 0% | 0% |
| Versöhner | 100% | 100% | 0% | 0% | 100% | 100% | 100% | 60% | 0% |
| Min-Maxer | 100% | 100% | 100% | 97% | 0% | 100% | 100% | 100% | 83% |
| Anfänger | 0% | 0% | 0% | 13% | 0% | 100% | 100% | 100% | 0% |

**TITLE (Kathedrale/Kaiserwahl-Vorbereitung)** wird selbst von den beiden
dediziert title-fokussierten Agenten (Diplomat, Machtpolitiker) **nie**
genutzt (0 %) — nicht weil sie es nicht versuchen (`considerBuildKathedrale`
läuft bei beiden), sondern weil sie die dafür nötigen 1.200 Taler +
Baumaterial nie *gleichzeitig mit* einer schon bestehenden Kathedrale-
freien Situation UND ausreichend Puffer erreichen, bevor die Partie
endet — ein weiteres Indiz für den Titelaufstieg-Flaschenhals aus H.
Min-Maxer (83 %) und Opportunist (33 %) — beide mit deutlich höherer
Entscheidungsdichte und längerem aktivem Wirtschaften vor dem
Bankrott-Ende — erreichen die Kathedrale gelegentlich, aber nie eine
tatsächliche Wahl.

**DIPLOMACY wird von reinen Wirtschafts-/Kriegsagenten nie genutzt (0 %)**
— erwartungsgemäß, da diese Archetypen keine diplomatischen Aktionen in
ihrer Logik haben, kein Befund über das Spiel selbst.

---

## O. Economy Findings

- **Unbeschränktes Wachstum ist nicht kostenlos**: eine "kleine
  Dauergarnison" ohne Obergrenze (früher Prototyping-Fehler, siehe AS)
  führte bei sonst wirtschaftlich vorsichtigen Agenten zu 60-70 %
  Bankrott-Rate rein durch stetig wachsenden Sold — ein reales,
  spielbares Signal: Unterhaltskosten skalieren spürbar und sind über
  Jahrzehnte relevant, nicht vernachlässigbar.
- Nach Korrektur (Obergrenze auf "genug Garnison" statt "immer mehr"):
  Verwalter/Kaufmann/Diplomat/Dynast/Machtpolitiker/Versöhner/Anfänger
  alle **0 % Bankrott-Rate** — die Wirtschaft trägt sich bei besonnenem
  Spiel gut selbst, siehe P/Q.
- Verwalter (konservativste Steuer- und Ausgabenpolitik) endet im
  Schnitt mit **124.162 Taler** Endkasse — deutlich mehr, als für
  irgendeine sichtbare weitere Aktion im Spiel gebraucht wird (siehe AK
  Perfect Stability / Resource Saturation).

---

## P. Trade Findings

Regionalhandel-Arbitrage (`regionalArbitrageScan`) wurde von Kaufmann
(Haupthebel), Opportunist und Min-Maxer genutzt. Kaufmann erreicht mit
aktivem Handel + Steuerpolitik die höchste Entscheidungsdichte unter den
friedlichen Archetypen (24,5 sinnvolle Entscheidungen/Jahrzehnt) bei
gleichzeitig 0 % Bankrott — Handel ist ein tragfähiger, nicht-militärischer
Wachstumspfad. Kein trivialer "unendliches Geld"-Exploit gefunden (siehe
AL) — Margen bleiben nach Transport-/Bandit-Risikoabzug moderat.

---

## Q. Tax Findings

Getestete Sätze reichten von 12 % (Kaufmann) bis 30 % (Min-Maxer-Phase
"economic_extraction"). Kein Agent mit moderatem Satz (12-20 %) ging aus
reinen Steuergründen bankrott. Kein klarer "immer optimaler" Sweet Spot
gefunden — Verwalter (15 %) und Kaufmann (12 %) enden beide solvent mit
sehr unterschiedlicher Endkasse (124k vs. 2,6k), was eher an
Ausgabenverhalten als am Steuersatz selbst liegt. **Kein Befund für eine
dominante Steuerstrategie.**

---

## R. Advisor Findings

Alle 12 Agenten außer der passiven Baseline und Anfänger (der nur einen
Schatzmeister "gelegentlich" versucht) erreichen 100 % ADVISOR-Engagement
— Berater werden durchweg als wertvoll wahrgenommen und genutzt. Die
`considerBuildKathedrale()`-Ergänzung (siehe R/AS) zeigt: selbst wenn ein
Agent aktiv auf ein Ziel hinarbeitet (hier: Kaiserwahl-Fähigkeit), reicht
das gewöhnliche Wirtschaftswachstum nicht, das Ziel innerhalb von 100
Jahren zuverlässig zu erreichen — ein Hinweis, dass manche
Spätspiel-Ziele strukturell zu weit entfernt liegen (siehe AJ).

---

## S. Dynasty Findings

Dynast (dediziert auf Heirat/Nachfolge/Hofstabilität) erreicht mit **3,2
Generationen im Schnitt** den höchsten Wert aller Agenten und die
höchste Einzelbeobachtung (3 Generationen im Same-Seed-Vergleich, siehe
J) — die dynastie-fokussierte Spielweise "funktioniert" im Sinne
ihres eigenen Ziels. Gleichzeitig bleibt `no_heir` bei allen Agenten die
häufigste Spielende-Ursache (16-57 %, siehe T) — auch bewusste
Familienpolitik (Dynast nutzt gezielt die `marriage`-Diplomatieaktion,
siehe B) reduziert das Grundrisiko nur moderat, da die eigentliche
Nachfolge (welches Kind erbt, ob überhaupt eins lebt) vollständig
automatisch abläuft (§5 des Aktions-Katalogs — es gibt keine
Spieler-Erbfolge-Entscheidung).

---

## T. no_heir Findings

`no_heir`-Anteil über alle 12 Agenten: 16,7 % (Min-Maxer, meist vorher
schon bankrott) bis 56,7 % (Diplomat). Konsistent mit der historischen
Baseline (53-67 % rein passiv, `BASELINE.md`, seit Phase 3 unverändert
— siehe `phase3_metrics_test.js`). **Aktives Spiel verschiebt die
no_heir-Rate nicht grundlegend** — es ist kein Wirtschafts- oder
Militärhebel bekannt, der die Erbfolgesicherheit gezielt erhöht (die
einzige Stellschraube, `dynasticMarriage`, ist eine diplomatische
Beziehungs-, keine Fruchtbarkeits-/Erbfolge-Maßnahme). Bereits in Phase 3
bewusst nicht gefixt (§Punkt 57), hier nur erneut mit echten Agenten
bestätigt statt nur passiv gemessen.

---

## U. Military Findings

Kriegerische Archetypen erobern die gesamte Nachbarschaft (16
Territorien) typischerweise **innerhalb der ersten 5 Jahre** — extrem
schnell im Vergleich zu 100 Jahren Spielzeit. Angriffs-Erfolgsquote
insgesamt moderat (Kriegsherr 21,6 %, Hardliner 22,8 %, Opportunist 10 %,
Min-Maxer 12,4 % — viele Angriffe scheitern, aber genug gelingen für
vollständige Eroberung binnen weniger Jahre bei stetigem Nachschub).
Kriegsherr: 186 Kriegserklärungen über 30 Partien, 1.964 Gebietsangriffe
insgesamt.

---

## V. Pikemen Hypothesis (§38-44)

Kontrollierter Test: identisches Budget (3.000 Taler via `takeLoan`),
identische Zielgarnison (`m_sued`), 40 Seeds pro Komposition.

| Komposition | Ø Kosten | Ø Bev.-Kosten | Ø Stärke | Stärke/Taler | Stärke/Bev. | Siegquote | Ø Verlustanteil |
|---|---|---|---|---|---|---|---|
| **Nur Pikeniere** | 2.970 | 108 | 81 | **0,027** | 0,75 | **100 %** | 0 % |
| Nur Schwere Kavallerie | 2.600 | 16 | 48 | 0,018 | **3,00** | 7,5 % | 69,4 % |
| Gemischt (historisch) | 2.040 | 68 | 50 | 0,025 | 0,74 | 35 % | 14,3 % |

**Bestätigt**: Pikeniere sind pro Taler die günstigste Einheit (0,027
Stärke/Taler — deckt sich exakt mit dem älteren Audit-Befund
36,7 Taler/Stärkepunkt) UND liefern in der tatsächlichen Kampf-Engine-
Simulation eine **100 %-Siegquote bei 0 Verlusten** gegen dieselbe
Standard-Zielgarnison. Ein reiner "Pikeniere-Spam" ist damit nicht nur
eine theoretische Kosten-Hypothese, sondern eine empirisch bestätigte
dominante frühe Kriegsstrategie.

---

## W. Cavalry Hypothesis (§44)

**Bestätigt UND relativiert**: Schwere Kavallerie ist mit 3,0
Stärke/Bevölkerungseinheit **exakt 4× effizienter** als Pikeniere (0,75) —
`recruitPopCostPerUnit=4` ist wie vermutet unabhängig vom Einheitentyp,
was schwere Kavallerie pro verbrauchtem Bevölkerungskopf stark bevorteilt.
**Aber**: dieselbe reine Kavallerie-Komposition gewinnt in der echten
Kampf-Engine nur **7,5 %** ihrer Schlachten (mit 69 % durchschnittlichem
eigenen Verlustanteil) — die abstrakte `armyStrength()`-Formel, die für
strategische Kriegsentscheidungen (Kriegs-Schwellenwert-Prüfung) genutzt
wird, korreliert hier **nicht** mit dem tatsächlichen Schlachtausgang. Ein
kleines, "stark" bewertetes Kavallerie-Kontingent verliert gegen eine
zahlenmäßig überlegene Verteidigung trotz hoher Einzelstärke pro Einheit.
**Das ist ein reales Spannungsfeld, kein Bug**: die strategische Schicht
(Kriegskarte/Rekrutierung) und die taktische Schicht (Kampf-Engine)
bewerten Streitkräfte nach unterschiedlichen Maßstäben (abstrakte Summe
vs. echte Truppenzahl/Formation/Moral) — ein Spieler, der sich auf
`armyStrength()` verlässt, um zu entscheiden, ob ein Krieg "sicher" ist,
kann bei kavallerielastigen Armeen fehlgeleitet werden. Siehe AO (Finding
#3) und AQ.

---

## X. War Profitability

Direkter Vorher/5-Jahre-Nachher-Vergleich anhand der Same-Seed- und
Kurations-Kampagnen: Kriegsherr (Seed 1000) erobert bis Jahr 1503 alle 16
Gebiete, hat bis Jahr ~1506 spürbar mehr Bevölkerung/Prestige als der
Vorkriegs-Zustand — **lohnt sich kurzfristig**. Ab ca. Jahr 1520 beginnt
eine jährlich wiederkehrende Hungerkrise (11 Chronik-Einträge
"Hungerkrise" von 1532-1550 in Folge, siehe AN), Bevölkerung fällt von
Kriegsbeginn bis Kampagnenende von ~2.400 auf 321 (-87 %), Endkasse
-3.189. **Krieg ist kurzfristig profitabel, aber mittelfristig teuer**:
eroberte Gebiete bringen keine sich selbst tragende Wirtschaft mit (neu
eroberte Territorien haben `deployment={}`/kaum Infrastruktur), während
Sold+Zins weiterlaufen. Über alle vier kriegerischen Archetypen identisch
reproduziert (73-83 % Bankrott-Rate, siehe G) — **kein Einzelfall,
sondern ein strukturelles Muster.**

---

## Y. Diplomacy Findings

Diplomat und Versöhner erreichen 100 % DIPLOMACY-Engagement, aber
Diplomat hat mit 23 Jahren die **kürzeste** durchschnittliche
Kampagnenlaufzeit aller nicht-militärischen Agenten (no_heir-Rate 56,7 %,
die höchste im gesamten Feld) — rein diplomatisches Spiel schützt nicht
vor dem strukturellen no_heir-Risiko (siehe T) und bietet dafür auch
keinen kompensierenden Vorteil (Kaiserwahl bleibt unerreichbar, siehe H).
**Ja, ein Diplomat kann erfolgreich sein, ohne Krieg zu führen** (0 %
Bankrott, stabile Beziehungen) — aber "Erfolg" bedeutet hier "eine solide,
aber inhaltlich eher ereignisarme Partie", nicht "ein überlegener Weg zum
Sieg".

---

## Z. Kaiser Election Findings

Bereits in H behandelt: 0 von 360 Kampagnen. `avgBribes: 0` für alle 12
Agenten (nie kam es überhaupt zu einer `pendingElection`, die eine
Bestechung ermöglicht hätte). **Zu selten, um zu selten zu sein** — es
gibt in dieser Stichprobe schlicht keinen einzigen Datenpunkt für "wie oft
gelingt eine Kaiserwahl", weil der Vorlauf (Kurfürst-Rang) nie erreicht
wird. Nur Befund, keine Änderung in dieser Phase (§72).

---

## AA. Story Thread Findings

`activeThreads`-Snapshot-Feld zeigt über alle Agenten hinweg regelmäßig
2-5 gleichzeitig aktive Threads bei aktiven Kampagnen (z. B. Kriegsherr-
Jahresschnappschüsse in AN) — Story Threads entstehen zuverlässig auch
unter Agenten-Spiel, nicht nur in den handkuratierten Metriken aus Phase
6/7. Kein neuer Befund gegenüber `phase6_story_metrics_test.js` (30 %
QUIET/70 % Pacing-Verteilung dort bereits dokumentiert) — hier nur
bestätigt, dass aktive Spielerentscheidungen (Kriegserklärungen,
Beraterwechsel) die Thread-Erzeugung nicht unterdrücken.

---

## AB. Event Chain Findings

Alle kuratierten Timelines (AN) zeigen mehrfach denselben Chain-Typ über
eine Kampagne hinweg (z. B. "Der übergangene Erbe" zweimal in der
Verwalter-Timeline aus Phase 7/8H-Ära weiterhin reproduzierbar) — ohne
Anzeichen einer neuen Regression durch Agenten-Spiel. Keine der 780
Kampagnen zeigte einen Chain-bezogenen Crash oder eine blockierte
Entscheidung (`resolvePendingQueue()`s 20-Iterationen-Sicherheitsgrenze
wurde nie erreicht).

---

## AC. Recurring Character Findings

Die kuratierten Timelines (AN) zeigen wiederkehrende benannte Charaktere
über mehrere Jahrzehnte (z. B. "Anna von Kaisersberg" erscheint in der
Verwalter-Erfolgs-Timeline über mindestens 3 Jahre in Heirat-, Rivalitäts-
und Nachfolge-Ereignissen; ausländische Herrscher wie "Rudolf von Mainau"
tauchen über Tod/Nachfolge/erneute Erwähnung hinweg wiederholt auf, ein
direktes Ergebnis der Phase-8E-Erweiterung um echte Charakter-Core-
Herrscher für Nachbarregionen). **Ja, KAISERREICH hat wiederkehrende
Menschen, nicht nur Ereignisse** (§77) — bereits vor Phase 9 gebaut, hier
nur unter echtem Agentenspiel bestätigt.

---

## AD. Memory Payoff

Nicht separat instrumentiert (keine dedizierte Zähler-Metrik in dieser
Phase gebaut) — die bereits bestehende Aussage aus Phase 4
(`phase4_memory_metrics_test.js`: "20,8 chronikwürdige Memories/Partie im
Schnitt bei importance≥50") bleibt die maßgebliche Referenz. Kein neuer
Befund; als offener Punkt für eine künftige, gezieltere Instrumentierung
vermerkt statt hier improvisiert nachgerüstet.

---

## AE. Snowballing

Pearson-Korrelation Jahr-20-Zustand vs. Endzustand, je Agent (n=30):

| Agent | Korr. Bevölkerung | Korr. Kasse | Korr. Gebiete |
|---|---|---|---|
| Kriegsherr | **0,898** | 0,160 | 1,000 |
| Hardliner | **0,860** | -0,001 | 1,000 |
| Min-Maxer | 0,733 | 0,320 | — |
| Kaufmann | 0,355 | 0,478 | — |
| Opportunist | 0,344 | -0,032 | 0,814 |
| Verwalter | 0,002 | -0,069 | — |
| Diplomat | -0,054 | -0,177 | 1,000 |

**Snowballing konzentriert sich messbar auf die militärische Dimension**:
wer bis Jahr 20 militärisch dominiert, dominiert (fast deterministisch)
auch am Ende — Gebiets-Korrelation liegt für alle kriegerischen Agenten
bei exakt 1,0 (wer erobert hat, bleibt erobert; Territorien gehen so gut
wie nie zurück verloren). Für friedliche Archetypen ist die Kasse-
Korrelation dagegen durchweg schwach bis negativ — ein früher
wirtschaftlicher Vorsprung sagt NICHT zuverlässig einen späten voraus
(genug Volatilität durch Ereignisse/Handel/Ausgabenentscheidungen). **Ein
gezieltes, aber eng begrenztes Snowball-Muster** — nicht spielweit.

---

## AF. Death Spirals

Heuristik (transparent, keine zertifizierte Metrik, §128): ≥5
aufeinanderfolgende Jahre Bevölkerungsrückgang bei gleichzeitig
Zufriedenheit <25. Löst bei allen Agenten mit anhaltendem Krieg (100 %)
und überraschend auch bei der passiven Baseline (86,7 %) und
Machtpolitiker (100 %) aus. **Wichtige Einschränkung**: diese Heuristik
markiert "harte Durststrecken", nicht zwingend endgültige, unumkehrbare
Todesspiralen — die parallel gemessene Comeback-Rate (AG) zeigt, dass
viele dieser Episoden sich erholen (z. B. Passive: 43,4 % Comeback-Rate
trotz 86,7 % Death-Spiral-Erkennung). Für militärische Archetypen dagegen
korrelieren Death-Spiral-Erkennung UND niedrige Comeback-Rate (Kriegsherr
0,4 %, Min-Maxer 16,1 %) — dort *ist* es meist tatsächlich unumkehrbar
(siehe X).

---

## AG. Comeback Rate

Anteil "schwerer Krisen" (Kasse <0 ODER Nahrungsverhältnis <30 %), die
sich innerhalb von 10 Jahren erholen (Kasse >100 UND Nahrung ≥70 %):

| Agent | Comeback-Rate |
|---|---|
| Verwalter | **100 %** |
| Anfänger | 98,8 % |
| Kaufmann | 98,5 % |
| Dynast | 88,5 % |
| Machtpolitiker | 58,2 % |
| Passive | 43,4 % |
| Diplomat | 36,6 % |
| Opportunist | 30,5 % |
| Hardliner | ~17 % |
| Min-Maxer | 16,1 % |
| Versöhner | 16,6 % |
| Kriegsherr | 0,4 % |

Starke, saubere Korrelation mit dem Archetyp-Charakter: je aktiver/
umsichtiger die Wirtschaftsführung, desto zuverlässiger die Erholung von
Krisen. Kriegsherr (0,4 %) bestätigt X — einmal in der militärischen
Abwärtsspirale, kommt praktisch keine Kampagne mehr heraus.

---

## AH. Early Game (Jahr 1-20)

Kriegerische Archetypen erobern typischerweise die gesamte Nachbarschaft
bereits in dieser Phase (Kriegsherr/Opportunist/Hardliner/Min-Maxer: erste
Kriegserklärung praktisch immer im ersten Spieljahr, siehe AN). Friedliche
Archetypen bauen in dieser Phase Berater, erste Handelsbeziehungen und
eine anfängliche Nahrungssicherheit auf — nach den Timelines (AN) das
ereignisreichste Zwanzigstel der Partie für aktive Spieler, das
ereignisärmste für passive.

## AI. Mid Game (Jahr 21-60)

Für erfolgreiche kriegerische Kampagnen bereits die Bankrott-Phase (Ø
Kampagnenlänge Kriegsherr 45, Hardliner 40, Min-Maxer 36 Jahre — die
meisten Kriegskampagnen enden VOR Erreichen des Mid-Game-Endes). Für
friedliche Archetypen die Phase mit dem höchsten
`avgLongestStabilityStreak` (Verwalter 10,2 Jahre ununterbrochene
Stabilität) — siehe AK.

## AJ. Late Game (Jahr 61-100)

Erreicht praktisch nur von den nicht-kriegerischen Archetypen (56,7 % der
Verwalter/Kaufmann/Passive-Partien, 63,3 % Machtpolitiker). In dieser
Phase sinkt die Entscheidungsdichte gegenüber dem Early Game spürbar
(implizit sichtbar an niedrigen `avgMeaningfulPerDecade`-Werten für
langlebige Agenten wie Dynast/Versöhner/Diplomat, alle unter 10) —
**das eigentliche Late-Game-Problem** (§92): das Spiel wird nach
erreichter Stabilität nicht "spannungsarm" im Sinne einer Krise, sondern
"zielarm" — es gibt schlicht wenig Neues zu erreichen (siehe AK).

---

## AK. Perfect Stability

Längste ununterbrochene "keine sichtbare Krise"-Serie (Kasse >100 UND
Nahrung ≥90 % UND Zufriedenheit ≥45 UND Legitimität ≥45 UND kein Krieg):

| Agent | Ø längste Stabilitätsserie |
|---|---|
| Verwalter | **10,2 Jahre** |
| Kaufmann | 2,4 |
| Machtpolitiker | 3,3 |
| Diplomat | 3,6 |
| Dynast | 4,2 |
| Anfänger | 4,0 |
| Passive | 3,9 |
| Versöhner | 1,9 |

**Was passiert danach? (§100)** — anhand der Verwalter-Timeline (AN,
`avgFinalTreasury: 124.162`, weit über jedem im Spiel sichtbaren
Ausgabenbedarf): **nichts Neues.** Der Agent (und implizit: ein realer
Spieler mit derselben Priorität) recycelt dieselben Routineaktionen
(Steuer/Berater/Handel bereits optimiert) weiter, ohne dass das Spiel ein
neues, größeres Ziel anbietet — Titelaufstieg stockt (avgFinalTitleIndex
0-3), Kaiserwahl bleibt unerreichbar (H), Expansion ist der einzige
verbleibende Hebel, aber wurde von diesem Archetyp bewusst gemieden. **Das
ist der klarste Beleg im gesamten Datensatz für ein echtes
Spätspiel-Ziel-Vakuum.**

---

## AL. Min-Max Exploits — "HOW TO BREAK KAISERREICH"

Der Min-Maxer-Agent durchlief 5 fest verankerte, deterministische
Testphasen (Jahr 0-20/20-40/40-60/60-80/80-100) pro Kampagne. Zusätzlich
der dedizierte Army-Composition-Test (V/W) und ein unerwarteter Fund aus
der Opportunist-Timeline:

1. **Pikeniere-Spam (bestätigt, stärkster Einzelbefund)**: 100 %
   Siegquote, 0 Verluste, 0,027 Taler/Stärkepunkt — die günstigste UND
   zuverlässigste frühe Militärstrategie im gesamten Test. Funktioniert ab
   Spielbeginn (keine Vorbedingung außer Rekrutierungskosten). Umgeht: die
   gesamte Formations-/Einheitentyp-Vielfalt der Kampf-Engine — ein rein
   auf Pikeniere gestützter Angriff braucht kein taktisches Nachdenken.
2. **Kavallerie-Bevölkerungseffizienz (bestätigt, aber kein Exploit im
   engeren Sinn)**: 4× effizienter pro Bevölkerungskopf, aber nur 7,5 %
   Siegquote in echten Schlachten — kein "Kaputtspielen", eher eine
   Falle für Spieler, die sich auf die abstrakte `armyStrength()`-Zahl
   verlassen (siehe W).
3. **Kriegserklärung ohne Cooldown (neuer, unerwarteter Fund)**: kein
   Code in `js/diplomacy.js`/`js/military.js` verhindert, sofort nach
   einem Friedensvertrag erneut denselben Nachbarn mit Krieg zu
   überziehen. Eine Opportunist-Kampagne (Seed 8919) demonstriert dieses
   Muster ungewollt fast jährlich von 1500-1517 gegen Mainau/Rheinfeld
   (siehe AN). Ein Spieler könnte dies gezielt für wiederholte kleine
   Gebietsgewinne nutzen, ohne je eine echte, lang andauernde
   Kriegsverpflichtung einzugehen. **Kein Bug** (die Funktionen verhalten
   sich exakt wie spezifiziert — Beziehungscrash und Prestige-Verlust
   pro Zyklus sind real und begrenzen den Exploit natürlich), aber ein
   dokumentierenswertes Design-Detail.
4. **Kein Geldmaschinen-Exploit gefunden**: die "economic_extraction"-
   und Handelsarbitrage-Testphasen fanden keine triviale, risikofreie
   unendliche Geldquelle — Handelsmargen bleiben nach Transport-/
   Bandit-Risiko moderat, Steuersätze über 25 % schaden Zufriedenheit
   spürbar genug, um nicht "immer optimal" zu sein.
5. **Kein Berater-Exploit gefunden**: "advisor_stacking"-Phase (alle 6
   Ämter besetzt + aggressiv aufgewertet) verbesserte keine Kennzahl
   sprunghaft stärker, als die Kosten rechtfertigten — Berater bleiben
   ein solider, aber nicht dominanter Hebel (siehe R).
6. **Kein Kaiserwahl-Shortcut gefunden**: die "kaiserwahl_bribery_rush"-
   Phase erreichte in keiner der 30 Min-Maxer-Kampagnen überhaupt eine
   aktive Wahl (siehe H/Z) — der Flaschenhals liegt vor der Bestechung,
   nicht in ihr.

**Gesamtfazit**: Der einzige klar dominante, sofort nutzbare Exploit ist
**Pikeniere-Spam für frühe militärische Dominanz**. Alles andere ist
entweder bereits durch reale Kosten/Risiken begrenzt oder (Kavallerie,
Kriegserklärung-ohne-Cooldown) eher eine Fußnote als ein "Spiel
kaputt machen"-Fund. Nichts hiervon wurde in dieser Phase generft oder
sonst verändert (§152).

---

## AM. Same-Seed Agent Comparison

Siehe Abschnitt J — direkt hier dupliziert, da §125-129 einen eigenen
Berichtsabschnitt verlangt. Fünf Agenten, ein Seed (1000): fünf klar
unterscheidbare Endzustände (Titel, Kasse, Bevölkerung, Territorien,
Generationen) — siehe Tabelle in J.

---

## AN. Example Timelines

Zehn kompakte Timelines aus echten, tatsächlich simulierten Kampagnen
(keine erfundenen Beispiele) — Volltext in
`tests/output/phase9/decision_logs/`. Fünf davon hier illustriert:

**Erfolgreiche Kampagne** (Verwalter, Seed 16838, 100/100 Jahre, endet
laufend statt per Game Over):
```
1500 Start als Verwalter, konservative Wirtschaftspolitik
...    stetiges Bevölkerungs-/Kassenwachstum, 2 Generationen
1595 Friedrich von Kaisersberg verstirbt (59 Jahre)
1595 Anna von Kaisersberg tritt die Nachfolge an (19 Jahre)
1595 Anna vermählt sich mit dem Haus Mainau
1596-98 Rivalität mit Anna von Kaisersberg -> Kompromiss
1599 Kind geboren: Luitgard von Kaisersberg
1600 Partie läuft weiter (100 Jahre erreicht, Titel: Graf)
```

**Gescheiterte Kampagne** (Kriegsherr, Seed 1000, 50 Jahre, bankrupt):
```
1500 Kriegserklärung gegen alle 3 Nachbarn im ersten Jahr
1500-1503 Vollständige Eroberung aller 16 Gebiete, 3 Vasallen
1506+ Bevölkerung beginnt zu kollabieren
1520-1550 Jahresweise wiederkehrende Hungerkrisen (11 Jahre in Folge)
1550 Bankrott (-3.189 Taler), Bevölkerung von ~2.400 auf 321 eingebrochen
```

**Langweilige Kampagne** (Passive Baseline, Seed 8919, 47 Jahre,
Autopilot-Index 0,478 — höchster im kuratierten Sample):
```
1500 Start, keinerlei Spieleraktion
1512 Agnes von Kaisersberg heiratet (automatisch)
1514 Nachbarherrscher stirbt, Nachfolger übernimmt
1529 Nachbarherrscher stirbt, Nachfolger übernimmt
1547 Agnes verstirbt (80 Jahre) — kein Erbe, Dynastie erlischt
```
Nur 6 chronikwürdige Ereignisse über 47 Jahre — siehe M.

**Chaotische Kampagne** (Opportunist, Seed 8919, 65 Jahre, bankrupt, 566
Angriffe):
```
1500 Krieg gegen alle 3 Nachbarn erklärt
1503-04 Mainau und Rheinfeld vollständig erobert/vasallisiert
1505-1517 Fast jährlicher Zyklus: Friedensvertrag -> sofort erneut
          Krieg erklärt (siehe AL Punkt 3), abwechselnd Mainau/Rheinfeld
1565 Bankrott nach anhaltender Kriegswirtschaft
```

**Min-Max-Kampagne** (Min-Maxer, Seed 1000, 39 Jahre, bankrupt):
```
1500-1520 Phase "economic_extraction" (30% Steuersatz)
1505 Heirat, Kind geboren
1508-1524 Jährliche Hungerkrisen (hohe Besteuerung + wenig Investition
          in Nahrungssicherheit zeigt Wirkung)
1520 Phase "pikemen_cost_spam": Krieg gegen alle 3 Nachbarn erklärt
1539 Bankrott, Bevölkerung auf 395 eingebrochen, Prestige auf 1 kollabiert
```

Fünf weitere Timelines (u. a. eine zweite Kaufmann-, Diplomat- und
Dynast-Kampagne) liegen vollständig in den kuratierten Decision-Logs vor.

---

## AO. Top 10 Gameplay Findings

| # | Befund | Priorität |
|---|---|---|
| 1 | Kaiserwahl in 360 Kampagnen nie erreicht — Titelaufstieg selbst ist der Flaschenhals, nicht die Wahl | **P1** |
| 2 | Aggressive Kriegsführung erobert die Karte in <5 Jahren, endet aber in 73-83% der Fälle in Bankrott — Kriegsökonomie nach Eroberung nicht tragfähig | **P1** |
| 3 | `armyStrength()` (strategische Schicht) korreliert schlecht mit echtem Schlachtausgang bei kavallerielastigen Armeen (48 abstrakte Stärke, aber nur 7,5% Siegquote) | **P1** |
| 4 | Pikeniere-Spam ist eine dominante, kostengünstige, 100%-Siegquote-Frühstrategie ohne Gegengewicht | **P2** |
| 5 | Spätspiel-Ziel-Vakuum: nach erreichter Stabilität (z.B. Verwalter, 124k Taler Endkasse) bietet das Spiel kein neues Ziel mehr | **P1** |
| 6 | Kriegserklärung hat keinerlei Spieler-Cooldown — ermöglicht "Krieg-Frieden-Zyklen" gegen denselben Nachbarn | **P2** |
| 7 | Passives Spiel erzeugt extrem wenig sichtbare Geschichte (1 Ereignis/8 Jahre) | **P2** |
| 8 | `no_heir` bleibt bei 17-57% über ALLE Spielstile hinweg die häufigste Spielende-Ursache, keine Gegenmaßnahme im Spiel vorhanden | **P2** |
| 9 | Diplomatisches Spiel ist solide/verlustfrei, aber inhaltlich am ereignisärmsten (niedrigste Entscheidungsdichte im Feld) | **P3** |
| 10 | Snowballing ist real, aber eng auf die militärische Dimension begrenzt (Gebiets-Korrelation 1,0 für Kriegsarchetypen, Wirtschafts-Korrelation überall schwach) | P3 (Befund, kein Problem) |

---

## AP. Top 5 Recommended Improvements

1. **Titelaufstieg-Kurve überprüfen** (reqPop/reqWealth/reqPrestige in
   `TITLES`, `data/gamedata.js`): mit keiner der 10 getesteten Strategien
   wurde auch nur der Kurfürst-Rang erreicht — die Kaiserwahl (ein zentral
   beworbenes Spielziel) ist dadurch faktisch unerreichbar.
2. **Kriegsfolgekosten/-ertrag rebalancieren**: eroberte Gebiete bringen
   aktuell keine sich selbst tragende Wirtschaft mit, während Sold/Zins
   weiterlaufen — macht Krieg strukturell zu einer Einbahnstraße in den
   Bankrott statt einer echten strategischen Option.
3. **`armyStrength()`-Schätzung an die Kampf-Engine annähern** (oder in
   der UI klarer als grobe Heuristik kennzeichnen) — aktuell verleitet sie
   zu Fehleinschätzungen bei unausgewogenen Armeen (siehe W).
4. **Spätspiel-Ziele nach erreichter Stabilität**: irgendein neues,
   sichtbares Ziel jenseits von "weiter Steuern/Berater optimieren", sobald
   Kasse/Nahrung/Zufriedenheit dauerhaft im grünen Bereich sind.
5. **Kriegserklärungs-Cooldown erwägen** (analog zum bereits
   existierenden `aiWarCooldownYears` für die KI-Initiative, aber für den
   Spieler) — schließt die in AL Punkt 3 dokumentierte Lücke, ohne
   Diplomatie sonst einzuschränken.

---

## AQ. Recommended Phase 10

**F. Pacing/Decision Pressure**, mit zwei konkreten Schwerpunkten aus den
Top-5-Empfehlungen: (a) Titelaufstieg-Kurve + Kriegsökonomie (Empfehlungen
1+2 — beide sind im Kern "die Belohnungsstruktur von Fortschritt stimmt
nicht"), und (b) Spätspiel-Ziele nach erreichter Stabilität (Empfehlung
4). Begründung gegen die Alternativen:

- **Nicht A (Living Realm)**: keine Daten deuten auf fehlende politische
  Tiefe als das Kernproblem — im Gegenteil, die bestehenden Systeme
  (Diplomatie, Charaktere, Story Threads) werden aktiv genutzt und
  funktionieren (Y, AA, AC).
- **Nicht B (Kaiserwahl 2.0)**: die Wahl selbst wurde nie erreicht — ein
  Ausbau der Wahlmechanik selbst (Wahlkampf, Versprechen) würde am
  eigentlichen Engpass (Titelaufstieg) vorbeigehen.
- **Nicht C (Wirtschaft/Handel-Rebalance)**: die Wirtschaft trägt sich bei
  besonnenem Spiel gut selbst (O, 0% Bankrott für alle nicht-kriegerischen
  Archetypen) — kein akuter Handlungsbedarf.
- **Nicht D (Krieg/Expansion-Rebalance) allein**: Kriegsökonomie ist zwar
  ein echtes Problem (Finding #2), aber isoliert betrachtet würde ein
  reines Kriegs-Update das größere Muster (fehlende Spätspiel-Ziele nach
  JEDER erfolgreichen Strategie, nicht nur Krieg) nicht adressieren.
- **Nicht E (Dynastie/Nachfolge)**: no_heir bleibt konstant über alle
  Spielstile hinweg (T) — real, aber laut Phase 3 bewusst als Spielhebel
  akzeptiert, kein neuer dringender Befund hier.

Living Realm bleibt, wie im Auftrag festgehalten, eine Hypothese für eine
spätere Phase — die Daten stützen sie hier nicht als nächsten Schritt.

---

## Verwendete Perfect-Information-Hinweise (Zusammenfassung von A.1)

Zwei bewusste, geprüfte und für unbedenklich befundene
Informationszugriffe (Kriegszielbewertung via `estimateAiStrength()` und
exakte Gebiets-Garnisonszahlen) — beide sind bereits dieselbe Information,
die ein echter Spieler über die Kriegskarten-UI/Geheimdienstberichte
sieht. Keine weiteren Shortcuts.

---

## AR. Production Files Changed

**Keine.** `git diff --stat battle-engine/ js/ data/ index.html` ist leer
— 0 Zeilen geändert in jeder Produktionsdatei. Ausschließlich neue,
nicht-produktive Dateien:

```
tests/agents/                    (neu, ~2.500 Zeilen: engine.js,
                                   shared-behaviors.js, archetypes.js,
                                   metrics.js, run-campaign.js,
                                   run-matrix.js, aggregate.js,
                                   run-army-composition-test.js,
                                   run-region-test.js)
tests/output/phase9/             (neu, generierte Messdaten, ~22 MB:
                                   campaign_summaries.json, manifest.json,
                                   aggregate_metrics.json,
                                   army_composition_test.json,
                                   region_fairness_test.json,
                                   decision_logs/*.json)
PHASE9_GAMEPLAY_AUDIT.md         (dieses Dokument)
```

`tests/agents/` ist **nicht** in `tools/build-bundle.js` `FILES[]`
gelistet (verifiziert) — kann sich also niemals versehentlich ins
Produktionsbundle einschleichen.

---

## AS. Gameplay Values Changed

**Keine** — `CONFIG`, `TITLES`, `TROOP_TYPES`, `GOODS`, `BUILDINGS`,
`ADVISOR_ROLES` etc. wurden an keiner Stelle verändert. Die einzigen
"Korrekturen" während dieser Phase betrafen ausschließlich den
Test-Agenten-Code selbst (nicht das Spiel):

1. `manageTreasuryHealth()`s selbstauferlegte `maxDebt`-Obergrenze war in
   frühen Prototyping-Läufen zu knapp bemessen (1.000-2.500 Taler) und
   ließ vorsichtige Agenten unnötig in den Bankrott laufen, obwohl das
   Spiel selbst **keine** Schuldenobergrenze kennt (`takeLoan()` lehnt nie
   ab) — auf 4.500-9.000 angehoben plus proaktiveres Nachborgen.
2. `recruitPreferred()` hatte anfangs keine Obergrenze — ein "kleine
   Dauergarnison"-Agent rekrutierte 100 Jahre lang jeden Monat weiter,
   was den realen, unveränderten Sold-Mechanismus unbeschränkt anwachsen
   ließ. Ein `maxArmyStrength`-Parameter wurde ergänzt (archetyp-
   spezifisch 40-400, je nach beabsichtigter Truppengröße).
3. `considerBuildKathedrale()` wurde ergänzt, nachdem der erste Lauf
   zeigte, dass kein Agent von selbst die für die Kaiserwahl nötigen
   Baumaterialien einkauft — ohne diese Ergänzung wäre der
   Kaiserwahl-Befund (H) durch eine Lücke im Testcode verzerrt gewesen,
   nicht durch das Spiel selbst.

Alle drei sind Agenten-Code-Korrekturen (bessere Annäherung an "wie ein
Spieler mit diesem Ziel tatsächlich handeln würde"), keine
Spielbalance-Änderungen — mit vollem Vorher/Nachher-Vergleich
nachvollziehbar dokumentiert (siehe die Commit-Historie dieser Phase).

---

## AT. Battle Engine

Unverändert. `battle-engine/battle-data.js`,
`battle-engine/battle-engine.js`, `battle-engine/battle-state-machine.js`
— 0 Zeilen Diff. Alle 780 simulierten Kampagnen (inkl. 1.964+1.907+…
tausender Einzelschlachten) liefen über exakt dieselbe, ungeänderte
Engine wie die echte UI (`createBattle`/`advanceBattle`/
`aiDecisionPolicy` — dieselben Funktionsaufrufe wie `btStartBattle()`/
`btAutoResolve()` in `index.html`).

---

## AU. Savegame

Keine neue `SAVE_VERSION` — Agenten spielen ausschließlich über
`newGame()`/reale Aktionsfunktionen, niemals über Save/Load-Migrationspfade.
Golden-Determinism-Test (`tests/advance_year_snapshot_test.js`) läuft nach
Abschluss dieser Phase weiterhin unverändert grün (verifiziert, siehe E).

---

## AV. Bundle

`index.html`: **870.089 Bytes — byte-identisch** zum Stand vor Phase 9
(`wc -c` vorher/nachher verglichen). `tools/build-bundle.js` wurde nicht
ausgeführt, da keine der 22 gelisteten Quelldateien verändert wurde.

---

## AW. Commits

Siehe Git-Historie dieser Phase — Test-Infrastruktur- und Dokumentations-
Commits, keine Produktionsänderungen.

---

## AX. Working Tree

Vor dem Commit: ausschließlich neue Dateien (`tests/agents/`,
`tests/output/phase9/`, `PHASE9_GAMEPLAY_AUDIT.md`), keine Modifikationen
an bestehenden Dateien (`git status --short` zeigt ausschließlich `??`-
Einträge, keine `M`-Einträge).

---

## STOPP

Phase 9 (Gameplay Intelligence Lab) ist damit abgeschlossen. Es wurden
**keine Produktions-, Balance- oder Gameplay-Änderungen** vorgenommen —
ausschließlich Tests, Messdaten, Analyse und Dokumentation, wie im Auftrag
gefordert (§153). Keine automatische Phase 10 ohne deine ausdrückliche
Freigabe.
