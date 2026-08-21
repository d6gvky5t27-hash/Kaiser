# BASELINE — Referenzwerte vor der "Next Generation"-Weiterentwicklung

Stand: 2026-08-21, Commit-Basis: unmittelbar nach Schritt 40
(Beraterstufen/Bevölkerungsanzeige/Regierungsstil-Regler). Zweck: objektiver
Vergleichspunkt für spätere Phasen (Master-Prompt Punkt 4) — nach jeder
größeren Änderung kann `node tests/baseline_analysis.js` erneut laufen und
mit den hier festgehaltenen Zahlen verglichen werden.

**Methodik**: 30 Partien à 100 Jahre, **rein passiv** (kein Spielereingriff,
identisch zum Muster von `tests/economy_test.js`/`ai_vs_ai_test.js`), aber
mit **festen Seeds 0..29** statt echtem Zufall — siehe
`tests/baseline_analysis.js` (neu angelegt in Phase 1, verändert keine
bestehende Testdatei). Alle Zahlen sind damit exakt reproduzierbar:
derselbe Code + derselbe Seed liefert immer dasselbe Ergebnis.

## Testsuite-Status (zum Vergleich, mit dem Hinweis aus CODE_AUDIT.md
Abschnitt 7, dass diese beiden Tests NICHT reproduzierbar sind — jeder
erneute Lauf liefert leicht andere Zahlen):

- `node tests/battle_test.js`: **grün**, alle 6 Testfälle innerhalb der
  erwarteten Toleranzen (reproduzierbar, fester Seed pro Testfall).
- `node tests/economy_test.js` (ein Beispiellauf): 6/20 vollständig ohne
  Game Over durchgelaufen, 2/20 Preise nahe Obergrenze, 0/20
  Bevölkerungskollaps ohne Game-Over-Flag. Bevölkerung Ende min/avg/max:
  185/1166/2662. Staatskasse Ende min/avg/max: 30303/64455/118788.
- `node tests/ai_vs_ai_test.js`: siehe letzter dokumentierter Lauf in
  `DEVELOPMENT.md` Schritt 40 (KI-Dominanz max. 49%, Spieler-Titelverteilung
  100/100 "Freiherr" bei rein passivem Spiel, 0/100 Spielersiege).

## Reproduzierbare Baseline (`node tests/baseline_analysis.js`, Seeds 0-29)

**Bevölkerung (Ende der Partie oder bei Game Over)**
min 185 / Ø 1.223 / max 2.509

**Staatskasse (Ende der Partie oder bei Game Over)**
min 30.065 / Ø 61.461 / max 112.779
*(Hinweis: Rohwerte enthalten Nachkommastellen durch den in CODE_AUDIT.md
Abschnitt 9 dokumentierten `treasuryDrain`-Rundungsfehler — für die Baseline
irrelevant, aber als bekannte Ursache der Nachkommastellen festgehalten.)*

**Kriege**
Gewonnen: min/Ø/max = 0 / 0,00 / 0 — Verloren: min/Ø/max = 0 / 0,00 / 0.
Erwartungsgemäß: reines Passivspiel löst nie selbst einen Angriff aus, und
in keinem der 30 Läufe griff eine KI-Region den (durchgehend militärisch
untätigen) Spieler an. Das ist **kein** Hinweis auf fehlende KI-Aggression
im Allgemeinen (siehe `ai_vs_ai_test.js`, wo KI-Regionen sich gegenseitig
angreifen) — nur, dass die spezifische Schwelle
`aiWarMaxRelationForAggression` bei Startbeziehung + reinem Nichtstun des
Spielers in 30/30 Fällen nicht unterschritten wurde.

**Generationen (Dynastiewechsel)**
min 2 / Ø 2,77 / max 4 — über 100 Jahre.

**Katastrophen-Ereignisse** (`state.stats.disastersCount`: Seuche,
Rebellion, Stadtbrand)
min 1 / Ø 10,50 / max 26 — große Spannweite, deutet auf eine gewisse
Pfadabhängigkeit früher Zufriedenheitswerte hin (einmal in eine schlechte
Zufriedenheitsspirale geraten, begünstigt das weitere Katastrophen-Events).

**Höchster erreichter Titel** (nach 100 Jahren oder bei Game Over)
Freiherr: 30/30 (100%). Erwartungsgemäß identisch mit dem in
`ai_vs_ai_test.js` dokumentierten Befund — die Titelschwellen sind bewusst
so kalibriert, dass rein passives Spiel praktisch nie über den Startitel
hinauskommt (siehe DEVELOPMENT.md, mehrere frühere Kalibrierungsrunden zu
genau diesem Punkt, zuletzt die Regierungsstil-Regression aus Schritt 40).

