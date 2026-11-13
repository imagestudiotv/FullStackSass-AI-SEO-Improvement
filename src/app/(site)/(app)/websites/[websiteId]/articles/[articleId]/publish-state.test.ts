import { describe, expect, it } from "vitest";

import { getMessages } from "@/lib/i18n/messages";

import {
  actionErrorText,
  generationFailureKind,
  generationFailureText,
  publishFailureKind,
  publishFailureText,
} from "./failure-copy";
import { awaitingResult, planPublishing, refreshNeed, type PublishFacts } from "./publish-state";

/**
 * What the Publishing panel offers, and why it waits: publishing sends the
 * saved version, holds the server would apply are not offered as if they
 * would work, and a press stays "queued" until a result is recorded.
 */

const FACTS: PublishFacts = {
  destination: { kind: "direct", name: "WordPress", provider: "wordpress", site: "Example" },
  review: "none",
  frozen: false,
  uncertain: false,
  delivering: false,
  liveOnSite: false,
  alreadySent: { publish: false, draft: false },
  lastOutcome: { kind: "none" },
  latestDispatchId: "d1",
  latestLogId: "l1",
  planned: null,
  plannedInFuture: false,
  autoPublish: "off",
};

const BASE = {
  canEdit: true,
  hasBody: true,
  working: false,
  dirty: false,
  awaiting: false,
  pressExpired: false,
  publishRequested: null,
  publishedUrl: null,
  facts: FACTS,
};

describe("planPublishing", () => {
  it("offers nothing to a viewer, or before the article is written", () => {
    expect(planPublishing({ ...BASE, canEdit: false })).toEqual({ mode: "hidden" });
    expect(planPublishing({ ...BASE, hasBody: false })).toEqual({ mode: "hidden" });
  });

  it("asks to connect when nothing can receive the article", () => {
    expect(planPublishing({ ...BASE, facts: { ...FACTS, destination: { kind: "none" } } })).toEqual({ mode: "connect" });
  });

  it("follows the WordPress plugin: waiting for it, or already created by it (which it cannot update)", () => {
    const plugin = { ...FACTS, destination: { kind: "plugin" as const } };
    expect(planPublishing({ ...BASE, facts: plugin, publishRequested: "draft" })).toEqual({ mode: "pluginWaiting", as: "draft" });
    expect(planPublishing({ ...BASE, facts: plugin, publishedUrl: "https://example.com/post" })).toEqual({ mode: "pluginPublished" });
    expect(planPublishing({ ...BASE, facts: plugin })).toMatchObject({ mode: "actions", blocked: null });
  });

  it("waits for a Save while there are unsaved edits: it never sends an older revision than the one on screen", () => {
    expect(planPublishing({ ...BASE, dirty: true })).toMatchObject({ mode: "actions", blocked: "unsaved" });
  });

  it("names the one reason that matters most when several apply", () => {
    const all = { ...BASE, dirty: true, awaiting: true };
    const facts = { ...FACTS, frozen: true, review: "pending" as const, delivering: true };
    expect(planPublishing({ ...all, working: true, facts })).toMatchObject({ blocked: "working" });
    expect(planPublishing({ ...all, facts })).toMatchObject({ blocked: "frozen" });
    expect(planPublishing({ ...all, facts: { ...facts, frozen: false } })).toMatchObject({ blocked: "review" });
    expect(planPublishing({ ...all, facts: { ...facts, frozen: false, review: "changed" } })).toMatchObject({ blocked: "review" });
    expect(planPublishing({ ...all, facts: { ...facts, frozen: false, review: "approved" } })).toMatchObject({ blocked: "delivering" });
    expect(planPublishing({ ...all, facts: FACTS })).toMatchObject({ blocked: "awaiting" });
  });

  it("holds both buttons for a press's result only while it is watched, never until a reload", () => {
    // Just pressed, nothing recorded yet: both buttons wait for the result.
    expect(planPublishing({ ...BASE, awaiting: true })).toMatchObject({ mode: "actions", blocked: "awaiting" });
    /*
      PRESS_WATCH_MS later still nothing: the job held it without a trace (an
      unresolved earlier send, a freeze since lifted, a job that never ran).
      The wait is information only from here, so Publish and Send as draft come
      back; the server's claim still refuses a duplicate post.
    */
    expect(planPublishing({ ...BASE, awaiting: true, pressExpired: true })).toMatchObject({ mode: "actions", blocked: null });
    // Every other reason still holds them after that.
    expect(planPublishing({ ...BASE, awaiting: true, pressExpired: true, dirty: true })).toMatchObject({ blocked: "unsaved" });
    expect(
      planPublishing({ ...BASE, awaiting: true, pressExpired: true, facts: { ...FACTS, frozen: true } }),
    ).toMatchObject({ blocked: "frozen" });
  });

  it("an approved article is not held", () => {
    expect(planPublishing({ ...BASE, facts: { ...FACTS, review: "approved" } })).toMatchObject({ blocked: null });
  });

  it("a live post is updated, and sending it back to draft asks first", () => {
    const live = planPublishing({ ...BASE, facts: { ...FACTS, liveOnSite: true } });
    expect(live).toMatchObject({ publishLabel: "update", confirmDraft: true });
    expect(planPublishing(BASE)).toMatchObject({ publishLabel: "publish", confirmDraft: false });
  });

  it("does not offer to send again the exact version already there with the same status", () => {
    const plan = planPublishing({ ...BASE, facts: { ...FACTS, alreadySent: { publish: true, draft: false } } });
    expect(plan).toMatchObject({ publishAlreadySent: true, draftAlreadySent: false });
  });
});

