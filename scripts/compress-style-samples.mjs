/**
 * Shrinks the generated style samples to thumbnail size.
 *
 * WHY THIS IS NOT OPTIONAL: the image API returns 1024x1024 PNGs, and eight
 * of those is 12 MB of repository and 12 MB down the wire for pictures
 * rendered at roughly 220px wide. The cards would be the heaviest thing on
 * the settings screen by an order of magnitude.
 *
 * WebP at 480px wide is about 25 KB each. That is still twice the rendered
 * size, so they stay sharp on a retina display, and the whole set costs less
 * than a single one of the originals.
 *
 * Run after generate-style-samples.mjs. It replaces the PNGs rather than
 * keeping both, because a 12 MB directory nobody reads is 12 MB nobody
 * notices until it is cloned.
 */
import sharp from "sharp";
import { readdirSync, statSync, unlinkSync } from "node:fs";
import { join } from "node:path";

const DIR = join(process.cwd(), "public", "style-samples");
const WIDTH = 480;

const pngs = readdirSync(DIR).filter((f) => f.endsWith(".png"));
if (pngs.length === 0) {
  console.log("No PNGs to compress — already done?");
  process.exit(0);
}

let before = 0;
let after = 0;

for (const file of pngs) {
  const from = join(DIR, file);
  const to = from.replace(/\.png$/, ".webp");

  const originalBytes = statSync(from).size;
  await sharp(from).resize(WIDTH).webp({ quality: 80 }).toFile(to);
  const newBytes = statSync(to).size;

  unlinkSync(from);

  before += originalBytes;
  after += newBytes;
  console.log(
    `  ${file.replace(/\.png$/, ".webp")} — ${(originalBytes / 1024).toFixed(0)} KB -> ${(newBytes / 1024).toFixed(0)} KB`,
  );
}

console.log(
  `\n${(before / 1024 / 1024).toFixed(1)} MB -> ${(after / 1024).toFixed(0)} KB`,
);
