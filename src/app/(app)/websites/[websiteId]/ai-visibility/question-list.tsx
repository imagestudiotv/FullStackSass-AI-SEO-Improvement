"use client";

import { CheckCircle2, ChevronDown, Clock, Globe, Loader2, Trash2, XCircle } from "lucide-react";
import { useState, type ReactNode, type Ref } from "react";

import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import type { GeoPromptView } from "@/lib/geo/shared";
import type { Locale } from "@/lib/i18n/config";
import { format, formatNumber } from "@/lib/i18n/format";
import type { Messages } from "@/lib/i18n/messages";
import { cn } from "@/lib/utils";

import { formatWhen } from "./format-when";
import {
  evidenceFor,
  FILTERS,
  freshnessOf,
  matchesFilter,
  outcomeOf,
  type CheckProgress,
  type Freshness,
  type QuestionDetails,
  type QuestionFilter,
  type ResultSummary,
} from "./visibility-state";

type GeoText = Messages["app"]["geo"];

/**
 * The tracked questions, each with its latest result, how current that
 * result is, and - on request - the evidence stored for it.
 *
 * Two things are shown separately on every row because they answer different
 * questions: WHAT the latest answer said (named at #n / not named / never
 * checked) and HOW CURRENT it is (being checked now, answered in this check,
 * no answer in the last check, or carried over from an earlier check).
 * Merging them would turn a failed check into "not named", which is the
 * mistake the brief warns about.
 */
