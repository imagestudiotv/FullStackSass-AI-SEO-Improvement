"use client";

import {
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  ExternalLink,
  Info,
  Loader2,
  Send,
  Upload,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useId } from "react";

import { Button } from "@/components/ui/button";
import { Notice } from "@/components/workspace/notice";
import { WorkspaceSection } from "@/components/workspace/section";
import { format } from "@/lib/i18n/format";
import type { Messages } from "@/lib/i18n/messages";
import { cn } from "@/lib/utils";

import { ConfirmDialog } from "./confirm-dialog";
import { publishFailureText } from "./failure-copy";
import type { PublishFacts, PublishPlan } from "./publish-state";

type Line = { icon: LucideIcon; tone: "progress" | "info" | "success" | "warning" | "danger"; text: string; detail?: string };

const TONE_CLASS: Record<Line["tone"], string> = {
  progress: "text-foreground",
  info: "text-foreground",
  success: "text-emerald-800",
  warning: "text-amber-900",
  danger: "text-foreground",
};

const ICON_CLASS: Record<Line["tone"], string> = {
  progress: "text-primary",
  info: "text-muted-foreground",
  success: "text-emerald-700",
  warning: "text-amber-700",
  danger: "text-destructive",
};

/** What is happening now (a hold, or work in progress), if anything. */
function currentLine(input: {
  facts: PublishFacts;
  plan: PublishPlan;
  working: boolean;
  awaiting: boolean;
  pressExpired: boolean;
  pressTime: string | null;
  t: Messages["app"]["editor"];
}): Line | null {
  const { facts, plan, t } = input;
  if (input.working) return { icon: Loader2, tone: "progress", text: t.stateWriting };
  if (facts.frozen) return { icon: AlertTriangle, tone: "warning", text: t.stateFrozen };
  if (facts.review === "pending") return { icon: AlertTriangle, tone: "warning", text: t.stateReviewPending };
  if (facts.review === "changed") return { icon: AlertTriangle, tone: "warning", text: t.stateReviewChanged };
  if (facts.delivering) return { icon: Loader2, tone: "progress", text: t.stateDelivering };
  if (input.awaiting && !input.pressExpired) {
    return { icon: Loader2, tone: "progress", text: format(t.stateQueued, { time: input.pressTime ?? "" }) };
  }
  if (input.awaiting) return { icon: AlertTriangle, tone: "warning", text: t.stateQueuedLong };
  if (plan.mode === "pluginWaiting") {
    return {
      icon: Loader2,
      tone: "progress",
      text: format(t.statePluginWaiting, { mode: plan.as === "draft" ? t.modeDraft : t.modeLive }),
    };
  }
  if (facts.uncertain) return { icon: AlertTriangle, tone: "warning", text: t.stateUncertain };
  return null;
}

/** The latest recorded result of sending it. */
function outcomeLine(facts: PublishFacts, t: Messages["app"]["editor"]): Line {
  const outcome = facts.lastOutcome;
  switch (outcome.kind) {
    case "live":
      return { icon: CheckCircle2, tone: "success", text: format(t.stateLive, { date: outcome.when }) };
    case "draft":
      return { icon: CircleDashed, tone: "info", text: format(t.stateDraft, { date: outcome.when }) };
    case "scheduled":
      return { icon: CircleDashed, tone: "info", text: format(t.stateScheduled, { date: outcome.when }) };
    case "delivered":
      return { icon: Info, tone: "info", text: format(t.stateDelivered, { date: outcome.when }) };
    case "pluginUnconfirmed":
      return { icon: AlertTriangle, tone: "warning", text: format(t.statePluginUnconfirmed, { date: outcome.when }) };
    case "failed":
      return {
        icon: XCircle,
        tone: "danger",
        text: format(t.stateFailed, { date: outcome.when }),
        detail: publishFailureText(outcome.errorKind, t),
      };
    default:
      return { icon: Info, tone: "info", text: t.stateNotSent };
  }
}

