import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { OnboardingHelp } from "@/lib/admin/onboarding-help";

/** Admin -> Onboarding help renders its switch, funnel, trend and recent list (data mocked). */

const data = vi.hoisted(() => ({ value: null as unknown }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/lib/email/send", () => ({ sendEmail: vi.fn() }));
vi.mock("@/lib/admin/onboarding-help", async (original) => ({
  ...(await original<typeof import("@/lib/admin/onboarding-help")>()),
  getOnboardingHelp: async () => data.value,
}));

import OnboardingHelpPage from "./page";

const perDay = Array.from({ length: 30 }, (_, i) => ({
  day: `2026-10-${String(i + 1).padStart(2, "0")}`,
  signups: 1,
  welcomed: i === 29 ? 2 : 0,
  opened: 0,
  dismissed: 0,
  answered: 0,
  completed: 0,
}));

const help = (extra: Partial<OnboardingHelp> = {}): OnboardingHelp => ({
  switchOn: false,
  crispConfigured: true,
  crispApiConfigured: false,
  since: new Date("2026-10-01T00:00:00.000Z"),
  totals: { eligible: 10, welcomed: 4, opened: 2, dismissed: 1, answered: 1, completed: 3, conversationFirst: 2, foundInCrisp: 1 },
  perDay,
  recent: [
    {
      userId: "u1",
      name: "Ana",
      email: "ana@example.com",
      organizationId: "o1",
      organizationName: "Ana's shop",
      plan: "Grow · trial",
      signedUpAt: new Date("2026-10-29T08:00:00.000Z"),
      welcomedAt: new Date("2026-10-29T08:01:00.000Z"),
      openedAt: null,
      dismissedAt: null,
      answeredAt: null,
      completedAt: null,
      firstMessageAt: null,
      foundInCrisp: false,
      supportRequests: 0,
    },
    {
      userId: "u2",
      name: "Dee",
      email: null,
      organizationId: null,
      organizationName: null,
      plan: "No plan",
      signedUpAt: null,
      welcomedAt: null,
      openedAt: null,
      dismissedAt: null,
      answeredAt: null,
      completedAt: null,
      firstMessageAt: new Date("2026-10-30T09:00:00.000Z"),
      foundInCrisp: true,
      supportRequests: 0,
    },
  ],
  ...extra,
});

describe("Admin -> Onboarding help", () => {
  it("shows the switch off with the owner step, the funnel with rates, the trend and the list", async () => {
    data.value = help();
    const html = renderToStaticMarkup(await OnboardingHelpPage());
    expect(html).toContain("CRISP_ONBOARDING_WELCOME");
    expect(html).toContain("Set CRISP_ONBOARDING_WELCOME=1 in Vercel");
    expect(html).toContain("40% of eligible");
    expect(html).toContain("50% of welcomed");
    expect(html).toContain("75% of welcomed");
    expect(html).toContain("2026-10-29 08:01 UTC");
    expect(html).toContain("Grow · trial");
    expect(html).toContain("conversation found in Crisp");
    expect(html.match(/<tr/g)?.length).toBeGreaterThanOrEqual(30);
  });

  it("says when the switch is on, and when nothing happened yet", async () => {
    data.value = help({ switchOn: true, crispApiConfigured: true, recent: [] });
    const html = renderToStaticMarkup(await OnboardingHelpPage());
    expect(html).toContain("Welcomes are being claimed");
    expect(html).toContain("Crisp is asked by email");
    expect(html).toContain("No welcomes or conversations yet");
  });
});
