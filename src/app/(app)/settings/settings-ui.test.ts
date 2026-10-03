import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

/**
 * The Account page's pieces by behaviour: the members panel's stale-reply
 * guard, the password form's checks and error wording, what each section
 * shows for each kind of account, and that every string the page adds exists
 * in all five languages. Rendered to static markup (no DOM), so open menus
 * and dialogs are left to the browser check.
 */

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => {}, refresh: () => {}, replace: () => {} }),
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode; [key: string]: unknown }) =>
    createElement("a", { href, ...rest }, children),
}));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));
vi.mock("@/lib/auth-client", () => ({ authClient: { updateUser: vi.fn(), changePassword: vi.fn() } }));
vi.mock("@/app/(app)/settings/password-actions", () => ({ setFirstPassword: vi.fn() }));
vi.mock("@/lib/websites/members", () => ({
  addWebsiteMember: vi.fn(),
  listWebsiteInvitations: vi.fn(),
  listWebsiteMembers: vi.fn(),
  removeWebsiteMember: vi.fn(),
  resendWebsiteInvitation: vi.fn(),
  revokeWebsiteInvitation: vi.fn(),
}));

import { authClient } from "@/lib/auth-client";
import { LOCALES } from "@/lib/i18n/config";
import { format } from "@/lib/i18n/format";
import { getMessages } from "@/lib/i18n/messages";
import type { ReferralRow, ReferralSummary } from "@/lib/referrals/shared";
import type { WebsiteInvitation, WebsiteMember } from "@/lib/websites/members";

import { syncMembers, type MemberLists } from "./members-sync";
import { changePasswordError, checkNewPassword, setPasswordError } from "./password-rules";
import { PersonalDetails, updatedAccount } from "./personal-details";
import { ReferralCard } from "./referral-card";
import { WebsiteMembers } from "./website-members";

const en = getMessages("en").app;
const de = getMessages("de").app;
const html = (node: ReturnType<typeof createElement>) => renderToStaticMarkup(node);

const owner: WebsiteMember = {
  id: "m1",
  userId: "u1",
  email: "owner@example.com",
  name: "Olive Owner",
  role: "admin",
  createdAt: new Date(Date.UTC(2026, 0, 1)),
  isWorkspace: true,
};
const editor: WebsiteMember = {
  id: "m2",
  userId: "u2",
  email: "ed@example.com",
  name: "Ed Itor",
  role: "editor",
  createdAt: new Date(Date.UTC(2026, 0, 2)),
  isWorkspace: false,
};
const invitation: WebsiteInvitation = {
  id: "i1",
  email: "new@example.com",
  role: "viewer",
  createdAt: new Date(Date.UTC(2026, 9, 1)),
  expiresAt: new Date(Date.UTC(2026, 9, 8, 23, 30)),
  expired: false,
};

describe("members panel: replies for a site no longer on screen", () => {
  it("drops a reply that arrives after the owner switched site", async () => {
    let wanted = "site_a";
    let resolve: (lists: MemberLists) => void = () => {};
    const load = vi.fn(() => new Promise<MemberLists>((done) => (resolve = done)));
    const apply = vi.fn();

    const pending = syncMembers("site_a", (id) => id === wanted, load, apply);
    wanted = "site_b"; // switched while an invite's re-read was in flight
    resolve({ members: [owner, editor], invitations: [] });

    expect(await pending).toBe("stale");
    expect(apply).not.toHaveBeenCalled();
  });

  it("applies a reply for the site still on screen, and reports a failure only for that site", async () => {
    const apply = vi.fn();
    const lists = { members: [owner], invitations: [invitation] };
    expect(await syncMembers("a", () => true, async () => lists, apply)).toBe("applied");
    expect(apply).toHaveBeenCalledWith(lists);

    const boom = async (): Promise<MemberLists> => {
      throw new Error("down");
    };
    expect(await syncMembers("a", () => true, boom, apply)).toBe("failed");
    expect(await syncMembers("a", () => false, boom, apply)).toBe("stale");
  });
});

