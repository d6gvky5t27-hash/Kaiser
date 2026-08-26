// ============================================================
// §Phase-8C.2 "Complete Map Art Redesign": handgestaltete SVG-Karten-
// geometrie -- ERSETZT den bisherigen Voronoi-Ansatz (tools/generate-
// map-geometry.js, Phase 8C.1) vollständig als Quelle der finalen
// Kartenform (§37: "darf nicht länger die visuelle Form der finalen
// Karte bestimmen"). Dies ist ein DEV-TOOL, kein Laufzeit-Code -- von
// Hand ausgeführt (node tools/build-map-art.js), schreibt die statische
// Ausgabedatei js/map-geometry.js.
//
// Methode (§6/34/48): 16 Territorien werden aus 17 HANDPLATZIERTEN
// geteilten Grenzsegmenten (SEG, je eine Punktliste mit bewusst
// gewähltem, unregelmäßigem Verlauf -- Fluss-Grenzen großzügig
// geschwungen, übrige Grenzen moderat organisch) plus eigenen frei
// gezeichneten Außenkurven zusammengesetzt. KEIN Voronoi, KEIN
// Math.random()/rnd() (§42) -- jeder Punkt ist eine bewusste
// Design-Entscheidung.
//
// Namensableitung aus bereits vorhandenen Territoriumsnamen (§46/47):
// "Rheinfeld" (ai2) liegt am namensgebenden Fluss, der zugleich die
// einzigen drei politischen Grenzen dieses Reiches zu seinen Nachbarn
// bildet (m_ost|r_nord, p_ost|r_west, r_sued|b_ost) -- an allen drei
// Übergängen liegt je eine Brücke. "Bergheim" (ai3) liegt vor einem
// südlichen Gebirge. Der unbesiedelte Westrand der Karte (dort existiert
// im Gameplay ohnehin kein weiterer Nachbar -- m_west/b_west sind
// Sackgassen) wird zur "Westmark"-Wildnis (§36: echte benannte
// Landschaft statt technischer Lückenfüller).
//
// Konstruktion pro Territorium: eine Punktwolke (geteilte Segmentpunkte
// + frei gewählte Außenpunkte) wird nach Winkel um einen bewusst
// gewählten Mittelpunkt sortiert (garantiert ein einfaches, nicht
// selbst-überschneidendes Polygon, solange die Form grob sternförmig
// bleibt) und über sanfte quadratische Bezierkurven zu einem SVG-Pfad
// verbunden.
// ============================================================
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const gamedataSrc = fs.readFileSync(path.join(ROOT, "data/gamedata.js"), "utf8");
const sandbox = {};
// eslint-disable-next-line no-new-func
new Function("module", "exports", gamedataSrc + "\nthis.TERRITORIES = TERRITORIES;").call(sandbox, { exports: {} }, {});
const TERRITORIES = sandbox.TERRITORIES;
if (!Array.isArray(TERRITORIES) || TERRITORIES.length !== 16) {
  throw new Error("TERRITORIES aus data/gamedata.js konnte nicht geladen werden (erwartet 16 Gebiete).");
}
const TERRITORIES_ADJ = {};
for (const t of TERRITORIES) TERRITORIES_ADJ[t.id] = t.adjacent.slice();

function smoothPath(points) {
  let d = `M ${points[0][0].toFixed(1)} ${points[0][1].toFixed(1)} `;
  const n = points.length;
  for (let i = 1; i <= n; i++) {
    const p0 = points[(i - 1) % n], p1 = points[i % n];
    const mx = (p0[0] + p1[0]) / 2, my = (p0[1] + p1[1]) / 2;
    d += `Q ${p0[0].toFixed(1)} ${p0[1].toFixed(1)} ${mx.toFixed(1)} ${my.toFixed(1)} `;
  }
  return d + "Z";
}
function openPath(points) {
  let d = `M ${points[0][0].toFixed(1)} ${points[0][1].toFixed(1)} `;
  for (let i = 1; i < points.length; i++) {
    const p0 = points[i - 1], p1 = points[i];
    const mx = (p0[0] + p1[0]) / 2, my = (p0[1] + p1[1]) / 2;
    d += `Q ${p0[0].toFixed(1)} ${p0[1].toFixed(1)} ${mx.toFixed(1)} ${my.toFixed(1)} `;
  }
  return d;
}
function rev(seg) { return seg.slice().reverse(); }
function sortByAngle(points, cx, cy) {
  return points.slice().sort((a, b) => Math.atan2(a[1] - cy, a[0] - cx) - Math.atan2(b[1] - cy, b[0] - cx));
}
function dedupe(points) {
  const out = [];
  for (const p of points) if (!out.some(q => Math.hypot(q[0] - p[0], q[1] - p[1]) < 0.5)) out.push(p);
  return out;
}

