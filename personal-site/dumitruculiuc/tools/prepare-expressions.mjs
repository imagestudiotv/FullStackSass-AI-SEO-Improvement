// Turns AI-edited masters of his photo into photos make-expressions.mjs can use.
//
//   node tools/prepare-expressions.mjs "<folder of photos>" [folder whose node_modules has sharp]
//
// Reads <folder>/rest.png (the unedited 535x486 photo) and the masters in
// <folder>/masters/ (edits of that photo at any size, never changed here), and
// writes <folder>/prepared/<name>.png at 535x486 plus prepared.json, which
// records how each one was fitted.
//
// An AI edit redraws the whole picture, so it is never used whole. Each master
// is first lined up with rest.png on the parts that do not move (hair, ears,
// forehead, nose: scale, turn and shift). Then only the part that has to
// change is taken from it (the face from the brows to the chin, or just the
// eyes and lids), its colour and sharpness matched to rest.png around that
// part, and laid onto rest.png with a soft edge. His hair, outline, neck,
// clothes and shoulders always stay those of rest.png.
//
// A master that cannot be lined up closely enough is rejected and listed. The
// new set is built in a staging folder and replaces prepared/ only when every
// master has been handled, so a failed run changes nothing.
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

const [source, sharpHome = process.cwd()] = process.argv.slice(2);
if (!source) {
  console.error('usage: node tools/prepare-expressions.mjs "<folder of photos>" [folder with sharp installed]');
  process.exit(1);
}
const sharp = createRequire(path.join(sharpHome, "package.json"))("sharp");
const masters = path.join(source, "masters");
const target = path.join(source, "prepared");
const out = target + ".staging";

// What each prepared photo is made of. `keep` is the part taken from the
// master: "face" (brows to chin, cheeks and jaw included, so a yawn's jaw can
// drop) or "eyes" (each eye with its lids and lashes; brows, nose and mouth
// stay still). `from` names the master; for "eyes" it may name one master per
// eye, the eye on the picture's left first.
// `edge` raises the colour limit at the soft edge for one photo, after
// checking the result by eye: annoyed's frown wrinkles the whole forehead and
// narrows the cheeks, and the last yawn frame lifts the brows next to the
// eyes; both read as a difference without showing as a seam.
const PLAN = {
  annoyed: { from: "annoyed", keep: "face", edge: 20 },
  dizzy: { from: "dizzy", keep: "face" },
  "yawn-1": { from: "yawn-1", keep: "face" },
  "yawn-2": { from: "yawn-2", keep: "face" },
  "yawn-3": { from: "yawn-3", keep: "face" },
  "whistle-1": { from: "whistle-1", keep: "face" },
  "whistle-2": { from: "whistle-2", keep: "face" },
  blow: { from: "blow", keep: "face" },
  "look-n": { from: "look-n", keep: "eyes" },
  "look-ne": { from: "look-ne", keep: "eyes" },
  "look-e": { from: "look-e", keep: "eyes" },
  "look-se": { from: "look-se", keep: "eyes" },
  "look-s": { from: "look-s", keep: "eyes" },
  "look-sw": { from: "look-sw", keep: "eyes" },
  "look-w": { from: "look-w", keep: "eyes" },
  "look-nw": { from: "look-nw", keep: "eyes" },
  // Sleepy lids: the eyes of the first yawn frame, then of the last, nearly shut.
  half: { from: "yawn-1", keep: "eyes" },
  drowsy: { from: "yawn-3", keep: "eyes", edge: 18 },
  // Crossed at a fly on his nose: each eye looking down toward the nose.
  "fly-cross": { from: ["look-se", "look-sw"], keep: "eyes" },
};

