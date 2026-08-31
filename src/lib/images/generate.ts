/**
 * Article images.
 *
 * Anthropic does not generate images, so this needs a second AI vendor. Which
 * one is a commercial decision — pricing and licence terms differ, and the
 * customer owns the output — so the provider is chosen by environment variable
 * rather than baked in. Adding a key switches it on; adding none leaves every
 * other part of the product working.
 *
 * Two providers are supported because they are the realistic choices and their
 * APIs are small enough that supporting both costs little:
 *
 *   IMAGE_PROVIDER=openai     OPENAI_API_KEY=...      (gpt-image-2)
 *   IMAGE_PROVIDER=replicate  REPLICATE_API_TOKEN=... (flux-schnell)
 *
 * Verify any model change with `npm run check:images`: a wrong model id fails
 * inside the publish job, after the article is written, where nobody sees it.
 *
 * Images are returned as raw bytes rather than a provider URL. Provider-hosted
 * URLs expire — often within the hour — so storing one would give the customer
 * an article whose image silently disappears days later.
 */

export type ImageProvider = "openai" | "replicate";

export type GeneratedImage = {
  /** Raw image bytes, ready to upload to the customer's CMS. */
  data: Buffer;
  /** MIME type, for the upload. */
  contentType: string;
  /** Alt text describing the image, required for accessibility and SEO. */
  alt: string;
  /** What it cost us, in USD, for per-tenant cost tracking. */
  costUsd: number;
};

/**
 * OpenAI bills image generation by TOKEN, not per image — output tokens vary
 * with resolution and quality, so there is no fixed per-image price to hard
 * code. $30 per 1M output tokens is the published gpt-image-2 rate; the actual
 * token count comes back on each response, so cost is measured rather than
 * assumed.
 *
 * Re-check before quoting margins: these drift.
 */
const OPENAI_OUTPUT_PER_1M_USD = 30;

/**
 * Fallback when a response omits usage. Roughly a medium-quality 1024x1024
 * image. Only used so a missing field records an approximate cost instead of
 * a free one — an image that appears to cost nothing quietly breaks unit
 * economics, which is the whole reason usage is tracked.
 */
const OPENAI_FALLBACK_USD = 0.04;

/** Replicate flux-schnell bills per run, so a flat rate is accurate there. */
const REPLICATE_PER_IMAGE_USD = 0.003;

/** The configured provider, or null when none is set up. */
export function activeProvider(): ImageProvider | null {
  const configured = process.env.IMAGE_PROVIDER?.trim().toLowerCase();

  if (configured === "openai") {
    return process.env.OPENAI_API_KEY ? "openai" : null;
  }
  if (configured === "replicate") {
    return process.env.REPLICATE_API_TOKEN ? "replicate" : null;
  }

  /**
   * No explicit choice: infer from whichever key exists, so setting one key is
   * enough to switch the feature on. Deliberately does NOT guess when both are
   * present — that is a real ambiguity the operator should resolve.
   */
  const hasOpenAi = Boolean(process.env.OPENAI_API_KEY);
  const hasReplicate = Boolean(process.env.REPLICATE_API_TOKEN);
  if (hasOpenAi && !hasReplicate) return "openai";
  if (hasReplicate && !hasOpenAi) return "replicate";

  return null;
}

/** True when article images can be generated on this deployment. */
export function isImageGenerationConfigured(): boolean {
  return activeProvider() !== null;
}

/**
 * Turns an article title into an image brief.
 *
 * Deliberately asks for photography with no text in it. Image models render
 * text as convincing gibberish, and a header image with misspelled words on a
 * customer's live site is worse than no image at all.
 */
function buildPrompt(title: string, industry: string | null): string {
  const context = industry ? ` for a ${industry} business` : "";
  return [
    `A clean, professional photograph illustrating "${title}"${context}.`,
    "Natural lighting, realistic, editorial style, suitable as a blog header.",
    "No text, no words, no letters, no logos, no watermarks in the image.",
  ].join(" ");
}

/**
 * OpenAI image model.
 *
 * Overridable by env so a newer model can be adopted without a deploy: OpenAI
 * ships these faster than we release, and hardcoding one means a code change
 * every time. An unknown id fails loudly on the first call rather than
 * silently falling back to an older, cheaper model the customer did not ask
 * for.
 */
function openAiModel(): string {
  return process.env.OPENAI_IMAGE_MODEL?.trim() || "gpt-image-2";
}

