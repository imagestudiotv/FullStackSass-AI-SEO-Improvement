import { describe, expect, it } from "vitest";

import { AUDIT_COPY } from "@/app/(marketing)/audit/copy";
import { AI_CRAWLERS_COPY } from "@/app/(marketing)/tools/ai-crawler-checker/copy";
import { KEYWORD_DENSITY_COPY } from "@/app/(marketing)/tools/keyword-density/copy";
import { LLM_HTML_COPY } from "@/app/(marketing)/tools/llm-html-checker/copy";
import { LLMS_TXT_COPY } from "@/app/(marketing)/tools/llms-txt-generator/copy";
import { META_DESCRIPTION_COPY } from "@/app/(marketing)/tools/meta-description-generator/copy";
import { META_TAGS_COPY } from "@/app/(marketing)/tools/meta-tag-checker/copy";
import { ROBOTS_COPY } from "@/app/(marketing)/tools/robots-checker/copy";
import { SITEMAP_COPY } from "@/app/(marketing)/tools/sitemap-checker/copy";
import { SNIPPET_COPY } from "@/app/(marketing)/tools/snippet-preview/copy";
import { LIMITS } from "@/lib/audit/rules";
import { socialPostGeneratorCopy } from "@/lib/i18n/social-post-generator";
import { WEBSITE_CREATION_COPY } from "@/lib/marketing/website-creation/copy";
import { BLOG_CHROME } from "@/lib/blog/locale";
import { pageSuffix } from "@/lib/blog/pagination";
import { LOCALES, type Locale } from "@/lib/i18n/config";
import { getMessages } from "@/lib/i18n/messages";
import { CASE_STUDY_COPY, CASE_STUDY_PATH } from "@/lib/marketing/case-study-image-studio";
import { partnerCopy } from "@/lib/partners/presentation/copy";
import { featurePageContent } from "@/lib/marketing/feature-pages";
import { docsUi, integrationDocs } from "@/lib/publishing/docs";
import { HOME_META } from "@/lib/seo/home-metadata";
import { buildSiteLlmsTxt, PAGE_NOTES } from "@/lib/site-llms-txt";
import { TOOLS_COMMON } from "@/lib/tools/i18n/common";

/**
 * Every public page's title and description, in every language, within what
 * the free audit checks (lib/audit/rules.ts LIMITS) - RepGet's own audit
 * flagged its home page at 159 characters (live check, 2026-10-13), and 77
 * more were over or under. The root layout appends " | RepGet" to titles.
 */

const SUFFIX = " | RepGet";
type Meta = { page: string; title: string | null; description: string };

const TOOL_DESCRIPTIONS: Record<string, Record<Locale, { metaDescription: string }>> = {
  "/tools/robots-checker": ROBOTS_COPY,
  "/tools/sitemap-checker": SITEMAP_COPY,
  "/tools/meta-tag-checker": META_TAGS_COPY,
  "/tools/ai-crawler-checker": AI_CRAWLERS_COPY,
  "/tools/llms-txt-generator": LLMS_TXT_COPY,
  "/tools/llm-html-checker": LLM_HTML_COPY,
  "/tools/snippet-preview": SNIPPET_COPY,
  "/tools/keyword-density": KEYWORD_DENSITY_COPY,
  "/tools/meta-description-generator": META_DESCRIPTION_COPY,
  "/tools/social-media-post-generator": { en: socialPostGeneratorCopy("en"), es: socialPostGeneratorCopy("es"), fr: socialPostGeneratorCopy("fr"), it: socialPostGeneratorCopy("it"), de: socialPostGeneratorCopy("de") },
};

function pagesIn(locale: Locale): Meta[] {
  const t = getMessages(locale);
  const pages: Meta[] = [];
  const add = (page: string, title: string | null, description: string) => pages.push({ page: `${locale} ${page}`, title, description });

  // The home page's titles are absolute, " | RepGet" already in them; checked as the others are.
  add("/", HOME_META[locale].title.slice(0, -SUFFIX.length), HOME_META[locale].description);
  if (locale !== "en") add("/pricing", t.pricing.title, t.pricing.metaDescription);
  for (const [page, section] of [
    ["/about", t.about],
    ["/faq", t.faq],
    ["/contact", t.contact],
    ["/success-stories", t.successStories],
    ["/publishers", t.publishers],
    ["/affiliate", t.affiliate],
    ["/backlink-exchange", t.backlinkExchange],
  ] as const) {
    add(page, section.metaTitle, section.metaDescription);
  }
  add("/partners", partnerCopy(locale).page.metaTitle, partnerCopy(locale).page.metaDescription);

  const common = TOOLS_COMMON[locale];
  add("/tools", common.hub.metaTitle, common.hub.metaDescription);
  for (const [href, copy] of Object.entries(TOOL_DESCRIPTIONS)) add(href, common.tools[href].title, copy[locale].metaDescription);

  const ui = docsUi(locale);
  add("/docs/integrations", ui.metaTitle, ui.metaDescription);
  for (const doc of integrationDocs(locale)) add(`/docs/integrations/${doc.slug}`, ui.connectTitle.replace("{name}", doc.name), doc.summary);

  for (const path of ["/backlinks", "/rank-on-chatgpt"] as const) {
    const { page } = featurePageContent(path, locale);
    add(path, page.metaTitle, page.metaDescription);
  }
  add("/audit", AUDIT_COPY[locale].metaTitle, AUDIT_COPY[locale].metaDescription);
  add("/website-creation", WEBSITE_CREATION_COPY[locale].metaTitle, WEBSITE_CREATION_COPY[locale].metaDescription);
  add(CASE_STUDY_PATH, CASE_STUDY_COPY[locale].metaTitle, CASE_STUDY_COPY[locale].metaDescription);
  return pages;
}

