"use client";

import { useEffect, useId, useState, type KeyboardEvent } from "react";

import type { CalculatorCopy } from "@/lib/partners/presentation/copy";

import styles from "./partners-page.module.css";

export type { CalculatorCopy };

export type CalculatorPlan = { id: string; name: string; priceCents: number; currency: string };
export type CalculatorTier = { name: string; rateBasisPoints: number; minCustomers: number };


/** The most paying customers the estimate goes to: past the top level, so every level can be explored. */
const MAX_CUSTOMERS = 75;
/** Dots drawn at most; a bigger network shows this many and says so. */
const MAX_DOTS = 48;
/** Where "Restart network" starts again. */
const RESTART = 5;

const fill = (template: string, values: Record<string, string | number>) => template.replace(/\{(\w+)\}/g, (match, key: string) => (key in values ? String(values[key]) : match));

/**
 * The commission on one payment of `priceCents` at `rateBasisPoints`, rounded
 * half up at the minor unit - the same rule as the real calculation
 * (lib/partners/domain/policies/commission.ts), so the estimate never shows a
 * cent the program would not pay.
 */
export function commissionPerPayment(priceCents: number, rateBasisPoints: number): number {
  return Math.floor((priceCents * rateBasisPoints + 5_000) / 10_000);
}

/** The level for a number of paying customers: the highest whose threshold is reached. */
export function levelFor(tiers: CalculatorTier[], customers: number): CalculatorTier {
  const sorted = [...tiers].sort((a, b) => a.minCustomers - b.minCustomers);
  return sorted.filter((tier) => tier.minCustomers <= customers).at(-1) ?? sorted[0];
}

/** "Growth" for "Growth Partner": the level's name where there is room for one word. */
export function shortTierName(name: string): string {
  return name.replace(/\s+partner$/i, "") || name;
}

/**
 * What "Watch your network grow" grows to from `count`: the next level's
 * threshold, then twice the top one; past that it starts again.
 */
export function growthTarget(tiers: CalculatorTier[], count: number): number {
  const thresholds = [...new Set(tiers.map((tier) => tier.minCustomers).filter((min) => min > 0))].sort((a, b) => a - b);
  const top = thresholds.at(-1) ?? 10;
  const steps = [...thresholds, Math.min(MAX_CUSTOMERS, top * 2)];
  return steps.find((step) => step > count) ?? RESTART;
}

type Point = { x: number; y: number };
const CENTER = { x: 275, y: 158 };
const round = (value: number) => Math.round(value * 100) / 100;

/**
 * Where each dot sits: one ring up to 12, then rings of 12, 16 and 20 (the
 * design's constellation). Rounded, so the server's and the browser's
 * drawing agree.
 */
export function networkPoints(count: number): Point[] {
  const visible = Math.min(count, MAX_DOTS);
  return Array.from({ length: visible }, (_, i) => {
    const single = count <= 12;
    const ring = single ? 0 : i < 12 ? 0 : i < 28 ? 1 : 2;
    const start = single ? 0 : [0, 12, 28][ring];
    const capacity = single ? count : [Math.min(count, 12), Math.min(Math.max(count - 12, 0), 16), Math.min(Math.max(count - 28, 0), 20)][ring];
    const angle = -Math.PI / 2 + ((i - start) / Math.max(1, capacity)) * Math.PI * 2 + [0, 0.12, 0.065][ring];
    const radius = single ? 102 : [70, 109, 132][ring];
    return { x: round(CENTER.x + Math.cos(angle) * radius), y: round(CENTER.y + Math.sin(angle) * radius) };
  });
}

/** The quiet dotted grid behind the network: drawn once. */
const GRID: (Point & { near: boolean })[] = (() => {
  const dots: (Point & { near: boolean })[] = [];
  for (let x = 25; x < 550; x += 28)
    for (let y = 18; y < 355; y += 28) {
      const distance = Math.hypot(x - CENTER.x, y - CENTER.y);
      if (distance <= 220) dots.push({ x, y, near: distance < 145 });
    }
  return dots;
})();

/** "**direct**" in a sentence, bold. */
function withBold(text: string) {
  return text.split("**").map((part, index) => (index % 2 === 1 ? <strong key={index}>{part}</strong> : part));
}

/**
 * The earnings explorer on /partners (Daniel's design, 2026-11-07): a
 * simulated network of the customers a partner refers directly, beside the
 * estimate - a plan, a number of paying customers, the level it reaches, and
 * the commission per month and over the commission period.
 *
 * Plans, levels and the period come from the server (the plans table and the
 * program policy in force), never from this file. The network is an
 * illustration only: nothing here is a real referral, commission or claim,
 * and it says so. "Watch your network grow" counts up with a timer that
 * stops when it arrives, when anything else is touched and when the page
 * goes; with reduced motion it jumps straight there. The dots are one tab
 * stop (arrow keys move between them, Enter or Space picks one), and a tap
 * picks one on a phone.
 */
