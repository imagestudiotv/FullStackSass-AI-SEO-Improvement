import { beforeEach, describe, expect, it, vi } from "vitest";

const inserted = vi.fn();
const storeSharedFile = vi.fn(async () => "https://storage.example/video-files/shared/stock/pixabay/1.mp4");

vi.mock("@/lib/db", () => ({
  db: {
    select: () => ({ from: () => ({ where: async () => [] }) }),
    insert: () => ({
      values: (values: Record<string, unknown>) => {
        inserted(values);
        return { onConflictDoUpdate: () => ({ returning: async () => [{ id: "row", ...values }] }) };
      },
    }),
  },
}));
vi.mock("../storage", () => ({ storeSharedFile }));

const { storeCandidate } = await import("./store");
const { AI_LICENCE, AI_PROVIDER } = await import("./ai-library");

/** RepGet's AI clips (client, 2026-11-19) are in the bucket already: recorded, never downloaded or copied. */
describe("storing a hook clip", () => {
  const base = { kind: "video" as const, width: 720, height: 1280, durationMs: 8000, sizeBytes: null, author: "RepGet", tags: [] };

  beforeEach(() => {
    inserted.mockClear();
    storeSharedFile.mockClear();
  });

  const aiClip = (url: string) => ({ ...base, provider: AI_PROVIDER, providerId: "2026-11-19-marble-run", downloadUrl: url, licence: AI_LICENCE, sourceUrl: url });

  it("records an AI clip at its own address, checked but not downloaded", async () => {
    const url = "https://storage.example/video-files/shared/ai-clips/2026-11-19-marble-run.mp4";
    const fetcher = vi.fn(async () => new Response(null, { status: 200 }));
    const row = await storeCandidate(aiClip(url), "domino chain falling", 0, fetcher as unknown as typeof fetch);
    expect(fetcher).toHaveBeenCalledWith(url, expect.objectContaining({ method: "HEAD" }));
    expect(storeSharedFile).not.toHaveBeenCalled();
    expect(row.url).toBe(url);
    expect(inserted).toHaveBeenCalledWith(expect.objectContaining({ provider: "ai", providerId: "2026-11-19-marble-run", url, licence: AI_LICENCE }));
  });

  it("refuses an AI clip not in storage yet, so the video falls back to the next clip", async () => {
    const fetcher = vi.fn(async () => new Response(null, { status: 400 }));
    await expect(storeCandidate(aiClip("https://storage.example/missing.mp4"), "domino", 0, fetcher as unknown as typeof fetch)).rejects.toThrow(/not in storage/);
    expect(inserted).not.toHaveBeenCalled();
  });

  it("still copies a stock provider's file to RepGet's storage", async () => {
    const fetcher = vi.fn(async () => new Response(new Uint8Array([1, 2, 3]), { headers: { "content-type": "video/mp4" } }));
    const row = await storeCandidate({ ...base, provider: "pixabay", providerId: "1", downloadUrl: "https://cdn.pixabay.com/1.mp4", licence: "Pixabay Content License", sourceUrl: "https://pixabay.com/videos/1" }, "domino", 0, fetcher as unknown as typeof fetch);
    expect(fetcher).toHaveBeenCalledOnce();
    expect(storeSharedFile).toHaveBeenCalledWith("stock/pixabay", expect.any(Buffer), "video/mp4");
    expect(row.url).toBe("https://storage.example/video-files/shared/stock/pixabay/1.mp4");
  });
});