describe("password rules", () => {
  it("checks the new password's length on both sides of the server's limits", () => {
    expect(checkNewPassword("short", en.settings)).toEqual({ target: "next", message: en.settings.passwordTooShort });
    expect(checkNewPassword("x".repeat(129), en.settings)?.message).toBe(en.settings.passwordTooLong);
    expect(checkNewPassword("long enough", en.settings)).toBeNull();
  });

  it("words Better Auth's failures in the reader's language and beside the right field", () => {
    expect(changePasswordError({ code: "INVALID_PASSWORD" }, de.settings)).toEqual({
      target: "current",
      message: de.settings.currentPasswordWrong,
    });
    expect(changePasswordError({ code: "PASSWORD_TOO_LONG" }, en.settings).target).toBe("next");
    expect(changePasswordError({ status: 429 }, en.settings).message).toBe(en.settings.tooManyAttempts);
    expect(changePasswordError({ code: "SOMETHING_ELSE" }, en.settings)).toEqual({
      target: "form",
      message: en.settings.passwordError,
    });
  });

  it("asks for a refresh when the page offered to set a password that now exists", () => {
    expect(setPasswordError("ALREADY_SET", en.settings)).toMatchObject({ refresh: true, message: en.settings.passwordAlreadySet });
    expect(setPasswordError("TOO_SHORT", en.settings)).toMatchObject({ refresh: false, target: "next" });
  });
});

function renderDetails(overrides: Partial<Parameters<typeof PersonalDetails>[0]> = {}) {
  return html(
    createElement(PersonalDetails, {
      initialName: "Olive Owner",
      email: "owner@example.com",
      hasPassword: true,
      googleLinked: false,
      initialLocale: "en",
      articleLanguageSite: { href: "/websites/site_a/profile", domain: "site-a.example" },
      t: en.settings,
      tWorkspace: en.workspace,
      ...overrides,
    }),
  );
}

describe("PersonalDetails", () => {
  it("an account with a password is offered a change, and says the password is set", () => {
    const out = renderDetails();
    expect(out).toContain(en.settings.changePassword);
    expect(out).toContain(en.settings.methodSet);
    expect(out).not.toContain(en.settings.setPassword);
    expect(out).not.toContain(en.settings.methodGoogle);
  });

  it("an account without one is offered to set one, and its Google sign-in is listed", () => {
    const out = renderDetails({ hasPassword: false, googleLinked: true });
    expect(out).toContain(en.settings.setPassword);
    expect(out).toContain(en.settings.methodNotSet);
    expect(out).toContain(en.settings.methodGoogle);
    expect(out).toContain(en.settings.methodLinked);
  });

  it("separates the dashboard language from the article language and links to where the latter lives", () => {
    const out = renderDetails();
    expect(out).toContain(en.settings.languageLabel);
    expect(out).toContain(en.settings.articleLanguageLabel);
    expect(out).toContain('href="/websites/site_a/profile"');
    // Which website's Business tab, by name: with several, "the Business tab" alone does not say.
    expect(out).toContain(format(en.settings.articleLanguageLink, { domain: "site-a.example" }));
    expect(out).toContain('for="dashboard-language"');
    expect(renderDetails({ articleLanguageSite: null })).not.toContain('href="/websites/');
  });

  it("reads a save that never reached the server as a failure, not a crash", async () => {
    const updateUser = vi.mocked(authClient.updateUser);
    updateUser.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    expect(await updatedAccount({ name: "Olive" })).toBe(false);
    updateUser.mockResolvedValueOnce({ data: null, error: { status: 500 } } as never);
    expect(await updatedAccount({ locale: "de" })).toBe(false);
    updateUser.mockResolvedValueOnce({ data: { status: true }, error: null } as never);
    expect(await updatedAccount({ name: "Olive" })).toBe(true);
  });

  it("shows the email as text with why it cannot be edited", () => {
    const out = renderDetails();
    expect(out).toContain("owner@example.com");
    expect(out).toContain(en.settings.emailHelp);
    expect(out).not.toMatch(/<input[^>]*value="owner@example.com"/);
  });
});

function renderMembers(overrides: Partial<Parameters<typeof WebsiteMembers>[0]> = {}) {
  return html(
    createElement(WebsiteMembers, {
      sites: [{ id: "site_a", domain: "alpha.example" }],
      initialWebsiteId: "site_a",
      initialMembers: [owner, editor],
      initialInvitations: [invitation],
      locale: "en",
      t: en.settings,
      tWorkspace: en.workspace,
      ...overrides,
    }),
  );
}

