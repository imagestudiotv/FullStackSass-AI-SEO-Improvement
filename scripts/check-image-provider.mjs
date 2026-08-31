/**
 * Verifies the configured image provider actually works.
 *
 * Run this once after adding the key, BEFORE trusting article publishing to it:
 *
 *   npm run check:images
 *
 * Image model ids change faster than anything else in an AI API, and a wrong
 * one fails at publish time — inside a background job, on a customer's article,
 * where nobody sees the error until the post goes out without its image. This
 * makes that failure happen here instead, in one command, with the real
 * response body printed.
 *
 * It generates one real image and therefore costs real money (a few cents).
 * That is the point: a mock would not prove the key, the model id, or the
 * response shape.
 */
import nextEnv from "@next/env";
import { writeFileSync } from "node:fs";

nextEnv.loadEnvConfig(process.cwd());

const key = process.env.OPENAI_API_KEY;
const replicate = process.env.REPLICATE_API_TOKEN;
const model = process.env.OPENAI_IMAGE_MODEL?.trim() || "gpt-image-2";

if (!key && !replicate) {
  console.error(
    "\n  No image provider configured.\n" +
      "  Set OPENAI_API_KEY (or REPLICATE_API_TOKEN) in .env.local and re-run.\n",
  );
  process.exit(1);
}

if (!key) {
  console.log("\n  OPENAI_API_KEY not set; Replicate is configured instead.");
  console.log("  This check currently covers OpenAI only.\n");
  process.exit(0);
}

console.log(`\n  Provider: openai`);
console.log(`  Model:    ${model}`);
console.log(`  Endpoint: https://api.openai.com/v1/images/generations\n`);
console.log("  Generating one image (this costs a few cents)…\n");

const started = Date.now();
const response = await fetch("https://api.openai.com/v1/images/generations", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model,
    prompt:
      "A clean, professional photograph of a modern dental clinic reception. " +
      "Natural lighting, realistic, editorial style. No text, no words, no logos.",
    n: 1,
    size: "1024x1024",
  }),
});

const elapsed = ((Date.now() - started) / 1000).toFixed(1);

if (!response.ok) {
  const detail = await response.text();
  console.error(`  FAILED after ${elapsed}s — HTTP ${response.status}\n`);
  console.error(`  Response body:\n  ${detail.slice(0, 800)}\n`);

  if (response.status === 404 || detail.includes("model")) {
    console.error(
      `  This usually means the model id "${model}" is wrong or not available\n` +
        `  on this account. Set OPENAI_IMAGE_MODEL in .env.local to the exact id\n` +
        `  from OpenAI's docs, or leave it unset to use gpt-image-2.\n`,
    );
  }
  if (response.status === 401) {
    console.error("  The API key was rejected. Check it is correct and active.\n");
  }
  if (response.status === 403) {
    console.error(
      "  The key is valid but not permitted to use this model. Image models\n" +
        "  often require a verified organisation on the OpenAI account.\n",
    );
  }
  process.exit(1);
}

const body = await response.json();
const first = body.data?.[0];

if (!first) {
  console.error("  FAILED — the response contained no image.\n");
  console.error(`  ${JSON.stringify(body).slice(0, 600)}\n`);
  process.exit(1);
}

/**
 * Which field came back matters: the app handles both, but a URL expires, so
 * knowing which one this model returns tells us whether the download path is
 * the one being exercised in production.
 */
const shape = first.b64_json ? "b64_json" : first.url ? "url" : "unknown";
let bytes = 0;

/**
 * OpenAI bills these by token, so the real cost is on the response. Printed
 * here because a per-image estimate from a pricing page is not what the bill
 * will say.
 */
const outputTokens = body.usage?.output_tokens;
const costUsd =
  typeof outputTokens === "number" ? (outputTokens / 1_000_000) * 30 : null;

if (first.b64_json) {
  const buffer = Buffer.from(first.b64_json, "base64");
  bytes = buffer.length;
  writeFileSync("image-check.png", buffer);
} else if (first.url) {
  const image = await fetch(first.url);
  const buffer = Buffer.from(await image.arrayBuffer());
  bytes = buffer.length;
  writeFileSync("image-check.png", buffer);
}

console.log(`  OK — image generated in ${elapsed}s`);
console.log(`  Response field: ${shape}`);
console.log(`  Size: ${(bytes / 1024).toFixed(0)} KB`);
console.log(
  costUsd === null
    ? "  Cost: not reported by the API on this response"
    : `  Cost: $${costUsd.toFixed(4)} (${outputTokens} output tokens at $30/1M)`,
);
console.log(`  Saved to: image-check.png (open it to check quality)\n`);
console.log("  Article images will work with this configuration.\n");
