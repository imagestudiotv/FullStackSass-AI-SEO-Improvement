import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The shell's components on a website shared with the reader.
 *
 * app-shell.test checks what the layout and Account page DECIDE (the props
 * they pass). This checks that each component honours those props: the
 * Billing tab and the Add-ons item disappear, the credit figure is neither
 * shown nor computed, and the switcher says the site is shared and in what
 * role. Rendered to static markup on the server, so only the closed state of
 * the switcher's menu is visible here.
 */

const state = vi.hoisted(() => ({ pathname: "/dashboard" }));

vi.mock("next/navigation", () => ({
  usePathname: () => state.pathname,
  useRouter: () => ({ push: () => {}, refresh: () => {} }),
}));

/** A bare anchor: the assertions are about where links go, not prefetching. */
vi.mock("next/link", () => ({
  default: ({ href, children, "aria-current": current }: { href: string; children: ReactNode; "aria-current"?: string }) =>
    createElement("a", { href, "aria-current": current }, children),
}));

/* Server actions the client components import; never called while rendering. */
vi.mock("@/lib/websites/actions", () => ({
  selectWebsite: async () => ({ ok: true, data: null }),
}));
vi.mock("@/app/(app)/dashboard/invitation-actions", () => ({
  acceptPendingInvitationAction: async () => ({ ok: false, error: "" }),
}));
vi.mock("sonner", () => ({ toast: { error: () => {} } }));

// The sidebar's credit figure: the balance, and today's daily credits (lib/credits/overview.ts).
const overview = vi.hoisted(() => ({ daily: { eligible: true, perDay: 0, today: 0 } }));
vi.mock("@/lib/credits/overview", () => ({
  creditOverview: vi.fn(async () => ({ balance: 7, reserved: 0, available: 7, daily: overview.daily })),
}));
vi.mock("@/lib/usage", () => ({
  checkLimit: vi.fn(async () => ({
    allowed: true,
    used: 2,
    limit: 10,
    reason: null,
  })),
}));

import { PendingInvitations } from "@/components/dashboard/pending-invitations";
import { WebsiteSwitcher } from "@/components/dashboard/website-switcher";
import { SettingsNav } from "@/components/settings-nav";
import { SidebarNav } from "@/components/sidebar-nav";
import { SidebarUsage } from "@/components/sidebar-usage";
import { creditOverview } from "@/lib/credits/overview";
import { getMessages } from "@/lib/i18n/messages";

const en = getMessages("en");
const SITE = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";

beforeEach(() => {
  vi.clearAllMocks();
  state.pathname = "/dashboard";
});

describe("SettingsNav", () => {
  beforeEach(() => {
    state.pathname = "/settings";
  });
  const render = (access?: "owner" | "editor" | "viewer") =>
    renderToStaticMarkup(
      createElement(SettingsNav, { websiteId: SITE, access, t: en.app.nav }),
    );

  it("shows Billing to an owner, and by default", () => {
    expect(render()).toContain('href="/billing"');
    expect(render("owner")).toContain('href="/billing"');
  });

  it.each(["editor", "viewer"] as const)(
    "hides Billing from an invited %s and keeps the site's own tabs",
    (access) => {
      const html = render(access);
      expect(html).not.toContain('href="/billing"');
      expect(html).toContain(`href="/websites/${SITE}/profile"`);
      expect(html).toContain(`href="/websites/${SITE}/publishing"`);
      expect(html).toContain(`href="/websites/${SITE}/integrations"`);
      expect(html).toContain('href="/settings"');
    },
  );

  it("is only on the settings pages (client, 2026-11-02)", () => {
    for (const path of [`/websites/${SITE}/profile`, `/websites/${SITE}/publishing`, `/websites/${SITE}/integrations`, "/settings", "/billing"]) {
      state.pathname = path;
      expect(render()).toContain(`href="/websites/${SITE}/profile"`);
    }
    for (const path of [`/websites/${SITE}`, `/websites/${SITE}/videos`, `/websites/${SITE}/social`, `/websites/${SITE}/content`, "/dashboard"]) {
      state.pathname = path;
      expect(render()).toBe("");
    }
  });
});

describe("SidebarNav", () => {
  const render = (hideAddons?: boolean) =>
    renderToStaticMarkup(
      createElement(SidebarNav, {
        t: en.app.nav,
        selectedWebsiteId: SITE,
        addons: [{ id: "a1", name: "Link credits" }],
        hideAddons,
      }),
    );

  it("offers add-ons by default, as a group that starts closed", () => {
    const html = render();
    expect(html).toContain('aria-controls="sidebar-group-addons"');
    expect(html).toContain("Add-ons");
  });

  it("hides add-ons when told to, keeping the per-site sections", () => {
    const html = render(true);
    expect(html).not.toContain("sidebar-group-addons");
    expect(html).toContain(`href="/websites/${SITE}/content"`);
    expect(html).toContain('href="/settings"');
  });

  it("follows the client's menu: groups, Growth Copilot, Tasks and the renamed pages", () => {
    const html = render();
    const order = ["Home", "Growth Copilot", "Tasks", "Planned Articles", "Backlink Exchange", "Social Distribution", "Opportunities", "Social Content", "Growth Audit", "Website Health", "Google Search &amp; Analytics", "AI Visibility", "Losing Traffic", "Credits", "Add-ons", "Settings"];
    const at = order.map((label) => html.indexOf(`>${label}<`));
    expect(at.every((index) => index >= 0)).toBe(true);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
    expect(html).toContain(`href="/websites/${SITE}/copilot"`);
    expect(html).toContain('href="/dashboard"');
    expect(html).toContain(`href="/websites/${SITE}/social"`);
    expect(html).toContain(`href="/websites/${SITE}/videos"`);
  });

  it("lights the current page, and Settings for every settings tab", () => {
    state.pathname = `/websites/${SITE}/videos`;
    expect(render()).toMatch(new RegExp(`aria-current="page"[^>]*href="/websites/${SITE}/videos"|href="/websites/${SITE}/videos"[^>]*aria-current="page"`));
    state.pathname = `/websites/${SITE}/publishing`;
    expect(render()).toMatch(/href="\/settings"[^>]*aria-current="page"|aria-current="page"[^>]*href="\/settings"/);
  });
});

