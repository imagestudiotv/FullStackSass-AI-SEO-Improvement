import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The one-click post's click (client, 2026-11-24: a tab that stayed blank):
 * the platform's own https address is opened in the click, before any answer
 * from the server, and never an empty page. That the server works out the
 * same address is in lib/social/social.test.ts.
 */

const copyTextNow = vi.hoisted(() => vi.fn());
vi.mock("@/lib/copy-text", () => ({ copyTextNow }));

import { COPY_WAIT_MS, oneClickPost, RECORD_WAIT_MS, type OneClickPost } from "./one-click";

const THREAD = "https://www.reddit.com/r/SaaS/comments/abc123/";
const calls: string[] = [];
const open = vi.fn();
let tab: { opener: unknown } | null;

const base: OneClickPost["row"] = { platform: "reddit", threadUrl: THREAD, title: null, link: null, imageUrl: null };

function click(over: Partial<Omit<OneClickPost, "row">> & { row?: Partial<OneClickPost["row"]> } = {}) {
  const report = { refused: vi.fn(), slow: vi.fn(), done: vi.fn() };
  const record = vi.fn(over.record ?? (async () => ({ ok: true as const, data: null })));
  oneClickPost(
    {
      text: over.text ?? "My reply",
      edit: over.edit ?? { body: "My reply" },
      row: { ...base, ...over.row },
      record: () => {
        calls.push("record");
        return record();
      },
    },
    report,
  );
  return { ...report, record };
}

const settle = () => vi.advanceTimersByTimeAsync(0);

beforeEach(() => {
  vi.useFakeTimers();
  calls.length = 0;
  tab = { opener: "this page" };
  copyTextNow.mockReset().mockImplementation(() => {
    calls.push("copy");
    return Promise.resolve(true);
  });
  open.mockReset().mockImplementation(() => {
    calls.push("open");
    return tab;
  });
  vi.stubGlobal("window", { open });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("the click", () => {
  it("copies, opens the discussion and records, in that order and before any answer", () => {
    const { done, refused } = click({ record: () => new Promise(() => {}) });
    expect(calls).toEqual(["copy", "open", "record"]);
    expect(open.mock.calls).toEqual([[THREAD, "_blank"]]);
    // The opened page cannot reach back into RepGet.
    expect(tab?.opener).toBeNull();
    expect(done).not.toHaveBeenCalled();
    expect(refused).not.toHaveBeenCalled();
  });

  it.each([
    ["reddit", { threadUrl: null, title: "A title" }, "https://www.reddit.com/submit?type=TEXT&title=A%20title&text=My%20reply"],
    ["quora", { threadUrl: "https://www.quora.com/unanswered/How-do-I-choose" }, "https://www.quora.com/How-do-I-choose"],
    ["quora", { threadUrl: null }, "https://www.quora.com/"],
    ["x", { threadUrl: "https://twitter.com/someone/status/1234567890" }, "https://x.com/intent/post?in_reply_to=1234567890&text=My%20reply"],
    ["x", { threadUrl: null }, "https://x.com/intent/post?text=My%20reply"],
    ["threads", { threadUrl: null }, "https://www.threads.com/intent/post?text=My%20reply"],
    ["pinterest", { threadUrl: null, link: "https://a.example/p", imageUrl: "https://a.example/i.jpg" }, "https://www.pinterest.com/pin/create/button/?url=https%3A%2F%2Fa.example%2Fp&media=https%3A%2F%2Fa.example%2Fi.jpg&description=My%20reply"],
    ["bluesky", { threadUrl: null }, "https://bsky.app/intent/compose?text=My%20reply"],
    // A stored address that is not a discussion on the platform is never opened.
    ["reddit", { threadUrl: "javascript:alert(1)", title: null }, "https://www.reddit.com/submit?type=TEXT&title=&text=My%20reply"],
    ["reddit", { threadUrl: "http://evil.example/r/a/comments/abc123/", title: null }, "https://www.reddit.com/submit?type=TEXT&title=&text=My%20reply"],
  ])("opens %s's own page: %j", (platform, over, url) => {
    click({ row: { platform, ...over } });
    expect(open.mock.calls).toEqual([[url, "_blank"]]);
  });

  it("opens the edited text, trimmed as the server trims it", () => {
    click({ row: { platform: "x", threadUrl: null }, edit: { body: "  Edited text \n" } });
    expect(open).toHaveBeenCalledWith("https://x.com/intent/post?text=Edited%20text", "_blank");
  });

  it.each([
    ["empty", { body: "   " }, "x"],
    ["too_long", { body: "x".repeat(281) }, "x"],
    ["too_long", { body: "Fine", title: "t".repeat(301) }, "reddit"],
  ] as const)("stops before opening a text that is %s", (error, edit, platform) => {
    const { refused, record } = click({ edit, row: { platform, threadUrl: null } });
    expect(refused).toHaveBeenCalledWith({ ok: false, error });
    expect(open).not.toHaveBeenCalled();
    expect(copyTextNow).not.toHaveBeenCalled();
    expect(record).not.toHaveBeenCalled();
  });
});

describe("the answer", () => {
  it("is reported with what really happened", async () => {
    const { done } = click();
    await settle();
    expect(done).toHaveBeenCalledWith({ url: THREAD, opened: true, copied: true, filled: false });
    expect(open).toHaveBeenCalledTimes(1);
  });

  it("says a blocked tab was blocked, and still records", async () => {
    tab = null;
    const { done } = click();
    await settle();
    expect(done).toHaveBeenCalledWith({ url: THREAD, opened: false, copied: true, filled: false });
  });

  it("refused: the reason, and no second tab", async () => {
    const refusal = { ok: false as const, error: "not_enough_credits" as const, price: 1, available: 0 };
    const { refused, done } = click({ record: async () => refusal });
    await settle();
    expect(refused.mock.calls).toEqual([[refusal]]);
    expect(done).not.toHaveBeenCalled();
    expect(open).toHaveBeenCalledTimes(1);
  });

  it("failed: reported without a reason", async () => {
    const { refused } = click({ record: async () => Promise.reject(new Error("offline")) });
    await settle();
    expect(refused.mock.calls).toEqual([[null]]);
  });

  it("missing: the button is given back, and a later answer still counts", async () => {
    let answer: (value: { ok: true; data: null }) => void = () => {};
    const { slow, done } = click({ record: () => new Promise((resolve) => (answer = resolve)) });
    await vi.advanceTimersByTimeAsync(RECORD_WAIT_MS);
    expect(slow).toHaveBeenCalledTimes(1);
    answer({ ok: true, data: null });
    await settle();
    expect(done).toHaveBeenCalledTimes(1);
  });

  it("never waits for a clipboard that does not answer", async () => {
    copyTextNow.mockReturnValue(new Promise(() => {}));
    const { done, slow, record } = click();
    expect(record).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(COPY_WAIT_MS);
    expect(done).toHaveBeenCalledWith(expect.objectContaining({ opened: true, copied: false }));
    await vi.advanceTimersByTimeAsync(RECORD_WAIT_MS);
    expect(slow).not.toHaveBeenCalled();
  });
});
