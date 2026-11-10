// Builds the portrait's expressions from photos edited out of one base photo.
// The photos are only read, never copied into the theme.
//
//   node tools/make-expressions.mjs "<folder of photos>" [folder whose node_modules has sharp]
//
// The folder holds PNGs that all share the base photo's framing (the 535x486
// "Dumitru Culiuc Founder RepGet.png", or any photo of the same size edited
// from it), named after what they show:
//
//   rest.png                      the unedited photo (required)
//   look-<dir>.png                eyes looking that way; <dir> is one of the 8
//                                 compass points n ne e se s sw w nw, seen from
//                                 the visitor ("look-e" looks to his left, the
//                                 visitor's right)
//   closed.png, half.png,         eyes closed / half closed / nearly shut /
//   drowsy.png, fly-cross.png     crossed at a fly on his nose
//   prepared/*.png                photos made by prepare-expressions.mjs from
//                                 AI-edited masters, used where the folder has
//                                 no photo of that name
//   anything-else.png             a whole face: smile, shock, ouch, annoyed,
//                                 dizzy, yawn-1, whistle-1, blow, ... (see
//                                 FACE_ROLES in assets/js/portrait.js for which
//                                 names the portrait uses)
//
// Everything is checked before anything is written, and the new set is built
// in a staging folder that replaces the old one only once it is complete: a
// failed run leaves the theme's current expressions as they were.
//
// Output (theme/dumitru/assets/images/portrait/expressions/):
//   face-<name>.webp     640x640 cutout, same crop as cutout-640.webp
//   face-rest-480.webp   the rest face for small screens
//   eyes.webp            the eye band of every look-*/closed/half photo, in a grid
//   expressions.json     what exists, read by portrait.js
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const [source, sharpHome = process.cwd()] = process.argv.slice(2);
if (!source) {
  console.error('usage: node tools/make-expressions.mjs "<folder of photos>" [folder with sharp installed]');
  process.exit(1);
}
const sharp = createRequire(path.join(sharpHome, "package.json"))("sharp");
const here = path.dirname(fileURLToPath(import.meta.url));
const target = path.join(here, "..", "theme", "dumitru", "assets", "images", "portrait", "expressions");
const out = target + ".staging";

// The 535x486 base is a 1:1 crop of the 896x1195 original at (180, 152), so
// make-portrait.mjs's CROP (238, 128, 424) is (58, -24, 424) here. The 24px
// above the photo are filled with white (made transparent below).
const BASE = { width: 535, height: 486 };
const CROP = { left: 58, top: -24, size: 424 };
const SIZE = 640;
const EYES = ["n", "ne", "e", "se", "s", "sw", "w", "nw"].map((d) => "look-" + d);
const EYE_EXTRA = ["closed", "half", "drowsy", "fly-cross"];

function fail(message) {
  console.error(message);
  console.error("nothing was changed in", target);
  process.exit(1);
}

// Photos in the folder, then the prepared ones for whatever has no photo.
const files = [];
const names = [];
for (const dir of [source, path.join(source, "prepared")]) {
  if (!existsSync(dir)) continue;
  for (const f of readdirSync(dir).filter((f) => /\.png$/i.test(f))) {
    const name = f.replace(/\.png$/i, "").toLowerCase();
    if (names.includes(name)) continue;
    files.push(path.join(dir, f));
    names.push(name);
  }
}
if (!names.includes("rest")) fail("rest.png (the unedited photo) is missing");
const unknownLook = names.filter((n) => n.startsWith("look-") && !EYES.includes(n));
if (unknownLook.length) console.warn("ignored, not one of the 8 compass points:", unknownLook.join(", "));
const badName = names.filter((n) => !/^[a-z0-9-]+$/.test(n));
if (badName.length) fail("rename (use a-z, 0-9 and -): " + badName.join(", "));

// Preflight: every photo must be the base photo's size, before anything is written.
{
  const wrong = [];
  for (const [k, file] of files.entries()) {
    if (unknownLook.includes(names[k])) continue;
    try {
      const meta = await sharp(file).metadata();
      if (meta.width !== BASE.width || meta.height !== BASE.height) wrong.push(`${path.basename(file)} is ${meta.width}x${meta.height}`);
    } catch (err) {
      wrong.push(`${path.basename(file)} cannot be read (${err.message})`);
    }
  }
  if (wrong.length) {
    fail(`every photo must be ${BASE.width}x${BASE.height}, the base photo's size (prepare AI masters with tools/prepare-expressions.mjs):\n  ` + wrong.join("\n  "));
  }
}
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
// A run that stops half way leaves no staging folder behind.
process.on("exit", (code) => { if (code) rmSync(out, { recursive: true, force: true }); });