const BASE = { width: 535, height: 486 };
// Places in rest.png, in its pixels.
const C = { x: 262, y: 150 }; // the head's turning point
const FACE = { x: 263, y: 168, rx: 60, ry: 98, soft: 16 };
const EYES = [
  { x: 228.5, y: 136, rx: 19, ry: 10, soft: 6 },
  { x: 292.5, y: 138.5, rx: 18, ry: 10, soft: 6 },
];
// The parts that never move, to line a master up on: the head without the
// brows, eyes, mouth and jaw ("face" masters), or without the eyes only.
const STILL = {
  face: (x, y) => inEllipse(x, y, { x: 265, y: 140, rx: 95, ry: 120 }) && !inBox(x, y, [200, 98, 320, 150]) && !(y > 172 && x > 205 && x < 325),
  eyes: (x, y) => inEllipse(x, y, { x: 265, y: 150, rx: 95, ry: 125 }) && !inBox(x, y, [208, 118, 248, 146]) && !inBox(x, y, [274, 120, 310, 148]),
};
// How far a master may be off before it is rejected rather than fitted.
const LIMIT = { ncc: { face: 0.65, eyes: 0.9 }, scale: 0.05, turn: 3, shift: 8, colour: 16 };

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const smooth = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
const inEllipse = (x, y, e) => ((x - e.x) / e.rx) ** 2 + ((y - e.y) / e.ry) ** 2 < 1;
const inBox = (x, y, b) => x >= b[0] && x < b[2] && y >= b[1] && y < b[3];
// 1 inside the ellipse, fading to 0 at its edge over `soft` pixels.
function ellipseMask(e) {
  return (x, y) => {
    const d = Math.hypot((x - e.x) / e.rx, (y - e.y) / e.ry);
    return 1 - smooth(1 - e.soft / Math.min(e.rx, e.ry), 1, d);
  };
}

async function rgb(file, blur) {
  let s = sharp(file).flatten({ background: "#fff" }).removeAlpha();
  if (blur >= 0.3) s = s.blur(blur);
  const { data, info } = await s.raw().toBuffer({ resolveWithObject: true });
  return { d: Float32Array.from(data), W: info.width, H: info.height };
}
function sample(img, x, y, c) {
  const { d, W, H } = img;
  x = clamp(x, 0, W - 1.001); y = clamp(y, 0, H - 1.001);
  const x0 = x | 0, y0 = y | 0, fx = x - x0, fy = y - y0, i = (y0 * W + x0) * 3 + c;
  return d[i] * (1 - fx) * (1 - fy) + d[i + 3] * fx * (1 - fy) + d[i + W * 3] * (1 - fx) * fy + d[i + W * 3 + 3] * fx * fy;
}
// Luminance minus its local average: edges and texture, not lighting.
function detail(img, r) {
  const { W, H } = img, g = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) g[i] = 0.299 * img.d[i * 3] + 0.587 * img.d[i * 3 + 1] + 0.114 * img.d[i * 3 + 2];
  let b = g;
  for (let pass = 0; pass < 2; pass++) b = boxBlur(b, W, H, r);
  for (let i = 0; i < W * H; i++) g[i] -= b[i];
  return { d: g, W, H };
}
function boxBlur(src, W, H, r) {
  const t = new Float32Array(W * H), o = new Float32Array(W * H);
  for (let y = 0; y < H; y++) { let s = 0, n = 0; for (let x = -r; x < W + r; x++) { if (x + r < W && x + r >= 0) { s += src[y * W + x + r]; n++; } if (x - r - 1 >= 0) { s -= src[y * W + x - r - 1]; n--; } if (x >= 0 && x < W) t[y * W + x] = s / n; } }
  for (let x = 0; x < W; x++) { let s = 0, n = 0; for (let y = -r; y < H + r; y++) { if (y + r < H && y + r >= 0) { s += t[(y + r) * W + x]; n++; } if (y - r - 1 >= 0) { s -= t[(y - r - 1) * W + x]; n--; } if (y >= 0 && y < H) o[y * W + x] = s / n; } }
  return o;
}
function sample1(img, x, y) {
  const { d, W, H } = img;
  if (x < 0 || y < 0 || x > W - 1.001 || y > H - 1.001) return 0;
  const x0 = x | 0, y0 = y | 0, fx = x - x0, fy = y - y0, i = y0 * W + x0;
  return d[i] * (1 - fx) * (1 - fy) + d[i + 1] * fx * (1 - fy) + d[i + W] * (1 - fx) * fy + d[i + W + 1] * fx * fy;
}

// rest.png pixel -> master pixel, for a fit P = { s, r (radians), tx, ty }.
function mapper(P, kx, ky) {
  const cos = Math.cos(P.r), sin = Math.sin(P.r);
  return (x, y) => {
    const dx = x - C.x, dy = y - C.y;
    return [kx * (P.s * (cos * dx - sin * dy) + C.x + P.tx), ky * (P.s * (sin * dx + cos * dy) + C.y + P.ty)];
  };
}

