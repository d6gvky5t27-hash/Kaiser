# PHASE 12 — IMPERIAL POLITICS: KURFÜRSTEN, WAHLVERSPRECHEN, MACHTBLÖCKE & DER KAMPF UM DIE KRONE

Abschlussbericht. Sprache: Deutsch (Berichtstext), Code/Bezeichner/Zitate im Original. Struktur folgt der etablierten Konvention aus PHASE9_GAMEPLAY_AUDIT.md/PHASE10_BALANCE_COMPARISON.md/PHASE11_LIVING_REALM_REPORT.md (buchstabengegliederte Abschnitte).

## A. Zusammenfassung

Phase 12 ersetzt die alte, seit Phase 4 bestehende Kaiserwahl (ein Schwellenwert-Trigger + Bestechungs-Autowin + vier abstrakte, an keine Region gebundene Stimmen) durch ein echtes, mehrkandidatenfähiges Wahlsystem: alle sieben `state.diplomacy`-Regionen (ai1-ai7, zuvor nur ai1-ai3 kriegsfähig, ai4-ai7 zuvor rein wirtschaftlich simuliert) sind jetzt gleichberechtigte Kurfürsten mit je einem echten Character-Core-Herrscher, einem deterministischen, vollständig aufgeschlüsselten Score pro Kandidat, einer spielerseitig bewusst erklärten Kandidatur mit 3-8-jähriger Vorbereitungszeit, diplomatischen Geschenken mit abklingender Wirkung, einer dauerhaften Wahlversprechen-Ablage (vier Typen, echte Konsequenzen über World Memory) und fünf neuen Eventketten, die diesen politischen Prozess erfahrbar machen.

Kernzahlen aus der 360-Kampagnen-Matrix + 36-Kampagnen-Holdout-Matrix (Details in Abschnitt X-AB):
- **0 Abstürze** über 396 simulierte 100-Jahre-Kampagnen.
- **21/21 abgehaltene Wahlen gewonnen (100%, 18/18 Hauptmatrix + 3/3 Holdout)** — aber ein zentraler, ehrlich offengelegter Befund: **in keiner der 396 organischen Kampagnen erreichte je eine KI-Region die Kandidateneignung** (bestätigt zusätzlich durch eine gezielte 20-Seed-Stichprobe bei Jahr 1600, s. Abschnitt Y). Jede abgehaltene Wahl war dadurch ein unangefochtener Durchmarsch — die fünf neuen Eventketten feuerten in der gesamten Matrix **kein einziges Mal**, weil ihre Auslösebedingungen (ein unentschlossener Kurfürst, ein aktives Wahlversprechen, eine knappe Wahl) einen echten Gegenkandidaten voraussetzen.
- Wirtschaft/Krieg/Landstände-Kennzahlen sind gegenüber der Phase-11-Baseline **strukturell unverändert** (Details in Abschnitt Z); die einzige erklärbare Verschiebung ist ein Rückgang der Geschenk-/Zusage-Häufigkeit (Verwalter 1.9→0.13 avg), eine direkte, gewollte Folge davon, dass das neue Score-Modell eine Kandidatur oft schon ohne zusätzliche Ausgaben gewinnbar macht.
- Eine echte, während der Umsetzung selbst gefundene und behobene Regression in der Test-Infrastruktur (nicht im Produktivcode): `metrics.js` filterte noch auf den nicht mehr existierenden Aktionsnamen `"bribe_elector"` (immer 0 seit der Kernmodul-Ersetzung) und nutzte das mehrdeutige `gameOver==="victory"`-Flag für `becameKaiser`. Behoben und die komplette Matrix neu erzeugt.

STOPP am Ende dieses Berichts — keine weitere Phase ohne erneute ausdrückliche Freigabe.

## B-E. Architektur & Designentscheidungen

**B. Electors SIND `state.diplomacy`.** Kein zweites Diplomatiesystem (§Auftrag): die sieben Kurfürsten sind exakt die sieben `state.diplomacy`-Einträge — jede bestehende Diplomatiefunktion (Geschenke, Bündnisse, Verträge, Sabotage, `checkForeignRulerDeaths()`) wirkt automatisch auch auf die vier neuen Electors (ai4-ai7, zuvor nur wirtschaftlich simuliert über `aiRegionDevelops()`), ohne dass `js/imperial-politics.js` sie dupliziert. Die einzige nötige Abgrenzung: `state.warState` hat weiterhin nur `ai1-ai3`-Einträge, also bekam `checkAiWarInitiative()` (js/military.js) eine Zeile Schutz (`if (!(aiId in state.warState)) continue;`), damit ai4-ai7 diplomatisch, aber nicht militärisch erreichbar bleiben — Kriegskarte/Militärbalance bleiben exakt auf ai1-ai3 begrenzt.

