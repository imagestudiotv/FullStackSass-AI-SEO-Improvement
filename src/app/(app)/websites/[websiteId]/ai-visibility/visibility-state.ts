import {
  CHECK_WAIT_LIMIT_MS,
  checkBaseline,
  questionsStillChecking,
  type CheckBaseline,
} from "@/lib/geo/progress";
import type { GeoPromptView } from "@/lib/geo/shared";
import { format } from "@/lib/i18n/format";
import type { Messages } from "@/lib/i18n/messages";

/**
 * What the AI Visibility page derives from stored data, kept apart from the
 * markup so every state the brief names can be tested on its own: queued,
 * running, completed, partial, timed out and failed checks; and, per
 * question, not checked, not named, named, stale and "no answer in the last
 * check".
 *
 * Pure and client-safe. Nothing here reads the clock: elapsed time comes from
 * the server render, so the first client render matches the server's.
 */

type GeoText = Messages["app"]["geo"];
type WorkspaceText = Messages["app"]["workspace"];

/* ------------------------------------------------------------------------ */
/* Data the page loads besides getGeoOverview (see details.ts)               */
/* ------------------------------------------------------------------------ */

/** One stored answer, as much as the history list needs. */
export type ResultSummary = {
  checkedAt: Date;
  mentioned: boolean;
  position: number | null;
};

/** The newest stored answer to a question, with everything kept about it. */
export type ResultEvidence = ResultSummary & {
  /** The assistant's display name, from the stored engine id. */
  assistant: string;
  /** The answer mentioned the website's own domain. */
  cited: boolean;
  /** Other businesses the answer recommended, in its order. */
  competitors: string[];
  excerpt: string | null;
};

export type QuestionDetails = {
  createdAt: Date;
  /** Newest stored answer, or null when never checked. */
  latest: ResultEvidence | null;
  /** Older answers, newest first, bounded (details.ts HISTORY_PER_QUESTION). */
  earlier: ResultSummary[];
};

/**
 * The newest check somebody asked for on this website, read from its spend
 * reservation (lib/billing/spend-quota.ts): reserved until the job makes its
 * first paid call, consumed once it has, released when it was given up on
 * without spending - a check that never ran.
 */
export type CheckRequest = {
  id: string;
  requestedAt: Date;
  /** Milliseconds between the request and the server render. */
  elapsedMs: number;
  state: "reserved" | "consumed" | "released";
  /** The job has started asking (spend recorded as started). */
  spendStarted: boolean;
};

export type VisibilityDetails = {
  questions: Record<string, QuestionDetails>;
  /** Oldest answer of the newest run of answers; null before any answer. */
  latestRunStartedAt: Date | null;
  /** Newest answer of the run before it; null with only one run. */
  previousRunAt: Date | null;
  request: CheckRequest | null;
  /** Assistants that answered the stored results shown, by display name. */
  assistants: string[];
};

const ms = (value: Date | string): number => new Date(value).getTime();

/**
 * How far apart two answers may be and still belong to the same check.
 *
 * MUST EQUAL RUN_GAP_MS in lib/geo/actions.ts, which splits runs the same way
 * to compute previousScore; it is private to that "use server" file, so it
 * cannot be imported. The previous-check date shown beside previousScore is
 * found with this.
 */
export const RUN_GAP_MS = 60 * 60 * 1000;

/** Splits answer times (newest first) into the latest run and the one before. */
export function runBoundaries(timesNewestFirst: number[]): {
  latestStartedAt: number | null;
  previousAt: number | null;
} {
  if (timesNewestFirst.length === 0) return { latestStartedAt: null, previousAt: null };
  let i = 1;
  while (i < timesNewestFirst.length && timesNewestFirst[i - 1] - timesNewestFirst[i] <= RUN_GAP_MS) {
    i += 1;
  }
  return {
    latestStartedAt: timesNewestFirst[i - 1],
    previousAt: i < timesNewestFirst.length ? timesNewestFirst[i] : null,
  };
}

/* ------------------------------------------------------------------------ */
/* A check in progress                                                       */
/* ------------------------------------------------------------------------ */

/**
 * The check this page is following.
 *
 * The baseline is lib/geo/progress.ts's, unchanged: each question's latest
 * answer time when the check began, and a question is done only once it has
 * a NEWER answer - one answer arriving never completes the whole check.
 */