// ---------- 17 handplatzierte geteilte Grenzsegmente ----------
// Fluss-Grenzen (Kommentar "Rhein"): grosszuegig geschwungen.
// Y-Baender Nord->Sued (grosszuegig getrennt, keine Ueberlappung):
// m_hauptstadt=85 | mH_mS~230 | m_sued=355 | pN_mS~470 | p_nord=600
// pH_pN~730 | p_hauptstadt=860 | pH_pS~990 | p_sued=1120
// pS_bN~1230 | b_nord=1350 | bH_bN~1470 | b_hauptstadt=1590
const SEG = {
  pH_pN: [[280,738],[345,700],[415,732],[485,696],[555,726]],
  pH_pO: [[605,700],[575,780],[615,860],[570,940],[600,1000]],
  pH_pS: [[280,982],[345,1020],[410,986],[475,1024],[550,992]],
  pN_mS: [[280,478],[345,440],[415,472],[485,436],[555,466]],
  pO_rW: [[830,595],[792,700],[834,800],[790,900],[830,1005]], // Rhein
  pS_bN: [[280,1222],[345,1260],[415,1226],[485,1264],[555,1234]],
  mH_mS: [[280,238],[345,200],[415,232],[485,196],[555,226]],
  mH_mO: [[605,120],[578,185],[615,250],[582,300]],
  mH_mW: [[265,80],[295,140],[258,200],[290,250],[262,285]],
  mO_rN: [[830,120],[792,190],[836,250],[790,310],[828,365]], // Rhein Oberlauf
  rH_rW: [[955,595],[918,700],[958,800],[915,900],[956,1005]],
  rH_rN: [[1020,540],[972,480],[1022,420],[980,362]],
  rH_rS: [[1020,1080],[972,1140],[1022,1200],[980,1258]],
  rS_bO: [[830,1310],[790,1380],[835,1445],[788,1500],[830,1555]], // Rhein Unterlauf
  bH_bN: [[280,1462],[345,1500],[415,1466],[485,1504],[555,1472]],
  bH_bO: [[605,1420],[575,1490],[620,1545],[576,1600],[608,1645]],
  bH_bW: [[265,1400],[295,1450],[258,1500],[292,1545],[262,1580]],
};

// Strukturprüfung: jedes deklarierte Adjazenzpaar MUSS genau eines
// dieser 17 Segmente exakt gemeinsam verwenden (siehe TERR unten).
const SEG_OWNERS = {
  pH_pN: ["p_hauptstadt","p_nord"], pH_pO: ["p_hauptstadt","p_ost"], pH_pS: ["p_hauptstadt","p_sued"],
  pN_mS: ["p_nord","m_sued"], pO_rW: ["p_ost","r_west"], pS_bN: ["p_sued","b_nord"],
  mH_mS: ["m_hauptstadt","m_sued"], mH_mO: ["m_hauptstadt","m_ost"], mH_mW: ["m_hauptstadt","m_west"],
  mO_rN: ["m_ost","r_nord"], rH_rW: ["r_hauptstadt","r_west"], rH_rN: ["r_hauptstadt","r_nord"],
  rH_rS: ["r_hauptstadt","r_sued"], rS_bO: ["r_sued","b_ost"],
  bH_bN: ["b_hauptstadt","b_nord"], bH_bO: ["b_hauptstadt","b_ost"], bH_bW: ["b_hauptstadt","b_west"],
};
let structOk = true;
for (const id in TERRITORIES_ADJ) {
  for (const adj of TERRITORIES_ADJ[id]) {
    const found = Object.values(SEG_OWNERS).some(([a,b]) => (a===id&&b===adj)||(a===adj&&b===id));
    if (!found) { console.error(`FEHLENDES SEGMENT: ${id} <-> ${adj} hat keine gemeinsame Grenzdefinition in SEG.`); structOk = false; }
  }
}
for (const key in SEG_OWNERS) {
  const [a,b] = SEG_OWNERS[key];
  if (!TERRITORIES_ADJ[a] || !TERRITORIES_ADJ[a].includes(b)) { console.error(`UEBERFLUESSIGES SEGMENT: ${key} (${a}|${b}) ist nicht in TERRITORIES.adjacent deklariert.`); structOk = false; }
}
if (!structOk) { console.error("\nVALIDIERUNG FEHLGESCHLAGEN."); process.exit(1); }
console.log("Strukturvalidierung OK: alle 17 deklarierten Adjazenzen besitzen genau ein gemeinsames Grenzsegment, keine ueberfluessigen Segmente.");

