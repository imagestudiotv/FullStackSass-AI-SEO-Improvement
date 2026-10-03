import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { GeoPromptView } from "@/lib/geo/shared";
import { getMessages } from "@/lib/i18n/messages";

/**
 * Where keyboard focus goes when the Remove question dialog closes.
 *
 * The dialog is opened from code (the trash button calls onRemove), not from
 * a DialogTrigger, so Radix has no trigger to give focus back to: unless the
 * panel restores it, Cancel or Escape drops focus on the page body and the
 * next Tab starts again at the top of the page.
 *
 * There is no DOM in these tests, so the dialog and the list are replaced by
 * stand-ins that hand back the props the panel gives them, and the handlers
 * are called the way the browser would call them.
 */

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), replace: vi.fn(), push: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock("@/lib/geo/actions", () => ({
  addGeoPrompt: vi.fn(),
  removeGeoPrompt: vi.fn(),
  runGeoCheck: vi.fn(),
  suggestGeoPrompts: vi.fn(),
}));

type Props = Record<string, unknown>;
const captured = vi.hoisted(() => ({ list: null as Props | null, dialog: null as Props | null }));

vi.mock("./question-list", () => ({
  QuestionList: (props: Props) => {
    captured.list = props;
    return null;
  },
}));
vi.mock("@/components/ui/dialog", () => {
  const pass = ({ children }: { children?: unknown }) => children ?? null;
  return {
    Dialog: pass,
    DialogHeader: pass,
    DialogTitle: pass,
    DialogDescription: pass,
    DialogFooter: pass,
    DialogContent: (props: Props) => {
      captured.dialog = props;
      return null;
    },
  };
});

import { GeoPanel } from "../geo-panel";

/** Stands in for a focusable element. */
class FakeElement {
  focus = vi.fn();
}

const prompt: GeoPromptView = {
  id: "a",
  prompt: "Which dentist near Utrecht is best?",
  isSuggested: false,
  active: true,
  latest: null,
};

function renderPanel() {
  const t = getMessages("en").app;
  renderToStaticMarkup(
    createElement(GeoPanel, {
      websiteId: "w1",
      overview: {
        score: 0,
        mentions: 0,
        total: 0,
        averagePosition: null,
        topCompetitors: [],
        prompts: [prompt],
        lastCheckedAt: null,
        previousScore: null,
      },
      details: {
        questions: { a: { createdAt: new Date("2026-09-01T00:00:00Z"), latest: null, earlier: [] } },
        latestRunStartedAt: null,
        previousRunAt: null,
        request: null,
        assistants: [],
      },
      allowance: 20,
      canEdit: true,
      blockedReason: null,
      initialFilter: "all",
      locale: "en",
      t: t.geo,
      tCommon: t.common,
      tw: t.workspace,
    }),
  );
  const list = captured.list!;
  const dialog = captured.dialog!;
  return {
    listRef: list.listRef as { current: unknown },
    onRemove: list.onRemove as (prompt: GeoPromptView) => void,
    onCloseAutoFocus: dialog.onCloseAutoFocus as (event: { preventDefault: () => void }) => void,
  };
}

/** The browser's close: Radix calls onCloseAutoFocus with a cancelable event. */
function closeEvent() {
  return { preventDefault: vi.fn() };
}

beforeEach(() => {
  captured.list = null;
  captured.dialog = null;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("closing the Remove question dialog without removing", () => {
  it("returns focus to the trash button that opened it (Cancel or Escape)", () => {
    const panel = renderPanel();
    const list = new FakeElement();
    const trash = new FakeElement();
    panel.listRef.current = list;
    vi.stubGlobal("HTMLElement", FakeElement);
    vi.stubGlobal("document", { activeElement: trash });

    panel.onRemove(prompt);
    const event = closeEvent();
    panel.onCloseAutoFocus(event);

    // Radix's own fallback would focus a trigger that does not exist.
    expect(event.preventDefault).toHaveBeenCalled();
    expect(trash.focus).toHaveBeenCalledTimes(1);
    expect(list.focus).not.toHaveBeenCalled();
  });

  it("does not send focus to an earlier opener on a later close", () => {
    const panel = renderPanel();
    const first = new FakeElement();
    vi.stubGlobal("HTMLElement", FakeElement);
    vi.stubGlobal("document", { activeElement: first });

    panel.onRemove(prompt);
    panel.onCloseAutoFocus(closeEvent());
    expect(first.focus).toHaveBeenCalledTimes(1);

    // Opened again while nothing focusable had focus.
    vi.stubGlobal("document", { activeElement: null });
    panel.onRemove(prompt);
    const event = closeEvent();
    panel.onCloseAutoFocus(event);
    expect(event.preventDefault).toHaveBeenCalled();
    expect(first.focus).toHaveBeenCalledTimes(1);
  });
});
