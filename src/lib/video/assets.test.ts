import { describe, expect, it, vi } from "vitest";

import { identityClaim, resolveSceneAssets, sourceOrder, type CachedStock, type ResolverDeps } from "./assets";
import type { ShotScene } from "./formats";
import type { StockCandidate, StockProvider } from "./footage";

/**
 * The scene asset resolver: the preferred source first, then customer ->
 * stock -> article -> AI image -> brand; nothing fetched when no stock is set
 * up; at most two AI images, and only within the budget; footage-led
 * directions get no silent brand fallback.
 */

const scene = (source: ShotScene["visual"]["source"], query = "barista pouring latte close-up", kind: "video" | "image" = "video"): ShotScene => ({
  visual: { source, query, kind },
  transition: "cut",
  reaction: null,
  overlay: null,
});

const CANDIDATE: StockCandidate = {
  provider: "fake",
  providerId: "1",
  kind: "video",
  downloadUrl: "https://cdn.example/1.mp4",
  width: 1080,
  height: 1920,
  durationMs: 8000,
  sizeBytes: 1000,
  licence: "Fake licence",
  sourceUrl: "https://stock.example/1",
  author: "Ann",
  tags: [],
};

function provider(configured: boolean, results: StockCandidate[] = [CANDIDATE]): StockProvider & { calls: number } {
  const p = {
    id: "fake",
    free: true,
    calls: 0,
    configured: () => configured,
    search: vi.fn(async () => {
      p.calls += 1;
      return results.map((r, i) => ({ ...r, providerId: `${r.providerId}-${p.calls}-${i}` }));
    }),
  };
  return p;
}

function deps(overrides: Partial<ResolverDeps> = {}): ResolverDeps & { recorded: unknown[] } {
  const recorded: unknown[] = [];
  return {
    recorded,
    customerMedia: async () => [],
    providers: [],
    findCached: async () => null,
    storeStock: async (candidate): Promise<CachedStock> => ({
      id: `asset-${candidate.providerId}`,
      provider: candidate.provider,
      providerId: candidate.providerId,
      kind: candidate.kind,
      url: `https://repget.example/shared/${candidate.providerId}.mp4`,
      width: candidate.width,
      height: candidate.height,
      durationMs: candidate.durationMs,
      licence: candidate.licence,
      sourceUrl: candidate.sourceUrl,
      author: candidate.author,
    }),
    stockCost: async () => null,
    ai: {
      provider: () => null,
      estimateUsd: () => 0.04,
      generate: vi.fn(async () => ({ data: Buffer.from("png"), contentType: "image/png", costUsd: 0.012 })),
      store: async () => "https://repget.example/ai.png",
    },
    reserve: vi.fn(async () => undefined),
    canAfford: vi.fn(async () => true),
    record: vi.fn(async (item) => {
      recorded.push(item);
    }),
    ...overrides,
  };
}