const ALL = LOCALES.flatMap(pagesIn);

describe("titles and descriptions of the public pages", () => {
  it("covers every language", () => {
    expect(ALL.length).toBeGreaterThan(5 * 25);
  });

  it(`no title is longer than ${LIMITS.titleMax} characters once " | RepGet" is added`, () => {
    const long = ALL.filter((m) => m.title !== null && (m.title + SUFFIX).length > LIMITS.titleMax).map((m) => `${m.page}: ${(m.title + SUFFIX).length} "${m.title}"`);
    expect(long).toEqual([]);
  });

  it(`every description is ${LIMITS.metaMin}-${LIMITS.metaMax} characters`, () => {
    const off = ALL.filter((m) => m.description.length > LIMITS.metaMax || m.description.length < LIMITS.metaMin).map(
      (m) => `${m.page}: ${m.description.length} "${m.description}"`,
    );
    expect(off).toEqual([]);
  });

  it("the English pages whose descriptions /llms.txt repeats are within the limits too", () => {
    const off = Object.entries(PAGE_NOTES).filter(([, note]) => note.length > LIMITS.metaMax || note.length < LIMITS.metaMin);
    expect(off).toEqual([]);
  });

  it("the blog listings stay within them from page 2 on, up to page 99 (\" — Page N\" is added to both)", () => {
    const listings = [
      { page: "en /blog", title: "Blog", description: PAGE_NOTES["/blog"], label: undefined },
      ...LOCALES.filter((l) => l !== "en").map((l) => ({ page: `${l} /blog`, title: BLOG_CHROME[l].metaTitle, description: BLOG_CHROME[l].metaDescription, label: BLOG_CHROME[l].pageN })),
    ];
    const off = listings.flatMap(({ page, title, description, label }) => {
      const suffix = pageSuffix(99, label);
      const paged = { title: `${title}${suffix}${SUFFIX}`, description: `${description.replace(/\.$/, "")}${suffix}.` };
      return paged.title.length > LIMITS.titleMax || paged.description.length > LIMITS.metaMax ? [`${page}: ${paged.title.length} / ${paged.description.length}`] : [];
    });
    expect(off).toEqual([]);
  });

  it("the team's author page, in every language, from page 1 to page 99", () => {
    const off = LOCALES.flatMap((locale) => {
      const t = BLOG_CHROME[locale];
      return [1, 99].flatMap((page) => {
        const suffix = pageSuffix(page, t.pageN);
        const title = `${t.teamName}${suffix}${SUFFIX}`;
        const description = `${t.authorMetaDescription}${suffix}.`;
        const fits = title.length <= LIMITS.titleMax && description.length >= LIMITS.metaMin && description.length <= LIMITS.metaMax;
        return fits ? [] : [`${locale} page ${page}: ${title.length} / ${description.length}`];
      });
    });
    expect(off).toEqual([]);
  });

  describe("the home page (lib/seo/home-metadata.ts, absolute titles)", () => {
    const { title, description } = HOME_META.en;

    it.each(LOCALES)("%s: the title already ends in \" | RepGet\" and is within the limits as it stands", (locale) => {
      const meta = HOME_META[locale];
      expect(meta.title.endsWith(SUFFIX)).toBe(true);
      expect(meta.title.length).toBeLessThanOrEqual(LIMITS.titleMax);
      expect(meta.title.length).toBeGreaterThanOrEqual(LIMITS.titleMin);
    });

    it.each(LOCALES)("%s: the description is 140-155 characters, short of what Ahrefs calls too long", (locale) => {
      expect(HOME_META[locale].description.length).toBeGreaterThanOrEqual(140);
      expect(HOME_META[locale].description.length).toBeLessThanOrEqual(155);
    });

    it("names the same product in every language: SEO, backlinks and Growth Copilot", () => {
      for (const locale of LOCALES) {
        const text = `${HOME_META[locale].title} ${HOME_META[locale].description}`;
        expect(text, locale).toMatch(/SEO/);
        expect(text, locale).toMatch(/backlink/i);
        expect(text, locale).toMatch(/Growth Copilot/);
      }
    });

    it("never says \"analysis\": a Google removal of the old vercel.app result relies on the word being gone", () => {
      expect(`${title} ${description}`).not.toMatch(/analysis/i);
    });

    it("is what /llms.txt repeats as its summary", () => {
      const summary = buildSiteLlmsTxt("https://www.repget.com", []).split("\n")[2];
      expect(summary).toBe(`> RepGet is an AI SEO platform for articles, social posts and videos. ${description}`);
    });
  });
});