**C. Score statt Autowin.** `computeElectorScoreBreakdown(state, aiId, candidateId)` (js/imperial-politics.js) ist ein additiver, komponentenweise gedeckelter Score (dasselbe "Breakdown"-Muster wie `computeDramaTensionBreakdown()`/`computeEstateInfluenceBreakdown()`): diplomatische Beziehung, persönliche Beziehung (`computeRelationshipBreakdown()`, funktioniert für JEDEN Kandidaten, nicht nur den Spieler), Bündnis/Nichtangriffspakt, Krieg-Malus, Krieg/Frieden/Hilfe aus der echten World Memory (inkl. Trait-Modulation wie rachsüchtig/barmherzig — **ohne einen einzigen neuen Trait-spezifischen Codezeile**, da `computeEffectiveWeight()` diese Schlüssel bereits generisch liest), Wahlversprechen (aktiv = Bonus, gebrochen = echter, abklingender Malus aus der tatsächlich aufgezeichneten `ELECTION_PROMISE_BROKEN`-Memory statt einer erfundenen Konstante), Geschenke mit abklingender Wirkung, Prestige/Legitimität/Titel (nur Spieler), Ansehen aus demselben Wohlstands-Proxy wie die Kandidateneignung (nur Rivalen), gemeinsame Gegner, dynastische Verbindung (ehrlich fast immer 0, da Auslandsherrscher laut Phase 8E bewusst keine Familie haben — dokumentiert, nicht versteckt).

**D. Kandidatur ist eine bewusste Entscheidung, keine automatische Schwelle.** `declareImperialCandidacy()` ersetzt das alte `rnd() < triggerChancePerYear`-Auto-Trigger — öffnet ein 3-8-jähriges Vorbereitungsfenster (`checkImperialElectionTiming()`), in dem der Spieler Geschenke/Zusagen einsetzen kann, bevor `resolveImperialElection()` tatsächlich abstimmt. Rivalenkandidaten (max. 3, `getEligibleRivalCandidates()`) werden bei Kandidaturerklärung EINMALIG festgelegt (nicht bei jeder Score-Abfrage neu gewürfelt), damit eine Kandidatur eine erkennbare, stabile politische Lage beschreibt.

**E. Wahlversprechen sind eine dauerhafte, von der Kandidatur getrennte Ablage.** `state.electionPromises` überlebt Wahlsieg/-niederlage bewusst (§50/§128 des Auftrags) — ein Jahre zuvor gebrochenes Versprechen wirkt in einer späteren Kandidatur weiter nach. Vier Typen, alle auf bereits bestehende Mechaniken gegründet (kein neues Diplomatiesystem): `no_war_target` (echte `declareWar()`-Bindung), `maintain_alliance`/`maintain_treaty` (echte `treaties`-Felder, bei Erstellung UND laufend geprüft — ein während der Testabdeckung gefundener Inkonsistenz-Fund, s. Abschnitt N), `pay_tribute` (echte Treasury-Zahlung). Bewusst NICHT gebaut: "Unterstützung in einem Konflikt" (Auftrags-Beispiel) — es gibt keine KI-gegen-KI-Kriege im bestehenden Modell, die der Spieler unterstützen könnte; eine erfundene Mechanik dafür hätte gegen die zentrale "keine Fake-Daten"-Regel verstoßen.

## F-J. Integration mit bestehenden Systemen

**F. World Memory** (js/memory.js) — vier neue Typen (`IMPERIAL_CANDIDACY_DECLARED`, `ELECTION_PROMISE_MADE`, `ELECTION_PROMISE_FULFILLED`, `IMPERIAL_ELECTION_LOST`); zwei bereits seit Phase 4/5 existierende, aber nie tatsächlich verkabelte Typen (`ELECTION_SUPPORT_GIVEN`, `ELECTION_PROMISE_BROKEN`) werden jetzt zum ersten Mal wirklich benutzt statt dupliziert. Ein während der Umsetzung selbst gefundener und korrigierter Fehler: die ursprüngliche Score-Berechnung für gebrochene Versprechen konstruierte eine **erfundene** Fake-Memory statt die echte, bereits aufgezeichnete `ELECTION_PROMISE_BROKEN`-Memory zu lesen — behoben, bevor es in Produktivcode landete (Abschnitt N nennt den zweiten, tatsächlich getestet gefundenen Fund).

**G. Character Core** (js/characters.js) — `computeRelationshipBreakdown()` wird identisch für Spieler- UND Rivalenkandidaten wiederverwendet, keine zweite Beziehungsformel für Rivalen.

**H. Phase 8E Auslandsherrscher** — das Muster (`createCharacter()`, bewusst ohne Familie) wird von ai1-ai3 auf alle sieben Regionen ausgedehnt; `newGame()` bekam dafür eine Schleife nach der bestehenden EXTRA_REGIONS-Diplomatie-Erweiterung.

