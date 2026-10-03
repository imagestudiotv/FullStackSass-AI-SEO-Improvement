import { and, eq } from "drizzle-orm";
import { Users } from "lucide-react";
import type { Metadata } from "next";
import { cache } from "react";

import { SettingsNav } from "@/components/settings-nav";
import { PageHeader, PageShell } from "@/components/ui/page-header";
import { WorkspaceSection } from "@/components/workspace/section";
import { requireSession } from "@/lib/auth-guard";
import { db } from "@/lib/db";
import { account } from "@/lib/db/schema";
import { getAppMessages } from "@/lib/i18n/app-locale";
import { format } from "@/lib/i18n/format";
import { getReferralSummary } from "@/lib/referrals/actions";
import { REFERRAL_REWARD_CREDITS } from "@/lib/referrals/core";
import type { ReferralSummary } from "@/lib/referrals/shared";
import { siteUrl as canonicalSiteUrl } from "@/lib/site-url";
import { listAccessibleWebsites } from "@/lib/websites/accessible";
import {
  listWebsiteInvitations,
  listWebsiteMembers,
  type WebsiteInvitation,
  type WebsiteMember,
} from "@/lib/websites/members";
import { readSelectedWebsite, resolveWebsiteId } from "@/lib/websites/selected";

import { AccountSectionNav, type AccountSectionId } from "./account-section-nav";
import { PersonalDetails } from "./personal-details";
import { ReferralCard } from "./referral-card";
import { WebsiteMembers } from "./website-members";

/** One read of the reader's language per request, shared by the title and the page. */
const messagesFor = cache((userId: string) => getAppMessages(userId));

export async function generateMetadata(): Promise<Metadata> {
  const session = await requireSession();
  const { t } = await messagesFor(session.user.id);
  return { title: t.app.settings.pageTitle };
}

