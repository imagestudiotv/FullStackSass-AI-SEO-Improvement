import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { COMMENTS_COPY } from "@/lib/i18n/blog-engagement";
import { LOCALES } from "@/lib/i18n/config";
import { DISCOVER_COPY } from "@/lib/i18n/discover";
import type { DiscoverProfile } from "@/lib/discover/profiles";

/**
 * The customer directory and a business's profile (client's designs,
 * 2026-11-11 round 2) as each language renders them: the directory's rows,
 * counts, filters, pending website and empty state; the profile's sections,
 * real figures, the signed-out comment box returning to the profile, the
 * design's placeholder without a picture, and none of the designs' demo text.
 */

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode; [key: string]: unknown }) =>
    createElement("a", { href, ...rest, prefetch: undefined }, children),
}));
vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => createElement("img", { src, alt }),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/lib/db", () => ({ db: {}, isDatabaseConfigured: () => false }));
vi.mock("@/lib/blog/engagement-actions", () => ({
  loadPostEngagement: vi.fn(),
  togglePostUpvote: vi.fn(),
  toggleCommentUpvote: vi.fn(),
  postComment: vi.fn(),
  deleteMyComment: vi.fn(),
}));
vi.mock("@/lib/discover/actions", () => ({
  recordDiscoverView: vi.fn(),
  loadDiscoverViewer: vi.fn(),
  loadUpvotesThisWeek: vi.fn(),
}));

import { DiscoverDirectory, type DirectoryEntry } from "./discover-directory";
import { ProfileView } from "./[slug]/profile-view";

beforeAll(() => {
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://www.repget.com");
});

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;").replace(/</g, "&lt;");

const entry = (n: number, extra: Partial<DirectoryEntry> = {}): DirectoryEntry => ({
  postId: `00000000-0000-4000-8000-00000000000${n}`,
  slug: `business-${n}`,
  name: `Business ${n}`,
  tagline: `Tagline ${n}`,
  category: n % 2 ? "Creative" : "Travel",
  logoUrl: null,
  websiteUrl: `https://business${n}.example/`,
  upvotes: 10 - n,
  comments: n,
  views: 100 + n,
  publishedAt: `2026-11-0${n}T00:00:00.000Z`,
  ...extra,
});

describe("the directory", () => {
  it.each(LOCALES)("%s: the design's heading, filters, rows and links", (locale) => {
    const t = DISCOVER_COPY[locale].directory;
    const prefix = locale === "en" ? "" : `/${locale}`;
    const html = renderToStaticMarkup(
      createElement(DiscoverDirectory, {
        locale,
        copy: t,
        entries: [entry(1, { name: "Image Studio" }), entry(2, { websiteUrl: null, logoUrl: "https://store.example/logo.png" })],
      }),
    );
    expect(html).toContain(`${esc(t.eyebrow)}</p>`);
    expect(html).toContain(`>${t.titleBrand}</span>`);
    // All, then the categories that have a business.
    expect(html).toMatch(new RegExp(`aria-pressed="true">${t.all}</button>.*>Creative</button>.*>Travel</button>`));
    expect(html).toContain(esc(t.countOther.replace("{n}", "2")));
    expect(html.match(/<article/g)).toHaveLength(2);
    expect(html).toContain(`href="${prefix}/discover/business-1"`);
    expect(html).toContain(`href="${prefix}/discover/business-1#comments"`);
    // Monogram without a logo; the logo with one.
    expect(html).toMatch(/aria-hidden="true">IS<\/span>/);
    expect(html).toContain('src="https://store.example/logo.png"');
    // Views, comments and upvotes are the real counts.
    expect(html).toContain("<span aria-hidden=\"true\">101</span>");
    expect(html).toContain('<span>9</span>');
    // Visit: a new tab, never the opener; the pending state without a website.
    expect(html).toContain('href="https://business1.example/" target="_blank" rel="noopener noreferrer"');
    expect(html).toContain(`title="${esc(t.visitPending)}"`);
    expect(html).toContain(`href="${prefix}/pricing"`);
    expect(html).not.toMatch(/demo/i);
  });

  it("ranks by upvotes, then newest, and says when nothing is listed", () => {
    const t = DISCOVER_COPY.en.directory;
    const html = renderToStaticMarkup(
      createElement(DiscoverDirectory, { locale: "en", copy: t, entries: [entry(3, { upvotes: 1 }), entry(1, { upvotes: 5 }), entry(2, { upvotes: 5 })] }),
    );
    expect(html.indexOf("Business 2")).toBeLessThan(html.indexOf("Business 1"));
    expect(html.indexOf("Business 1")).toBeLessThan(html.indexOf("Business 3"));

    const one = renderToStaticMarkup(createElement(DiscoverDirectory, { locale: "en", copy: t, entries: [entry(1)] }));
    expect(one).toContain("1 business<");
    const none = renderToStaticMarkup(createElement(DiscoverDirectory, { locale: "en", copy: t, entries: [] }));
    expect(none).toContain("<strong>No businesses found</strong>Try another search or category.");
    expect(none).toContain("0 businesses");
  });
});

