import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * IndexNow reports for RepGet's own pages (client's launch review,
 * 2026-10-03): the right report, only from production, only after the
 * response, and never a failure for the save that triggered it.
 */

const scheduled = vi.hoisted(() => ({ callbacks: [] as (() => Promise<void>)[], outsideRequest: false }));
vi.mock("next/server", () => ({
  after: (callback: () => Promise<void>) => {
    if (scheduled.outsideRequest) throw new Error("`after` was called outside a request scope");
    scheduled.callbacks.push(callback);
  },
}));

import { INDEXNOW_KEY, indexNowPayload, notifyIndexNow, submitToIndexNow } from "./indexnow";

const PUBLIC = path.resolve(__dirname, "../../public");

describe("the key", () => {
  it("has the form IndexNow accepts", () => {
    expect(INDEXNOW_KEY).toMatch(/^[a-zA-Z0-9-]{8,128}$/);
  });

  /** The engines fetch the key back from the site; a mismatch rejects every report (HTTP 403). */
  it("is served, exactly, as public/<key>.txt - and no stale key file is left beside it", () => {
    expect(readFileSync(path.join(PUBLIC, `${INDEXNOW_KEY}.txt`), "utf8")).toBe(INDEXNOW_KEY);
    expect(readdirSync(PUBLIC).filter((name) => /^[0-9a-f]{32}\.txt$/.test(name))).toEqual([`${INDEXNOW_KEY}.txt`]);
  });
});

describe("indexNowPayload", () => {
  it("names the site, the key, where the key is, and each changed address once, in full", () => {
    expect(indexNowPayload(["/blog/a-post", "/blog", "/blog/category/guides", "/blog"], "https://www.repget.com")).toEqual({
      host: "www.repget.com",
      key: INDEXNOW_KEY,
      keyLocation: `https://www.repget.com/${INDEXNOW_KEY}.txt`,
      urlList: ["https://www.repget.com/blog/a-post", "https://www.repget.com/blog", "https://www.repget.com/blog/category/guides"],
    });
  });

  /** A report naming another host is rejected whole (HTTP 422), so one stray address would sink the rest. */
  it("leaves out any address on another host", () => {
    const payload = indexNowPayload(["https://elsewhere.example/x", "//elsewhere.example/y", "https://repget.com/apex", "/blog"], "https://www.repget.com");
    expect(payload?.urlList).toEqual(["https://www.repget.com/blog"]);
  });

  it("is nothing when there is nothing of this site's to report", () => {
    expect(indexNowPayload([], "https://www.repget.com")).toBeNull();
    expect(indexNowPayload(["https://elsewhere.example/x"], "https://www.repget.com")).toBeNull();
  });

  it("keeps a port in the host", () => {
    expect(indexNowPayload(["/blog"], "http://127.0.0.1:3230")).toMatchObject({
      host: "127.0.0.1:3230",
      keyLocation: `http://127.0.0.1:3230/${INDEXNOW_KEY}.txt`,
      urlList: ["http://127.0.0.1:3230/blog"],
    });
  });
});

describe("submitToIndexNow", () => {
  const payload = indexNowPayload(["/blog"], "https://www.repget.com")!;

  afterEach(() => vi.unstubAllEnvs());

  it("POSTs the report as JSON to the shared endpoint and returns the status", async () => {
    vi.stubEnv("INDEXNOW_ENDPOINT", "");
    const fetchImpl = vi.fn(async () => new Response(null, { status: 202 }));
    expect(await submitToIndexNow(payload, { fetchImpl })).toBe(202);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.indexnow.org/indexnow");
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual({ "content-type": "application/json; charset=utf-8" });
    expect(JSON.parse(String(init.body))).toEqual(payload);
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("goes to INDEXNOW_ENDPOINT instead when it is set (a local stand-in)", async () => {
    vi.stubEnv("INDEXNOW_ENDPOINT", " http://127.0.0.1:55442/indexnow ");
    const fetchImpl = vi.fn(async () => new Response(null, { status: 200 }));
    await submitToIndexNow(payload, { fetchImpl });
    expect(fetchImpl.mock.calls[0][0 as never]).toBe("http://127.0.0.1:55442/indexnow");
  });

  it("gives up when the endpoint does not answer in time", async () => {
    const fetchImpl = vi.fn(
      (_url: string | URL | Request, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => init?.signal?.addEventListener("abort", () => reject(init.signal?.reason))),
    );
    await expect(submitToIndexNow(payload, { fetchImpl: fetchImpl as typeof fetch, timeoutMs: 30 })).rejects.toThrow();
  });
});

describe("notifyIndexNow", () => {
  const fetchMock = vi.fn(async () => new Response(null, { status: 200 }));
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

  beforeEach(() => {
    scheduled.callbacks.length = 0;
    scheduled.outsideRequest = false;
    fetchMock.mockClear();
    fetchMock.mockImplementation(async () => new Response(null, { status: 200 }));
    warn.mockClear();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://www.repget.com");
    vi.stubEnv("INDEXNOW_ENDPOINT", "");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  /** A preview, a laptop or a test run must never announce pages as repget.com's. */
  it("does nothing anywhere but production", async () => {
    for (const env of [undefined, "", "preview", "development", "Production"]) {
      vi.stubEnv("VERCEL_ENV", env as string);
      notifyIndexNow(["/blog/a-post"]);
    }
    expect(scheduled.callbacks).toHaveLength(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("in production, sends the report only once the response is finished", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    notifyIndexNow(["/blog/a-post", "/blog", "/blog/category/guides"]);
    // Scheduled, not sent: the save's response is not waiting on it.
    expect(scheduled.callbacks).toHaveLength(1);
    expect(fetchMock).not.toHaveBeenCalled();

    await scheduled.callbacks[0]();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.indexnow.org/indexnow");
    expect(JSON.parse(String(init.body))).toEqual({
      host: "www.repget.com",
      key: INDEXNOW_KEY,
      keyLocation: `https://www.repget.com/${INDEXNOW_KEY}.txt`,
      urlList: ["https://www.repget.com/blog/a-post", "https://www.repget.com/blog", "https://www.repget.com/blog/category/guides"],
    });
    expect(warn).not.toHaveBeenCalled();
  });

  it("schedules nothing for an empty list", () => {
    vi.stubEnv("VERCEL_ENV", "production");
    notifyIndexNow([]);
    expect(scheduled.callbacks).toHaveLength(0);
  });

  it("treats 200 and 202 as accepted, and logs any other answer without throwing", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    for (const status of [200, 202, 400, 403, 422, 429, 500]) {
      fetchMock.mockImplementationOnce(async () => new Response(null, { status }));
      notifyIndexNow(["/blog"]);
      await expect(scheduled.callbacks.at(-1)!()).resolves.toBeUndefined();
    }
    expect(warn.mock.calls.map(([message]) => String(message).match(/HTTP (\d+)/)?.[1])).toEqual(["400", "403", "422", "429", "500"]);
  });

  it("logs a network failure or timeout without throwing", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    fetchMock.mockImplementationOnce(async () => {
      throw new TypeError("fetch failed");
    });
    notifyIndexNow(["/blog"]);
    await expect(scheduled.callbacks[0]()).resolves.toBeUndefined();
    expect(String(warn.mock.calls[0][0])).toMatch(/not sent: fetch failed/);
  });

  it("never throws into the caller, even outside a request", () => {
    vi.stubEnv("VERCEL_ENV", "production");
    scheduled.outsideRequest = true;
    expect(() => notifyIndexNow(["/blog"])).not.toThrow();
    expect(String(warn.mock.calls[0][0])).toMatch(/not scheduled/);
  });
});
