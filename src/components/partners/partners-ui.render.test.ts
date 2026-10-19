import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ usePathname: () => "/partner", useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => createElement("a", { href, ...rest }, children),
}));
vi.mock("@/lib/partners/presentation/actions", () => ({
  submitPartnerApplicationAction: vi.fn(),
  startPayoutSetupAction: vi.fn(),
  openPayoutDashboardAction: vi.fn(),
  refreshPayoutStatusAction: vi.fn(),
}));
vi.mock("@/lib/auth/confirm-email-actions", () => ({ confirmEmail: vi.fn() }));
vi.mock("@/lib/auth-client", () => ({ authClient: { emailOtp: { sendVerificationOtp: vi.fn() } } }));

import { PartnersContent } from "@/app/(marketing)/partners-content";
import { LOCALES, localePath } from "@/lib/i18n/config";
import { DEFAULT_PROGRAM_POLICY } from "@/lib/partners/domain/policies/program";
import { partnerCopy } from "@/lib/partners/presentation/copy";

import { ApplicationForm } from "./application-form";
import { PartnerNavigation } from "./partner-navigation";
import { PayoutSetup } from "./payout-setup";
import { TierProgress } from "./tier-progress";

/**
 * The partner program's screens, rendered in every language: no placeholder
 * left unfilled, every figure from the program policy, the closed state
 * without an application form, and payout setup offering only what each
 * state allows.
 */

const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

describe("the public /partners page", () => {
  it.each(LOCALES)("%s: renders every rule with the policy's figures and no unfilled placeholder", (locale) => {
    const html = renderToStaticMarkup(
      createElement(PartnersContent, {
        copy: partnerCopy(locale).page,
        policy: DEFAULT_PROGRAM_POLICY,
        open: true,
        locale,
        href: (path: string) => localePath(locale, path),
      }),
    );
    const words = text(html);
    expect(words).not.toMatch(/\{\w+\}/);
    expect(words).toContain("25%");
    expect(words).toContain("30%");
    expect(words).toContain("35%");
    expect(words).toMatch(/12/);
    expect(words).toMatch(/25[.,]00/);
    expect(html).toContain('href="/partner/apply"');
    expect(html).toContain(`href="${localePath(locale, "/affiliate")}"`);
    expect(html.match(/<h1/g)).toHaveLength(1);
  });

  it("offers no application while the program is closed", () => {
    const copy = partnerCopy("en").page;
    const html = renderToStaticMarkup(createElement(PartnersContent, { copy, policy: DEFAULT_PROGRAM_POLICY, open: false, locale: "en", href: (p: string) => p }));
    expect(html).not.toContain('href="/partner/apply"');
    expect(text(html)).toContain(copy.closed);
  });

  it("follows the policy, not the copy, when rates change", () => {
    const policy = { ...DEFAULT_PROGRAM_POLICY, tiers: DEFAULT_PROGRAM_POLICY.tiers.map((tier) => ({ ...tier, rateBasisPoints: tier.rateBasisPoints + 500 })) };
    const words = text(renderToStaticMarkup(createElement(PartnersContent, { copy: partnerCopy("en").page, policy, open: true, locale: "en", href: (p: string) => p })));
    expect(words).toContain("40%");
    expect(words).not.toContain("25%");
  });
});

describe("portal components", () => {
  it.each(LOCALES)("%s: the application form labels every field", (locale) => {
    const copy = partnerCopy(locale).portal.apply;
    const html = renderToStaticMarkup(createElement(ApplicationForm, { copy, countries: [{ code: "IT", name: "Italia" }] }));
    for (const id of ["website", "audience", "promotion", "country"]) {
      expect(html).toContain(`for="${id}"`);
      expect(html).toContain(`aria-describedby="${id}-hint"`);
    }
    expect(html).toContain('name="terms"');
  });

  it("offers only what each payout setup state allows", () => {
    const copy = partnerCopy("en").portal.setup;
    const render = (state: Parameters<typeof PayoutSetup>[0]["state"], canAct = true) =>
      text(renderToStaticMarkup(createElement(PayoutSetup, { state, copy, canAct, countryLine: null, requirements: [] })));
    expect(render("not_started")).toContain(copy.start);
    expect(render("setup_required")).toContain(copy.continue);
    expect(render("ready")).toContain(copy.dashboard);
    expect(render("ready")).not.toContain(copy.start);
    expect(render("unavailable")).not.toContain(copy.start);
    expect(render("not_started", false)).not.toContain(copy.start);
  });

  it("marks the current section and shows tier progress as a progress bar", () => {
    const nav = renderToStaticMarkup(createElement(PartnerNavigation, { label: "Partner portal", items: [{ href: "/partner", label: "Overview" }, { href: "/partner/settings", label: "Settings" }] }));
    expect(nav).toMatch(/aria-current="page"[^>]*>Overview|href="\/partner"[^>]*aria-current="page"/);
    const tier = renderToStaticMarkup(
      createElement(TierProgress, { title: "Your tier", tierName: "Growth Partner", rate: "30%", progressLabel: "17 / 25 paying customers", remainingLabel: "8 more customers to reach Premier Partner - 35%", current: 17, target: 25 }),
    );
    expect(tier).toContain('role="progressbar"');
    expect(tier).toContain('aria-valuenow="17"');
    expect(text(tier)).toContain("8 more customers to reach Premier Partner - 35%");
  });
});
