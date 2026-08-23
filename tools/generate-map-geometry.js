// ============================================================
// §Phase-8C.1 "Strategic Map Redesign": Offline-Generator für die feste
// SVG-Kartengeometrie in js/map-geometry.js.
//
// WICHTIG: dies ist ein DEV-TOOL, kein Laufzeit-Code. Es wird von Hand
// ausgeführt (node tools/generate-map-geometry.js) und schreibt die
// statische Ausgabedatei js/map-geometry.js, die dann ganz normal über
// tools/build-bundle.js in index.html einfließt. Zur Laufzeit wird NIE
// neu berechnet -- keine Geometrie-Logik, kein Voronoi, kein Hash im
// Spiel selbst (§5: "feste definierte SVG-Pfade").
//
// Methode: ein vollständiges, begrenztes Voronoi-Diagramm (paarweise
// Halbebenen-Clipping, O(n^2), für 16+4 Punkte trivial schnell) über
// einen eigenen, von TERRITORIES.x/y UNABHÄNGIGEN Layout-Punktesatz
// (TERRITORIES/state.territories/adjacent bleiben unverändert die
// alleinige Gameplay-Wahrheit, §6 -- diese Datei bestimmt nur die
// Präsentation). Vier zusätzliche, nicht spielbare "Wildnis"-Stützpunkte
// (wild_nw/ne/se/sw) verhindern, dass geometrisch nahe, aber NICHT im
// Gameplay benachbarte Gebiete sich berühren (siehe Validierung unten) --
// sie werden als dekoratives, unbesiedeltes Gelände gerendert.
//
// Nach der Berechnung wird programmatisch validiert (§7 "Adjazenz ist
// heilig"): JEDES in TERRITORIES.adjacent deklarierte Paar MUSS eine
// echte gemeinsame Kante im berechneten Diagramm besitzen, und es darf
// KEINE ungewollte Kante zwischen unterschiedlichen Besitzern entstehen,
// die nicht entweder (a) deklariert oder (b) über einen Wildnis-Punkt
// vermittelt ist. Schlägt die Validierung fehl, bricht das Skript ab,
// statt eine potenziell falsche Karte auszugeben.
//
// Die Grenzen selbst sind bewusst leicht organisch (§49): jede Kante wird
// zu einer quadratischen Bezierkurve mit einem deterministisch
// (String-Hash, KEIN Math.random()/rnd(), §41/42) verschobenen
// Kontrollpunkt. Für eine GETEILTE Grenze zwischen zwei Gebieten wird der
// Kontrollpunkt aus einer richtungsunabhängigen (sortierten) Kanten-
// identität berechnet, damit beide angrenzenden Zellen exakt denselben
// Weltpunkt verwenden -- sonst würden die beiden Ränder minimal
// auseinanderklaffen.
// ============================================================
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const gamedataSrc = fs.readFileSync(path.join(ROOT, "data/gamedata.js"), "utf8");
const sandbox = {};
// eslint-disable-next-line no-new-func
new Function("module", "exports", gamedataSrc + "\nthis.TERRITORIES = TERRITORIES;")
  .call(sandbox, { exports: {} }, {});
const TERRITORIES = sandbox.TERRITORIES;
if (!Array.isArray(TERRITORIES) || TERRITORIES.length !== 16) {
  throw new Error("TERRITORIES aus data/gamedata.js konnte nicht geladen werden (erwartet 16 Gebiete).");
}
const TERRITORIES_ADJ = {};
for (const t of TERRITORIES) TERRITORIES_ADJ[t.id] = t.adjacent.slice();
const CAPITAL_IDS = new Set(TERRITORIES.filter(t => t.capital).map(t => t.id));

// ---------- eigenständiges Layout (0..1000), UNABHÄNGIG von TERRITORIES.x/y ----------
const POINTS = {
  p_hauptstadt: [500, 500], p_nord: [500, 340], p_ost: [660, 500], p_sued: [500, 660],
  m_hauptstadt: [500, 120], m_sued: [500, 260], m_ost: [660, 160], m_west: [300, 120],
  r_hauptstadt: [860, 500], r_west: [700, 500], r_nord: [760, 260], r_sued: [760, 740],
  b_hauptstadt: [500, 880], b_nord: [500, 740], b_ost: [660, 840], b_west: [300, 880],
  wild_nw: [330, 320], wild_ne: [650, 300], wild_se: [650, 700], wild_sw: [330, 680],
};
const WILD_IDS = ["wild_nw", "wild_ne", "wild_se", "wild_sw"];
for (const id in TERRITORIES_ADJ) {
  if (!POINTS[id]) throw new Error(`Kein Layout-Punkt für neues Gebiet "${id}" definiert -- POINTS ergänzen.`);
}
const BOUNDS = { minX: 40, minY: 30, maxX: 960, maxY: 970 };