// Lines a master up with rest.png: the best normalised correlation of their
// detail over the still parts, searched coarsely, then refined.
function fit(restDetail, master, kx, ky, still, start) {
  const pts = [];
  for (let y = 0; y < BASE.height; y++) for (let x = 0; x < BASE.width; x++) if (still(x, y)) pts.push(x, y);
  const a = new Float32Array(pts.length / 2);
  let mean = 0, va = 0;
  for (let i = 0; i < a.length; i++) { a[i] = restDetail.d[pts[2 * i + 1] * BASE.width + pts[2 * i]]; mean += a[i]; }
  mean /= a.length;
  for (let i = 0; i < a.length; i++) { a[i] -= mean; va += a[i] * a[i]; }
  const score = (P, step = 1) => {
    const m = mapper(P, kx, ky);
    let sb = 0, sbb = 0, sab = 0, n = 0, vaa = 0;
    for (let i = 0; i < a.length; i += step) {
      const [u, v] = m(pts[2 * i], pts[2 * i + 1]);
      const b = sample1(master, u, v);
      sb += b; sbb += b * b; sab += a[i] * b; vaa += a[i] * a[i]; n++;
    }
    const mb = sb / n;
    return sab / Math.sqrt((sbb - n * mb * mb) * vaa + 1e-9);
  };
  let best = start || { s: 1, r: 0, tx: 0, ty: 0 }, top = -2;
  if (!start) {
    for (let s = 0.96; s <= 1.041; s += 0.02) for (let r = -3; r <= 3; r += 1) for (let tx = -8; tx <= 8; tx += 2) for (let ty = -8; ty <= 8; ty += 2) {
      const P = { s, r: (r * Math.PI) / 180, tx, ty }, v = score(P, 7);
      if (v > top) { top = v; best = P; }
    }
  }
  const step = { s: 0.01, r: 0.01, tx: 1, ty: 1 };
  top = score(best);
  for (let it = 0; it < 80; it++) {
    let moved = false;
    for (const k of Object.keys(step)) for (const d of [-1, 1]) {
      const P = { ...best, [k]: best[k] + d * step[k] }, v = score(P);
      if (v > top) { top = v; best = P; moved = true; }
    }
    if (!moved) { for (const k of Object.keys(step)) step[k] /= 2; if (step.tx < 0.04) break; }
  }
  return { ...best, ncc: top };
}

// The master resampled onto rest.png's pixels (worked at twice the size, then
// reduced, so the fine detail survives without aliasing).
async function warp(file, P, kx, ky) {
  const full = await rgb(file, 0.45 * kx);
  const S = 2, W = BASE.width * S, H = BASE.height * S, buf = Buffer.alloc(W * H * 3), m = mapper(P, kx, ky);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const [u, v] = m((x + 0.5) / S - 0.5, (y + 0.5) / S - 0.5);
    for (let c = 0; c < 3; c++) buf[(y * W + x) * 3 + c] = clamp(Math.round(sample(full, u, v, c)), 0, 255);
  }
  return sharp(buf, { raw: { width: W, height: H, channels: 3 } }).resize(BASE.width, BASE.height, { kernel: "lanczos3" }).raw().toBuffer();
}

// Colour: per channel gain and offset that make the master's pixels in `ring`
// (the soft edge and just outside it) match rest.png's, fitted twice with the
// worst-matching fifth (moved skin, hair strands) left out the second time.
function matchColour(rest, img, ring) {
  const fitChannel = (c, keep) => {
    let n = 0, sa = 0, sb = 0, saa = 0, sab = 0;
    for (const i of ring) { if (keep && !keep.has(i)) continue; const a = img[i * 3 + c], b = rest[i * 3 + c]; n++; sa += a; sb += b; saa += a * a; sab += a * b; }
    const g = clamp((n * sab - sa * sb) / (n * saa - sa * sa + 1e-9), 0.7, 1.4);
    return { g, o: (sb - g * sa) / n };
  };
  let lin = [0, 1, 2].map((c) => fitChannel(c));
  const err = ring.map((i) => [i, [0, 1, 2].reduce((s, c) => s + Math.abs(img[i * 3 + c] * lin[c].g + lin[c].o - rest[i * 3 + c]), 0)]);
  err.sort((p, q) => p[1] - q[1]);
  const keep = new Set(err.slice(0, Math.floor(err.length * 0.8)).map((p) => p[0]));
  lin = [0, 1, 2].map((c) => fitChannel(c, keep));
  let resid = 0;
  for (const i of keep) for (let c = 0; c < 3; c++) resid += Math.abs(img[i * 3 + c] * lin[c].g + lin[c].o - rest[i * 3 + c]);
  return { lin, resid: resid / keep.size / 3 };
}

