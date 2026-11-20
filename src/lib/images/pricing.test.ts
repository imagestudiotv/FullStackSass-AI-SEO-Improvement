import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/net/safe-fetch", () => ({ safeFetch: vi.fn() }));

import { generateOpenAiImage } from "./generate";
import { OPENAI_IMAGE_PER_IMAGE_USD, openAiImageCostUsd } from "./pricing";

/**
 * What a generated image is recorded as costing (Free plan cost control,
 * 2026-11-20): measured from OpenAI's token usage at the published per-1M
 * rates - text input, image input and image output - or, without usage, the
 * per-image estimate ("auto" priced as high); never zero.
 */

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("openAiImageCostUsd", () => {
  it("prices gpt-image-2 from the response's tokens: $5/1M text in, $8/1M image in, $30/1M image out", () => {
    // A 1536x1024 high image: ~6,208 output tokens, a 300-token prompt.
    expect(openAiImageCostUsd("gpt-image-2", { input_tokens: 300, output_tokens: 6208, input_tokens_details: { text_tokens: 300, image_tokens: 0 } })).toBeCloseTo(0.0015 + 0.18624, 6);
    // Image input (an edit) at its own rate; text = input minus image tokens when no split is given.
    expect(openAiImageCostUsd("gpt-image-2", { input_tokens: 1300, output_tokens: 1000, input_tokens_details: { image_tokens: 1000 } })).toBeCloseTo(0.0015 + 0.008 + 0.03, 6);
    expect(openAiImageCostUsd("gpt-image-1-mini", { input_tokens: 100, output_tokens: 1000 })).toBeCloseTo(0.0002 + 0.008, 6);
    // An unknown model is priced as gpt-image-2.
    expect(openAiImageCostUsd("gpt-image-9", { input_tokens: 0, output_tokens: 1_000_000 })).toBe(30);
  });

  it("records the per-image estimate, never zero, when the response has no usage", () => {
    expect(openAiImageCostUsd("gpt-image-2", undefined, "low")).toBe(OPENAI_IMAGE_PER_IMAGE_USD.low);
    expect(openAiImageCostUsd("gpt-image-2", { output_tokens: 0 }, "medium")).toBe(OPENAI_IMAGE_PER_IMAGE_USD.medium);
    // "auto" (no quality sent) may be high: priced as high so the Free cap stops early, not late.
    expect(openAiImageCostUsd("gpt-image-2", null)).toBe(OPENAI_IMAGE_PER_IMAGE_USD.high);
    expect(OPENAI_IMAGE_PER_IMAGE_USD.high).toBeGreaterThan(0);
  });
});

describe("generateOpenAiImage", () => {
  const png = Buffer.from("png-bytes").toString("base64");

  it("returns the measured cost from the response's usage", async () => {
    vi.stubEnv("IMAGE_PROVIDER", "openai");
    vi.stubEnv("OPENAI_API_KEY", "sk-test");
    vi.stubEnv("OPENAI_IMAGE_MODEL", "");
    const fetch = vi.fn(async () =>
      Response.json({ data: [{ b64_json: png }], usage: { input_tokens: 200, output_tokens: 400, input_tokens_details: { text_tokens: 200, image_tokens: 0 } } }),
    );
    vi.stubGlobal("fetch", fetch);
    const image = await generateOpenAiImage("A diagram", "low");
    expect(image.costUsd).toBeCloseTo((200 * 5 + 400 * 30) / 1_000_000, 6);
    expect(JSON.parse((fetch.mock.calls[0] as unknown as [string, RequestInit])[1].body as string)).toMatchObject({ model: "gpt-image-2", quality: "low" });
  });

  it("falls back to the estimate for its quality when usage is missing", async () => {
    vi.stubEnv("IMAGE_PROVIDER", "openai");
    vi.stubEnv("OPENAI_API_KEY", "sk-test");
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ data: [{ b64_json: png }] })));
    expect((await generateOpenAiImage("A diagram", "medium")).costUsd).toBe(OPENAI_IMAGE_PER_IMAGE_USD.medium);
  });
});
