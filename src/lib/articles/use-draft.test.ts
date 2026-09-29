import { describe, expect, it } from "vitest";

import { sanitizeHtml } from "@/lib/articles/sanitize";
import { previewHtml, sameHtml } from "@/lib/articles/use-draft";

describe("the editors' Preview of unsaved text", () => {
  it("renders nothing a save would remove: no script, no handler, no javascript: link", () => {
    const typed =
      '<p>Hello<script>alert(1)</script></p><img src="x" onerror="alert(2)"><p><a href="javascript:alert(3)">x</a></p>';
    const shown = previewHtml(typed);
    expect(shown).not.toMatch(/script|onerror|javascript:/i);
    expect(shown).toContain("<p>Hello</p>");
  });

  it("treats the editor's re-serialised markup and the saved copy as the same text", () => {
    // The editor writes rel/target before href; a save rebuilds the attributes
    // (and leaves links to the site itself without nofollow).
    const inEditor =
      '<p>See <a target="_blank" rel="noopener nofollow" href="https://site.test/prices">our prices</a> and ' +
      '<a target="_blank" rel="noopener nofollow" href="https://other.test/?a=1&amp;b=2">theirs</a>.</p>';
    const saved = sanitizeHtml(inEditor, { siteHosts: new Set(["site.test"]) });
    expect(saved).not.toBe(inEditor);
    expect(sameHtml(inEditor, saved)).toBe(true);
  });

  it("notices a real change", () => {
    const saved = sanitizeHtml("<p>Wedding films last for decades.</p>");
    expect(sameHtml("<p>Wedding films last for generations.</p>", saved)).toBe(false);
  });
});
