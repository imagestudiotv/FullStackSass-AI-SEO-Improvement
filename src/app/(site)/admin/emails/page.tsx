import type { Metadata } from "next";

import { getLifecycleEmailsAdmin } from "@/lib/admin/emails";
import { ESSENTIAL, LIFECYCLE_KINDS, type LifecycleKind } from "@/lib/email/lifecycle-copy";
import { formatDate, formatNumber } from "@/lib/i18n/format";

import { AdminPage, AdminPageHeader, AdminSection } from "../_ui/page";
import { LifecycleEmailsSwitch } from "./emails-switch";

export const metadata: Metadata = { title: "Emails" };

/** What each lifecycle email is and when it goes, in an administrator's words (docs/emails.md). */
const KIND_ADMIN: Record<LifecycleKind, { label: string; when: string }> = {
  welcome: { label: "Welcome", when: "Right after sign-up." },
  setup_reminder: { label: "Setup reminder", when: "3 hours after sign-up, if the person still has no website." },
  trial_started: { label: "Free trial started", when: "When a website starts its free trial (card or PayPal)." },
  trial_progress: { label: "Fingers crossed (free trial, day 2)", when: "About 24 hours into a free trial, with the website's first figures; unless paid or cancelled." },
  trial_ending: { label: "Free trial ends tomorrow (continue growing)", when: "About 24 hours before the free trial ends, unless paid or cancelled." },
  trial_ended: { label: "Free trial ended", when: "When a free trial ends without a plan starting." },
  plan_started: { label: "Welcome to your plan", when: "On the subscription's first payment of real money." },
  payment_failed: { label: "Payment failed", when: "When Stripe or PayPal marks a plan as waiting for payment." },
  cancellation_confirmed: { label: "Cancellation confirmed", when: "When a plan is cancelled, with the day access ends." },
  article_published: { label: "Article live", when: "When an article goes live on the customer's site, once per article." },
  article_failed: { label: "Article not published", when: "When publishing fails for good; at most one a day per website." },
  video_views: { label: "Video passed 500 views", when: "Once per video (the 1,000-views email is separate and always on)." },
  referral_reward: { label: "Referral reward", when: "When referral credits are added to the referrer's balance." },
  weekly_summary: { label: "Weekly summary", when: "Monday 08:00 UTC, to workspaces on a plan that published something that week." },
  winback: { label: "Win-back offer", when: "About 2 days after a subscription the customer left has ended, if they have no other; once per person. Needs WINBACK_OFFER_ENABLED=1." },
};

/**
 * Admin -> Emails: the lifecycle emails' on/off switch, what each one is,
 * and what they did in the last 30 days.
 */
export default async function AdminEmailsPage() {
  const data = await getLifecycleEmailsAdmin();
  const count = (kind: string, status: string) =>
    data.totals.find((row) => row.kind === kind && row.status === status)?.count ?? 0;

  return (
    <AdminPage width="default">
      <AdminPageHeader
        title="Emails"
        description="The automatic emails customers get about their account, billing, articles and videos, in their own language. Off until switched on here. Sign-in codes, invitations and the 1,000-views video email are not affected by this switch."
        meta={
          data.updatedAt ? (
            <span>
              Last changed {formatDate(data.updatedAt, "en", { day: "numeric", month: "short", year: "numeric" })}
              {data.updatedBy ? ` by ${data.updatedBy}` : ""}
            </span>
          ) : (
            <span>Never switched on.</span>
          )
        }
      />

      <AdminSection title="Switch" bodyClassName="p-0">
        <LifecycleEmailsSwitch enabled={data.enabled} />
      </AdminSection>

      <AdminSection
        title="The emails"
        description="Essential emails are always sent. Tips and reports can be turned off by each person (Settings, or the link in each one). Last 30 days."
        bodyClassName="p-0"
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] text-sm">
            <thead className="border-b bg-muted/30 text-xs text-muted-foreground">
              <tr>
                <th scope="col" className="px-5 py-2 text-left font-medium">Email</th>
                <th scope="col" className="px-5 py-2 text-left font-medium">Type</th>
                <th scope="col" className="px-5 py-2 text-right font-medium">Sent</th>
                <th scope="col" className="px-5 py-2 text-right font-medium">Skipped</th>
                <th scope="col" className="px-5 py-2 text-right font-medium">Failed</th>
              </tr>
            </thead>
            <tbody>
              {LIFECYCLE_KINDS.map((kind) => (
                <tr key={kind} className="border-b last:border-b-0 align-top">
                  <td className="px-5 py-2.5">
                    <div className="font-medium">{KIND_ADMIN[kind].label}</div>
                    <div className="text-xs text-muted-foreground">{KIND_ADMIN[kind].when}</div>
                  </td>
                  <td className="px-5 py-2.5 text-muted-foreground">{ESSENTIAL[kind] ? "Essential" : "Tips and reports"}</td>
                  <td className="px-5 py-2.5 text-right tabular-nums">{formatNumber(count(kind, "sent"), "en")}</td>
                  <td className="px-5 py-2.5 text-right tabular-nums">{formatNumber(count(kind, "skipped"), "en")}</td>
                  <td className="px-5 py-2.5 text-right tabular-nums">{formatNumber(count(kind, "failed"), "en")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </AdminSection>

      <AdminSection title="Latest" description="The 50 most recent, with the reason when one was skipped or failed." bodyClassName="p-0">
        {data.recent.length === 0 ? (
          <p className="px-5 py-4 text-sm text-muted-foreground">Nothing yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] text-sm">
              <thead className="border-b bg-muted/30 text-xs text-muted-foreground">
                <tr>
                  <th scope="col" className="px-5 py-2 text-left font-medium">When</th>
                  <th scope="col" className="px-5 py-2 text-left font-medium">Email</th>
                  <th scope="col" className="px-5 py-2 text-left font-medium">To</th>
                  <th scope="col" className="px-5 py-2 text-left font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.recent.map((row) => (
                  <tr key={row.id} className="border-b last:border-b-0 align-top">
                    <td className="px-5 py-2.5 whitespace-nowrap text-muted-foreground">
                      {formatDate(row.createdAt, "en", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td className="px-5 py-2.5">{KIND_ADMIN[row.kind as LifecycleKind]?.label ?? row.kind}</td>
                    <td className="px-5 py-2.5 [overflow-wrap:anywhere]">{row.recipient ?? "-"}</td>
                    <td className="px-5 py-2.5">
                      {row.status}
                      {row.reason ? <span className="text-muted-foreground"> ({row.reason})</span> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AdminSection>
    </AdminPage>
  );
}
