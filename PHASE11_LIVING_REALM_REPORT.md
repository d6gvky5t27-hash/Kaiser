# PHASE 11 — LIVING REALM: STÄNDE, INTERESSENGRUPPEN, MACHTBLÖCKE & INNENPOLITIK

Abschlussbericht. Sprache: Deutsch (Berichtstext), Code/Bezeichner/Zitate im Original. Struktur folgt der etablierten Konvention aus PHASE9_GAMEPLAY_AUDIT.md/PHASE10_BALANCE_COMPARISON.md (buchstabengegliederte Abschnitte).

## A. Zusammenfassung

Phase 11 fügt ein **Landstände-System** hinzu: vier Stände (Adel, Geistlichkeit, Bürgertum, Bauernschaft) mit berechnetem Einfluss, aus dem bestehenden World-State abgeleiteten Interessen, deterministisch aus dem Character Core gewählten Wortführern und sechs konkreten Eventketten, die Forderungen und Privilegien als reale, konsequenzreiche Spielentscheidungen erfahrbar machen. Das System ist **additiv**: keine bestehende Formel (Bevölkerung, Zufriedenheit, Militär, Kriegsökonomie, Vasallentribut) wurde verändert; POP_GROUPS bleibt die einzige Bevölkerungsquelle, Stände sind eine politische Interpretation darüber.

Kernzahlen aus der 360-Kampagnen-Matrix + 240-Kampagnen-Holdout-Matrix (Details in Abschnitt AF-AK):
- **0 Abstürze** über 600 simulierte 100-Jahre-Kampagnen.
- **80.2% / 81.3%** aller Stände-Ketten-Auflösungen sind "Cross-System Decisions" (berühren mehr als nur die Zufriedenheit des fordernden Standes) — die im Auftrag als wichtigste Erfolgsmetrik benannte Kennzahl.
- **94.4% / 95.0%** aller Kampagnen hatten zu irgendeinem Zeitpunkt mindestens einen echten Wortführer.
- Militär-/Kriegsverhalten (Kriegsepisoden, Angriffssiegrate) ist zwischen Phase 10 und Phase 11 **identisch** pro Archetyp — das Militärsystem, die Kriegsökonomie und der Vasallentribut sind unangetastet (bestätigt per Diff und per weiterhin bestehendem tests/phase10_balance_test.js).
- Eine einzige, klar erklärbare Verschiebung: die Kaiser-Rate des Verwalter-Archetyps steigt (~+16 Prozentpunkte in beiden Matrizen) — eine reale, dokumentierte Folge davon, dass Stände-Privilegien dem ohnehin kaisertreu spielenden Verwalter einen zusätzlichen Prestige-/Stabilitätshebel geben, kein Bruch eines Phase-10-geschützten Systems.

STOPP am Ende dieses Berichts — keine weitere Phase ohne erneute ausdrückliche Freigabe.

## B-D. Architektur & Designentscheidungen

**B. Zustandsform.** `state.estates = { adel, geistlichkeit, buergertum, bauernschaft }`, je `{ id, leaderId, lastDemandYear, privileges }`. Bewusst minimal: Einfluss, Zufriedenheit und Interessen werden **on demand** berechnet (`computeEstateInfluence`, `computeEstateSatisfaction`, `discoverEstateInterests`), nicht laufend fortgeschrieben — dasselbe Muster wie `computeDramaTensionBreakdown()` und `computeThreadImportanceBreakdown()`. Nur was über Jahre stabil bleiben muss (Wortführer, Cooldown, das sparsame `privileges`-Array), ist echter State.

**C. Keine zweite Bevölkerungsquelle.** `ESTATE_DEFINITIONS` (data/gamedata.js) bildet jeden Stand auf eine Teilmenge der zehn bestehenden `POP_GROUPS` ab (Adel→`adel`; Geistlichkeit→`geistliche`; Bürgertum→`buerger`+`haendler`+`handwerker`; Bauernschaft→`bauern`+`landarbeiter`+`tageloehner`+`arme`). `soldaten` bleibt bewusst unzugeordnet (Militär hat bereits ein eigenes System). Zufriedenheit eines Standes ist der bevölkerungsgewichtete Schnitt seiner POP_GROUPS — reine Aggregation, keine zweite Formel.