describe("SidebarUsage", () => {
  const render = async (showCredits?: boolean) =>
    renderToStaticMarkup(
      await SidebarUsage({
        organizationId: "org_own",
        showCredits,
        t: en.app.nav,
        tc: en.app.credits,
      }),
    );

  it("shows the reader's credits beside their own site, linking to the Credits page", async () => {
    overview.daily = { eligible: true, perDay: 0, today: 0 };
    const html = await render();
    expect(creditOverview).toHaveBeenCalledWith("org_own");
    expect(html).toContain("7 credits");
    expect(html).toContain('href="/credits"');
    expect(html).toContain("Earn Credits");
    expect(html).toContain('href="/settings#referral"');
    expect(html).not.toContain("today");
  });

  it("shows the daily credits given today", async () => {
    overview.daily = { eligible: true, perDay: 3, today: 3 };
    expect(await render()).toContain("+3 today");
  });

  it("on a shared site: no credit figure and no grant, Earn Credits kept", async () => {
    const html = await render(false);
    expect(creditOverview).not.toHaveBeenCalled();
    expect(html).not.toContain("credits");
    expect(html).toContain("Earn Credits");
  });

  it("speaks the reader's language", async () => {
    const it_ = getMessages("it");
    overview.daily = { eligible: true, perDay: 3, today: 3 };
    const html = renderToStaticMarkup(
      await SidebarUsage({ organizationId: "org_own", t: it_.app.nav, tc: it_.app.credits }),
    );
    expect(html).toContain("7 crediti");
    expect(html).toContain("Guadagni crediti");
    expect(html).toContain("+3 oggi");
  });
});

describe("WebsiteSwitcher trigger", () => {
  const owned = {
    id: SITE,
    domain: "mine.example",
    brandName: null,
    access: "owner" as const,
  };
  const shared = {
    id: OTHER,
    domain: "theirs.example",
    brandName: "Their Brand",
    access: "editor" as const,
  };

  it("names a shared site's role", () => {
    const html = renderToStaticMarkup(
      createElement(WebsiteSwitcher, {
        websites: [owned, shared],
        current: shared,
        compact: true,
        t: en.app.dash,
      }),
    );
    expect(html).toContain("Their Brand");
    expect(html).toContain(">Editor<");
    expect(html).toContain("Shared with you · Editor");
  });

  it("says Viewer for a viewer", () => {
    const html = renderToStaticMarkup(
      createElement(WebsiteSwitcher, {
        websites: [{ ...shared, access: "viewer" }],
        current: { ...shared, access: "viewer" },
        t: en.app.dash,
      }),
    );
    expect(html).toContain("Shared with you · Viewer");
  });

  it("adds nothing for an owned site", () => {
    const html = renderToStaticMarkup(
      createElement(WebsiteSwitcher, {
        websites: [owned, shared],
        current: owned,
        t: en.app.dash,
      }),
    );
    expect(html).toContain("mine.example");
    expect(html).not.toContain("Shared with you");
    expect(html).not.toContain("Editor");
  });

  it("names ONE shared site in the singular, where the group heading is plural", () => {
    // French: "Partagés avec vous" heads the group; one site is "Partagé".
    const fr = getMessages("fr");
    const html = renderToStaticMarkup(
      createElement(WebsiteSwitcher, {
        websites: [owned, shared],
        current: shared,
        t: fr.app.dash,
      }),
    );
    expect(html).toContain(`Partagé avec vous · ${fr.app.dash.roleEditor}`);
    expect(html).not.toContain(`${fr.app.dash.sharedWithYou} · `);
  });

  it("follows the website in the address over the remembered one", () => {
    state.pathname = `/websites/${OTHER}/content`;
    const html = renderToStaticMarkup(
      createElement(WebsiteSwitcher, {
        websites: [owned, shared],
        current: owned,
        t: en.app.dash,
      }),
    );
    expect(html).toContain("Shared with you · Editor");
  });
});

describe("PendingInvitations", () => {
  const invitations = [
    { id: SITE, domain: "first.example", role: "editor" as const, invitedByName: "Olivia" },
    { id: OTHER, domain: "second.example", role: "viewer" as const, invitedByName: null },
  ];

  it("ties each Accept button to the sentence naming its site", () => {
    /*
      Two buttons reading "Accept invitation" are otherwise indistinguishable
      to a screen reader moving between them.
    */
    const html = renderToStaticMarkup(
      createElement(PendingInvitations, {
        invitations,
        t: en.app.dashboard,
      }),
    );

    for (const invitation of invitations) {
      const id = `invite-${invitation.id}`;
      const sentence = html.match(new RegExp(`<p id="${id}"[^>]*>([^<]*)</p>`));
      expect(sentence?.[1]).toContain(invitation.domain);
      expect(html).toMatch(new RegExp(`<button[^>]*aria-describedby="${id}"`));
    }
  });
});
