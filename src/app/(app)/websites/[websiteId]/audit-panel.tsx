"use client";

import { Loader2, RefreshCw, Stethoscope } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { useRefreshWhile } from "@/components/refresh-while";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/states";
import { Notice } from "@/components/workspace/notice";
import { startAudit } from "@/lib/audit/actions";
import { countNeedingDeveloper } from "@/lib/audit/fixes";
import type { Locale } from "@/lib/i18n/config";
import { format } from "@/lib/i18n/format";

import { FixRequest } from "./fix-request";
import { FindingsSection } from "./health-findings";
import {
  PAGES_PER_CHECK,
  failedPages,
  findingTotals,
  formatWhen,
  groupFindings,
  isFollowing,
  issueText,
  localiseStartError,
  notAssessed,
  pagesAffected,
  severityTotals,
  type HealthAudit,
  type HealthRun,
  type HealthText,
  type SeverityFilter,
  type WorkspaceText,
} from "./health-model";
import { AiAccessSection, OverviewSection, RunStatus, SiteDetailsSection } from "./health-sections";

/**
 * Website health: the report of the latest technical check, and the check's
 * own progress.
 *
 * Everything shown is the audit job's stored result (inngest/functions/
 * audit-website.ts) - score, severities and issue definitions unchanged.
 * While a new check is queued or running, or after one failed, the previous
 * report stays on screen, labelled as the previous result. Opening the page,
 * filtering or searching never starts a check: only the button does, and only
 * for an owner or editor whose site may run one.
 */

const BLOCKED_ID = "health-blocked-reason";

export type AuditPanelProps = {
  websiteId: string;
  domain: string;
  audit: HealthAudit | null;
  run: HealthRun;
  /** Addresses the crawl found, when the stored crawl row belongs to the audit on screen. */
  discovered: number | null;
  /** False for a viewer: the report is read-only. */
  canEdit: boolean;
  /** Why an editor cannot start a check right now, already translated; null when they can. */
  blockedReason: string | null;
  /** Null while the support address is the placeholder. */
  supportEmail: string | null;
  initialSeverity: SeverityFilter;
  initialQuery: string;
  locale: Locale;
  t: HealthText;
  tw: WorkspaceText;
};

export function AuditPanel({
  websiteId,
  domain,
  audit,
  run,
  discovered,
  canEdit,
  blockedReason,
  supportEmail,
  initialSeverity,
  initialQuery,
  locale,
  t,
  tw,
}: AuditPanelProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [refusal, setRefusal] = useState<string | null>(null);

  // A queued or running check moves in a background job; follow it until it stops moving.
  useRefreshWhile(isFollowing(run));

  /*
    "Your new report is ready" only for a run this page watched end with a
    NEW audit - derived from the previous render's phase, not guessed from
    the clock.
  */
  const auditId = audit?.id ?? null;
  const [watched, setWatched] = useState({ phase: run.phase, auditId, finished: false });
  if (watched.phase !== run.phase || watched.auditId !== auditId) {
    const wasActive = watched.phase === "queued" || watched.phase === "running";
    setWatched({
      phase: run.phase,
      auditId,
      finished: wasActive && run.phase === "idle" && auditId !== null && auditId !== watched.auditId,
    });
  }

  function handleRun() {
    setRefusal(null);
    startTransition(async () => {
      try {
        const result = await startAudit(websiteId);
        if (!result.ok) {
          setRefusal(localiseStartError(result.error, t, tw));
          return;
        }
        // The request is stored now (a reserved slot and a queued job): the
        // refreshed page shows it as waiting to start, and follows it.
        router.refresh();
      } catch {
        setRefusal(t.errUnexpected);
      }
    });
  }

  const inFlight = isFollowing(run);
  const runButton = canEdit ? (
    <Button
      onClick={handleRun}
      disabled={pending || inFlight || blockedReason !== null}
      aria-describedby={blockedReason ? BLOCKED_ID : undefined}
    >
      {pending || inFlight ? (
        <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
      ) : (
        <RefreshCw aria-hidden="true" />
      )}
      {pending ? t.starting : inFlight ? t.checking : audit ? t.checkAgain : t.checkNow}
    </Button>
  ) : null;

  const checkedAt = audit ? formatWhen(audit.createdAt, locale) : "";
  const announcement =
    run.phase === "queued"
      ? t.queuedTitle
      : run.phase === "running"
        ? t.runningTitle
        : run.phase === "failed"
          ? t.failedTitle
          : watched.finished
            ? t.finishedTitle
            : "";

  return (
    <>
      <PageHeader title={t.title} description={format(t.description, { domain })} actions={audit ? runButton : null} />

      {!canEdit ? <Notice tone="info">{tw.viewOnly}</Notice> : null}
      {canEdit && blockedReason ? (
        <div id={BLOCKED_ID}>
          <Notice tone="warning" title={t.unavailableTitle}>
            {blockedReason}
          </Notice>
        </div>
      ) : null}
      {refusal ? (
        <Notice
          tone="danger"
          role="alert"
          action={
            <Button variant="ghost" size="sm" onClick={() => setRefusal(null)}>
              {t.dismiss}
            </Button>
          }
        >
          {refusal}
        </Notice>
      ) : null}

      <RunStatus
        run={run}
        previousAt={audit ? checkedAt : null}
        finishedAt={watched.finished && audit ? checkedAt : null}
        canEdit={canEdit}
        onRefresh={() => router.refresh()}
        locale={locale}
        t={t}
      />
      {/* Phase changes only; the counts inside the notice tick too often to announce. */}
      <p className="sr-only" role="status" aria-live="polite">
        {announcement}
      </p>

      {audit ? (
        <Report
          audit={audit}
          websiteId={websiteId}
          domain={domain}
          isPrevious={run.phase !== "idle"}
          checkedAt={checkedAt}
          discovered={discovered}
          supportEmail={supportEmail}
          initialSeverity={initialSeverity}
          initialQuery={initialQuery}
          locale={locale}
          t={t}
        />
      ) : isFollowing(run) ? (
        <EmptyState icon={Stethoscope} title={t.firstRunTitle} description={t.firstRunBody} />
      ) : (
        // Also a first run that stopped moving: "on its way" would contradict the notice above it.
        <EmptyState
          icon={Stethoscope}
          title={t.emptyTitle}
          description={canEdit ? format(t.emptyBody, { max: PAGES_PER_CHECK }) : t.emptyViewer}
          action={runButton ?? undefined}
        />
      )}
    </>
  );
}

