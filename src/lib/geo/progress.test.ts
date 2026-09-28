import { describe, expect, it } from "vitest";

import { checkBaseline, questionsStillChecking } from "@/lib/geo/progress";
import type { GeoPromptView } from "@/lib/geo/shared";

const q = (id: string, checkedAt: string | null, active = true): GeoPromptView => ({
  id,
  prompt: `question ${id}`,
  isSuggested: true,
  active,
  latest: checkedAt ? { mentioned: false, position: null, excerpt: null, checkedAt: new Date(checkedAt) } : null,
});

describe("AI visibility check progress", () => {
  it("first check: keeps waiting until EVERY question has an answer, not just the first", () => {
    const before = [q("a", null), q("b", null), q("c", null)];
    const baseline = checkBaseline(before);
    expect(questionsStillChecking(baseline, before)).toBe(3);
    // The first answer arrives - the old panel stopped refreshing here.
    const oneIn = [q("a", "2026-09-28T10:00:05Z"), q("b", null), q("c", null)];
    expect(questionsStillChecking(baseline, oneIn)).toBe(2);
    const allIn = [q("a", "2026-09-28T10:00:05Z"), q("b", "2026-09-28T10:00:20Z"), q("c", "2026-09-28T10:00:40Z")];
    expect(questionsStillChecking(baseline, allIn)).toBe(0);
  });

  it("re-check: an OLD answer does not count, so waiting ends only when new ones arrive", () => {
    const before = [q("a", "2026-09-20T10:00:00Z"), q("b", "2026-09-20T10:00:10Z")];
    const baseline = checkBaseline(before);
    // Nothing new yet - the old panel thought this was 'still waiting' for ever.
    expect(questionsStillChecking(baseline, before)).toBe(2);
    const done = [q("a", "2026-09-28T10:00:05Z"), q("b", "2026-09-28T10:00:15Z")];
    expect(questionsStillChecking(baseline, done)).toBe(0);
  });

  it("ignores questions added after the press, removed ones, and paused ones", () => {
    const before = [q("a", null), q("paused", null, false)];
    const baseline = checkBaseline(before);
    const after = [q("a", "2026-09-28T10:00:05Z"), q("added-later", null), q("paused", null, false)];
    expect(questionsStillChecking(baseline, after)).toBe(0);
    expect(questionsStillChecking(checkBaseline([q("x", null), q("gone", null)]), [q("x", "2026-09-28T10:00:00Z")])).toBe(0);
  });

  it("accepts dates serialised as strings", () => {
    const baseline = checkBaseline([q("a", "2026-09-20T10:00:00Z")]);
    const asString = { ...q("a", null), latest: { mentioned: true, position: 1, excerpt: null, checkedAt: "2026-09-28T10:00:00Z" as unknown as Date } };
    expect(questionsStillChecking(baseline, [asString])).toBe(0);
  });
});
