import {
  ArrowRight,
  BarChart3,
  Building2,
  Check,
  Clapperboard,
  FileText,
  Globe,
  Link2,
  ScanSearch,
  Settings2,
  Share2,
  TriangleAlert,
  Eye,
  CalendarCheck,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { NextActions } from "@/components/dashboard/next-actions";
import { RememberWebsite } from "@/components/dashboard/remember-website";
import { Button } from "@/components/ui/button";
import { PageHeader, PageShell } from "@/components/ui/page-header";
import { requireSession } from "@/lib/auth-guard";
import { resolveDashboard } from "@/lib/dashboard/gate";
import { format, plural } from "@/lib/i18n/format";
import { getAppMessages } from "@/lib/i18n/app-locale";
import { TASKS_COPY } from "@/lib/i18n/tasks";
import { getTasks, type SetupTask, type Tasks, type WorkTaskId } from "@/lib/tasks/tasks";
import { listAccessibleWebsites } from "@/lib/websites/accessible";
import { readSelectedWebsite, resolveWebsiteId } from "@/lib/websites/selected";

export const metadata = { title: "Tasks" };

// Reads the caller's website and its work, so it is per-request by definition.
export const dynamic = "force-dynamic";

/** Next-action kinds this page already has rows for: today's work and set-up. */
const LISTED_BELOW = ["failed", "draft", "publishing", "google"] as const;

const WORK_ICONS: Record<WorkTaskId, LucideIcon> = {
  failed: TriangleAlert,
  drafts: FileText,
  social: Share2,
  videos: Clapperboard,
};

const STEP_ICONS: Record<SetupTask["id"], LucideIcon> = {
  profile: Building2,
  site: Globe,
  "search-console": BarChart3,
  audit: ScanSearch,
  articles: CalendarCheck,
  preferences: Settings2,
  backlinks: Link2,
  prompts: Eye,
};

/**
 * Home > Tasks: what the customer has to do, as a list (client, 2026-11-03:
 * "Here should be as per reference the tasks to complete, like view the
 * audit, connect the account, the website, etc.").
 *
 * Top to bottom: what needs attention now (the next-actions list the
 * dashboard also shows), today's work, the one-off set-up steps, and the
 * accounts to connect. The SEO overview stays at /dashboard, one click away
 * in the header.
 *
 * Which website, and whether to show one at all, is the dashboard's gate
 * (lib/dashboard/gate.ts), so the two pages can never disagree. Anything but
 * a website with an active plan - invitations, nothing yet, a shared site
 * whose owner's plan lapsed - goes to the dashboard, which explains it.
 */
export default async function TasksPage({ searchParams }: PageProps<"/tasks">) {
  const session = await requireSession();
  const params = await searchParams;
  const requested = typeof params.site === "string" ? params.site : null;
  // May redirect: to the plan screen or onboarding, for the caller's OWN site.
  const gate = await resolveDashboard(requested);
  if (gate.kind !== "site") redirect(requested ? `/dashboard?site=${encodeURIComponent(requested)}` : "/dashboard");

  const { ctx } = gate;
  const { locale } = await getAppMessages(session.user.id);
  const t = TASKS_COPY[locale];
  const canManage = ctx.access === "owner";

  /* The shell follows the site on screen when either side is shared, as on the dashboard. */
  const accessible = await listAccessibleWebsites();
  const shellId = resolveWebsiteId(null, await readSelectedWebsite(), accessible.map((site) => site.id));
  const shellShared = accessible.some((site) => site.id === shellId && site.access !== "owner");
  const remember =
    shellId !== ctx.site.id && (ctx.access !== "owner" || shellShared) ? <RememberWebsite websiteId={ctx.site.id} /> : null;

  let tasks: Tasks | null = null;
  try {
    tasks = await getTasks(ctx.site.id, ctx.ownerOrgId, canManage);
  } catch (error) {
    console.error("[tasks] could not load tasks", error);
  }

  return (
    <PageShell>
      {remember}
      <PageHeader
        title={t.title}
        description={format(t.help, { domain: ctx.site.domain })}
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard">{t.overview}</Link>
          </Button>
        }
      />

      {tasks && tasks.total > 0 ? <Progress done={tasks.done} total={tasks.total} t={t} /> : null}

      <Suspense fallback={<div className="h-28 animate-pulse rounded-xl border bg-card" aria-hidden="true" />}>
        <NextActions websiteId={ctx.site.id} ownerOrgId={ctx.ownerOrgId} canManage={canManage} locale={locale} exclude={LISTED_BELOW} />
      </Suspense>

      {!tasks ? (
        <p className="rounded-xl border bg-card p-5 text-sm text-muted-foreground">{t.unavailable}</p>
      ) : (
        <>
          <Section id="tasks-today" title={t.today} help={t.todayHelp}>
            {tasks.work.map((task) => (
              <Row
                key={task.id}
                icon={WORK_ICONS[task.id]}
                title={t.work[task.id].title}
                help={t.work[task.id].help}
                href={task.href}
                done={task.count === 0}
                status={task.count === 0 ? t.nothingWaiting : plural(t.waiting, task.count)}
                doneLabel={t.done}
              />
            ))}
          </Section>

          {tasks.setup.length ? (
            <Section id="tasks-setup" title={t.setup} help={t.setupHelp}>
              {tasks.setup.map((step) => (
                <Row
                  key={step.id}
                  icon={STEP_ICONS[step.id]}
                  title={t.steps[step.id].title}
                  help={t.steps[step.id].help}
                  href={step.href}
                  done={step.done}
                  status={step.done ? t.done : step.optional ? t.optional : t.toDo}
                  muted={step.optional && !step.done}
                  doneLabel={t.done}
                />
              ))}
            </Section>
          ) : null}

          {tasks.accounts.length ? (
            <Section id="tasks-accounts" title={t.accounts} help={t.accountsHelp}>
              {tasks.accounts.map((account) => (
                <Row
                  key={account.id}
                  icon={account.id === "social" ? Share2 : Clapperboard}
                  title={t.account[account.id].title}
                  help={t.account[account.id].help}
                  href={account.href}
                  done={account.connected > 0}
                  status={format(t.connectedOf, { n: account.connected, total: account.available })}
                  doneLabel={t.done}
                />
              ))}
            </Section>
          ) : null}
        </>
      )}
    </PageShell>
  );
}