**D. Kein zweites Eventsystem.** Die sechs Forderungsketten sind gewöhnliche `CHAIN_TEMPLATES`-Einträge (js/event-chains.js), die dasselbe `queueChainDecision()` → `state.pendingEvent` → Phase-8F-Eventmodal nutzen wie die zehn bestehenden Phase-5-Ketten. `js/estates.js` liefert nur die Berechnungsgrundlage (`checkEstateDemandEligibility`, `discoverEstateInterests`), die diese Ketten abfragen.

## E-H. Integration mit bestehenden Systemen

**E. Population/Zufriedenheit** (js/population-dynasty.js) — s. C. **F. Character Core** (js/characters.js) — Wortführer werden ausschließlich aus `state.characters` gewählt (`selectEstateLeader()`), nie erfunden: Geistlichkeit/Bürgertum sind an das jeweils passende Hofamt gebunden (`ADVISOR_ROLES.geistlicher`/`.handelsberater`), Adel an Familie/Ehepartner/Ansprüche des Herrschers, Bauernschaft hat **bewusst keinen Kandidatenpool** — kein erfundener NPC, historisch korrekt. Score: Skill + Beziehung + Claim + bereits bekleidetes Amt (`scoreEstateLeaderCandidate()`), kein RNG. Ein amtierender Wortführer bleibt stabil im Amt, bis er stirbt oder (bei Geistlichkeit/Bürgertum) sein Hofamt verliert. **G. World Memory** (js/memory.js) — drei neue, bewusst von den bestehenden `DEMAND_ACCEPTED`/`DEMAND_REFUSED` getrennte Typen (`ESTATE_DEMAND_GRANTED`/`_REFUSED`/`ESTATE_PRIVILEGE_GRANTED`), damit Stände-Metriken sauber filterbar bleiben. **H. Religion** (js/politics.js) — Geistlichkeit-Einfluss koppelt an das bestehende `state.religiousInfluence`/`updateReligion()`, keine zweite Kirchen-Metrik; `kirche_herrscher` ist bewusst von der bestehenden `church_conflict`-Kette abgegrenzt (erfordert einen amtierenden Geistlicher-Berater als persönliches Gesicht, während `church_conflict` weiterhin die anonyme, beraterlose Variante bleibt).

## I-N. Die sechs Landstände-Eventketten

Alle sechs folgen dem bestehenden Muster (checkEligibility/advance, queueChainDecision, resolveEventChain/failEventChain) und wirken ausschließlich über bereits vorhandene Stellschrauben (Taler, Steuersatz, Zufriedenheit, Prestige, Legitimität, religiousInfluence, Beziehung, das sparsame `privileges`-Array).

- **I. adel_hofamt** ("Adel fordert ein Hofamt") — ausgelöst bei Steuerlast- oder Vertretungs-Unzufriedenheit des Adels. Optionen: dauerhaftes Mitspracherecht / großzügige Geste / Zurückweisung.
- **J. adel_krieg** ("Der Adel und der Krieg") — ausgelöst, wenn Krieg geführt wird, ohne dass Ritter/schwere Kavallerie im Dienst stehen (echte, bestehende `minAdelSatisfaction`-Abhängigkeit aus TROOP_TYPES). Optionen: Lehnsehre bestätigen / Entschädigung / Ignorieren.
- **K. staedte_handel** ("Städte und Handel") — ausgelöst bei Zoll-Unzufriedenheit oder fehlendem Handelsberater. Optionen: Handelsfreiheit / Zollsenkung / Abweisung.
- **L. bauern_nahrung** ("Die Bauern und die Nahrung") — **ohne Wortführer**, `actorIds: []`, da die Bauernschaft strukturell keinen Kandidatenpool hat. Ausgelöst bei Kornmangel oder drückenden Abgaben. Optionen: Abgabenerleichterung (Privileg) / Getreideimport / Ignorieren.
- **M. kirche_herrscher** ("Die Kirche und der Herrscher") — erfordert einen amtierenden Geistlicher-Berater als Wortführer (Abgrenzung zu `church_conflict`, s. H). Optionen: Steuerbefreiung / persönliche Frömmigkeit / Abweisung.
- **N. staende_gegeneinander** ("Die Stände stehen gegeneinander") — die **Cross-System-Flaggschiffkette**: feuert nur, wenn Adel UND ein zweiter, unabhängig unzufriedener Stand (Bürgertum oder Bauernschaft) gleichzeitig forderungsfähig sind. Jede Option begünstigt zwingend eine Seite auf Kosten der anderen. **Design-Fund während der Umsetzung:** die ursprüngliche Optionsreihenfolge (Adel bevorzugen / anderen bevorzugen / Ausgleich) widersprach der im Projekt etablierten Konvention "Option 0 = großzügigst, letzte Option = härtest" (es gibt in einem echten Nullsummenkonflikt keine natürliche "härteste" Seite) — korrigiert: der kostspielige, beiden gegenüber großzügige Ausgleich steht jetzt an Position 0.

