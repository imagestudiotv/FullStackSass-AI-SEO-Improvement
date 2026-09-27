import Anthropic from "@anthropic-ai/sdk";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { createTestDb, type TestDb } from "@/test/db";

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/lib/db", () => ({
  db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }),
}));

// The paid model and the page fetch are both mocked.
const ai = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("@/lib/ai/client", () => ({
  anthropic: { messages: { create: ai.create } },
  isAiConfigured: () => true,
  MODELS: { GENERATION: "claude-sonnet-5", EXTRACTION: "claude-haiku-4-5" },
}));
const crawl = vi.hoisted(() => ({ fetchHomepage: vi.fn() }));
vi.mock("@/lib/websites/crawl", () => crawl);

import { PUBLIC_LIMITS, visitorKey, writeDescriptions } from "./description-writer";

const GOOD = JSON.stringify([
  "A clear description of exactly what this page offers, written so that a searcher knows why clicking is worth their time today.",
]);

function page(url: string) {
  return {
    finalUrl: url,
    title: "Example",
    metaDescription: null,
    text: "Real content about the business and what it sells. ".repeat(10),
  };
}

let test: TestDb;
const defaults = { ...PUBLIC_LIMITS };

beforeAll(async () => {
  test = await createTestDb();
  state.db = test.db;
});

beforeEach(async () => {
  await test.client.exec(
    "delete from spend_reservations; delete from operation_leases; delete from provider_cache;",
  );
  ai.create.mockReset();
  ai.create.mockResolvedValue({ content: [{ type: "text", text: GOOD }] });
  crawl.fetchHomepage.mockReset();
  crawl.fetchHomepage.mockImplementation(async (url: string) => page(url));
});

afterEach(() => {
  Object.assign(PUBLIC_LIMITS, defaults);
});

describe("anonymous use", () => {
  it("caps one visitor however many pages they ask about", async () => {
    const outcomes = [];
    for (let i = 0; i < 10; i += 1) {
      outcomes.push(await writeDescriptions(`site${i}.example`, "visitor-a"));
    }
    expect(outcomes.filter((o) => o.ok)).toHaveLength(PUBLIC_LIMITS.perVisitorPerHour);
    expect(ai.create).toHaveBeenCalledTimes(PUBLIC_LIMITS.perVisitorPerHour);
    expect(outcomes.at(-1)).toEqual({ ok: false, error: expect.stringMatching(/try again later/) });
  });

  it("caps every visitor together, so rotating addresses does not help", async () => {
    PUBLIC_LIMITS.globalPerHour = 3;
    const outcomes = await Promise.all(
      Array.from({ length: 12 }, (_, i) => writeDescriptions(`page${i}.example`, `visitor-${i}`)),
    );
    expect(outcomes.filter((o) => o.ok)).toHaveLength(3);
    expect(ai.create).toHaveBeenCalledTimes(3);
  });

  it("serves a page it has already written from the cache, for anyone", async () => {
    expect((await writeDescriptions("cached.example", "visitor-a")).ok).toBe(true);
    const second = await writeDescriptions("cached.example", "visitor-b");
    expect(second.ok).toBe(true);
    expect(ai.create).toHaveBeenCalledTimes(1);
  });

  it("pays once when identical requests arrive together", async () => {
    let finish!: () => void;
    ai.create.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = () => resolve({ content: [{ type: "text", text: GOOD }] });
        }),
    );

    const first = writeDescriptions("busy.example", "visitor-a");
    await vi.waitFor(() => expect(ai.create).toHaveBeenCalledTimes(1));
    const others = await Promise.all(
      Array.from({ length: 5 }, (_, i) => writeDescriptions("busy.example", `visitor-${i + 1}`)),
    );
    finish();

    expect((await first).ok).toBe(true);
    expect(others.every((o) => !o.ok)).toBe(true);
    expect(ai.create).toHaveBeenCalledTimes(1);
    // Once written, the same page is served from the cache.
    expect((await writeDescriptions("busy.example", "visitor-9")).ok).toBe(true);
    expect(ai.create).toHaveBeenCalledTimes(1);
  });
});

describe("failures", () => {
  it("gives the visitor their slot back when the provider refuses", async () => {
    ai.create.mockRejectedValue(
      new Anthropic.APIError(529, { type: "overloaded_error" }, "overloaded", new Headers()),
    );
    for (let i = 0; i < 8; i += 1) {
      const outcome = await writeDescriptions(`down${i}.example`, "visitor-a");
      expect(outcome).toEqual({ ok: false, error: expect.stringMatching(/could not write/) });
    }
    ai.create.mockResolvedValue({ content: [{ type: "text", text: GOOD }] });
    expect((await writeDescriptions("up.example", "visitor-a")).ok).toBe(true);
  });

  it("counts a timed-out call, which may have been billed", async () => {
    ai.create.mockRejectedValue(new Anthropic.APIConnectionTimeoutError());
    for (let i = 0; i < 8; i += 1) await writeDescriptions(`slow${i}.example`, "visitor-a");
    expect(ai.create).toHaveBeenCalledTimes(PUBLIC_LIMITS.perVisitorPerHour);
  });

  it("frees the page's lease when a request fails, so the next one can try", async () => {
    ai.create.mockRejectedValueOnce(
      new Anthropic.APIError(500, { type: "api_error" }, "boom", new Headers()),
    );
    expect((await writeDescriptions("retry.example", "visitor-a")).ok).toBe(false);
    expect((await writeDescriptions("retry.example", "visitor-a")).ok).toBe(true);
  });

  it("does not call the model, or count, when the page cannot be read", async () => {
    crawl.fetchHomepage.mockRejectedValue(new Error("ENOTFOUND"));
    for (let i = 0; i < 8; i += 1) {
      expect((await writeDescriptions(`gone${i}.example`, "visitor-a")).ok).toBe(false);
    }
    expect(ai.create).not.toHaveBeenCalled();
  });

  it("counts an answer that came back unusable, because it was paid for", async () => {
    ai.create.mockResolvedValue({ content: [{ type: "text", text: "not json" }] });
    for (let i = 0; i < PUBLIC_LIMITS.perVisitorPerHour; i += 1) {
      expect((await writeDescriptions(`junk${i}.example`, "visitor-a")).ok).toBe(false);
    }
    await writeDescriptions("one-more.example", "visitor-a");
    expect(ai.create).toHaveBeenCalledTimes(PUBLIC_LIMITS.perVisitorPerHour);
  });
});

describe("visitorKey", () => {
  it("hashes the edge-supplied address and never returns it", () => {
    const key = visitorKey(new Headers({ "x-real-ip": "203.0.113.7", "x-forwarded-for": "198.51.100.1" }));
    expect(key).not.toContain("203.0.113.7");
    expect(key).toBe(visitorKey(new Headers({ "x-real-ip": "203.0.113.7" })));
    expect(key).not.toBe(visitorKey(new Headers({ "x-forwarded-for": "198.51.100.1, 10.0.0.1" })));
  });
});
