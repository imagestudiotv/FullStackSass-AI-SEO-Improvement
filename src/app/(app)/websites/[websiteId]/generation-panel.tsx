"use client";

import { CalendarClock, Check, CheckCircle2, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRef, useState, useTransition, type KeyboardEvent } from "react";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Notice } from "@/components/workspace/notice";
import { WorkspaceSection } from "@/components/workspace/section";
import { format } from "@/lib/i18n/format";
import type { Messages } from "@/lib/i18n/messages";
import type { FinishedMode } from "@/lib/publishing/policy";
import { setFinishedMode, setGenerationMode } from "@/lib/websites/actions";
import { cn } from "@/lib/utils";

import { SaveModeTag, SectionIntro } from "./publishing/save-mode-tag";
import { nextDays, SECTION_IDS, WEEK } from "./publishing/settings-model";

type Status = { kind: "idle" } | { kind: "saved" } | { kind: "failed"; error: string };

/**
 * G. Writing and publishing: whether articles are written on a schedule, on
 * which days, and what happens to one once it is finished.
 *
 * EVERY CONTROL HERE SAVES THE MOMENT IT CHANGES - unchanged behaviour, and
 * NOT part of the page's Save button. The section says so in words (and the
 * save bar says it does not cover this section). The control moves at once
 * and is put back if the server refuses; the status beside the title says
 * "Saving…" until the server confirms and "Saved" only after it has.
 *
 * Choosing what happens to a finished article decides when articles reach
 * the customer's site, so in that group the arrow keys only MOVE between the
 * answers; Space or Enter chooses one. Browsing the options never publishes.
 */