export type Tracking = {
  baseline: CheckBaseline;
  /** Restored from the server: the request being followed. */
  requestId: string | null;
  /** Pressed here: the newest request known before the press, to tell the new one apart. */
  previousRequestId: string | null;
  /** How long to keep waiting before giving up, from when tracking began. */
  waitMs: number;
};

/** Pressed "Check now" on this page: the baseline is taken from the pre-press data. */
export function trackingFromPress(prompts: GeoPromptView[], request: CheckRequest | null): Tracking {
  return {
    baseline: checkBaseline(prompts),
    requestId: null,
    previousRequestId: request?.id ?? null,
    waitMs: CHECK_WAIT_LIMIT_MS,
  };
}

/**
 * Arrived (or reloaded) while a check asked for in the last ten minutes may
 * still be answering - from this tab, another tab or a colleague. Without
 * this the page forgot a running check on every reload and offered "Check
 * now" again.
 *
 * Every question that existed when the check was requested waits for an
 * answer newer than the request. Questions added afterwards are ignored, as
 * the in-page baseline ignores them. Same ten-minute bound, counted from the
 * request.
 */
export function trackingFromRequest(
  request: CheckRequest | null,
  prompts: GeoPromptView[],
  questions: Record<string, QuestionDetails>,
): Tracking | null {
  if (!request || request.state === "released") return null;
  const waitMs = CHECK_WAIT_LIMIT_MS - request.elapsedMs;
  if (waitMs <= 0) return null;
  const at = ms(request.requestedAt);
  const baseline: CheckBaseline = new Map();
  for (const prompt of prompts) {
    if (!prompt.active) continue;
    const created = questions[prompt.id]?.createdAt;
    if (!created || ms(created) > at) continue;
    baseline.set(prompt.id, at);
  }
  if (baseline.size === 0) return null;
  return { baseline, requestId: request.id, previousRequestId: null, waitMs };
}

/**
 * A check request that became visible after the page was first rendered -
 * pressed in another tab or by a colleague, or missing from a cached copy of
 * the page that the arrival refresh replaced - is followed like one found on
 * arrival. Not while this page is still following a check that is answering:
 * a request appearing then is that check's own record (or a second press that
 * the same questions are already waiting on).
 *
 * Returns the tracking to switch to, or null to keep the current one.
 */
export function followNewRequest({
  tracking,
  timedOut,
  request,
  prompts,
  questions,
}: {
  tracking: Tracking | null;
  timedOut: boolean;
  request: CheckRequest | null;
  prompts: GeoPromptView[];
  questions: Record<string, QuestionDetails>;
}): Tracking | null {
  if (!request) return null;
  const answering = tracking !== null && !timedOut && questionsStillChecking(tracking.baseline, prompts) > 0;
  if (answering) return null;
  if (tracking !== null && (tracking.requestId === request.id || tracking.previousRequestId === request.id)) {
    return null;
  }
  return trackingFromRequest(request, prompts, questions);
}

/** The server's request record for the check being followed, once it is visible. */
export function trackedRequest(tracking: Tracking, request: CheckRequest | null): CheckRequest | null {
  if (!request) return null;
  if (tracking.requestId) return request.id === tracking.requestId ? request : null;
  return request.id !== tracking.previousRequestId ? request : null;
}

/** The same test as questionsStillChecking, for one question. */
function stillWaiting(before: number | null, prompt: GeoPromptView): boolean {
  const now = prompt.latest ? ms(prompt.latest.checkedAt) : null;
  return now === null || (before !== null && now <= before);
}

export type CheckPhase = "idle" | "queued" | "running" | "completed" | "partial" | "timedOut" | "failed";

export type CheckProgress = {
  phase: CheckPhase;
  /** Questions in the check that have a new answer. */
  answered: number;
  /** Questions in the check (removed ones no longer count). */
  expected: number;
  /** Questions still waiting (queued/running) or that got no answer (after it ended). */
  pending: Set<string>;
  /** Questions in the check that got a new answer. */
  done: Set<string>;
  /** The request record behind the phase, when known. */
  request: CheckRequest | null;
};

