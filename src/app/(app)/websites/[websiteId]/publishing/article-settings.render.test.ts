import { createElement, type ComponentProps, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

/**
 * Article Settings by behaviour, rendered to static markup (no DOM, so no
 * clicks or dialogs - the browser check covers those): what a viewer can
 * touch, which bar an editor gets, the image-style radio groups, the
 * derived "Match article images" preview, the brand colour's empty state,
 * and the publishing notices.
 */

vi.mock("@/lib/websites/article-settings", () => ({ saveArticleSettings: vi.fn() }));
vi.mock("@/lib/websites/actions", () => ({ setGenerationMode: vi.fn(), setFinishedMode: vi.fn() }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode; [key: string]: unknown }) =>
    createElement("a", { href, ...rest }, children),
}));

import { getMessages } from "@/lib/i18n/messages";
import { STYLE_SAMPLE_VERSION } from "@/lib/websites/style-samples";
import { ArticleSettingsForm, type StoredArticleSettings } from "../article-settings-form";
import { GenerationPanel } from "../generation-panel";

const t = getMessages("en").app;

const STORED: StoredArticleSettings = {
  articleStyle: "expert",
  internalLinkTarget: 3,
  targetWordCount: null,
  sitemapUrl: "",
  blogUrl: "",
  exampleArticleUrl: "",
  brandColor: "",
  imageStyle: "realistic",
  featuredImageStyle: "match",
  imageBrief: "",
  imageInstructions: "",
  tableOfContents: true,
  youtubeVideo: false,
  authorPerspective: true,
  mentionSimilarProducts: true,
  comparisonTable: true,
  poweredByLink: true,
  authorName: "",
  authorBio: "",
  tone: "",
  vocabulary: "",
  avoid: "",
  usps: "",
  facts: "",
  articleInstructions: "",
};

function form(props: Partial<ComponentProps<typeof ArticleSettingsForm>> = {}) {
  return renderToStaticMarkup(
    createElement(ArticleSettingsForm, {
      websiteId: "site_1",
      initial: STORED,
      reviewed: true,
      canEdit: true,
      t: t.article,
      tCommon: t.common,
      tWorkspace: t.workspace,
      ...props,
    }),
  );
}

function panel(props: Partial<ComponentProps<typeof GenerationPanel>> = {}) {
  return renderToStaticMarkup(
    createElement(GenerationPanel, {
      websiteId: "site_1",
      mode: "automatic",
      days: [],
      finishedMode: "review",
      hasIntegration: true,
      canEdit: true,
      firstArticleSent: true,
      inPartnerNetwork: false,
      t: t.common,
      tArticle: t.article,
      tWorkspace: t.workspace,
      ...props,
    }),
  );
}

/** The markup of one style radio group: from its opening tag to the next group, or the note under both. */
function group(html: string, labelId: string): string {
  const start = html.indexOf(`role="radiogroup" aria-labelledby="${labelId}"`);
  expect(start).toBeGreaterThan(-1);
  const ends = [html.indexOf('role="radiogroup"', start + 1), html.indexOf(t.article.samplesNote, start)].filter((i) => i > -1);
  return html.slice(start, ends.length > 0 ? Math.min(...ends) : undefined);
}

describe("sections and save rules", () => {
  it("renders sections A-F with their anchors, each saying it is kept by the Save button", () => {
    const html = form();
    for (const id of ["writing-seo", "content-sources", "images-branding", "enhancements", "brand-voice", "author"]) {
      expect(html).toContain(`id="${id}"`);
    }
    expect(html.split(t.workspace.savedWithButton)).toHaveLength(7);
    expect(html).not.toContain(t.workspace.savesImmediately);
  });

  it("marks Writing and publishing as saving immediately, never as part of the Save button", () => {
    const html = panel();
    expect(html).toContain('id="writing-publishing"');
    expect(html).toContain(t.workspace.savesImmediately);
    expect(html).not.toContain(t.workspace.savedWithButton);
  });

  it("gives an editor the save bar, which says what it covers and never claims 'Save all'", () => {
    const html = form();
    expect(html).toContain(t.workspace.noChanges);
    expect(html).toContain(t.article.saveBarNote);
    expect(html).not.toMatch(/save all/i);
  });

  it("offers 'Keep the defaults' while the settings have never been saved", () => {
    expect(form({ reviewed: false })).toContain(t.common.keepDefaults);
    expect(form({ reviewed: true })).not.toContain(t.common.keepDefaults);
  });
});