**I. Drama Director** (js/drama-director.js) — die "Bevorstehende Kaiserwahl"-Tension-Komponente nutzte noch die alte, seit dieser Phase bedeutungslose Heuristik (`titleIndex>=kurfuerst && electionCooldown<=1`, ein Überbleibsel des automatischen Trigger-Modells); liest jetzt den echten Kandidatur-Fortschritt (`state.imperialCandidacy`-Alter gegen `candidacyPrepYearsMin`, oder `state.pendingElection`). Neue Komponente: ungesühnte gebrochene Wahlversprechen erhöhen die Tension, exakt nach demselben Muster wie Phase 11s Stände-Unruhe.

**J. Story Threads** (js/story-threads.js) — `detectImperialAmbitionSignals()` lieferte bislang eine flache Konstante (40) ab Eignung, unabhängig vom tatsächlichen Fortschritt; folgt jetzt dem echten Kandidatur-/Wahl-/Versprechen-Zustand (40 → 65 bei erklärter Kandidatur → 90 bei anstehender Wahl, plus Zuschläge für aktive Geschenke/ungesühnte Brüche). Die fünf neuen Ketten sind alle demselben bestehenden `IMPERIAL_AMBITION`-Thread-Typ zugeordnet (dieselbe Geschichte, kein achter Thread-Typ). Die bereits existierende `imperial_ambition`-Kette (Phase 6, rein symbolisch) löst bei voller Eignung jetzt eine ECHTE `declareImperialCandidacy()` aus statt nur Prestige zu vergeben — fällt bei fehlenden Voraussetzungen (z.B. keine Kathedrale) sauber auf das bisherige symbolische Werben zurück.

## K. Estates (reaktiv)

`computeEstateInfluenceBreakdown()` bekam einen neuen, nur den Adel betreffenden Faktor: eine laufende Kaiserwahl-Kandidatur des eigenen Hauses (oder gar die Kaiserwürde selbst) rückt den Hochadel politisch enger an den Hof — real, additiv, derselbe Bausteinstil wie die bestehende militärische Lehnsadel-Abhängigkeit direkt darüber im selben Codeblock. Kein zweiter Einfluss-Kanal, keine erfundene Adel-Kurfürsten-Beziehung.

## L. Die fünf neuen Eventketten

Alle folgen dem bestehenden Muster (checkEligibility/advance, queueChainDecision, resolveEventChain/failEventChain) und wirken ausschließlich über bereits vorhandene Stellschrauben (`giftElector()`, `createElectionPromise()`, `fulfillElectionPromise()`, `breakElectionPromise()`, `computeElectorScoreBreakdown()`).

- **Unsicherer Kurfürst** — ausgelöst, wenn während einer aktiven Kandidatur mindestens ein Kurfürst UNENTSCHLOSSEN steht. Optionen: Geschenk / feste Zusage / abwarten.
- **Ein teures Versprechen** — ausgelöst, wenn eine `pay_tribute`-Zusage binnen ≤2 Jahren fällig wird. Optionen: sofort zahlen / um Aufschub bitten (-6 Beziehung, +3 Jahre) / bewusst brechen.
- **Rivalisierende Zusagen** — ausgelöst bei ≥2 gleichzeitig aktiven Versprechen. Optionen: zu allen stehen / die schwächste (real per Score ermittelt) aufgeben / ignorieren.
- **Ein gebrochenes Versprechen** (reaktiv) — feuert genau einmal pro tatsächlichem Bruch (`promise.grievanceHandled`-Flag, exakt nach dem `markEstateDemandRaised()`-Vorbild aus Phase 11). Optionen: Entschädigung (-200 Taler, `DEMAND_ACCEPTED`) / Verantwortung abstreiten (`DEMAND_REFUSED`, -5 Legitimität) / schweigen.
- **Die entscheidende Stimme** — feuert nur, wenn eine Wahl unmittelbar bevorsteht UND das Ergebnis auf der Kippe steht (Vorsprung/Rückstand ≤1 Stimme gegenüber der Mehrheitsschwelle), identifiziert den knappsten Wackelkandidaten über die bereits bestehende Debug-Funktion `explainImperialElection()` (read-only wiederverwendet, keine zweite Tally-Logik) — zeigt dem Spieler bewusst **keine** exakten Stimmenzahlen (§15/16 "keine exakte Wahrscheinlichkeit"), nur die qualitative Dramatik. `systemCritical: true` (wie die echte Hungersnot), damit ein Drama-Director-Recovery-Fenster diesen einen zeitkritischen Moment nicht zurückstaffelt.

