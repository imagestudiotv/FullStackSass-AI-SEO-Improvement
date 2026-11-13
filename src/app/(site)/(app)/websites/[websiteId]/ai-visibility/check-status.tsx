"use client";

import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Notice } from "@/components/workspace/notice";
import type { Locale } from "@/lib/i18n/config";
import { format } from "@/lib/i18n/format";
import type { Messages } from "@/lib/i18n/messages";

import { formatWhen } from "./format-when";
import type { CheckProgress } from "./visibility-state";

type GeoText = Messages["app"]["geo"];

/**
 * Where the check the customer is following stands: queued, running,
 * complete, finished with gaps, timed out, or never ran - and a refused
 * press. Counts are real (questions in the check with a new answer), never
 * a time-based estimate.
 *
 * The visible notice has no live role: its counter changes every few seconds
 * while a check runs, and announcing each tick would drown a screen reader.
 * A separate polite region announces only the change of state.
 */
export function CheckStatus({
  progress,
  hidden,
  refusal,
  onDismiss,
  onDismissRefusal,
  canEdit,
  locale,
  t,
}: {
  progress: CheckProgress;
  /** The customer dismissed this outcome. */
  hidden: boolean;
  /** Why the last press of Check now was refused, already translated. */
  refusal: string | null;
  onDismiss: () => void;
  onDismissRefusal: () => void;
  /** Owner or editor. A viewer cannot run a check, so the copy never suggests one. */
  canEdit: boolean;
  locale: Locale;
  t: GeoText;
}) {
  const { phase, answered, expected, request } = progress;
  const requested = request ? format(t.statusRequestedAt, { date: formatWhen(request.requestedAt, locale, true) }) : null;
  const counted = format(t.statusProgress, { answered, total: expected });
  const timedOutBody = canEdit ? t.statusTimedOutBody : t.statusTimedOutBodyViewer;
  const failedBody = canEdit ? t.statusFailedBody : t.statusFailedBodyViewer;
  const dismiss = (
    <Button variant="ghost" size="sm" onClick={onDismiss}>
      {t.dismiss}
    </Button>
  );

  let notice: ReactNode = null;
  let announce = "";
  if (!hidden) {
    switch (phase) {
      case "queued":
      case "running": {
        const percent = expected > 0 ? Math.round((answered / expected) * 100) : 0;
        announce = phase === "queued" ? t.statusQueuedTitle : t.statusRunningTitle;
        notice = (
          <Notice tone="info" title={announce}>
            <p>{phase === "queued" ? t.statusQueuedBody : t.statusRunningBody}</p>
            <div className="mt-3 space-y-1.5">
              <div
                role="progressbar"
                aria-label={t.progressLabel}
                aria-valuemin={0}
                aria-valuemax={expected}
                aria-valuenow={answered}
                aria-valuetext={counted}
                className="h-1.5 w-full max-w-md overflow-hidden rounded-full bg-muted"
              >
                <div
                  className="h-full rounded-full bg-primary transition-[width] duration-500 motion-reduce:transition-none"
                  style={{ width: `${percent}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground tabular-nums">
                {counted}
                {requested ? <span> · {requested}</span> : null}
              </p>
            </div>
          </Notice>
        );
        break;
      }
      case "completed":
        announce = t.statusCompletedTitle;
        notice = (
          <Notice tone="success" title={announce} action={dismiss}>
            <p>{t.statusCompletedBody}</p>
            <p className="mt-1 text-xs text-muted-foreground tabular-nums">{counted}</p>
          </Notice>
        );
        break;
      case "partial":
        announce = t.statusPartialTitle;
        notice = (
          <Notice tone="warning" title={announce} action={dismiss}>
            <p>{format(t.statusPartialBody, { answered, total: expected })}</p>
          </Notice>
        );
        break;
      case "timedOut":
        announce = t.statusTimedOutTitle;
        notice = (
          <Notice tone="warning" title={announce} action={dismiss}>
            <p>{timedOutBody}</p>
          </Notice>
        );
        break;
      case "failed":
        announce = t.statusFailedTitle;
        notice = (
          <Notice tone="danger" title={announce} action={dismiss}>
            <p>
              {request
                ? format(failedBody, { date: formatWhen(request.requestedAt, locale, true) })
                : timedOutBody}
            </p>
          </Notice>
        );
        break;
      case "idle":
        break;
    }
  }

  return (
    <>
      <p className="sr-only" role="status" aria-live="polite">
        {refusal ? `${t.statusRefusedTitle}. ${refusal}` : announce}
      </p>
      {refusal ? (
        <Notice
          tone="danger"
          title={t.statusRefusedTitle}
          action={
            <Button variant="ghost" size="sm" onClick={onDismissRefusal}>
              {t.dismiss}
            </Button>
          }
        >
          <p>{refusal}</p>
        </Notice>
      ) : null}
      {notice}
    </>
  );
}