Alle sechs sind in `CHAIN_PRIORITY_ORDER` und `CHAIN_TEMPLATES` registriert; Priorisierung unter bereits eligiblen Ketten übernimmt weiterhin ausschließlich der Drama Director.

## O-R. UI

**O. LANDSTÄNDE-Tab** (10. Sidenav-Tab, `#tabStaende`/`#staendePage`) — vier Ständekarten (wiederverwendet: `.popGroupBar`/`.diploPowerRow`-Bausteine, keine neue Balken-Komponente) mit Klick-Detailpanel (Einfluss-Aufschlüsselung, Wortführer-Link, Interessen, Privilegien). **P. Charakterdetail-Integration** — neues `estateRole`-Feld in `getCharacterDetailViewModel()`, gerendert als grammatikalisch korrekte "Wortführer des/der &lt;Stand&gt;"-Zeile (maskulin/neutrum "des Adels"/"des Bürgertums" vs. feminin "der Geistlichkeit"/"der Bauernschaft"). **Q. Eventmodal-Integration** — neue `STÄNDE`-Kategorie (`EVENT_CATEGORY_INFO`/`CHAIN_EVENT_CATEGORY`), wiederverwendet wird das bestehende "seal"-Motiv (kein neues Icon gezeichnet). **R. ESTATES DEBUG-Panel** — neue Sektion im bestehenden Debug-Panel, folgt exakt dem etablierten `doShowXDebug()`-in-ein-`<pre>`-Muster (Drama Director/Event Chains/Story Threads); zeigt für jeden Stand Zufriedenheit, volle Einfluss-Aufschlüsselung, Wortführer, Interessen, Privilegien, letzte Forderung, aktive Kette, Forderungsfähigkeits-Checks.

**Bugfix, gefunden bei der Playwright-Verifikation:** `getStoryContextViewModel()` zeigte für jede Kette ohne Story Thread den literalen Text "undefined" (`chain.name` existiert nicht — nur `CHAIN_TEMPLATES[templateId].name`). Latent seit Phase 5, weil jede der zehn ursprünglichen Ketten immer einen Thread über `CHAIN_THREAD_TYPE` bekam; die neuen Stände-Ketten (noch ohne Thread-Typ) waren die ersten, die diesen Pfad tatsächlich durchliefen. Behoben, mit Regressionstest abgesichert.

## S-U. Agenten-Testharness

**S. AGENT_POLICY_VERSION → "phase11-v1"**, dokumentiert: jeder Archetyp löste Stände-Entscheidungen schon vor jeder Anpassung sicher über den bestehenden generischen `eventPrefs(ctx)`-Fallback auf. **T. `agent.estateEventPrefs(ctx)`** — optionaler, nur für Stände-Entscheidungen konsultierter Override, umgesetzt für die acht im Auftrag genannten Archetypen: Verwalter (großzügig, kein Favorisieren im Ständekonflikt), Kaufmann (stark für Bürgertum, sonst kostenscheu), Kriegsherr (stark für Adel — Heeresabhängigkeit von dessen Kavallerie —, sonst hart), Diplomat (großzügig, vermittelt statt Partei zu ergreifen), Dynast (moderat großzügig, vermeidet dauerhafte Feindschaft), Hardliner (weist alles ab, außer Rückhalt für den Adel im Ständekonflikt), Versöhner (maximal großzügig, nie einseitig), Min-Maxer (an die bestehende Ausgabephasen-Logik gekoppelt, keine sechste Exploit-Hypothese). **U. Verifikation** — 120-Kampagnen-Stichprobe: 108 Kampagnen mit stände-policy-getriebenen Entscheidungen und den erwarteten Reason-Strings; Harness-Determinismus (identischer Seed+Agent → byte-identisches Decision-Log) bestätigt.