function boundsPolygon() {
  return [[BOUNDS.minX, BOUNDS.minY], [BOUNDS.maxX, BOUNDS.minY], [BOUNDS.maxX, BOUNDS.maxY], [BOUNDS.minX, BOUNDS.maxY]];
}
function clip(poly, M, normal) {
  const eps = 1e-6, out = [], n = poly.length;
  for (let i = 0; i < n; i++) {
    const cur = poly[i], prev = poly[(i - 1 + n) % n];
    const dCur = (cur[0] - M[0]) * normal[0] + (cur[1] - M[1]) * normal[1];
    const dPrev = (prev[0] - M[0]) * normal[0] + (prev[1] - M[1]) * normal[1];
    const curIn = dCur <= eps, prevIn = dPrev <= eps;
    if (curIn !== prevIn) { const t = dPrev / (dPrev - dCur); out.push([prev[0] + t * (cur[0] - prev[0]), prev[1] + t * (cur[1] - prev[1])]); }
    if (curIn) out.push(cur);
  }
  return out;
}
function voronoiCell(id) {
  let poly = boundsPolygon();
  const [sx, sy] = POINTS[id];
  for (const oid in POINTS) {
    if (oid === id) continue;
    const [ox, oy] = POINTS[oid];
    poly = clip(poly, [(sx + ox) / 2, (sy + oy) / 2], [ox - sx, oy - sy]);
    if (poly.length === 0) break;
  }
  return poly;
}
function pointOnLine(p, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1], len2 = dx * dx + dy * dy;
  if (len2 < 1e-9) return Infinity;
  const t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2;
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}
function edgeOwnerFor(id, v1, v2) {
  const [sx, sy] = POINTS[id];
  for (const oid in POINTS) {
    if (oid === id) continue;
    const [ox, oy] = POINTS[oid];
    const M = [(sx + ox) / 2, (sy + oy) / 2];
    const nx = oy - sy, ny = -(ox - sx);
    const a = [M[0] - nx, M[1] - ny], b = [M[0] + nx, M[1] + ny];
    if (pointOnLine(v1, a, b) < 0.5 && pointOnLine(v2, a, b) < 0.5) return oid;
  }
  return null;
}
// deterministischer String-Hash -> [0,1) -- KEIN Math.random()/rnd() (§41/42)
function hash01(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return ((h >>> 0) % 100000) / 100000;
}

const cells = {};
for (const id in POINTS) cells[id] = voronoiCell(id);

// ---------- Validierung (§7 "Adjazenz ist heilig") ----------
function geometricNeighbors() {
  const result = {};
  for (const id in cells) {
    const poly = cells[id], [sx, sy] = POINTS[id];
    const neighbors = new Set();
    for (const oid in POINTS) {
      if (oid === id) continue;
      const [ox, oy] = POINTS[oid];
      const M = [(sx + ox) / 2, (sy + oy) / 2];
      const nx = oy - sy, ny = -(ox - sx);
      let onLine = 0;
      for (const p of poly) if (pointOnLine(p, [M[0] - nx, M[1] - ny], [M[0] + nx, M[1] + ny]) < 0.5) onLine++;
      if (onLine >= 2) neighbors.add(oid);
    }
    result[id] = neighbors;
  }
  return result;
}
const geomNeighbors = geometricNeighbors();
let ok = true;
for (const id in TERRITORIES_ADJ) {
  for (const adj of TERRITORIES_ADJ[id]) {
    if (!geomNeighbors[id] || !geomNeighbors[id].has(adj)) { console.error(`FEHLENDE GRENZE: ${id} <-> ${adj} (im Gameplay benachbart, geometrisch aber nicht)`); ok = false; }
  }
}
const ownerOf = id => id.split("_")[0];
for (const id in geomNeighbors) {
  if (!TERRITORIES_ADJ[id]) continue; // Wildnis-Punkte sind keine Gameplay-Gebiete
  for (const adj of geomNeighbors[id]) {
    if (TERRITORIES_ADJ[id].includes(adj)) continue;
    if (WILD_IDS.includes(adj)) continue;
    if (ownerOf(id) === ownerOf(adj)) continue; // selber Besitzer: harmlose interne Provinzgrenze
    console.error(`UNGEWOLLTE GRENZE ZWISCHEN VERSCHIEDENEN BESITZERN: ${id} <-> ${adj} (nicht im Gameplay benachbart)`);
    ok = false;
  }
}
if (!ok) { console.error("\nVALIDIERUNG FEHLGESCHLAGEN -- Layout-Punkte in POINTS anpassen und erneut ausführen."); process.exit(1); }
console.log("Validierung OK: alle deklarierten Adjazenzen sind echte geometrische Nachbarn, keine ungewollten Grenzen zwischen verschiedenen Besitzern.");

