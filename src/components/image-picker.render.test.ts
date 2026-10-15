import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { getMessages } from "@/lib/i18n/messages";

import { ImagePicker } from "./image-picker";

/**
 * The picture picker's choice of which pictures to suggest (client,
 * 2026-10-15: "we need to separate the images suggestions for each
 * language"): Admin -> Blog offers the post's language or all of them. A
 * caller that offers no choice gets the picker as it was.
 */

const SCOPES = {
  label: "Pictures to show",
  options: [
    { value: "it", label: "Italian", empty: "No Italian pictures yet - upload one, or choose All languages." },
    { value: "all", label: "All languages" },
  ],
};

function render(props: Partial<ComponentProps<typeof ImagePicker>> = {}) {
  return renderToStaticMarkup(
    createElement(ImagePicker, {
      images: [],
      loading: false,
      onSearch: vi.fn(),
      onUpload: vi.fn(async () => null),
      onInsert: vi.fn(),
      onClose: vi.fn(),
      ...props,
    }),
  );
}

describe("the picture picker's choice of pictures", () => {
  it("offers the choice, the first option chosen", () => {
    const html = render({ scopes: SCOPES, images: [{ url: "https://store.test/blog/posts/it/a.webp", name: "Schema" }] });
    const group = /<div role="group" aria-label="Pictures to show"[\s\S]*?<\/div>/.exec(html)?.[0] ?? "";
    expect(group).toMatch(/<button[^>]*aria-pressed="true"[^>]*>Italian<\/button>/);
    expect(group).toMatch(/<button[^>]*aria-pressed="false"[^>]*>All languages<\/button>/);
  });

  it("says when the chosen language has no pictures yet", () => {
    const html = render({ scopes: SCOPES });
    expect(html).toContain(SCOPES.options[0].empty);
    // Instead of "no pictures yet": there are pictures, in other languages.
    expect(html).not.toContain(getMessages("en").app.editorUi.noPicturesYet);
  });

  it("is as before without a choice", () => {
    const html = render();
    expect(html).not.toContain('role="group"');
    expect(html).toContain(getMessages("en").app.editorUi.noPicturesYet);
  });
});
