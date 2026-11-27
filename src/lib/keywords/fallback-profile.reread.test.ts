import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ fetchHomepage: vi.fn(), extractProfile: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/lib/websites/crawl", () => ({ fetchHomepage: mocks.fetchHomepage }));
vi.mock("@/lib/websites/extract", () => ({ extractProfile: mocks.extractProfile }));

import { readSiteProfile } from "./fallback-profile";

const profile = { brandName: "L'Erba del Vicino", industry: "herbalist", country: "Italy", language: "Italian", description: "Online herbalist.", targetAudience: null, services: [], competitors: [] };

beforeEach(() => {
  mocks.fetchHomepage.mockReset();
  mocks.extractProfile.mockReset();
});

describe("reading a website again when its profile is empty", () => {
  it("profiles the homepage when the site answers now", async () => {
    mocks.fetchHomepage.mockResolvedValue({ text: "Erboristeria online ".repeat(30), wordCount: 60 });
    mocks.extractProfile.mockResolvedValue(profile);
    expect(await readSiteProfile("https://shop.example.it")).toMatchObject({ profile: { industry: "herbalist" } });
  });

  it("gives up quietly, without a paid call, when it still does not answer or has no text", async () => {
    mocks.fetchHomepage.mockRejectedValueOnce(new Error("Crawl failed (network): socket hang up"));
    expect(await readSiteProfile("https://shop.example.it")).toBeNull();
    mocks.fetchHomepage.mockResolvedValueOnce({ text: "Loading", wordCount: 1 });
    expect(await readSiteProfile("https://shop.example.it")).toBeNull();
    expect(mocks.extractProfile).not.toHaveBeenCalled();
  });
});