Alle fünf sind in `CHAIN_PRIORITY_ORDER`/`CHAIN_TEMPLATES` registriert.

## M. UI — Kaiserkrone-Unteransicht (Diplomatie-Tab)

Neues Panel `#kaiserkronePanel` (sichtbar ab Kurfürst-Rang oder aktiver Kandidatur/Wahl): Eignungs-Checkliste, "Kandidatur erklären"-Button, alle sieben Kurfürsten mit Region/Herrschername und **ausschließlich der qualitativen Haltung** (`ELECTOR_STANCE_LABELS`, niemals der rohe Score — der bleibt `explainElectorScore()`/`explainImperialElection()` im Debug-Panel vorbehalten), Geschenk-Button je Kurfürst, ein Inline-Formular für alle vier Wahlversprechen-Typen (Ziel-/Betragsfelder werden je nach Typ ein-/ausgeblendet), eine Wahlversprechen-Ablage mit Status/Bedingung/"Jetzt einlösen"-Button, und ein "Wahl jetzt abhalten"-Button, sobald eine Wahl ansteht. Neues `getImperialPoliticsViewModel()` (js/ui-viewmodels.js) fasst dies ausschließlich aus bereits bestehendem State/bestehenden Funktionen zusammen. Der globale `electionBanner` (Provisorium aus der Kernmodul-Verdrahtung) bleibt zusätzlich als seitenübergreifender Hinweis bestehen — keine Doppelarbeit, beide rufen denselben `doResolveElection()`.

**End-to-End in einem echten Chromium-Browser verifiziert** (Playwright, s. Abschnitt V): Kandidatur erklären, Geschenk senden, Wahlversprechen über das Formular anlegen und in der Ablage sehen, die typabhängigen Formularfelder umschalten, eine anhängige Wahl über den Panel-Button auflösen (Sieg) — alles fehlerfrei, inklusive der vollständigen Kaiserkrönungs-Sequenz.

**Nebenbei gefundener und behobener Fehler:** `STRINGS.de`/`STRINGS.en` (data/gamedata.js) fehlte der Schlüssel `tab_staende_label` vollständig — die bereits seit Phase 11 bestehende LANDSTÄNDE-Tab-Beschriftung zeigte dadurch den rohen i18n-Schlüsseltext (`t()`s dokumentiertes Fallback-Verhalten bei fehlendem Schlüssel), sichtbar beim Screenshotten der neuen Kaiserkrone-Ansicht entdeckt. Eine Zeile Fix in beiden Sprachobjekten.

## N. Zwei während der Testabdeckung gefundene und behobene Lücken

1. **`createElectionPromise()` validierte `maintain_alliance` gegen ein bestehendes Bündnis, aber `maintain_treaty` gar nicht** — eine `maintain_treaty`-Zusage ließ sich für einen Vertrag anlegen, der nie existierte. Behoben: dieselbe Existenzprüfung wie bei `maintain_alliance`.
2. **`MEMORY_TYPES.ELECTOR_PLEDGED_SUPPORT`** war definiert, aber von keinem einzigen Codepfad je ausgelöst worden — totes Konfigurationsrelikt einer früheren Entwurfsiteration. Entfernt.

Beide beim gezielten Schreiben von `tests/election_promises_test.js`/`tests/election_memory_test.js` gefunden, nicht durch Zufall — genau der Zweck, für den diese Tests geschrieben wurden.

## O. Agenten-Testharness

**AGENT_POLICY_VERSION → "phase12-v1"**, dokumentiert (wie phase11-v1) mit vollständiger Historie im Dateikopf. Alle fünf neuen Ketten lösten bereits vor jeder Anpassung sicher über den bestehenden generischen `eventPrefs(ctx)`-Fallback auf. Zwei neue, optionale Erweiterungen:

- **`handleElection()`s `opts.usePromises`** — bietet zusätzlich zum Geschenk ein `pay_tribute`-Wahlversprechen an. Aktiviert für Verwalter (institutionelles Vertrauen), Diplomat (Beziehungspflege), Dynast (dynastische Ehre — bekam dabei auch `considerBuildKathedrale`/`considerBuildPalast`/`handleElection` neu, "die Krone als ultimatives dynastisches Vermächtnis" war eine naheliegende, gut motivierte Erweiterung eines zuvor nie krontstrebenden Archetyps), Machtpolitiker (kalkuliertes Image-Management) — sowie Min-Maxer, aber ausschließlich während dessen bestehender `kaiserwahl_bribery_rush`-Phase (dieselbe benannte Hypothese vertieft, keine sechste erfunden). Bewusst NICHT für Kaufmann/Kriegsherr/Hardliner/Versöhner (verfolgen die Krone überhaupt nicht — eine bereits vor Phase 12 bestehende, ehrliche Grenze) und Opportunist (dessen gesamte Identität "keine feste Haltung" ist — ein Versprechen widerspräche dem).
- **`agent.imperialPoliticsEventPrefs(ctx)`** — optionaler, nur für die fünf neuen Ketten konsultierter Override (`pendingImperialPoliticsChainId()`, exaktes Gegenstück zu `pendingEstateIds()`), umgesetzt für dieselben fünf Archetypen mit echt unterschiedlichen Haltungen je Kette (z.B. gibt der Machtpolitiker bei rivalisierenden Zusagen kalkuliert die schwächste auf, während Diplomat/Dynast/Verwalter grundsätzlich nie ein Versprechen aufgeben).

