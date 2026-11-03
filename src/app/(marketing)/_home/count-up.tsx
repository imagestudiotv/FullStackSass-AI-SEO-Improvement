"use client";

import { useEffect, useRef, useState } from "react";

import styles from "./home.module.css";

/**
 * A real number that counts up the first time it scrolls into view.
 *
 * The server renders the final value, so crawlers, screen readers and a
 * page without JavaScript all read the true figure; the count-up is only
 * motion on top. Reduced motion shows the number as it is.
 */
export function CountUp({ value, locale, className }: { value: number; locale: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [shown, setShown] = useState(value);

  useEffect(() => {
    const el = ref.current;
    if (!el || value <= 0) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) return;

    let frame = 0;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        observer.disconnect();
        const start = performance.now();
        const duration = 1600;
        const tick = (now: number) => {
          const p = Math.min(1, (now - start) / duration);
          // Ease out: fast at first, settling on the real value.
          setShown(Math.round(value * (1 - (1 - p) ** 3)));
          if (p < 1) frame = requestAnimationFrame(tick);
        };
        setShown(0);
        frame = requestAnimationFrame(tick);
      },
      { threshold: 0.4 },
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [value]);

  return (
    <span ref={ref} className={className}>
      <span className={styles.srOnly}>{value.toLocaleString(locale)}</span>
      <span aria-hidden="true">{shown.toLocaleString(locale)}</span>
    </span>
  );
}