function StateLine({ line, id }: { line: Line; id?: string }) {
  const Icon = line.icon;
  return (
    <div id={id} className={cn("flex items-start gap-2 text-sm", TONE_CLASS[line.tone])}>
      <Icon
        className={cn(
          "mt-0.5 size-4 shrink-0",
          ICON_CLASS[line.tone],
          Icon === Loader2 && "animate-spin motion-reduce:animate-none",
        )}
        aria-hidden="true"
      />
      <div className="min-w-0 space-y-0.5">
        <p>{line.text}</p>
        {line.detail ? <p className="text-muted-foreground">{line.detail}</p> : null}
      </div>
    </div>
  );
}

/**
 * Where the article goes, where it stands, and the two publishing actions -
 * kept apart from Save (the save bar) and Rewrite (its own section) so the
 * three are never confused. Every state is the server's: "queued" stays
 * queued until a delivery is recorded.
 */
export function ArticlePublishing({
  websiteId,
  plan,
  facts,
  working,
  canEdit,
  pressing,
  awaiting,
  pressExpired,
  pressTime,
  pressError,
  pluginNotice,
  checking,
  onPublish,
  onCheckAgain,
  className,
  t,
  tCommon,
}: {
  websiteId: string;
  plan: PublishPlan;
  facts: PublishFacts;
  working: boolean;
  canEdit: boolean;
  /** The press waiting for the server's answer. */
  pressing: "publish" | "draft" | null;
  /** A queued press whose result has not been recorded yet. */
  awaiting: boolean;
  pressExpired: boolean;
  pressTime: string | null;
  pressError: string | null;
  /** The WordPress plugin's immediate answer to a press. */
  pluginNotice: { tone: "success" | "warning"; text: string; href?: string } | null;
  checking: boolean;
  onPublish: (status: "publish" | "draft") => void;
  onCheckAgain: () => void;
  className?: string;
  t: Messages["app"]["editor"];
  tCommon: Messages["app"]["common"];
}) {
  const statusId = useId();
  const unsavedId = useId();
  const liveSentId = useId();
  const draftSentId = useId();
  const now = currentLine({ facts, plan, working, awaiting, pressExpired, pressTime, t });
  const outcome = outcomeLine(facts, t);
  const destination = facts.destination;

  const actions = plan.mode === "actions" ? plan : null;
  const blocked = actions?.blocked ?? null;
  const busy = pressing !== null;
  const liveSent = Boolean(actions && !blocked && actions.publishAlreadySent);
  const draftSent = Boolean(actions && !blocked && actions.draftAlreadySent);
  /** Each button is described by the reason it waits: a hold (the status line), unsaved edits, or its own version already sent. */
  const describedBy = (own: string | null) =>
    [blocked === "unsaved" ? unsavedId : blocked ? statusId : null, own].filter(Boolean).join(" ") || undefined;

  /** Send as draft. On a live post it asks first (the dialog's trigger opens it), since a draft can take the post offline. */
  const draftButton = (confirmFirst: boolean, disabled: boolean) => (
    <Button
      type="button"
      variant="outline"
      disabled={disabled}
      aria-describedby={describedBy(draftSent ? draftSentId : null)}
      onClick={confirmFirst ? undefined : () => onPublish("draft")}
    >
      {pressing === "draft" ? <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : null}
      {t.sendAsDraft}
    </Button>
  );

  return (
    <WorkspaceSection
      id="article-publishing"
      icon={Send}
      title={t.publishingTitle}
      description={t.publishingHelp}
      className={className}
      bodyClassName="space-y-4"
    >
      {/* Announced as it changes: queued, delivering, the result. */}
      <div role="status" aria-live="polite" className="space-y-2">
        {now ? <StateLine line={now} id={statusId} /> : null}
        <StateLine line={outcome} />
      </div>

      {now && awaiting && pressExpired ? (
        <Button type="button" variant="outline" size="sm" disabled={checking} onClick={onCheckAgain}>
          {checking ? <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : null}
          {t.checkAgain}
        </Button>
      ) : null}

      <dl className="grid gap-3 text-sm sm:grid-cols-3 xl:grid-cols-1">
        <div className="min-w-0">
          <dt className="text-xs text-muted-foreground">{t.destinationLabel}</dt>
          <dd className="mt-0.5 font-medium wrap-anywhere">
            {destination.kind === "direct"
              ? destination.site
                ? `${destination.name} · ${destination.site}`
                : destination.name
              : destination.kind === "plugin"
                ? t.destinationPlugin
                : t.destinationNone}
          </dd>
          <dd className="mt-0.5">
            <Link
              href={`/websites/${websiteId}/integrations`}
              className="rounded-sm text-xs font-medium text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {t.manageConnection}
            </Link>
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-xs text-muted-foreground">{t.plannedLabel}</dt>
          <dd className="mt-0.5 font-medium">{facts.planned ?? t.plannedNone}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-xs text-muted-foreground">{t.autoLabel}</dt>
          <dd className="mt-0.5 font-medium">
            {facts.autoPublish === "live" ? t.autoOnLive : facts.autoPublish === "draft" ? t.autoOnDraft : t.autoOff}
          </dd>
        </div>
      </dl>

      {plan.mode === "pluginPublished" ? <Notice tone="info">{t.statePluginPublished}</Notice> : null}

      {canEdit && plan.mode === "connect" ? (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">{t.connectHelp}</p>
          {/* Wraps: "Website verbinden, um zu veröffentlichen" is wider than this panel on a phone or beside the article. */}
          <Button asChild className="h-auto min-h-8 whitespace-normal text-left">
            <Link href={`/websites/${websiteId}/integrations`}>
              <Upload aria-hidden="true" />
              {t.connectToPublish}
            </Link>
          </Button>
        </div>
      ) : null}

      {actions ? (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            {actions.confirmDraft ? (
              <ConfirmDialog
                trigger={draftButton(true, busy || blocked !== null || actions.draftAlreadySent)}
                disabled={busy || blocked !== null || actions.draftAlreadySent}
                title={t.confirmDraftTitle}
                confirmLabel={t.sendAsDraft}
                cancelLabel={tCommon.cancel}
                onConfirm={() => onPublish("draft")}
              >
                <p>{t.confirmDraftBody}</p>
              </ConfirmDialog>
            ) : (
              draftButton(false, busy || blocked !== null || actions.draftAlreadySent)
            )}
            <Button
              type="button"
              disabled={busy || blocked !== null || actions.publishAlreadySent}
              aria-describedby={describedBy(liveSent ? liveSentId : null)}
              onClick={() => onPublish("publish")}
            >
              {pressing === "publish" ? (
                <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
              ) : (
                <Upload aria-hidden="true" />
              )}
              {actions.publishLabel === "update" ? t.updatePost : t.publish}
            </Button>
          </div>
          {blocked === "unsaved" ? (
            <p id={unsavedId} className="text-xs leading-5 text-muted-foreground">
              {t.blockedUnsaved}
            </p>
          ) : null}
          {liveSent ? (
            <p id={liveSentId} className="text-xs leading-5 text-muted-foreground">
              {t.alreadySentLive}
            </p>
          ) : null}
          {draftSent ? (
            <p id={draftSentId} className="text-xs leading-5 text-muted-foreground">
              {t.alreadySentDraft}
            </p>
          ) : null}
          {facts.plannedInFuture && !facts.liveOnSite && !blocked ? (
            <p className="text-xs leading-5 text-muted-foreground">{t.beforePlanned}</p>
          ) : null}
          {facts.uncertain && !facts.liveOnSite ? (
            <p className="text-xs leading-5 text-muted-foreground">{t.uncertainPublishNote}</p>
          ) : null}
        </div>
      ) : null}

      {pressError ? (
        <Notice tone="danger" role="alert">
          {pressError}
        </Notice>
      ) : null}

      {pluginNotice ? (
        <Notice tone={pluginNotice.tone} role="status">
          <p>{pluginNotice.text}</p>
          {pluginNotice.href ? (
            <a
              href={pluginNotice.href}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-flex items-center gap-1 rounded-sm font-medium text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {t.viewOnSite}
              <ExternalLink className="size-3.5" aria-hidden="true" />
            </a>
          ) : null}
        </Notice>
      ) : null}
    </WorkspaceSection>
  );
}
