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
 *   IMAGE_PROVIDER=openai     OPENAI_API_KEY=...    (gpt-image-1)
 *   IMAGE_PROVIDER=replicate  REPLICATE_API_TOKEN=... (flux-schnell)
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
 * List prices per image, USD. Re-check before quoting margins: these drift.
 *  - OpenAI gpt-image-1, 1024x1024 standard quality
 *  - Replicate flux-schnell, roughly per run
 */
const COST_PER_IMAGE: Record<ImageProvider, number> = {
  openai: 0.04,
  replicate: 0.003,
};

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
  return process.env.OPENAI_IMAGE_MODEL?.trim() || "gpt-image-1";
}

async function generateWithOpenAi(prompt: string): Promise<Buffer> {
  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: openAiModel(),
      prompt,
      n: 1,
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
  };
  const first = body.data?.[0];

  if (first?.b64_json) {
    return Buffer.from(first.b64_json, "base64");
  }

  /**
   * Some responses return a URL instead. Fetched immediately rather than
   * stored: these links expire, and a stored one becomes a broken image on the
   * customer's site later.
   */
  if (first?.url) {
    const image = await fetch(first.url);
    if (!image.ok) throw new Error("Could not download the generated image");
    return Buffer.from(await image.arrayBuffer());
  }

  throw new Error("Image provider returned no image");
}

async function generateWithReplicate(prompt: string): Promise<Buffer> {
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
  return Buffer.from(await image.arrayBuffer());
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
  const data =
    provider === "openai"
      ? await generateWithOpenAi(prompt)
      : await generateWithReplicate(prompt);

  return {
    data,
    // Both providers return PNG for these models.
    contentType: "image/png",
    /**
     * Alt text describes the article subject rather than the picture. A
     * screen-reader user gains nothing from "a photograph", and search engines
     * read this too.
     */
    alt: title,
    costUsd: COST_PER_IMAGE[provider],
  };
}
