import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The one-click post's click. The server checks first (2026-11-28): the
 * click opens a blank tab and asks for the copy, and only the server's yes
 * sends the tab to the platform and writes the text; a refusal closes the tab
 * and copies nothing. The address is worked out in the page, never waited
 * for (client, 2026-11-24: a tab that stayed blank). That the server works
 * out the same address is in lib/social/social.test.ts.
 */

const copyTextWhen = vi.hoisted(() => vi.fn());
vi.mock("@/lib/copy-text", () => ({ copyTextWhen }));

import { COPY_WAIT_MS, oneClickPost, RECORD_WAIT_MS, type OneClickPost } from "./one-click";

const THREAD = "https://www.reddit.com/r/SaaS/comments/abc123/";
const calls: string[] = [];
const open = vi.fn();
type FakeTab = { opener: unknown; closed: boolean; close: ReturnType<typeof vi.fn>; location: { replace: ReturnType<typeof vi.fn> } };
let tab: FakeTab | null;
/** What the click told the clipboard: write the text (true) or not (false). */
let approval: Promise<boolean> | null;

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
function fakeTab(): FakeTab {
  const made: FakeTab = {
    opener: "this page",
    closed: false,
    close: vi.fn(() => {
      made.closed = true;
      calls.push("close");
    }),
    location: { replace: vi.fn((url: string) => calls.push(`navigate ${url}`)) },
  };
  return made;
}

beforeEach(() => {
  vi.useFakeTimers();
  calls.length = 0;
  approval = null;
  tab = fakeTab();
  copyTextWhen.mockReset().mockImplementation((_text: string, approved: Promise<boolean>) => {
    calls.push("copy asked");
    approval = approved;
    return approved;
  });
  open.mockReset().mockImplementation(() => {
    calls.push("open blank");
    return tab;
  });
  vi.stubGlobal("window", { open });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("the click", () => {
  it("asks for the copy, opens a blank tab and asks the server, before anything reaches the platform", () => {
    const { done, refused } = click({ record: () => new Promise(() => {}) });
    expect(calls).toEqual(["copy asked", "open blank", "record"]);
    expect(open.mock.calls).toEqual([["", "_blank"]]);
    expect(copyTextWhen).toHaveBeenCalledWith("My reply", expect.any(Promise));
    // The tab cannot reach back into RepGet, and is not on the platform yet.
    expect(tab?.opener).toBeNull();
    expect(tab?.location.replace).not.toHaveBeenCalled();
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
  ])("sends the tab to %s's own page once the server agrees: %j", async (platform, over, url) => {
    click({ row: { platform, ...over } });
    await settle();
    expect(tab?.location.replace.mock.calls).toEqual([[url]]);
  });

  it("sends the edited text, trimmed as the server trims it", async () => {
    click({ row: { platform: "x", threadUrl: null }, edit: { body: "  Edited text \n" } });
    await settle();
    expect(tab?.location.replace).toHaveBeenCalledWith("https://x.com/intent/post?text=Edited%20text");
  });

  it.each([
    ["empty", { body: "   " }, "x"],
    ["too_long", { body: "x".repeat(281) }, "x"],
    ["too_long", { body: "Fine", title: "t".repeat(301) }, "reddit"],
  ] as const)("stops before opening a text that is %s", (error, edit, platform) => {
    const { refused, record } = click({ edit, row: { platform, threadUrl: null } });
    expect(refused).toHaveBeenCalledWith({ ok: false, error });
    expect(open).not.toHaveBeenCalled();
    expect(copyTextWhen).not.toHaveBeenCalled();
    expect(record).not.toHaveBeenCalled();
  });
});

describe("the answer", () => {
  it("yes: the text is written, the tab goes to the discussion, and it is reported as it happened", async () => {
    const { done } = click();
    await settle();
    expect(await approval).toBe(true);
    expect(calls).toEqual(["copy asked", "open blank", "record", `navigate ${THREAD}`]);
    expect(done).toHaveBeenCalledWith({ url: THREAD, opened: true, copied: true, filled: false, late: false });
    expect(open).toHaveBeenCalledTimes(1);
  });

  it("says a blocked tab was blocked, and still records", async () => {
    tab = null;
    const { done } = click();
    await settle();
    expect(done).toHaveBeenCalledWith({ url: THREAD, opened: false, copied: true, filled: false, late: false });
  });

  it.each([
    ["a reply naming the business where it may not", { ok: false as const, error: "mention_not_allowed" as const }],
    ["a warm-up link", { ok: false as const, error: "warmup_link" as const }],
    ["no credits", { ok: false as const, error: "not_enough_credits" as const, price: 1, available: 0 }],
  ])("no (%s): nothing copied, the tab closed and never sent to the platform, and the reason", async (_case, refusal) => {
    const { refused, done } = click({ record: async () => refusal });
    await settle();
    expect(refused.mock.calls).toEqual([[refusal]]);
    expect(await approval).toBe(false);
    expect(tab?.close).toHaveBeenCalledTimes(1);
    expect(tab?.location.replace).not.toHaveBeenCalled();
    expect(done).not.toHaveBeenCalled();
    expect(open).toHaveBeenCalledTimes(1);
  });

  it("failed: reported without a reason, nothing copied, the tab closed", async () => {
    const { refused } = click({ record: async () => Promise.reject(new Error("offline")) });
    await settle();
    expect(refused.mock.calls).toEqual([[null]]);
    expect(await approval).toBe(false);
    expect(tab?.close).toHaveBeenCalledTimes(1);
  });

  it("missing: the button is given back and the blank tab closed; a later yes still counts and offers the link", async () => {
    let answer: (value: { ok: true; data: null }) => void = () => {};
    const opened = tab!;
    const { slow, done } = click({ record: () => new Promise((resolve) => (answer = resolve)) });
    await vi.advanceTimersByTimeAsync(RECORD_WAIT_MS);
    expect(slow).toHaveBeenCalledTimes(1);
    expect(opened.close).toHaveBeenCalledTimes(1);
    answer({ ok: true, data: null });
    await settle();
    expect(opened.location.replace).not.toHaveBeenCalled();
    expect(done).toHaveBeenCalledWith({ url: THREAD, opened: false, copied: true, filled: false, late: true });
  });

  it("never waits for a clipboard that does not answer", async () => {
    copyTextWhen.mockReturnValue(new Promise(() => {}));
    const { done, slow, record } = click();
    expect(record).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(COPY_WAIT_MS);
    expect(done).toHaveBeenCalledWith(expect.objectContaining({ opened: true, copied: false }));
    await vi.advanceTimersByTimeAsync(RECORD_WAIT_MS);
    expect(slow).not.toHaveBeenCalled();
  });
});
