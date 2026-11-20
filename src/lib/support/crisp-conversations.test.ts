import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/email/send", () => ({ sendEmail: vi.fn() }));

import { crispConversationExists, resetCrispConversationCheck } from "./crisp-conversations";
import type { CrispApiConfig } from "./crisp-digest";

/**
 * The welcome's question to Crisp (ticket 2026-11-19, item 6: "do not show it
 * to ... anyone who has already started a support conversation"), against a
 * stubbed fetch: a conversation with a message is "exists"; no profile, no
 * conversation or only empty sessions is "none"; unset, failing, rate limited
 * or slow is "unknown" with a warning - never an exception.
 */

const CONFIG: CrispApiConfig = { identifier: "id-1", key: "key-1", tier: "website", websiteId: "site-1" };
const LIST = "https://api.crisp.chat/v1/website/site-1/people/conversations/ana%2Btest%40example.com/list/1";

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

function stub(routes: Record<string, () => Response | Promise<Response>>) {
  return vi.fn(async (url: string | URL | Request) => {
    const key = String(url);
    const route = routes[key];
    if (!route) throw new Error(`unexpected request ${key}`);
    return route();
  }) as unknown as typeof fetch & ReturnType<typeof vi.fn>;
}

let warn: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  resetCrispConversationCheck();
  warn = vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => warn.mockRestore());

describe("crispConversationExists", () => {
  it("asks by the email, with the website token, and finds a conversation that has a message", async () => {
    const fetcher = stub({
      [LIST]: () => json(200, { error: false, reason: "listed", data: ["session_empty", "session_old"] }),
      "https://api.crisp.chat/v1/website/site-1/conversation/session_empty": () => json(200, { error: false, data: { session_id: "session_empty", last_message: "" } }),
      "https://api.crisp.chat/v1/website/site-1/conversation/session_old": () => json(200, { error: false, data: { session_id: "session_old", last_message: "Hi, how do I connect WordPress?" } }),
    });
    expect(await crispConversationExists("  Ana+Test@Example.com ", { config: CONFIG, fetcher })).toBe("exists");
    const [, init] = fetcher.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>).Authorization).toBe(`Basic ${Buffer.from("id-1:key-1").toString("base64")}`);
    expect((init.headers as Record<string, string>)["X-Crisp-Tier"]).toBe("website");
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("is none without a people profile (404), with no conversations, or with only empty sessions (the visit being welcomed)", async () => {
    expect(await crispConversationExists("ana+test@example.com", { config: CONFIG, fetcher: stub({ [LIST]: () => json(404, { error: true, reason: "not_found" }) }) })).toBe("none");
    expect(await crispConversationExists("ana+test@example.com", { config: CONFIG, fetcher: stub({ [LIST]: () => json(200, { error: false, data: [] }) }) })).toBe("none");
    const empty = stub({
      [LIST]: () => json(200, { error: false, data: ["session_now"] }),
      "https://api.crisp.chat/v1/website/site-1/conversation/session_now": () => json(200, { error: false, data: { session_id: "session_now", last_message: "", preview_message: null } }),
    });
    expect(await crispConversationExists("ana+test@example.com", { config: CONFIG, fetcher: empty })).toBe("none");
    expect(warn).not.toHaveBeenCalled();
  });

  it("reads list items that already are conversation objects without a second request", async () => {
    const fetcher = stub({ [LIST]: () => json(200, { error: false, data: [{ session_id: "s1", preview_message: { excerpt: "Question about billing" } }] }) });
    expect(await crispConversationExists("ana+test@example.com", { config: CONFIG, fetcher })).toBe("exists");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("is unknown, makes no request and warns once, without the API token", async () => {
    const fetcher = stub({});
    expect(await crispConversationExists("ana@example.com", { config: null, fetcher })).toBe("unknown");
    expect(await crispConversationExists("ana@example.com", { config: null, fetcher })).toBe("unknown");
    expect(fetcher).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(await crispConversationExists("", { config: CONFIG, fetcher })).toBe("unknown");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("is unknown with a warning on an error, an error body, a network failure or a timeout - never throws", async () => {
    for (const route of [
      () => json(500, { error: true }),
      () => json(403, { error: true, reason: "not_allowed" }),
      () => json(200, { error: true, reason: "invalid_session" }),
      () => {
        throw new TypeError("fetch failed");
      },
      () => {
        throw new DOMException("The operation was aborted due to timeout", "TimeoutError");
      },
    ]) {
      expect(await crispConversationExists("ana+test@example.com", { config: CONFIG, fetcher: stub({ [LIST]: route }) })).toBe("unknown");
    }
    expect(warn).toHaveBeenCalledTimes(5);
  });

  it("gives up after its own short timeout when Crisp does not answer", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    try {
      const fetcher = vi.fn(
        (_url: string, init: RequestInit) =>
          new Promise<Response>((_resolve, reject) => init.signal?.addEventListener("abort", () => reject(init.signal?.reason))),
      ) as unknown as typeof fetch;
      const pending = crispConversationExists("ana+test@example.com", { config: CONFIG, fetcher });
      await vi.advanceTimersByTimeAsync(3_100);
      expect(await pending).toBe("unknown");
    } finally {
      vi.useRealTimers();
    }
  });

  it("after 429 / 420 asks nothing for ten minutes", async () => {
    let clock = 1_000_000;
    const now = () => clock;
    const limited = stub({ [LIST]: () => json(429, { error: true, reason: "rate_limited" }) });
    expect(await crispConversationExists("ana+test@example.com", { config: CONFIG, fetcher: limited, now })).toBe("unknown");
    const ok = stub({ [LIST]: () => json(200, { error: false, data: [] }) });
    clock += 9 * 60 * 1000;
    expect(await crispConversationExists("ana+test@example.com", { config: CONFIG, fetcher: ok, now })).toBe("unknown");
    expect(ok).not.toHaveBeenCalled();
    clock += 2 * 60 * 1000;
    expect(await crispConversationExists("ana+test@example.com", { config: CONFIG, fetcher: ok, now })).toBe("none");
    resetCrispConversationCheck();
    const calm = stub({ [LIST]: () => json(420, {}) });
    expect(await crispConversationExists("ana+test@example.com", { config: CONFIG, fetcher: calm })).toBe("unknown");
    expect(await crispConversationExists("ana+test@example.com", { config: CONFIG, fetcher: ok })).toBe("unknown");
  });
});