// ---------- Territorien: Mittelpunkt + Punktwolke ----------
const T = {};
T.p_hauptstadt = { c: [415,860], pts: [ ...SEG.pH_pN, ...SEG.pH_pO, ...SEG.pH_pS, [175,940],[140,860],[178,780] ] };
T.p_nord = { c: [415,600], pts: [ ...SEG.pN_mS, ...rev(SEG.pH_pN), [610,510],[650,600],[615,690], [225,660],[195,590],[228,510] ] };
T.p_ost = { c: [640,850], pts: [ ...rev(SEG.pH_pO), ...SEG.pO_rW, [650,640],[700,600], [700,1030],[655,1010] ] };
T.p_sued = { c: [415,1120], pts: [ ...rev(SEG.pH_pS), ...rev(SEG.pS_bN), [610,1050],[650,1120],[612,1200], [220,1200],[192,1120],[222,1045] ] };

T.m_hauptstadt = { c: [415,85], pts: [ ...SEG.mH_mS, ...SEG.mH_mO, ...rev(SEG.mH_mW), [560,10],[500,-25],[440,-8],[380,-28],[320,-8],[300,20] ] };
T.m_sued = { c: [415,355], pts: [ ...rev(SEG.pN_mS), ...rev(SEG.mH_mS), [635,285],[650,355],[615,415], [215,415],[190,355],[218,300] ] };
T.m_ost = { c: [720,240], pts: [ ...rev(SEG.mH_mO), ...SEG.mO_rN, [650,60],[720,20],[790,10],[830,60], [860,240],[790,205] ] };
T.m_west = { c: [175,155], pts: [ ...SEG.mH_mW, [220,15],[150,-10],[70,20],[10,80],[5,155], [40,225],[100,265],[165,255] ] };

T.r_hauptstadt = { c: [1085,860], pts: [ ...rev(SEG.rH_rW), ...rev(SEG.rH_rN), ...rev(SEG.rH_rS), [1050,300],[1120,340],[1175,430],[1195,540], [1185,860], [1195,1180],[1175,1300],[1120,1390],[1050,1430] ] };
T.r_west = { c: [878,800], pts: [ ...rev(SEG.pO_rW), ...SEG.rH_rW ] };
T.r_nord = { c: [935,300], pts: [ ...rev(SEG.mO_rN), ...SEG.rH_rN, [870,40],[940,-5],[1010,10],[1050,90],[1010,200] ] };
T.r_sued = { c: [935,1410], pts: [ ...rev(SEG.rS_bO), ...SEG.rH_rS, [870,1650],[940,1690],[1010,1670],[1050,1590],[1010,1480] ] };

T.b_hauptstadt = { c: [415,1590], pts: [ ...rev(SEG.bH_bN), ...SEG.bH_bO, ...SEG.bH_bW, [575,1650],[500,1680],[440,1662],[380,1682],[320,1662],[295,1630] ] };
T.b_nord = { c: [415,1350], pts: [ ...SEG.pS_bN, ...SEG.bH_bN, [610,1290],[650,1350],[615,1415], [215,1415],[190,1350],[218,1290] ] };
T.b_ost = { c: [640,1560], pts: [ ...rev(SEG.bH_bO), ...rev(SEG.rS_bO), [700,1400],[655,1380], [700,1660],[650,1690],[605,1670] ] };
T.b_west = { c: [175,1560], pts: [ ...rev(SEG.bH_bW), [220,1670],[150,1695],[70,1665],[10,1600],[5,1520], [40,1450],[100,1415],[165,1425] ] };

// ---------- Hauptstadt-/Label-Anker (handplatziert, siehe §15/16/21/22) ----------
const CAPITAL_ANCHOR = {
  p_hauptstadt: [390,830], m_hauptstadt: [415,80], r_hauptstadt: [1085,860], b_hauptstadt: [415,1590],
};
const CAPITAL_IDS = new Set(Object.keys(CAPITAL_ANCHOR));

