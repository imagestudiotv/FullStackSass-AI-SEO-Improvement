import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { getMessages } from "@/lib/i18n/messages";

import { SaveBar, type SaveBarState } from "./save-bar";

/**
 * Save may not take keyboard focus away when it stops being available. A button
 * that becomes `disabled` while focused drops focus to the page body, which
 * sends a keyboard user back to the start of the page after every save.
 */

const t = getMessages("en").app.workspace;
const saveButton = (state: SaveBarState, disabled?: boolean) => {
  const html = renderToStaticMarkup(createElement(SaveBar, { state, onSave: () => {}, t, saveLabel: "Save it", disabled }));
  const match = html.match(/<button(?:(?!<\/button>).)*Save it<\/button>/);
  if (!match) throw new Error("no Save button");
  return match[0];
};

describe("the Save button", () => {
  it.each<[string, SaveBarState, boolean | undefined]>([
    ["nothing to save", { kind: "clean" }, undefined],
    ["just saved", { kind: "saved" }, undefined],
    ["saving", { kind: "saving", count: 1 }, undefined],
    ["held by the page", { kind: "dirty", count: 1 }, true],
  ])("%s: unavailable and announced as such, but still able to hold focus", (_what, state, disabled) => {
    const html = saveButton(state, disabled);
    expect(html).toContain('aria-disabled="true"');
    expect(html).not.toContain('disabled=""');
  });

  it.each<[string, SaveBarState]>([
    ["unsaved changes", { kind: "dirty", count: 1 }],
    ["a failed save", { kind: "failed", error: "No", count: 1 }],
  ])("%s: available", (_what, state) => {
    const html = saveButton(state);
    expect(html).not.toContain("aria-disabled");
    expect(html).not.toContain('disabled=""');
  });
});
