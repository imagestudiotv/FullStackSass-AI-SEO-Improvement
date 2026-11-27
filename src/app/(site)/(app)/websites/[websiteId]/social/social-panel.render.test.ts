import { createElement, type ComponentProps, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { LOCALES } from "@/lib/i18n/config";
import { getMessages } from "@/lib/i18n/messages";
import { OPPORTUNITIES_COPY } from "@/lib/i18n/opportunities";
import { SOCIAL_CONNECTIONS_COPY } from "@/lib/i18n/social-connections";

/**
 * The Opportunities page's first render (client's design, 2026-11-03): the
 * "Social connections" panel (client's design, 2026-11-11), the tabs with
 * their counts, the next post RepGet publishes, one row per platform with a
 * button on each opportunity (Daniel, 2026-11-24), no provider error anywhere,
 * and a trial's locked platforms - in every language, with no placeholder left
 * unfilled. What a click does is covered by the actions'
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
  link: null,
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
    platforms: ["reddit", "quora", "x", "threads", "pinterest", "bluesky", "linkedin"],
    bundle: true,
    accounts: [
      { platform: "quora", username: "jane", connected: false, autoPost: false, warmupEndsAt: "2026-10-01T00:00:00Z", inWarmup: false, paused: false, target: null },
      { platform: "x", username: "jane_x", connected: true, autoPost: true, warmupEndsAt: "2026-10-01T00:00:00Z", inWarmup: false, paused: true, target: null },
    ],
    open: [
      row(),
      row({ status: "draft", body: "My own words." }),
      row({ platform: "x", kind: "post", status: "scheduled", threadUrl: null, threadTitle: null, body: "Shade beats golden hour.", scheduledFor: "2030-01-07T14:23:00Z" }),
      row({ platform: "x", kind: "post", status: "failed", threadUrl: null, threadTitle: null, body: "Refused one.", error: "not_enough_credits" }),
    ],
    posted: [row({ status: "posted", postedAt: new Date().toISOString(), postedUrl: "https://www.quora.com/answer/1" })],
    analysed: true,
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
  it("counts the connected accounts and shows the seven platforms, connected or ready to connect", () => {
    const html = render();
    expect(html).toContain("Social connections");
    expect(html).toContain("Suggestions work without an account. Connect a channel and RepGet can publish your own posts there.");
    expect(html).toContain("2 of 7 connected");
    expect(html).toMatch(/width:28\.57\d*%/);
    expect(html).toContain('id="social-connections"');
    for (const name of ["Reddit", "Quora", "X (Twitter)", "Threads", "Pinterest", "Bluesky", "LinkedIn"]) card(html, name);
    // LinkedIn: own posts only, and why there are no conversations.
    const linkedin = card(html, "LinkedIn");
    expect(linkedin).toContain("Own posts only");
    expect(linkedin).toContain("LinkedIn does not let apps find or answer other people&#x27;s posts");

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

    expect(html).toContain("Disconnecting stops automatic publishing on that channel.");
    expect(html).toContain("Account settings</button>");
    expect(html).not.toContain("Demo:");
    expect(html).not.toContain("Manage");
  });

  it("shows a trial's other platforms as locked: the lock's words and a Connect that cannot be clicked", () => {
    const html = render({ level: "trial", platforms: ["quora"] });
    expect(html).toContain("1 of 7 connected");
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
    expect(html).toContain("0 of 7 connected");
    expect(html).not.toContain("Account settings");
    expect(html.match(/>Connect<\/button>/g)).toHaveLength(7);
  });

  it("is read-only for a viewer: the states, no Connect or Disconnect", () => {
    const html = render({ canEdit: false });
    expect(html).toContain("2 of 7 connected");
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

  it("says nothing about a pause or a provider's error, and what to do about credits", () => {
    const html = render();
    expect(html).not.toMatch(/Automatic posting is paused|Resume|Not published:(?! not enough credits)|bundle\.social/);
    expect(html).toContain("Not published: not enough credits.");
  });

  it("gives a viewer nothing to post, skip or find", () => {
    const html = render({ canEdit: false });
    expect(html).not.toContain("Find suggestions");
    expect(html).not.toContain("Publish now");
    expect(html).not.toContain("Resume");
    expect(html).not.toContain("Create on");
    // The discussion itself can be opened; nothing is copied, posted or charged.
    expect(html).toMatch(/<a [^>]*href="https:\/\/www\.quora\.com\/How-do-I-choose-a-wedding-photographer"[^>]*>Open on Quora/);
  });

  it("lists every platform in one row: its name, count, connection, new and total, closed at first", () => {
    const html = render();
    expect(html).toContain("Showing 5 of 5 opportunities across 7 platforms");
    const groups = [...html.matchAll(/<li[^>]*data-platform="(\w+)"[\s\S]*?<h3><button[^>]*aria-expanded="(\w+)"[^>]*aria-controls="([^"]+)"[^>]*>([\s\S]*?)<\/button><\/h3>/g)];
    expect(groups.map(([, platform]) => platform)).toEqual(["reddit", "quora", "x", "threads", "pinterest", "bluesky", "linkedin"]);
    expect(groups.every(([, , expanded]) => expanded === "false")).toBe(true);
    const text = (platform: string) => groups.find(([, name]) => name === platform)![4].replace(/<svg[\s\S]*?<\/svg>/g, "").replace(/<[^>]+>/g, "|").replace(/\|+/g, "|");
    expect(text("quora")).toBe("|Quora|3 opportunities · Connected|1 new|3 total|");
    expect(text("x")).toBe("|X (Twitter)|2 opportunities · Connected|2 total|");
    expect(text("threads")).toBe("|Threads|0 opportunities · Not connected|0 total|");
    // The Bluesky mark is drawn (it was broken in the client's screenshot).
    expect(groups.find(([, name]) => name === "bluesky")![4]).toMatch(/<svg[\s\S]*<path/);
    for (const [, , , id] of groups) expect(html).toContain(`<div id="${id}" hidden=""`);
  });

  it("puts a button that opens the real place on every opportunity, with its price", () => {
    const html = render({
      accounts: [],
      open: [
        row({ platform: "reddit", threadUrl: "https://www.reddit.com/r/SaaS/comments/abc123/zero/", threadTitle: "We launched and got zero traffic" }),
        row({ platform: "reddit", kind: "post", threadUrl: null, threadTitle: null, threadSnippet: null, title: "What is one fix?", body: "Ask them." }),
        row({ platform: "reddit", kind: "post", status: "draft", threadUrl: null, threadTitle: null, title: "Kept", body: "Kept." }),
        row({ platform: "x", kind: "post", status: "scheduled", threadUrl: null, threadTitle: null, body: "Scheduled one.", scheduledFor: "2030-01-07T14:23:00Z" }),
        row({ platform: "x", kind: "post", status: "failed", threadUrl: null, threadTitle: null, body: "No credits.", error: "not_enough_credits" }),
        row({ platform: "x", kind: "post", status: "posting", threadUrl: null, threadTitle: null, body: "On its way." }),
      ],
      posted: [],
    });
    expect(html.match(/>Open on Reddit<span[^>]*>· 1 credit<\/span>/g)).toHaveLength(1);
    expect(html.match(/>Create on Reddit<span[^>]*>· 1 credit<\/span>/g)).toHaveLength(2);
    // Not the one RepGet is handing over right now: it would go out twice.
    expect(html.match(/>Create on X<span/g)).toHaveLength(2);
    expect(html).toContain("Copies the text, opens Reddit and counts as posted. Costs 1 credit.");
    expect(html).toContain("RepGet will then not publish it.");
    expect(html).toContain(">Conversation</span>");
    expect(html).toContain(">Suggested post</span>");
    // The discussion is also one free click away.
    expect(html).toContain('href="https://www.reddit.com/r/SaaS/comments/abc123/"');
    expect(html).toContain("r/SaaS");
  });

  it("shows no price on the buttons where posts are free", () => {
    const html = render({ priceLabel: getMessages("en").app.social.free });
    expect(html).toContain("Open on Quora<svg");
    expect(html).not.toContain("· Free</span>");
  });

  it("needs no account: a new website is told so, with Find suggestions first and Connect as an option", () => {
    const html = render({ accounts: [], open: [], posted: [] });
    expect(html).toContain("RepGet writes your first suggestions from your website&#x27;s information.");
    expect(html).toContain("No account is needed");
    expect(html).toContain('href="#social-connections"');
    expect(html).toContain("Connect accounts (optional)");
    expect(html.match(/Find suggestions/g)!.length).toBe(2);
  });

  it("waits for the website's analysis, plainly", () => {
    const html = render({ accounts: [], open: [], posted: [], analysed: false });
    expect(html).toContain("Suggestions start when your website&#x27;s analysis is finished.");
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>(?:(?!<\/button>).)*Find suggestions/);
    expect(html).not.toContain("No account is needed");
  });

  it.each(LOCALES)("has the page's own words in %s", (locale) => {
    const html = render({}, locale);
    const copy = OPPORTUNITIES_COPY[locale];
    for (const text of [copy.intro, copy.tagConversation, copy.tagPost, copy.openOn.replace("{platform}", "Quora"), copy.createOn.replace("{platform}", "X")]) {
      expect(html).toContain(text.replace(/'/g, "&#x27;"));
    }
    for (const value of Object.values(copy)) expect(value).not.toMatch(/[\u2013\u2014]/);
  });

  it.each(LOCALES)("leaves no placeholder unfilled in %s", (locale) => {
    const html = render({}, locale);
    expect(html).not.toMatch(/\{(count|total|shown|platforms|platform|where|state|price|time|max|reason|name|date)\}/);
  });
});

describe("the Free plan's allowance under the list (8 social posts a month, a hard limit)", () => {
  const amp = (s: string) => s.replace(/&/g, "&amp;").replace(/'/g, "&#x27;");

  it.each(LOCALES)("%s: shows the month's posts against 8, with the day's drafts while the month has drafts left", (locale) => {
    const t = getMessages(locale).app.social;
    const month = t.freeMonthPosts.replace("{count}", "3").replace("{max}", "8");
    const today = t.todayCount.replace("{count}", "4").replace("{max}", "10");
    const html = render({ freeMonth: { posts: 3, postsMax: 8, draftsLeft: 5 }, priceLabel: t.free }, locale);
    expect(html).toContain(amp(`${month} · ${today} · `));
    expect(html).not.toMatch(/\{(count|max)\}/);
  });

  it("drops the day's count once the month's drafts are used up, and the finder with it", () => {
    const t = getMessages("en").app.social;
    const html = render({ freeMonth: { posts: 8, postsMax: 8, draftsLeft: 0 }, priceLabel: t.free });
    expect(html).toContain("8 of 8 posts this month · Each post or reply costs");
    expect(html).not.toContain("4 of 10 today");
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>(?:(?!<\/button>).)*Find suggestions/);
  });

  it("leaves a paid plan's line as it was: the day's count and the price", () => {
    const html = render();
    expect(html).toContain("4 of 10 today · Each post or reply costs 1 credit.");
    expect(html).not.toContain("this month");
  });
});

describe("LinkedIn and natural replies on the page", () => {
  it("hides LinkedIn everywhere while bundle.social is not set up", () => {
    const html = render({ bundle: false, platforms: ["reddit", "quora", "x", "threads", "pinterest", "bluesky"] });
    expect(html).toContain("2 of 6 connected");
    expect(html).not.toContain("LinkedIn");
    expect(html).not.toContain('data-platform="linkedin"');
  });

  it("marks a reply in a community that removes self-promotion", () => {
    const html = render({
      open: [row({ platform: "reddit", threadUrl: "https://www.reddit.com/r/smallbusiness/comments/abc123/x/", threadTitle: "Tips?" })],
      posted: [],
    });
    expect(html).toContain("No self-promotion");
  });

  it.each(LOCALES)("has the new words in %s", (locale) => {
    const copy = OPPORTUNITIES_COPY[locale];
    for (const text of [copy.replyNatural, copy.communityRules, copy.communityStrict, copy.communityStrictShort, copy.linkedinNote, copy.linkedinCard]) {
      expect(text.trim().length).toBeGreaterThan(0);
    }
    expect(copy.communityRules).toContain("{community}");
    expect(copy.communityStrict).toContain("{community}");
    expect(getMessages(locale).app.social.errors.mention_not_allowed.length).toBeGreaterThan(20);
  });
});
