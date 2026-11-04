"use client";

import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

import type { FeatureCard, FeatureIcon, FeatureItem } from "@/lib/i18n/home/features";

import styles from "./sections/top-features.module.css";

const c = (names: string) =>
  names
    .split(" ")
    .map((n) => styles[n] ?? n)
    .join(" ");

/**
 * The top features' product box (design script `rgx-dashboard-functional-tabs`):
 * seven features on the left, the chosen one's preview on the right, and
 * "Next feature" in the bottom bar to step through them. Nothing moves on its
 * own; the visitor picks.
 *
 * A tab pattern: the list is a tablist (arrow keys, Home and End move and
 * select), and every feature's panel is in the server HTML with the inactive
 * ones `hidden`, so crawlers and visitors without JavaScript get them all.
 */
export function TopFeaturesTabs({
  items,
  labelledBy,
  note,
  noteDetail,
  next,
  children,
}: {
  items: FeatureItem[];
  /** id of the section heading that names the tablist. */
  labelledBy: string;
  note: string;
  noteDetail: string;
  next: string;
  /** The mascot, drawn by the server on the box's top edge. */
  children?: ReactNode;
}) {
  const base = useId();
  const [active, setActive] = useState(0);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const count = items.length;

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const last = count - 1;
    let to: number | null = null;
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
    <div className={c("hp-product rfs-product")}>
      {children}
      <div className={c("rfs-layout")}>
        <div className={c("rfs-nav")} role="tablist" aria-orientation="vertical" aria-labelledby={labelledBy}>
          {items.map((item, i) => (
            <button
              key={tabId(i)}
              ref={(el) => {
                tabs.current[i] = el;
              }}
              type="button"
              role="tab"
              id={tabId(i)}
              aria-selected={i === active}
              aria-controls={panelId(i)}
              tabIndex={i === active ? 0 : -1}
              className={c(i === active ? "rfs-item active" : "rfs-item")}
              onClick={() => setActive(i)}
              onKeyDown={(e) => onKeyDown(e, i)}
            >
              <span>{item.nav}</span>
              <Icon name="arrow" />
            </button>
          ))}
        </div>

        {items.map((item, i) => (
          <div
            key={panelId(i)}
            id={panelId(i)}
            role="tabpanel"
            aria-labelledby={tabId(i)}
            hidden={i !== active}
            tabIndex={0}
            className={c("rfs-detail-wrap")}
          >
            <div className={c("rfs-detail-head")}>
              <div>
                <span className={c("rfs-kicker")}>{item.kicker}</span>
                <h3>{item.title}</h3>
              </div>
              <div className={c("rfs-chip-row")}>
                {item.chips.map((chip) => (
                  <span key={chip.label} className={c("rfs-chip")}>
                    <Icon name={chip.icon} />
                    {chip.label}
                  </span>
                ))}
              </div>
            </div>
            <div className={c("rfs-preview-canvas")}>
              <div className={c("rfs-panel-grid")}>
                <Card card={item.main} big />
                <Card card={item.side} />
              </div>
            </div>
            <div className={c("rfs-detail-copy")}>
              <p>{item.description}</p>
            </div>
          </div>
        ))}
      </div>
      <div className={c("hp-product-bottom")}>
        <Icon name="spark" />
        <strong>{note}</strong>
        <span>{noteDetail}</span>
        <button type="button" onClick={() => setActive((i) => (i + 1) % count)}>
          {next} ↗
        </button>
      </div>
    </div>
  );
}

/** One card of the preview canvas, its parts in the design's order. */
function Card({ card, big = false }: { card: FeatureCard; big?: boolean }) {
  return (
    <div className={c(big ? "rfs-big-card" : "rfs-card")}>
      <h4>{card.title}</h4>
      {card.platforms ? (
        <div className={c("rfs-platforms")}>
          {card.platforms.map((p) => (
            <div key={p.label} className={c("rfs-platform")}>
              <Icon name={p.icon} /> {p.label}
            </div>
          ))}
        </div>
      ) : null}
      {card.queue ? (
        <div className={c("rfs-queue")}>
          {card.queue.map((row) => (
            <div key={row.title} className={c("rfs-queue-row")}>
              <Icon name="share" />
              <div>
                <strong>{row.title}</strong>
                <span>{row.detail}</span>
              </div>
            </div>
          ))}
        </div>
      ) : null}
      {card.checks ? (
        <div className={c("rfs-checks")}>
          {card.checks.map((row) => (
            <div key={row.title} className={c("rfs-check")}>
              <Icon name="check" />
              <div>
                <strong>{row.title}</strong>
                <span>{row.detail}</span>
              </div>
            </div>
          ))}
        </div>
      ) : null}
      {card.roadmap ? (
        <div className={c("rfs-roadmap")}>
          {card.roadmap.map((row) => (
            <div key={row.title} className={c("rfs-road-step")}>
              <strong>{row.title}</strong>
              <span>{row.detail}</span>
            </div>
          ))}
        </div>
      ) : null}
      {card.stats ? (
        <div className={c("rfs-stats")}>
          {card.stats.map((stat) => (
            <div key={stat.label} className={c("rfs-stat")}>
              <small>{stat.label}</small>
              <strong>{stat.value}</strong>
              <em>{stat.note}</em>
            </div>
          ))}
        </div>
      ) : null}
      {card.tags ? (
        <div className={c("rfs-tags")}>
          {card.tags.map((tag) => (
            <span key={tag}>{tag}</span>
          ))}
        </div>
      ) : null}
      {card.text ? <p>{card.text}</p> : null}
      {card.bars ? (
        <div className={c("rfs-bars")} aria-hidden="true">
          <span />
          <span />
          <span />
          <span />
          <span />
        </div>
      ) : null}
    </div>
  );
}

