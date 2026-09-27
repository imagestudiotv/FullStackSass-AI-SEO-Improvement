import { afterEach, describe, expect, it, vi } from "vitest";

/*
  Image providers answer with a URL to download the generated image from.
  That URL is chosen by a third party's response, so it goes through the
  SSRF guard like any other: a provider (or anything impersonating one)
  pointing it at cloud metadata or a private network is refused.

  The provider APIs are mocked (global fetch), and DNS is mocked for the
  guard's own lookup: nothing here touches the network.
*/
vi.mock("node:dns/promises", () => ({ lookup: vi.fn() }));

import { lookup } from "node:dns/promises";

import { UnsafeUrlError } from "@/lib/net/safe-fetch";

import { generateArticleImage } from "./generate";

function providerAnswers(body: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } })),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.mocked(lookup).mockReset();
});

describe("downloading a provider's image URL", () => {
  it("refuses an OpenAI-returned URL pointing at cloud metadata", async () => {
    vi.stubEnv("IMAGE_PROVIDER", "openai");
    vi.stubEnv("OPENAI_API_KEY", "test-key-not-real");
    providerAnswers({ data: [{ url: "http://169.254.169.254/latest/meta-data/iam/" }], usage: { output_tokens: 1 } });

    await expect(generateArticleImage("A title", null)).rejects.toBeInstanceOf(UnsafeUrlError);
  });

  it("refuses a Replicate output URL whose name resolves to a private address", async () => {
    vi.stubEnv("IMAGE_PROVIDER", "replicate");
    vi.stubEnv("REPLICATE_API_TOKEN", "test-token-not-real");
    vi.mocked(lookup).mockImplementation((async (_host: string, options?: { all?: boolean }) =>
      options?.all ? [{ address: "10.1.2.3", family: 4 }] : { address: "10.1.2.3", family: 4 }) as never);
    providerAnswers({ status: "succeeded", output: ["https://images.provider-cdn.example/out.png"] });

    await expect(generateArticleImage("A title", null)).rejects.toBeInstanceOf(UnsafeUrlError);
  });
});
