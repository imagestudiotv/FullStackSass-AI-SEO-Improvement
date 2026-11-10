// Builds the portrait derivatives the theme ships, from Daniel's original photo.
// The original is only read, never changed or copied into the theme.
//
//   node tools/make-portrait.mjs "<path to Dumitru Culiuc.png>" [path to a folder whose node_modules has sharp]
//
// Output (theme/dumitru/assets/images/portrait/):
//   portrait-{320,480,640}.webp   head and shoulders on the original white, square
//   portrait-640.jpg              the same for the no-JavaScript fallback / old browsers
//   cutout-{480,640}.webp         the same crop with the white background made transparent
//                                 (flood-filled from the edges, so the white shirt stays)
//   og-1200x630.jpg               social sharing image
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const [source, sharpHome = process.cwd()] = process.argv.slice(2);
if (!source) {
  console.error('usage: node tools/make-portrait.mjs "<original.png>" [folder with sharp installed]');
  process.exit(1);
}
const sharp = createRequire(path.join(sharpHome, "package.json"))("sharp");
const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(here, "..", "theme", "dumitru", "assets", "images", "portrait");
mkdirSync(out, { recursive: true });

// Head and shoulders of the 896x1195 original: the face is centred on x~450,
// the crown at y~180 and the shoulders at y~520.
const CROP = { left: 238, top: 128, width: 424, height: 424 };

const meta = await sharp(source).metadata();
if (meta.width !== 896 || meta.height !== 1195) {
  console.warn(`expected 896x1195, got ${meta.width}x${meta.height}: check CROP before using the output`);
}
const crop = () => sharp(source).extract(CROP);

for (const size of [320, 480, 640]) {
  await crop().resize(size, size, { kernel: "lanczos3" }).webp({ quality: 86 }).toFile(path.join(out, `portrait-${size}.webp`));
}
await crop().resize(640, 640).jpeg({ quality: 84, mozjpeg: true }).toFile(path.join(out, "portrait-640.jpg"));

// Transparent cutout: everything near-white that is connected to the edge of
// the crop becomes transparent, with a soft 1px edge.
const { data, info } = await crop().ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const { width: w, height: h } = info;
const seen = new Uint8Array(w * h);
const white = (i) => data[i * 4] > 238 && data[i * 4 + 1] > 238 && data[i * 4 + 2] > 238;
const stack = [];
// Not from the bottom edge: the white shirt reaches it.
for (let x = 0; x < w; x++) stack.push(x);
for (let y = 0; y < h; y++) stack.push(y * w, y * w + w - 1);
while (stack.length) {
  const i = stack.pop();
  if (seen[i] || !white(i)) continue;
  seen[i] = 1;
  const x = i % w, y = (i / w) | 0;
  if (x > 0) stack.push(i - 1);
  if (x < w - 1) stack.push(i + 1);
  if (y > 0) stack.push(i - w);
  if (y < h - 1) stack.push(i + w);
}
for (let i = 0; i < w * h; i++) {
  if (seen[i]) { data[i * 4 + 3] = 0; continue; }
  const x = i % w, y = (i / w) | 0;
  const edge = (x > 0 && seen[i - 1]) || (x < w - 1 && seen[i + 1]) || (y > 0 && seen[i - w]) || (y < h - 1 && seen[i + w]);
  if (edge) data[i * 4 + 3] = 150;
}
const cut = sharp(data, { raw: { width: w, height: h, channels: 4 } });
for (const size of [480, 640]) {
  await cut.clone().resize(size, size).webp({ quality: 88, alphaQuality: 90 }).toFile(path.join(out, `cutout-${size}.webp`));
}

// 1200x630 sharing image: the portrait on the theme's paper colour.
const og = await crop().resize(560, 560).toBuffer();
await sharp({ create: { width: 1200, height: 630, channels: 3, background: "#f3efe6" } })
  .composite([{ input: og, left: 600, top: 35 }])
  .jpeg({ quality: 84, mozjpeg: true })
  .toFile(path.join(out, "og-1200x630.jpg"));

console.log("written to", out);
