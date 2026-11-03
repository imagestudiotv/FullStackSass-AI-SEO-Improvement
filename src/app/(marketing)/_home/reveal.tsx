"use client";

import { useEffect } from "react";

/**
 * Scroll reveal for the homepage, one observer for the whole page.
 *
 * Any element with a `data-reveal` attribute gets `data-shown` once a fifth
 * of it is on screen, and keeps it. The stylesheet does the rest: `.reveal`
 * elements fade up, and some sections (`.engines`, `.steps`, `.copilot`)
 * start their drawings when they carry `data-shown`.
 *
 * NOTHING IS HIDDEN WITHOUT JAVASCRIPT. The hiding rule only applies under
 * `html.hp-reveal`, which this adds - so a visitor with scripts off, a
 * crawler, or a slow first paint sees the whole page. Elements already on
 * screen, or above it, are marked before the class goes on, so the hero never
 * blinks and a deep link never lands below blank sections.
 * Reduced motion: everything is marked at once, and nothing moves.
 */
export function RevealRoot() {
  useEffect(() => {
    const root = document.documentElement;
    const targets = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));
    const show = (el: Element) => el.setAttribute("data-shown", "");

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) {
      targets.forEach(show);
      return;
    }

    // On screen, or already scrolled past: a visitor who arrives at /#pricing,
    // or scrolls before the page has loaded, must not find blank sections above.
    const reached = (el: Element) => el.getBoundingClientRect().top < window.innerHeight * 0.92;
    targets.filter(reached).forEach(show);
    root.classList.add("hp-reveal");

    /*
      A fast flick can carry a section across the screen between two observer
      checks, and it would stay blank above the reader. So besides the
      observer, every scroll (one check per frame) shows whatever has been
      reached or passed.
    */
    let frame = 0;
    const sweep = () => {
      frame = 0;
      for (const el of targets) if (!el.hasAttribute("data-shown") && reached(el)) show(el);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(sweep);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          show(entry.target);
          observer.unobserve(entry.target);
        }
      },
      { threshold: 0.2, rootMargin: "0px 0px -6% 0px" },
    );
    targets.filter((el) => !el.hasAttribute("data-shown")).forEach((el) => observer.observe(el));

    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(frame);
      root.classList.remove("hp-reveal");
    };
  }, []);

  return null;
}
