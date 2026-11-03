import { createElement, type ComponentProps, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { LOCALES } from "@/lib/i18n/config";
import { getMessages } from "@/lib/i18n/messages";

/**
 * The Opportunities page's first render (client's design, 2026-11-03): the
 * channels strip, the tabs with their counts, the next post RepGet
 * publishes, a failed post with its reason, and a trial's locked platforms -
 * in every language, with no placeholder left unfilled. What a click does is
 * covered by the actions' tests (lib/social/social.test.ts).
 */

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }) }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode; [key: string]: unknown }) =>
    createElement("a", { href, ...rest }, children),
}));
vi.mock("@/lib/social/actions", () => ({
  connectSocialUsername: vi.fn(),
  disconnectSocial: vi.fn(),
  editScheduledPost: vi.fn(),
  findSocialSuggestions: vi.fn(),
  postScheduledNow: vi.fn(),
  postSocialSuggestion: vi.fn(),
  saveSocialDraft: vi.fn(),
  setPinterestBoard: vi.fn(),
  setSocialAutoPost: vi.fn(),
  skipSocialSuggestion: vi.fn(),
  startSocialConnect: vi.fn(),
}));

import type { SuggestionView } from "./opportunities";
import { SocialPanel } from "./social-panel";

let n = 0;
const row = (over: Partial<SuggestionView> = {}): SuggestionView => ({
  id: `s${(n += 1)}`,
  platform: "quora",
  kind: "reply",
  status: "new",
  threadUrl: "https://www.quora.com/How-do-I-choose-a-wedding-photographer",
  threadTitle: "How do I choose a wedding photographer?",
  threadSnippet: "Looking for tips.",
  title: null,
  body: "Ask to see one full wedding, not a highlight reel.",
  warmup: false,
  imageUrl: null,
  scheduledFor: null,
  postedAt: null,
  postedUrl: null,
  error: null,
  createdAt: new Date(Date.now() - 3_600_000).toISOString(),
  ...over,
});

type Props = ComponentProps<typeof SocialPanel>;

function render(over: Partial<Props> = {}, locale: (typeof LOCALES)[number] = "en") {
  const props: Props = {
    websiteId: "w1",
    canEdit: true,
    level: "paid",
    platforms: ["reddit", "quora", "x", "threads", "pinterest", "bluesky"],
    bundle: true,
    accounts: [
      { platform: "quora", username: "jane", connected: false, autoPost: false, warmupEndsAt: "2026-10-01T00:00:00Z", inWarmup: false, pausedReason: null, target: null },
      { platform: "x", username: "jane_x", connected: true, autoPost: true, warmupEndsAt: "2026-10-01T00:00:00Z", inWarmup: false, pausedReason: "rate limited", target: null },
    ],
    open: [
      row(),
      row({ status: "draft", body: "My own words." }),
      row({ platform: "x", kind: "post", status: "scheduled", threadUrl: null, threadTitle: null, body: "Shade beats golden hour.", scheduledFor: "2030-01-07T14:23:00Z" }),
      row({ platform: "x", kind: "post", status: "failed", threadUrl: null, threadTitle: null, body: "Refused one.", error: "duplicate content" }),
    ],
    posted: [row({ status: "posted", postedAt: new Date().toISOString(), postedUrl: "https://www.quora.com/answer/1" })],
    todayCount: 4,
    perDay: 10,
    priceLabel: "1 credit",
    boards: [],
    notice: null,
    locale,
    t: getMessages(locale).app.social,
    ...over,
  };
  return renderToStaticMarkup(createElement(SocialPanel, props));
}

describe("the Opportunities page", () => {
  it("shows the channels, the tabs with their counts and an accessible tablist", () => {
    const html = render();
    expect(html).toContain("2 of 6 channels active");
    expect(html).toContain('role="tablist"');
    expect(html).toContain('aria-label="Stage"');
    expect(html.match(/role="tab"/g)).toHaveLength(5);
    // All 5 (the failed one too), Suggested 1, Scheduled 1, Drafts 1, Published 1.
    expect(html).toMatch(/All<span[^>]*>5<\/span>/);
    expect(html).toMatch(/Drafts<span[^>]*>1<\/span>/);
    expect(html).toContain('aria-label="X: automatic posting paused"');
  });

  it("puts the next scheduled post on top, with what can be done to it", () => {
    const html = render();
    expect(html).toContain("Next to publish");
    expect(html).toContain("Your post on X");
    expect(html).toContain("Publish now");
  });

  it("shows a failed post's reason and a retry, and a paused account without opening Manage", () => {
    const html = render();
    expect(html).toContain("Not published: duplicate content");
    expect(html).toContain(">Retry<");
    expect(html).toContain("Automatic posting is paused: X refused a post (rate limited)");
  });

  it("shows a trial's other platforms as locked", () => {
    const html = render({ level: "trial", platforms: ["quora"] });
    expect(html).toContain('aria-label="Reddit: included once your plan starts"');
    expect(html).toContain("1 of 6 channels active");
  });

  it("gives a viewer nothing to post, skip or find", () => {
    const html = render({ canEdit: false });
    expect(html).not.toContain("Find suggestions");
    expect(html).not.toContain("Publish now");
    expect(html).not.toContain("Resume");
  });

  it("asks a new website to connect an account", () => {
    const html = render({ accounts: [], open: [], posted: [] });
    expect(html).toContain("Connect an account and RepGet writes your first suggestions.");
    expect(html).toContain("Connect accounts");
  });

  it.each(LOCALES)("leaves no placeholder unfilled in %s", (locale) => {
    const html = render({}, locale);
    expect(html).not.toMatch(/\{(count|total|platform|state|price|time|max|reason|name|date)\}/);
  });
});