// Sharpness: the blur (if any) that brings the master's fine detail in `ring`
// to rest.png's level.
async function matchSharpness(rest, img, ring) {
  const energy = (buf) => {
    let e = 0;
    for (const i of ring) {
      const x = i % BASE.width, y = (i / BASE.width) | 0;
      if (x < 1 || y < 1 || x >= BASE.width - 1 || y >= BASE.height - 1) continue;
      for (let c = 0; c < 3; c++) {
        const lap = 4 * buf[i * 3 + c] - buf[(i - 1) * 3 + c] - buf[(i + 1) * 3 + c] - buf[(i - BASE.width) * 3 + c] - buf[(i + BASE.width) * 3 + c];
        e += lap * lap;
      }
    }
    return e;
  };
  const want = energy(rest);
  let best = { sigma: 0, buf: img, gap: Math.abs(Math.log(energy(img) / want)) };
  for (const sigma of [0.35, 0.5, 0.65, 0.8, 1]) {
    const buf = await sharp(Buffer.from(img), { raw: { width: BASE.width, height: BASE.height, channels: 3 } }).blur(sigma).raw().toBuffer();
    const gap = Math.abs(Math.log(energy(buf) / want));
    if (gap < best.gap) best = { sigma, buf, gap };
  }
  return best;
}

// --- run -----------------------------------------------------------------------
const restFile = path.join(source, "rest.png");
if (!existsSync(restFile)) { console.error("rest.png is missing in", source); process.exit(1); }
const restMeta = await sharp(restFile).metadata();
if (restMeta.width !== BASE.width || restMeta.height !== BASE.height) { console.error(`rest.png must be ${BASE.width}x${BASE.height}`); process.exit(1); }
// Preflight: every master the plan needs is there and readable.
const needed = [...new Set(Object.values(PLAN).flatMap((p) => [].concat(p.from)))];
const missing = [];
for (const m of needed) {
  const f = path.join(masters, m + ".png");
  if (!existsSync(f)) { missing.push(m + ".png"); continue; }
  try { await sharp(f).metadata(); } catch { missing.push(m + ".png (unreadable)"); }
}
const usable = Object.keys(PLAN).filter((n) => [].concat(PLAN[n].from).every((m) => !missing.some((x) => x.startsWith(m + ".png"))));
if (missing.length) console.warn("masters missing, their photos are skipped:", missing.join(", "));

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
process.on("exit", (code) => { if (code) rmSync(out, { recursive: true, force: true }); });

const restImg = await rgb(restFile, 0);
const rest = Buffer.from(restImg.d);
const restDetail = detail(await rgb(restFile, 0.6), 6);
const fits = {}; // master -> { file, P, kx, ky, img }
// Gaze masters change only the eyes, so everything else lines them up; the
// others are lined up on the parts no expression moves.
async function lineUp(name) {
  const keep = name.startsWith("look-") ? "eyes" : "face", key = name;
  if (fits[key]) return fits[key];
  const file = path.join(masters, name + ".png");
  const meta = await sharp(file).metadata();
  const kx = meta.width / BASE.width, ky = meta.height / BASE.height;
  const master = detail(await rgb(file, 0.6 * kx), Math.round(6 * kx));
  const P = fit(restDetail, master, kx, ky, STILL[keep]);
  const problems = [];
  if (P.ncc < LIMIT.ncc[keep]) problems.push(`does not line up (match ${P.ncc.toFixed(3)} < ${LIMIT.ncc[keep]})`);
  if (Math.abs(P.s - 1) > LIMIT.scale) problems.push(`scale ${P.s.toFixed(3)}`);
  if (Math.abs((P.r * 180) / Math.PI) > LIMIT.turn) problems.push(`turned ${((P.r * 180) / Math.PI).toFixed(2)}°`);
  if (Math.hypot(P.tx, P.ty) > LIMIT.shift) problems.push(`shifted ${Math.hypot(P.tx, P.ty).toFixed(1)}px`);
  const sha = createHash("sha256").update(readFileSync(file)).digest("hex");
  fits[key] = { file, sha, size: `${meta.width}x${meta.height}`, P, kx, ky, problems, img: problems.length ? null : await warp(file, P, kx, ky) };
  return fits[key];
}

