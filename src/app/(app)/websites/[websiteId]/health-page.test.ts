import { isValidElement, type ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getMessages } from "@/lib/i18n/messages";

/**
 * What the Website health page decides on the server before the panel
 * renders: the paywall runs before anything is read, a viewer gets a
 * read-only panel and no entitlement probe, a site that cannot start a check
 * says why up front, the filters come from the URL, and the quote button is
 * not pointed at the placeholder mailbox. The panel is a stub found by
 * identity in the returned tree; its rendering is audit-panel.render.test.ts.
 */

const state = vi.hoisted(() => ({
  access: "owner" as "owner" | "editor" | "viewer",
  status: "ready",
  entitled: { ok: true } as { ok: true } | { ok: false; error: string },
  realEmail: true,
  planThrows: false,
  order: [] as string[],
}));

vi.mock("@/lib/tenant", () => ({
  requireWebsitePage: async (id: string) => ({
    userId: "u1",
    access: state.access,
    site: { id, domain: "acme.com", status: state.status, organizationId: "o1" },
  }),
}));
vi.mock("@/lib/billing/require-plan", () => ({
  requireWebsitePlan: async () => {
    state.order.push("plan");
    if (state.planThrows) throw new Error("redirect:/onboarding/plan");
  },
}));
vi.mock("@/lib/billing/entitled", () => ({
  isEntitledToSpend: async () => {
    state.order.push("entitled");
    return state.entitled;
  },
}));
vi.mock("@/lib/config/site", () => ({
  SUPPORT_EMAIL: "help@repget.com",
  hasRealSupportEmail: () => state.realEmail,
}));
vi.mock("@/lib/i18n/app-locale", async () => {
  const { getMessages: messages } = await import("@/lib/i18n/messages");
  return { getAppMessages: async () => ({ locale: "de", t: messages("de") }) };
});
vi.mock("./health-data", () => ({
  loadHealthData: async () => {
    state.order.push("load");
    return { audit: null, crawl: null, requestedAt: null };
  },
}));
vi.mock("./audit-panel", () => ({ AuditPanel: () => null }));

import { AuditPanel, type AuditPanelProps } from "./audit-panel";
import WebsiteHealthPage from "./page";

const de = getMessages("de").app.health;

async function panelProps(search: Record<string, string | string[]> = {}): Promise<AuditPanelProps> {
  const tree = await WebsiteHealthPage({
    params: Promise.resolve({ websiteId: "w1" }),
    searchParams: Promise.resolve(search),
  } as never);
  expect(isValidElement(tree)).toBe(true);
  const element = tree as ReactElement<AuditPanelProps>;
  expect(element.type).toBe(AuditPanel);
  return element.props;
}

beforeEach(() => {
  state.access = "owner";
  state.status = "ready";
  state.entitled = { ok: true };
  state.realEmail = true;
  state.planThrows = false;
  state.order = [];
});

describe("Website health page", () => {
  it("runs the paywall before reading anything, and reads nothing when it refuses", async () => {
    await panelProps();
    expect(state.order[0]).toBe("plan");
    expect(state.order).toContain("load");

    state.order = [];
    state.planThrows = true;
    await expect(panelProps()).rejects.toThrow("redirect:/onboarding/plan");
    expect(state.order).toEqual(["plan"]);
  });

  it("a viewer gets a read-only panel, and no entitlement probe is made for them", async () => {
    state.access = "viewer";
    state.entitled = { ok: false, error: "Choose a plan for this website first" };
    const props = await panelProps();
    expect(props.canEdit).toBe(false);
    expect(props.blockedReason).toBeNull();
    expect(state.order).not.toContain("entitled");
  });

  it("a site still being analysed says so up front, without asking about entitlement", async () => {
    state.access = "editor";
    state.status = "crawling";
    const props = await panelProps();
    expect(props.canEdit).toBe(true);
    expect(props.blockedReason).toBe(de.siteNotReady);
    expect(state.order).not.toContain("entitled");
  });

  it("an owner's site that may not spend explains the refusal in the reader's language", async () => {
    state.entitled = { ok: false, error: "Choose a plan for this website first" };
    expect((await panelProps()).blockedReason).toBe(de.errNoPlan);
    state.entitled = { ok: false, error: "This website's subscription is not active. Update billing to continue." };
    expect((await panelProps()).blockedReason).toBe(de.errPlanInactive);
    state.entitled = { ok: true };
    expect((await panelProps()).blockedReason).toBeNull();
  });

  it("passes the URL's filters (bounded), the locale and the section's words", async () => {
    const props = await panelProps({ severity: "critical", q: "  /pricing  " });
    expect(props.initialSeverity).toBe("critical");
    expect(props.initialQuery).toBe("/pricing");
    expect(props.locale).toBe("de");
    expect(props.t).toEqual(de);
    expect((await panelProps({ severity: "bogus" })).initialSeverity).toBe("all");
  });

  it("offers the quote email only to a real support address", async () => {
    expect((await panelProps()).supportEmail).toBe("help@repget.com");
    state.realEmail = false;
    expect((await panelProps()).supportEmail).toBeNull();
  });
});