export function checkProgress({
  tracking,
  timedOut,
  prompts,
  request,
  lastCheckedAt,
}: {
  tracking: Tracking | null;
  timedOut: boolean;
  prompts: GeoPromptView[];
  request: CheckRequest | null;
  lastCheckedAt: Date | null;
}): CheckProgress {
  const empty = { answered: 0, expected: 0, pending: new Set<string>(), done: new Set<string>() };

  if (tracking === null) {
    /*
      A check that was given up on before it spent anything, with nothing
      answered since: say so, rather than leaving the customer to wonder why
      the results never changed.
    */
    if (
      request?.state === "released" &&
      !(lastCheckedAt && ms(lastCheckedAt) > ms(request.requestedAt))
    ) {
      return { phase: "failed", ...empty, request };
    }
    return { phase: "idle", ...empty, request: null };
  }

  const pending = new Set<string>();
  const done = new Set<string>();
  for (const prompt of prompts) {
    if (!tracking.baseline.has(prompt.id)) continue;
    if (stillWaiting(tracking.baseline.get(prompt.id) ?? null, prompt)) pending.add(prompt.id);
    else done.add(prompt.id);
  }
  // The shared counter stays the authority on "still waiting".
  const waiting = questionsStillChecking(tracking.baseline, prompts);
  const expected = pending.size + done.size;
  const answered = expected - waiting;
  const own = trackedRequest(tracking, request);
  const base = { answered, expected, pending, done, request: own };

  if (expected === 0) return { phase: "idle", ...base };
  if (waiting === 0) return { phase: "completed", ...base };
  if (own?.state === "released") return { phase: answered > 0 ? "partial" : "failed", ...base };
  if (timedOut) return { phase: answered > 0 ? "partial" : "timedOut", ...base };
  if (answered === 0 && !(own && (own.spendStarted || own.state === "consumed"))) {
    return { phase: "queued", ...base };
  }
  return { phase: "running", ...base };
}

export const isWaiting = (phase: CheckPhase) => phase === "queued" || phase === "running";

/* ------------------------------------------------------------------------ */
/* One question                                                              */
/* ------------------------------------------------------------------------ */

/** What the latest stored answer says. Never derived from a missing answer. */
export type Outcome = "named" | "notNamed" | "notChecked";

export function outcomeOf(prompt: GeoPromptView): Outcome {
  if (!prompt.latest) return "notChecked";
  return prompt.latest.mentioned ? "named" : "notNamed";
}

/**
 * How current that answer is.
 *
 * - waiting  in the check under way, no new answer yet
 * - answered got a new answer in the check being followed
 * - missed   in the check being followed, which ended without answering it
 * - stale    answered, but older than the newest run of answers
 * - current  answered in the newest run (or never answered: see Outcome)
 */
export type Freshness = "waiting" | "answered" | "missed" | "stale" | "current";

export function freshnessOf(
  prompt: GeoPromptView,
  progress: CheckProgress,
  latestRunStartedAt: Date | null,
): Freshness {
  if (progress.pending.has(prompt.id)) return isWaiting(progress.phase) ? "waiting" : "missed";
  if (progress.done.has(prompt.id)) return "answered";
  if (prompt.latest && latestRunStartedAt && ms(prompt.latest.checkedAt) < ms(latestRunStartedAt)) {
    return "stale";
  }
  return "current";
}

/** Answers older than the newest run, i.e. what the score carries over from earlier checks. */
export function staleCount(prompts: GeoPromptView[], latestRunStartedAt: Date | null): number {
  if (!latestRunStartedAt) return 0;
  const start = ms(latestRunStartedAt);
  return prompts.filter((p) => p.latest && ms(p.latest.checkedAt) < start).length;
}

/**
 * The stored evidence for a question's latest answer, lined up with the
 * overview's latest answer by time. The two are separate reads, so during a
 * check one may already hold an answer the other does not; full evidence is
 * shown only when they agree, and the history is everything older.
 */
export function evidenceFor(
  prompt: GeoPromptView,
  details: QuestionDetails | undefined,
): { evidence: ResultEvidence | null; earlier: ResultSummary[] } {
  if (!prompt.latest || !details) return { evidence: null, earlier: [] };
  const at = ms(prompt.latest.checkedAt);
  const all: ResultSummary[] = details.latest ? [details.latest, ...details.earlier] : details.earlier;
  const index = all.findIndex((r) => ms(r.checkedAt) === at);
  if (index === -1) return { evidence: null, earlier: all.filter((r) => ms(r.checkedAt) < at) };
  return {
    evidence: index === 0 && details.latest ? details.latest : null,
    earlier: all.slice(index + 1),
  };
}

/* ------------------------------------------------------------------------ */
/* The list filter (?show=)                                                  */
/* ------------------------------------------------------------------------ */

