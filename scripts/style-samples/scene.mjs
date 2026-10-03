// One studio scene, described once as shapes with colour ROLES, so each style
// renders the same drawing in its own medium (flat vector, coloured sketch,
// watercolour). Coordinates are for a 1280 x 720 canvas - the production
// article image size.

export const W = 1280;
export const H = 720;

/** Colour roles -> flat illustration palette (limited, no gradients). */
export const PALETTE = {
  wall: "#F4ECE1",
  wallShade: "#EADFD0",
  floor: "#D8A56E",
  floorLine: "#C48F58",
  rug: "#2F6F73",
  rugLine: "#E9D9C2",
  sky: "#BFE2F0",
  skyLight: "#D9EEF6",
  cloud: "#FFFFFF",
  treeDark: "#3F8A5A",
  treeLight: "#68B276",
  building: "#9FC3CF",
  frame: "#FFFFFF",
  frameShade: "#E2D6C6",
  curtain: "#E77F4C",
  curtainShade: "#CF6A3A",
  wood: "#C98D55",
  woodLight: "#DEAB72",
  woodDark: "#8A5A34",
  navy: "#26344F",
  navyLight: "#3B4D6E",
  orange: "#EE7A3B",
  orangeDark: "#D4612A",
  teal: "#2F8C86",
  mustard: "#F2B640",
  paper: "#FFFDF8",
  paperLine: "#D9D0C2",
  leaf: "#3E9A5E",
  leafLight: "#5CB874",
  leafDark: "#2E7748",
  pot: "#E48B5A",
  potDark: "#C9703F",
  metal: "#D9DDE2",
  metalDark: "#9AA3AE",
  light: "#FFF1C7",
  screen: "#26344F",
  white: "#FFFFFF",
  ink: "#3A2E26",
};

const rect = (x, y, w, h, role, extra = {}) => ({ el: "rect", a: { x, y, width: w, height: h, ...extra }, role });
const path = (d, role, extra = {}) => ({ el: "path", a: { d, ...extra }, role });
const circle = (cx, cy, r, role, extra = {}) => ({ el: "circle", a: { cx, cy, r, ...extra }, role });
const ellipse = (cx, cy, rx, ry, role, extra = {}) => ({ el: "ellipse", a: { cx, cy, rx, ry, ...extra }, role });
/** A line: stroke only, in the ink role unless given. */
const line = (d, role = "ink", width = 3, extra = {}) => ({ el: "path", a: { d, ...extra }, role, line: true, width });

/** Children drawn inside a clip rectangle (the view through a window). */
const clipped = (x, y, w, h, children) => ({ el: "g", clip: { x, y, width: w, height: h }, children });

/**
 * An architect lamp: base on the desk, two arms, and a shade whose OPENING
 * faces the target, with the light falling from that opening onto it.
 */
function lamp({ base, elbow, joint, target, spread = 90, size = 1, light = 0.5 }) {
  const out = [];
  const [bx, by] = base, [ex, ey] = elbow, [jx, jy] = joint, [tx, ty] = target;
  const dx = tx - jx, dy = ty - jy;
  const n = Math.hypot(dx, dy);
  const ux = dx / n, uy = dy / n, px = -uy, py = ux;
  const L = 64 * size, nw = 10 * size, ww = 34 * size;
  const P = (a, b) => `${a.toFixed(1)} ${b.toFixed(1)}`;
  const n1 = [jx + ux * 6 * size + px * nw, jy + uy * 6 * size + py * nw];
  const n2 = [jx + ux * 6 * size - px * nw, jy + uy * 6 * size - py * nw];
  const w1 = [jx + ux * L + px * ww, jy + uy * L + py * ww];
  const w2 = [jx + ux * L - px * ww, jy + uy * L - py * ww];
  // Light: from the opening to a pool around the target.
  out.push(path(`M ${P(...w1)} L ${P(tx + spread, ty)} L ${P(tx - spread, ty)} L ${P(...w2)} Z`, "light", { opacity: light }));
  out.push(ellipse(bx, by, 36 * size, 8 * size, "navy"));
  out.push(line(`M ${bx} ${by - 2} L ${ex} ${ey}`, "navy", 8 * size));
  out.push(line(`M ${ex} ${ey} L ${jx} ${jy}`, "navy", 8 * size));
  out.push(circle(ex, ey, 9 * size, "orange"));
  out.push(path(`M ${P(...n1)} L ${P(...w1)} L ${P(...w2)} L ${P(...n2)} Z`, "orange"));
  // The rim of the opening, a darker band.
  const r1 = [w1[0] - ux * 8 * size, w1[1] - uy * 8 * size], r2 = [w2[0] - ux * 8 * size, w2[1] - uy * 8 * size];
  out.push(path(`M ${P(...r1)} L ${P(...w1)} L ${P(...w2)} L ${P(...r2)} Z`, "orangeDark"));
  out.push(circle(jx, jy, 7 * size, "navy"));
  return out;
}

