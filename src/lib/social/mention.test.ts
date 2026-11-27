import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/ai/client", () => ({ anthropic: { messages: { create: vi.fn() } }, MODELS: { GENERATION: "claude-test" } }));

import {
  asksForRecommendations,
  communityOf,
  mayMention,
  mentionHistory,
  MENTION_EVERY,
  naturalise,
  soundsPromotional,
} from "./mention";
import { availablePlatforms, composeUrl, PLATFORMS, SOCIAL_PLATFORMS } from "./platforms";
import { socialSystemPrompt } from "./write";

/**
 * When a reply may name the business (Daniel, 2026-11-27: "Generated Reddit
 * replies are promotional... Reddit bans fast"): never by default, and only
 * where the thread asks, the community allows it and the platform's one in
 * ten leaves room.
 */

const brand = { brandName: "Image Studio", domain: "imagestudio.io" };
const NOW = new Date("2026-11-27T07:00:00Z");
const DAY = 24 * 60 * 60 * 1000;

describe("a discussion that asks for recommendations", () => {
  it.each([
    "Can anyone recommend a wedding photographer in Dublin?",
    "Which tools do you use for scheduling posts?",
    "Any good agencies for a small shop's SEO?",
    "Looking for an alternative to Canva",
    "¿Qué herramienta recomiendan para facturar?",
    "Quel outil utilisez-vous pour vos newsletters ?",
    "Mi consigliate un fotografo per matrimoni?",
    "Welche Agentur könnt ihr empfehlen?",
  ])("is recognised: %s", (text) => {
    expect(asksForRecommendations(text)).toBe(true);
  });

  it.each([
    "We launched and got zero traffic",
    "How do I get softer light indoors?",
    "Mi sitio no aparece en Google",
    "Pourquoi mes photos sont floues ?",
  ])("is not a problem or how-to question: %s", (text) => {
    expect(asksForRecommendations(text)).toBe(false);
  });
});

describe("a discussion's community", () => {
  it("is the subreddit, with its rules page, and strict where self-promotion is removed", () => {
    expect(communityOf("reddit", "https://www.reddit.com/r/smallbusiness/comments/abc123/")).toEqual({
      name: "r/smallbusiness",
      rulesUrl: "https://www.reddit.com/r/smallbusiness/about/rules/",
      noPromotion: true,
    });
    // A name that says it is for questions or help is treated the same way.
    expect(communityOf("reddit", "https://www.reddit.com/r/AskPhotography/comments/abc123/").noPromotion).toBe(true);
    expect(communityOf("reddit", "https://www.reddit.com/r/analog/comments/abc123/").noPromotion).toBe(false);
  });

  it("is none where a platform has no communities with rules of their own", () => {
    expect(communityOf("x", "https://x.com/someone/status/1234567890")).toEqual({ name: null, rulesUrl: null, noPromotion: false });
    expect(communityOf("reddit", null).name).toBeNull();
  });
});

describe("the mention gate", () => {
  const allowedBase = { warmup: false, asks: true, noPromotion: false };

  it("never allows a mention during the warm-up, where nobody asked, or in a strict community", () => {
    const history = { posted: 50, mentions: 0 };
    expect(mayMention({ ...allowedBase, warmup: true, history })).toBe(false);
    expect(mayMention({ ...allowedBase, asks: false, history })).toBe(false);
    expect(mayMention({ ...allowedBase, noPromotion: true, history })).toBe(false);
    expect(mayMention({ ...allowedBase, history })).toBe(true);
  });

  it("keeps mentions to one reply in ten over the window", () => {
    expect(MENTION_EVERY).toBe(10);
    expect(mayMention({ ...allowedBase, history: { posted: 0, mentions: 0 } })).toBe(false);
    expect(mayMention({ ...allowedBase, history: { posted: 8, mentions: 0 } })).toBe(false);
    expect(mayMention({ ...allowedBase, history: { posted: 9, mentions: 0 } })).toBe(true);
    expect(mayMention({ ...allowedBase, history: { posted: 18, mentions: 1 } })).toBe(false);
    expect(mayMention({ ...allowedBase, history: { posted: 19, mentions: 1 } })).toBe(true);
  });

  it("counts only the window's posted replies, and those that named the business", () => {
    const replies = [
      { body: "Shoot a test session first.", postedAt: new Date(NOW.getTime() - DAY) },
      { body: "Same here.\n\nDisclosure: I run Image Studio.", postedAt: new Date(NOW.getTime() - 2 * DAY) },
      { body: "Older one by Image Studio.", postedAt: new Date(NOW.getTime() - 40 * DAY) },
      { body: "Not posted.", postedAt: null },
    ];
    expect(mentionHistory(replies, brand, NOW)).toEqual({ posted: 2, mentions: 1 });
  });
});

