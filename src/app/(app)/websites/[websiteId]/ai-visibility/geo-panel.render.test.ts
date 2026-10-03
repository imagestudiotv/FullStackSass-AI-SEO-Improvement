import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { GeoOverview, GeoPromptView } from "@/lib/geo/shared";
import type { Locale } from "@/lib/i18n/config";
import { getMessages } from "@/lib/i18n/messages";

/**
 * The AI Visibility page's first render in each state a customer can arrive
 * in: by role, before and after anything was measured, while a check is
 * running, after one that never ran, with stale answers, and in another
 * language. Rendered to static markup, so it is exactly what the server sends
 * - and rendering must never call an action (no paid work on view).
 */

const router = vi.hoisted(() => ({ refresh: vi.fn(), replace: vi.fn(), push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
const actions = vi.hoisted(() => ({
  addGeoPrompt: vi.fn(),
  removeGeoPrompt: vi.fn(),
  runGeoCheck: vi.fn(),
  suggestGeoPrompts: vi.fn(),
}));
vi.mock("@/lib/geo/actions", () => actions);

import { GeoPanel } from "../geo-panel";
import { formatWhen } from "./format-when";
import type { CheckRequest, QuestionDetails, VisibilityDetails } from "./visibility-state";

const T0 = new Date("2026-10-03T10:00:00Z").getTime();
const at = (minutes: number) => new Date(T0 + minutes * 60_000);
const WEEK = 60 * 24 * 7;

const question = (id: string, latest: GeoPromptView["latest"]): GeoPromptView => ({
  id,
  prompt: `Which dentist near Utrecht ${id}?`,
  isSuggested: false,
  active: true,
  latest,
});
const namedAt = (when: Date, position = 2) => ({ mentioned: true, position, excerpt: "Smile Studio is a favourite.", checkedAt: when });
const missedAt = (when: Date) => ({ mentioned: false, position: null, excerpt: null, checkedAt: when });

function overviewOf(prompts: GeoPromptView[], over: Partial<GeoOverview> = {}): GeoOverview {
  const checked = prompts.filter((p) => p.latest);
  return {
    score: 54,
    mentions: checked.filter((p) => p.latest!.mentioned).length,
    total: checked.length,
    averagePosition: checked.some((p) => p.latest!.mentioned) ? 2 : null,
    topCompetitors: checked.length ? [{ name: "Bright Smile", count: 2 }] : [],
    prompts,
    lastCheckedAt: checked.length ? checked.map((p) => p.latest!.checkedAt).sort((a, b) => +b - +a)[0] : null,
    previousScore: null,
    ...over,
  };
}

function detailsOf(prompts: GeoPromptView[], over: Partial<VisibilityDetails> = {}): VisibilityDetails {
  const questions: Record<string, QuestionDetails> = {};
  for (const p of prompts) {
    questions[p.id] = {
      createdAt: at(-WEEK * 8),
      latest: p.latest
        ? { ...p.latest, assistant: "Claude", cited: p.id === "a", competitors: ["Bright Smile", "Tandarts Centrum"] }
        : null,
      earlier: [],
    };
  }
  const times = prompts.filter((p) => p.latest).map((p) => +p.latest!.checkedAt);
  return {
    questions,
    latestRunStartedAt: times.length ? new Date(Math.min(...times)) : null,
    previousRunAt: null,
    request: null,
    assistants: times.length ? ["Claude"] : [],
    ...over,
  };
}

function render({
  prompts,
  overview = {},
  details = {},
  canEdit = true,
  blockedReason = null,
  allowance = 20,
  filter = "all",
  locale = "en",
}: {
  prompts: GeoPromptView[];
  overview?: Partial<GeoOverview>;
  details?: Partial<VisibilityDetails>;
  canEdit?: boolean;
  blockedReason?: string | null;
  allowance?: number;
  filter?: "all" | "named" | "not-named" | "not-checked";
  locale?: Locale;
}) {
  const t = getMessages(locale).app;
  return renderToStaticMarkup(
    createElement(GeoPanel, {
      websiteId: "w1",
      overview: overviewOf(prompts, overview),
      details: detailsOf(prompts, details),
      allowance,
      canEdit,
      blockedReason,
      initialFilter: filter,
      locale,
      t: t.geo,
      tCommon: t.common,
      tw: t.workspace,
    }),
  );
}

const t = getMessages("en").app.geo;
const unescape = (html: string) => html.replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&");

beforeEach(() => {
  for (const action of Object.values(actions)) action.mockReset();
});

describe("roles", () => {
  const prompts = [question("a", namedAt(at(0))), question("b", missedAt(at(1)))];

  it("gives a viewer the results and evidence without any control the server would refuse", () => {
    const html = unescape(render({ prompts, canEdit: false }));
    expect(html).toContain(getMessages("en").app.workspace.viewOnly);
    expect(html).not.toMatch(/<button[^>]*>(?:(?!<\/button>).)*Check now/);
    expect(html).not.toContain(t.addQuestionLabel);
    expect(html).not.toContain("Stop tracking:");
    expect(html).toContain(t.showEvidence);
    expect(html).toContain(t.nextViewer);
  });

  it("gives an editor Check now, the add form, Suggest and a remove control per question", () => {
    const html = unescape(render({ prompts }));
    expect(html).toContain(t.checkNow);
    expect(html).toContain(t.addQuestionLabel);
    expect(html).toContain(t.suggest);
    expect(html).toContain(`Stop tracking: ${prompts[0].prompt}`);
  });

  it("says why checks are unavailable and disables the paid buttons when the site has no live plan", () => {
    const html = unescape(render({ prompts, blockedReason: t.errNoPlan }));
    expect(html).toContain(t.checksUnavailableTitle);
    expect(html).toContain(t.errNoPlan);
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*aria-describedby="geo-blocked-reason"[^>]*>.*?Check now/);
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>(?:(?!<\/button>).)*Suggest<\/button>/);
    // The disabled Suggest beside the add field is described by the reason, too.
    expect(html).toMatch(/<button[^>]*aria-describedby="geo-blocked-reason"[^>]*>(?:(?!<\/button>).)*Suggest<\/button>/);
  });
});

describe("before anything is measured", () => {
  it("shows no score, no zero, and offers the first check", () => {
    const html = unescape(render({ prompts: [question("a", null), question("b", null)] }));
    expect(html).toContain(t.notCheckedYetTitle);
    expect(html).not.toContain(t.scoreOutOf);
    expect(html).toContain(t.nextFirstCheck);
    expect(html).toContain(t.notChecked);
  });

  it("offers suggestions in the empty list, and nothing to a viewer", () => {
    const editor = unescape(render({ prompts: [] }));
    expect(editor).toContain(t.noQuestions);
    expect(editor).toContain(t.nextAddQuestions);
    const viewer = unescape(render({ prompts: [], canEdit: false }));
    expect(viewer).toContain(t.noQuestionsViewer);
    expect(viewer).not.toContain(`>${t.suggest}<`);
  });
});

describe("measured results", () => {
  const prompts = [question("a", namedAt(at(0), 1)), question("b", missedAt(at(2))), question("c", null)];

  it("shows the existing figures with their comparison and the evidence behind each answer", () => {
    const html = unescape(
      render({ prompts, overview: { previousScore: 48 }, details: { previousRunAt: at(-WEEK) } }),
    );
    expect(html).toContain(">54<");
    expect(html).toContain(t.scoreFair);
    expect(html).toContain("Up 6 since the previous check");
    expect(html).toContain(`Previous check: ${formatWhen(at(-WEEK), "en")}`);
    expect(html).toContain("1 of 2");
    expect(html).toContain("Based on the latest answer to 2 of 3 tracked questions.");
    expect(html).toContain("Bright Smile");
    expect(html).toContain("Named in 2 of 2 answers");
    expect(html).toContain("Named #1");
    expect(html).toContain(t.siteMentioned);
    expect(html).toContain("1 question has not been checked yet.");
  });

  it("marks an answer carried over from an earlier check as stale, and says so in the next step", () => {
    const stale = [question("a", namedAt(at(-2 * WEEK))), question("b", missedAt(at(0)))];
    const html = unescape(render({ prompts: stale, details: { latestRunStartedAt: at(0) } }));
    expect(html).toContain(`From an earlier check (${formatWhen(at(-2 * WEEK), "en")})`);
    expect(html).toContain("1 answer is from an earlier check.");
    expect(html).toContain("1 of these answers is from an earlier check.");
  });

  it("opens filtered from ?show= and marks the chosen filter as pressed", () => {
    const html = unescape(render({ prompts, filter: "not-named" }));
    expect(html).toContain('aria-pressed="true"');
    expect(html).toMatch(/aria-pressed="true"[^>]*>Not named/);
    expect(html).toContain(prompts[1].prompt);
    expect(html).not.toContain(`<p class="text-sm font-medium break-words text-foreground">${prompts[0].prompt}`);
  });

  it("shows the allowance and stops adding at it", () => {
    const html = unescape(render({ prompts, allowance: 3 }));
    expect(html).toContain("3 of 3 questions");
    expect(html).toContain("You are tracking as many questions as your plan allows (3).");
    // Add and Suggest are disabled, and point at the notice that says why.
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*aria-describedby="geo-allowance-reached"[^>]*>(?:(?!<\/button>).)*Add<\/button>/);
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*aria-describedby="geo-allowance-reached"[^>]*>(?:(?!<\/button>).)*Suggest<\/button>/);
    expect(html).toContain('id="geo-allowance-reached"');
  });
});

