import { createElement, type ComponentProps, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { LOCALES } from "@/lib/i18n/config";
import { VIDEOS_COPY } from "@/lib/i18n/videos";

/**
 * The publishing window's copy buttons and Mark as posted answer in place
 * (Daniel, 2026-11-26: "When I click on copy, it's covering the other buttons
 * and I have to wait it disappear; the same happens when I click mark as
 * posted"): each has a polite live region beside it, and the window sends no
 * toast to sonner's bottom-right corner, where the foot is.
 */

const toast = vi.hoisted(() => Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), message: vi.fn() }));
vi.mock("sonner", () => ({ toast }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }) }));
// Radix draws a dialog in a portal, which a static render leaves out: plain elements show what it is given.
vi.mock("@/components/ui/dialog", () => {
  const plain = ({ children }: { children?: ReactNode }) => createElement("div", null, children);
  return { Dialog: plain, DialogContent: plain, DialogDescription: plain, DialogTitle: plain };
});
vi.mock("@/lib/video/library-actions", () => ({ saveYoutubeTags: vi.fn() }));
vi.mock("@/lib/video/publish-actions", () => ({ markVideoPosted: vi.fn(), publishVideoIdea: vi.fn(), unscheduleVideoIdea: vi.fn() }));
vi.mock("./preview", () => ({ reelFrames: () => 300 }));

import { PublishPopup } from "./publish-popup";
import type { IdeaView } from "./shared";

const idea = {
  id: "idea-1",
  deckKey: "idea-1",
  returned: false,
  format: "reel",
  title: "Three SEO mistakes",
  caption: "Fix them today #SEO",
  status: "ready",
  props: { brand: { name: "RepGet" }, script: { hook: "Your site is losing visitors", points: [{ title: "Slow pages" }], proof: "", cta: "" } },
  videoUrl: "https://x.example/storage/v1/object/public/video-files/v.mp4",
  slideUrls: [],
  coverUrl: null,
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
  production: { duration: "short" },
} as unknown as IdeaView;

const render = (locale: (typeof LOCALES)[number], view: IdeaView = idea) =>
  renderToStaticMarkup(
    createElement(PublishPopup, {
      idea: view,
      websiteId: "w",
      canEdit: true,
      accounts: [],
      bundle: false,
      settings: { platforms: [], priorityTopics: null },
      publishing: { x: { available: false, reason: "disabled" }, instagramAudio: { available: false, reason: "not_configured" }, linkedin: { connected: false, target: null } },
      priceLabel: "1 credit",
      run: vi.fn(),
      pending: false,
      locale,
      t: VIDEOS_COPY[locale],
      onClose: vi.fn(),
      onConnect: vi.fn(),
      onIdeas: vi.fn(),
    } as unknown as ComponentProps<typeof PublishPopup>),
  );

describe("the publishing window's feedback", () => {
  it.each(LOCALES)("is in each button, with a live region beside it, in %s", (locale) => {
    const html = render(locale);
    const p = VIDEOS_COPY[locale].flow.popup;
    expect(html).not.toMatch(/\{[a-z]+\}|undefined/i);
    // Copy title is not shown for every first tab; Copy text twice (above the text and in the foot), and Mark as posted.
    expect(html.split(`${p.copyText}</button>`).length - 1).toBe(2);
    expect(html).toContain(p.markPosted);
    // A polite region per copy button and one for Mark as posted, empty until something is done.
    const regions = html.match(/<span role="status" aria-live="polite" class="sr-only"><\/span>/g) ?? [];
    expect(regions.length).toBeGreaterThanOrEqual(3);
    expect(html).not.toContain(`>${p.copied}<`);
    expect(toast).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
  });
});

/**
 * A carousel is slides, never "your video" (client, 2026-11-26: "This is a
 * carousel but when I click approve it says create your video"): while it is
 * made and once it is, the window speaks of the carousel and its slides; a
 * reel keeps the video's words.
 */
describe("the publishing window's words for a carousel", () => {
  const making = { ...idea, status: "making", videoUrl: null, slideUrls: [] } as unknown as IdeaView;
  const carousel = { ...making, format: "carousel" } as unknown as IdeaView;

  it.each(LOCALES)("names the carousel and its slides while it is made, in %s", (locale) => {
    const p = VIDEOS_COPY[locale].flow.popup;
    const html = render(locale, carousel);
    expect(html).not.toMatch(/\{[a-z]+\}|undefined/i);
    for (const text of [p.carousel.making, p.carousel.makingBody, p.carousel.preview, p.carousel.download, p.carousel.manual, p.carousel.waitVideo]) expect(html).toContain(text);
    for (const text of [p.making, p.makingBody, p.preview, p.download, p.modes.manual.body, p.waitVideo]) expect(html).not.toContain(text);
  });

  it.each(LOCALES)("keeps the video's words for a reel, in %s", (locale) => {
    const p = VIDEOS_COPY[locale].flow.popup;
    const html = render(locale, making);
    for (const text of [p.making, p.preview, p.download, p.modes.manual.body]) expect(html).toContain(text);
    expect(html).not.toContain(p.carousel.making);
  });

  it("is the English the client reads", () => {
    const html = render("en", carousel);
    expect(html).toContain("Making your carousel…");
    expect(html).toContain("Download slides");
    expect(html).not.toContain("Making your video");
    expect(html).not.toContain("Download video");
  });
});