**Verifikation:** volle 100-Jahre-Kampagnen für alle betroffenen Archetypen liefen fehlerfrei; eine gezielte 15-Jahre-Stichprobe mit erzwungener Kandidatur-Eignung bestätigte `declare_imperial_candidacy`/`gift_elector`/`promise_elector`/`resolve_election` feuern für Verwalter/Diplomat/Dynast/Machtpolitiker korrekt (alle vier gewannen die Krone innerhalb des Fensters); Min-Maxer enthielt sich korrekt, da dessen `kaiserwahl_bribery_rush`-Phase (Jahre 80-100) außerhalb des 15-Jahre-Testfensters lag.

## P-U. Vollständige Kampagnen-Matrix

**P.** 360-Kampagnen-Hauptmatrix (30 Seeds × 12 Agenten × 100 Jahre, seedBase=1000 — dieselben Seeds wie tests/output/phase10/phase11) + **Q.** 36-Kampagnen-Holdout-Matrix (3 Seeds, seedBase=500000 — dieselbe Seed-Basis wie Phase 11s Holdout). **R.** 0/396 Abstürze. **S.** Laufzeit ~74s (Hauptmatrix) / ~9s (Holdout), ~208ms/Kampagne — Performance unverändert gegenüber Phase 11.

**T.** Neues `tests/agents/run-election-metrics.js` (nach dem Vorbild von `run-estate-metrics.js`) berechnet Phase-12-spezifische Kennzahlen ausschließlich aus echtem State (nicht geschätzt): Kandidaturrate, Wahlen abgehalten/gewonnen/verloren (aus den echten `TITLE_GAINED(kaiser)`/`IMPERIAL_ELECTION_LOST`-Memories, nicht aus dem mehrdeutigen `gameOver`-Flag), Jahre bis zur ersten Auflösung, tatsächlich angebotene Geschenke/Zusagen, die finale Wahlversprechen-Ablage nach Status/Typ, und die Auflösungs-/Ausgangsverteilung der fünf neuen Ketten.

## V. Playwright-Browsertest

Ein fokussierter Kaiserkrone-Smoke-Test (Chromium headless) bestätigte die gesamte UI-Kette fehlerfrei (s. Abschnitt M) — im Session-Scratchpad statt im Repository gehalten, konsistent mit der bereits etablierten Praxis dieses Projekts (Playwright-Tests werden laut DEVELOPMENT.md durchgehend prosa-dokumentiert, nie als Datei committet).

## W-X. Nicht-Regressions-Validierung gegen Phase 11

| Prüfpunkt | Befund |
|---|---|
| **W. Wirtschaft/Krieg/Landstände** | Alle Aggregatwerte (Titel-Index, Todesspirale-Rate, Comeback-Rate, avgMeaningfulPerDecade) liegen für praktisch jeden Archetyp im selben Größenbereich wie die Phase-11-Baseline bei identischen Seeds. Verbleibende kleine Verschiebungen (z.B. Opportunist Comeback-Rate 0.459→0.202) sind durch die zusätzlichen `rnd()`-Aufrufe in `newGame()` erklärbar (dieselbe RNG-Stream-Verschiebung, die bereits die Golden-Fixture-Neuerstellung nötig machte, s. AA) — keines der bestehenden Verhaltensmuster (Kaufmann/Kriegsherr/Diplomat/Dynast/Machtpolitiker erreichten in BEIDEN Phasen niemals organisch den Kurfürst-Rang, 0 Wahlen in beiden Matrizen) hat sich geändert. |
| **X. Battle Engine / TROOP_TYPES / Vasallentribut** | `battle-engine/*.js` — 0 Zeilen Diff seit Phase 11. `tests/phase10_balance_test.js` besteht weiterhin vollständig. |
| **Y. Nur eine erklärte, beabsichtigte Verschiebung** | `avgBribes` (Verwalter 1.9→0.13, andere Kaiserwahl-Archetypen ähnlich) — direkte, gewollte Folge des neuen Score-Modells: eine Kandidatur ist oft bereits ohne zusätzliche Ausgaben gewinnbar (Baseline aus Titel+Prestige+Legitimität reicht meist für GENEIGT/SICHER_FUER), `handleElection()` überspringt korrekt bereits sichere Electors. Kein Fehler, sondern die beabsichtigte Ablösung des alten Auto-Win-Bestechungsmodells. |
| **Z. Testsuiten-Regression selbst gefunden und behoben** | `metrics.js` filterte noch `"bribe_elector"` (Aktion existiert seit der Kernmodul-Ersetzung nicht mehr, Feld war seither immer 0) und nutzte `gameOver==="victory"` für `becameKaiser` (mehrdeutig seit es drei weitere alternative Siegbedingungen gibt, die dasselbe Flag setzen). Behoben (`gift_elector`+`promise_elector`-Zählung, `finalState.titleName==="Kaiser"`-Prüfung), Matrix + Aggregat neu erzeugt. |

