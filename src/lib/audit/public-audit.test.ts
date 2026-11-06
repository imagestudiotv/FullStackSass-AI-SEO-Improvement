import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * What stands between the audit form and a crawl (client's redesign,
 * 2026-11-05: the form changed, none of this may have).
 *
 * The form only navigates to /audit?domain=, so whatever reaches this function
 * reaches it whichever form sent it, or none. No database and no network: the
 * cache reads empty, the guard and the crawl are spies, and normalizeWebsiteUrl
 * is the real one.
 */

const spies = vi.hoisted(() => ({ guard: vi.fn(), crawl: vi.fn() }));

vi.mock("@/lib/db", () => ({
  db: { select: () => ({ from: () => ({ where: () => ({ limit: async () => [] }) }) }) },
}));
vi.mock("@/lib/tools/public-guard", () => ({ guardPublicTool: spies.guard }));
vi.mock("@/lib/audit/crawler", () => ({ crawlSite: spies.crawl }));

import { PUBLIC_AUDIT_MAX_PAGES } from "./limits";
import { runPublicAudit } from "./public-audit";

beforeEach(() => {
  spies.guard.mockReset();
  spies.crawl.mockReset();
});

describe("an address that may not be fetched", () => {
  it.each([
    "",
    "not a website",
    "localhost",
    "localhost.",
    "127.0.0.1",
    "http://127.0.0.1:3000/",
    "10.0.0.1",
    "192.168.1.1",
    "169.254.169.254",
    "http://169.254.169.254/latest/meta-data/",
    "[::1]",
    "file:///etc/passwd",
    "javascript:alert(1)",
    "not-a-site.invalid",
  ])("%j is refused before the limits and before any crawl", async (input) => {
    const outcome = await runPublicAudit(input, "visitor");
    expect(outcome).toMatchObject({ ok: false, error: { kind: "invalid_url" } });
    expect(spies.guard).not.toHaveBeenCalled();
    expect(spies.crawl).not.toHaveBeenCalled();
  });
});

describe("an address that may be", () => {
  it("goes through the audit's own limits, for this visitor and this site", async () => {
    spies.guard.mockResolvedValue({ ok: false, refusal: { kind: "rate_limited", message: "You have run this check several times in the last hour." } });
    await runPublicAudit("https://www.example.com/", "visitor-1");
    expect(spies.guard).toHaveBeenCalledTimes(1);
    expect(spies.guard.mock.calls[0][0]).toMatchObject({ tool: "audit", site: "example.com", visitor: "visitor-1" });
  });

  it("over the limit: says so, and crawls nothing", async () => {
    spies.guard.mockResolvedValue({ ok: false, refusal: { kind: "rate_limited", message: "You have run this check several times in the last hour." } });
    const outcome = await runPublicAudit("example.com", "visitor-1");
    expect(outcome).toEqual({ ok: false, error: { kind: "rate_limited", message: "You have run this check several times in the last hour." } });
    expect(spies.crawl).not.toHaveBeenCalled();
  });

  it.each(["busy", "in_progress", "unavailable"])("refused as %s: says so, and crawls nothing", async (kind) => {
    spies.guard.mockResolvedValue({ ok: false, refusal: { kind, message: "Try again." } });
    expect(await runPublicAudit("example.com", "visitor-1")).toEqual({ ok: false, error: { kind: "rate_limited", message: "Try again." } });
    expect(spies.crawl).not.toHaveBeenCalled();
  });

  it("crawls only when the guard runs it, and at the free check's page limit", async () => {
    spies.crawl.mockRejectedValue(new Error("unreachable"));
    spies.guard.mockImplementation(async ({ run }: { run: () => Promise<unknown> }) => ({ ok: true, value: await run() }));
    const outcome = await runPublicAudit("example.com", "visitor-1");
    expect(spies.crawl).toHaveBeenCalledTimes(1);
    expect(spies.crawl.mock.calls[0][1]).toBe(PUBLIC_AUDIT_MAX_PAGES);
    expect(outcome).toMatchObject({ ok: false, error: { kind: "unreachable" } });
  });
});
