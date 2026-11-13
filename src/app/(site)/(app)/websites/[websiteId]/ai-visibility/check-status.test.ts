import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { LOCALES, type Locale } from "@/lib/i18n/config";
import { format } from "@/lib/i18n/format";
import { getMessages } from "@/lib/i18n/messages";

import { CheckStatus } from "./check-status";
import { formatWhen } from "./format-when";
import type { CheckPhase, CheckProgress, CheckRequest } from "./visibility-state";

/**
 * The outcome notice by role. Only owners and editors can run a check (the
 * server refuses anyone else), so a viewer is never told to run another one.
 */

const requestedAt = new Date("2026-10-03T10:00:00Z");
const request: CheckRequest = { id: "r1", requestedAt, elapsedMs: 0, state: "released", spendStarted: false };

function progressOf(phase: CheckPhase, withRequest = true): CheckProgress {
  return { phase, answered: 0, expected: 2, pending: new Set(["a", "b"]), done: new Set(), request: withRequest ? request : null };
}

function render(progress: CheckProgress, canEdit: boolean, locale: Locale = "en") {
  const html = renderToStaticMarkup(
    createElement(CheckStatus, {
      progress,
      hidden: false,
      refusal: null,
      onDismiss: () => {},
      onDismissRefusal: () => {},
      canEdit,
      locale,
      t: getMessages(locale).app.geo,
    }),
  );
  return html.replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&");
}

const t = getMessages("en").app.geo;
const date = formatWhen(requestedAt, "en", true);

describe("a check that timed out", () => {
  it("tells an editor they can run another check", () => {
    const html = render(progressOf("timedOut"), true);
    expect(html).toContain(t.statusTimedOutTitle);
    expect(html).toContain(t.statusTimedOutBody);
  });

  it("tells a viewer to look again later, without offering a check they cannot run", () => {
    const html = render(progressOf("timedOut"), false);
    expect(html).toContain(t.statusTimedOutTitle);
    expect(html).toContain(t.statusTimedOutBodyViewer);
    expect(html).not.toContain("run another check");
  });
});

describe("a check that never ran", () => {
  it("tells an editor they can run another check", () => {
    const html = render(progressOf("failed"), true);
    expect(html).toContain(t.statusFailedTitle);
    expect(html).toContain(format(t.statusFailedBody, { date }));
  });

  it("gives a viewer the date only, without offering a check they cannot run", () => {
    const html = render(progressOf("failed"), false);
    expect(html).toContain(t.statusFailedTitle);
    expect(html).toContain(format(t.statusFailedBodyViewer, { date }));
    expect(html).not.toContain("run another check");
  });

  it("uses the viewer copy when the request record is unknown, too", () => {
    const html = render(progressOf("failed", false), false);
    expect(html).toContain(t.statusTimedOutBodyViewer);
    expect(html).not.toContain("run another check");
  });
});

describe("viewer copy in every language", () => {
  it.each(LOCALES)("%s: is its own text, keeps the date, and drops only the advice to run a check", (locale) => {
    const geo = getMessages(locale).app.geo;
    expect(geo.statusTimedOutBodyViewer).not.toBe(geo.statusTimedOutBody);
    expect(geo.statusFailedBodyViewer).not.toBe(geo.statusFailedBody);
    expect(geo.statusFailedBodyViewer).toContain("{date}");
    // The viewer text is the editor text without its advice to run a check.
    expect(geo.statusTimedOutBody.startsWith(geo.statusTimedOutBodyViewer.replace(/\.$/, ""))).toBe(true);
    expect(geo.statusFailedBody.startsWith(geo.statusFailedBodyViewer)).toBe(true);
    const advice = geo.statusFailedBody.slice(geo.statusFailedBodyViewer.length).trim();
    expect(advice).not.toBe("");

    const html = render(progressOf("failed"), false, locale);
    expect(html).toContain(format(geo.statusFailedBodyViewer, { date: formatWhen(requestedAt, locale, true) }));
    expect(html).not.toContain(advice);
  });
});