## AA. Golden Fixtures

`tests/fixtures/advance_year_snapshot_golden.json` einmal neu erzeugt (alte Version archiviert als `..._pre_phase12.json`) — legitim, weil `newGame()` durch die vier neuen Auslandsherrscher (ai4-ai7) acht zusätzliche `rnd()`-Aufrufe verbraucht (echte Erweiterung des Spielinhalts, keine Störung). Nach der Neuerzeugung: alle drei Seeds erneut jahrgenau byte-identisch reproduzierbar.

## AB. Der zentrale Befund: unangefochtene Wahlen

Über 360 organische Kampagnen entstand **kein einziges Mal** ein eignungsfähiger Rivalenkandidat. Gezielt verifiziert über eine unabhängige 20-Seed-Stichprobe bei Jahr 1600 (100 simulierte Jahre, reguläre KI-Wirtschaftsentwicklung ohne Agentensteuerung): `getEligibleRivalCandidates()` lieferte in 0/20 Kampagnen auch nur einen einzigen Kandidaten — der Wohlstands-Proxy der KI-Regionen liegt im Schnitt bei ~255, die geforderte Schwelle (`CONFIG.ai.buildWealthThreshold * candidateEligibility.wealthProxyMultiplier`) bei 1.800, und keine KI-Region erreicht je die Bevölkerungsschwelle des Kurfürst-Titels. Direkte Konsequenz: jede der 18 in der Matrix abgehaltenen Wahlen war ein unangefochtener Durchmarsch (100% Sieg), Geschenke/Zusagen wurden kaum gebraucht, und die fünf neuen Eventketten — deren Auslösebedingungen (ein unentschlossener Kurfürst, eine aktive Zusage, eine knappe Wahl) strukturell einen echten Gegenkandidaten voraussetzen — feuerten in der gesamten Matrix **kein einziges Mal**.

Dies ist kein Fehler im neuen Code — `computeRivalCandidateEligibility()`, `getEligibleRivalCandidates()` und die fünf Ketten funktionieren exakt wie entworfen und sind einzeln vollständig durch `tests/election_promises_test.js`/`tests/election_memory_test.js`/`tests/event_chain_test.js` abgedeckt (dort mit direkt gesetzten Rivalen-IDs getestet, s. Abschnitt N/L). Es ist ein **Kalibrierungsbefund**: die KI-Wirtschaft entwickelt sich in der bestehenden Simulation nicht weit genug, damit das in dieser Phase gebaute politische Tiefensystem unter organischem Spiel je sichtbar wird. Bewusst NICHT in dieser Phase "repariert" — dieselbe Trennung wie Phase 9 (Audit) / Phase 10 (gezielte Rebalance in einer separaten, ausdrücklich freigegebenen Phase): der Befund wird hier dokumentiert, eine mögliche Kalibrierung bräuchte eine eigene Freigabe (s. Empfehlungen, Abschnitt AG).

## AC. Geänderte Produktionsdateien

`data/gamedata.js` (+90 Zeilen: CONFIG.election vollständig neu, 4 MEMORY_TYPES, 2 TRAITS-Erweiterungen `giftEffectMod`, `tab_staende_label`-i18n-Fix), `js/imperial-politics.js` (neu, 495 Zeilen), `js/core.js` (+68: newGame()-Erweiterung, SAVE_VERSION 8→9 + Migration), `js/military.js` (+11: Kriegsfähigkeits-Schutz, Versprechen-Bruch-Hook), `js/politics.js` (+7/-81: alte Kaiserwahl-Funktionen entfernt, Verweis-Kommentar), `js/drama-director.js` (+21: Tension-Komponenten), `js/story-threads.js` (+26: Signal-Fortschritt), `js/estates.js` (+7: Adel-Einfluss-Faktor), `js/event-chains.js` (+344: 5 Ketten + Registrierung + imperial_ambition-Anbindung), `js/ui-viewmodels.js` (+81: getImperialPoliticsViewModel + Elector-ViewModel-Neufassung), `index.html` (Kaiserkrone-Panel Markup+Render+Handler, electionBanner-Neufassung — zweiter Script-Block, nicht Teil des Bundle-Builds), `tools/build-bundle.js` (+1: imperial-politics.js in FILES).

