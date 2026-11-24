import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { LOCALES } from "@/lib/i18n/config";
import { VIDEOS_COPY } from "@/lib/i18n/videos";

/**
 * Saved Videos and Posted as first drawn (Daniel, 2026-11-24): every card's
 * buttons straight under its title and status, Delete and Select for those
 * who may edit, nothing about a failure, and no placeholder left unfilled in
 * any language.
 */

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }) }));
vi.mock("@/lib/video/actions", () => ({ prepareVideoUpload: vi.fn() }));
vi.mock("@/lib/video/library-actions", () => ({ deleteVideoIdeas: vi.fn(), saveYoutubeTags: vi.fn() }));
vi.mock("@/lib/video/publish-actions", () => ({ connectVideoPlatform: vi.fn(), searchInstagramAudio: vi.fn(), setNativeAudio: vi.fn(), unscheduleVideoIdea: vi.fn() }));
vi.mock("./preview", () => ({ reelFrames: () => 300 }));

import { MadeList } from "./made-list";
import { PostedList } from "./posted-list";
import type { IdeaView } from "./shared";

let n = 0;
const view = (over: Partial<IdeaView> = {}): IdeaView => {
  n += 1;
  return {
    id: `idea-${n}`,
    deckKey: `idea-${n}`,
    returned: false,
    format: "reel",
    title: `Video ${n}`,
    caption: "Text",
    status: "ready",
    props: { script: { hook: "h", points: [], proof: "", cta: "" } },
    videoUrl: "https://x.example/storage/v1/object/public/video-files/v.mp4",
    slideUrls: [],
    coverUrl: "https://x.example/c.jpg",
    platforms: [],
    scheduledFor: null,
    postedAt: null,
    postedUrls: {},
    stats: {},
    views: 0,
    error: null,
    youtubeTags: null,
    destinations: {},
    nativeAudio: null,
    ...over,
  } as unknown as IdeaView;
};

const made = (locale: (typeof LOCALES)[number], ideas: IdeaView[], canEdit = true) =>
  renderToStaticMarkup(
    createElement(MadeList, {
      websiteId: "w",
      canEdit,
      made: ideas,
      accounts: [],
      bundle: false,
      settings: {},
      publishing: { x: { available: false, reason: "disabled" }, instagramAudio: { available: false, reason: "not_configured" }, linkedin: { connected: false, target: null } },
      priceLabel: "1 credit",
      run: vi.fn(),
      pending: false,
      onPublish: vi.fn(),
      locale,
      t: VIDEOS_COPY[locale],
    } as unknown as ComponentProps<typeof MadeList>),
  );
const posted = (locale: (typeof LOCALES)[number], ideas: IdeaView[], canEdit = true) =>
  renderToStaticMarkup(
    createElement(PostedList, { websiteId: "w", canEdit, posted: ideas, run: vi.fn(), pending: false, onPublish: vi.fn(), locale, t: VIDEOS_COPY[locale], onTab: vi.fn() } as ComponentProps<typeof PostedList>),
  );

describe("the lists", () => {
  it.each(LOCALES)("are whole in %s, with nothing left unfilled", (locale) => {
    const html = made(locale, [view(), view({ status: "making", videoUrl: null })]) + posted(locale, [view({ status: "posted", postedAt: "2026-11-24T10:00:00Z" }), view({ status: "scheduled", scheduledFor: "2026-11-25T10:00:00Z" })]);
    expect(html).not.toMatch(/\{[a-z]+\}|undefined/i);
    const r = VIDEOS_COPY[locale].flow.library.remove;
    expect(html).toContain(r.select);
    expect(html).toContain(r.button);
  });

  it("lay every card's picture over its 4:5 frame, so a tall reel cannot stretch one card past the others", () => {
    const html = made("en", [view(), view({ coverUrl: "https://x.test/cover.jpg" }), view({ format: "carousel", videoUrl: null, slideUrls: ["https://x.test/1.png"] })]);
    const cards = html.split("<article").slice(1);
    expect(cards).toHaveLength(3);
    for (const card of cards) {
      expect(card).toContain("aspect-[4/5]");
      expect(card.match(/<(?:img|video)[^>]*>/)?.[0]).toContain("absolute inset-0");
    }
  });

  it("keep each card's buttons in one order at its end, after whatever else it says", () => {
    const html = made("en", [view(), view({ destinations: { instagram: { status: "scheduled", bundlePostId: null, url: null, error: null, attempts: 0 } } })]);
    const cards = html.split("<article").slice(1);
    const order = (card: string) => ["<h3", "Ready to publish", "Preview", "Download", "Publish</button>", "Delete"].map((part) => card.indexOf(part));
    for (const card of cards) {
      const at = order(card);
      expect(at.every((value) => value >= 0)).toBe(true);
      expect([...at].sort((a, b) => a - b)).toEqual(at);
    }
    expect(cards[1].indexOf("Scheduled")).toBeGreaterThan(0);
    expect(cards[1].indexOf("Scheduled")).toBeLessThan(cards[1].indexOf("Preview"));
    for (const card of cards) expect(card).toMatch(/class="mt-auto grid grid-cols-2/);
    expect(cards[0]).toContain("v.mp4?download=video-");
  });

  it("offer no deleting to a viewer", () => {
    const html = made("en", [view()], false) + posted("en", [view({ status: "posted" })], false);
    expect(html).not.toContain("Delete");
    expect(html).not.toContain("Select");
  });

  it("list only the platforms a video reached", () => {
    const html = posted("en", [
      view({ status: "posted", platforms: ["instagram", "tiktok"], postedUrls: { instagram: "https://i.example/1" }, destinations: { instagram: { status: "posted", bundlePostId: "p", url: "https://i.example/1", error: null, attempts: 1 } } }),
    ]);
    expect(html).toContain("Instagram");
    expect(html).not.toContain("TikTok");
  });
});
