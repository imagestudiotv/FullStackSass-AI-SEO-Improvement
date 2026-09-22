import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SettingsNav } from "@/components/settings-nav";
import { PageShell } from "@/components/ui/page-header";
import { eq } from "drizzle-orm";
import { requireSession } from "@/lib/auth-guard";
import { getReferralSummary } from "@/lib/referrals/actions";
import { REFERRAL_REWARD_CREDITS } from "@/lib/referrals/core";
import { db } from "@/lib/db";
import { websites } from "@/lib/db/schema";
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

  return (
    <PageShell>
      {/*
        The same five-section strip as the website pages, so Account is one
        tab of a set rather than a separate place you arrive at. websiteId
        may be null when the workspace has no site yet; the strip then still
        renders and its per-website tabs simply have nowhere to point, which
        is honest — there is no website to configure.
      */}
      {websiteId ? <SettingsNav websiteId={websiteId} /> : null}

      {/*
        "Profile", as the design titles it - not "Account" under an Account
        tab, which named the same thing twice on one screen.

        The email also appeared twice: once as "Signed in as x" in the
        description and again as a field below it. One is enough, and the
        field is the one that belongs beside the name.
      */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Profile</CardTitle>
          <CardDescription>
            Your name, email and platform language.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 text-sm sm:grid-cols-2">
            <div className="space-y-0.5">
              <dt className="text-muted-foreground">Name</dt>
              <dd className="font-medium">{session.user.name || "—"}</dd>
            </div>
            <div className="space-y-0.5">
              <dt className="text-muted-foreground">Email</dt>
              <dd className="font-medium">{session.user.email}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

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
        />
      ) : null}

      <ReferralCard
        summary={referrals}
        rewardCredits={REFERRAL_REWARD_CREDITS}
        appUrl={appUrl}
      />
    </PageShell>
  );
}