export const FILTERS = ["all", "named", "not-named", "not-checked"] as const;
export type QuestionFilter = (typeof FILTERS)[number];

export function parseFilter(value: unknown): QuestionFilter {
  const first = Array.isArray(value) ? value[0] : value;
  return FILTERS.includes(first as QuestionFilter) ? (first as QuestionFilter) : "all";
}

export function matchesFilter(prompt: GeoPromptView, filter: QuestionFilter): boolean {
  if (filter === "all") return true;
  const outcome = outcomeOf(prompt);
  if (filter === "named") return outcome === "named";
  if (filter === "not-named") return outcome === "notNamed";
  return outcome === "notChecked";
}

/* ------------------------------------------------------------------------ */
/* The next available action                                                 */
/* ------------------------------------------------------------------------ */

export type NextStep =
  | { kind: "viewer" }
  | { kind: "waiting" }
  | { kind: "addQuestions" }
  | { kind: "blocked" }
  | { kind: "firstCheck" }
  | { kind: "unchecked"; count: number }
  | { kind: "stale"; count: number }
  | { kind: "notNamed"; count: number }
  | { kind: "upToDate" };

export function nextStep({
  canEdit,
  blocked,
  phase,
  prompts,
  latestRunStartedAt,
}: {
  canEdit: boolean;
  blocked: boolean;
  phase: CheckPhase;
  prompts: GeoPromptView[];
  latestRunStartedAt: Date | null;
}): NextStep {
  if (!canEdit) return { kind: "viewer" };
  if (isWaiting(phase)) return { kind: "waiting" };
  if (prompts.length === 0) return { kind: "addQuestions" };
  if (blocked) return { kind: "blocked" };
  const unchecked = prompts.filter((p) => !p.latest).length;
  if (unchecked === prompts.length) return { kind: "firstCheck" };
  if (unchecked > 0) return { kind: "unchecked", count: unchecked };
  const stale = staleCount(prompts, latestRunStartedAt);
  if (stale > 0) return { kind: "stale", count: stale };
  const notNamed = prompts.filter((p) => outcomeOf(p) === "notNamed").length;
  if (notNamed > 0) return { kind: "notNamed", count: notNamed };
  return { kind: "upToDate" };
}

/* ------------------------------------------------------------------------ */
/* Words                                                                     */
/* ------------------------------------------------------------------------ */

/** The score's band, by the thresholds the panel has always coloured it with. */
export function scoreBand(score: number): "good" | "fair" | "low" {
  return score >= 60 ? "good" : score >= 30 ? "fair" : "low";
}

/** The same clean-up the server applies before storing (lib/geo/actions.ts cleanPrompt). */
export function normaliseQuestion(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

/** Shortest question the server stores. */
export const MIN_QUESTION_LENGTH = 5;

/** The allowance refusal from addGeoPrompt; adding more after it is pointless. */
export const isAllowanceError = (error: string) => /^Your plan tracks up to \d+ questions/.test(error);

/**
 * The geo actions' refusals in the reader's language.
 *
 * The server answers in English (lib/geo/actions.ts, require-editor.ts,
 * billing/entitled.ts) and other screens show those strings as they are, so
 * the server text stays; this maps each known one to its translation. An
 * unknown message is shown as written rather than replaced by a vaguer one.
 */
export function localiseGeoError(error: string, t: GeoText, tw: WorkspaceText): string {
  switch (error) {
    case "You have view-only access to this website.":
      return tw.viewOnly;
    case "AI is not configured on this deployment":
      return t.errAiUnavailable;
    case "Add a question first":
      return t.errAddFirst;
    case "Choose a plan for this website first":
      return t.errNoPlan;
    case "This website's subscription is not active. Update billing to continue.":
      return t.errPlanInactive;
    case "You have checked AI visibility several times in the last hour. Please try again shortly.":
      return t.errCheckQuota;
    case "You have asked for suggestions many times this hour. Please try again shortly.":
      return t.errSuggestQuota;
    case "Could not suggest questions. Try again.":
      return t.errSuggestFailed;
    case "Write a question of at least a few words":
      return t.errTooShort;
    case "You are already tracking that question":
      return t.errDuplicate;
  }
  const allowance = /^Your plan tracks up to (\d+) questions/.exec(error);
  if (allowance) return format(t.errAllowance, { count: allowance[1] });
  return error;
}
