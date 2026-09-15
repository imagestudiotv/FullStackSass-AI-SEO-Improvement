import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PageHeader, PageShell } from "@/components/ui/page-header";
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
import { SettingsLinks } from "./settings-links";
import { WebsiteMembers } from "./website-members";

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
  const configured = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "");
  const appUrl =
    configured && !configured.includes("localhost")
      ? configured
      : "https://seovision.io";

  return (
    <PageShell>
      <PageHeader
        title="Settings"
        description="Your account, your plan, and the connections that carry your articles."
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Account</CardTitle>
          <CardDescription>Signed in as {session.user.email}</CardDescription>
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

      <SettingsLinks websiteId={websiteId} />

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
