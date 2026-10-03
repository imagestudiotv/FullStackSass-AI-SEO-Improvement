"use client";

import { Loader2, MessageSquareText, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/states";
import { Notice } from "@/components/workspace/notice";
import { WorkspaceSection } from "@/components/workspace/section";
import { addGeoPrompt, removeGeoPrompt, runGeoCheck, suggestGeoPrompts } from "@/lib/geo/actions";
import type { GeoOverview, GeoPromptView } from "@/lib/geo/shared";
import type { Locale } from "@/lib/i18n/config";
import { format, formatNumber, plural } from "@/lib/i18n/format";
import type { Messages } from "@/lib/i18n/messages";

import { CheckStatus } from "./ai-visibility/check-status";
import { MethodSection } from "./ai-visibility/method-section";
import { PerformanceSection } from "./ai-visibility/performance-section";
import { AddQuestionForm, NEW_QUESTION_INPUT_ID, SuggestionPicker } from "./ai-visibility/question-editor";
import { QuestionList } from "./ai-visibility/question-list";
import {
  checkProgress,
  followNewRequest,
  isAllowanceError,
  isWaiting,
  localiseGeoError,
  MIN_QUESTION_LENGTH,
  nextStep,
  normaliseQuestion,
  trackingFromPress,
  trackingFromRequest,
  type QuestionFilter,
  type Tracking,
  type VisibilityDetails,
} from "./ai-visibility/visibility-state";

/** Suggestions asked for per press - the action's own default. */
const SUGGEST_BATCH = 6;

/** How often the page re-reads while a check is answering (unchanged). */
const POLL_MS = 5000;

const BLOCKED_NOTICE_ID = "geo-blocked-reason";

/**
 * Visibility inside AI assistants.
 *
 * The product question this answers: when someone asks an assistant for a
 * business like this one, does this business get named? The page leads with
 * what was measured and how the website is doing, then the questions behind
 * it with the evidence for each answer, and always says what can be done next.
 *
 * Nothing here is inferred. A question that has not been checked says so
 * rather than showing a zero, a check that is still answering says how many
 * questions it has answered (never "done" because one answer arrived), and a
 * check that gave nothing back says that too.
 *
 * Paid work starts only from a button: Check now (runGeoCheck) and Suggest
 * (suggestGeoPrompts), both behind the server's editor, plan, quota and spend
 * guards. Opening the page, the refreshes while a check runs, expanding the
 * evidence and filtering the list only read.
 */
export function GeoPanel({
  websiteId,
  overview,
  details,
  allowance,
  canEdit,
  blockedReason,
  initialFilter,
  locale,
  t,
  tCommon,
  tw,
}: {
  websiteId: string;
  overview: GeoOverview;
  /** Evidence, history, run dates and the latest requested check (ai-visibility/details.ts). */
  details: VisibilityDetails;
  /** Questions this website's plan may track (lib/geo/allowance.ts). */
  allowance: number;
  /** Owner or editor. Viewers get the same page without the controls the server would refuse. */
  canEdit: boolean;
  /** Why checks and suggestions would be refused (no live plan, AI unavailable), translated; null when they are allowed. */
  blockedReason: string | null;
  initialFilter: QuestionFilter;
  locale: Locale;
  /** This screen's copy, already in the reader's language. */
  t: Messages["app"]["geo"];
  /** Shared words used on several screens. */
  tCommon: Messages["app"]["common"];
  tw: Messages["app"]["workspace"];
}) {
  const router = useRouter();
  const localise = (error: string) => localiseGeoError(error, t, tw);

  /**
   * The check being followed (lib/geo/progress.ts baseline).
   *
   * runGeoCheck only QUEUES the job - each question is two model calls, so
   * answers land one by one over the following minutes. The page refreshes
   * until every question in the check has a NEWER answer, and gives up after
   * CHECK_WAIT_LIMIT_MS. Restored from the server's record of the request on
   * arrival, so a reload or a second tab no longer forgets a running check.
   */
  const [tracking, setTracking] = useState<Tracking | null>(() =>
    trackingFromRequest(details.request, overview.prompts, details.questions),
  );
  const [timedOut, setTimedOut] = useState(false);
  const [dismissedRequestId, setDismissedRequestId] = useState<string | null>(null);
  const [refusal, setRefusal] = useState<string | null>(null);
  const [running, startRun] = useTransition();

  const [draft, setDraft] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [adding, startAdd] = useTransition();
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set());
  const [suggesting, setSuggesting] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<GeoPromptView | null>(null);
  const [removing, startRemove] = useTransition();
  const removedRef = useRef(false);
  /*
    The trash button that opened the Remove dialog. The dialog is opened from
    code, not a DialogTrigger, so Radix has no trigger to return focus to and
    would drop it on the page body after Cancel or Escape.
  */
  const removeOpener = useRef<HTMLElement | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [filter, setFilter] = useState<QuestionFilter>(initialFilter);

  /*
    A newer check request seen in fresh server data (the arrival refresh, a
    poll, or the refresh after an add) - pressed in another tab or by a
    colleague - is followed too, unless a check is already being followed.
    Adjusted during render from the previous request id, React's pattern for
    state that follows a prop; no effect, no extra request.
  */
  const visibleRequestId = details.request?.id ?? null;
  const [seenRequestId, setSeenRequestId] = useState(visibleRequestId);
  if (visibleRequestId !== seenRequestId) {
    setSeenRequestId(visibleRequestId);
    const followed = followNewRequest({
      tracking,
      timedOut,
      request: details.request,
      prompts: overview.prompts,
      questions: details.questions,
    });
    if (followed) {
      setTracking(followed);
      setTimedOut(false);
    }
  }

  const progress = checkProgress({
    tracking,
    timedOut,
    prompts: overview.prompts,
    request: details.request,
    lastCheckedAt: overview.lastCheckedAt,
  });
  /** Derived, not stored: the data alone answers "are we still waiting". */
  const awaitingResults = isWaiting(progress.phase);
  const statusHidden =
    !isWaiting(progress.phase) && progress.request !== null && progress.request.id === dismissedRequestId;

  useEffect(() => {
    if (!awaitingResults) return;
    const timer = setInterval(() => router.refresh(), POLL_MS);
    return () => clearInterval(timer);
  }, [awaitingResults, router]);

  /*
    A question whose check failed never gets a newer answer; stop refreshing
    after a while rather than spinning until the customer leaves.
  */
  useEffect(() => {
    if (tracking === null) return;
    const limit = setTimeout(() => setTimedOut(true), Math.max(0, tracking.waitMs));
    return () => clearTimeout(limit);
  }, [tracking]);

  /**
   * Re-read on arrival. Next's client Router Cache would otherwise serve the
   * copy rendered before a check finished, showing "Not checked" on questions
   * that have since been answered.
   */
  useEffect(() => {
    router.refresh();
  }, [router]);

  const tracked = overview.prompts.length;
  const room = Math.max(0, allowance - tracked);
  const atAllowance = room === 0;
  const mutating = adding || removing;

  function handleRun() {
    setRefusal(null);
    startRun(async () => {
      try {
        const result = await runGeoCheck(websiteId);
        if (!result.ok) {
          setRefusal(localise(result.error));
          return;
        }
        // Queued, not finished: the baseline is the data from BEFORE the press.
        setTimedOut(false);
        setTracking(trackingFromPress(overview.prompts, details.request));
      } catch {
        setRefusal(t.errUnexpected);
      }
    });
  }

  function dismissStatus() {
    setDismissedRequestId(progress.request?.id ?? details.request?.id ?? null);
    setTracking(null);
    setTimedOut(false);
  }

  function chooseFilter(next: QuestionFilter) {
    setFilter(next);
    // In the URL so a link opens the same view; no server round trip.
    const params = new URLSearchParams(window.location.search);
    if (next === "all") params.delete("show");
    else params.set("show", next);
    const query = params.toString();
    window.history.replaceState(null, "", query ? `?${query}` : window.location.pathname);
  }

  function showNotNamed() {
    chooseFilter("not-named");
    listRef.current?.focus();
  }

  function focusNewQuestion() {
    document.getElementById(NEW_QUESTION_INPUT_ID)?.focus();
  }

  const trackedQuestions = new Set(overview.prompts.map((p) => normaliseQuestion(p.prompt)));

  function handleAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const question = normaliseQuestion(draft);
    if (question.length < MIN_QUESTION_LENGTH) {
      setAddError(t.errTooShort);
      return;
    }
    if (trackedQuestions.has(question)) {
      setAddError(t.errDuplicate);
      return;
    }
    setAddError(null);
    startAdd(async () => {
      try {
        const result = await addGeoPrompt(websiteId, question);
        if (!result.ok) {
          setAddError(localise(result.error));
          return;
        }
        setDraft("");
        setSuggestions((prev) => prev.filter((s) => s !== question));
        toast.success(t.questionAdded);
        router.refresh();
      } catch {
        setAddError(t.errUnexpected);
      }
    });
  }

  async function handleSuggest() {
    if (room === 0) return;
    setSuggesting(true);
    try {
      const existing = overview.prompts.map((p) => p.prompt);
      // Told what is tracked and how much room is left, as onboarding does,
      // so a paid call does not come back with questions that cannot be kept.
      const result = await suggestGeoPrompts(websiteId, Math.min(SUGGEST_BATCH, room), existing);
      if (!result.ok) {
        toast.error(localise(result.error));
        return;
      }
      const fresh = [...new Set(result.data.map(normaliseQuestion))].filter((s) => !trackedQuestions.has(s));
      if (fresh.length === 0) {
        toast.info(t.alreadyTracking);
        return;
      }
      setSuggestions(fresh);
      setSelected(new Set(fresh.slice(0, room)));
    } catch {
      toast.error(t.errUnexpected);
    } finally {
      setSuggesting(false);
    }
  }

  function toggleSuggestion(suggestion: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(suggestion)) next.delete(suggestion);
      else next.add(suggestion);
      return next;
    });
  }

  function handleAddSelected() {
    const chosen = suggestions.filter((s) => selected.has(s));
    startAdd(async () => {
      const added: string[] = [];
      let failure: string | null = null;
      // One at a time: the allowance is checked per insert on the server.
      for (const question of chosen) {
        try {
          const result = await addGeoPrompt(websiteId, question);
          if (result.ok) {
            added.push(question);
            continue;
          }
          failure = localise(result.error);
          if (isAllowanceError(result.error)) break;
        } catch {
          failure = t.errUnexpected;
          break;
        }
      }
      if (added.length > 0) {
        setSuggestions((prev) => prev.filter((s) => !added.includes(s)));
        setSelected((prev) => new Set([...prev].filter((s) => !added.includes(s))));
        toast.success(plural(t.questionsAdded, added.length));
        router.refresh();
      }
      if (failure) toast.error(failure);
    });
  }

  function confirmRemove() {
    const target = removeTarget;
    if (!target) return;
    startRemove(async () => {
      try {
        const result = await removeGeoPrompt(websiteId, target.id);
        if (!result.ok) {
          toast.error(localise(result.error));
          return;
        }
        removedRef.current = true;
        setRemoveTarget(null);
        toast.success(t.questionRemoved);
        router.refresh();
      } catch {
        toast.error(t.errUnexpected);
      }
    });
  }

  /**
   * Where focus lands when the Remove dialog closes: back on the trash button
   * after Cancel or Escape, and on the list after a removal, since that row
   * and its button are gone. Always handled here - Radix's own fallback
   * focuses a trigger this dialog does not have.
   */
  function restoreRemoveFocus() {
    const removed = removedRef.current;
    removedRef.current = false;
    if (removed) listRef.current?.focus();
    else removeOpener.current?.focus();
    removeOpener.current = null;
  }

  const step = nextStep({
    canEdit,
    blocked: blockedReason !== null,
    phase: progress.phase,
    prompts: overview.prompts,
    latestRunStartedAt: details.latestRunStartedAt,
  });

  const runDisabled = running || awaitingResults || blockedReason !== null;
  const runButton =
    canEdit && tracked > 0 ? (
      <Button
        onClick={handleRun}
        disabled={runDisabled}
        aria-describedby={blockedReason ? BLOCKED_NOTICE_ID : undefined}
      >
        {running || awaitingResults ? (
          <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
        ) : (
          <Sparkles aria-hidden="true" />
        )}
        {/*
          The queue returns in milliseconds; the answers take minutes.
          Saying "Checking" for that whole window is the honest label.
        */}
        {awaitingResults ? t.checking : t.checkNow}
      </Button>
    ) : null;

  return (
    <>
      <PageHeader title={t.aiVisibility} description={t.aiVisibilityHelp} actions={runButton} />

      {!canEdit ? <Notice tone="info">{tw.viewOnly}</Notice> : null}
      {canEdit && blockedReason ? (
        <div id={BLOCKED_NOTICE_ID}>
          <Notice tone="warning" title={t.checksUnavailableTitle}>
            {blockedReason}
          </Notice>
        </div>
      ) : null}

      <CheckStatus
        progress={progress}
        hidden={statusHidden}
        refusal={refusal}
        onDismiss={dismissStatus}
        onDismissRefusal={() => setRefusal(null)}
        canEdit={canEdit}
        locale={locale}
        t={t}
      />

      <PerformanceSection
        overview={overview}
        latestRunStartedAt={details.latestRunStartedAt}
        previousRunAt={details.previousRunAt}
        step={step}
        blockedReason={blockedReason}
        runButton={runButton}
        onAddQuestions={focusNewQuestion}
        onShowNotNamed={showNotNamed}
        locale={locale}
        t={t}
        namedInsteadTitle={tCommon.namedInstead}
      />

      <WorkspaceSection
        id="questions"
        icon={MessageSquareText}
        title={t.questionsTitle}
        description={t.questionsHelp}
        actions={
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium tabular-nums">
            {format(t.allowanceCount, { count: formatNumber(tracked, locale), max: formatNumber(allowance, locale) })}
          </span>
        }
      >
        <div className="space-y-5">
          {canEdit ? (
            <AddQuestionForm
              draft={draft}
              onDraft={(value) => {
                setDraft(value);
                if (addError) setAddError(null);
              }}
              error={addError}
              onSubmit={handleAdd}
              adding={adding}
              suggesting={suggesting}
              onSuggest={handleSuggest}
              allowance={allowance}
              atAllowance={atAllowance}
              suggestBlocked={blockedReason !== null}
              blockedReasonId={blockedReason ? BLOCKED_NOTICE_ID : undefined}
              t={t}
              tw={tw}
            />
          ) : null}

          {canEdit && suggestions.length > 0 ? (
            <SuggestionPicker
              suggestions={suggestions}
              selected={selected}
              onToggle={toggleSuggestion}
              onAddSelected={handleAddSelected}
              onDismiss={() => {
                setSuggestions([]);
                setSelected(new Set());
              }}
              room={room}
              adding={adding}
              t={t}
            />
          ) : null}

          {tracked === 0 ? (
            <EmptyState
              icon={MessageSquareText}
              title={t.noQuestions}
              description={canEdit ? t.noQuestionsHelp : t.noQuestionsViewer}
              /*
                The action belongs here, not only in the row above the list:
                this is where a customer sent by the launch checklist
                ("Generate prompts & start AI tracking") is looking.
              */
              action={
                canEdit ? (
                  <Button
                    variant="outline"
                    onClick={handleSuggest}
                    disabled={suggesting || adding || blockedReason !== null}
                    aria-describedby={blockedReason ? BLOCKED_NOTICE_ID : undefined}
                  >
                    {suggesting ? (
                      <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
                    ) : (
                      <Sparkles aria-hidden="true" />
                    )}
                    {t.suggest}
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <QuestionList
              prompts={overview.prompts}
              questions={details.questions}
              progress={progress}
              latestRunStartedAt={details.latestRunStartedAt}
              filter={filter}
              onFilter={chooseFilter}
              canEdit={canEdit}
              disabled={mutating}
              removingId={removing ? (removeTarget?.id ?? null) : null}
              onRemove={(prompt) => {
                removeOpener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
                setRemoveTarget(prompt);
              }}
              listRef={listRef}
              locale={locale}
              t={t}
            />
          )}
        </div>
      </WorkspaceSection>

      <MethodSection assistants={details.assistants} t={t} />

      <Dialog
        open={removeTarget !== null}
        onOpenChange={(open) => {
          if (!open && !removing) setRemoveTarget(null);
        }}
      >
        <DialogContent
          closeLabel={tw.close}
          className="motion-reduce:data-closed:animate-none motion-reduce:data-open:animate-none"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            restoreRemoveFocus();
          }}
        >
          <DialogHeader>
            <DialogTitle>{t.removeTitle}</DialogTitle>
            <DialogDescription>{t.removeBody}</DialogDescription>
          </DialogHeader>
          {removeTarget ? (
            <p className="rounded-lg border bg-muted/30 px-3 py-2 text-sm break-words">{removeTarget.prompt}</p>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoveTarget(null)} disabled={removing}>
              {tCommon.cancel}
            </Button>
            <Button variant="destructive" onClick={confirmRemove} disabled={removing}>
              {removing ? <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : null}
              {removing ? t.removing : t.removeConfirm}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