describe("WebsiteMembers", () => {
  it("names the one website it controls and translates every role", () => {
    const out = renderMembers();
    expect(out).toContain("alpha.example");
    expect(out).toContain("People who can work on alpha.example");
    expect(out).toContain(">Admin<");
    expect(out).toContain(">Editor<");
    expect(out).toContain(">Viewer<");
    expect(out).not.toContain(">admin<");
    expect(out).toContain("Invited · expires 8 Oct 2026");
  });

  it("gives the workspace row no menu and every guest row a labelled one", () => {
    const out = renderMembers();
    expect(out).toContain("owner@example.com has access through your workspace");
    expect(out).toContain('aria-label="Manage ed@example.com"');
    expect(out).toContain('aria-label="Manage the invitation for new@example.com"');
    expect(out).not.toContain('aria-label="Manage owner@example.com"');
  });

  it("says it manages the reader's own sites when a shared one is on screen", () => {
    expect(renderMembers({ viewingSharedDomain: "shared.example" })).toContain(
      "You are looking at shared.example, which is shared with you.",
    );
    expect(renderMembers()).not.toContain("which is shared with you");
  });

  it("invites the owner to add someone when only the workspace has access", () => {
    expect(renderMembers({ initialMembers: [owner], initialInvitations: [] })).toContain(en.settings.nobodyElse);
    expect(renderMembers()).not.toContain(en.settings.nobodyElse);
  });

  it("offers a retry instead of an empty table when the first read failed", () => {
    const out = renderMembers({ initialMembers: [], initialInvitations: [], initialError: true });
    expect(out).toContain(en.settings.loadPeopleFailed);
    expect(out).toContain(en.settings.retry);
    expect(out).not.toContain("<table");
  });

  it("is German throughout in German", () => {
    const out = renderMembers({ t: de.settings, tWorkspace: de.workspace, locale: "de" });
    expect(out).toContain(">Redakteur<");
    expect(out).toContain(">Administrator<");
    expect(out).not.toContain("Manage ");
  });
});

describe("ReferralCard", () => {
  const row = (overrides: Partial<ReferralRow>): ReferralRow => ({
    id: Math.random().toString(36),
    status: "pending",
    rewardCredits: null,
    createdAt: new Date(Date.UTC(2026, 8, 1)),
    rewardedAt: null,
    referredName: null,
    referredDomain: null,
    ...overrides,
  });
  const summary = (referrals: ReferralRow[], extra: Partial<ReferralSummary> = {}): ReferralSummary => ({
    code: "ABC123",
    earned: 20,
    pending: 1,
    referrals,
    ...extra,
  });
  const card = (value: ReferralSummary | null) =>
    html(
      createElement(ReferralCard, {
        summary: value,
        rewardCredits: 20,
        appUrl: "https://www.repget.com",
        locale: "en",
        t: en.referral,
        tCommon: en.common,
        tWorkspace: en.workspace,
      }),
    );

  it("keeps the #referral anchor and labels the link field", () => {
    const out = card(summary([]));
    expect(out).toContain('id="referral"');
    expect(out).toContain('for="referral-link"');
    expect(out).toContain('value="https://www.repget.com/r/ABC123"');
    expect(out).toContain(en.referral.noReferralsYet);
  });

  it("shows the stored figures, and when the reward was added", () => {
    const out = card(
      summary([
        row({ status: "rewarded", rewardCredits: 20, referredDomain: "x.example", rewardedAt: new Date(Date.UTC(2026, 8, 9)) }),
        row({ status: "rejected", referredName: "Sam" }),
      ]),
    );
    expect(out).toContain("+20 credits");
    expect(out).toContain("credits added 9 Sept 2026");
    expect(out).toContain(en.referral.notEligible);
    expect(out).toMatch(/People referred<\/dt><dd[^>]*>2</);
  });

  it("says the list is capped rather than undercounting", () => {
    const fifty = Array.from({ length: 50 }, (_, i) => row({ id: `r${i}` }));
    const out = card(summary(fifty));
    expect(out).toContain("50+");
    expect(out).toContain("Showing your 50 most recent referrals.");
  });

  it("says the details are unavailable instead of failing the page", () => {
    const out = card(null);
    expect(out).toContain('id="referral"');
    expect(out).toContain(en.referral.unavailable);
  });
});

describe("dictionary", () => {
  const sections = ["settings", "billing", "addons", "referral"] as const;

  it("has every Account and Billing string in all five languages, with the same placeholders", () => {
    const base = getMessages("en").app;
    for (const locale of LOCALES) {
      const app = getMessages(locale).app;
      for (const section of sections) {
        const reference = base[section] as Record<string, string>;
        const translated = app[section] as Record<string, string>;
        expect(Object.keys(translated).sort(), `${locale}.${section}`).toEqual(Object.keys(reference).sort());
        for (const [key, value] of Object.entries(reference)) {
          expect(translated[key], `${locale}.${section}.${key}`).toBeTruthy();
          const holes = (text: string) => (text.match(/\{\w+\}/g) ?? []).sort();
          expect(holes(translated[key]), `${locale}.${section}.${key}`).toEqual(holes(value));
        }
      }
    }
  });
});
