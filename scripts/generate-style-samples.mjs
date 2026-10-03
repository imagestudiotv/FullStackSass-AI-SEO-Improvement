/**
 * OPTIONAL, BILLED: generates image-style samples with the production image
 * model, for comparison or to replace the shipped examples.
 *
 * The examples the app ships are NOT made here. They are built without any
 * paid call by scripts/style-samples/build.mjs (original artwork plus two
 * Unsplash-licensed photographs; see scripts/style-samples/PROVENANCE.md).
 * This script exists for when someone with authority to spend decides to
 * show real model output instead.
 *
 *   node scripts/generate-style-samples.mjs          # dry run: lists the prompts and the number of calls
 *   node scripts/generate-style-samples.mjs --apply  # calls the OpenAI Images API (BILLED per image)
 *
 * SAFEGUARDS against accidental and repeated charges:
 *  - Dry run unless --apply is given.
 *  - Writes into a NEW temporary folder every run, never into public/: it
 *    cannot silently skip, overwrite or "replace" the shipped examples. Inspect
 *    the output, then encode and install by hand (see PROVENANCE.md).
 *  - Prints how many calls it is about to make before making any.
 *
 * Prompts mirror src/lib/websites/article-options.ts IMAGE_STYLE_PROMPTS and
 * src/lib/images (size, landscape composition). This file is plain node and
 * cannot import that TypeScript, so the copy below must be updated with it -
 * nothing checks them automatically.
 */
import nextEnv from "@next/env";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

nextEnv.loadEnvConfig(process.cwd());

const apply = process.argv.includes("--apply");

/** Mirrors IMAGE_STYLE_PROMPTS (src/lib/websites/article-options.ts). */
const STYLES = {
  sketch:
    "Coloured sketch illustration with loose hand-drawn linework over soft warm colour, textured paper feel, editorial.",
  watercolour:
    "Vivid watercolour illustration with saturated pigment and visible brush strokes, clear colour, white paper showing through.",
  realistic: "Clean professional photograph, natural lighting, editorial style.",
  illustration: "Flat vector illustration, bold simple shapes, limited palette, no gradients.",
  "brand-text":
    "Clean professional photograph with a bold flat colour panel overlaid along one edge in the brand colours, leaving clear empty space in that panel.",
};

/** Mirrors LANDSCAPE_COMPOSITION (src/lib/images/process.ts). */
const LANDSCAPE_COMPOSITION = "Wide landscape composition: keep the main subject centred, with space above and below it.";

/** The same subject as the shipped examples, so the two sets can be compared. */
const SUBJECT = "a bright contemporary creative studio with a desk, an open notebook, a desk lamp, a plant and a large window";

const jobs = [
  ...Object.keys(STYLES).map((id) => ({ file: `body-${id}.png`, style: STYLES[id] })),
  ...["sketch", "watercolour", "illustration"].map((id) => ({ file: `featured-${id}.png`, style: STYLES[id] })),
];

function prompt(style) {
  return [
    `An image illustrating ${SUBJECT}.`,
    style,
    "Suitable as a blog header.",
    LANDSCAPE_COMPOSITION,
    "No text, no words, no letters, no logos, no watermarks in the image.",
  ].join(" ");
}

/** Production's model and size choice (src/lib/images/generate.ts, process.ts openAiSize). */
const MODEL = process.env.OPENAI_IMAGE_MODEL ?? "gpt-image-2";
const SIZE = MODEL.startsWith("gpt-image") ? "1536x1024" : MODEL.startsWith("dall-e-3") ? "1792x1024" : "1024x1024";

async function generate(text) {
  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({ model: MODEL, prompt: text, n: 1, size: SIZE }),
  });
  if (!response.ok) throw new Error(`${response.status} ${(await response.text()).slice(0, 200)}`);
  const body = await response.json();
  const b64 = body?.data?.[0]?.b64_json;
  if (!b64) throw new Error("no image in response");
  return Buffer.from(b64, "base64");
}

console.log(`${jobs.length} images, model ${MODEL}, size ${SIZE}.\n`);

if (!apply) {
  for (const job of jobs) console.log(`  ${job.file}\n    ${prompt(job.style)}\n`);
  console.log(`Dry run: nothing generated, nothing billed. --apply makes ${jobs.length} billed API calls.\n`);
  process.exit(0);
}

if (!process.env.OPENAI_API_KEY) {
  console.error("OPENAI_API_KEY is not set.");
  process.exit(1);
}

const out = mkdtempSync(join(tmpdir(), "style-samples-model-"));
console.log(`Making ${jobs.length} billed calls into ${out}\n`);
let made = 0;
for (const job of jobs) {
  try {
    const bytes = await generate(prompt(job.style));
    writeFileSync(join(out, job.file), bytes);
    console.log(`  ${job.file} - ${(bytes.length / 1024).toFixed(0)} KB`);
    made++;
  } catch (error) {
    console.error(`  ${job.file} - FAILED: ${error.message}`);
  }
}
console.log(`\n${made} generated into ${out}. Nothing in public/ was changed.`);
