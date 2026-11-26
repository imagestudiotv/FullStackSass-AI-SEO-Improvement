import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { CustomerActivity, CustomerTimeline } from "@/lib/admin/customer-activity";
import { describeActivity, type RawActivity } from "@/lib/admin/customer-activity-rules";

/** Admin -> Customer activity renders the live control, the attention box, the feed and a timeline (data mocked). */

const data = vi.hoisted(() => ({ activity: null as unknown, timeline: null as unknown, calls: [] as unknown[] }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => undefined, push: () => undefined, replace: () => undefined }),
  usePathname: () => "/admin/customer-activity",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/lib/admin/customer-activity", async (original) => ({
  ...(await original<typeof import("@/lib/admin/customer-activity")>()),
  getCustomerActivity: async (options: unknown) => {
    data.calls.push(options);
    return data.activity;
  },
  getCustomerTimeline: async () => data.timeline,
}));

import CustomerActivityPage from "./page";
import { freshKeys } from "./live";

const NOW = new Date("2026-11-26T12:00:00.000Z");
const customer = { organizationId: "org_1", name: "Ana's shop", ownerEmail: "ana@example.com", badge: { kind: "trial" as const, label: "Trial · Grow" } };
const raw = (kind: RawActivity["kind"], extra: Partial<RawActivity> = {}): RawActivity => ({
  kind,
  at: new Date(NOW.getTime() - 5 * 60_000),
  organizationId: "org_1",
  websiteId: "site_1",
  refId: `${kind}_1`,
  label: null,
  extra: null,
  amount: null,
  articleId: null,
  ...extra,
});
const row = (event: RawActivity) => ({ ...describeActivity(event, "anashop.example"), customer, domain: "anashop.example" });

const activity = (extra: Partial<CustomerActivity> = {}): CustomerActivity => ({
  now: NOW,
  since: new Date(NOW.getTime() - 7 * 24 * 60 * 60 * 1000),
  before: null,
  rows: [
    row(raw("trial_started", { label: "Grow", extra: "trialing" })),
    row(raw("payment_failed", { amount: 8900, extra: "eur", at: new Date(NOW.getTime() - 3 * 60 * 60 * 1000) })),
  ],
  truncated: false,
  attention: [
    {
      rule: "trial_no_article",
      key: "trial_no_article:sub_1",
      organizationId: "org_1",
      websiteId: "site_1",
      why: "Trial started 7 h ago and no article has been started.",
      since: new Date(NOW.getTime() - 7 * 60 * 60 * 1000),
      href: "/admin/customer-activity?org=org_1",
      hrefLabel: "Timeline",
      customer,
      domain: "anashop.example",
    },
  ],
  hiddenOurs: 2,
  ...extra,
});

const render = async (searchParams: Record<string, string>) =>
  renderToStaticMarkup(await CustomerActivityPage({ searchParams: Promise.resolve(searchParams), params: Promise.resolve({}) } as never));

describe("Admin -> Customer activity", () => {
  it("shows the live control, the attention box and the feed with customer, website, plan, event and link", async () => {
    data.activity = activity();
    const html = await render({ plan: "trial", q: "ana" });
    expect(html).toContain("Updated <time");
    expect(html).toContain("12:00:00 UTC");
    expect(html).toContain("Pause");
    expect(html).toContain("Needs attention (1)");
    expect(html).toContain("Trial started 7 h ago and no article has been started.");
    expect(html).toContain('href="/admin/customer-activity?org=org_1"');
    expect(html).toContain("Ana&#x27;s shop");
    expect(html).toContain("ana@example.com");
    expect(html).toContain("Trial · Grow");
    expect(html).toContain("Trial started on Grow");
    expect(html).toContain("Payment of €89.00 failed");
    expect(html).toContain('href="/admin/payments?org=org_1&amp;status=failed"');
    expect(html).toContain('href="/admin/websites?q=anashop.example"');
    expect(html).toContain("5 min ago");
    expect(html).toContain('title="2026-11-26 11:55:00 UTC"');
    expect(html).toContain("2 of our own workspaces hidden");
    expect(html).toContain("Load older");
    expect(html).toContain("before=2026-11-19T12%3A00%3A00.000Z");
    // No write controls: the only form is the toolbar search, which only changes the URL.
    expect(html.match(/<form/g)).toHaveLength(1);
    expect(html).not.toMatch(/method="post"|formAction|action="/i);
    expect(data.calls.at(-1)).toMatchObject({ group: "all", filters: { plan: "trial", search: "ana", includeOurs: false }, range: "7d", before: null });
  });

  it("hides the attention box when nothing needs it, and says when nothing happened", async () => {
    data.activity = activity({ rows: [], attention: [], hiddenOurs: 0 });
    const html = await render({});
    expect(html).not.toContain("Needs attention");
    expect(html).toContain("No customer activity in this range");
  });

  it("shows one workspace's timeline: plan dates, websites with their article status, articles per day, events in order", async () => {
    const timeline: CustomerTimeline = {
      now: NOW,
      workspace: {
        id: "org_1",
        name: "Ana's shop",
        createdAt: new Date("2026-11-25T08:00:00.000Z"),
        ownerEmail: "ana@example.com",
        memberEmails: ["ana@example.com"],
        domains: ["anashop.example"],
        websiteIds: ["site_1"],
        agency: false,
        onFree: false,
        subscription: { status: "trialing", planName: "Grow", tier: "grow" },
      },
      badge: { kind: "trial", label: "Trial · Grow" },
      ours: false,
      websites: [
        {
          id: "site_1",
          domain: "anashop.example",
          status: "ready",
          createdAt: new Date("2026-11-25T08:05:00.000Z"),
          firstArticle: { code: "research_not_started", message: "Its research has not started yet; it starts within ten minutes.", waiting: true },
        },
      ],
      subscriptions: [
        {
          id: "sub_1",
          websiteId: "site_1",
          planName: "Grow",
          status: "trialing",
          trial: true,
          createdAt: new Date("2026-11-25T08:10:00.000Z"),
          periodStart: null,
          periodEnd: new Date("2026-11-28T08:10:00.000Z"),
          cancelAtPeriodEnd: false,
          cancelAt: null,
        },
      ],
      freeStartedAt: null,
      articlesPerDay: [{ day: "2026-11-25", started: 2, written: 1 }],
      rows: [
        row(raw("trial_started", { label: "Grow", extra: "trialing", at: new Date("2026-11-25T08:10:00.000Z") })),
        row(raw("signup", { label: "ana@example.com", at: new Date("2026-11-25T08:00:00.000Z") })),
      ],
      truncated: false,
      attention: [],
    };
    data.timeline = timeline;
    const html = await render({ org: "org_1" });
    expect(html).toContain("All customer activity");
    expect(html).toContain("Trial ends 2026-11-28 08:10 UTC");
    expect(html).toContain("(trial)");
    expect(html).toContain("Its research has not started yet");
    expect(html).toContain("2026-11-25");
    // Oldest first.
    expect(html.indexOf("Signed up as ana@example.com")).toBeLessThan(html.indexOf("Trial started on Grow"));

    data.timeline = null;
    expect(await render({ org: "missing" })).toContain("No such workspace");
  });

  it("marks only the rows a refresh brought", () => {
    expect([...freshKeys(["a", "b"], ["c", "a", "b"])]).toEqual(["c"]);
    expect([...freshKeys([], [])]).toEqual([]);
  });
});
