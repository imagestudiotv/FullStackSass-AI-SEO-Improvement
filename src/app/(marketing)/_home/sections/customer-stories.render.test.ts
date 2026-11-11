import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { COMMENTS_COPY, CUSTOMER_STORIES_COPY } from "@/lib/i18n/blog-engagement";
import { LOCALES } from "@/lib/i18n/config";

/**
 * The homepage's Customer stories and a post's comments (client's designs,
 * 2026-11-11): the stories section shows up to three real posts with their
 * business's logo (or an initial tile) and byline, and is absent with none;
 * a signed-out reader sees the design's gate, its links returning to the post.
 */

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/lib/blog/engagement-actions", () => ({
  loadPostEngagement: vi.fn(),
  togglePostUpvote: vi.fn(),
  toggleCommentUpvote: vi.fn(),
  postComment: vi.fn(),
  deleteMyComment: vi.fn(),
}));

import { BlogEngagement } from "@/components/blog-engagement/blog-engagement";
import { CustomerStories, type HomeCustomerStory } from "./customer-stories";

const story = (n: number, extra: Partial<HomeCustomerStory> = {}): HomeCustomerStory => ({
  postId: `p${n}`,
  title: `How Studio ${n} grew`,
  description: `Story ${n} description`,
  name: `Studio ${n}`,
  logoUrl: null,
  href: `/blog/story-${n}`,
  ...extra,
});

describe("customer stories on the homepage", () => {
  it.each(LOCALES)("%s: three stories, the view-all link, bylines and logo tiles", (locale) => {
    const t = CUSTOMER_STORIES_COPY[locale];
    const html = renderToStaticMarkup(
      createElement(CustomerStories, {
        locale,
        viewAllHref: `/${locale}/blog/category/customer-stories`,
        stories: [story(1), story(2, { name: "écho" }), story(3), story(4)],
      }),
    );
    expect(html).toContain(`>${t.eyebrow}</p>`);
    expect(html).toContain('id="repget-stories-heading"');
    expect(html).toContain(`href="/${locale}/blog/category/customer-stories"`);
    expect(html.match(/<article/g)).toHaveLength(3);
    expect(html).not.toContain("Studio 4");
    expect(html).toContain(`href="/blog/story-1"`);
    expect(html).toContain(`Studio 1 <b>·</b> ${t.byline}`);
    // No logo: the business's initial.
    expect(html).toMatch(/>É<\/span>/);
  });

  it("is absent without stories", () => {
    expect(renderToStaticMarkup(createElement(CustomerStories, { locale: "en", viewAllHref: "/blog/category/customer-stories", stories: [] }))).toBe("");
  });
});

describe("a post's comments, signed out", () => {
  it("shows the design's gate with sign-in and sign-up returning to the post", () => {
    const copy = COMMENTS_COPY.en;
    const html = renderToStaticMarkup(
      createElement(BlogEngagement, {
        postId: "00000000-0000-4000-8000-000000000001",
        locale: "en",
        copy,
        path: "/blog/ai-qr-code",
        initial: { postId: "00000000-0000-4000-8000-000000000001", upvotes: 4, upvoted: false, signedIn: false, comments: [] },
      }),
    );
    expect(html).toContain(">Comments</h2>");
    expect(html).toContain("0 shown");
    expect(html).toContain("Sign in to leave a comment.");
    expect(html).toContain(`href="/sign-in?next=${encodeURIComponent("/blog/ai-qr-code#comments")}"`);
    expect(html).toContain(`href="/sign-up?next=${encodeURIComponent("/blog/ai-qr-code#comments")}"`);
    expect(html).toContain('aria-pressed="false"');
    expect(html).toContain(">4</span>");
    expect(html).toContain(copy.empty);
    expect(html).not.toContain("<textarea");
  });

  it("shows comments as plain text, escaped", () => {
    const html = renderToStaticMarkup(
      createElement(BlogEngagement, {
        postId: "p",
        locale: "en",
        copy: COMMENTS_COPY.en,
        path: "/blog/x",
        initial: {
          postId: "p",
          upvotes: 0,
          upvoted: false,
          signedIn: true,
          comments: [{ id: "c1", authorName: "", createdAt: "2026-11-11T10:00:00.000Z", body: "<script>alert(1)</script> https://x.test", upvotes: 2, upvoted: true, own: true }],
        },
      }),
    );
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt; https://x.test");
    expect(html).not.toContain('href="https://x.test"');
    expect(html).toContain("RepGet member");
    expect(html).toContain("<textarea");
    expect(html).toContain(">Delete</button>");
  });
});
