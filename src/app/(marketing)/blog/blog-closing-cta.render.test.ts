import { readFileSync } from "node:fs";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { BLOG_LOCALES } from "@/lib/blog/locale";
import { finalCtaCopy } from "@/lib/i18n/home/final-cta";
import { getMessages } from "@/lib/i18n/messages";

/**
 * The blog's closing section is the homepage's banner (client, 2026-11-05,
 * footer.png): one on every post and listing, in the page's language, with
 * the real form; the old panel is gone, and the footer stays below it.
 */

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => createElement("a", { href }, children),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/" }));
vi.mock("@/components/post-cover", () => ({ PostCover: () => null }));

import { BlogPostView } from "./post-view";

const post = (locale: (typeof BLOG_LOCALES)[number]) => ({
  slug: "a-post",
  title: "A post",
  description: "A description.",
  category: "Guides",
  categorySlug: "guides",
  publishedAt: "2026-10-15",
  author: "RepGet team",
  readingMinutes: 5,
  body: "<p>Text.</p>",
  locale,
});

const count = (html: string, needle: string) => html.split(needle).length - 1;

describe("the end of a blog post", () => {
  it.each(BLOG_LOCALES)("%s: one banner, with the form and both ways to start, in the post's language", (locale) => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://www.repget.com");
    const html = renderToStaticMarkup(createElement(BlogPostView, { post: post(locale), versions: [], related: [] }));
    const prefix = locale === "en" ? "" : `/${locale}`;
    const t = finalCtaCopy(locale);

    expect(count(html, 'id="repget-final-cta"')).toBe(1);
    expect(count(html, "<form")).toBe(1);
    expect(html).toContain(`name="website"`);
    expect(html).toContain(`href="${prefix}/audit"`);
    // Sign-up is one page for every language (not in TRANSLATED_PATHS), as the homepage's banner links it.
    expect(html).toMatch(/href="(?:\/[a-z]{2})?\/sign-up"/);
    expect(html).toContain(t.form.submit.replace(/&/g, "&amp;"));
    // Not the old panel's words.
    expect(html).not.toContain(getMessages(locale).home.closingSub.replace(/'/g, "&#x27;"));
    vi.unstubAllEnvs();
  });
});

describe("the old panel", () => {
  it("is gone", () => {
    expect(readFileSync("src/app/(marketing)/home-sections.tsx", "utf8")).not.toMatch(/ClosingCta/);
  });

  it("left no blog page importing the whole homepage's sections", () => {
    for (const path of [
      "src/app/(marketing)/blog/post-view.tsx",
      "src/app/(marketing)/blog/page.tsx",
      "src/app/(marketing)/[locale]/blog/page.tsx",
      "src/app/(marketing)/blog/category/[category]/page.tsx",
      "src/app/(marketing)/[locale]/blog/category/[category]/page.tsx",
      "src/app/(marketing)/blog/author/team-author.tsx",
    ]) {
      const source = readFileSync(path, "utf8");
      expect(source, path).not.toMatch(/home-sections|home-page/);
      expect(source, path).toContain("_home/sections/final-cta");
    }
  });
});
