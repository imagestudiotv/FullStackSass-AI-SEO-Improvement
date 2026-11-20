import { randomUUID } from "node:crypto";

import { beforeAll, describe, expect, it, vi } from "vitest";

import { member, organization, user } from "@/lib/db/auth-tables";
import { payments, plans, subscriptions, supportChatState } from "@/lib/db/schema";
import { createTestDb, type TestDb } from "@/test/db";

/**
 * Admin -> Onboarding help's numbers (ticket 2026-11-19, item 6: "Track when
 * the welcome message is triggered, opened, dismissed and answered, together
 * with whether the user completes onboarding"), on a disposable database:
 * the funnel of the window's sign-ups, the rates, the daily trend, the recent
 * list with plan and Crisp finding, the switch, and the admin guard.
 */

vi.mock("server-only", () => ({}));
const state = vi.hoisted(() => ({ db: null as unknown, admin: true }));
vi.mock("@/lib/db", () => ({ db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }) }));
vi.mock("@/lib/email/send", () => ({ sendEmail: vi.fn() }));
vi.mock("@/lib/admin/guard", () => ({
  requireAdmin: async () => {
    if (!state.admin) throw new Error("not admin");
    return { email: "admin@repget.test" };
  },
}));

import { getOnboardingHelp, planLabel, rate, windowStart } from "./onboarding-help";

let test: TestDb;
beforeAll(async () => {
  test = await createTestDb();
  state.db = test.db;
}, 180_000);