## V-Y. Vollständige Kampagnen-Matrix

**V.** 360-Kampagnen-Hauptmatrix (30 Seeds × 12 Agenten × 100 Jahre, seedBase=1000 — dieselben Seeds wie tests/output/phase10/) + **W.** 240-Kampagnen-Holdout-Matrix (20 Seeds, seedBase=500000 — exakt Phase 10s eigene Holdout-Seeds für einen echten Vergleich). **X.** 0/600 Abstürze. **Y.** Laufzeit ~52s (Hauptmatrix) / ~36s (Holdout), ~145ms/Kampagne — unverändert performant.

## Z-AE. Nicht-Regressions-Validierung gegen Phase 10

| Prüfpunkt | Befund |
|---|---|
| **Z. Kriegsepisoden/Angriffssiegrate** | Pro Archetyp identisch zwischen Phase 10 und Phase 11 (Haupt- wie Holdout-Matrix) — Kriegsverhalten unangetastet. |
| **AA. TROOP_TYPES/Vasallentribut** | Per `git diff` seit dem letzten Phase-10-Commit bestätigt unverändert; `tests/phase10_balance_test.js` (Titelleiter-Monotonie, Pikeniere≥Kavallerie-Ordnung, Vasallentribut) besteht weiterhin vollständig. |
| **AB. Battle Engine** | `battle-engine/*.js` — 0 Zeilen Diff seit Phase 10. |
| **AC. Kaiser-Rate / Titelfortschritt** | 11/12 Archetypen stabil (±0.15 im Titel-Index, 0 Kaiser-Rate-Änderung). **Verwalter**: +16.6pp (Hauptmatrix 46.7%→63.3%) / +15pp (Holdout 70%→85%), Titel-Index +0.4/+0.4 — konsistent in beiden unabhängigen Seed-Sets, also ein realer, kein Rausch-Effekt. Erklärung: Verwalters `estateEventPrefs` ist bewusst großzügiger (-0.8) als sein allgemeines `eventPrefs` (-0.6) — gewährte Privilegien liefern zusätzliches Prestige/Legitimität/Steuererleichterung, die exakt in Verwalters ohnehin kaiserorientiertes Verhalten (Kathedrale+Palast+Wahl) einzahlen. Kein Bruch eines Phase-10-Werts, sondern eine legitime Wechselwirkung eines neuen, in Phase 11 ausdrücklich autorisierten Mechanismus. |
| **AD. Bankrott/Todesspirale** | Einzelne Verschiebungen im Bereich weniger Kampagnen (z.B. Kaufmann 0/20→1/20 Holdout, Dynast 1/30→2/30 Hauptmatrix) — plausibel als RNG-Neuverteilung durch die zusätzlichen `rnd()`-Aufrufe neuer Ketten (derselbe Effekt, der bereits die Golden-Fixture-Neuerstellung nötig machte, s. AW), nicht als neuer Bankrott-Mechanismus (kein Ketten-Effekt bewegt mehr als ±150–500 Taler). Opportunist/Min-Maxer bleiben die mit Abstand bankrottreichsten Archetypen wie schon in Phase 10 (per Design: chaotische bzw. Exploit-testende Policy). |
| **AE. Gesamturteil** | Keine Regression der Phase-10-geschützten Systeme (Battle Engine, Militärbalance, Kriegsökonomie, Vasallentribut). Eine dokumentierte, erklärte, auf einen einzelnen Archetyp begrenzte Verschiebung durch legitimen neuen Content. |

## AF-AK. Stände-spezifische Metriken