// Square crop, scaled to SIZE, as raw RGBA on white.
async function square(name) {
  const file = files[names.indexOf(name)];
  const meta = await sharp(file).metadata();
  if (meta.width !== BASE.width || meta.height !== BASE.height) {
    throw new Error(`${name}.png is ${meta.width}x${meta.height}, expected ${BASE.width}x${BASE.height} (the base photo's size)`);
  }
  const padTop = Math.max(0, -CROP.top);
  const img = await sharp(file)
    .flatten({ background: "#ffffff" })
    .extend({ top: padTop, background: "#ffffff" })
    .extract({ left: CROP.left, top: CROP.top + padTop, width: CROP.size, height: CROP.size })
    .resize(SIZE, SIZE, { kernel: "lanczos3" })
    .ensureAlpha()
    .raw()
    .toBuffer();
  return img;
}

// Transparent background, as in make-portrait.mjs: near-white connected to
// the top or sides (not the bottom: the white shirt reaches it). Worked out
// once on the rest photo and shared by every face, so the outline never
// flickers when the faces change.
const rest = await square("rest");
const mask = new Uint8Array(SIZE * SIZE).fill(255);
{
  const seen = new Uint8Array(SIZE * SIZE);
  const white = (i) => rest[i * 4] > 238 && rest[i * 4 + 1] > 238 && rest[i * 4 + 2] > 238;
  const stack = [];
  for (let x = 0; x < SIZE; x++) stack.push(x);
  for (let y = 0; y < SIZE; y++) stack.push(y * SIZE, y * SIZE + SIZE - 1);
  while (stack.length) {
    const i = stack.pop();
    if (seen[i] || !white(i)) continue;
    seen[i] = 1;
    const x = i % SIZE, y = (i / SIZE) | 0;
    if (x > 0) stack.push(i - 1);
    if (x < SIZE - 1) stack.push(i + 1);
    if (y > 0) stack.push(i - SIZE);
    if (y < SIZE - 1) stack.push(i + SIZE);
  }
  for (let i = 0; i < SIZE * SIZE; i++) {
    if (seen[i]) { mask[i] = 0; continue; }
    const x = i % SIZE, y = (i / SIZE) | 0;
    const edge = (x > 0 && seen[i - 1]) || (x < SIZE - 1 && seen[i + 1]) || (y > 0 && seen[i - SIZE]) || (y < SIZE - 1 && seen[i + SIZE]);
    if (edge) mask[i] = 150;
  }
}
// An edit that moved the head or recoloured the photo shows as a ghost when
// the faces cross-fade: compare the jacket and shirt, which never change.
function checkAligned(name, rgba) {
  let sum = 0, n = 0;
  for (let y = Math.round(SIZE * 0.78); y < SIZE; y += 2) {
    for (let x = 0; x < SIZE; x += 2) {
      const i = y * SIZE + x;
      if (!mask[i]) continue;
      sum += Math.abs(rgba[i * 4] - rest[i * 4]) + Math.abs(rgba[i * 4 + 1] - rest[i * 4 + 1]) + Math.abs(rgba[i * 4 + 2] - rest[i * 4 + 2]);
      n++;
    }
  }
  const d = sum / Math.max(1, n) / 3;
  if (d > 12) console.warn(`${name}.png differs from rest.png below the face (${d.toFixed(1)}): was the head moved or the colours changed? It may ghost.`);
}

function cutout(rgba) {
  for (let i = 0; i < SIZE * SIZE; i++) rgba[i * 4 + 3] = mask[i];
  return sharp(rgba, { raw: { width: SIZE, height: SIZE, channels: 4 } });
}

const manifest = { version: 1, size: SIZE, faces: {}, eyes: null };

// The rest face is also the photograph shown before (or without) the script,
// so it comes in a smaller size too.
const restCut = cutout(Buffer.from(rest));
await restCut.clone().webp({ quality: 86, alphaQuality: 90 }).toFile(path.join(out, "face-rest.webp"));
await restCut.clone().resize(480, 480).webp({ quality: 86, alphaQuality: 90 }).toFile(path.join(out, "face-rest-480.webp"));
manifest.faces.rest = "face-rest.webp";

// Whole faces.
for (const name of names) {
  if (name === "rest" || EYES.includes(name) || EYE_EXTRA.includes(name) || name.startsWith("look-")) continue;
  const img = await square(name);
  checkAligned(name, img);
  await cutout(img).webp({ quality: 86, alphaQuality: 90 }).toFile(path.join(out, `face-${name}.webp`));
  manifest.faces[name] = `face-${name}.webp`;
}

