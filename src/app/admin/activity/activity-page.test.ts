import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The activity page as rendered: still guarded, every filter reachable, times
 * in UTC, summaries as plain text, and the actor visible on a phone (in the
 * line under the summary). Static markup, so data and auth are stubbed.
 */

const state = vi.hoisted(() => ({
  search: "",
  rows: [] as unknown[],
  total: 0,
  actors: [] as string[],
  calls: [] as unknown[],
  guarded: 0,
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/activity",
  useRouter: () => ({ push: () => {}, refresh: () => {}, replace: () => {} }),
  useSearchParams: () => new URLSearchParams(state.search),
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode; [key: string]: unknown }) =>
    createElement("a", { href, ...rest }, children),
}));
vi.mock("@/lib/admin/guard", () => ({
  requireAdmin: async () => {
    state.guarded += 1;
    return { userId: "u", email: "admin@example.com" };
  },
}));
vi.mock("@/lib/admin/audit", () => ({
  listAdminActions: async (options: unknown) => {
    state.calls.push(options);
    return { rows: state.rows, total: state.total, page: 1, pageSize: 25 };
  },
  listAuditActors: async () => state.actors,
}));

import AdminActivityPage from "./page";

async function render(query: Record<string, string> = {}) {
  state.search = new URLSearchParams(query).toString();
  const element = await AdminActivityPage({ searchParams: Promise.resolve(query), params: Promise.resolve({}) } as never);
  return renderToStaticMarkup(element);
}

const row = (over: Record<string, unknown> = {}) => ({
  id: "e1",
  actorEmail: "ops@example.com",
  action: "payment.refunded",
  targetType: "payment",
  targetId: "pay_1",
  organizationId: "org_1",
  summary: "Refunded 49.00 EUR - <b>customer asked</b>",
  createdAt: new Date("2026-10-02T14:05:09Z"),
  ...over,
});

beforeEach(() => {
  state.rows = [];
  state.total = 0;
  state.actors = [];
  state.calls = [];
  state.guarded = 0;
});

describe("admin activity page", () => {
  it("guards, and passes the filters to the query unchanged", async () => {
    await render({ actor: "ops@example.com", action: "website.deleted", when: "7d", page: "2" });
    expect(state.guarded).toBe(1);
    const call = state.calls[0] as { page: number; actor: string; action: string; since: Date | null };
    expect(call.page).toBe(2);
    expect(call.actor).toBe("ops@example.com");
    expect(call.action).toBe("website.deleted");
    expect(call.since).toBeInstanceOf(Date);
  });

  it("renders an entry readably: UTC time, label, plain-text summary, actor under it on phones, target link", async () => {
    state.rows = [row()];
    state.total = 1;
    state.actors = ["ops@example.com"];
    const html = await render();
    expect(html).toContain("2 Oct 2026");
    expect(html).toContain("14:05:09 UTC");
    expect(html).toContain('dateTime="2026-10-02T14:05:09.000Z"');
    expect(html).toContain("Payment refunded");
    expect(html).toContain("&lt;b&gt;customer asked&lt;/b&gt;");
    expect(html).not.toContain("<b>customer asked</b>");
    expect(html).toMatch(/class="[^"]*md:hidden[^"]*">by ops@example.com/);
    expect(html).toContain('href="/admin/payments?org=org_1"');
    expect(html).toContain("1 entry");
    // Read-only: nothing on the page edits or deletes an entry.
    expect(html).not.toMatch(/>(Delete|Edit|Remove)</);
  });

  it("separates an empty log from no matches", async () => {
    expect(await render()).toContain("Nothing recorded yet");
    const filtered = await render({ action: "blog.post_deleted" });
    expect(filtered).toContain("No entries match");
    expect(filtered).toContain('href="/admin/activity"');
  });

  it("does not count an unrecognised range as a filter, and still shows it in the control", async () => {
    const html = await render({ when: "forever" });
    expect(html).toContain("Nothing recorded yet");
    expect(html).toContain("(not a range - ignored)");
  });

  it("offers a way back from a page past the end", async () => {
    state.total = 30;
    const html = await render({ page: "9", action: "payment.refunded" });
    expect(html).toContain("past the end");
    expect(html).toContain('href="/admin/activity?action=payment.refunded&amp;page=2"');
  });
});