const report = { rest: createHash("sha256").update(readFileSync(restFile)).digest("hex"), photos: {}, rejected: {} };
for (const name of usable) {
  const plan = PLAN[name];
  const from = [].concat(plan.from);
  const parts = plan.keep === "face" ? [{ mask: ellipseMask(FACE), e: FACE, from: from[0] }] : EYES.map((e, k) => ({ mask: ellipseMask(e), e, from: from[Math.min(k, from.length - 1)] }));
  const result = Buffer.from(rest);
  const notes = [];
  let bad = null;
  for (const part of parts) {
    const f = await lineUp(part.from);
    if (f.problems.length) { bad = `${part.from}.png: ${f.problems.join(", ")}`; break; }
    // The soft edge and a band just outside it: where master and rest meet.
    const { e } = part, ring = [], inside = [];
    const outer = { ...e, rx: e.rx + e.soft * 0.6, ry: e.ry + e.soft * 0.6 };
    for (let y = Math.floor(e.y - outer.ry); y <= e.y + outer.ry; y++) for (let x = Math.floor(e.x - outer.rx); x <= e.x + outer.rx; x++) {
      if (x < 0 || y < 0 || x >= BASE.width || y >= BASE.height || !inEllipse(x, y, outer)) continue;
      const m = part.mask(x, y), i = y * BASE.width + x;
      if (m < 0.97) ring.push(i);
      if (m > 0) inside.push([i, m]);
    }
    const colour = matchColour(rest, f.img, ring);
    const edge = plan.edge || LIMIT.colour;
    if (colour.resid > edge) { bad = `${part.from}.png: does not blend in (colour difference ${colour.resid.toFixed(1)} > ${edge})`; break; }
    const graded = Buffer.alloc(f.img.length);
    for (let i = 0; i < f.img.length; i++) { const c = i % 3; graded[i] = clamp(Math.round(f.img[i] * colour.lin[c].g + colour.lin[c].o), 0, 255); }
    const sharpness = await matchSharpness(rest, graded, ring);
    for (const [i, m] of inside) for (let c = 0; c < 3; c++) result[i * 3 + c] = Math.round(rest[i * 3 + c] * (1 - m) + sharpness.buf[i * 3 + c] * m);
    notes.push({
      master: path.basename(f.file), sha256: f.sha, size: f.size,
      fit: { match: +f.P.ncc.toFixed(3), scale: +f.P.s.toFixed(4), turnDeg: +((f.P.r * 180) / Math.PI).toFixed(2), shiftX: +f.P.tx.toFixed(2), shiftY: +f.P.ty.toFixed(2) },
      colour: { gain: colour.lin.map((l) => +l.g.toFixed(3)), offset: colour.lin.map((l) => +l.o.toFixed(1)), edgeDifference: +colour.resid.toFixed(2) },
      blur: sharpness.sigma,
    });
  }
  if (bad) { report.rejected[name] = bad; console.warn("rejected", name + ":", bad); continue; }
  await sharp(result, { raw: { width: BASE.width, height: BASE.height, channels: 3 } }).png().toFile(path.join(out, name + ".png"));
  report.photos[name] = { keep: plan.keep, parts: notes };
  console.log("prepared", name, notes.map((n) => `${n.master} match ${n.fit.match} edge ${n.colour.edgeDifference} blur ${n.blur}`).join("; "));
}
writeFileSync(path.join(out, "prepared.json"), JSON.stringify(report, null, 2) + "\n");

// Complete: swap the new set in.
const old = target + ".old";
rmSync(old, { recursive: true, force: true });
if (existsSync(target)) renameSync(target, old);
renameSync(out, target);
rmSync(old, { recursive: true, force: true });
console.log(`${Object.keys(report.photos).length} prepared, ${Object.keys(report.rejected).length} rejected, written to`, target);