**Game-Over-Gründe**
- `no_heir` (Dynastie stirbt ohne Erben aus): **16/30 (53%)**
- kein Game Over, 100 Jahre erreicht: 9/30 (30%)
- `defeat` (Bevölkerung nahezu entvölkert): 5/30 (17%)
- `bankrupt`: 0/30
- `victory`: 0/30 (erwartbar — keine Siegbedingung ist ohne Spieleraktion
  erreichbar)

**Wichtigster Einzelbefund dieser Baseline**: In reinem Passivspiel stirbt
die Dynastie in **über der Hälfte** der Läufe ohne Erben aus, bevor die 100
Jahre erreicht sind. Das ist per Definition kein "Bug" (ein Spieler, der
aktiv auf Nachfolge achtet — z. B. durch Ereignisse/Entscheidungen, die es
aktuell dafür aber gar nicht gibt — hat keinen Hebel, das zu beeinflussen,
weil Heirat/Geburt/Tod rein automatisch laufen). Es ist aber ein sehr
konkretes Signal für Master-Prompt Punkt 67 ("Dynastien sterben zu häufig
aus?") und sollte in die Prioritätenliste für spätere Phasen einfließen,
sobald das Dynastiesystem vertieft wird (Punkt 10/73 des Master-Prompts)
— nicht in Phase 1 selbst beheben.

**Kaiserwahlen ausgelöst** (rein passiv)
0/30. Erwartungsgemäß: eine Wahl setzt mindestens den Kurfürstenrang voraus,
den kein rein passiver Lauf erreicht (siehe Titelverteilung oben).

**Waren nahe der Preisobergrenze** (≥90% von `CONFIG.economy.priceMax`,
Häufigkeit über alle 30 Läufe)
Nur **Getreide**: 8/30 (27%). Alle anderen 22 Waren: 0/30. Getreide ist
damit die einzige strukturell knappheitsanfällige Ware im unbeeinflussten
Verlauf — plausibel, da Getreide sowohl Grundbedarf der gesamten
Bevölkerung als auch alleinige Basis der Kornbilanz/Hungermechanik ist.
Kein akutes Problem (der bestehende `economy_test.js`-Referenzbereich von
2–6/20 ≈ 10–30% deckt diese Größenordnung bereits ab), aber ein
Ausgangspunkt, falls "Preisblasen bei Getreide" später gezielt untersucht
werden sollen.

**Bevölkerungs-Todesursachen** (letztes simuliertes Jahr aller 30 Läufe,
gruppenweise aufsummiert — NICHT der Herrscher selbst, siehe unten)
- Geburten gesamt: 595
- Alterstod: 614 (76,0%)
- Hungertod: 194 (24,0%)
- Seuchentod: 0 (0,0%) — in den letzten simulierten Jahren dieser 30 Läufe
  war gerade keine Seuche aktiv; das ist eine Momentaufnahme des jeweils
  LETZTEN Jahres pro Lauf, keine Aussage über die gesamte Partie (Seuchen
  kommen über die 100 Jahre durchaus vor, siehe Katastrophen-Zähler oben).

**Bekannte Lücke dieser Metrik**: Der Herrscher selbst (der einzige
individuell simulierte Charakter mit Namen) hat aktuell **keine
unterscheidbare Todesursache** — `updateDynasty()` in
`js/population-dynasty.js` würfelt eine reine Alters-/Gesundheits-basierte
Sterbewahrscheinlichkeit, ohne z. B. "im Kampf gefallen", "an einer Seuche
gestorben" oder "ermordet" zu unterscheiden. Die Chronik vermerkt nur "…
verstarb im Alter von X Jahren." Falls Master-Prompt Punkt 61
("Charaktere sterben mit unterscheidbaren Gründen") später umgesetzt wird,
ist dieser Baseline-Wert danach nicht mehr vergleichbar (er würde durch
neue, echte Ursachenvielfalt ersetzt) — das ist beabsichtigt und kein
Problem, nur als Hinweis für den Vergleich in einer späteren Phase.

## Wie man diese Baseline reproduziert

```
node tests/baseline_analysis.js
```

Deterministisch: identischer Code + identische Seeds (0..29) liefern exakt
diese Zahlen. Nach jeder größeren Änderung an Wirtschaft/Bevölkerung/
Dynastie/Diplomatie/Militär erneut ausführen und mit den obigen Werten
vergleichen, um unbeabsichtigte Verschiebungen (im Sinne der bereits
mehrfach in `DEVELOPMENT.md` dokumentierten Kalibrierungs-Vorfälle, zuletzt
die Regierungsstil-Regression in Schritt 40) frühzeitig zu erkennen.