describe("a check in progress", () => {
  const request = (over: Partial<CheckRequest>): CheckRequest => ({
    id: "r1",
    requestedAt: at(0),
    elapsedMs: 90_000,
    state: "reserved",
    spendStarted: false,
    ...over,
  });

  it("is restored on arrival as queued when the job has not started", () => {
    const prompts = [question("a", missedAt(at(-WEEK))), question("b", null)];
    const html = unescape(render({ prompts, details: { request: request({}) } }));
    expect(html).toContain(t.statusQueuedTitle);
    expect(html).toContain('aria-valuenow="0"');
    expect(html).toContain(t.checking);
    expect(html).toContain(t.nextWaiting);
  });

  it("counts answers per question and keeps the rest waiting while it runs", () => {
    const prompts = [question("a", namedAt(at(1))), question("b", missedAt(at(-WEEK))), question("c", null)];
    const html = unescape(render({ prompts, details: { request: request({ state: "consumed", spendStarted: true }) } }));
    expect(html).toContain(t.statusRunningTitle);
    expect(html).toContain("1 of 3 questions answered");
    expect(html).toContain(t.answeredInCheck);
    expect(html.split(t.checkingNow).length - 1).toBe(2);
    expect(html).not.toContain(t.statusCompletedTitle);
  });

  it("reports a requested check that never ran", () => {
    const prompts = [question("a", missedAt(at(-WEEK)))];
    const html = unescape(render({ prompts, details: { request: request({ state: "released" }) } }));
    expect(html).toContain(t.statusFailedTitle);
    expect(html).toContain(`No answers were recorded for the check requested ${formatWhen(at(0), "en", true)}.`);
    expect(html).toContain("You can run another check.");
  });

  it("reports a check that never ran to a viewer without telling them to run another", () => {
    const prompts = [question("a", missedAt(at(-WEEK)))];
    const html = unescape(render({ prompts, canEdit: false, details: { request: request({ state: "released" }) } }));
    expect(html).toContain(t.statusFailedTitle);
    expect(html).toContain(`No answers were recorded for the check requested ${formatWhen(at(0), "en", true)}.`);
    expect(html).not.toContain("run another check");
  });
});

it("speaks the reader's language, dates included", () => {
  const prompts = [question("a", namedAt(at(0))), question("b", missedAt(at(1)))];
  const de = getMessages("de").app.geo;
  const html = unescape(render({ prompts, locale: "de" }));
  expect(html).toContain(de.performanceTitle);
  expect(html).toContain("Genannt auf Nr. 2");
  expect(html).toContain(formatWhen(at(0), "de"));
  expect(html).not.toContain("Named");
});

it("never calls an action while rendering", () => {
  render({ prompts: [question("a", null)] });
  render({ prompts: [question("a", namedAt(at(0)))], details: { request: { id: "r", requestedAt: at(0), elapsedMs: 1000, state: "reserved", spendStarted: false } } });
  for (const action of Object.values(actions)) expect(action).not.toHaveBeenCalled();
  expect(router.refresh).not.toHaveBeenCalled();
});
