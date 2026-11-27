import { describe, expect, it } from "vitest";

import { bottomClearOf, CHAT_FLOATING_SELECTOR } from "./chat-clearance";

/** The "Set up" tracker sits above whatever the chat widget shows in the bottom-right corner (outside review, 2026-11-27). */

const viewport = { width: 1440, height: 900 };
const box = (top: number, height: number, right = 1416, width = 60) => ({ top, height, right, width, left: right - width });

describe("keeping the Set up panel clear of the chat", () => {
  it("keeps its usual place above Crisp's default launcher", () => {
    // The launcher: 60px tall, 14px from the bottom.
    expect(bottomClearOf([box(900 - 74, 60)], viewport, 112)).toBe(112);
    expect(bottomClearOf([], viewport, 112)).toBe(112);
  });

  it("moves above a message preview stacked over the launcher, with a gap", () => {
    const preview = box(900 - 74 - 260, 260, 1416, 300);
    expect(bottomClearOf([box(900 - 74, 60), preview], viewport, 112)).toBe(74 + 260 + 12);
  });

  it("moves above a launcher placed higher in Crisp's settings", () => {
    expect(bottomClearOf([box(900 - 160, 60)], viewport, 112)).toBe(172);
  });

  it("ignores what is hidden or not in the corner (an open chat window reaching the top)", () => {
    expect(bottomClearOf([box(600, 0, 1416, 0)], viewport, 112)).toBe(112);
    expect(bottomClearOf([box(40, 800, 1416, 380)], viewport, 112)).toBe(112);
    expect(bottomClearOf([box(700, 60, 200)], viewport, 112)).toBe(112);
  });

  it("finds Crisp's elements by data attributes, not its hashed class names", () => {
    expect(CHAT_FLOATING_SELECTOR).not.toMatch(/\.cc-/);
  });
});
