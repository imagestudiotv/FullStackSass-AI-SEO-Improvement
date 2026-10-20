import { beforeEach, describe, expect, it, vi } from "vitest";

import { message } from "@/test/blog-autopilot";

/**
 * A customer's article in another language (lib/articles/translate-article.ts):
 * the fields in one call, the body in its parts, nothing of its shape lost,
 * its links exactly as written. The model is mocked.
 */

const ai = vi.hoisted(() => ({ stream: vi.fn() }));
vi.mock("@/lib/ai/client", () => ({
  anthropic: { messages: { stream: ai.stream } },
  MODELS: { EXTRACTION: "claude-haiku-4-5", GENERATION: "claude-sonnet-5", BLOG: "claude-sonnet-5", BLOG_TRANSLATION: "claude-haiku-5-5", ARTICLE_TRANSLATION: "claude-haiku-5-5" },
  isAiConfigured: () => true,
}));

import { skeleton, slugFrom, translateArticle, TranslationError, type ArticleToTranslate } from "./translate-article";

const answer = (value: unknown) => ai.stream.mockImplementationOnce(() => ({ finalMessage: async () => message(value) }));
type Asked = { model: string; system: { text: string }[]; messages: { content: string }[] };
const asked = (index: number) => ai.stream.mock.calls[index][0] as Asked;

const HOSTS = new Set(["studio.test", "www.studio.test"]);
const BODY = [
  '<p>Planning a wedding on <a href="https://www.studio.test/villas/">the lake</a>.</p>',
  '<h2 id="villas">Villas</h2><p>Villa del Balbianello.</p><figure><img src="https://studio.test/uploads/villa.jpg" alt="The villa"></figure>',
  '<h2 id="boats">Boats</h2><ul><li>Morning</li><li>Sunset</li></ul>',
].join("");

const ARTICLE: ArticleToTranslate = {
  title: "Getting Married on Lake Como",
  slug: "lake-como-wedding",
  metaDescription: "How to plan a wedding on Lake Como.",
  imageAlt: "A couple on a boat",
  bodyHtml: BODY,
  from: "English",
  to: "Italian",
  siteHosts: HOSTS,
};

const FIELDS = { title: "Sposarsi sul Lago di Como", slug: "Sposarsi sul Lago di Como!", description: "Come organizzare un matrimonio sul Lago di Como.", pictureAlt: "Una coppia in barca" };
// The model wrote the site's link in another form: it is put back exactly as the original wrote it.
const ITALIAN_BODY =
  '<p>Organizzare un matrimonio sul <a href="https://studio.test/villas">lago</a>.</p>' +
  '<h2 id="villas">Ville</h2><p>Villa del Balbianello.</p><figure><img src="https://studio.test/uploads/villa.jpg" alt="La villa"></figure>' +
  '<h2 id="boats">Barche</h2><ul><li>Mattina</li><li>Tramonto</li></ul>';

beforeEach(() => ai.stream.mockReset());

describe("an article in another language", () => {
  it("is translated by Claude Haiku 5.5: the fields, then the body, its links exactly as written", async () => {
    answer(FIELDS);
    answer({ bodyHtml: ITALIAN_BODY });
    const out = await translateArticle(ARTICLE);

    expect(asked(0).model).toBe("claude-haiku-5-5");
    expect(asked(0).system[0].text).toContain("from English into Italian");
    expect(asked(0).system[0].text).toContain("Never change an href, src, id or class");
    expect(asked(0).system[0].text).not.toMatch(/RepGet/);
    expect(asked(1).messages[0].content).toContain("Sposarsi sul Lago di Como");
    expect(out).toMatchObject({
      title: "Sposarsi sul Lago di Como",
      slug: "sposarsi-sul-lago-di-como",
      metaDescription: "Come organizzare un matrimonio sul Lago di Como.",
      imageAlt: "Una coppia in barca",
    });
    expect(out.bodyHtml).toContain('href="https://www.studio.test/villas/"');
    expect(out.bodyHtml).toContain('<h2 id="villas">Ville</h2>');
    expect(out.usage.calls).toBe(2);
    expect(out.usage.costUsd).toBeGreaterThan(0);
  });

  it("is refused when a part loses or changes a heading id, a list item, a picture or a link - with what it cost", async () => {
    for (const broken of [
      ITALIAN_BODY.replace('id="villas"', 'id="ville"'),
      ITALIAN_BODY.replace("<li>Tramonto</li>", ""),
      ITALIAN_BODY.replace("uploads/villa.jpg", "uploads/other.jpg"),
      ITALIAN_BODY.replace("https://studio.test/villas", "https://studio.test/it/ville"),
    ]) {
      ai.stream.mockReset();
      answer(FIELDS);
      answer({ bodyHtml: broken });
      const failure = await translateArticle(ARTICLE).catch((error: unknown) => error);
      expect(failure).toBeInstanceOf(TranslationError);
      expect((failure as TranslationError).message).toContain("Italian translation changed");
      expect((failure as TranslationError).usage.calls).toBe(2);
    }
  });

  it("fails as a TranslationError when the model does, keeping the cost of the calls before", async () => {
    answer(FIELDS);
    ai.stream.mockImplementationOnce(() => ({ finalMessage: async () => { throw new Error("overloaded"); } }));
    const failure = (await translateArticle(ARTICLE).catch((error: unknown) => error)) as TranslationError;
    expect(failure).toBeInstanceOf(TranslationError);
    expect(failure.message).toBe("overloaded");
    expect(failure.usage.calls).toBe(1);
  });

  it("has no description or alt text when the original has none", async () => {
    answer({ ...FIELDS, description: "invented", pictureAlt: "invented" });
    answer({ bodyHtml: ITALIAN_BODY });
    const out = await translateArticle({ ...ARTICLE, metaDescription: null, imageAlt: null });
    expect(out.metaDescription).toBeNull();
    expect(out.imageAlt).toBeNull();
  });
});

describe("the helpers", () => {
  it("a slug is short plain ASCII", () => {
    expect(slugFrom("Casarse en el Lago de Como: guía práctica")).toBe("casarse-en-el-lago-de-como-guia-practica");
    expect(slugFrom("a".repeat(90))).toHaveLength(80);
    expect(slugFrom("!!!")).toBe("");
  });

  it("a site link is the same address in any form; another site's is compared as written", () => {
    expect(skeleton('<a href="https://www.studio.test/x/">x</a>', HOSTS)).toBe(skeleton('<a href="/x">x</a>', HOSTS));
    expect(skeleton('<a href="https://other.test/x/">x</a>', HOSTS)).not.toBe(skeleton('<a href="https://other.test/x">x</a>', HOSTS));
  });
});