const NOW = new Date("2026-11-20T12:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;
const ago = (days: number, ms = 0) => new Date(NOW.getTime() - days * DAY + ms);

async function account(name: string, createdAt: Date, chat: Partial<typeof supportChatState.$inferInsert> | null, role = "owner") {
  const userId = `u_${name}_${randomUUID().slice(0, 6)}`;
  const orgId = `org_${name}_${randomUUID().slice(0, 6)}`;
  await test.db.insert(user).values({ id: userId, name, email: `${userId}@example.com`, createdAt, updatedAt: createdAt });
  await test.db.insert(organization).values({ id: orgId, name: `${name} workspace`, slug: orgId, createdAt });
  await test.db.insert(member).values({ id: `m_${userId}`, organizationId: orgId, userId, role, createdAt });
  if (chat) await test.db.insert(supportChatState).values({ userId, organizationId: orgId, createdAt, updatedAt: createdAt, ...chat });
  return { userId, orgId };
}

describe("getOnboardingHelp", () => {
  it("counts the funnel, the rates, the trend and the recent list", async () => {
    // Welcomed, opened, answered, finished setup.
    const ana = await account("ana", ago(3), {
      welcomedAt: ago(3, 60_000),
      welcomeOpenedAt: ago(3, 90_000),
      welcomeAnsweredAt: ago(3, 120_000),
      firstMessageAt: ago(3, 120_000),
      lastMessageAt: ago(3, 120_000),
      supportRequests: 1,
      onboardingCompletedAt: ago(1),
    });
    // Welcomed, opened, dismissed.
    await account("ben", ago(2), { welcomedAt: ago(2, 60_000), welcomeOpenedAt: ago(2, 70_000), welcomeDismissedAt: ago(2, 80_000) });
    // Welcomed and ignored.
    await account("cy", ago(1), { welcomedAt: ago(1, 60_000) });
    // A conversation found in Crisp: first message, no in-app message time.
    const dee = await account("dee", ago(1), { firstMessageAt: ago(1, 60_000) });
    // Wrote in the app before the welcome.
    await account("eve", ago(1), { firstMessageAt: ago(1, 30_000), lastMessageAt: ago(1, 30_000), supportRequests: 1 });
    // Eligible, nothing yet.
    await account("fay", ago(5), null);
    // Not eligible: paid in its first days; only invited to someone else's workspace; signed up before the window.
    const gus = await account("gus", ago(4), null);
    await test.db.insert(payments).values({ organizationId: gus.orgId, provider: "stripe", externalId: `in_${randomUUID()}`, amountCents: 4900, currency: "eur", status: "paid", paidAt: ago(4, 60_000) });
    await account("hal", ago(4), null, "member");
    await account("old", ago(45), { welcomedAt: ago(45, 60_000) });

    const [plan] = await test.db
      .insert(plans)
      .values({ name: "Grow", tier: `grow-${randomUUID().slice(0, 6)}`, priceCents: 4900, articleLimit: 10, keywordLimit: 10, siteLimit: 1, monthlyCredits: 0 })
      .returning({ id: plans.id });
    await test.db.insert(subscriptions).values({ organizationId: ana.orgId, planId: plan.id, status: "trialing" });

    const data = await getOnboardingHelp(NOW);
    expect(data.totals).toEqual({
      eligible: 6,
      welcomed: 3,
      opened: 2,
      dismissed: 1,
      answered: 1,
      completed: 1,
      conversationFirst: 2,
      foundInCrisp: 1,
    });
    expect(rate(data.totals.welcomed, data.totals.eligible)).toBe("50%");
    expect(rate(data.totals.opened, data.totals.welcomed)).toBe("67%");

    expect(data.perDay).toHaveLength(30);
    expect(data.perDay[0].day).toBe(windowStart(NOW).toISOString().slice(0, 10));
    const byDay = new Map(data.perDay.map((entry) => [entry.day, entry]));
    expect(byDay.get(ago(3).toISOString().slice(0, 10))).toMatchObject({ welcomed: 1, opened: 1, answered: 1 });
    expect(byDay.get(ago(1).toISOString().slice(0, 10))).toMatchObject({ welcomed: 1, completed: 1, signups: 3 });

    const names = data.recent.map((row) => row.name);
    expect(names.slice(0, 5).sort()).toEqual(["ana", "ben", "cy", "dee", "eve"]);
    expect(names).not.toContain("fay");
    expect(data.recent.find((row) => row.userId === ana.userId)).toMatchObject({ plan: "Grow · trial", organizationName: "ana workspace", supportRequests: 1 });
    expect(data.recent.find((row) => row.userId === dee.userId)).toMatchObject({ foundInCrisp: true, plan: "No plan", welcomedAt: null });
    expect(data.recent.find((row) => row.name === "eve")?.foundInCrisp).toBe(false);
  });

  it("shows the welcome switch and the Crisp API state from the environment", async () => {
    vi.stubEnv("CRISP_ONBOARDING_WELCOME", "1");
    vi.stubEnv("NEXT_PUBLIC_CRISP_WEBSITE_ID", "site-1");
    vi.stubEnv("CRISP_API_IDENTIFIER", "");
    expect(await getOnboardingHelp(NOW)).toMatchObject({ switchOn: true, crispConfigured: true, crispApiConfigured: false });
    vi.stubEnv("CRISP_ONBOARDING_WELCOME", "0");
    vi.stubEnv("CRISP_API_IDENTIFIER", "id");
    vi.stubEnv("CRISP_API_KEY", "key");
    expect(await getOnboardingHelp(NOW)).toMatchObject({ switchOn: false, crispApiConfigured: true });
    vi.unstubAllEnvs();
  });

  it("refuses anyone who is not an admin", async () => {
    state.admin = false;
    await expect(getOnboardingHelp(NOW)).rejects.toThrow("not admin");
    state.admin = true;
  });
});

describe("planLabel", () => {
  it("names the plan and its state, Free, or no plan", () => {
    expect(planLabel({ name: "Scale", status: "active" }, false)).toBe("Scale");
    expect(planLabel({ name: "Grow", status: "past_due" }, false)).toBe("Grow · past due");
    expect(planLabel(null, true)).toBe("Free");
    expect(planLabel({ name: "Grow", status: "canceled" }, true)).toBe("Free");
    expect(planLabel({ name: "Grow", status: "canceled" }, false)).toBe("Grow · canceled");
    expect(planLabel(null, false)).toBe("No plan");
  });
});
