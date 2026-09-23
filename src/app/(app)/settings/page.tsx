import { PersonalDetails } from "./personal-details";
import { SettingsNav } from "@/components/settings-nav";
import { PageShell } from "@/components/ui/page-header";
import { and, eq } from "drizzle-orm";
import { requireSession } from "@/lib/auth-guard";
import { getAppMessages } from "@/lib/i18n/app-locale";
import { getReferralSummary } from "@/lib/referrals/actions";
import { REFERRAL_REWARD_CREDITS } from "@/lib/referrals/core";
import { db } from "@/lib/db";
import { account, websites } from "@/lib/db/schema";
import { requireOrg } from "@/lib/tenant";
import {
  readSelectedWebsite,
  resolveWebsiteId,
} from "@/lib/websites/selected";
import { ReferralCard } from "./referral-card";
import { listWebsiteMembers } from "@/lib/websites/members";


import { WebsiteMembers } from "./website-members";
import { siteUrl as canonicalSiteUrl } from "@/lib/site-url";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const session = await requireSession();
  /*
    Resolved once for the page rather than per component. Each call is a
    query, and several panels on this screen need the same answer.
  */
  const { locale, t } = await getAppMessages(session.user.id);
  const referrals = await getReferralSummary();

  /**
   * The website the per-site settings links point at. Resolved the same way
   * the sidebar does it — the remembered choice, then the first website — so
   * both agree about which site "Publishing" means.
   */
  const { orgId } = await requireOrg();
  const owned = await db
    .select({ id: websites.id, domain: websites.domain })
    .from(websites)
    .where(eq(websites.organizationId, orgId))
    .orderBy(websites.createdAt);
  const remembered = await readSelectedWebsite();
  const websiteId = resolveWebsiteId(
    null,
    remembered,
    owned.map((site) => site.id),
  );

  const selectedSite = owned.find((site) => site.id === websiteId) ?? null;

  /**
   * Falls back to the production domain rather than emitting a localhost link
   * a customer would then share with someone else.
   */
  const appUrl = canonicalSiteUrl();

  /*
    A credential row with a hash in it means a password exists. Better Auth
    stores one account row per sign-in method, so a Google-only user has no
    "credential" row at all.

    The password column is checked as well as the row, not just the row.
    Better Auth's own setPassword handles a credential row whose password is
    null as "no password yet" and fills it in, so treating the bare row as
    proof of a password would show someone a current-password field for a
    password they do not have — the exact dead end this screen is trying to
    remove.
  */
  const [credential] = await db
    .select({ password: account.password })
    .from(account)
    .where(
      and(
        eq(account.userId, session.user.id),
        eq(account.providerId, "credential"),
      ),
    )
    .limit(1);
  const hasPassword = Boolean(credential?.password);

  return (
    <PageShell>
      {/*
        The same five-section strip as the website pages, so Account is one
        tab of a set rather than a separate place you arrive at. websiteId
        may be null when the workspace has no site yet; the strip then still
        renders and its per-website tabs simply have nowhere to point, which
        is honest — there is no website to configure.
      */}
      {websiteId ? <SettingsNav websiteId={websiteId} t={t.app.nav} /> : null}

      {/*
        Editable now, rather than a read-only definition list. The name was
        displayed with no way to correct it — someone who signed up with a
        typo, or whose Google account carries a different name than they use
        at work, was stuck with it.
      */}
      <PersonalDetails
        initialName={session.user.name ?? ""}
        email={session.user.email}
        /*
          Whether there is an existing password, which decides WHICH form the
          button opens rather than whether the button appears. An account
          created through Google has a "google" provider row and no
          credential one: it gets a form that asks for a new password only,
          because there is no current password to ask for. Both roads end at
          a customer who can sign in with an email and a password.
        */
        hasPassword={hasPassword}
        initialLocale={locale}
        t={t.app.settings}
      />

      {/*
        NO LINK CARDS HERE.

        This rendered four cards - Billing, Website profile, Publishing,
        Google - each linking to a page the strip at the top of this screen
        already has a tab for. The client marked the whole block: it was a
        second navigation stacked under the first, pointing at the same five
        places, and the "Publishing" card now pointed somewhere that panel no
        longer lives.

        The strip replaced it. Two navigations for one set of destinations is
        one too many, and the one that duplicates is the one that goes stale.
      */}

      {/*
        Collaborators are per website, so the panel takes every site owned
        here and picks between them itself. With no website there is nobody to
        invite to anything yet.
      */}
      {selectedSite ? (
        <WebsiteMembers
          sites={owned}
          initialWebsiteId={selectedSite.id}
          initialMembers={await listWebsiteMembers(selectedSite.id)}
          t={t.app.settings}
        />
      ) : null}

      <ReferralCard
        summary={referrals}
        rewardCredits={REFERRAL_REWARD_CREDITS}
        appUrl={appUrl}
        t={t.app.referral}
        tCommon={t.app.common}
      />
    </PageShell>
  );
}