export function QuestionList({
  prompts,
  questions,
  progress,
  latestRunStartedAt,
  filter,
  onFilter,
  canEdit,
  disabled,
  removingId,
  onRemove,
  listRef,
  locale,
  t,
}: {
  prompts: GeoPromptView[];
  questions: Record<string, QuestionDetails>;
  progress: CheckProgress;
  latestRunStartedAt: Date | null;
  filter: QuestionFilter;
  onFilter: (filter: QuestionFilter) => void;
  canEdit: boolean;
  /** Another change is being saved. */
  disabled: boolean;
  removingId: string | null;
  onRemove: (prompt: GeoPromptView) => void;
  /** Focus lands here after a filter jump or a removal. */
  listRef?: Ref<HTMLDivElement>;
  locale: Locale;
  t: GeoText;
}) {
  const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set());
  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const label: Record<QuestionFilter, string> = {
    all: t.filterAll,
    named: t.named,
    "not-named": t.notNamed,
    "not-checked": t.notChecked,
  };
  const visible = prompts.filter((p) => matchesFilter(p, filter));

  return (
    <div className="space-y-3">
      <div role="group" aria-label={t.filterLabel} className="flex max-w-full overflow-x-auto rounded-lg border p-0.5 text-sm sm:w-fit">
        {FILTERS.map((f) => {
          const count = prompts.filter((p) => matchesFilter(p, f)).length;
          return (
            <button
              key={f}
              type="button"
              aria-pressed={filter === f}
              onClick={() => onFilter(f)}
              className={cn(
                "shrink-0 rounded-md px-3 py-1 whitespace-nowrap outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transition-none",
                filter === f ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {label[f]} <span className="text-xs tabular-nums">({formatNumber(count, locale)})</span>
            </button>
          );
        })}
      </div>

      <div ref={listRef} tabIndex={-1} className="rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
        {visible.length === 0 ? (
          <div className="rounded-lg border border-dashed px-6 py-8 text-center">
            <p className="text-sm text-muted-foreground">{t.filterEmpty}</p>
            <Button variant="link" className="mt-1" onClick={() => onFilter("all")}>
              {t.showAll}
            </Button>
          </div>
        ) : (
          <ul className="divide-y rounded-lg border">
            {visible.map((prompt) => (
              <QuestionRow
                key={prompt.id}
                prompt={prompt}
                details={questions[prompt.id]}
                freshness={freshnessOf(prompt, progress, latestRunStartedAt)}
                latestRunStartedAt={latestRunStartedAt}
                expanded={open.has(prompt.id)}
                onToggle={() => toggle(prompt.id)}
                canEdit={canEdit}
                disabled={disabled}
                removing={removingId === prompt.id}
                onRemove={() => onRemove(prompt)}
                locale={locale}
                t={t}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function outcomeText(result: ResultSummary | GeoPromptView["latest"], t: GeoText): string {
  if (!result) return t.notChecked;
  if (!result.mentioned) return t.notNamed;
  return result.position !== null ? format(t.namedAt, { position: result.position }) : t.named;
}

function QuestionRow({
  prompt,
  details,
  freshness,
  latestRunStartedAt,
  expanded,
  onToggle,
  canEdit,
  disabled,
  removing,
  onRemove,
  locale,
  t,
}: {
  prompt: GeoPromptView;
  details: QuestionDetails | undefined;
  freshness: Freshness;
  latestRunStartedAt: Date | null;
  expanded: boolean;
  onToggle: () => void;
  canEdit: boolean;
  disabled: boolean;
  removing: boolean;
  onRemove: () => void;
  locale: Locale;
  t: GeoText;
}) {
  const outcome = outcomeOf(prompt);
  const { evidence, earlier } = evidenceFor(prompt, details);
  const latest = prompt.latest;
  const panelId = `geo-evidence-${prompt.id}`;

  const badge =
    outcome === "named" ? (
      <StatusBadge status="completed" tone="positive" label={outcomeText(latest, t)} />
    ) : outcome === "notNamed" ? (
      <StatusBadge status="removed" tone="warning" label={t.notNamed} />
    ) : (
      <StatusBadge status="pending" tone="neutral" label={t.notChecked} />
    );

  let when: ReactNode = null;
  switch (freshness) {
    case "waiting":
      when = (
        <Meta className="text-primary">
          <Loader2 className="size-3.5 shrink-0 animate-spin motion-reduce:animate-none" aria-hidden="true" />
          {t.checkingNow}
        </Meta>
      );
      break;
    case "answered":
      when = (
        <Meta className="text-emerald-700 dark:text-emerald-400">
          <CheckCircle2 className="size-3.5 shrink-0" aria-hidden="true" />
          {t.answeredInCheck}
        </Meta>
      );
      break;
    case "missed":
      when = (
        <Meta className="text-red-700 dark:text-red-400">
          <XCircle className="size-3.5 shrink-0" aria-hidden="true" />
          {t.noAnswerInCheck}
        </Meta>
      );
      break;
    case "stale":
      when = latest ? (
        <Meta className="text-amber-700 dark:text-amber-400">
          <Clock className="size-3.5 shrink-0" aria-hidden="true" />
          {format(t.fromEarlierCheck, { date: formatWhen(latest.checkedAt, locale) })}
        </Meta>
      ) : null;
      break;
    case "current":
      when = latest ? <Meta className="text-muted-foreground">{format(t.checkedOn, { date: formatWhen(latest.checkedAt, locale) })}</Meta> : null;
      break;
  }

  return (
    <li className="p-4">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-sm font-medium break-words text-foreground">{prompt.prompt}</p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            {badge}
            {when}
            {evidence?.cited ? (
              <Meta className="text-muted-foreground">
                <Globe className="size-3.5 shrink-0" aria-hidden="true" />
                {t.siteMentioned}
              </Meta>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {latest ? (
            <Button variant="ghost" size="sm" aria-expanded={expanded}
              aria-controls={expanded ? panelId : undefined}
              onClick={onToggle}
            >
              <span className="sr-only sm:not-sr-only">{expanded ? t.hideEvidence : t.showEvidence}</span>
              <ChevronDown
                className={cn("transition-transform motion-reduce:transition-none", expanded && "rotate-180")}
                aria-hidden="true"
              />
            </Button>
          ) : null}
          {canEdit ? (
            <Button
              variant="ghost"
              size="icon"
              onClick={onRemove}
              disabled={disabled}
              aria-label={format(t.removeQuestionLabel, { question: prompt.prompt })}
            >
              {removing ? (
                <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
              ) : (
                <Trash2 aria-hidden="true" />
              )}
            </Button>
          ) : null}
        </div>
      </div>

      {latest && expanded ? (
        <div id={panelId} className="mt-3 space-y-4 rounded-lg border bg-muted/20 p-4 text-sm">
          {freshness === "stale" && latestRunStartedAt ? (
            <p className="text-xs leading-5 text-amber-800 dark:text-amber-300">
              {format(t.evidenceStale, { date: formatWhen(latestRunStartedAt, locale) })}
            </p>
          ) : freshness === "missed" ? (
            <p className="text-xs leading-5 text-red-800 dark:text-red-300">{t.evidenceMissed}</p>
          ) : null}
          <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
            {latest.excerpt ? (
              <div className="sm:col-span-2">
                <dt className="text-xs font-medium text-muted-foreground">{t.evidenceExcerpt}</dt>
                <dd className="mt-1">
                  <blockquote className="border-l-2 border-primary/40 pl-3 break-words italic">{latest.excerpt}</blockquote>
                </dd>
                <dd className="mt-1 text-xs text-muted-foreground">{t.evidenceExcerptNote}</dd>
              </div>
            ) : null}
            <Item label={t.evidencePosition}>
              {latest.mentioned
                ? latest.position !== null
                  ? format(t.evidencePositionValue, { position: latest.position })
                  : t.named
                : t.evidenceNotRecommended}
            </Item>
            {evidence ? (
              <Item label={t.evidenceWebsite}>{evidence.cited ? t.evidenceWebsiteYes : t.evidenceWebsiteNo}</Item>
            ) : null}
            {evidence ? (
              <Item label={t.evidenceOthers} wide>
                {evidence.competitors.length > 0 ? (
                  <ol className="list-decimal space-y-0.5 pl-5">
                    {evidence.competitors.map((name, index) => (
                      <li key={`${index}-${name}`} className="break-words">
                        {name}
                      </li>
                    ))}
                  </ol>
                ) : (
                  t.evidenceNoOthers
                )}
              </Item>
            ) : null}
            {evidence ? <Item label={t.evidenceAssistant}>{evidence.assistant}</Item> : null}
            <Item label={t.evidenceChecked}>
              <span className="tabular-nums">{formatWhen(latest.checkedAt, locale, true)}</span>
            </Item>
            <Item label={t.evidenceHistory} wide>
              {earlier.length > 0 ? (
                <ul className="space-y-1">
                  {earlier.map((result) => (
                    <li key={new Date(result.checkedAt).getTime()} className="flex flex-wrap gap-x-3">
                      <span className="text-muted-foreground tabular-nums">{formatWhen(result.checkedAt, locale)}</span>
                      <span>{outcomeText(result, t)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                t.evidenceNoHistory
              )}
            </Item>
          </dl>
        </div>
      ) : null}
    </li>
  );
}

function Meta({ className, children }: { className?: string; children: ReactNode }) {
  return <span className={cn("inline-flex items-center gap-1 text-xs", className)}>{children}</span>;
}

function Item({ label, wide, children }: { label: string; wide?: boolean; children: ReactNode }) {
  return (
    <div className={cn("min-w-0", wide && "sm:col-span-2")}>
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-1">{children}</dd>
    </div>
  );
}
