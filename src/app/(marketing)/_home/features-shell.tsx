"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

import styles from "./sections/features.module.css";

const c = (names: string) =>
  names
    .split(" ")
    .map((n) => styles[n] ?? n)
    .join(" ");

/** Scroll between two story highlights, and how far a click holds its choice (the design's 140 and 105 px). */
const STEP = 140;
const HOLD = 105;
/** Where the scroll story runs; the stylesheet pins the shell under the same query. */
const STORY = "(min-width: 1051px) and (min-height: 700px) and (prefers-reduced-motion: no-preference)";

/**
 * The "Top features" shell's behaviour (client's design, 2026-11-18,
 * repget_features_premium.html): nine capabilities in a tab list, the chosen
 * one's panel and perks, "Next feature", and four story bullets.
 *
 * A tab pattern: arrow keys, Home and End move and select. Every panel comes
 * from the server and is in the HTML, the inactive ones `hidden`, so crawlers
 * and visitors without JavaScript get them all. Only the visitor's language
 * reaches the browser, already rendered.
 *
 * The scroll story (desktop, tall enough, no reduced motion): the shell is
 * pinned by the stylesheet over a spacer, and each 140 px of scroll steps to
 * the next highlight. A click or key holds the visitor's choice until they
 * scroll 105 px away. One passive listener, read in an animation frame,
 * nothing written unless the highlight changes.
 */
export function FeaturesShell({
  headingId,
  navTop,
  navBottom,
  tabs,
  panels,
  perks,
  labels,
  highlights,
  highlightsLabel,
  jump,
  scrollNote,
  cta,
  next,
}: {
  /** The section's h2, which names the tab list. */
  headingId: string;
  navTop: ReactNode;
  navBottom: ReactNode;
  /** Each tab's inside (icon, name, line). */
  tabs: ReactNode[];
  panels: ReactNode[];
  perks: ReactNode[];
  /** Each capability's name, for the bullets' labels. */
  labels: string[];
  /** The capabilities the bullets and the scroll story step through. */
  highlights: readonly number[];
  highlightsLabel: string;
  /** A bullet's label; {n} its number, {label} the capability. */
  jump: string;
  scrollNote: ReactNode;
  cta: ReactNode;
  next: string;
}) {
  const base = useId();
  const [active, setActive] = useState(0);
  const current = useRef(0);
  /** The scroll position of the visitor's last choice, while it holds. */
  const heldAt = useRef<number | null>(null);
  const track = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const count = panels.length;

  const show = (i: number) => {
    current.current = i;
    setActive(i);
  };

  /** On phones the tabs scroll sideways: bring the chosen one into view, without moving the page. */
  const reveal = (i: number) => {
    const row = list.current;
    const tab = tabRefs.current[i];
    if (!row || !tab || row.scrollWidth <= row.clientWidth) return;
    const left = tab.offsetLeft;
    const right = left + tab.offsetWidth;
    let to: number | null = null;
    if (left < row.scrollLeft) to = left - 3;
    else if (right > row.scrollLeft + row.clientWidth) to = right - row.clientWidth + 3;
    if (to === null) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    row.scrollTo({ left: to, behavior: still ? "auto" : "smooth" });
  };

  const choose = (i: number) => {
    show(i);
    heldAt.current = window.scrollY;
    reveal(i);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const last = count - 1;
    let to: number | null = null;
    if (event.key === "ArrowDown" || event.key === "ArrowRight") to = index === last ? 0 : index + 1;
    else if (event.key === "ArrowUp" || event.key === "ArrowLeft") to = index === 0 ? last : index - 1;
    else if (event.key === "Home") to = 0;
    else if (event.key === "End") to = last;
    if (to === null) return;
    event.preventDefault();
    choose(to);
    tabRefs.current[to]?.focus();
  };

  useEffect(() => {
    const el = track.current;
    if (!el || highlights.length === 0) return;
    const story = window.matchMedia(STORY);
    let frame = 0;
    /** The shell's pinned top (--pin-top), read once and again after a resize. */
    let pin: number | null = null;

    const render = () => {
      frame = 0;
      if (!story.matches) return;
      if (heldAt.current !== null) {
        if (Math.abs(window.scrollY - heldAt.current) < HOLD) return;
        heldAt.current = null;
      }
      const box = el.getBoundingClientRect();
      if (box.bottom < 0 || box.top > window.innerHeight) return;
      if (pin === null) pin = parseFloat(getComputedStyle(el).getPropertyValue("--pin-top")) || 0;
      const step = Math.min(highlights.length - 1, Math.max(0, Math.floor((pin - 4 - box.top) / STEP)));
      const next = highlights[step];
      if (next !== current.current) show(next);
    };
    const update = () => {
      if (!frame) frame = requestAnimationFrame(render);
    };
    const resize = () => {
      pin = null;
      update();
    };

    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", resize, { passive: true });
    story.addEventListener("change", resize);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", resize);
      story.removeEventListener("change", resize);
    };
  }, [highlights]);

  const tabId = (i: number) => `${base}-tab-${i}`;
  const panelId = (i: number) => `${base}-panel-${i}`;

  return (
    <div ref={track} className={c("story-track")}>
      <div className={c("feature-shell")}>
        <div className={c("nav")}>
          {navTop}
          <div ref={list} className={c("nav-list")} role="tablist" aria-labelledby={headingId}>
            {tabs.map((tab, i) => (
              <button
                key={tabId(i)}
                ref={(el) => {
                  tabRefs.current[i] = el;
                }}
                type="button"
                role="tab"
                id={tabId(i)}
                aria-selected={i === active}
                aria-controls={panelId(i)}
                tabIndex={i === active ? 0 : -1}
                className={c("nav-item")}
                onClick={() => choose(i)}
                onKeyDown={(e) => onKeyDown(e, i)}
              >
                {tab}
              </button>
            ))}
          </div>
          {navBottom}
        </div>

        <div className={c("main")}>
          {panels.map((panel, i) => (
            <div
              key={panelId(i)}
              id={panelId(i)}
              role="tabpanel"
              aria-labelledby={tabId(i)}
              hidden={i !== active}
              tabIndex={0}
              className={c("panel")}
            >
              {panel}
            </div>
          ))}
          <div className={c("bottom")}>
            <div>
              {perks.map((items, i) => (
                <div key={`${base}-perks-${i}`} className={c("perks")} hidden={i !== active}>
                  {items}
                </div>
              ))}
            </div>
            <div className={c("buttons")}>
              <div className={c("story-bullets")} role="group" aria-label={highlightsLabel}>
                {highlights.map((index, n) => (
                  <button
                    key={`${base}-story-${index}`}
                    type="button"
                    className={index === active ? c("on") : undefined}
                    aria-label={jump.replace("{n}", String(n + 1)).replace("{label}", labels[index] ?? "")}
                    aria-current={index === active ? "true" : undefined}
                    onClick={() => choose(index)}
                  />
                ))}
              </div>
              <span className={c("scroll-note")}>{scrollNote}</span>
              {cta}
              <button type="button" className={c("secondary")} aria-label={next} onClick={() => choose((active + 1) % count)}>
                <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
      {/* The scroll the story steps through (desktop only, see the stylesheet). */}
      <div className={c("story-spacer")} aria-hidden="true" />
    </div>
  );
}