// ---------- organische, geteilte-Kanten-sichere Pfade ----------
function canonicalEdge(v1, v2) {
  const r = p => [Math.round(p[0] * 10) / 10, Math.round(p[1] * 10) / 10];
  const a = r(v1), b = r(v2);
  const [lo, hi] = (a[0] - b[0] || a[1] - b[1]) <= 0 ? [a, b] : [b, a];
  return { lo, hi };
}
function buildPath(id) {
  const poly = cells[id];
  const n = poly.length;
  const segs = [];
  for (let i = 0; i < n; i++) {
    const v1 = poly[i], v2 = poly[(i + 1) % n];
    const owner = edgeOwnerFor(id, v1, v2);
    const { lo, hi } = canonicalEdge(v1, v2);
    const key = (owner ? [id, owner].sort().join("|") : id + ":bounds") + ":" + lo.join(",") + "|" + hi.join(",");
    const h = hash01(key) - 0.5; // deterministisch, identisch auf beiden Seiten einer geteilten Grenze
    const dx = hi[0] - lo[0], dy = hi[1] - lo[1];
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len, ny = dx / len; // kanonische, richtungsunabhängige Normale
    const mag = Math.min(16, len * 0.12) * h * 2;
    segs.push({ v2, mid: [(lo[0] + hi[0]) / 2 + nx * mag, (lo[1] + hi[1]) / 2 + ny * mag] });
  }
  let d = `M ${poly[0][0].toFixed(1)} ${poly[0][1].toFixed(1)} `;
  for (const s of segs) d += `Q ${s.mid[0].toFixed(1)} ${s.mid[1].toFixed(1)} ${s.v2[0].toFixed(1)} ${s.v2[1].toFixed(1)} `;
  return d + "Z";
}

const MAP_GEOMETRY = {};
for (const id in TERRITORIES_ADJ) {
  const poly = cells[id];
  const cx = poly.reduce((s, p) => s + p[0], 0) / poly.length;
  const cy = poly.reduce((s, p) => s + p[1], 0) / poly.length;
  const [px, py] = POINTS[id];
  const isCapital = CAPITAL_IDS.has(id);
  MAP_GEOMETRY[id] = {
    path: buildPath(id),
    labelX: Math.round(isCapital ? px : cx), labelY: Math.round(isCapital ? py + 22 : cy),
    capitalX: Math.round(px), capitalY: Math.round(py - 16),
    centroidX: Math.round(cx), centroidY: Math.round(cy),
  };
}
const WILD_GEOMETRY = {};
for (const id of WILD_IDS) WILD_GEOMETRY[id] = { path: buildPath(id) };

function fmtGeom(obj) {
  return Object.entries(obj).map(([id, g]) => {
    const fields = Object.entries(g).map(([k, v]) => `${k}: ${typeof v === "string" ? JSON.stringify(v) : v}`).join(", ");
    return `  ${id}: { ${fields} },`;
  }).join("\n");
}

const out = `// ============================================================
// §Phase-8C.1 "Strategic Map Redesign": feste, statische SVG-Kartengeometrie.
// AUTOGENERIERT von tools/generate-map-geometry.js -- NICHT von Hand
// bearbeiten. Bei Änderungen an TERRITORIES (neue Gebiete/Adjazenzen)
// erneut ausführen: node tools/generate-map-geometry.js
//
// Reine Präsentationsdaten (§5/6): TERRITORIES/state.territories/
// adjacent bleiben unverändert die alleinige Gameplay-Wahrheit. Diese
// Datei bestimmt nur WO und in WELCHER Form auf der Karte gezeichnet
// wird. Jede deklarierte TERRITORIES.adjacent-Paarung besitzt eine echte
// gemeinsame Kante im Diagramm (bei Generierung validiert, §7).
// ============================================================
const MAP_VIEWBOX = "0 0 1000 1000";
const MAP_GEOMETRY = {
${fmtGeom(MAP_GEOMETRY)}
};
// Dekoratives, unbesiedeltes Gelände (Wald/Gebirge) -- KEIN Territorium,
// nicht klickbar, kein Besitzer, kein Label. Füllt geometrisch den
// Zwischenraum, den weit entfernte, im Gameplay NICHT benachbarte Gebiete
// sonst sich teilen würden (siehe Validierung im Generator).
const MAP_WILD_GEOMETRY = {
${fmtGeom(WILD_GEOMETRY)}
};
`;

fs.writeFileSync(path.join(ROOT, "js/map-geometry.js"), out);
console.log("js/map-geometry.js geschrieben.");