## AD. CONFIG-Änderungen

`CONFIG.election` vollständig neu strukturiert (`triggerChancePerYear`, `candidacyPrepYearsMin/Max`, `cooldownYearsAfterLoss`, `votesNeededForMajority`, `lossPrestigePenalty`, `lossRelationPenalty`, `giftDuringCandidacyRelationGain`, `giftDiminishingReturnsFactor`, `giftCost`, `promise.{defaultDurationYears,brokenRelationPenalty,fulfilledRelationBonus,activePromiseScoreBonus}`, `scoreWeights.*` [13 einzelne Gewichte], `stanceThresholds`, `candidateEligibility.wealthProxyMultiplier`, `maxRivalCandidates`), `CONFIG.drama.tensionWeights.brokenPromiseTension`, `CONFIG.estates.influenceWeights.{imperialCandidacyBonus,imperialTitleBonus}`. Alle zentral, keine verstreuten Magic Numbers.

## AE. Tests

Neu: `tests/election_promises_test.js` (Erstellung/Validierung aller vier Typen, Einlösung, direkter/automatischer/ereignisnaher Bruch, Fristablauf, Score-Wirkung inkl. echtem Memory-Abklingen, Persistenz über die Wahl hinaus), `tests/election_memory_test.js` (welche Funktion erzeugt welchen Memory-Typ, Wiederverwendung bestehender Typen, Trait-Modulation ohne neuen Trait-Code), `tests/agents/run-election-metrics.js`. Erweitert: `tests/event_chain_test.js` (+5 Ketten-Setups + Eligibility-Logik-Tests inkl. einer deterministisch konstruierten 4:3-Wahllage für den Wackelkandidaten-Test — ein unangefochtener Kandidat gewinnt jede Stimme trivial, s. AB, daher musste hier bewusst ein echter Rivale gesetzt werden), `tests/drama_director_test.js`/`tests/story_thread_test.js`/`tests/estates_test.js`/`tests/ui_viewmodel_test.js` (je eine neue Sektion). `js/imperial-politics.js` in alle 20 bestehenden Node-Sandbox-Modullisten (`simModules`-Arrays, inkl. der beiden neuen Testdateien selbst) sowie in `tests/agents/run-campaign.js`s dateibasierte `SIM_FILES`-Liste aufgenommen. Vollständige Node-Testsuite besteht (einzige Ausnahme weiterhin die bereits vor Phase 11 bestehende, unabhängig bestätigte `economy_test.js`-Preis-Obergrenze-„Auffälligkeit", keine Regression).

## AF. Determinismus

Kein neuer, undokumentierter `rnd()`-Verbrauch: `js/imperial-politics.js`s einziger `rnd()`-Aufruf ist der bereits im Modul selbst dokumentierte Jahres-Wurf in `checkImperialElectionTiming()` (OB die Wahl dieses Jahr stattfindet — analog zum bestehenden `startChance`-Wurf der Event Chains), niemals WER sie gewinnt (`resolveImperialElection()` ist bei gleichem Zustand vollständig deterministisch, `explainImperialElection()` liefert exakt dieselben Scores, die tatsächlich entscheiden). `newGame()`s vier neue Auslandsherrscher verbrauchen acht zusätzliche `rnd()`-Aufrufe (dokumentierter Grund für die Golden-Fixture-Neuerstellung, s. AA) — bewusst NICHT in der SAVE_VERSION-9-Migration repliziert (Migrationen laufen vor dem Reseeding des Spielstands, ein `rnd()`-Aufruf dort wäre bei jedem Laden desselben Spielstands unterschiedlich; Geschlecht/Alter der vier migrierten Herrscher werden daher deterministisch aus ihrer Position abgeleitet).

## AG. Spielstand

`SAVE_VERSION` 8→9, `migrateSaveV8ToV9()`: erzeugt `state.diplomacy`-Einträge + Herrscher für ai4-ai7 falls fehlend, initialisiert `state.imperialCandidacy`/`state.electionPromises`, bildet das alte `state.pendingElection`-Objektformat (`{bribed:{...}}`) auf die neue Boolean-Form ab. Ein während der Migrationsimplementierung selbst gefundener und behobener Fund: `__charIdCounter` wurde bislang erst NACH den Migrationen synchronisiert — für eine Migration, die selbst neue Charaktere anlegt (wie diese), hätte das zu ID-Kollisionen mit bereits im Spielstand vorhandenen Charakteren führen können. Behoben, indem die Synchronisation vor die Migrationskette vorgezogen wurde.

## AH. Bundle

`index.html`: 1.005.666 Bytes (von 937.499 zu Phase-11-Ende). Laufzeit-Rauchtest (newGame + 12× advanceMonth) besteht nach jedem Rebuild.

## AI. Commits

Sieben Commits dieser Phase, jeder ein abgeschlossener, getesteter Checkpoint: Kernmodul → Wahlversprechen-Tests → fünf Ketten → Drama-Director/Thread/Estates-Verdrahtung → UI → Agenten-Policy → Matrixdaten/Metriken/Validierung. Alle auf `claude/projekt-dateien-check-zk1yyw` gepusht.

## AJ. Arbeitsverzeichnis

Sauber (`git status` leer, `node_modules/` per `.gitignore` ausgeschlossen) zum Zeitpunkt dieses Berichts.

## AK. Bekannte Grenzen & offene Punkte (ehrlich, nicht versteckt)

1. **Unangefochtene Wahlen** (Hauptbefund, s. AB) — das politische Kernversprechen dieser Phase (Wahlversprechen-Dilemmata, knappe Wahlen, die fünf neuen Ketten) ist unter organischem KI-Spiel derzeit nicht erreichbar, weil kein KI-Rivale je die Eignungsschwelle erreicht.
2. **Nur 3 von 12 Archetypen erreichen je den Kurfürst-Rang organisch** (Verwalter/Machtpolitiker/Min-Maxer — dieselbe Beschränkung bestand bereits in Phase 9/10/11 für die Titel-Progression insgesamt, keine neue Phase-12-Einschränkung).
3. **Wahlversprechen-Score-Komponente ist ehrlich, aber grob** — sie liest die tatsächliche `ELECTION_PROMISE_BROKEN`-Memory (kein Fake-Wert mehr, s. N), aber mehrere gleichzeitig gebrochene Versprechen an denselben Kurfürsten summieren sich additiv ohne Sättigungsmodell jenseits des bestehenden `brokenPromiseFactorCap`.
4. **Dynastische Verbindung ist strukturell fast immer 0** — dokumentiert in Code und Abschnitt C, keine erfundene Genealogie zwischen Spieler und Auslandsherrschern.
5. **Kaufmann/Kriegsherr/Hardliner/Versöhner verfolgen die Krone gar nicht** — eine bereits vor Phase 12 bestehende, hier bewusst nicht erweiterte Design-Grenze (s. O); nur Dynast bekam in dieser Phase eine neue, gut motivierte Erweiterung.

## AL. Top-4-Befunde → Empfehlungen für eine mögliche Phase 13

1. **Unangefochtene Wahlen (AB)** — falls politische Tiefe unter organischem Spiel sichtbar werden soll, bräuchte es entweder eine gezielte Kalibrierung der Rivalen-Eignungsschwelle (`candidateEligibility.wealthProxyMultiplier`) oder eine generelle KI-Wirtschaftsstärkung (Bereich früherer Phase-10-Arbeit) — beides außerhalb des Phase-12-Auftrags, hier nur als Daten dokumentiert.
2. **Agenten-Abdeckungslücke** — nur 5 von 12 Archetypen haben je `imperialPoliticsEventPrefs`; eine spätere Phase könnte prüfen, ob Kaufmann/Kriegsherr/Hardliner/Versöhner absichtlich unpolitisch bleiben sollen oder ob eine erweiterte Kandidatur-Verfolgung (wie bei Dynast in dieser Phase) auch für sie passt.
3. **Wahlversprechen-Typen-Abdeckung** — `maintain_treaty` ist derzeit hart auf `nichtangriff` beschränkt (UI wie Agenten); eine spätere Phase könnte `handel` als zweiten Vertragstyp ergänzen, falls gewünscht.
4. **Keine Sättigung bei mehreren gleichzeitigen Brüchen** (AK.3) — eine spätere Phase könnte prüfen, ob ein Kurfürst, dem gegenüber mehrere Versprechen gleichzeitig gebrochen wurden, unverhältnismäßig hart bestraft wird.

Alle vier sind **Beobachtungen aus echten Daten**, keine Entscheidungen — die Wahl, ob/welche davon eine Phase 13 aufgreift, liegt beim Auftraggeber.

## AM. STOPP

Phase 12 — Imperial Politics ist hiermit abgeschlossen und dokumentiert. **STOPP.** Keine weitere Phase, keine Erweiterung des Kaiserwahl-Systems und keine Balance-Änderung an gesperrten Werten (Battle Engine, TROOP_TYPES, Kriegsökonomie, Vasallentribut, Landstände-Balance) ohne erneute, ausdrückliche Freigabe durch den Auftraggeber.