function Report({
  audit,
  websiteId,
  domain,
  isPrevious,
  checkedAt,
  discovered,
  supportEmail,
  initialSeverity,
  initialQuery,
  locale,
  t,
}: {
  audit: HealthAudit;
  websiteId: string;
  domain: string;
  isPrevious: boolean;
  checkedAt: string;
  discovered: number | null;
  supportEmail: string | null;
  initialSeverity: SeverityFilter;
  initialQuery: string;
  locale: Locale;
  t: HealthText;
}) {
  const findings = groupFindings(audit.rows, audit.typeCounts);
  const totals = severityTotals(audit.typeCounts);
  const pagesRead = typeof audit.summary?.pagesCrawled === "number" ? audit.summary.pagesCrawled : null;
  /** Absent on audits written before the context was collected. */
  const context = audit.summary?.context;

  return (
    <>
      <OverviewSection
        domain={domain}
        score={audit.score}
        checkedAt={checkedAt}
        isPrevious={isPrevious}
        pagesRead={pagesRead}
        pagesFailed={failedPages(audit.typeCounts)}
        discovered={discovered}
        totals={totals}
        findingTotals={findingTotals(findings)}
        notAssessed={notAssessed(audit.summary, t)}
        locale={locale}
        t={t}
      />
      <FindingsSection
        findings={findings}
        totalRows={audit.totalRows}
        loadedRows={audit.rows.length}
        pagesRead={pagesRead}
        isPrevious={isPrevious}
        initialSeverity={initialSeverity}
        initialQuery={initialQuery}
        locale={locale}
        t={t}
      />
      {/*
        Offered after the findings, not before: someone should read what is
        wrong before being asked whether they want it fixed for them.
      */}
      <FixRequest
        domain={domain}
        supportEmail={supportEmail}
        checkedAt={checkedAt}
        findings={findings.map((finding) => ({ label: issueText(finding.type, t).label, count: pagesAffected(finding) }))}
        totals={totals}
        developerCount={countNeedingDeveloper(findings.map((finding) => finding.type))}
        locale={locale}
        t={t}
      />
      <SiteDetailsSection context={context} pagesRead={pagesRead} t={t} />
      <AiAccessSection context={context} pagesRead={pagesRead} websiteId={websiteId} locale={locale} t={t} />
    </>
  );
}