export default async function SettingsPage() {
  const session = await requireSession();
  const { locale, t } = await messagesFor(session.user.id);
  const copy = t.app.settings;

  /*
    The referral summary also creates the code on a first visit (a write), so
    it stays in this per-request render. A failure there no longer takes the
    whole Account page down with it: the referral section says so instead.
  */
  let referrals: ReferralSummary | null = null;
  try {
    referrals = await getReferralSummary();
  } catch (error) {
    console.error("[settings] could not load the referral summary", error);
  }

  /**
   * The website the settings strip points at, resolved as the sidebar does -
   * the remembered choice, then the first website - over every site this
   * person can open. Shared sites count, so someone who opened Account from
   * a site shared with them keeps that site's strip (without Billing).
   */
  const accessible = await listAccessibleWebsites();
  const remembered = await readSelectedWebsite();
  const websiteId = resolveWebsiteId(
    null,
    remembered,
    accessible.map((site) => site.id),
  );
  const stripSite = accessible.find((site) => site.id === websiteId) ?? null;

  /**
   * The members panel's sites: OWNED ONLY. Inviting and removing people is
   * the owner's decision and the server refuses it to anyone else; a panel
   * for a shared site would be a form of buttons that all fail. A dual-role
   * user who last looked at a shared site gets their own site here (the
   * remembered one if it is theirs, else their oldest), and the panel says
   * that it is not the site on screen.
   */
  const owned = accessible
    .filter((site) => site.access === "owner")
    .map((site) => ({ id: site.id, domain: site.domain }));
  const membersSiteId = resolveWebsiteId(
    null,
    remembered,
    owned.map((site) => site.id),
  );
  const selectedSite = owned.find((site) => site.id === membersSiteId) ?? null;
  const viewingShared = stripSite && stripSite.access !== "owner" ? stripSite : null;

  let initialMembers: WebsiteMember[] = [];
  let initialInvitations: WebsiteInvitation[] = [];
  let membersError = false;
  if (selectedSite) {
    try {
      [initialMembers, initialInvitations] = await Promise.all([
        listWebsiteMembers(selectedSite.id),
        listWebsiteInvitations(selectedSite.id),
      ]);
    } catch (error) {
      // The panel offers a retry rather than the whole page failing.
      console.error("[settings] could not load website members", error);
      membersError = true;
    }
  }

  /*
    How this person can sign in. A credential row WITH a hash means a
    password exists: Better Auth's setPassword treats a credential row whose
    password is null as "no password yet", so the bare row is not proof - it
    would show a current-password field for a password they do not have.
    The provider list (bounded; a handful of rows per person) says whether
    "you sign in with Google" is true before the set-password form says it.
  */
  const [[credential], providers] = await Promise.all([
    db
      .select({ password: account.password })
      .from(account)
      .where(and(eq(account.userId, session.user.id), eq(account.providerId, "credential")))
      .limit(1),
    db
      .select({ providerId: account.providerId })
      .from(account)
      .where(eq(account.userId, session.user.id))
      .limit(10),
  ]);
  const hasPassword = Boolean(credential?.password);
  const googleLinked = providers.some((row) => row.providerId === "google");

  /**
   * Falls back to the production domain rather than emitting a localhost link
   * a customer would then share with someone else.
   */
  const appUrl = canonicalSiteUrl();

  const guestTeamNote = !selectedSite && viewingShared;
  const sections: { id: AccountSectionId; label: string }[] = [
    { id: "profile", label: copy.personalTitle },
    { id: "security", label: copy.securityTitle },
    { id: "language", label: copy.languageTitle },
    ...(selectedSite || guestTeamNote ? [{ id: "members" as const, label: copy.membersTitle }] : []),
    { id: "referral", label: t.app.nav.referralProgram },
  ];

  return (
    /*
      Wide, like the website pages around it, so the settings strip keeps one
      width from tab to tab.
    */
    <PageShell width="wide">
      {/*
        The same five-section strip as the website pages, so Account is one
        tab of a set. access is the selected site's, so on a shared site the
        strip drops Billing, as it does on that site's own pages.
      */}
      {stripSite ? <SettingsNav websiteId={stripSite.id} access={stripSite.access} t={t.app.nav} /> : null}

      <PageHeader title={copy.pageTitle} description={copy.pageDescription} />

      <div className="lg:grid lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-8">
        <aside className="hidden lg:block">
          <AccountSectionNav sections={sections} label={t.app.workspace.onThisPage} variant="rail" />
        </aside>

        <div className="min-w-0 space-y-6">
          <AccountSectionNav
            sections={sections}
            label={t.app.workspace.jumpTo}
            variant="bar"
            className="lg:hidden"
          />

          <PersonalDetails
            initialName={session.user.name ?? ""}
            email={session.user.email}
            hasPassword={hasPassword}
            googleLinked={googleLinked}
            initialLocale={locale}
            articleLanguageSite={
              stripSite ? { href: `/websites/${stripSite.id}/profile`, domain: stripSite.domain } : null
            }
            t={copy}
            tWorkspace={t.app.workspace}
          />

          {/*
            Collaborators are per website: the panel takes every site owned
            here and picks between them itself. Someone who owns none but
            works on a shared site is told who manages access instead of
            being shown controls the server would refuse.
          */}
          {selectedSite ? (
            <WebsiteMembers
              sites={owned}
              initialWebsiteId={selectedSite.id}
              initialMembers={initialMembers}
              initialInvitations={initialInvitations}
              initialError={membersError}
              ownEmail={session.user.email}
              viewingSharedDomain={viewingShared?.domain ?? null}
              locale={locale}
              t={copy}
              tWorkspace={t.app.workspace}
            />
          ) : guestTeamNote ? (
            <WorkspaceSection id="members" icon={Users} title={copy.membersTitle}>
              <p className="text-sm text-muted-foreground">
                {format(copy.guestTeamNote, {
                  domain: guestTeamNote.domain,
                  role: guestTeamNote.access === "viewer" ? copy.roleViewer : copy.roleEditor,
                })}
              </p>
            </WorkspaceSection>
          ) : null}

          {/* Carries id="referral", the target of the sidebar's "Referral program" link. */}
          <ReferralCard
            summary={referrals}
            rewardCredits={REFERRAL_REWARD_CREDITS}
            appUrl={appUrl}
            locale={locale}
            t={t.app.referral}
            tCommon={t.app.common}
            tWorkspace={t.app.workspace}
          />
        </div>
      </div>
    </PageShell>
  );
}