const MAP_GEOMETRY = {};
for (const id in T) {
  const [cx, cy] = T[id].c;
  const pts = dedupe(sortByAngle(T[id].pts, cx, cy));
  const isCapital = CAPITAL_IDS.has(id);
  const [ax, ay] = isCapital ? CAPITAL_ANCHOR[id] : [cx, cy];
  MAP_GEOMETRY[id] = {
    path: smoothPath(pts),
    labelX: Math.round(ax), labelY: Math.round(isCapital ? ay + 46 : ay),
    capitalX: Math.round(ax), capitalY: Math.round(ay - 18),
    centroidX: Math.round(cx), centroidY: Math.round(cy),
  };
}

// ---------- Westmark-Wildnis (§36: echte benannte Landschaft statt Luecken-Polygon) ----------
const WILD_PTS = dedupe([
  [-40,-100],[280,-90],[260,60],[300,180],[255,340],[300,470],
  [260,620],[300,760],[258,900],[300,1050],[260,1200],[295,1350],
  [255,1500],[290,1650],[240,1780],[-40,1770],
]);
const MAP_WILD_GEOMETRY = { westmark: { path: smoothPath(WILD_PTS) } };

// ---------- Der Rhein (dekorativ, folgt den drei Fluss-Grenzsegmenten) ----------
const RIVER_PTS = [
  [905,-90], ...SEG.mO_rN, [858,478],
  ...SEG.pO_rW, [858,1150],
  ...SEG.rS_bO, [858,1680],
];
const RIVER_PATH = openPath(RIVER_PTS);

// ---------- Bergheim-Gebirge (dekorativ, §11/48) ----------
const MOUNTAIN_ANCHORS = [ [330,1660],[400,1700],[470,1665],[540,1690],[300,1730] ];

const out = `// ============================================================
// §Phase-8C.2 "Complete Map Art Redesign": handgestaltete, statische
// SVG-Kartengeometrie. AUTOGENERIERT von tools/build-map-art.js -- NICHT
// von Hand bearbeiten, dort aendern und neu ausfuehren:
// node tools/build-map-art.js
//
// ERSETZT den fruehreren Voronoi-Ansatz (Phase 8C.1,
// tools/generate-map-geometry.js) als Quelle der finalen Kartenform.
// Reine Praesentationsdaten (§6): TERRITORIES/state.territories/adjacent
// bleiben unveraendert die alleinige Gameplay-Wahrheit. Jede deklarierte
// TERRITORIES.adjacent-Paarung nutzt strukturell dasselbe Grenzsegment
// (bei Generierung geprueft, siehe SEG_OWNERS im Generator).
// ============================================================
const MAP_VIEWBOX = "-60 -100 1340 1900";
const MAP_GEOMETRY = {
${Object.entries(MAP_GEOMETRY).map(([id,g]) => `  ${id}: { path: ${JSON.stringify(g.path)}, labelX: ${g.labelX}, labelY: ${g.labelY}, capitalX: ${g.capitalX}, capitalY: ${g.capitalY}, centroidX: ${g.centroidX}, centroidY: ${g.centroidY} },`).join("\n")}
};
// Westmark: unbesiedelte Wald-/Huegelwildnis im Westen (§36) -- KEIN
// Territorium, nicht klickbar, kein Besitzer. Erklaert erzaehlerisch,
// warum es im Gameplay keinen westlichen Nachbarn gibt.
const MAP_WILD_GEOMETRY = {
  westmark: { path: ${JSON.stringify(MAP_WILD_GEOMETRY.westmark.path)} },
};
// Der Rhein (§9/10): rein dekorativ, folgt den drei Grenzsegmenten, die
// zugleich Rheinfelds einzige drei Grenzen zu seinen Nachbarn bilden.
const MAP_RIVER_PATH = ${JSON.stringify(RIVER_PATH)};
// Bergheim-Gebirge (§11): rein dekorative Ankerpunkte fuer kleine
// Bergketten-Symbole suedwestlich von Bergheim-Stadt.
const MAP_MOUNTAIN_ANCHORS = ${JSON.stringify(MOUNTAIN_ANCHORS)};
`;

fs.writeFileSync(path.join(ROOT, "js/map-geometry.js"), out);
console.log("js/map-geometry.js geschrieben (handgestaltete Geometrie).");