export function EarningsCalculator({
  plans,
  tiers,
  months,
  copy,
  intlLocale,
}: {
  plans: CalculatorPlan[];
  tiers: CalculatorTier[];
  months: number;
  copy: CalculatorCopy;
  /** A BCP 47 tag for number formatting (en-IE, es-ES, ...). */
  intlLocale: string;
}) {
  const id = useId();
  // The design opens on the middle plan (Grow).
  const [planId, setPlanId] = useState(plans[Math.min(1, plans.length - 1)]?.id ?? "");
  const [count, setCount] = useState(10);
  /** What the number field shows while it is being typed in; null shows the count. */
  const [typed, setTyped] = useState<string | null>(null);
  const [selected, setSelected] = useState(6);
  const [hovered, setHovered] = useState<number | null>(null);
  /** Where "Watch your network grow" is counting to, while it runs. */
  const [target, setTarget] = useState<number | null>(null);

  useEffect(() => {
    if (target === null) return;
    const timer = setTimeout(
      () => {
        const next = Math.min(MAX_CUSTOMERS, count + 1);
        setCount(next);
        if (next >= target) setTarget(null);
      },
      Math.max(36, Math.min(92, 1400 / Math.max(1, target - count))),
    );
    return () => clearTimeout(timer);
  }, [target, count]);

  const plan = plans.find((candidate) => candidate.id === planId) ?? plans[0];
  if (!plan || tiers.length === 0) return null;

  const sorted = [...tiers].sort((a, b) => a.minCustomers - b.minCustomers);
  const money = (cents: number) =>
    new Intl.NumberFormat(intlLocale, { style: "currency", currency: plan.currency.toUpperCase(), minimumFractionDigits: cents % 100 === 0 ? 0 : 2 }).format(cents / 100);
  const percent = (basisPoints: number) => new Intl.NumberFormat(intlLocale, { style: "percent", maximumFractionDigits: 2 }).format(basisPoints / 10_000);
  const level = levelFor(sorted, count);
  const each = commissionPerPayment(plan.priceCents, level.rateBasisPoints);
  const monthly = count * each;
  const points = networkPoints(count);
  const shown = Math.max(0, Math.min(hovered ?? selected, points.length - 1));
  const pad = (n: number) => String(n).padStart(2, "0");
  const next = growthTarget(sorted, count);
  const filled = ((count - 1) / (MAX_CUSTOMERS - 1)) * 100;

  const clamp = (value: number) => Math.min(MAX_CUSTOMERS, Math.max(1, Math.round(Number.isFinite(value) ? value : 1)));
  /** A count chosen by hand: the growth demonstration stops. */
  function choose(value: number) {
    setTarget(null);
    setTyped(null);
    setCount(clamp(value));
  }
  function grow() {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setTyped(null);
    if (reduced || next === RESTART) {
      setTarget(null);
      setCount(next);
    } else setTarget(next);
  }
  function pick(index: number) {
    setSelected(index);
    setHovered(null);
  }
  function onDotKey(event: KeyboardEvent<SVGGElement>, index: number) {
    const last = points.length - 1;
    const move = { ArrowRight: index + 1, ArrowDown: index + 1, ArrowLeft: index - 1, ArrowUp: index - 1, Home: 0, End: last }[event.key];
    if (move !== undefined) {
      event.preventDefault();
      const to = (move + points.length) % points.length;
      pick(to);
      (event.currentTarget.parentElement?.children[to] as SVGGElement | undefined)?.focus();
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      pick(index);
    }
  }

  return (
    <div className={styles.calculator} id="calculator" role="region" aria-labelledby={`${id}-head`}>
      <div className={styles.calcHead}>
        <span id={`${id}-head`}>
          {copy.head}
          <span className={styles.slash} aria-hidden="true">
            /
          </span>
          {copy.headSub}
        </span>
        <small>
          <i className={styles.liveDot} aria-hidden="true" /> {copy.headBadge}
        </small>
      </div>

      <div className={styles.calcContent}>
        <div className={styles.calcVisual}>
          <div className={styles.networkHeader}>
            <p className={styles.smallTitle}>
              <span className={styles.dot} aria-hidden="true" /> {copy.network}
            </p>
            <span className={styles.networkLive}>
              <i aria-hidden="true" /> {copy.live}
            </span>
          </div>

          <div className={styles.diagram}>
            <div className={styles.graphBadge}>
              <strong>{count}</strong>
              <span>{copy.direct}</span>
            </div>
            <div className={styles.graphHint} aria-hidden="true">
              {count > MAX_DOTS ? (
                fill(copy.hintMany, { shown: MAX_DOTS })
              ) : (
                <>
                  <span className={styles.hintIcon}>↖</span> {copy.hint}
                </>
              )}
            </div>
            <svg viewBox="0 0 550 355" role="group" aria-label={copy.svgLabel}>
              <defs>
                <radialGradient id={`${id}-core`} cx="32%" cy="27%" r="77%">
                  <stop offset="0%" stopColor="#ffb579" />
                  <stop offset="53%" stopColor="#f47a37" />
                  <stop offset="100%" stopColor="#d94913" />
                </radialGradient>
              </defs>
              <g aria-hidden="true" className={styles.netGrid}>
                {GRID.map((dot) => (
                  <circle key={`${dot.x}-${dot.y}`} cx={dot.x} cy={dot.y} r={0.55} fill="#b2805e" fillOpacity={dot.near ? 0.18 : 0.1} />
                ))}
                {[84, 134, 169].map((r, index) => (
                  <circle
                    key={r}
                    cx={CENTER.x}
                    cy={CENTER.y}
                    r={r}
                    className={index === 1 ? `${styles.netOrbit} ${styles.netOrbitActive}` : styles.netOrbit}
                    opacity={index === 2 ? 0.45 : 1}
                  />
                ))}
                <circle cx={CENTER.x} cy={CENTER.y} r={188} fill="none" stroke="#9c5b38" strokeWidth={0.6} strokeOpacity={0.11} strokeDasharray="2 13" />
              </g>
              <g aria-hidden="true">
                {points.map((point, index) => (
                  <line
                    key={index}
                    x1={CENTER.x}
                    y1={CENTER.y}
                    x2={point.x}
                    y2={point.y}
                    className={index === shown ? `${styles.netLink} ${styles.linkSelected}` : styles.netLink}
                  />
                ))}
              </g>
              <g aria-hidden="true">
                <circle cx={CENTER.x} cy={CENTER.y} r={62} fill="#ec6b2e" fillOpacity={0.1} className={styles.centerGlow} />
                <circle cx={CENTER.x} cy={CENTER.y} r={43} fill="none" stroke="#f78b4d" strokeOpacity={0.56} strokeWidth={1} className={styles.centerRing} />
                <circle cx={CENTER.x} cy={CENTER.y} r={34} fill="#211c19" stroke="#ffaa71" strokeOpacity={0.56} strokeWidth={1.4} />
                <circle cx={CENTER.x} cy={CENTER.y} r={27} fill={`url(#${id}-core)`} />
                <text x={CENTER.x} y={CENTER.y + 4.5} textAnchor="middle" fontSize={12} letterSpacing={0.5} fontWeight={900} fill="#171310">
                  {copy.you}
                </text>
              </g>
              <g>
                {points.map((point, index) => (
                  <g
                    key={index}
                    className={`${styles.netNode} ${styles.nodeIn}${index === shown ? ` ${styles.nodeSelected}` : ""}`}
                    style={{ animationDelay: `${Math.min((index % 16) * 12, 200)}ms` }}
                    role="button"
                    tabIndex={index === Math.min(selected, points.length - 1) ? 0 : -1}
                    aria-label={fill(copy.nodeLabel, { n: index + 1 })}
                    aria-pressed={index === Math.min(selected, points.length - 1)}
                    onMouseEnter={() => setHovered(index)}
                    onMouseLeave={() => setHovered(null)}
                    onFocus={() => setHovered(index)}
                    onBlur={() => setHovered(null)}
                    onClick={() => pick(index)}
                    onKeyDown={(event) => onDotKey(event, index)}
                  >
                    <circle cx={point.x} cy={point.y} r={13.5} className={styles.nodeHalo} />
                    <circle cx={point.x} cy={point.y} r={6} className={styles.nodeDot} />
                    <circle cx={point.x} cy={point.y} r={16} className={styles.netHit} />
                  </g>
                ))}
              </g>
            </svg>
          </div>

          <div className={styles.inspector} aria-live="polite">
            <div className={styles.inspectorIcon} aria-hidden="true">
              {pad(shown + 1)}
            </div>
            <div className={styles.inspectorCopy}>
              <small>{copy.selected}</small>
              <strong>{fill(copy.referral, { n: pad(shown + 1) })}</strong>
              <span>{copy.kind}</span>
            </div>
            <div className={styles.inspectorAmount}>
              <strong>
                {new Intl.NumberFormat(intlLocale, { style: "currency", currency: plan.currency.toUpperCase(), minimumFractionDigits: 2 }).format(each / 100)}
              </strong>
              <span>{copy.perMonth}</span>
            </div>
          </div>

          <div className={styles.networkActions}>
            <button type="button" className={styles.networkAdd} onClick={() => choose(count + 1)} disabled={count >= MAX_CUSTOMERS}>
              <span className={styles.plus} aria-hidden="true">
                +
              </span>
              {copy.add}
            </button>
            <button type="button" className={styles.networkDemo} onClick={grow} disabled={target !== null}>
              {next === RESTART ? copy.restart : fill(copy.explore, { count: next })} <span aria-hidden="true">↗</span>
            </button>
          </div>
          <p className={styles.fineprint}>{withBold(copy.fineprint)}</p>
        </div>

        <div className={styles.calcControls}>
          <p className={styles.smallTitle}>{copy.scenario}</p>

          <div className={styles.calcSection}>
            <div className={styles.fieldHeader}>
              <span className={styles.label} id={`${id}-plan`}>
                {copy.plan}
              </span>
              <span className={styles.note}>{copy.monthlyPrices}</span>
            </div>
            <div className={styles.planSwitch} role="group" aria-labelledby={`${id}-plan`} style={{ gridTemplateColumns: `repeat(${plans.length}, minmax(0, 1fr))` }}>
              {plans.map((option) => (
                <button key={option.id} type="button" className={styles.planButton} aria-pressed={option.id === plan.id} onClick={() => setPlanId(option.id)}>
                  <strong>{option.name}</strong>
                  <small>
                    {fill(copy.planPrice, {
                      price: new Intl.NumberFormat(intlLocale, {
                        style: "currency",
                        currency: option.currency.toUpperCase(),
                        minimumFractionDigits: option.priceCents % 100 === 0 ? 0 : 2,
                      }).format(option.priceCents / 100),
                    })}
                  </small>
                </button>
              ))}
            </div>
          </div>

          <div className={styles.calcSection}>
            <div className={styles.fieldHeader}>
              <label htmlFor={`${id}-count`}>{copy.customers}</label>
              <div className={styles.counter}>
                <input
                  id={`${id}-count`}
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={MAX_CUSTOMERS}
                  value={typed ?? count}
                  onChange={(event) => {
                    const value = event.target.value;
                    // Emptied while typing: kept empty until a number comes, then the count follows.
                    if (value === "") setTyped("");
                    else choose(Number(value));
                  }}
                  onBlur={() => setTyped(null)}
                />
                <small aria-hidden="true">{copy.people}</small>
              </div>
            </div>
            <input
              className={styles.range}
              type="range"
              min={1}
              max={MAX_CUSTOMERS}
              step={1}
              value={count}
              aria-label={copy.customers}
              onChange={(event) => choose(Number(event.target.value))}
              style={{ background: `linear-gradient(to right, #fa762e 0%, #fa762e ${filled}%, #50564e ${filled}%, #50564e 100%)` }}
            />
            <div className={styles.ticks} aria-hidden="true">
              <span>1</span>
              {sorted
                .filter((tier) => tier.minCustomers > 1 && tier.minCustomers < MAX_CUSTOMERS)
                .map((tier) => (
                  <span key={tier.minCustomers}>
                    {tier.minCustomers} · {shortTierName(tier.name)}
                  </span>
                ))}
              <span>{MAX_CUSTOMERS}</span>
            </div>
          </div>

          <ul className={styles.tierGroup} aria-label={copy.rates} style={{ gridTemplateColumns: `repeat(${sorted.length}, minmax(0, 1fr))`, listStyle: "none", margin: 0, padding: 0 }}>
            {sorted.map((tier) => (
              <li key={tier.minCustomers} className={tier === level ? `${styles.tier} ${styles.tierActive}` : styles.tier} aria-current={tier === level || undefined}>
                <div className={styles.tName}>{shortTierName(tier.name)}</div>
                <div className={styles.tRate}>{percent(tier.rateBasisPoints)}</div>
                <div className={styles.tWhen}>{fill(copy.from, { count: Math.max(1, tier.minCustomers) })}</div>
              </li>
            ))}
          </ul>

          <div aria-live="polite" className={styles.result}>
            <span className={styles.srOnly}>{fill(copy.level, { count, tier: level.name, rate: percent(level.rateBasisPoints) })}</span>
            <div>
              <div className={styles.resultCaption}>{copy.potential}</div>
              <div className={styles.resultMoney}>
                <span>{money(monthly)}</span>
                <span className={styles.per}>{copy.perMonthShort}</span>
              </div>
            </div>
            <div className={styles.yearly}>
              <strong>{money(monthly * months)}</strong>
              <small>{fill(copy.projection, { months })}</small>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.calcFoot}>
        <span>
          <strong>{copy.footStrong}</strong> {copy.footBody}
        </span>
        <a href="#faq">
          {copy.footLink} <span aria-hidden="true">↗</span>
        </a>
      </div>
    </div>
  );
}