describe("choosing each scene's picture or clip", () => {
  it("tries the scene's preferred source first, then the fixed order", () => {
    expect(sourceOrder("article")).toEqual(["article", "customer", "stock", "ai_image", "brand"]);
    expect(sourceOrder("customer")).toEqual(["customer", "stock", "article", "ai_image", "brand"]);
  });

  it("uses the customer's own media first, each once, then stock, then the article's pictures", async () => {
    const stock = provider(true);
    const d = deps({ customerMedia: async () => [{ url: "https://repget.example/own.mp4", kind: "video" }], providers: [stock] });
    const result = await resolveSceneAssets(
      {
        direction: "footage",
        scenes: [scene("customer"), scene("customer"), scene("article"), scene("customer")],
        parts: [0, 1, 2, 3],
        media: [{ url: "https://site.example/article.jpg", kind: "image" }],
      },
      d,
    );
    expect(result.assets.map((a) => [a.sceneIndex, a.source])).toEqual([
      [0, "customer"],
      [1, "stock"],
      [2, "article"],
      [3, "stock"],
    ]);
    const stockAsset = result.assets[1];
    expect(stockAsset).toMatchObject({ provider: "fake", licence: "Fake licence", sourceUrl: "https://stock.example/1", author: "Ann", assetId: expect.stringMatching(/^asset-/) });
    // A free provider's file is recorded as a measured zero.
    expect(d.recorded).toContainEqual(expect.objectContaining({ kind: "footage", usd: 0, basis: "measured" }));
  });

  it("makes no stock call when no provider is configured, and leaves a footage scene missing instead of a brand background", async () => {
    const stock = provider(false);
    const result = await resolveSceneAssets({ direction: "meme", scenes: [scene("stock")], parts: [0], media: [] }, deps({ providers: [stock] }));
    expect(stock.search).not.toHaveBeenCalled();
    expect(result.assets).toEqual([]);
    expect(result.missing).toEqual([0]);
  });

  it("lets Text + Music use the brand's colours on purpose", async () => {
    const result = await resolveSceneAssets({ direction: "text_music", scenes: [scene("brand")], parts: [0], media: [] }, deps());
    expect(result.assets).toEqual([]);
    expect(result.missing).toEqual([0]);
  });

  it("reuses a stored file for the same query without searching", async () => {
    const stock = provider(true);
    const cached: CachedStock = { id: "cached-1", provider: "pixabay", providerId: "77", kind: "video", url: "https://repget.example/77.mp4", width: 1080, height: 1920, durationMs: 9000, licence: "Pixabay", sourceUrl: "https://pixabay.com/videos/id-77/", author: null };
    const result = await resolveSceneAssets({ direction: "footage", scenes: [scene("stock")], parts: [0], media: [] }, deps({ providers: [stock], findCached: async () => cached }));
    expect(stock.search).not.toHaveBeenCalled();
    expect(result.assets[0]).toMatchObject({ assetId: "cached-1", url: "https://repget.example/77.mp4" });
  });

  it("makes at most two AI images, only when the budget allows, and records their cost", async () => {
    const generate = vi.fn(async () => ({ data: Buffer.from("png"), contentType: "image/png", costUsd: 0.012 }));
    const d = deps({ ai: { provider: () => "openai", estimateUsd: () => 0.04, generate, store: async () => "https://repget.example/ai.png" } });
    const result = await resolveSceneAssets({ direction: "storytelling", scenes: [scene("ai_image"), scene("ai_image"), scene("ai_image")], parts: [0, 1, 2], media: [] }, d);
    expect(generate).toHaveBeenCalledTimes(2);
    expect(result.assets.filter((a) => a.source === "ai_image")).toHaveLength(2);
    expect(d.reserve).toHaveBeenCalledWith("image:0", 0.04, "an AI image");
    expect(d.recorded).toContainEqual(expect.objectContaining({ kind: "image", usd: 0.012 }));

    const broke = deps({ ai: { provider: () => "openai", estimateUsd: () => 0.04, generate, store: async () => "x" }, canAfford: async () => false });
    generate.mockClear();
    const refused = await resolveSceneAssets({ direction: "storytelling", scenes: [scene("ai_image")], parts: [0], media: [] }, broke);
    expect(generate).not.toHaveBeenCalled();
    expect(refused.notes.join(" ")).toMatch(/budget/);
  });

  it("keeps a retry's assets and fetches nothing again for them", async () => {
    const stock = provider(true);
    const existing = [{ sceneIndex: 0, url: "https://repget.example/kept.mp4", kind: "video" as const, source: "stock" as const, provider: "pixabay", providerId: "5", licence: "Pixabay", sourceUrl: null, author: null, assetId: "a5" }];
    const result = await resolveSceneAssets({ direction: "footage", scenes: [scene("stock")], parts: [0], media: [], existing }, deps({ providers: [stock] }));
    expect(stock.search).not.toHaveBeenCalled();
    expect(result.assets).toEqual(existing);
  });

  it("spots words that would pass stock actors off as the customer's people", () => {
    expect(identityClaim("Meet the team behind every order")).toBe(true);
    expect(identityClaim("Our clients love the new menu")).toBe(true);
    expect(identityClaim("Clienții noștri revin")).toBe(true);
    expect(identityClaim("Three ways to light a product photo")).toBe(false);
  });
});
