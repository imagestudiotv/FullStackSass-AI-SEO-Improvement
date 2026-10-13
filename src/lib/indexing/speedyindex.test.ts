import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createIndexTask,
  describeErrorCode,
  isIndexingConfigured,
  readTaskReport,
  readTaskStatuses,
  readTokenBalance,
  sameUrl,
} from "./speedyindex";

/**
 * The SpeedyIndex client against a fake fetch: the shapes documented at
 * github.com/SpeedyIndexcom/speedyindexapi. Nothing here reaches the network.
 */

const KEY = "test-key-not-real";
const fetchMock = vi.fn();

beforeEach(() => {
  process.env.SPEEDYINDEX_API_KEY = KEY;
  delete process.env.SPEEDYINDEX_API_URL;
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  delete process.env.SPEEDYINDEX_API_KEY;
  vi.unstubAllGlobals();
});

const answer = (body: unknown, status = 200) =>
  fetchMock.mockResolvedValueOnce(new Response(typeof body === "string" ? body : JSON.stringify(body), { status }));

describe("configuration", () => {
  it("is on only with a key", () => {
    expect(isIndexingConfigured()).toBe(true);
    process.env.SPEEDYINDEX_API_KEY = "  ";
    expect(isIndexingConfigured()).toBe(false);
  });
});

describe("creating a task", () => {
  it("posts the URLs, pay-per-indexed, with the key as the Authorization header, and returns the task id", async () => {
    answer({ code: 0, task_id: "6609d023a3188540f09fec6c", type: "google/indexer" });
    expect(await createIndexTask(["https://a.test/x/"], "RepGet batch")).toBe("6609d023a3188540f09fec6c");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.speedyindex.com/v2/task/google/indexer/create");
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({ Authorization: KEY, "Content-Type": "application/json" });
    expect(JSON.parse(init.body)).toEqual({ title: "RepGet batch", urls: ["https://a.test/x/"], pay_per_indexed: true });
  });

  it("names each refusal, and never puts the key in an error", async () => {
    answer({ code: 1 });
    await expect(createIndexTask(["https://a.test/"], "t")).rejects.toMatchObject({ reason: "balance" });
    answer({ code: 2 });
    await expect(createIndexTask(["https://a.test/"], "t")).rejects.toMatchObject({ reason: "invalid" });
    answer("<html>Bad gateway</html>", 502);
    await expect(createIndexTask(["https://a.test/"], "t")).rejects.toMatchObject({ reason: "http" });
    answer({ code: 0 });
    await expect(createIndexTask(["https://a.test/"], "t")).rejects.toMatchObject({ reason: "response" });
    fetchMock.mockRejectedValueOnce(Object.assign(new Error(`connect failed with ${KEY}`), { name: "TypeError" }));
    const error = await createIndexTask(["https://a.test/"], "t").catch((e: Error) => e);
    expect(error).toMatchObject({ reason: "network" });
    expect(String((error as Error).message)).not.toContain(KEY);
  });

  it("refuses to call without a key", async () => {
    delete process.env.SPEEDYINDEX_API_KEY;
    await expect(createIndexTask(["https://a.test/"], "t")).rejects.toMatchObject({ reason: "invalid" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("reading results", () => {
  it("task progress", async () => {
    answer({
      code: 0,
      result: [{ id: "t1", size: 690, processed_count: 690, indexed_count: 279, is_completed: false, title: "x", type: "google/indexer", created_at: "2024-03-18T22:58:56.901Z" }],
    });
    expect(await readTaskStatuses(["t1"])).toEqual([{ id: "t1", size: 690, processed: 690, indexed: 279, completed: false }]);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ task_ids: ["t1"] });
    expect(await readTaskStatuses([])).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("the full report: indexed addresses, and the others with their error code", async () => {
    answer({
      code: 0,
      result: {
        id: "t1",
        size: 3,
        processed_count: 3,
        indexed_links: [{ url: "https://a.test/one/", title: "One" }],
        unindexed_links: [{ url: "https://a.test/two/", error_code: -1 }, { url: "https://a.test/three/" }, { title: "no url" }],
      },
    });
    expect(await readTaskReport("t1")).toEqual({
      indexed: ["https://a.test/one/"],
      unindexed: [
        { url: "https://a.test/two/", errorCode: -1 },
        { url: "https://a.test/three/", errorCode: null },
      ],
    });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ task_id: "t1" });
  });

  it("the token balance", async () => {
    answer({ code: 0, balance: { tokens: 5000, indexer: 10014495, checker: 100732 } });
    expect(await readTokenBalance()).toBe(5000);
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.speedyindex.com/v2/account");
    expect(fetchMock.mock.calls[0][1].method).toBe("GET");
  });
});

describe("matching addresses", () => {
  it("ignores host case, a trailing slash and a fragment - not the path or the query", () => {
    expect(sameUrl("https://A.test/post/", "https://a.test/post")).toBe(true);
    expect(sameUrl("https://a.test/post#top", "https://a.test/post/")).toBe(true);
    expect(sameUrl("https://a.test/post", "https://a.test/other")).toBe(false);
    expect(sameUrl("https://a.test/?p=1", "https://a.test/?p=2")).toBe(false);
  });

  it("describes why an address was not indexed", () => {
    expect(describeErrorCode(-1)).toBe("The page has a noindex tag");
    expect(describeErrorCode(404)).toBe("The page answered HTTP 404");
    expect(describeErrorCode(0)).toBe("Google did not index it");
    expect(describeErrorCode(null)).toBe("Google did not index it");
  });
});
