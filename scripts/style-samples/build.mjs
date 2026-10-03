/**
 * Builds the image-style examples shown on Article Settings.
 *
 *   node scripts/style-samples/build.mjs            # build into a temp folder, print the manifest
 *   node scripts/style-samples/build.mjs --install  # ... then copy into public/style-samples
 *
 * NO PAID CALLS. Three examples are original artwork - one studio scene
 * (scene.mjs) rendered in each medium by media.mjs (flat vector, coloured
 * sketch, watercolour) and rasterised with sharp - and two are photographs
 * under the Unsplash License, downloaded from fixed URLs and cropped. See
 * PROVENANCE.md. They are illustrations of each style, NOT output of the
 * production image model; the UI must not claim otherwise.
 *
 * Every image is 16:9 like the production article image (1280 x 720,
 * src/lib/images/process.ts). Each style gets a thumbnail for the cards and a
 * full-size version for the enlarged preview, so the dialog never stretches
 * a thumbnail.
 *
 * After --install, bump STYLE_SAMPLE_VERSION in
 * src/lib/websites/style-samples.ts so browsers fetch the new files instead
 * of a cached copy of the old ones.
 */
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

import { illustration, sketch, watercolour } from "./media.mjs";
import { coverScene, roomScene } from "./scene.mjs";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const PUBLIC = join(ROOT, "public", "style-samples");
const install = process.argv.includes("--install");

/** The two licensed photographs (Unsplash License), cropped to the 16:9 frame. */
const PHOTOS = {
  realistic: {
    url: "https://images.unsplash.com/photo-1564540574859-0dfb63985953?fm=jpg&q=85&w=2400",
    crop: { left: 0, top: 125, width: 2400, height: 1350 },
  },
  "brand-text": {
    url: "https://images.unsplash.com/photo-1533090161767-e6ffed986c88?fm=jpg&q=85&w=2400",
    // Keeps the desk and the empty wall on the left, where the colour panel goes.
    crop: { left: 0, top: 252, width: 2400, height: 1350 },
  },
};

/**
 * Brand & Text, as production asks for it: a photograph with a flat colour
 * panel along one edge and NO text (the image prompt forbids text, and no
 * code sets a headline over the picture). The panel colour here is a neutral
 * deep blue; production lets the model choose.
 */
function brandPanel() {
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720"><rect x="0" y="0" width="480" height="720" fill="#1F3B63"/></svg>`,
  );
}

const out = mkdtempSync(join(tmpdir(), "style-samples-"));
const work = join(out, "png");
mkdirSync(work);

async function svgToPng(name, svg) {
  writeFileSync(join(work, `${name}.svg`), svg);
  await sharp(Buffer.from(svg)).png().toFile(join(work, `${name}.png`));
}

async function photo(name) {
  const { url, crop } = PHOTOS[name];
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${name}: ${response.status} from ${url}`);
  let image = sharp(Buffer.from(await response.arrayBuffer())).extract(crop).resize(1280, 720);
  if (name === "brand-text") image = sharp(await image.png().toBuffer()).composite([{ input: brandPanel() }]);
  await image.png().toFile(join(work, `${name}.png`));
}

console.log(`Rendering into ${out}`);
await svgToPng("sketch-room", sketch(roomScene()));
await svgToPng("sketch-cover", sketch(coverScene()));
await svgToPng("watercolour-room", watercolour(roomScene()));
await svgToPng("watercolour-cover", watercolour(coverScene()));
await svgToPng("illustration-room", illustration(roomScene()));
await svgToPng("illustration-cover", illustration(coverScene()));
await photo("realistic");
await photo("brand-text");

/** Published name -> rendered source. Names are derived from the stored style ids. */
const FILES = {
  "body-sketch": "sketch-room",
  "body-watercolour": "watercolour-room",
  "body-realistic": "realistic",
  "body-illustration": "illustration-room",
  "body-brand-text": "brand-text",
  "featured-sketch": "sketch-cover",
  "featured-watercolour": "watercolour-cover",
  "featured-illustration": "illustration-cover",
};

const manifest = [];
for (const [name, source] of Object.entries(FILES)) {
  const from = join(work, `${source}.png`);
  const thumb = join(out, `${name}.webp`);
  const large = join(out, `${name}-large.webp`);
  // Grainy paper costs bytes at full size; the preview is only fetched when opened.
  const largeQuality = source.startsWith("sketch") ? 78 : 84;
  await sharp(from).resize(640, 360).webp({ quality: 82, effort: 6 }).toFile(thumb);
  await sharp(from).resize(1280, 720).webp({ quality: largeQuality, effort: 6 }).toFile(large);
  for (const file of [thumb, large]) {
    const meta = await sharp(file).metadata();
    manifest.push({ file: file.split(/[\\/]/).pop(), width: meta.width, height: meta.height, bytes: statSync(file).size });
  }
}

for (const row of manifest) console.log(`${row.file.padEnd(34)} ${row.width}x${row.height}  ${(row.bytes / 1024).toFixed(1)} KB`);

if (install) {
  if (!existsSync(PUBLIC)) mkdirSync(PUBLIC, { recursive: true });
  for (const row of manifest) copyFileSync(join(out, row.file), join(PUBLIC, row.file));
  console.log(`\nInstalled ${manifest.length} files into public/style-samples. Bump STYLE_SAMPLE_VERSION.`);
} else {
  console.log(`\nBuilt only. Inspect ${out}, then re-run with --install.`);
}