Berechnet über `tests/agents/run-estate-metrics.js` (reale World-Memory-Scans, keine Schätzung), robust über beide unabhängigen Seed-Sets:

**AF. Cross-System Decisions** (die im Auftrag benannte Haupterfolgsmetrik) — 80.2% (Hauptmatrix, 1539/1919) bzw. 81.3% (Holdout, 1080/1329) aller aufgelösten Stände-Ketten berührten mehr als nur die Zufriedenheit des fordernden Standes (Taler, Steuersatz, Prestige, Legitimität, religiousInfluence, ein zweiter Stand oder ein dauerhaftes Privileg). Klassifikation dokumentiert im Skript-Header (jede der sechs Ketten einzeln gelesen), keine Blackbox-Schätzung.

**AG. Forderungshäufigkeit/-ausgang je Stand** (Hauptmatrix / Holdout):

| Stand | Gewährt | Abgelehnt | Privileg |
|---|---|---|---|
| Adel | 329 / 264 | 106 / 62 | 39 / 27 |
| Geistlichkeit | 41 / 31 | **0 / 0** | 102 / 77 |
| Bürgertum | 63 / 22 | **337 / 210** | 73 / 51 |
| Bauernschaft | 288 / 189 | 142 / 100 | **578 / 395** |

**AH. Ständekonflikte** — 149/360 (41.4%) bzw. 108/240 (45%) Kampagnen erlebten mindestens einen `staende_gegeneinander`-Konflikt; 316/242 Konflikte insgesamt.

**AI. Wortführer-Abdeckung** — 94.4%/95.0% der Kampagnen hatten je mindestens einen Stand mit echtem Wortführer; im Schnitt 1.16/1.18 der vier Stände gleichzeitig besetzt (erwartungsgemäß niedrig: Bauernschaft nie, Geistlichkeit/Bürgertum nur bei entsprechender Beraterpriorität des Archetyps).

**AJ. Memory-Payoff** — im Schnitt 5.83/5.95 Stände-Memories pro Kampagne, davon **100%** chronikwürdig (die gewählten Importance-Werte 50/50/60 liegen bereits über der Chronik-Schwelle von 45 — eine bewusste Designentscheidung, kein Zufallsbefund).

**AK. Narrative Vielfalt** — im Schnitt 4.49/4.83 unterschiedliche Ketten-Templates pro Kampagne begegnet (Phase-10-Obergrenze war 10 mögliche, Phase 11 hat strukturell 16 mögliche). Story-Thread-Typenvielfalt (js/story-threads.js) bleibt unverändert, da die sechs neuen Ketten bewusst noch keinen `CHAIN_THREAD_TYPE`-Eintrag haben (s. AQ) — die neue Vielfaltsachse läuft über Chronik-Kategorie STÄNDE und Decision-Log-Einträge, nicht über Story Threads.

## AL-AP. Fünf reale politische Storylines

Alle aus echten, unbearbeiteten Simulationsläufen (Hauptmatrix-Seeds, reproduzierbar über `agentId`+`seed`).

**AL. Der Kaufmannsfürst gegen den Adel** (kaufmann, seed=222732, Herrscher Heinrich) — sechsmal zwischen 1503 und 1585 entscheidet sich derselbe Herrscher im `staende_gegeneinander`-Konflikt konsequent gegen den Adel und für das Bürgertum (`favor_other`), gegen vier verschiedene Adelsvertreter (Bernhard von Sayn, zweimal Adelheid von Moers, Elisabeth von der Mark) — eine über 82 Jahre durchgehaltene Standespolitik, nicht ein Einzelfall.

**AM. Der Hartherzige und der Untergang** (kriegsherr, seed=127704, Herrscherin Anna) — viermal werden Handelsforderungen der Städte abgewiesen ("DISMISSED"), dreimal Hungerklagen der Bauern ignoriert ("IGNORED"), während derselbe Herrscher dreimal den Adel im Ständekonflikt bevorzugt (Wortführer Rudolf). Die Kampagne endet 1550 — nach nur 48 Jahren — mit `gameOver: "defeat"` (Bevölkerungskollaps). Eine direkte, emergente Illustration der im Archetyp angelegten Vernachlässigung.

