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

import PartnerError from "@/app/(partner)/partner/error";
import { PartnersContent } from "@/app/(marketing)/partners-content";
import { LOCALES, localePath } from "@/lib/i18n/config";
import { DEFAULT_PROGRAM_POLICY } from "@/lib/partners/domain/policies/program";
import { partnerCopy } from "@/lib/partners/presentation/copy";

import { balanceView, commissionRowView, metricsView, payoutRowView, referralRowView } from "@/lib/partners/presentation/views";

import { ApplicationForm } from "./application-form";
import { CommissionList, EarningsPanel, MetricsPanel, PayoutList, ReferralList, ResourcesView } from "./dashboard-views";
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

describe("the partner dashboard and histories", () => {
  const figures = {
    currency: "eur",
    earned: BigInt(4950),
    pending: BigInt(2475),
    available: BigInt(2475),
    inPayout: BigInt(0),
    transferred: BigInt(0),
    bankPaid: BigInt(0),
    offset: BigInt(0),
    liability: BigInt(4950),
    threshold: BigInt(2500),
    belowThreshold: true,
    updatedAt: new Date("2026-10-19T00:00:00Z"),
  };

  it.each(LOCALES)("%s: earnings, metrics and every history render filled in, as tables and as phone cards", (locale) => {
    const copy = partnerCopy(locale).portal;
    const earnings = renderToStaticMarkup(createElement(EarningsPanel, { copy, balances: [balanceView(figures, copy, locale, 30)], nextPayout: "1 Nov 2026" }));
    const metrics = renderToStaticMarkup(
      createElement(MetricsPanel, {
        copy,
        metrics: metricsView({ clicks: 4, signups: 2, customers: 2, payingCustomers: 1, days: 30, since: new Date("2026-09-19T00:00:00Z"), until: new Date("2026-10-19T00:00:00Z") }, copy, locale),
        ranges: [30, 90, 365].map((days) => ({ days, href: `/partner?range=${days}`, current: days === 90, label: String(days) })),
      }),
    );
    const commissions = renderToStaticMarkup(
      createElement(CommissionList, {
        copy,
        rows: [commissionRowView({ id: "c1", paidAt: new Date("2026-09-01T00:00:00Z"), customer: "ex\u2022\u2022\u2022.com", currency: "eur", base: BigInt(9900), rateBasisPoints: 2500, amount: BigInt(2475), reversed: BigInt(0), status: "review", maturesAt: new Date("2026-10-01T00:00:00Z") }, copy, locale)],
      }),
    );
    const payouts = renderToStaticMarkup(
      createElement(PayoutList, {
        copy,
        rows: [payoutRowView({ id: "s1", createdAt: new Date("2026-10-01T00:00:00Z"), currency: "eur", amount: BigInt(4950), offset: BigInt(0), transfer: "confirmed", bank: "pending", bankPaidAt: null, bankArrivalDate: null }, copy, locale)],
      }),
    );
    const referrals = renderToStaticMarkup(createElement(ReferralList, { copy, rows: [referralRowView({ id: "a1", customer: "Customer 3FA2C1", source: "coupon", status: "active", since: new Date("2026-09-01T00:00:00Z") }, copy, locale)] }));

    for (const html of [earnings, metrics, commissions, payouts, referrals]) expect(text(html)).not.toMatch(/\{\w+\}/);
    expect(text(earnings)).toContain(copy.overview.cards.bankPaid);
    expect(text(earnings)).toContain(copy.overview.definitions.bankPaid);
    expect(metrics).toMatch(/aria-current="true"[^>]*>90|href="\/partner\?range=90"[^>]*aria-current="true"/);
    // A table for wide screens and stacked cards for phones, both labelled.
    for (const html of [commissions, payouts, referrals]) {
      expect(html).toContain("<table");
      expect(html).toContain('class="space-y-3 md:hidden"');
    }
    expect(text(commissions)).toContain(copy.commissions.statuses.review);
    expect(text(payouts)).toContain(copy.payouts.transferStates.confirmed);
    expect(text(payouts)).toContain(copy.payouts.bankStates.pending);
    expect(text(referrals)).toContain("Customer 3FA2C1");
  });

  it("says so when there is nothing yet", () => {
    const copy = partnerCopy("en").portal;
    expect(text(renderToStaticMarkup(createElement(EarningsPanel, { copy, balances: [], nextPayout: "" })))).toContain(copy.overview.noEarnings);
    expect(text(renderToStaticMarkup(createElement(CommissionList, { copy, rows: [] })))).toContain(copy.commissions.empty);
    expect(text(renderToStaticMarkup(createElement(PayoutList, { copy, rows: [] })))).toContain(copy.payouts.empty);
    expect(text(renderToStaticMarkup(createElement(ReferralList, { copy, rows: [] })))).toContain(copy.referrals.empty);
  });

  it.each(LOCALES)("%s: resources offer downloads, banners and texts with the partner's own link", (locale) => {
    const copy = partnerCopy(locale).portal;
    const link = "https://repget.test/go/abcdefghjk";
    const html = renderToStaticMarkup(
      createElement(ResourcesView, {
        copy,
        logos: [{ href: "/images/repget-logo.png", preview: "/images/repget-logo.png", name: copy.resources.files.logo, detail: "PNG", width: 2757, height: 690 }],
        banners: [{ href: `/partners/banners/repget-${locale}-728x90.png`, preview: `/partners/banners/repget-${locale}-728x90.png`, name: "Banner", detail: "PNG", width: 728, height: 90 }],
        templates: copy.resources.templates.map((template) => ({ title: template.title, body: template.body.replace("{link}", link) })),
      }),
    );
    expect(text(html)).not.toMatch(/\{\w+\}/);
    expect(html).toContain('href="/images/repget-logo.png" download=""');
    expect(html).toContain(`href="/partners/banners/repget-${locale}-728x90.png" download=""`);
    expect(html.split(link).length - 1).toBe(copy.resources.templates.length);
    const words = text(html).replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&");
    for (const rule of copy.resources.rulesList) expect(words).toContain(rule);
    expect(words).toContain(copy.resources.copyText);
    expect(words).not.toContain(copy.overview.copy);
  });
});

describe("the portal's error state", () => {
  it("never shows the error's own message; gives the reference and a retry", () => {
    const error = Object.assign(new Error("select * from partner_ledger_entries failed: password=hunter2"), { digest: "4096231" });
    const html = text(renderToStaticMarkup(createElement(PartnerError, { error, reset: () => {} })));
    const copy = partnerCopy("en").portal.failure;
    expect(html).toContain(copy.title);
    expect(html).toContain("4096231");
    expect(html).toContain(copy.retry);
    expect(html).not.toContain("hunter2");
    expect(html).not.toContain("partner_ledger_entries");
  });
});