describe("how a reply reads", () => {
  it.each([
    "DM me and I'll send you our price list.",
    "Check us out, we do this every day.",
    "We have a free trial this month.",
    "Use the code SPRING for 20% off.",
    "Contáctame y te ayudo.",
    "Écrivez-moi en privé.",
    "Schreib mir einfach.",
  ])("is dropped when it sells: %s", (text) => {
    expect(soundsPromotional(text)).toBe(true);
  });

  it("is kept when it helps", () => {
    expect(soundsPromotional("I'd shoot a test session first and check the light at the venue the week before.")).toBe(false);
  });

  it("loses the long dashes machine text is known for", () => {
    expect(naturalise("Shade works — even at noon — if you face the light.\n\n\n\nTry it.")).toBe(
      "Shade works - even at noon - if you face the light.\n\nTry it.",
    );
  });
});

describe("the reply instructions (prompt contract)", () => {
  const prompt = socialSystemPrompt({ language: "English" }, ["reddit", "x", "linkedin"], 5);

  it("forbid naming or linking the business by default and allow a disclosure only where mayMention is true", () => {
    expect(prompt).toContain("NEVER name the business");
    expect(prompt).toContain("mayMention: true");
    expect(prompt).toMatch(/Never add a link to a reply/);
    expect(prompt).not.toMatch(/may mention the business only where it really answers the question/);
  });

  it("ask for a human answer: specific, varied openings, no marketing words, no calls to action, no long dashes", () => {
    expect(prompt).toMatch(/Vary how replies start/);
    expect(prompt).toMatch(/No long dashes/);
    expect(prompt).toMatch(/No marketing words/);
    expect(prompt).toMatch(/no calls to action/i);
    expect(prompt).toMatch(/language of the discussion/);
  });

  it("carry each platform's length, LinkedIn's included", () => {
    expect(prompt).toContain(`Never more than ${PLATFORMS.linkedin.maxLength} characters`);
    expect(prompt).toMatch(/LinkedIn: an own post only/);
  });
});

describe("LinkedIn in Social", () => {
  it("is an own-posts platform without conversations, published through bundle.social", () => {
    expect(SOCIAL_PLATFORMS).toContain("linkedin");
    expect(PLATFORMS.linkedin).toMatchObject({ bundleType: "LINKEDIN", replies: false, ownPosts: true, maxLength: 3000 });
    expect(PLATFORMS.linkedin.search).toBeUndefined();
  });

  it("is hidden while bundle.social is not set up", () => {
    expect(availablePlatforms(false)).not.toContain("linkedin");
    expect(availablePlatforms(false)).toEqual(["reddit", "quora", "x", "threads", "pinterest", "bluesky"]);
    expect(availablePlatforms(true)).toContain("linkedin");
  });

  it("opens LinkedIn's share box with the text for a post by hand", () => {
    expect(composeUrl("linkedin", { body: "Hello & welcome" })).toBe("https://www.linkedin.com/feed/?shareActive=true&text=Hello%20%26%20welcome");
    expect(composeUrl("linkedin", { body: "x".repeat(7000) })).toBe("https://www.linkedin.com/feed/?shareActive=true");
  });
});
