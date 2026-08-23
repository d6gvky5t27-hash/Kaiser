// ============================================================
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
  p_hauptstadt: { path: "M 404.4 580.0 Q 355.9 546.6 319.7 500.0 Q 352.6 450.0 404.4 420.0 Q 492.2 426.3 580.0 420.0 Q 586.4 500.0 580.0 580.0 Q 492.2 583.3 404.4 580.0 Z", labelX: 500, labelY: 522, capitalX: 500, capitalY: 484, centroidX: 458, centroidY: 500 },
  p_nord: { path: "M 418.5 300.0 Q 494.1 309.3 569.7 300.0 Q 583.3 351.5 597.1 402.9 Q 588.0 410.9 580.0 420.0 Q 492.2 426.3 404.4 420.0 Q 399.2 358.6 418.5 300.0 Z", labelX: 514, labelY: 369, capitalX: 500, capitalY: 324, centroidX: 514, centroidY: 369 },
  p_ost: { path: "M 680.0 398.8 Q 683.7 500.0 680.0 601.3 Q 638.8 593.4 597.1 597.1 Q 589.6 587.5 580.0 580.0 Q 586.4 500.0 580.0 420.0 Q 588.0 410.9 597.1 402.9 Q 638.6 402.8 680.0 398.8 Z", labelX: 619, labelY: 500, capitalX: 660, capitalY: 484, centroidX: 619, centroidY: 500 },
  p_sued: { path: "M 569.7 700.0 Q 494.1 705.5 418.5 700.0 Q 412.0 639.9 404.4 580.0 Q 492.2 583.3 580.0 580.0 Q 589.6 587.5 597.1 597.1 Q 587.3 649.6 569.7 700.0 Z", labelX: 514, labelY: 631, capitalX: 500, capitalY: 644, centroidX: 514, centroidY: 631 },
  m_hauptstadt: { path: "M 567.5 190.0 Q 483.8 179.9 400.0 190.0 Q 398.8 110.0 400.0 30.0 Q 503.8 23.7 607.5 30.0 Q 587.5 110.0 567.5 190.0 Z", labelX: 500, labelY: 142, capitalX: 500, capitalY: 104, centroidX: 494, centroidY: 110 },
  m_sued: { path: "M 386.5 209.3 Q 394.8 200.7 400.0 190.0 Q 483.8 179.9 567.5 190.0 Q 574.4 210.3 589.6 225.3 Q 571.3 260.4 569.7 300.0 Q 494.1 309.3 418.5 300.0 Q 395.5 257.1 386.5 209.3 Z", labelX: 489, labelY: 236, capitalX: 500, capitalY: 244, centroidX: 489, centroidY: 236 },
  m_ost: { path: "M 687.7 232.3 Q 637.9 238.6 589.6 225.3 Q 574.4 210.3 567.5 190.0 Q 587.5 110.0 607.5 30.0 Q 748.8 22.5 890.0 30.0 Q 788.5 130.8 687.7 232.3 Z", labelX: 668, labelY: 142, capitalX: 660, capitalY: 144, centroidX: 668, centroidY: 142 },
  m_west: { path: "M 400.0 190.0 Q 394.8 200.7 386.5 209.3 Q 213.3 235.6 40.0 261.3 Q 34.4 145.7 40.0 30.0 Q 220.0 30.9 400.0 30.0 Q 398.8 110.0 400.0 190.0 Z", labelX: 253, labelY: 144, capitalX: 300, capitalY: 104, centroidX: 253, centroidY: 144 },
  r_hauptstadt: { path: "M 780.0 607.5 Q 764.7 500.0 780.0 392.5 Q 873.9 364.4 960.0 317.5 Q 961.6 500.0 960.0 682.5 Q 867.5 651.0 780.0 607.5 Z", labelX: 860, labelY: 522, capitalX: 860, capitalY: 484, centroidX: 870, centroidY: 500 },
  r_west: { path: "M 742.5 383.1 Q 760.7 390.1 780.0 392.5 Q 764.7 500.0 780.0 607.5 Q 761.6 613.7 742.5 616.9 Q 709.7 615.2 680.0 601.3 Q 683.7 500.0 680.0 398.8 Q 709.6 384.2 742.5 383.1 Z", labelX: 734, labelY: 500, capitalX: 700, capitalY: 484, centroidX: 734, centroidY: 500 },
  r_nord: { path: "M 780.0 392.5 Q 760.7 390.1 742.5 383.1 Q 720.1 305.9 687.7 232.3 Q 788.5 130.8 890.0 30.0 Q 925.0 28.5 960.0 30.0 Q 960.9 173.8 960.0 317.5 Q 873.9 364.4 780.0 392.5 Z", labelX: 837, labelY: 231, capitalX: 760, capitalY: 244, centroidX: 837, centroidY: 231 },
  r_sued: { path: "M 687.7 767.7 Q 727.7 696.9 742.5 616.9 Q 761.6 613.7 780.0 607.5 Q 867.5 651.0 960.0 682.5 Q 961.9 826.3 960.0 970.0 Q 925.0 975.5 890.0 970.0 Q 795.2 862.5 687.7 767.7 Z", labelX: 837, labelY: 769, capitalX: 760, capitalY: 724, centroidX: 837, centroidY: 769 },
  b_hauptstadt: { path: "M 400.0 810.0 Q 483.8 803.0 567.5 810.0 Q 585.4 890.5 607.5 970.0 Q 503.8 961.6 400.0 970.0 Q 408.9 890.0 400.0 810.0 Z", labelX: 500, labelY: 902, capitalX: 500, capitalY: 864, centroidX: 494, centroidY: 890 },
  b_nord: { path: "M 589.6 774.7 Q 579.0 792.7 567.5 810.0 Q 483.8 803.0 400.0 810.0 Q 394.4 799.6 386.5 790.7 Q 401.6 745.0 418.5 700.0 Q 494.1 705.5 569.7 700.0 Q 581.3 736.9 589.6 774.7 Z", labelX: 489, labelY: 764, capitalX: 500, capitalY: 724, centroidX: 489, centroidY: 764 },
  b_ost: { path: "M 567.5 810.0 Q 579.0 792.7 589.6 774.7 Q 639.3 779.7 687.7 767.7 Q 795.2 862.5 890.0 970.0 Q 748.8 983.3 607.5 970.0 Q 585.4 890.5 567.5 810.0 Z", labelX: 668, labelY: 858, capitalX: 660, capitalY: 824, centroidX: 668, centroidY: 858 },
  b_west: { path: "M 40.0 738.8 Q 214.3 757.9 386.5 790.7 Q 394.4 799.6 400.0 810.0 Q 408.9 890.0 400.0 970.0 Q 220.0 974.9 40.0 970.0 Q 27.3 854.4 40.0 738.8 Z", labelX: 253, labelY: 856, capitalX: 300, capitalY: 864, centroidX: 253, centroidY: 856 },
};
// Dekoratives, unbesiedeltes Gelände (Wald/Gebirge) -- KEIN Territorium,
// nicht klickbar, kein Besitzer, kein Label. Füllt geometrisch den
// Zwischenraum, den weit entfernte, im Gameplay NICHT benachbarte Gebiete
// sonst sich teilen würden (siehe Validierung im Generator).
const MAP_WILD_GEOMETRY = {
  wild_nw: { path: "M 386.5 209.3 Q 395.5 257.1 418.5 300.0 Q 399.2 358.6 404.4 420.0 Q 352.6 450.0 319.7 500.0 Q 179.8 507.1 40.0 500.0 Q 49.4 380.6 40.0 261.2 Q 212.4 229.3 386.5 209.3 Z" },
  wild_ne: { path: "M 742.5 383.1 Q 709.6 384.2 680.0 398.8 Q 638.6 402.8 597.1 402.9 Q 583.3 351.5 569.7 300.0 Q 571.3 260.4 589.6 225.3 Q 637.9 238.6 687.7 232.3 Q 720.1 305.9 742.5 383.1 Z" },
  wild_se: { path: "M 589.6 774.7 Q 581.3 736.9 569.7 700.0 Q 587.3 649.6 597.1 597.1 Q 638.8 593.4 680.0 601.3 Q 709.7 615.2 742.5 616.9 Q 727.7 696.9 687.7 767.7 Q 639.3 779.7 589.6 774.7 Z" },
  wild_sw: { path: "M 40.0 738.8 Q 52.6 619.4 40.0 500.0 Q 179.8 507.1 319.7 500.0 Q 355.9 546.6 404.4 580.0 Q 412.0 639.9 418.5 700.0 Q 401.6 745.0 386.5 790.7 Q 214.3 757.9 40.0 738.8 Z" },
};