export function GenerationPanel({
  websiteId,
  mode,
  days,
  finishedMode,
  hasIntegration,
  canEdit,
  firstArticleSent,
  inPartnerNetwork,
  t,
  tArticle,
  tWorkspace,
}: {
  websiteId: string;
  mode: "automatic" | "manual";
  /** Weekdays to write on, 0 = Sunday. Empty means every day. */
  days: number[];
  /** What happens to a finished article. See lib/publishing/policy.ts. */
  finishedMode: FinishedMode;
  /** A direct CMS connection or a WordPress plugin that has checked in. */
  hasIntegration: boolean;
  /** False for a viewer: controls are shown, not editable. */
  canEdit: boolean;
  /** The website's first article has been sent, so the first-article rule no longer applies. */
  firstArticleSent: boolean;
  /** Managed Partner Network review is on for this website. */
  inPartnerNetwork: boolean;
  t: Messages["app"]["common"];
  tArticle: Messages["app"]["article"];
  tWorkspace: Messages["app"]["workspace"];
}) {
  const [pending, startTransition] = useTransition();
  const [auto, setAuto] = useState(mode === "automatic");
  const [selectedDays, setSelectedDays] = useState<number[]>(days);
  const [finished, setFinished] = useState<FinishedMode>(finishedMode);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const finishedRefs = useRef<(HTMLButtonElement | null)[]>([]);

  /** Applies a change at once, saves it, and puts it back if the server refuses. */
  function persist(apply: () => void, revert: () => void, action: () => ReturnType<typeof setFinishedMode>) {
    if (!canEdit || pending) return;
    apply();
    setStatus({ kind: "idle" });
    startTransition(async () => {
      let result: Awaited<ReturnType<typeof setFinishedMode>>;
      try {
        result = await action();
      } catch {
        result = { ok: false, error: tArticle.saveError };
      }
      if (!result.ok) {
        revert();
        setStatus({ kind: "failed", error: result.error });
        return;
      }
      setStatus({ kind: "saved" });
    });
  }

  function saveMode(nextAuto: boolean, nextSelected: number[]) {
    const previousAuto = auto;
    const previousDays = selectedDays;
    persist(
      () => {
        setAuto(nextAuto);
        setSelectedDays(nextSelected);
      },
      () => {
        setAuto(previousAuto);
        setSelectedDays(previousDays);
      },
      () => setGenerationMode(websiteId, nextAuto ? "automatic" : "manual", nextSelected),
    );
  }

  function chooseFinished(next: FinishedMode) {
    if (next === finished) return;
    const previous = finished;
    persist(
      () => setFinished(next),
      () => setFinished(previous),
      () => setFinishedMode(websiteId, next),
    );
  }

  const FINISHED_OPTIONS: { value: FinishedMode; label: string; help: string }[] = [
    { value: "review", label: t.finishedReview, help: t.finishedReviewHelp },
    { value: "draft", label: t.finishedDraft, help: t.finishedDraftHelp },
    { value: "live", label: t.finishedLive, help: t.finishedLiveHelp },
  ];

  /** Moves focus only (see above); Space/Enter on a radio chooses it. */
  function onFinishedKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const last = FINISHED_OPTIONS.length - 1;
    let next: number | null = null;
    if (event.key === "ArrowDown" || event.key === "ArrowRight") next = index === last ? 0 : index + 1;
    else if (event.key === "ArrowUp" || event.key === "ArrowLeft") next = index === 0 ? last : index - 1;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = last;
    if (next === null) return;
    event.preventDefault();
    finishedRefs.current[next]?.focus();
  }

  const busy = pending || undefined;
  const firstNote = [firstArticleSent ? null : tArticle.firstArticleOnly, inPartnerNetwork ? tArticle.networkReview : null]
    .filter(Boolean)
    .join(" ");

  return (
    <WorkspaceSection
      id={SECTION_IDS.publishing}
      icon={CalendarClock}
      title={t.writingAndPublishing}
      description={
        <SectionIntro help={t.generationHelp}>
          {canEdit ? (
            <>
              <SaveModeTag mode="immediate" t={tWorkspace} />
              {/* Always in the page, so the change of words is announced. */}
              <span role="status" aria-live="polite" className="inline-flex min-h-5 items-center gap-1.5 text-xs">
                {pending ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin text-muted-foreground motion-reduce:animate-none" aria-hidden="true" />
                    <span className="text-muted-foreground">{tWorkspace.saving}</span>
                  </>
                ) : status.kind === "saved" ? (
                  <>
                    <CheckCircle2 className="size-3.5 text-emerald-700" aria-hidden="true" />
                    <span className="text-emerald-700">{tWorkspace.saved}</span>
                  </>
                ) : null}
              </span>
            </>
          ) : null}
        </SectionIntro>
      }
      bodyClassName="space-y-5"
    >
      {status.kind === "failed" ? (
        <Notice tone="danger" role="alert">
          {format(tWorkspace.saveFailed, { error: status.error })}
        </Notice>
      ) : null}

      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <p id="generation-mode-label" className="text-sm font-medium text-foreground">
            {t.writeAutomatically}
          </p>
          <p id="generation-mode-hint" className="text-xs leading-5 text-muted-foreground">
            {auto ? tArticle.autoOnHelp : tArticle.autoOffHelp}
          </p>
        </div>
        <Switch
          checked={auto}
          onCheckedChange={(next) => saveMode(next, selectedDays)}
          aria-labelledby="generation-mode-label"
          aria-describedby="generation-mode-hint"
          aria-disabled={busy}
          disabled={!canEdit}
          className="mt-0.5"
        />
      </div>

      {auto ? (
        <div className="space-y-2 rounded-lg border bg-muted/20 p-4">
          <p id="writing-days-label" className="text-sm font-medium text-foreground">
            {t.daysToWrite}
          </p>
          <p id="writing-days-hint" className="text-xs leading-5 text-muted-foreground">
            {selectedDays.length === 0 ? tArticle.anyDay : tArticle.pickedDays} {tArticle.daysUtc}
          </p>
          <div
            role="group"
            aria-labelledby="writing-days-label"
            aria-describedby="writing-days-hint"
            className="flex flex-wrap gap-1.5 pt-1"
          >
            {WEEK.map((day) => {
              const on = selectedDays.length === 0 || selectedDays.includes(day.value);
              return (
                <Button
                  key={day.value}
                  type="button"
                  variant={on ? "default" : "outline"}
                  size="sm"
                  aria-pressed={on}
                  aria-label={tArticle.weekdaysLong[day.key]}
                  aria-disabled={busy}
                  disabled={!canEdit}
                  onClick={() => saveMode(auto, nextDays(selectedDays, day.value))}
                  className="h-8 min-w-14 px-2.5"
                >
                  {on ? <Check aria-hidden="true" /> : null}
                  {tArticle.weekdaysShort[day.key]}
                </Button>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="space-y-3 border-t pt-5">
        <p id="when-finished" className="text-sm font-medium text-foreground">
          {t.whenFinished}
        </p>
        <div role="radiogroup" aria-labelledby="when-finished" className="grid gap-2">
          {FINISHED_OPTIONS.map((option, index) => {
            const selected = finished === option.value;
            return (
              <button
                key={option.value}
                ref={(node) => {
                  finishedRefs.current[index] = node;
                }}
                type="button"
                role="radio"
                aria-checked={selected}
                tabIndex={selected ? 0 : -1}
                aria-disabled={busy}
                disabled={!canEdit}
                onClick={() => chooseFinished(option.value)}
                onKeyDown={(event) => onFinishedKeyDown(event, index)}
                className={cn(
                  "flex items-start gap-3 rounded-lg border p-3 text-left transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none",
                  selected ? "border-primary bg-primary/5" : "hover:bg-muted/50",
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border",
                    selected ? "border-primary" : "border-input",
                  )}
                >
                  {selected ? <span className="size-2 rounded-full bg-primary" /> : null}
                </span>
                <span className="min-w-0 space-y-0.5">
                  <span className="block text-sm font-medium text-foreground">{option.label}</span>
                  <span className="block text-xs leading-5 text-muted-foreground">{option.help}</span>
                </span>
              </button>
            );
          })}
        </div>

        {/*
          Said here because it overrides the choice above: the client's rule is
          that the first article goes out whatever is picked - shown only
          while that is still ahead, and the Partner Network sentence only for
          a website in the managed network.
        */}
        {firstNote ? <Notice>{firstNote}</Notice> : null}

        {!hasIntegration ? (
          <Notice>
            <p>{t.connectWebsiteFirst}</p>
            <Link
              href={`/websites/${websiteId}/integrations`}
              className="mt-1 inline-flex rounded-sm font-medium text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {tArticle.openIntegrations}
            </Link>
          </Notice>
        ) : null}
      </div>
    </WorkspaceSection>
  );
}