// Eyes: the band that differs from rest across every eye photo, cut out of
// each into one sheet. portrait.js draws the band over the rest face,
// feathered at its edges.
const eyeNames = [...EYES, ...EYE_EXTRA].filter((n) => names.includes(n));
if (eyeNames.length) {
  const eyeImgs = {};
  let x0 = SIZE, y0 = SIZE, x1 = 0, y1 = 0;
  // Only look for changes around the eyes and brows, so an edit that also
  // nudged the mouth or hair does not stretch the band over the whole face.
  const SEARCH = { x0: 0.25, x1: 0.75, y0: 0.15, y1: 0.5 };
  // AI edits also leave scattered noise (hair edges, beard); a blurred
  // difference keeps only the dense change around the eyes.
  const R = 8;
  for (const n of eyeNames) {
    const img = await square(n);
    eyeImgs[n] = img;
    checkAligned(n, img);
    const diff = new Float32Array(SIZE * SIZE);
    for (let i = 0; i < SIZE * SIZE; i++) {
      diff[i] = Math.abs(img[i * 4] - rest[i * 4]) + Math.abs(img[i * 4 + 1] - rest[i * 4 + 1]) + Math.abs(img[i * 4 + 2] - rest[i * 4 + 2]);
    }
    for (let y = Math.round(SEARCH.y0 * SIZE); y < SEARCH.y1 * SIZE; y++) {
      for (let x = Math.round(SEARCH.x0 * SIZE); x < SEARCH.x1 * SIZE; x++) {
        let s = 0;
        for (let dy = -R; dy <= R; dy += 2) for (let dx = -R; dx <= R; dx += 2) s += diff[(y + dy) * SIZE + x + dx];
        if (s / 81 > 60) {
          if (x < x0) x0 = x; if (x > x1) x1 = x;
          if (y < y0) y0 = y; if (y > y1) y1 = y;
        }
      }
    }
  }
  // Room for the feathered edge.
  const pad = 14;
  x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad);
  x1 = Math.min(SIZE - 1, x1 + pad); y1 = Math.min(SIZE - 1, y1 + pad);
  const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
  const cols = Math.min(4, eyeNames.length), rows = Math.ceil(eyeNames.length / cols);
  const gap = 2; // keeps neighbouring cells from bleeding into each other
  const cw = bw + gap * 2, ch = bh + gap * 2;
  const tiles = [];
  for (const [k, n] of eyeNames.entries()) {
    const band = await cutout(Buffer.from(eyeImgs[n])).extract({ left: x0, top: y0, width: bw, height: bh })
      .extend({ top: gap, bottom: gap, left: gap, right: gap, extendWith: "copy" })
      .png().toBuffer();
    tiles.push({ input: band, left: (k % cols) * cw, top: Math.floor(k / cols) * ch });
  }
  await sharp({ create: { width: cols * cw, height: rows * ch, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite(tiles)
    .webp({ quality: 90, alphaQuality: 90 })
    .toFile(path.join(out, "eyes.webp"));
  const f = (v) => +v.toFixed(5);
  manifest.eyes = {
    sheet: "eyes.webp",
    // The band in picture space ([0,1]² of the portrait's square).
    rect: [f(x0 / SIZE), f(y0 / SIZE), f(bw / SIZE), f(bh / SIZE)],
    // Each cell in the sheet's own [0,1]² (without its gap).
    cells: Object.fromEntries(eyeNames.map((n, k) => {
      const sw = cols * cw, sh = rows * ch;
      return [n, [f(((k % cols) * cw + gap) / sw), f((Math.floor(k / cols) * ch + gap) / sh), f(bw / sw), f(bh / sh)]];
    })),
  };
}

// Each file is named with a hash of its content, so a browser or CDN never
// pairs a new manifest with an old picture.
const stamp = (file) => file + "?v=" + createHash("sha256").update(readFileSync(path.join(out, file))).digest("hex").slice(0, 10);
for (const name of Object.keys(manifest.faces)) manifest.faces[name] = stamp(manifest.faces[name]);
if (manifest.eyes) manifest.eyes.sheet = stamp(manifest.eyes.sheet);
writeFileSync(path.join(out, "expressions.json"), JSON.stringify(manifest, null, 2) + "\n");

// Complete: swap the new set in.
const old = target + ".old";
rmSync(old, { recursive: true, force: true });
if (existsSync(target)) renameSync(target, old);
renameSync(out, target);
rmSync(old, { recursive: true, force: true });

const missing = EYES.filter((n) => !names.includes(n));
console.log("faces:", Object.keys(manifest.faces).join(", "));
console.log("eyes:", eyeNames.join(", ") || "none");
if (missing.length) console.log("eye directions still to make:", missing.join(", "));
console.log("written to", target);