const profile = (extra: Partial<DiscoverProfile> = {}): DiscoverProfile => ({
  postId: "00000000-0000-4000-8000-000000000001",
  slug: "image-studio",
  locale: "en",
  name: "Image Studio",
  tagline: "World-class photography and film production.",
  category: "Creative",
  logoUrl: null,
  websiteUrl: "https://imagestudio.com/",
  upvotes: 222,
  comments: 0,
  views: 5000,
  publishedAt: "2026-11-01T00:00:00.000Z",
  tags: ["Creative Production", "Photography", "Film & Video"],
  location: "Rome & Milan, Italy",
  availability: "Worldwide",
  about: ["First paragraph.", "Second paragraph."],
  audience: ["Couples planning destination weddings."],
  services: ["Destination wedding photography", "Editorial photography"],
  industry: "Photography, film and creative production",
  imageUrl: null,
  imageAlt: null,
  description: "How Image Studio grew.",
  storyHref: "/blog/image-studio-story",
  upvotesWeek: 12,
  impressionsWeek: 2000,
  locales: ["en"],
  ...extra,
});

describe("a business's profile", () => {
  it.each(LOCALES)("%s: the design's sections, real figures and the signed-out comment box", (locale) => {
    const t = DISCOVER_COPY[locale].profile;
    const prefix = locale === "en" ? "" : `/${locale}`;
    const html = renderToStaticMarkup(createElement(ProfileView, { profile: profile({ locale }), locale, initial: null }));
    expect(html).toContain(`href="${prefix}/discover">${esc(t.businesses)}</a>`);
    expect(html).toContain(`>Photography</span>`);
    expect(html).toContain(`>${esc(t.featured)}</span>`);
    expect(html).toContain("<h1");
    expect(html).toContain(">Image Studio</h1>");
    expect(html).toMatch(/role="img"[^>]*>IS<\/div>/);
    expect(html).toContain('href="https://imagestudio.com/" target="_blank" rel="noopener noreferrer">imagestudio.com');
    expect(html).toContain(`${esc(t.visitWebsite)} `);
    expect(html).toContain("<span>222</span>");
    expect(html).toContain(`<span>${esc(t.copyLink)}</span>`);
    // The week's figures, as the design writes them.
    expect(html).toContain(">12</strong>");
    expect(html).toContain(locale === "en" ? ">2k</strong>" : "</strong>");
    for (const heading of [t.about, t.audience, t.services, t.details, t.growth, t.commentsTitle]) expect(html).toContain(`>${esc(heading)}</h2>`);
    expect(html).toContain(">Destination wedding photography</li>");
    expect(html).toContain(`<dt>${esc(t.basedIn)}</dt><dd>Rome &amp; Milan, Italy</dd>`);
    expect(html).toContain('href="/blog/image-studio-story"');
    // Signed out: the design's box, returning to this profile's comments.
    expect(html).toContain('id="comments"');
    expect(html).toContain(`<strong>${esc(t.joinTitle)}</strong>`);
    expect(html).toContain(`href="/sign-in?next=${encodeURIComponent(`${prefix}/discover/image-studio#comments`)}"`);
    expect(html).toContain(`href="/sign-up?next=${encodeURIComponent(`${prefix}/discover/image-studio#comments`)}"`);
    expect(html).toContain(esc(t.noComments));
    expect(html).toContain(`href="${prefix}/pricing">${esc(t.featureLink)}</a>`);
    // The design's placeholder without a picture.
    expect(html).toMatch(/<strong>Image Studio<\/strong><span>Creative Production · Photography · Film &amp; Video<\/span>/);
    expect(html).toContain('"@type":"ProfilePage"');
    expect(html).not.toMatch(/design preview|demo/i);
  });

  it("shows the story's picture, and the pending states without a website or optional sections", () => {
    const t = DISCOVER_COPY.en.profile;
    const html = renderToStaticMarkup(
      createElement(ProfileView, {
        profile: profile({ websiteUrl: null, imageUrl: "https://store.example/cover.webp", imageAlt: "A staircase", audience: [], services: [], location: null }),
        locale: "en",
        initial: null,
      }),
    );
    expect(html).toContain('src="https://store.example/cover.webp" alt="A staircase"');
    expect(html).toContain(`>${t.websitePending}</span>`);
    expect(html).not.toContain(`>${esc(t.audience)}</h2>`);
    expect(html).not.toContain(`>${t.services}</h2>`);
    expect(html).not.toContain(`<dt>${t.basedIn}</dt>`);
    expect(html).not.toContain("imagestudio.com");
  });

  it("a fallback page copies the English profile's address", () => {
    const html = renderToStaticMarkup(createElement(ProfileView, { profile: profile({ locale: "en" }), locale: "it", initial: null }));
    expect(html).toContain('"url":"https://www.repget.com/discover/image-studio"');
    expect(html).toContain(`>${DISCOVER_COPY.it.profile.commentsTitle}</h2>`);
    expect(COMMENTS_COPY.it.post).toBeTruthy();
  });
});
