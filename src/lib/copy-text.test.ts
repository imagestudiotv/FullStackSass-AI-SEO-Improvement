import { afterEach, describe, expect, it, vi } from "vitest";

import { copyTextWhen } from "./copy-text";

/**
 * The copy that waits for the server (the Social page's one-click post): asked
 * for in the click, written only on the server's yes, never on a no.
 */

class FakeClipboardItem {
  constructor(readonly items: Record<string, Promise<Blob>>) {}
}

function clipboard() {
  const written: string[] = [];
  const write = vi.fn(async (items: FakeClipboardItem[]) => {
    // As a browser does: the text is written when the item's promise gives it, and a rejection writes nothing.
    const blob = await items[0].items["text/plain"];
    written.push(await blob.text());
  });
  vi.stubGlobal("ClipboardItem", FakeClipboardItem);
  vi.stubGlobal("navigator", { clipboard: { write } });
  return { write, written };
}

afterEach(() => vi.unstubAllGlobals());

describe("copyTextWhen", () => {
  it("asks for the copy at once and writes the text only once approved", async () => {
    const { write, written } = clipboard();
    let approve: (ok: boolean) => void = () => {};
    const copying = copyTextWhen("My reply", new Promise((resolve) => (approve = resolve)));
    expect(write).toHaveBeenCalledTimes(1);
    expect(written).toEqual([]);
    approve(true);
    expect(await copying).toBe(true);
    expect(written).toEqual(["My reply"]);
  });

  it("writes nothing when the server says no", async () => {
    const { written } = clipboard();
    expect(await copyTextWhen("My reply", Promise.resolve(false))).toBe(false);
    expect(written).toEqual([]);
  });
});
