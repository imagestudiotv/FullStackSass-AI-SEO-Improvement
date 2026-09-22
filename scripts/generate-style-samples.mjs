/**
 * Generates the style sample thumbnails shown on the Article Settings screen.
 *
 * ONE-OFF, and committed so it can be re-run when a style's wording changes.
 * The samples are STATIC assets rather than generated per customer: the
 * styles are the same for everybody, somebody picking "Watercolour" wants to
 * know what watercolour looks like rather than what their brand looks like in
 * watercolour, and nine image calls per website — on a screen visited once —
 * would be billed for decoration.
 *
 * Uses the same IMAGE_STYLE_PROMPTS the generator uses, so a card shows what
 * that style actually produces rather than a stock picture chosen to look
 * good. If the two ever drift, the samples are lying.
 *
 *   node scripts/generate-style-samples.mjs          # dry run, lists what it would do
 *   node scripts/generate-style-samples.mjs --apply
 */
import nextEnv from "@next/env";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

nextEnv.loadEnvConfig(process.cwd());

const apply = process.argv.includes("--apply");
const OUT_DIR = join(process.cwd(), "public", "style-samples");

/**
 * Mirrors lib/websites/article-options.ts. Duplicated rather than imported
 * because that file is TypeScript with a path alias and this is a plain node
 * script — a copy that is checked on every run is safer than a build step.
 */
const BODY_STYLES = {
  sketch:
    "Coloured sketch illustration with loose hand-drawn linework over soft warm colour, textured paper feel, editorial.",
  watercolour:
    "Vivid watercolour illustration with saturated pigment and visible brush strokes, clear colour, white paper showing through.",
  realistic: "Clean professional photograph, natural lighting, editorial style.",
  illustration:
    "Flat vector illustration, bold simple shapes, limited palette, no gradients.",
  "brand-text":
    "Clean professional photograph with a bold flat colour panel overlaid along one edge in strong blue, leaving clear empty space in that panel.",
};

/**
 * The cover styles. "match" has no sample of its own — it follows whatever
 * the body style is, so showing it a picture would claim a look it does not
 * have.
 */
const FEATURED_STYLES = {
  sketch: BODY_STYLES.sketch,
  watercolour: BODY_STYLES.watercolour,
  illustration: BODY_STYLES.illustration,
};

/**
 * One neutral subject across every sample.
 *
 * The cards are compared side by side, so the only thing that should differ
 * between them is the style. A different subject per card would make the
 * comparison about the subject.
 */
const SUBJECT = "a person working at a laptop in a bright modern workspace";

function prompt(style) {
  return [
    `An image illustrating ${SUBJECT}.`,
    style,
    "Suitable as a blog header.",
    "No text, no words, no letters, no logos, no watermarks in the image.",
  ].join(" ");
}

async function generate(text) {
  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.IMAGE_MODEL ?? "gpt-image-1",
      prompt: text,
      n: 1,
      size: "1024x1024",
      quality: "low",
    }),
  });

  if (!response.ok) {
    throw new Error(`${response.status} ${(await response.text()).slice(0, 200)}`);
  }

  const body = await response.json();
  const b64 = body?.data?.[0]?.b64_json;
  if (!b64) throw new Error("no image in response");
  return Buffer.from(b64, "base64");
}

const jobs = [
  ...Object.entries(BODY_STYLES).map(([id, style]) => ({
    file: `body-${id}.png`,
    style,
  })),
  ...Object.entries(FEATURED_STYLES).map(([id, style]) => ({
    file: `featured-${id}.png`,
    style,
  })),
];

console.log(`${jobs.length} samples -> public/style-samples/\n`);

if (!apply) {
  for (const job of jobs) console.log(`  ${job.file}\n    ${prompt(job.style)}\n`);
  console.log("Dry run — nothing generated. Re-run with --apply.\n");
  process.exit(0);
}

if (!process.env.OPENAI_API_KEY) {
  console.error("OPENAI_API_KEY is not set.");
  process.exit(1);
}

mkdirSync(OUT_DIR, { recursive: true });

let made = 0;
let skipped = 0;
for (const job of jobs) {
  const path = join(OUT_DIR, job.file);
  /*
    Idempotent, and it must check the COMPRESSED file too.

    compress-style-samples.mjs replaces each .png with a .webp, so a re-run
    that only looked for the .png would find nothing and re-bill every
    sample. Checking both means deleting the one .webp you want redone is
    enough to redo exactly that one.
  */
  const webp = path.replace(/\.png$/, ".webp");
  if (existsSync(path) || existsSync(webp)) {
    console.log(`  ${job.file} — already there, skipping`);
    skipped++;
    continue;
  }
  try {
    const bytes = await generate(prompt(job.style));
    writeFileSync(path, bytes);
    console.log(`  ${job.file} — ${(bytes.length / 1024).toFixed(0)} KB`);
    made++;
  } catch (error) {
    console.error(`  ${job.file} — FAILED: ${error.message}`);
  }
}

console.log(`\n${made} generated, ${skipped} already present.`);
