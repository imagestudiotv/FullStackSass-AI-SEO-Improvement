import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ fetch: vi.fn(), cache: vi.fn() }));
vi.mock("./cache", () => ({ withCache: mocks.cache }));
import { articleSearch, DataForSeoError } from "./dataforseo";

beforeEach(() => {
  vi.stubGlobal("fetch", mocks.fetch);
  vi.stubEnv("DATAFORSEO_LOGIN", "test");
  vi.stubEnv("DATAFORSEO_PASSWORD", "test");
  mocks.cache.mockImplementation(async (_provider, _endpoint, _params, fetcher) => ({ data: await fetcher(), cached: false }));
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.resetAllMocks(); });
const respond = (status: number, result: unknown = [{ items: [{ type: "organic", url: "https://example.org/guide" }] }]) =>
  new Response(JSON.stringify({ status_code: 20000, cost: 0.002, tasks: [{ status_code: status, status_message: "Provider status", result }] }),
    { headers: { "content-type": "application/json" } });

describe("article source search provider", () => {
  it("retains completed partial SERP results and records their real cost once", async () => {
    mocks.fetch.mockResolvedValue(respond(40106));
    const cost = vi.fn();
    expect(await articleSearch("reader question", "United States", "English", cost)).toEqual({
      cached: false, items: [{ type: "organic", url: "https://example.org/guide" }],
    });
    expect(cost).toHaveBeenCalledExactlyOnceWith(0.002);
    expect(JSON.parse(mocks.fetch.mock.calls[0][1].body)).toEqual([{
      keyword: "reader question", location_name: "United States", language_name: "English", depth: 30,
    }]);
    expect(new DataForSeoError("Partial results", undefined, 40106).notBilled).toBe(false);
  });
  it("still rejects failed tasks and partial responses with no result array", async () => {
    for (const status of [40103, 40106]) {
      mocks.fetch.mockResolvedValueOnce(respond(status, null));
      const cost = vi.fn();
      await expect(articleSearch("question", "United States", "English", cost)).rejects.toMatchObject({ apiStatusCode: status });
      expect(cost).toHaveBeenCalledExactlyOnceWith(0.002);
    }
    expect(new DataForSeoError("Refused", undefined, 40210).notBilled).toBe(true);
  });
  it("keeps no more than 30 organic destinations, including partial responses", async () => {
    mocks.fetch.mockResolvedValue(respond(40106, [{ items: [
      { type: "paid", url: "https://advert.example/" }, { type: "organic", url: null },
      ...Array.from({ length: 40 }, (_, i) => ({ type: "organic", url: `https://example.org/${i}` })),
    ] }]));
    const result = await articleSearch("question", "United States", "English", vi.fn());
    expect(result.items).toHaveLength(30);
    expect(result.items[0].url).toBe("https://example.org/0");
  });
  it("does not charge cached results again or call an unmeasured failure free", async () => {
    mocks.cache.mockResolvedValueOnce({ cached: true, data: [{ items: [{ type: "organic", url: "https://example.org/guide" }] }] });
    const cachedCost = vi.fn();
    expect((await articleSearch("question", "United States", "English", cachedCost)).cached).toBe(true);
    expect(mocks.fetch).not.toHaveBeenCalled();
    expect(cachedCost).not.toHaveBeenCalled();
    mocks.fetch.mockRejectedValueOnce(new Error("Connection failed"));
    const unknownCost = vi.fn();
    await expect(articleSearch("question", "United States", "English", unknownCost)).rejects.toThrow("Connection failed");
    expect(unknownCost).toHaveBeenCalledExactlyOnceWith(undefined);
  });
});
