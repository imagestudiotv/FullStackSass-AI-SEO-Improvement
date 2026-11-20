import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/admin/guard", () => ({
  adminEmails: () => (process.env.ADMIN_EMAILS ?? "").split(",").map((e) => e.trim()).filter(Boolean),
}));
const sent = vi.hoisted(() => [] as { to: string; subject: string; text: string; html: string }[]);
vi.mock("@/lib/email/send", () => ({
  sendEmail: vi.fn(async (email: { to: string; subject: string; text: string; html: string }) => {
    sent.push(email);
    return { ok: true };
  }),
}));

import { crispApiConfig, digestEmail, fetchDigestConversations, sendCrispDigest } from "./crisp-digest";

/** The daily Crisp digest (ticket 2026-11-19, item 6b): inert without a token, deduplicated, escaped, silent on empty days. */

const WEBSITE = "11111111-2222-3333-4444-555555555555";
const ENV = { CRISP_API_IDENTIFIER: "id", CRISP_API_KEY: "key", NEXT_PUBLIC_CRISP_WEBSITE_ID: WEBSITE };
const NOW = new Date("2026-11-19T07:30:00.000Z");

function crisp(pages: Record<string, unknown[]>) {
  const calls: { url: string; headers: Record<string, string> }[] = [];
  const fetcher = vi.fn(async (url: string, init: { headers: Record<string, string> }) => {
    calls.push({ url, headers: init.headers });
    const key = url.includes("filter_not_resolved") ? "open" : "recent";
    return new Response(JSON.stringify({ error: false, reason: "listed", data: pages[key] ?? [] }), { status: 200 });
  });
  return { fetcher: fetcher as unknown as typeof fetch, calls };
}

afterEach(() => {
  vi.unstubAllEnvs();
  sent.length = 0;
});

describe("crispApiConfig", () => {
  it("is off unless the identifier, key and website id are all set", () => {
    expect(crispApiConfig({})).toBeNull();
    expect(crispApiConfig({ ...ENV, CRISP_API_KEY: " " })).toBeNull();
    expect(crispApiConfig(ENV)).toEqual({ identifier: "id", key: "key", tier: "website", websiteId: WEBSITE });
    expect(crispApiConfig({ ...ENV, CRISP_API_TIER: "plugin" })?.tier).toBe("plugin");
  });
});

describe("fetchDigestConversations", () => {
  it("asks for the last 24 hours and the unresolved ones with the token, once each conversation", async () => {
    const { fetcher, calls } = crisp({
      recent: [{ session_id: "session_a", state: "resolved", updated_at: NOW.getTime() - 1000, meta: { nickname: "Ana", email: "ana@example.com" }, last_message: "Thanks!" }],
      open: [
        { session_id: "session_a", state: "resolved", updated_at: NOW.getTime() - 1000 },
        { session_id: "session_b", state: "pending", updated_at: NOW.getTime() - 5000, preview_message: { excerpt: "How do I connect WordPress?" }, unread: { operator: 2 } },
      ],
    });
    const list = await fetchDigestConversations(crispApiConfig(ENV)!, NOW, fetcher);
    expect(list.map((c) => c.sessionId)).toEqual(["session_a", "session_b"]);
    expect(list[1]).toMatchObject({ who: "Anonymous visitor", preview: "How do I connect WordPress?", unreadByUs: 2, state: "pending" });
    expect(calls).toHaveLength(2);
    expect(calls[0].headers.Authorization).toBe(`Basic ${Buffer.from("id:key").toString("base64")}`);
    expect(calls[0].headers["X-Crisp-Tier"]).toBe("website");
    expect(calls[0].url).toContain(`/v1/website/${WEBSITE}/conversations/1?`);
    expect(decodeURIComponent(calls[0].url)).toContain("filter_date_start=2026-11-18T07:30:00.000Z");
  });

  it("fails loudly on an API error rather than reporting a quiet day", async () => {
    const fetcher = vi.fn(async () => new Response("{}", { status: 401 })) as unknown as typeof fetch;
    await expect(fetchDigestConversations(crispApiConfig(ENV)!, NOW, fetcher)).rejects.toThrow("401");
  });
});

describe("digestEmail", () => {
  it("escapes what visitors typed", () => {
    const email = digestEmail(
      [{ sessionId: "s", who: "<script>x</script>", email: null, state: "unresolved", preview: "<b>hi</b>", updatedAt: NOW, unreadByUs: 0, link: "https://app.crisp.chat/website/w/inbox/s/" }],
      WEBSITE,
      NOW,
    );
    expect(email.html).not.toContain("<script>x</script>");
    expect(email.html).toContain("&lt;b&gt;hi&lt;/b&gt;");
    expect(email.subject).toBe("Crisp: 1 conversation, 1 not resolved (2026-11-19)");
  });
});

describe("sendCrispDigest", () => {
  it("does nothing without the token", async () => {
    vi.stubEnv("CRISP_API_IDENTIFIER", "");
    expect((await sendCrispDigest(NOW, crisp({}).fetcher)).status).toBe("off");
  });

  it("emails each admin when there is something, and nobody on a quiet day", async () => {
    for (const [k, v] of Object.entries(ENV)) vi.stubEnv(k, v);
    vi.stubEnv("ADMIN_EMAILS", "a@repget.com, b@repget.com");
    expect((await sendCrispDigest(NOW, crisp({}).fetcher)).status).toBe("nothing");
    expect(sent).toHaveLength(0);
    const result = await sendCrispDigest(NOW, crisp({ open: [{ session_id: "s1", state: "unresolved", last_message: "Help" }] }).fetcher);
    expect(result).toEqual({ status: "sent", conversations: 1, sent: 2 });
    expect(sent.map((e) => e.to)).toEqual(["a@repget.com", "b@repget.com"]);
    expect(sent[0].text).toContain(`https://app.crisp.chat/website/${WEBSITE}/inbox/s1/`);
  });
});
