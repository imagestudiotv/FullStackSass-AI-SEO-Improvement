import type { Metadata } from "next";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getOnboardingHelp, rate, WINDOW_DAYS, type OnboardingHelpRow } from "@/lib/admin/onboarding-help";
import { WELCOME_WINDOW_DAYS } from "@/lib/support/onboarding-welcome";

import { AdminPage, AdminPageHeader, AdminSection, AdminStat } from "../_ui/page";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Onboarding help" };

const day = (value: Date | null) => (value ? value.toISOString().slice(0, 10) : "—");
const time = (value: Date | null) => (value ? `${value.toISOString().slice(0, 16).replace("T", " ")} UTC` : "—");

/**
 * Admin -> Onboarding help (ticket 2026-11-19, item 6, "Track when the
 * welcome message is triggered, opened, dismissed and answered, together with
 * whether the user completes onboarding"): the Crisp onboarding welcome's
 * funnel, its daily trend and the latest welcomes. Read only, no AI calls
 * (lib/admin/onboarding-help.ts); guarded by the admin layout and again by
 * getOnboardingHelp's requireAdmin.
 */
export default async function OnboardingHelpPage() {
  const data = await getOnboardingHelp();
  const t = data.totals;
  const highest = Math.max(0, ...data.perDay.map((entry) => entry.welcomed));
  const switchText = data.switchOn
    ? "On"
    : data.crispConfigured
      ? "Off"
      : "Off (no Crisp website id)";

  return (
    <AdminPage>
      <AdminPageHeader
        title="Onboarding help"
        description={`The Crisp onboarding welcome ("RepGet - Proactive Human Support During Onboarding"): new accounts in their first ${WELCOME_WINDOW_DAYS} days, after 60 seconds on the dashboard with setup unfinished and an operator online. Funnel: accounts that signed up in the last ${WINDOW_DAYS} UTC days.`}
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <AdminStat
          label="Welcome switch (CRISP_ONBOARDING_WELCOME)"
          value={switchText}
          hint={
            data.switchOn
              ? "Welcomes are being claimed. Each account gets one, ever."
              : "Set CRISP_ONBOARDING_WELCOME=1 in Vercel and redeploy, after the Crisp trigger repget_onboarding_human_help exists."
          }
        />
        <AdminStat
          label="Existing-conversation check in Crisp"
          value={data.crispApiConfigured ? "On" : "Off"}
          hint={
            data.crispApiConfigured
              ? "Before each welcome, Crisp is asked by email whether a conversation already exists."
              : "CRISP_API_IDENTIFIER / CRISP_API_KEY not set: only conversations seen in the app are known."
          }
        />
        <AdminStat
          label="Not welcomed: conversation first"
          value={t.conversationFirst}
          hint={`${t.foundInCrisp} of them found in Crisp, the rest wrote in the app first`}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <AdminStat label="Eligible (estimate)" value={t.eligible} hint="New, own an unpaid workspace; an upper bound" />
        <AdminStat label="Welcomed" value={t.welcomed} hint={`${rate(t.welcomed, t.eligible)} of eligible`} />
        <AdminStat label="Opened" value={t.opened} hint={`${rate(t.opened, t.welcomed)} of welcomed`} />
        <AdminStat label="Dismissed" value={t.dismissed} hint={`${rate(t.dismissed, t.welcomed)} · closed with nothing sent`} />
        <AdminStat label="Answered" value={t.answered} hint={`${rate(t.answered, t.welcomed)} of welcomed`} />
        <AdminStat label="Onboarding completed" value={t.completed} hint={`${rate(t.completed, t.welcomed)} of welcomed`} />
      </div>

      <AdminSection
        id="trend"
        title="Daily trend"
        description={`Each event on the UTC day it happened, ${data.perDay[0]?.day} to ${data.perDay[data.perDay.length - 1]?.day}. The bars are welcomes.`}
      >
        <div className="flex h-20 items-end gap-1" role="img" aria-label={`Welcomes on each of the last ${WINDOW_DAYS} days`}>
          {data.perDay.map((entry) => (
            <div
              key={entry.day}
              title={`${entry.day}: ${entry.welcomed} welcomed, ${entry.opened} opened, ${entry.answered} answered`}
              className="min-w-0 flex-1 rounded-t bg-primary/70"
              style={{ height: `${highest ? Math.max(2, Math.round((entry.welcomed / highest) * 100)) : 2}%` }}
            />
          ))}
        </div>
        <div className="mt-4 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Day</TableHead>
                <TableHead className="text-right">Sign-ups</TableHead>
                <TableHead className="text-right">Welcomed</TableHead>
                <TableHead className="text-right">Opened</TableHead>
                <TableHead className="text-right">Dismissed</TableHead>
                <TableHead className="text-right">Answered</TableHead>
                <TableHead className="text-right">Completed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...data.perDay].reverse().map((entry) => (
                <TableRow key={entry.day}>
                  <TableCell>{entry.day}</TableCell>
                  <TableCell className="text-right">{entry.signups}</TableCell>
                  <TableCell className="text-right">{entry.welcomed}</TableCell>
                  <TableCell className="text-right">{entry.opened}</TableCell>
                  <TableCell className="text-right">{entry.dismissed}</TableCell>
                  <TableCell className="text-right">{entry.answered}</TableCell>
                  <TableCell className="text-right">{entry.completed}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </AdminSection>

      <AdminSection
        id="recent"
        title="Recent welcomes and conversations"
        description="The latest 50, newest first. Times are UTC; — means not reached yet."
        bodyClassName="p-0"
      >
        {data.recent.length ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Workspace</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Signed up</TableHead>
                  <TableHead>Welcomed</TableHead>
                  <TableHead>Opened</TableHead>
                  <TableHead>Dismissed</TableHead>
                  <TableHead>Answered</TableHead>
                  <TableHead>Setup completed</TableHead>
                  <TableHead className="text-right">Requests</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.recent.map((row) => (
                  <RecentRow key={row.userId} row={row} />
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <p className="p-5 text-sm text-muted-foreground">
            No welcomes or conversations yet. They appear here once the switch is on and the first new account waits 60 seconds on the dashboard.
          </p>
        )}
      </AdminSection>
    </AdminPage>
  );
}

function RecentRow({ row }: { row: OnboardingHelpRow }) {
  return (
    <TableRow>
      <TableCell>
        <span className="font-medium">{row.name ?? row.userId}</span>
        {row.email ? <span className="block text-xs text-muted-foreground">{row.email}</span> : null}
      </TableCell>
      <TableCell>{row.organizationName ?? row.organizationId ?? "—"}</TableCell>
      <TableCell>{row.plan}</TableCell>
      <TableCell>{day(row.signedUpAt)}</TableCell>
      <TableCell>
        {row.welcomedAt ? (
          time(row.welcomedAt)
        ) : (
          <span className="text-xs text-muted-foreground">
            Not welcomed: {row.foundInCrisp ? "conversation found in Crisp" : "wrote first"} ({day(row.firstMessageAt)})
          </span>
        )}
      </TableCell>
      <TableCell>{time(row.openedAt)}</TableCell>
      <TableCell>{time(row.dismissedAt)}</TableCell>
      <TableCell>{time(row.answeredAt)}</TableCell>
      <TableCell>{time(row.completedAt)}</TableCell>
      <TableCell className="text-right">{row.supportRequests}</TableCell>
    </TableRow>
  );
}