describe("a viewer", () => {
  it("gets read-only controls and no save or confirm bar", () => {
    const html = form({ canEdit: false, reviewed: false });
    expect(html).not.toContain(t.common.keepDefaults);
    expect(html).not.toContain(t.workspace.noChanges);
    // Every text field, select, switch and style card is disabled.
    expect(html).toMatch(/<select[^>]*disabled=""/);
    expect(html).toMatch(/id="tone"[^>]*disabled=""|disabled=""[^>]*id="tone"/);
    expect(html).toMatch(/role="switch"[^>]*disabled=""/);
    expect(html).toMatch(/role="radio"[^>]*disabled=""/);
    expect(html).not.toMatch(/role="switch"(?![^>]*disabled="")[^>]*>/);
  });

  it("is not told how sections are saved, having no Save button and no live controls", () => {
    expect(form({ canEdit: false })).not.toContain(t.workspace.savedWithButton);
    expect(panel({ canEdit: false })).not.toContain(t.workspace.savesImmediately);
    // Editors still see both rules.
    expect(form()).toContain(t.workspace.savedWithButton);
    expect(panel()).toContain(t.workspace.savesImmediately);
  });

  it("cannot change writing or publishing either", () => {
    const html = panel({ canEdit: false });
    expect(html).toMatch(/role="switch"[^>]*disabled=""/);
    expect(html).toMatch(/aria-pressed="true"[^>]*disabled=""/);
    expect(html).not.toMatch(/role="radio"(?![^>]*disabled="")[^>]*>/);
  });
});

describe("image style pickers", () => {
  it("are radio groups with one Tab stop on the selected card, marked in words as well as colour", () => {
    const html = form();
    const body = group(html, "image-style-label");
    expect(body).toContain('role="radiogroup"');
    expect(body.match(/role="radio"/g)).toHaveLength(5);
    expect(body.match(/tabindex="0"/g)).toHaveLength(1);
    expect(body).toMatch(/aria-checked="true" tabindex="0"/);
    expect(body).toContain(t.workspace.selected);
  });

  it("show the versioned 16:9 thumbnails in cards, never the large file", () => {
    const html = form();
    expect(html).toContain(`/style-samples/body-realistic.webp?v=${STYLE_SAMPLE_VERSION}`);
    expect(html).toContain(`/style-samples/featured-sketch.webp?v=${STYLE_SAMPLE_VERSION}`);
    expect(html).not.toContain("-large.webp");
    expect(html).toMatch(/width="640" height="360"/);
  });

  it("give every example its own labelled preview button, separate from the radio", () => {
    const html = form();
    expect(html).toContain('aria-label="Preview the Sketch example"');
    expect(html).toContain('aria-label="Preview the Brand &amp; Text example"');
  });

  it("show 'Match article images' as the CURRENT image style, keeping the stored value 'match'", () => {
    const realistic = group(form({ initial: { ...STORED, imageStyle: "realistic" } }), "cover-style-label");
    expect(realistic).toContain("Currently follows: Realistic");
    expect(realistic).toContain(`/style-samples/body-realistic.webp?v=${STYLE_SAMPLE_VERSION}`);

    const sketch = group(form({ initial: { ...STORED, imageStyle: "sketch" } }), "cover-style-label");
    expect(sketch).toContain("Currently follows: Sketch");
    expect(sketch).toContain(`/style-samples/body-sketch.webp?v=${STYLE_SAMPLE_VERSION}`);
    // "match" is still the selected card.
    expect(sketch).toMatch(/role="radio" aria-checked="true"(?:(?!role="radio")[\s\S])*Match article images/);
  });

  it("describe what production makes: one image per article, Brand & Text without a headline", () => {
    const html = form();
    expect(html).toContain(t.article.imageStyleHint);
    expect(html).toContain("A photo with a bold colour panel along one edge.");
    expect(html).not.toMatch(/headline/i);
    expect(html).not.toContain("inside the article body");
    expect(html).not.toContain("Your colours");
  });

  it("say so when the stored style is not one of the cards, and leave it selected as stored", () => {
    const html = form({ initial: { ...STORED, imageStyle: "legacy-style" } });
    expect(html).toContain("Your saved choice (legacy-style) is not one of these styles.");
    expect(group(html, "image-style-label")).not.toContain('aria-checked="true"');
  });
});