/** Monstera-like leaf: a teardrop with a notch, pointing along an angle. */
function leaf(cx, cy, len, angleDeg, role) {
  const a = (angleDeg * Math.PI) / 180;
  const ux = Math.cos(a), uy = Math.sin(a);
  const px = -uy, py = ux;
  const w = len * 0.42;
  const tip = [cx + ux * len, cy + uy * len];
  const c1 = [cx + ux * len * 0.25 + px * w, cy + uy * len * 0.25 + py * w];
  const c2 = [cx + ux * len * 0.85 + px * w * 0.8, cy + uy * len * 0.85 + py * w * 0.8];
  const c3 = [cx + ux * len * 0.85 - px * w * 0.8, cy + uy * len * 0.85 - py * w * 0.8];
  const c4 = [cx + ux * len * 0.25 - px * w, cy + uy * len * 0.25 - py * w];
  const f = (p) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`;
  return path(`M ${f([cx, cy])} C ${f(c1)} ${f(c2)} ${f(tip)} C ${f(c3)} ${f(c4)} ${f([cx, cy])} Z`, role);
}
function vein(cx, cy, len, angleDeg) {
  const a = (angleDeg * Math.PI) / 180;
  return line(`M ${cx} ${cy} L ${(cx + Math.cos(a) * len * 0.85).toFixed(1)} ${(cy + Math.sin(a) * len * 0.85).toFixed(1)}`, "leafDark", 2);
}

/**
 * BODY: the whole studio - a large window on the left, a long desk, lamp,
 * laptop, open notebook, mug and a big plant, art on the wall.
 */
export function roomScene() {
  const s = [];
  // Wall and floor
  s.push(rect(0, 0, W, 560, "wall"));
  s.push(rect(0, 0, 70, 560, "wallShade"));
  s.push(rect(0, 548, W, 12, "wallShade"));
  s.push(rect(0, 560, W, 160, "floor"));
  for (const x of [120, 300, 480, 660, 840, 1020, 1200]) s.push(line(`M ${x} 560 L ${x - 60} 720`, "floorLine", 3));
  // Rug
  s.push(path("M 240 640 L 1040 640 L 1110 712 L 170 712 Z", "rug"));
  s.push(line("M 230 652 L 1050 652", "rugLine", 3));
  s.push(line("M 196 690 L 1088 690", "rugLine", 3));

  // Window: frame, glass, outside
  s.push(rect(96, 58, 470, 420, "frame"));
  const view = [];
    view.push(rect(116, 78, 430, 380, "sky"));
    view.push(rect(116, 78, 430, 120, "skyLight"));
    view.push(ellipse(220, 140, 52, 20, "cloud"));
    view.push(ellipse(262, 128, 38, 18, "cloud"));
    view.push(ellipse(450, 176, 46, 16, "cloud"));
    view.push(rect(380, 250, 90, 208, "building"));
    view.push(rect(470, 290, 76, 168, "building"));
  for (const [x, y] of [[396, 270], [428, 270], [396, 310], [428, 310], [396, 350], [428, 350], [486, 310], [516, 310], [486, 350], [516, 350]])
      view.push(rect(x, y, 18, 24, "skyLight"));
    view.push(circle(200, 330, 92, "treeDark"));
    view.push(circle(268, 300, 78, "treeLight"));
    view.push(circle(150, 290, 62, "treeLight"));
    view.push(rect(214, 360, 18, 98, "woodDark"));
    view.push(circle(330, 380, 60, "treeDark"));
  s.push(clipped(116, 78, 430, 380, view));
  // Mullions and sill
  s.push(rect(321, 78, 20, 380, "frame"));
  s.push(rect(116, 258, 430, 18, "frame"));
  s.push(rect(116, 438, 430, 20, "frameShade"));
  s.push(rect(80, 470, 502, 22, "frame"));
  s.push(rect(80, 488, 502, 8, "frameShade"));
  // Curtain on the left
  s.push(path("M 40 40 C 70 160 50 300 72 520 L 120 520 C 104 330 118 170 100 40 Z", "curtain"));
  s.push(path("M 58 40 C 78 170 70 320 86 520 L 98 520 C 86 320 92 170 76 40 Z", "curtainShade"));
  s.push(rect(20, 30, 600, 12, "woodDark"));

  // Wall art
  s.push(rect(690, 104, 150, 190, "frame"));
  s.push(rect(704, 118, 122, 162, "mustard"));
  s.push(circle(765, 182, 38, "orange"));
  s.push(path("M 704 250 C 740 222 780 270 826 238 L 826 280 L 704 280 Z", "teal"));
  s.push(rect(868, 140, 104, 132, "frame"));
  s.push(rect(880, 152, 80, 108, "navy"));
  s.push(path("M 892 236 L 920 176 L 948 236 Z", "mustard"));
  // Shelf with small things
  s.push(rect(1040, 236, 200, 14, "woodDark"));
  s.push(rect(1062, 186, 30, 50, "teal"));
  s.push(rect(1100, 200, 22, 36, "orange"));
  s.push(rect(1132, 172, 12, 64, "navy"));
  s.push(rect(1146, 180, 12, 56, "mustard"));
  s.push(rect(1160, 166, 12, 70, "orangeDark"));
  s.push(path("M 1192 236 L 1196 206 L 1226 206 L 1230 236 Z", "pot"));
  s.push(leaf(1210, 206, 40, -110, "leaf"));
  s.push(leaf(1210, 206, 34, -60, "leafLight"));
  s.push(leaf(1210, 206, 30, -150, "leafLight"));

  // Pendant light
  s.push(line("M 760 0 L 760 52", "ink", 3));
  s.push(path("M 728 82 L 792 82 L 776 50 L 744 50 Z", "orange"));

  // Desk
  s.push(rect(300, 470, 780, 24, "woodLight"));
  s.push(rect(300, 494, 780, 12, "wood"));
  s.push(rect(328, 506, 22, 180, "woodDark"));
  s.push(rect(1030, 506, 22, 180, "woodDark"));
  s.push(rect(860, 506, 150, 150, "wood"));
  s.push(rect(872, 520, 126, 56, "woodLight"));
  s.push(rect(872, 586, 126, 56, "woodLight"));
  s.push(rect(922, 544, 26, 8, "woodDark", { rx: 4 }));
  s.push(rect(922, 610, 26, 8, "woodDark", { rx: 4 }));

  // Books
  s.push(rect(370, 446, 96, 24, "teal"));
  s.push(rect(378, 426, 86, 20, "orange"));
  s.push(rect(366, 410, 92, 16, "navy"));
  // Mug
  s.push(rect(480, 432, 34, 38, "white", { rx: 4 }));
  s.push(path("M 514 442 C 534 442 534 462 514 462", "ink", { fill: "none" }));
  s.push(rect(480, 432, 34, 10, "orange"));

  // Laptop
  s.push(path("M 556 360 L 716 360 L 716 462 L 556 462 Z", "metalDark"));
  s.push(rect(564, 368, 144, 88, "screen"));
  s.push(rect(574, 378, 74, 10, "orange"));
  s.push(rect(574, 396, 120, 6, "navyLight"));
  s.push(rect(574, 408, 100, 6, "navyLight"));
  s.push(rect(574, 422, 52, 26, "teal"));
  s.push(rect(634, 422, 60, 26, "mustard"));
  s.push(path("M 534 462 L 738 462 L 752 474 L 520 474 Z", "metal"));

  // Open notebook and pen
  s.push(path("M 752 470 L 896 470 L 884 446 L 766 446 Z", "paper"));
  s.push(line("M 824 446 L 824 470", "paperLine", 2));
  for (const y of [454, 461]) {
    s.push(line(`M ${772} ${y} L ${816} ${y}`, "paperLine", 2));
    s.push(line(`M ${832} ${y} L ${880} ${y}`, "paperLine", 2));
  }
  s.push(path("M 846 452 L 900 438 L 902 442 L 848 456 Z", "orangeDark"));

  // Desk lamp, aimed at the notebook
  s.push(...lamp({ base: [978, 468], elbow: [940, 366], joint: [1000, 296], target: [826, 462], spread: 92, light: 0.5 }));
  // Plant
  s.push(path("M 1096 470 L 1088 396 L 1156 396 L 1148 470 Z", "pot"));
  s.push(rect(1084, 388, 76, 14, "potDark"));
  for (const [len, ang, role] of [[150, -112, "leaf"], [130, -78, "leafLight"], [140, -140, "leafDark"], [120, -50, "leaf"], [100, -165, "leafLight"], [110, -95, "leafDark"], [96, -28, "leafLight"]]) {
    s.push(leaf(1122, 392, len, ang, role));
    s.push(vein(1122, 392, len, ang));
  }

  // Chair, pulled back from the desk
  s.push(path("M 1080 720 L 1110 690 L 1180 690 L 1210 720 Z", "metalDark"));
  s.push(rect(1140, 610, 12, 82, "metalDark"));
  s.push(rect(1080, 590, 132, 26, "navy", { rx: 10 }));
  s.push(rect(1172, 470, 26, 130, "navy", { rx: 10 }));
  return s;
}

/**
 * FEATURED: a centred cover still life - the desk corner against the big
 * window, lamp, notebook, plant and mug - with clear space above and below,
 * the way the production cover crop keeps the subject centred.
 */
export function coverScene() {
  const s = [];
  s.push(rect(0, 0, W, H, "wall"));
  // A big window filling the background centre
  s.push(rect(250, 40, 780, 470, "frame"));
  const view = [];
    view.push(rect(272, 62, 736, 426, "sky"));
    view.push(rect(272, 62, 736, 150, "skyLight"));
    view.push(ellipse(420, 130, 70, 24, "cloud"));
    view.push(ellipse(476, 116, 50, 22, "cloud"));
    view.push(ellipse(840, 160, 64, 20, "cloud"));
    view.push(rect(700, 250, 120, 238, "building"));
    view.push(rect(820, 300, 100, 188, "building"));
  for (const [x, y] of [[716, 270], [752, 270], [716, 316], [752, 316], [716, 362], [752, 362], [838, 320], [872, 320], [838, 366], [872, 366]])
      view.push(rect(x, y, 22, 28, "skyLight"));
    view.push(circle(400, 380, 120, "treeDark"));
    view.push(circle(500, 340, 100, "treeLight"));
    view.push(circle(330, 320, 80, "treeLight"));
    view.push(circle(980, 420, 90, "treeDark"));
  s.push(clipped(272, 62, 736, 426, view));
  s.push(rect(630, 62, 22, 426, "frame"));
  s.push(rect(272, 270, 736, 20, "frame"));
  // Desk surface across the lower third
  s.push(rect(0, 500, W, 50, "woodLight"));
  s.push(rect(0, 550, W, 170, "wood"));
  s.push(rect(0, 550, W, 10, "woodDark"));
  for (const [x1, y1, x2] of [[60, 600, 420], [520, 630, 980], [180, 676, 700], [860, 690, 1240], [1000, 610, 1220]])
    s.push(line(`M ${x1} ${y1} C ${x1 + 120} ${y1 - 8} ${x2 - 120} ${y1 + 8} ${x2} ${y1}`, "woodLight", 3));
  // Soft shadows where things sit on the desk
  s.push(ellipse(322, 514, 70, 8, "woodDark", { opacity: 0.25 }));
  s.push(ellipse(642, 524, 190, 8, "woodDark", { opacity: 0.2 }));
  s.push(ellipse(888, 512, 40, 6, "woodDark", { opacity: 0.25 }));
  // Plant on the left
  s.push(path("M 286 512 L 274 420 L 366 420 L 354 512 Z", "pot"));
  s.push(rect(266, 410, 108, 16, "potDark"));
  for (const [len, ang, role] of [[190, -110, "leaf"], [160, -72, "leafLight"], [170, -142, "leafDark"], [140, -45, "leaf"], [130, -168, "leafLight"], [150, -92, "leafDark"]]) {
    s.push(leaf(320, 414, len, ang, role));
    s.push(vein(320, 414, len, ang));
  }
  // Open notebook centred, with a pen
  s.push(path("M 470 520 L 810 520 L 786 470 L 494 470 Z", "paper"));
  s.push(line("M 640 470 L 640 520", "paperLine", 3));
  for (const y of [482, 494, 506]) {
    s.push(line(`M 506 ${y} L 626 ${y}`, "paperLine", 2));
    s.push(line(`M 654 ${y} L 778 ${y}`, "paperLine", 2));
  }
  s.push(path("M 700 498 L 840 462 L 844 470 L 704 506 Z", "orangeDark"));
  // Mug
  s.push(rect(860, 452, 52, 58, "white", { rx: 6 }));
  s.push(rect(860, 452, 52, 14, "teal"));
  s.push(path("M 912 466 C 942 466 942 496 912 496", "ink", { fill: "none" }));
  // Lamp on the right, light falling on the notebook
  s.push(...lamp({ base: [1070, 516], elbow: [1012, 372], joint: [1090, 270], target: [690, 506], spread: 150, size: 1.3, light: 0.45 }));
  return s;
}
