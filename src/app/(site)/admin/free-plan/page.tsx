import type { Metadata } from "next";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getFreePlanLaunch, type FreePlanAccountRow } from "@/lib/admin/free-plan";
import { FREE_PLAN, FREE_PLAN_OBSERVATION_DAYS } from "@/lib/plans/free-plan";

import { AdminPage, AdminPageHeader, AdminSection, AdminStat } from "../_ui/page";
import { FreePlanCapForm } from "./cap-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Free plan launch" };

const usd = (cents: number) =>
  new Intl.NumberFormat("en", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(cents / 100);
const day = (value: Date | null) => (value ? value.toISOString().slice(0, 10) : "—");
const pct = (part: number, whole: number) => (whole ? `${Math.round((part / whole) * 100)}%` : "—");
const DAY_MS = 86_400_000;

/**
 * Admin -> Free plan launch (Daniel, 2026-11-19): the Free plan's controlled
 * launch - signups against the cap, the 30-day observation window from the
 * first Free account, each Free workspace's milestones, upgrade requests,
 * and its AI and API cost against the caps. This page makes no AI calls
 * (lib/admin/free-plan.ts).
 */
export default async function FreePlanLaunchPage() {
  const data = await getFreePlanLaunch();
  const n = data.taken;
  const windowDay = data.launchedAt
    ? Math.min(FREE_PLAN_OBSERVATION_DAYS, Math.floor((Date.now() - data.launchedAt.getTime()) / DAY_MS) + 1)
    : null;
  const highest = Math.max(0, ...data.perDay.map((entry) => entry.cents));

  return (
    <AdminPage>
      <AdminPageHeader
        title="Free plan launch"
        description={`The Free plan's controlled launch: ${FREE_PLAN.articlesPerMonth} articles, ${FREE_PLAN.socialPostsPerMonth} social posts, 1 limited audit and 1 AI visibility snapshot a month, ${FREE_PLAN.copilotPerDay} Copilot requests a day. Spend is what usage_events recorded, in USD; calls without a recorded price count as zero.`}
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <AdminStat
          label="Free signups"
          value={`${n} / ${data.cap}`}
          hint={`${pct(n, data.cap)} of the cap${data.capFromSetting ? "" : " (the default; no admin setting yet)"}`}
        />
        <AdminStat
          label="Observation window"
          value={windowDay ? `Day ${windowDay} / ${FREE_PLAN_OBSERVATION_DAYS}` : "Not started"}
          hint={data.launchedAt ? `${day(data.launchedAt)} to ${day(data.windowEndsAt)}, from the first Free account` : "Starts with the first Free account."}
        />
        <AdminStat
          label="Converted to paid"
          value={data.totals.converted}
          hint={`${pct(data.totals.converted, n)} · ${data.totals.checkoutsStarted} started a checkout · ${data.totals.upgradeClicks} upgrade clicks`}
        />
        <AdminStat
          label="AI/API spend (Free)"
          value={usd(data.totals.spendCents)}
          hint={`${usd(data.totals.averageCents)} per Free account · today ${usd(data.todaySpendCents)} of the ${usd(data.dailyBudgetCents)} daily budget`}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <AdminStat label="Website connected (CMS)" value={pct(data.totals.withCms, n)} hint={`${data.totals.withCms} of ${n}`} />
        <AdminStat label="First article generated" value={pct(data.totals.withArticle, n)} hint={`${data.totals.withArticle} of ${n}`} />
        <AdminStat label="First content published" value={pct(data.totals.withPublished, n)} hint={`${data.totals.withPublished} of ${n}`} />
        <AdminStat label="Social scheduled" value={pct(data.totals.withSocial, n)} hint={`${data.totals.withSocial} of ${n}`} />
        <AdminStat
          label="Support requests"
          value={data.totals.supportRequests ?? "—"}
          hint={data.totals.supportRequests === null ? "From Crisp, once connected." : "Crisp conversations"}
        />
      </div>

      <AdminSection
        id="cost-protection"
        title="Cost protection"
        description={`Per Free account, AI generation pauses at ${usd(data.monthlyCapCents)} a month (FREE_PLAN_MONTHLY_AI_COST_CAP_CENTS). For all Free accounts together it pauses for the rest of the UTC day at ${usd(data.dailyBudgetCents)} (FREE_PLAN_DAILY_AI_BUDGET_CENTS; 0 stops all Free generation). Both are Vercel environment settings.`}
      >
        <div className="flex h-24 items-end gap-1" role="img" aria-label="Free AI and API spend for each of the last 30 days">
          {data.perDay.map((entry) => (
            <div
              key={entry.day}
              title={`${entry.day}: ${usd(entry.cents)}`}
              className={`min-w-0 flex-1 rounded-t ${data.dailyBudgetCents > 0 && entry.cents >= data.dailyBudgetCents ? "bg-destructive" : "bg-primary/70"}`}
              style={{ height: `${highest ? Math.max(2, Math.round((entry.cents / highest) * 100)) : 2}%` }}
            />
          ))}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Last 30 UTC days, {data.perDay[0]?.day} to {data.perDay[data.perDay.length - 1]?.day}. Highest day {usd(highest)}.
        </p>
      </AdminSection>

      <AdminSection id="cap" title="Launch cap" bodyClassName="p-0">
        <FreePlanCapForm cap={data.cap} taken={n} />
      </AdminSection>

      <AdminSection id="accounts" title="Free accounts" description="Newest first. Dates are UTC days; — means not reached yet." bodyClassName="p-0">
        {data.accounts.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Website / account</TableHead>
                <TableHead>Started</TableHead>
                <TableHead>CMS connected</TableHead>
                <TableHead>First article</TableHead>
                <TableHead>First published</TableHead>
                <TableHead>Social scheduled</TableHead>
                <TableHead>Upgrade</TableHead>
                <TableHead>AI/API spend</TableHead>
                <TableHead>Support</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.accounts.map((row) => (
                <AccountRow key={row.organizationId} row={row} monthlyCapCents={data.monthlyCapCents} />
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="p-5 text-sm text-muted-foreground">No Free accounts yet. They appear here from the first &quot;Start Free&quot;.</p>
        )}
      </AdminSection>
    </AdminPage>
  );
}

function AccountRow({ row, monthlyCapCents }: { row: FreePlanAccountRow; monthlyCapCents: number }) {
  const upgrade = row.converted
    ? "Converted"
    : row.checkoutsStarted
      ? `Checkout started (${row.checkoutsStarted})`
      : row.upgradeClicks
        ? `${row.upgradeClicks} click(s)`
        : "—";
  const paused = row.spendMonthCents >= monthlyCapCents;
  return (
    <TableRow>
      <TableCell>
        <span className="font-medium">{row.domain}</span>
        <span className="block text-xs text-muted-foreground">{row.email ?? row.organizationName ?? row.organizationId}</span>
        {row.websiteId ? null : <span className="block text-xs text-muted-foreground">Website deleted</span>}
      </TableCell>
      <TableCell>{day(row.startedAt)}</TableCell>
      <TableCell>{day(row.cmsConnectedAt)}</TableCell>
      <TableCell>
        {day(row.firstArticleAt)}
        {row.articles ? <span className="block text-xs text-muted-foreground">{row.articles} article(s)</span> : null}
      </TableCell>
      <TableCell>{day(row.firstPublishedAt)}</TableCell>
      <TableCell>{row.socialScheduled || "—"}</TableCell>
      <TableCell>{upgrade}</TableCell>
      <TableCell>
        {usd(row.spendTotalCents)}
        <span className={`block text-xs ${paused ? "font-medium text-destructive" : "text-muted-foreground"}`}>
          {usd(row.spendMonthCents)} this month{paused ? " · paused" : ""}
        </span>
      </TableCell>
      <TableCell>{row.supportRequests ?? "—"}</TableCell>
    </TableRow>
  );
}