describe("brand colour", () => {
  it("shows an explicit 'No colour set' instead of a black swatch beside a placeholder colour", () => {
    const html = form({ initial: { ...STORED, brandColor: "" } });
    expect(html).toContain(t.article.noColour);
    expect(html).not.toContain("#003388\"");
    expect(html).not.toContain("background-color:#000000");
  });

  it("draws the swatch from the same value as the text box", () => {
    const html = form({ initial: { ...STORED, brandColor: "#00aaff" } });
    expect(html).toContain("background-color:#00aaff");
    expect(html).not.toContain(t.article.noColour);
  });

  it("marks a stored value that is not a colour instead of painting it black", () => {
    const html = form({ initial: { ...STORED, brandColor: "#038" } });
    expect(html).toContain(t.article.invalidColour);
    expect(html).not.toContain("background-color:#000000");
  });
});

describe("publishing notices", () => {
  it("mentions the first-article rule only while the first article is still to come", () => {
    expect(panel({ firstArticleSent: false })).toContain(t.article.firstArticleOnly);
    expect(panel({ firstArticleSent: true })).not.toContain(t.article.firstArticleOnly);
  });

  it("mentions the Partner Network review only for a website in it", () => {
    expect(panel({ inPartnerNetwork: true })).toContain(t.article.networkReview);
    expect(panel({ inPartnerNetwork: false })).not.toContain(t.article.networkReview);
  });

  it("links to Integrations when nothing is connected", () => {
    const html = panel({ hasIntegration: false });
    expect(html).toContain(t.common.connectWebsiteFirst);
    expect(html).toContain('href="/websites/site_1/integrations"');
    expect(panel({ hasIntegration: true })).not.toContain(t.common.connectWebsiteFirst);
  });

  it("names writing days in full for screen readers and says they follow UTC", () => {
    const html = panel({ days: [1, 2] });
    expect(html).toContain('aria-label="Monday"');
    expect(html).toContain(t.article.daysUtc);
    expect(html).toMatch(/aria-pressed="true"[^>]*aria-label="Monday"|aria-label="Monday"[^>]*aria-pressed="true"/);
    expect(html).toMatch(/aria-pressed="false"[^>]*aria-label="Sunday"|aria-label="Sunday"[^>]*aria-pressed="false"/);
  });
});

describe("every language", () => {
  it("has every Article Settings string, none of them empty", () => {
    const paths = (value: unknown, prefix = ""): string[] =>
      Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
        typeof child === "object" && child !== null ? paths(child, `${prefix}${key}.`) : [`${prefix}${key}`],
      );
    const english = paths(getMessages("en").app.article).sort();
    for (const locale of ["es", "fr", "it", "de"] as const) {
      const article = getMessages(locale).app.article;
      expect(paths(article).sort(), locale).toEqual(english);
      for (const path of english) {
        const text = path.split(".").reduce<unknown>((node, key) => (node as Record<string, unknown>)[key], article);
        expect(typeof text === "string" && text.trim().length > 0, `${locale} ${path}`).toBe(true);
      }
    }
  });

  it("has a label and hint for every image style id", () => {
    for (const locale of ["en", "es", "fr", "it", "de"] as const) {
      const article = getMessages(locale).app.article;
      for (const id of ["sketch", "watercolour", "realistic", "illustration", "brand-text"]) {
        expect(article.bodyImageStyles[id]?.label, `${locale} body ${id}`).toBeTruthy();
        expect(article.bodyImageStyles[id]?.hint, `${locale} body ${id}`).toBeTruthy();
      }
      for (const id of ["sketch", "watercolour", "illustration", "match"]) {
        expect(article.coverImageStyles[id]?.label, `${locale} cover ${id}`).toBeTruthy();
      }
    }
  });
});
