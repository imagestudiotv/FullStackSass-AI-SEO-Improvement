"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * The hero's <section>, with the floating cards drifting after the mouse
 * (client's design, 2026-11-03).
 *
 * This only writes two numbers, --px and --py (-1 to 1, the pointer's place
 * across the hero), on the section; each card multiplies them by its own
 * --depth in home.module.css, so nearer cards move further and the CSS
 * transition smooths the motion. At most one write per frame.
 *
 * Mouse only, and only where the cards float (wider than 1200px - below that
 * they sit in a scrolling row): a finger dragging across a phone should
 * scroll the page, not shove the cards. Reduced motion: nothing moves, and
 * the stylesheet pins the cards as well.
 *
 * Everything inside stays a server component; this wraps it as children.
 */
export function HeroParallax({
  className,
  labelledBy,
  children,
}: {
  className?: string;
  /** The id of the hero's <h1>. */
  labelledBy: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const wide = window.matchMedia("(min-width: 1201px)");

    let frame = 0;
    let x = 0;
    let y = 0;
    const paint = () => {
      frame = 0;
      el.style.setProperty("--px", x.toFixed(3));
      el.style.setProperty("--py", y.toFixed(3));
    };
    const queue = () => {
      if (!frame) frame = requestAnimationFrame(paint);
    };

    const onMove = (event: PointerEvent) => {
      // Checked on every move rather than once, so a window resized or a
      // setting changed mid-visit is honoured without a reload.
      if (event.pointerType !== "mouse" || !finePointer.matches || reduced.matches || !wide.matches) return;
      const box = el.getBoundingClientRect();
      if (!box.width || !box.height) return;
      x = Math.max(-1, Math.min(1, ((event.clientX - box.left) / box.width - 0.5) * 2));
      y = Math.max(-1, Math.min(1, ((event.clientY - box.top) / box.height - 0.5) * 2));
      queue();
    };
    // Back to rest when the mouse leaves, so no card is left hanging off-centre.
    const onLeave = () => {
      x = 0;
      y = 0;
      queue();
    };

    el.addEventListener("pointermove", onMove, { passive: true });
    el.addEventListener("pointerleave", onLeave);
    return () => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
      cancelAnimationFrame(frame);
      el.style.removeProperty("--px");
      el.style.removeProperty("--py");
    };
  }, []);

  return (
    <section ref={ref} className={className} aria-labelledby={labelledBy}>
      {children}
    </section>
  );
}
