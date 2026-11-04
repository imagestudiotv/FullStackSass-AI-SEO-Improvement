"use client";

import { useEffect, useRef, type ReactNode } from "react";

const clamp = (x: number) => Math.max(0, Math.min(1, x));

/**
 * The top features' reveal stage (design script
 * `rgx-restored-dashboard-scroll-driver`): sets `--reveal-progress` from 0 to
 * 1 while the stage scrolls up the screen, eased (smoothstep). The stylesheet
 * turns it into the board's scale, from 72% to full size on desktop and less
 * on tablets and phones. Reduced motion: always 1, so nothing moves.
 *
 * Without JavaScript the progress stays at 0, as in the design before its
 * script runs.
 */
export function TopFeaturesStage({ className, children }: { className: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stage = ref.current;
    if (!stage) return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;

    const render = () => {
      frame = 0;
      if (media.matches) {
        stage.style.setProperty("--reveal-progress", "1");
        return;
      }
      const r = stage.getBoundingClientRect();
      const vh = window.innerHeight || document.documentElement.clientHeight;
      const mobile = window.innerWidth <= 768;
      const tablet = window.innerWidth <= 1100 && !mobile;
      const start = vh * (mobile ? 0.86 : tablet ? 0.85 : 0.92);
      const travel = vh * (mobile ? 0.66 : tablet ? 0.66 : 0.82);
      const p = clamp((start - r.top) / travel);
      const smooth = p * p * (3 - 2 * p);
      stage.style.setProperty("--reveal-progress", smooth.toFixed(4));
    };
    const update = () => {
      if (!frame) frame = requestAnimationFrame(render);
    };

    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update, { passive: true });
    window.addEventListener("load", update, { once: true });
    media.addEventListener("change", update);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      window.removeEventListener("load", update);
      media.removeEventListener("change", update);
    };
  }, []);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