type Copy = (typeof TASKS_COPY)[keyof typeof TASKS_COPY];

/** The ring and bar from the set-up page, over the one-off tasks. */
function Progress({ done, total, t }: { done: number; total: number; t: Copy }) {
  const complete = done === total;
  return (
    <section
      aria-label={format(t.progress, { n: done, total })}
      className="flex flex-wrap items-center gap-5 rounded-xl border bg-card p-5 text-card-foreground"
    >
      <div className="relative shrink-0">
        <svg viewBox="0 0 96 96" className="size-20" aria-hidden="true">
          <circle cx="48" cy="48" r="42" fill="none" stroke="currentColor" className="text-muted" strokeWidth="8" />
          {/* 264 is the circumference at r=42; the offset is what is left to do. */}
          <circle
            cx="48"
            cy="48"
            r="42"
            fill="none"
            stroke="currentColor"
            className={complete ? "text-emerald-500" : "text-primary"}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray="264"
            strokeDashoffset={264 - (264 * done) / total}
            transform="rotate(-90 48 48)"
          />
        </svg>
        <span className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-lg font-semibold tabular-nums">
            {done}/{total}
          </span>
          <span className="text-[10px] tracking-wide text-muted-foreground uppercase">{t.ringLabel}</span>
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{complete ? t.allDone : format(t.progress, { n: done, total })}</p>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true">
          <div
            className={`h-full rounded-full ${complete ? "bg-emerald-500" : "bg-primary"}`}
            style={{ width: `${Math.round((100 * done) / total)}%` }}
          />
        </div>
      </div>
    </section>
  );
}

function Section({ id, title, help, children }: { id: string; title: string; help: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="rounded-xl border bg-card p-5 text-card-foreground">
      <h2 id={id} className="font-semibold">
        {title}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">{help}</p>
      <ul className="mt-3 divide-y">{children}</ul>
    </section>
  );
}

/**
 * One task: the whole row links to where it is done. A finished task stays
 * in the list, ticked and quieter, so the list reads as progress rather than
 * as chores that silently vanish.
 */
function Row({
  icon: Icon,
  title,
  help,
  href,
  done,
  status,
  muted = false,
  doneLabel,
}: {
  icon: LucideIcon;
  title: string;
  help: string;
  href: string;
  done: boolean;
  status: string;
  /** An optional step not taken: neither done nor outstanding. */
  muted?: boolean;
  doneLabel: string;
}) {
  return (
    <li>
      <Link
        href={href}
        className="group flex min-h-16 items-center gap-3 rounded-md px-1 py-3 hover:bg-accent/50 focus-visible:outline-2 focus-visible:outline-ring"
      >
        <span
          className={`flex size-9 shrink-0 items-center justify-center rounded-full ${
            done
              ? "bg-emerald-500 text-white"
              : muted
                ? "bg-muted text-muted-foreground"
                : "bg-primary/10 text-primary"
          }`}
        >
          {done ? <Check className="size-4" aria-label={doneLabel} /> : <Icon className="size-4" aria-hidden="true" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className={`block text-sm font-medium ${done ? "text-muted-foreground" : ""}`}>{title}</span>
          <span className="mt-0.5 block text-sm break-words text-muted-foreground">{help}</span>
        </span>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap ${
            done
              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
              : muted
                ? "bg-muted text-muted-foreground"
                : "bg-primary/10 text-primary"
          }`}
        >
          {status}
        </span>
        <ArrowRight
          className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
          aria-hidden="true"
        />
      </Link>
    </li>
  );
}