**AN. Die vermittelnde Diplomatin** (diplomat, seed=16838, Herrscherin Mathilde) — dreimal (1504, 1541, 1581) erscheint Wortführerin Beatrix im Ständekonflikt, alle drei Male mit dem Ergebnis "COMPROMISE" — nie einmal ergreift diese Herrscherin über die volle 100-jährige Laufzeit Partei zwischen den Ständen, exakt die entworfene diplomatische Haltung, hier als beobachtbares Muster statt nur als Parameter.

**AO. Die geistliche Gunst über Generationen** (diplomat, seed=8919, Herrscherin Mathilde) — Berater Sigismund von Jülich sichert der Kirche zweimal (1512, 1527) eine Steuerbefreiung, sein Nachfolger im Amt, Rudolf von Waldeck, führt die Reihe fort (1542, 1561) — eine über zwei Amtsträger hinweg durchgehende kirchenfreundliche Hofpolitik, parallel zu sieben aufeinanderfolgenden, jedes Mal mit "PRIVILEGE_GRANTED" beantworteten Bauernnot-Krisen. Die Dynastie erlischt dennoch 1578 an `no_heir` — guten Regierens zum Trotz durch das Schicksal beendet, nicht durch Unruhe.

**AP. Die stumme Mehrheit** (strukturell, aus AG) — die Bauernschaft hat in keiner der 600 Kampagnen je einen Wortführer, ist aber mit 1008/676 Forderungs-Memories die mit Abstand politisch aktivste Gruppe im gesamten System — noch vor dem privilegierten Adel. Ebenso auffällig: die Geistlichkeit wurde in keiner einzigen der 600 Kampagnen abgewiesen — nicht weil sie stets nachgibt, sondern weil `kirche_herrscher` strukturell nur Herrscher erreicht, die bereits in einen Geistlicher-Berater investiert haben; harte Archetypen wie Kriegsherr/Hardliner hören die Bitte der Kirche nie, weil sie sie nie ernennen. Beide Befunde sind emergente Eigenschaften des Systemdesigns, keine Einzelkampagnen.

## AQ. Bekannte Grenzen & offene Punkte (ehrlich, nicht versteckt)

1. **Bauernschaft bleibt strukturell führerlos.** Kein Kandidatenpool im Character Core — historisch korrekt, aber bedeutet auch: kein Charakter-Core-Gesicht für die zahlenmäßig größte, politisch aktivste Gruppe.
2. **Keine Story-Thread-Anbindung.** `CHAIN_THREAD_TYPE` hat bewusst keinen Eintrag für die sechs neuen Ketten (Scope-Entscheidung dieser Phase) — Stände-Geschichten erscheinen in der Chronik (Kategorie STÄNDE) und im Drama-Director-Tension-Wert, aber nicht als eigener Story-Thread mit Tension/Momentum/Stage-Maschine. Ein potenzieller `INTERNAL_POLITICAL_CONFLICT`-Thread-Typ (im Auftrag als Option genannt) wurde NICHT gebaut — die bestehenden Mechanismen (Chronik + Drama-Tension-Komponente) erwiesen sich als ausreichend, ohne einen achten Thread-Typ einzuführen.
3. **Mobile Breitenüberlauf** — bei 400px Breite zeigt `document.documentElement` einen horizontalen Overflow; per Playwright-Vergleich bestätigt, dass dies eine **bereits vor Phase 11 bestehende, seitenübergreifende** Bedingung ist (`#frame`/`#menubar`), nicht durch die LANDSTÄNDE-Seite verursacht oder verschlimmert (deren eigener Overflow-Wert entspricht exakt der Baseline der einfachsten Bestandsseiten).
4. **Cross-System-Klassifikation ist eine dokumentierte Lesart**, kein Laufzeit-Effekt-Log — abgeleitet aus dem tatsächlichen Code jeder der sechs Ketten (s. AF), nicht instrumentiert. Transparent im Skript dokumentiert, nicht als "gemessene" Größe im strengeren Sinn zu verstehen.
5. **Cross-System-Entscheidungs-Gewichtung bleibt gleichverteilt** über die Archetypen hinweg nicht separat ausgewertet — der 80%-Wert ist ein Systemdurchschnitt, keine Per-Archetyp-Aufschlüsselung (in `estate_metrics.json`s `agentAggregates` vorhanden, aber im Bericht nicht einzeln tabelliert).

