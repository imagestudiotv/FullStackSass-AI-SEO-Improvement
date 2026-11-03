"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore, type KeyboardEvent, type ReactNode } from "react";

import { BrandIcon, type BrandIconName } from "@/components/brand-icons";
import type { HomeRedesignCopy } from "@/lib/i18n/home-redesign";

import styles from "./home.module.css";
import fx from "./sections/features.module.css";

/** One feature as the server hands it over: the copy, plus an icon per chip. */
export type SelectorItem = HomeRedesignCopy["features"]["items"][number] & { chipIcons: BrandIconName[] };

/** How long each feature stays up before the next one, when nobody is looking at it. */
const DWELL_MS = 6000;

/**
 * Decorative bar heights (percent) for the side card. Shapes only, no scale
 * and no figures: the preview is a drawing, never a result.
 */
const BARS = [
  [34, 52, 44, 68, 60, 86],
  [48, 40, 62, 55, 74, 70],
  [30, 46, 58, 52, 72, 90],
  [56, 50, 64, 60, 78, 82],
  [42, 58, 50, 66, 80, 76],
  [36, 44, 60, 70, 66, 88],
  [50, 62, 58, 74, 84, 92],
];

const reducedQuery = "(prefers-reduced-motion: reduce)";
function subscribeReduced(onChange: () => void) {
  const media = window.matchMedia(reducedQuery);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}
function subscribeHidden(onChange: () => void) {
  document.addEventListener("visibilitychange", onChange);
  return () => document.removeEventListener("visibilitychange", onChange);
}

/**
 * The top-features selector: a vertical tablist on the left, the chosen
 * feature's preview on the right (client's design, "more interactive, like
 * Outrank").
 *
 * It moves on to the next feature on its own, and the active tab's progress
 * bar IS the timer: the bar is a CSS animation and the switch happens on its
 * `animationend`, so pausing the animation pauses the rotation exactly where
 * it was. It pauses while the pointer is over it or focus is inside it, while
 * it is off screen and while the browser tab is hidden. Reduced motion: no
 * bar and no rotation; the visitor picks.
 *
 * Every panel is in the server HTML (the inactive ones `hidden`), so crawlers
 * and visitors without JavaScript get the first feature in full and the rest
 * in the source. The server renders with "reduced motion" assumed, so there is
 * no progress bar until the browser says otherwise.
 */
