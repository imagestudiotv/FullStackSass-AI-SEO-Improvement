import { describe, expect, it } from "vitest";

import { isImageStudioCard, orderStoryCards, sameBusiness, type StoryCard } from "./order";

/**
 * The customer stories' one order (client, 2026-11-19: "imagestudio website
 * will be always first stable fixed, no matter the other businesses we will
 * be adding, all insertions will follow after the imagestudio website").
 */

const card = (id: string, extra: Partial<StoryCard> = {}): StoryCard => ({
  id,
  source: "story",
  title: `${id} title`,
  description: `${id} description`,
  name: id,
  logoUrl: null,
  href: `/success-stories/${id}`,
  websiteUrl: null,
  label: null,
  sortOrder: 1,
  addedAt: "2026-11-01T00:00:00.000Z",
  ...extra,
});

const builtIn = card("image-studio", { source: "image-studio", name: "Image Studio", websiteUrl: "https://imagestudio.com", sortOrder: 0, addedAt: "2026-10-15T00:00:00.000Z" });

describe("orderStoryCards", () => {
  it("puts Image Studio first whatever the other cards' sort order and dates say", () => {
    const ordered = orderStoryCards([
      card("dumitru", { source: "blog", sortOrder: 0, addedAt: "2026-11-12T00:00:00.000Z" }),
      card("early", { sortOrder: -50, addedAt: "2020-01-01T00:00:00.000Z" }),
      card("late", { sortOrder: 2 }),
      { ...builtIn, sortOrder: 999, addedAt: "2030-01-01T00:00:00.000Z" },
    ]);
    expect(ordered.map((c) => c.id)).toEqual(["image-studio", "early", "dumitru", "late"]);
  });

  it("follows Image Studio with the rest by sort order, then in the order added, then by id", () => {
    const ordered = orderStoryCards([
      card("c", { sortOrder: 2, addedAt: "2026-11-03T00:00:00.000Z" }),
      card("b", { sortOrder: 1, addedAt: "2026-11-05T00:00:00.000Z" }),
      card("a", { sortOrder: 1, addedAt: "2026-11-02T00:00:00.000Z" }),
      card("undated", { sortOrder: 1, addedAt: null }),
      card("twin-2", { sortOrder: 3, addedAt: "2026-11-09T00:00:00.000Z" }),
      card("twin-1", { sortOrder: 3, addedAt: "2026-11-09T00:00:00.000Z" }),
      card("post", { source: "blog", sortOrder: 0, addedAt: "2026-11-18T00:00:00.000Z" }),
      builtIn,
    ]);
    expect(ordered.map((c) => c.id)).toEqual(["image-studio", "post", "a", "b", "undated", "c", "twin-1", "twin-2"]);
  });

  it("keeps one Image Studio card: its blog post's over the built-in one, wherever either is", () => {
    const post = card("post:is", { source: "blog", name: "Image Studio", websiteUrl: "https://www.imagestudio.com/", sortOrder: 0, addedAt: "2026-11-11T00:00:00.000Z" });
    const ordered = orderStoryCards([card("dumitru", { source: "blog", sortOrder: 0, addedAt: "2026-11-01T00:00:00.000Z" }), builtIn, post]);
    expect(ordered.map((c) => c.id)).toEqual(["post:is", "dumitru"]);
    expect(orderStoryCards([builtIn]).map((c) => c.id)).toEqual(["image-studio"]);
    expect(orderStoryCards([card("x")]).map((c) => c.id)).toEqual(["x"]);
  });

  it("shows a business with a success story by that story alone: its blog posts are not cards of their own (client, 2026-11-26)", () => {
    const story = card("story:dumitru", { name: "Dumitru Culiuc", websiteUrl: "https://dumitruculiuc.com/", sortOrder: 1 });
    const post = card("post:dumitru", { source: "blog", name: "Dumitru Culiuc", websiteUrl: "https://www.dumitruculiuc.com/about", sortOrder: 0 });
    const byName = card("post:dumitru-es", { source: "blog", name: " dumitru  CULIUC ", websiteUrl: null, sortOrder: 0 });
    const other = card("post:other", { source: "blog", name: "Other Co", sortOrder: 0 });
    expect(orderStoryCards([builtIn, post, byName, other, story]).map((c) => c.id)).toEqual(["image-studio", "post:other", "story:dumitru"]);
    // Without a success story the blog post stays a card.
    expect(orderStoryCards([builtIn, post]).map((c) => c.id)).toEqual(["image-studio", "post:dumitru"]);
    // A namesake with another website is another business: both are shown.
    const namesake = card("post:namesake", { source: "blog", name: "Dumitru Culiuc", websiteUrl: "https://elsewhere.example", sortOrder: 0 });
    expect(orderStoryCards([namesake, story]).map((c) => c.id)).toEqual(["post:namesake", "story:dumitru"]);
    // Two success stories are never hidden by each other.
    expect(orderStoryCards([story, { ...story, id: "story:twin" }]).map((c) => c.id)).toEqual(["story:dumitru", "story:twin"]);
  });

  it("does not reorder or change the cards it was given", () => {
    const input = [card("b", { sortOrder: 2 }), card("a"), builtIn];
    const copy = structuredClone(input);
    orderStoryCards(input);
    expect(input).toEqual(copy);
  });
});

describe("sameBusiness", () => {
  it("compares websites when both have one, otherwise names", () => {
    expect(sameBusiness({ name: "A", websiteUrl: "https://www.a.test/x" }, { name: "B", websiteUrl: "http://a.test" })).toBe(true);
    expect(sameBusiness({ name: "A", websiteUrl: "https://a.test" }, { name: "A", websiteUrl: "https://b.test" })).toBe(false);
    expect(sameBusiness({ name: "A  Co", websiteUrl: null }, { name: "a co", websiteUrl: "https://b.test" })).toBe(true);
    expect(sameBusiness({ name: "", websiteUrl: null }, { name: "", websiteUrl: null })).toBe(false);
    expect(sameBusiness({ name: "A", websiteUrl: "not a url" }, { name: "A", websiteUrl: null })).toBe(true);
  });
});

describe("isImageStudioCard", () => {
  it("knows Image Studio by its website, or by its name when it has no website", () => {
    expect(isImageStudioCard(builtIn)).toBe(true);
    expect(isImageStudioCard({ source: "blog", name: "Anything", websiteUrl: "https://imagestudio.com/about" })).toBe(true);
    expect(isImageStudioCard({ source: "story", name: " image  studio ", websiteUrl: null })).toBe(true);
    // Another business with the same name, elsewhere.
    expect(isImageStudioCard({ source: "story", name: "Image Studio", websiteUrl: "https://image-studio.example" })).toBe(false);
    expect(isImageStudioCard({ source: "blog", name: "Dumitru Culiuc", websiteUrl: "https://dumitruculiuc.com" })).toBe(false);
  });
});
