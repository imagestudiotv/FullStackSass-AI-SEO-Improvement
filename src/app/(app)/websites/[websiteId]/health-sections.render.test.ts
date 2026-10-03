import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { LOCALES, type Locale } from "@/lib/i18n/config";
import { getMessages } from "@/lib/i18n/messages";

/**
 * The failed-check notice as each role reads it. A viewer has no button that
 * starts a check (and startAudit refuses one), so the notice must not tell
 * them to try again.
 */

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode; [key: string]: unknown }) =>
    createElement("a", { href, ...rest }, children),
}));

import type { FailureKind } from "./health-model";
import { RunStatus } from "./health-sections";

/** Static markup escapes quotes and apostrophes; compare against the escaped form. */
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;").replace(/</g, "&lt;");

function renderFailed(failure: FailureKind, canEdit: boolean, locale: Locale = "en") {
  return renderToStaticMarkup(
    createElement(RunStatus, {
      run: { phase: "failed", startedAt: new Date("2026-10-03T10:00:00Z"), failure },
      previousAt: null,
      finishedAt: null,
      canEdit,
      onRefresh: () => {},
      locale,
      t: getMessages(locale).app.health,
    }),
  );
}

const RETRY_KINDS = ["timeout", "generic"] as const;

describe("a failed check, as a viewer reads it", () => {
  it("is not told to try again, in any language", () => {
    for (const locale of LOCALES) {
      const t = getMessages(locale).app.health;
      for (const kind of RETRY_KINDS) {
        const html = renderFailed(kind, false, locale);
        expect(html).toContain(esc(t.failedTitle));
        expect(html).toContain(esc(t.failureViewer[kind]));
        expect(html).not.toContain(esc(t.failure[kind]));
      }
    }
  });

  it("the viewer wording carries no retry instruction and names who can run the check", () => {
    for (const kind of RETRY_KINDS) {
      const html = renderFailed(kind, false);
      expect(html).not.toMatch(/try again/i);
      expect(html).toContain("An owner or an editor can run the check again.");
    }
  });

  it("every language has its own viewer wording, not a copy of the editor's", () => {
    for (const locale of LOCALES) {
      const t = getMessages(locale).app.health;
      for (const kind of RETRY_KINDS) {
        expect(t.failureViewer[kind].trim()).not.toBe("");
        expect(t.failureViewer[kind]).not.toBe(t.failure[kind]);
      }
    }
  });

  it("a failure without a retry instruction reads the same for a viewer", () => {
    const t = getMessages("en").app.health;
    const html = renderFailed("refused", false);
    expect(html).toContain(esc(t.failure.refused));
  });
});

describe("a failed check, as an owner or editor reads it", () => {
  it("is still told to try again, since they can", () => {
    for (const locale of LOCALES) {
      const t = getMessages(locale).app.health;
      for (const kind of RETRY_KINDS) {
        const html = renderFailed(kind, true, locale);
        expect(html).toContain(esc(t.failure[kind]));
        expect(html).not.toContain(esc(t.failureViewer[kind]));
      }
    }
  });
});
