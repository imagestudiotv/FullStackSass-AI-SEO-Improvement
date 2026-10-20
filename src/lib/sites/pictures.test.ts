import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { siteImages } from "@/lib/db/schema";
import { createTestDb, type TestDb } from "@/test/db";
import { seedWebsite } from "@/test/fixtures";

/**
 * An article's pictures chosen from the website's own media library (client,
 * 2026-10-20, Image Studio: "the same for feature image it should get from
 * our images and not generating new one"). The model is mocked.
 */

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/lib/db", () => ({ db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }) }));
const ai = vi.hoisted(() => ({ create: vi.fn(), configured: true }));
vi.mock("@/lib/ai/client", () => ({
  anthropic: { messages: { create: ai.create } },
  MODELS: { EXTRACTION: "claude-haiku-4-5", GENERATION: "claude-sonnet-5" },
  isAiConfigured: () => ai.configured,
}));

import { CANDIDATES_SHOWN, chooseLibraryPictures, rankCandidates, usable } from "./pictures";

let test: TestDb;
let websiteId = "";

const LIBRARY = [
  { remoteId: 1, url: "https://studio.test/uploads/couple-boat-lake-como.jpg", alt: "Couple on a wooden boat on Lake Como at sunset", title: "Lake Como boat", width: 1600, height: 1067 },
  { remoteId: 2, url: "https://studio.test/uploads/villa-balbianello-ceremony.jpg", alt: "Wedding ceremony on the terrace of Villa del Balbianello", title: "Balbianello", width: 1600, height: 1067 },
  { remoteId: 3, url: "https://studio.test/uploads/imagestudio-logo.png", alt: "Image Studio logo", title: "logo", width: 800, height: 200 },
  { remoteId: 4, url: "https://studio.test/uploads/tiny.jpg", alt: "A tiny thumbnail", title: "tiny", width: 150, height: 150 },
  { remoteId: 5, url: "https://studio.test/uploads/castle-tuscany.jpg", alt: "Bride and groom outside a castle in Tuscany", title: "Castle", width: 1067, height: 1600 },
];

const answer = (value: unknown) =>
  ai.create.mockResolvedValueOnce({ stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify(value) }], usage: { input_tokens: 900, output_tokens: 120 } });

const SECTIONS = [
  { h2: 1, heading: "Getting married on Lake Como", text: "The lake, the villas and the boats." },
  { h2: 2, heading: "Choosing a ceremony villa", text: "Villa del Balbianello and others." },
  { h2: 3, heading: "Paperwork for foreign couples", text: "Documents and timing." },
];

beforeAll(async () => {
  test = await createTestDb();
  state.db = test.db;
  ({ websiteId } = await seedWebsite(test));
});

beforeEach(async () => {
  ai.create.mockReset();
  ai.configured = true;
  await test.client.exec("delete from site_images;");
  await test.db.insert(siteImages).values(LIBRARY.map((picture) => ({ ...picture, websiteId })));
});

describe("pictures from the site's library", () => {
  it("are photographs worth showing: never a logo, an icon or a thumbnail", () => {
    const ok = LIBRARY.filter((picture) => usable({ ...picture, caption: null }));
    expect(ok.map((picture) => picture.remoteId)).toEqual([1, 2, 5]);
  });

  it("are shown to the model best match first", () => {
    const ranked = rankCandidates(LIBRARY.map((picture) => ({ ...picture, caption: null })), "Lake Como wedding boat");
    expect(ranked[0].remoteId).toBe(1);
    expect(CANDIDATES_SHOWN).toBe(50);
  });

  it("give the cover and the sections the model chose, each once, with alt text in the article's language", async () => {
    answer({
      cover: { picture: 1, alt: "Coppia su una barca sul lago di Como al tramonto" },
      sections: [
        { section: 1, picture: 1, alt: "the cover again" },
        { section: 2, picture: 2, alt: "Cerimonia sulla terrazza di Villa del Balbianello" },
        { section: 3, picture: 0, alt: "" },
      ],
    });
    const chosen = await chooseLibraryPictures({ websiteId, title: "Getting Married on Lake Como", keyword: "lake como wedding", language: "Italian", sections: SECTIONS });
    expect(chosen?.cover).toMatchObject({ url: LIBRARY[0].url, alt: "Coppia su una barca sul lago di Como al tramonto", remoteId: 1 });
    // The cover is not used twice, and a section with nothing fitting gets nothing.
    expect(chosen?.sections).toEqual([{ h2: 2, url: LIBRARY[1].url, alt: "Cerimonia sulla terrazza di Villa del Balbianello", width: 1600, height: 1067, remoteId: 2 }]);
    const request = ai.create.mock.calls[0][0] as { system: string; messages: { content: string }[] };
    expect(request.messages[0].content).toContain("Article language: Italian");
    expect(request.messages[0].content).not.toContain("logo");
    expect(request.system).toContain("A photograph that does not fit is worse than none");
  });

  it("fall back to the best match for the cover, and none in sections, when the model fails", async () => {
    ai.create.mockRejectedValueOnce(new Error("overloaded"));
    const chosen = await chooseLibraryPictures({ websiteId, title: "Lake Como boat tour for couples", keyword: null, language: "English", sections: SECTIONS });
    expect(chosen).toEqual({ cover: expect.objectContaining({ remoteId: 1 }), sections: [] });
  });

  it("are none when the library has nothing usable - the caller makes a cover", async () => {
    await test.client.exec("delete from site_images;");
    await test.db.insert(siteImages).values({ ...LIBRARY[2], websiteId });
    expect(await chooseLibraryPictures({ websiteId, title: "Anything", keyword: null, language: "English", sections: [] })).toBeNull();
    expect(ai.create).not.toHaveBeenCalled();
  });
});
