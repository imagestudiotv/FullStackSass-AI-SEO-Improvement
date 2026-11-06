import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/blog/sponsorship-actions", () => ({ startBlogSponsorship: vi.fn() }));

import { afterNativeClose, watchPageRestore } from "./blog-sponsorship";

/**
 * Back from Stripe through the back/forward cache must not leave the panel stuck
 * (2026-11-06). These are the two decisions the component makes about it; the
 * repo has no DOM test environment, so its wiring is not exercised here.
 */

const pageShow = (persisted: boolean) => Object.assign(new Event("pageshow"), { persisted });

describe("a page restored from the back/forward cache", () => {
  it("is noticed, unlike a normal load, until the component is gone", () => {
    const page = new EventTarget();
    const onRestore = vi.fn();
    const stop = watchPageRestore(page, onRestore);

    page.dispatchEvent(pageShow(false));
    expect(onRestore).not.toHaveBeenCalled();
    page.dispatchEvent(pageShow(true));
    expect(onRestore).toHaveBeenCalledTimes(1);

    stop();
    page.dispatchEvent(pageShow(true));
    expect(onRestore).toHaveBeenCalledTimes(1);
  });
});

describe("the dialog's close event", () => {
  it("updates the state only when the dialog is really closed, not if it was opened again since", () => {
    const onClosed = vi.fn();
    afterNativeClose({ open: true }, onClosed);
    expect(onClosed).not.toHaveBeenCalled();
    afterNativeClose({ open: false }, onClosed);
    expect(onClosed).toHaveBeenCalledTimes(1);
  });
});