export function FeatureSelector({
  items,
  labelledBy,
  next,
  note,
  noteDetail,
  children,
}: {
  items: SelectorItem[];
  /** id of the section heading that names the tablist. */
  labelledBy: string;
  next: string;
  note: string;
  noteDetail: string;
  /** The mascot, drawn by the server above the box. */
  children?: ReactNode;
}) {
  const base = useId();
  const [active, setActive] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [inView, setInView] = useState(false);
  const reduced = useSyncExternalStore(
    subscribeReduced,
    () => window.matchMedia(reducedQuery).matches,
    () => true,
  );
  const hidden = useSyncExternalStore(
    subscribeHidden,
    () => document.hidden,
    () => true,
  );
  const box = useRef<HTMLDivElement>(null);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    const el = box.current;
    // Without an observer the selector never knows it is on screen, so it
    // simply stays put - the visitor still has the tabs and the button.
    if (!el || !("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver(([entry]) => setInView(Boolean(entry?.isIntersecting)), { threshold: 0.35 });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const count = items.length;
  const paused = hovered || focused || !inView || hidden;
  const advance = () => setActive((i) => (i + 1) % count);

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const last = count - 1;
    let to: number | null = null;
    // Vertical on desktop, a two-column grid on tablets: both arrow pairs work.
    if (event.key === "ArrowDown" || event.key === "ArrowRight") to = index === last ? 0 : index + 1;
    else if (event.key === "ArrowUp" || event.key === "ArrowLeft") to = index === 0 ? last : index - 1;
    else if (event.key === "Home") to = 0;
    else if (event.key === "End") to = last;
    if (to === null) return;
    event.preventDefault();
    setActive(to);
    tabs.current[to]?.focus();
  };

  const tabId = (i: number) => `${base}-tab-${i}`;
  const panelId = (i: number) => `${base}-panel-${i}`;

  return (
    <div
      ref={box}
      className={styles.product}
      onPointerEnter={(e) => e.pointerType === "mouse" && setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false);
      }}
    >
      {children}
      <div className={styles.fsLayout}>
        <div className={styles.fsNav} role="tablist" aria-orientation="vertical" aria-labelledby={labelledBy}>
          {items.map((item, i) => {
            const selected = i === active;
            return (
              <button
                key={tabId(i)}
                ref={(el) => {
                  tabs.current[i] = el;
                }}
                type="button"
                role="tab"
                id={tabId(i)}
                aria-selected={selected}
                aria-controls={panelId(i)}
                tabIndex={selected ? 0 : -1}
                className={`${styles.fsItem} ${fx.focusable}`}
                onClick={() => setActive(i)}
                onKeyDown={(e) => onKeyDown(e, i)}
              >
                <span className={fx.tabLabel}>
                  <span>{item.nav}</span>
                  {selected && !reduced ? (
                    <span className={styles.fsProgress} aria-hidden="true">
                      <i
                        style={{ animationDuration: `${DWELL_MS}ms`, animationPlayState: paused ? "paused" : "running" }}
                        onAnimationEnd={advance}
                      />
                    </span>
                  ) : null}
                </span>
                <ArrowIcon />
              </button>
            );
          })}
        </div>

        <div className={styles.fsDetail}>
          {items.map((item, i) => (
            <div
              key={panelId(i)}
              id={panelId(i)}
              role="tabpanel"
              aria-labelledby={tabId(i)}
              hidden={i !== active}
              tabIndex={0}
              className={`${styles.fsPanel} ${fx.focusable}`}
            >
              <div className={styles.fsHead}>
                <div>
                  <span className={styles.fsKicker}>{item.kicker}</span>
                  <h3 className={styles.fsTitle}>{item.title}</h3>
                </div>
                <div className={styles.chips}>
                  {item.chips.map((chip, j) => (
                    <span key={`${j}-${chip}`} className={styles.chip}>
                      <BrandIcon name={item.chipIcons[j] ?? "spark"} className={fx.chipIcon} />
                      {chip}
                    </span>
                  ))}
                </div>
              </div>

              <div className={styles.canvas}>
                <div className={styles.canvasCard}>
                  <h4>{item.listTitle}</h4>
                  <ul className={styles.queue}>
                    {item.list.map((row, j) => (
                      <li key={`${j}-${row.title}`}>
                        <CheckIcon />
                        <div>
                          <strong>{row.title}</strong>
                          <span>{row.detail}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className={styles.canvasCard}>
                  <h4>{item.sideTitle}</h4>
                  <p>{item.sideBody}</p>
                  <div className={styles.tags}>
                    {item.tags.map((tag, j) => (
                      <span key={`${j}-${tag}`}>{tag}</span>
                    ))}
                  </div>
                  <div className={styles.bars} aria-hidden="true">
                    {(BARS[i % BARS.length] ?? []).map((height, j) => (
                      <span key={j} style={{ height: `${height}%`, animationDelay: `${j * 70}ms` }} />
                    ))}
                  </div>
                </div>
              </div>

              <p className={styles.fsDescription}>{item.description}</p>
            </div>
          ))}
        </div>
      </div>

      <div className={styles.productBottom}>
        <SparkIcon />
        <strong>{note}</strong>
        <span>{noteDetail}</span>
        <button type="button" className={`${styles.nextButton} ${fx.focusable}`} onClick={advance}>
          {next} <span aria-hidden="true">↗</span>
        </button>
      </div>
    </div>
  );
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M4 12h15m-6-6 6 6-6 6" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="m4.5 12.5 5 5 10-11" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    </svg>
  );
}

function SparkIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="m12 2 2.1 7 7 2.1-7 2.1-2.1 7-2.1-7-7-2.1 7-2.1L12 2Z" fill="none" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.6" />
    </svg>
  );
}
