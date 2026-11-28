"use client";

import { useEffect, useState } from "react";

/**
 * Keeps our own bottom-right floating panel (the "Set up" tracker) clear of
 * the chat widget (outside review, 2026-11-27: the RepGet chat bubble sat on
 * the "Set up" button).
 *
 * The chat is Crisp's: its launcher and the message preview it stacks above
 * the launcher are placed by Crisp, at offsets set in Crisp's dashboard, and a
 * preview can be several messages tall. A fixed `bottom` only ever matched one
 * of those layouts. So the panel measures what Crisp actually shows in the
 * bottom-right corner and sits above the highest of it.
 *
 * Selected by data attributes, not by Crisp's hashed class names (which change
 * with every Crisp build): the launcher carries data-maximized, the preview is
 * [data-id=new_messages]. If Crisp renames them, nothing is found and the
 * panel keeps its old fixed place - the layout this replaced, never worse.
 */

export const CHAT_FLOATING_SELECTOR = '.crisp-client [data-maximized], .crisp-client [data-id="new_messages"]';

type Box = { top: number; left: number; right: number; width: number; height: number };

/**
 * How far from the bottom of the viewport the panel must sit: above every
 * visible chat element in the bottom-right corner, `gap` px clear of it, and
 * never lower than `minimum`. Elements elsewhere (an open chat window reaching
 * the top, say) do not count.
 */
export function bottomClearOf(boxes: Box[], viewport: { width: number; height: number }, minimum: number, gap = 12): number {
  let highest = Infinity;
  for (const box of boxes) {
    const visible = box.width > 0 && box.height > 0;
    // The bottom-right corner: the right third of the screen, the lower half.
    const corner = box.right > viewport.width * (2 / 3) && box.top > viewport.height / 2;
    if (visible && corner) highest = Math.min(highest, box.top);
  }
  if (!Number.isFinite(highest)) return minimum;
  return Math.max(minimum, Math.ceil(viewport.height - highest + gap));
}

/** bottomClearOf, kept up to date while Crisp loads, opens, shows a preview, or the window is resized. */
export function useBottomClearOfChat(minimum: number): number {
  const [bottom, setBottom] = useState(minimum);

  useEffect(() => {
    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const boxes = Array.from(document.querySelectorAll(CHAT_FLOATING_SELECTOR), (element) => element.getBoundingClientRect());
        setBottom(bottomClearOf(boxes, { width: window.innerWidth, height: window.innerHeight }, minimum));
      });
    };

    // Crisp adds its root to <body> after the page loads; only that subtree is watched once it exists.
    let watched: Element | null = null;
    const inner = new MutationObserver(measure);
    const watch = () => {
      const root = document.querySelector(".crisp-client");
      if (root && root !== watched) {
        inner.disconnect();
        inner.observe(root, { childList: true, subtree: true, attributes: true });
        watched = root;
      }
      measure();
    };
    const outer = new MutationObserver(watch);
    outer.observe(document.body, { childList: true });
    window.addEventListener("resize", measure);
    watch();
    return () => {
      cancelAnimationFrame(frame);
      outer.disconnect();
      inner.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [minimum]);

  return bottom;
}
