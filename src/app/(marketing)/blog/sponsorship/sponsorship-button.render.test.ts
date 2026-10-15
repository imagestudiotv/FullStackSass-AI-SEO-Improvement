import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { SPONSORSHIP_COPY } from "@/lib/blog/sponsorship-copy";

/**
 * "Get Featured in This Article" on every language's articles (client,
 * 2026-10-15): an Italian article carries the button too, in Italian - it
 * used to be on English articles only.
 */

const { POSTS } = vi.hoisted(() => {
  const base = { publishedAt: "2026-10-15", author: "RepGet team", readingMinutes: 5, body: "<p>Testo.</p>", description: "Descrizione." };
  return {
    POSTS: {
      it: { ...base, slug: "sito-non-compare-su-google", title: "Il tuo sito non compare su Google?", category: "Playbooks", categoryLabel: "Strategie", categorySlug: "playbooks", locale: "it" as const },
      en: { ...base, slug: "keyword-cannibalization", title: "Keyword cannibalization", category: "Guides", categoryLabel: "Guides", categorySlug: "guides", locale: "en" as const },
    },
  };
});

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode; [key: string]: unknown }) =>
    createElement("a", { href, ...rest }, children),
}));
vi.mock("@/app/(marketing)/home-sections", () => ({ ClosingCta: () => null }));
vi.mock("@/components/post-cover", () => ({ PostCover: () => null }));
vi.mock("@/lib/blog/posts", () => ({
  getPost: async (slug: string, locale = "en") => Object.values(POSTS).find((post) => post.slug === slug && post.locale === locale) ?? null,
  postVersions: async () => [],
  relatedPosts: async () => [],
}));

import LocaleBlogPostPage from "../../[locale]/blog/[slug]/page";
import BlogPostPage from "../[slug]/page";

beforeAll(() => {
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://www.repget.com");
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_placeholder");
});
afterAll(() => vi.unstubAllEnvs());

describe("the article's Get Featured button", () => {
  it("is on an Italian article, in Italian", async () => {
    const html = renderToStaticMarkup(
      await LocaleBlogPostPage({ params: Promise.resolve({ locale: "it", slug: POSTS.it.slug }), searchParams: Promise.resolve({}) }),
    );
    expect(html).toContain(SPONSORSHIP_COPY.it.panel.trigger);
    expect(html).not.toContain(SPONSORSHIP_COPY.en.panel.trigger);
    // Long words wrap inside the pill on a phone instead of spilling out of it.
    const trigger = /<button[^>]*aria-haspopup="dialog"[^>]*>/.exec(html)?.[0] ?? "";
    expect(trigger).toContain("whitespace-normal");
    expect(trigger).not.toContain("whitespace-nowrap");
  });

  it("opens again on an Italian article a buyer came back to from Stripe without paying", async () => {
    const render = async (featured?: string) =>
      renderToStaticMarkup(
        await LocaleBlogPostPage({
          params: Promise.resolve({ locale: "it", slug: POSTS.it.slug }),
          searchParams: Promise.resolve(featured ? { featured } : {}),
        }),
      );
    expect(await render("cancelled")).toContain('aria-expanded="true"');
    expect(await render()).toContain('aria-expanded="false"');
  });

  it("is on an English article, in English, as it was", async () => {
    const html = renderToStaticMarkup(
      await BlogPostPage({ params: Promise.resolve({ slug: POSTS.en.slug }), searchParams: Promise.resolve({}) } as never),
    );
    expect(html).toContain(SPONSORSHIP_COPY.en.panel.trigger);
  });
});