describe("a press's result", () => {
  const press = { status: "publish" as const, at: 0, dispatchId: "d1", logId: "l1" };

  it("is awaited until a newer dispatch or log is recorded", () => {
    expect(awaitingResult(press, FACTS)).toBe(true);
    expect(awaitingResult(press, { ...FACTS, latestDispatchId: "d2" })).toBe(false);
    expect(awaitingResult(press, { ...FACTS, latestLogId: "l2" })).toBe(false);
    expect(awaitingResult(press, { ...FACTS, delivering: true })).toBe(false);
    expect(awaitingResult(null, FACTS)).toBe(false);
  });

  it("is followed quickly while work is in flight, slowly for the plugin, and not at all once settled", () => {
    const idle = { working: false, delivering: false, watchingPress: false, pluginWaiting: false };
    expect(refreshNeed(idle)).toBeNull();
    expect(refreshNeed({ ...idle, working: true })).toBe("fast");
    expect(refreshNeed({ ...idle, delivering: true })).toBe("fast");
    expect(refreshNeed({ ...idle, watchingPress: true })).toBe("fast");
    expect(refreshNeed({ ...idle, pluginWaiting: true })).toBe("slow");
  });
});

describe("failure copy", () => {
  const t = getMessages("de").app.editor;
  const copy = { t, tWorkspace: getMessages("de").app.workspace, tImage: getMessages("de").app.image };

  it("classifies a stored writing failure without showing it", () => {
    expect(generationFailureKind("ANTHROPIC_API_KEY is not set")).toBe("unavailable");
    expect(generationFailureKind("429 rate limit")).toBe("busy");
    expect(generationFailureKind("Request timed out")).toBe("timeout");
    expect(generationFailureKind("model declined")).toBe("unusable");
    expect(generationFailureKind("something else")).toBe("generic");
    expect(generationFailureKind(null)).toBe("generic");
    expect(generationFailureText("unavailable", t)).toBe(t.genUnavailable);
    expect(generationFailureText("unavailable", t)).not.toContain("ANTHROPIC");
  });

  it("reads a publish failure's kind from its stored prefix, provider-neutral", () => {
    expect(publishFailureKind("auth: Request failed with status code 401")).toBe("auth");
    expect(publishFailureKind("api_disabled: rest disabled")).toBe("api_disabled");
    expect(publishFailureKind("bare message")).toBe("unknown");
    expect(publishFailureKind("nonsense: 1")).toBe("unknown");
    expect(publishFailureText("auth", getMessages("en").app.editor)).not.toMatch(/WordPress/);
  });

  it("translates refusals it knows and passes on the ones it does not", () => {
    expect(actionErrorText("You have view-only access to this website.", copy)).toBe(copy.tWorkspace.viewOnly);
    expect(
      actionErrorText(
        "This article is being prepared by the RepGet team for the Partner Network. It goes out as soon as they approve it.",
        copy,
      ),
    ).toBe(t.stateReviewPending);
    expect(actionErrorText("This website has rewritten 10 articles in the last day. Try again later.", copy)).toBe(t.errRewriteCap);
    expect(actionErrorText("Something new went wrong", copy)).toBe("Something new went wrong");
  });
});