async function generateWithOpenAi(
  prompt: string,
): Promise<{ data: Buffer; costUsd: number }> {
  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      /**
       * Always sent. The endpoint still defaults to dall-e-2, so omitting this
       * would quietly generate a far worse image rather than erroring.
       */
      model: openAiModel(),
      prompt,
      n: 1,
      /**
       * gpt-image-2 accepts arbitrary resolutions, but 1024x1024 is the one
       * size every image model supports, so switching models never breaks the
       * request. `response_format` is deliberately NOT sent: it is a dall-e
       * parameter, and the GPT image models reject it.
       */
      size: "1024x1024",
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(
      `Image provider rejected the request (${response.status}): ${detail.slice(0, 200)}`,
    );
  }

  const body = (await response.json()) as {
    data?: { b64_json?: string; url?: string }[];
    usage?: { output_tokens?: number; total_tokens?: number };
  };
  const first = body.data?.[0];

  /**
   * Cost is read from the response rather than assumed. Output tokens vary
   * with resolution and quality, so a hardcoded per-image figure would drift
   * from the real bill as soon as either changes.
   */
  const outputTokens = body.usage?.output_tokens;
  const costUsd =
    typeof outputTokens === "number"
      ? (outputTokens / 1_000_000) * OPENAI_OUTPUT_PER_1M_USD
      : OPENAI_FALLBACK_USD;

  if (first?.b64_json) {
    return { data: Buffer.from(first.b64_json, "base64"), costUsd };
  }

  /**
   * The GPT image models always return base64 and never a url — `url` is
   * dall-e only. Handled anyway so that pointing OPENAI_IMAGE_MODEL at a
   * dall-e model still works. Downloaded immediately rather than stored: those
   * links expire, and a stored one becomes a broken image on a live page.
   */
  if (first?.url) {
    const image = await fetch(first.url);
    if (!image.ok) throw new Error("Could not download the generated image");
    return { data: Buffer.from(await image.arrayBuffer()), costUsd };
  }

  throw new Error("Image provider returned no image");
}

async function generateWithReplicate(
  prompt: string,
): Promise<{ data: Buffer; costUsd: number }> {
  /**
   * Prefer=wait blocks until the prediction finishes, so no polling loop is
   * needed. Replicate caps that wait at 60s and then returns the prediction
   * unfinished, which is handled below rather than assumed away.
   */
  const response = await fetch(
    "https://api.replicate.com/v1/models/black-forest-labs/flux-schnell/predictions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.REPLICATE_API_TOKEN}`,
        "Content-Type": "application/json",
        Prefer: "wait",
      },
      body: JSON.stringify({
        input: { prompt, num_outputs: 1, aspect_ratio: "16:9" },
      }),
    },
  );

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(
      `Image provider rejected the request (${response.status}): ${detail.slice(0, 200)}`,
    );
  }

  const body = (await response.json()) as {
    status?: string;
    output?: string[] | string;
    error?: string;
  };

  if (body.error) throw new Error(String(body.error));
  if (body.status !== "succeeded") {
    // Still running after the wait. Treated as a failure for this article
    // rather than blocking generation; the next run retries.
    throw new Error("Image generation did not finish in time");
  }

  const url = Array.isArray(body.output) ? body.output[0] : body.output;
  if (!url) throw new Error("Image provider returned no image");

  const image = await fetch(url);
  if (!image.ok) throw new Error("Could not download the generated image");
  return {
    data: Buffer.from(await image.arrayBuffer()),
    costUsd: REPLICATE_PER_IMAGE_USD,
  };
}

/**
 * Generates a header image for an article.
 *
 * Throws when no provider is configured — callers check
 * isImageGenerationConfigured() first and skip images entirely rather than
 * failing the article. An article without an image is still a good article.
 */
export async function generateArticleImage(
  title: string,
  industry: string | null,
): Promise<GeneratedImage> {
  const provider = activeProvider();
  if (!provider) {
    throw new Error("No image provider is configured");
  }

  const prompt = buildPrompt(title, industry);
  const generated =
    provider === "openai"
      ? await generateWithOpenAi(prompt)
      : await generateWithReplicate(prompt);

  return {
    data: generated.data,
    // Both providers return PNG by default for these models.
    contentType: "image/png",
    /**
     * Alt text describes the article subject rather than the picture. A
     * screen-reader user gains nothing from "a photograph", and search engines
     * read this too.
     */
    alt: title,
    // Measured from the response where the provider reports it.
    costUsd: generated.costUsd,
  };
}