## AR. Geänderte Produktionsdateien

`data/gamedata.js` (+55 Zeilen: CONFIG.estates, ESTATE_DEFINITIONS, 3 MEMORY_TYPES), `js/estates.js` (neu, 332 Zeilen), `js/event-chains.js` (+439 Zeilen: 6 Ketten + Registrierung), `js/core.js` (+20: initEstates-Aufruf, Migration v7→v8), `js/advance-year.js` (+4: updateEstates()-Aufruf), `js/drama-director.js` (+7: Tension-Komponente), `js/chronicle.js` (+5: STÄNDE-Kategorie), `js/ui-viewmodels.js` (+89: Viewmodels, EVENT_CATEGORY_INFO/CHAIN_EVENT_CATEGORY, storyContext-Bugfix), `index.html` (LANDSTÄNDE-Tab/-Seite, Charakterdetail-Zeile, ESTATES-DEBUG-Panel — Markup+zweiter Script-Block, nicht Teil des Bundle-Builds), `tools/build-bundle.js` (+1: estates.js in FILES).

## AS. CONFIG-Änderungen

`CONFIG.estates.influenceWeights` (base je Stand, populationShareFactor, wealthShareFactor, leaderBonusMax, militaryDependencyBonus, religiousInfluenceFactor, recentActivityBonus), `CONFIG.estates.demand` (cooldownYears, minInfluenceToDemand, maxSatisfactionToDemand), `CONFIG.drama.tensionWeights.estateUnrestPerEstate/-Cap/-Threshold`. Alle zentral, keine verstreuten Magic Numbers.

## AT. Tests