/** The design's `hp-icon-*` symbols, drawn inline. */
function Icon({ name }: { name: FeatureIcon | "arrow" | "check" }) {
  return (
    <svg className={c("hp-svg")} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {PATHS[name]}
    </svg>
  );
}

const line = { fill: "none", stroke: "currentColor" } as const;

const PATHS: Record<FeatureIcon | "arrow" | "check", ReactNode> = {
  arrow: <path d="M4 12h15m-6-6 6 6-6 6" {...line} strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />,
  check: <path d="m4.5 12.5 5 5 10-11" {...line} strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />,
  spark: <path d="m12 2 2.1 7 7 2.1-7 2.1-2.1 7-2.1-7-7-2.1 7-2.1L12 2Z" {...line} strokeLinejoin="round" strokeWidth="1.6" />,
  globe: (
    <>
      <circle cx="12" cy="12" r="9" {...line} strokeWidth="1.8" />
      <path d="M3 12h18M12 3c-5 5.4-5 12.6 0 18M12 3c5 5.4 5 12.6 0 18" {...line} strokeWidth="1.5" />
    </>
  ),
  search: (
    <>
      <circle cx="10.8" cy="10.8" r="6.4" {...line} strokeWidth="1.8" />
      <path d="m16 16 4.1 4.1" {...line} strokeWidth="1.8" strokeLinecap="round" />
    </>
  ),
  share: (
    <>
      <circle cx="5" cy="12" r="2.6" {...line} strokeWidth="1.7" />
      <circle cx="19" cy="5" r="2.6" {...line} strokeWidth="1.7" />
      <circle cx="19" cy="19" r="2.6" {...line} strokeWidth="1.7" />
      <path d="m7.4 10.9 9.2-4.6m-9.2 6.8 9.2 4.6" {...line} strokeWidth="1.7" />
    </>
  ),
  chart: <path d="M4 20V4M4 20h16M7 15l4-4 3 2 5-7" {...line} strokeWidth="1.9" strokeLinejoin="round" strokeLinecap="round" />,
  content: (
    <>
      <rect x="5" y="3" width="14" height="18" rx="2" {...line} strokeWidth="1.8" />
      <path d="M8 8h8M8 12h8M8 16h5" {...line} strokeWidth="1.6" strokeLinecap="round" />
    </>
  ),
  brief: (
    <>
      <rect x="3" y="7" width="18" height="14" rx="2.4" {...line} strokeWidth="1.7" />
      <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12c6 4 12 4 18 0" {...line} strokeWidth="1.5" />
    </>
  ),
  store: <path d="M4 9h16v12H4V9Zm-1-4h18l-2 4H5L3 5Zm6 16v-7h6v7" {...line} strokeWidth="1.6" strokeLinejoin="round" />,
  shield: (
    <>
      <path d="M12 2 20 6v6c0 4.5-3 8-8 10-5-2-8-5.5-8-10V6l8-4Z" {...line} strokeWidth="1.7" />
      <path d="m8.5 12 2.5 2.5 4.5-5" {...line} strokeWidth="1.7" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3" {...line} strokeWidth="1.7" />
      <path
        d="M3 20c0-3.5 2.3-5.8 6-5.8s6 2.3 6 5.8M16 5.1c2.6 0 3.7 1.5 3.7 3.1 0 1.7-1.3 3.2-3.7 3.2M18 14c2.2.4 3 2.3 3 5.8"
        {...line}
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </>
  ),
  yt: (
    <>
      <rect x="2" y="5" width="20" height="14" rx="4" fill="currentColor" />
      <path d="m10 8.5 6 3.5-6 3.5v-7Z" fill="#fff" />
    </>
  ),
  ig: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="5" {...line} strokeWidth="2" />
      <circle cx="12" cy="12" r="4" {...line} strokeWidth="2" />
      <circle cx="17.4" cy="6.9" r="1.3" fill="currentColor" />
    </>
  ),
  fb: (
    <>
      <circle cx="12" cy="12" r="10" fill="currentColor" />
      <path
        d="M14 21v-8h3l.4-3H14V8c0-1 .4-1.5 1.6-1.5H18v-3c-.9-.1-1.9-.2-2.8-.2-3.3 0-4.5 1.9-4.5 4.5V10H8v3h2.7v8H14Z"
        fill="white"
      />
    </>
  ),
};
