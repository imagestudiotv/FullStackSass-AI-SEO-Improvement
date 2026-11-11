import { createElement, type ComponentProps, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { LOCALES } from "@/lib/i18n/config";
import { getMessages } from "@/lib/i18n/messages";
import { SOCIAL_CONNECTIONS_COPY } from "@/lib/i18n/social-connections";

/**
 * The Opportunities page's first render (client's design, 2026-11-03): the
 * "Social connections" panel (client's design, 2026-11-11), the tabs with
 * their counts, the next post RepGet publishes, a failed post with its
 * reason, and a trial's locked platforms - in every language, with no
 * placeholder left unfilled. What a click does is covered by the actions'
 * tests (lib/social/social.test.ts).
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

/** One platform's card in the "Social connections" panel, found by the name it shows. */
function card(html: string, name: string): string {
  const start = html.indexOf(`>${name}</h3>`);
  if (start < 0) throw new Error(`no card for ${name}`);
  const open = html.lastIndexOf("<li", start);
  return html.slice(open, html.indexOf("</li>", start) + 5);
}

describe("the Social connections panel", () => {
  it("counts the connected accounts and shows the six platforms, connected or ready to connect", () => {
    const html = render();
    expect(html).toContain("Social connections");
    expect(html).toContain("Connect your channels to discover opportunities and manage your activity.");
    expect(html).toContain("2 of 6 connected");
    expect(html).toMatch(/width:33\.33\d*%/);
    expect(html).toContain('id="social-connections"');
    for (const name of ["Reddit", "Quora", "X (Twitter)", "Threads", "Pinterest", "Bluesky"]) card(html, name);

    // Quora by username, X through bundle.social: both linked, both one click from disconnecting.
    for (const name of ["Quora", "X (Twitter)"]) {
      const item = card(html, name);
      expect(item).toContain(">Connected<");
      expect(item).toContain("Account linked");
      expect(item).toContain(">Disconnect</button>");
    }
    const reddit = card(html, "Reddit");
    expect(reddit).toContain(">Not connected<");
    expect(reddit).toContain("Ready to connect");
    expect(reddit).toMatch(/<button[^>]*>Connect<\/button>/);
    expect(reddit).not.toContain("disabled");

    expect(html).toContain("Disconnecting stops future activity on that channel.");
    expect(html).toContain("Account settings</button>");
    expect(html).not.toContain("Demo:");
    expect(html).not.toContain("Manage");
  });

  it("shows a trial's other platforms as locked: the lock's words and a Connect that cannot be clicked", () => {
    const html = render({ level: "trial", platforms: ["quora"] });
    expect(html).toContain("1 of 6 connected");
    const reddit = card(html, "Reddit");
    expect(reddit).toContain("Included once your plan starts.");
    expect(reddit).toMatch(/<button[^>]*disabled=""[^>]*>Connect<\/button>/);
    // The X account a paid plan had connected is not usable on the trial.
    const x = card(html, "X (Twitter)");
    expect(x).toContain(">Not connected<");
    expect(x).toMatch(/<button[^>]*disabled=""[^>]*>Connect<\/button>/);
    expect(card(html, "Quora")).toContain(">Disconnect</button>");
  });

  it("offers no settings before an account is connected", () => {
    const html = render({ accounts: [], open: [], posted: [] });
    expect(html).toContain("0 of 6 connected");
    expect(html).not.toContain("Account settings");
    expect(html.match(/>Connect<\/button>/g)).toHaveLength(6);
  });

  it("is read-only for a viewer: the states, no Connect or Disconnect", () => {
    const html = render({ canEdit: false });
    expect(html).toContain("2 of 6 connected");
    expect(card(html, "Quora")).toContain("Account linked");
    expect(html).not.toContain(">Connect</button>");
    expect(html).not.toContain(">Disconnect</button>");
  });

  it.each(LOCALES)("is written in %s", (locale) => {
    const html = render({}, locale);
    const copy = SOCIAL_CONNECTIONS_COPY[locale];
    for (const text of [copy.eyebrow, copy.title, copy.sub, copy.connected, copy.notConnected, copy.linked, copy.ready, copy.hint, copy.settings]) {
      expect(html).toContain(text.replace(/'/g, "&#x27;"));
    }
  });
});

describe("the Opportunities page", () => {
  it("shows the tabs with their counts and an accessible tablist", () => {
    const html = render();
    expect(html).toContain('role="tablist"');
    expect(html).toContain('aria-label="Stage"');
    expect(html.match(/role="tab"/g)).toHaveLength(5);
    // All 5 (the failed one too), Suggested 1, Scheduled 1, Drafts 1, Published 1.
    expect(html).toMatch(/All<span[^>]*>5<\/span>/);
    expect(html).toMatch(/Drafts<span[^>]*>1<\/span>/);
  });

  it("puts the next scheduled post on top, with what can be done to it", () => {
    const html = render();
    expect(html).toContain("Next to publish");
    expect(html).toContain("Your post on X");
    expect(html).toContain("Publish now");
  });

  it("shows a failed post's reason and a retry, and a paused account without opening the settings", () => {
    const html = render();
    expect(html).toContain("Not published: duplicate content");
    expect(html).toContain(">Retry<");
    expect(html).toContain("Automatic posting is paused: X refused a post (rate limited)");
  });

  it("gives a viewer nothing to post, skip or find", () => {
    const html = render({ canEdit: false });
    expect(html).not.toContain("Find suggestions");
    expect(html).not.toContain("Publish now");
    expect(html).not.toContain("Resume");
  });

  it("asks a new website to connect an account, at the panel", () => {
    const html = render({ accounts: [], open: [], posted: [] });
    expect(html).toContain("Connect an account and RepGet writes your first suggestions.");
    expect(html).toContain('href="#social-connections"');
    expect(html).toContain("Connect accounts");
  });

  it.each(LOCALES)("leaves no placeholder unfilled in %s", (locale) => {
    const html = render({}, locale);
    expect(html).not.toMatch(/\{(count|total|platform|state|price|time|max|reason|name|date)\}/);
  });
});