Neu: `tests/estates_test.js` (161 Zeilen — Init, Zufriedenheit, Einfluss-Breakdown, Wortführer-Stabilität, Interessen, Forderungsfähigkeit, Migration, RNG-Neutralität), `tests/agents/run-estate-metrics.js` (196 Zeilen). Erweitert: `tests/event_chain_test.js` (+6 Ketten-Setups im Alle-Templates-Smoke-Test), `tests/drama_director_test.js` (+2 Sektionen), `tests/chronicle_test.js` (+1 Sektion), `tests/ui_viewmodel_test.js` (+2 Sektionen inkl. Bugfix-Regressionstest). `js/estates.js` in alle 17 bestehenden Sandbox-Modullisten (Node-Tests + Agenten-Harness) aufgenommen. Vollständige Node-Testsuite besteht (einzige Ausnahme: die bereits vor Phase 11 bestehende, unabhängig bestätigte `economy_test.js`-Preis-Obergrenze-„Auffälligkeit", keine Regression).

## AU. Determinismus

Kein `rnd()`-Aufruf in `js/estates.js` (per Test erzwungen), Wortführer-Auswahl/Interessen-Erkennung/Forderungsfähigkeit vollständig deterministisch. Die sechs neuen Ketten verbrauchen `rnd()` ausschließlich über den bereits bestehenden, unveränderten `startChance`-Wurf in `startNewEventChainIfEligible()` — derselbe Mechanismus wie alle zehn Phase-5-Ketten.

## AV. Golden Fixtures

`tests/fixtures/advance_year_snapshot_golden.json` einmal neu erzeugt (alte Version archiviert als `..._pre_phase11.json`) — legitim, weil die neuen Ketten in Jahren, die zuvor keine eligible Kette hatten, jetzt einen zusätzlichen `rnd()`-Wurf auslösen (echte Erweiterung des Spielinhalts, keine Störung). Nach der Neuerzeugung: alle drei Seeds erneut byte-identisch reproduzierbar.

## AW. Battle Engine

`battle-engine/*.js` — 0 Zeilen verändert seit dem letzten Phase-10-Commit. Bestätigt per `git diff --stat`.

## AX. Spielstand

`SAVE_VERSION` 7→8, `migrateSaveV7ToV8()` folgt exakt dem etablierten Muster (siehe die sechs vorherigen Migrationsfunktionen in js/core.js): erzeugt `state.estates` deterministisch aus dem aktuellen Weltzustand (`initEstates()`), keine rückwirkend erfundene Historie.

## AY. Bundle

`index.html`: 937.499 Bytes (von 872.283 zu Phase-8I-Ende). Laufzeit-Rauchtest (newGame + 12× advanceMonth) besteht nach jedem Rebuild.

## AZ. Commits

Sieben Commits dieser Phase (`87c4f67` … `2f9140a`), jeder ein abgeschlossener, getesteter Checkpoint: Kernmodul → sechs Ketten → Drama Director/Chronik → UI → Agenten-Policy → Matrixdaten → Stände-Metriken. Alle auf `claude/projekt-dateien-check-zk1yyw` gepusht.

## BA. Arbeitsverzeichnis

Sauber (`git status` leer) zum Zeitpunkt dieses Berichts.

## BB. Top-5-Befunde → Empfehlungen für eine mögliche Phase 12

1. **Cross-System-Wert ist hoch (80%), aber ungleich verteilt zwischen den Ständen** — Bürgertum wird weit häufiger abgewiesen als gewährt (s. AG); eine spätere Phase könnte prüfen, ob das ein Ausdruck bewusster archetypischer Vielfalt ist (plausibel, hier nicht abschließend widerlegt) oder eine unbeabsichtigte strukturelle Schieflage der 8 `estateEventPrefs`-Voreinstellungen.
2. **Bauernschaft bleibt führerlos** — falls eine spätere Phase ihr eine Stimme geben will, bräuchte es entweder einen neuen, bewusst einfachen "kollektive Vertretung ohne Einzelperson"-Mechanismus oder eine Erweiterung des Charakter-Core-Kandidatenpools (beides außerhalb des Phase-11-Auftrags).
3. **Keine Story-Thread-Anbindung** — messbar (AK): Threadtypenvielfalt unverändert. Eine spätere Phase könnte hier ansetzen, MUSS aber nicht (Chronik/Drama-Tension liefern bereits sichtbare Konsequenz).
4. **Verwalters Kaiser-Rate-Anstieg** — kein Fehler, aber ein Signal, dass Stände-Privilegien als Prestige-/Legitimitäts-Hebel stärker wirken als andere Archetypen sie nutzen; eine spätere Balance-Phase könnte prüfen, ob das gewünscht ist.
5. **41–45% Ständekonflikt-Rate** — die Flaggschiff-Cross-System-Kette feuert in weniger als der Hälfte der Kampagnen; eine spätere Phase könnte die Eligibility-Schwellen (`CONFIG.estates.demand`) empirisch nachschärfen, falls mehr Konfliktdichte gewünscht ist.

Alle fünf sind **Beobachtungen aus echten Daten**, keine Entscheidungen — die Wahl, ob/welche davon eine Phase 12 aufgreift, liegt beim Auftraggeber.

## BC-BF. Empfehlung für Phase 12 (nicht bindend, rein datenbasiert)

Die Daten legen nahe, dass das Landstände-System in seiner jetzigen Form **stabil, konsequenzreich und regressionsfrei** funktioniert; eine mögliche Phase 12 könnte — falls gewünscht — entweder (a) das System in der Breite lassen und stattdessen Tiefe hinzufügen (mehr Interessen-Typen, feinere Privilegien-Effekte), oder (b) die in BB Punkt 1–3 benannten Beobachtungen gezielt untersuchen, oder (c) einen völlig anderen Bereich des Spiels adressieren. Dies ist **keine Empfehlung für eine bestimmte Richtung** — nur eine Zusammenfassung dessen, was die Daten hergeben.

## BG. STOPP

Phase 11 — Living Realm ist hiermit abgeschlossen und dokumentiert. **STOPP.** Keine weitere Phase, keine Erweiterung des Landstände-Systems und keine Balance-Änderung an gesperrten Phase-10-Werten (Battle Engine, TROOP_TYPES, Kriegsökonomie, Vasallentribut) ohne erneute, ausdrückliche Freigabe durch den Auftraggeber.
