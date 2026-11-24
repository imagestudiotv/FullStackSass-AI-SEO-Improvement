"use client";

import { useEffect, useRef, useState } from "react";

import { MIN_STREAM_WIDTH, streamLayout, type Box, type StreamLayout } from "./signal-streams-layout";
import styles from "./signal-streams.module.css";

/** The hero's lines of text carry this attribute (hero.tsx), so no strand crosses them. */
const TEXT = "[data-stream-text]";

/** The browser's idle time, or a short wait where it has no such thing (Safari). */
function whenIdle(run: () => void): () => void {
  if (typeof window.requestIdleCallback === "function") {
    const id = window.requestIdleCallback(run, { timeout: 2000 });
    return () => window.cancelIdleCallback(id);
  }
  const id = setTimeout(run, 400);
  return () => clearTimeout(id);
}

/**
 * The hero's signal streams (client, 2026-11-24, after explee.com): fine lines
 * from both edges that meet at the website field, with a few travelling dots.
 * Decoration only: out of the flow (no layout shift), hidden from screen
 * readers, and never in the way of the pointer.
 *
 * Nothing is drawn by the server or at the first paint: the streams start once
 * the page is idle and the hero is on screen, and fade in. They are laid out
 * from the real form's and text's places (signal-streams-layout.ts), again
 * whenever one of those changes. The dots stop while the hero is off screen or
 * the tab is hidden, and stand still under reduced motion.
 */
export function SignalStreams() {
  const root = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const [layout, setLayout] = useState<StreamLayout | null>(null);
  const [still, setStill] = useState(false);

  useEffect(() => {
    const hero = root.current?.parentElement;
    const form = hero?.querySelector("form");
    const lines = svg.current;
    if (!hero || !form || !lines) return;

    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let idle = false;
    let inView = false;
    let started = false;
    let frame = 0;
    let drawn = "";
    let unmounted = false;

    const draw = () => {
      frame = 0;
      const { left, top, width, height } = hero.getBoundingClientRect();
      const inHero = (r: DOMRect): Box => ({ left: r.left - left, top: r.top - top, right: r.right - left, bottom: r.bottom - top });
      const texts: Box[] = [];
      // A narrow screen has no streams, so its text is not measured.
      if (width >= MIN_STREAM_WIDTH) {
        for (const element of hero.querySelectorAll(TEXT)) {
          const range = document.createRange();
          range.selectNodeContents(element);
          for (const rect of range.getClientRects()) texts.push(inHero(rect));
        }
      }
      const next = streamLayout({ width, height, form: inHero(form.getBoundingClientRect()), texts });
      setStill(motion.matches);
      // All in the same place: nothing to redraw.
      const place = next ? `${next.width} ${next.height} ${next.strands.map((strand) => strand.d).join()}` : "";
      if (place === drawn) return;
      drawn = place;
      setLayout(next);
    };
    const schedule = () => {
      if (started && !unmounted && !frame) frame = requestAnimationFrame(draw);
    };

    const pace = () => {
      if (inView && !document.hidden && !motion.matches) lines.unpauseAnimations();
      else lines.pauseAnimations();
    };
    const motionChanged = () => {
      schedule();
      pace();
    };

    const resized = new ResizeObserver(schedule);
    const start = () => {
      if (started || !idle || !inView) return;
      started = true;
      // The text too: when it wraps or its font arrives, the form moves without changing size.
      for (const element of [hero, form, ...hero.querySelectorAll(TEXT)]) resized.observe(element);
      void document.fonts?.ready.then(schedule);
      schedule();
    };

    const seen = new IntersectionObserver((entries) => {
      inView = entries[entries.length - 1].isIntersecting;
      pace();
      start();
    });
    seen.observe(hero);
    const cancelIdle = whenIdle(() => {
      idle = true;
      start();
    });
    document.addEventListener("visibilitychange", pace);
    motion.addEventListener("change", motionChanged);

    return () => {
      unmounted = true;
      cancelIdle();
      cancelAnimationFrame(frame);
      seen.disconnect();
      resized.disconnect();
      document.removeEventListener("visibilitychange", pace);
      motion.removeEventListener("change", motionChanged);
    };
  }, []);

  return (
    <div ref={root} className={styles.streams} data-drawn={layout ? "" : undefined} aria-hidden="true">
      <svg ref={svg} className={styles.svg} viewBox={layout ? `0 0 ${layout.width} ${layout.height}` : undefined} preserveAspectRatio="none" focusable="false">
        {layout?.strands.map(({ d, warm, marks, dot }, index) => (
          <g key={index}>
            <path d={d} className={warm ? `${styles.rail} ${styles.warm}` : styles.rail} />
            {marks.map((mark, at) => (
              <rect
                key={at}
                x={mark.x}
                y={mark.y}
                width={mark.size}
                height={mark.size}
                rx={0.65}
                className={mark.warm ? `${styles.mark} ${styles.warm}` : styles.mark}
              />
            ))}
            {dot && still ? <circle cx={dot.still.x} cy={dot.still.y} r={dot.r} className={styles.dot} /> : null}
            {dot && !still ? (
              <circle r={dot.r} className={styles.dot}>
                <animateMotion path={d} dur={`${dot.seconds}s`} begin={`${dot.begin}s`} repeatCount="indefinite" calcMode="linear" />
                <animate
                  attributeName="opacity"
                  values={dot.soft ? "0;0.55;0.6;0" : "0;0.85;0.88;0"}
                  keyTimes="0;0.2;0.83;1"
                  dur={`${dot.seconds}s`}
                  begin={`${dot.begin}s`}
                  repeatCount="indefinite"
                />
              </circle>
            ) : null}
          </g>
        ))}
      </svg>
    </div>
  );
}
