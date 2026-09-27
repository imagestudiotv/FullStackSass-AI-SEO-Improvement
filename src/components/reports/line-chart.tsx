"use client";

import { useId, useMemo, useState, type KeyboardEvent } from "react";

import { intlTag } from "@/lib/i18n/format";
import { formatValue } from "@/lib/reporting/format";
import type { Locale } from "@/lib/i18n/config";

/**
 * One series, one unit, drawn as SVG (the project ships no chart library).
 *
 * - Never two units on one axis: the caller picks a single series.
 * - A null value is "no data" (e.g. Search Console has not reported that day
 *   yet): the line breaks there instead of dropping to zero.
 * - Keyboard: focus the chart, then Left/Right/Home/End move between days;
 *   the tooltip announces the day, value and unit.
 * - A data table (caption + rows) is always present for screen readers and
 *   can be shown by the caller's "Details" view.
 */

export type ChartPoint = { day: string; value: number | null };

/** Drawing sizes: "compact" for small cards, so axis text stays legible when scaled. */
const SIZES = {
  regular: { width: 720, height: 220, pad: { left: 48, right: 12, top: 12, bottom: 28 } },
  compact: { width: 380, height: 150, pad: { left: 34, right: 8, top: 10, bottom: 24 } },
} as const;


function niceMax(max: number): number {
  if (max <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(max));
  const step = [1, 2, 2.5, 5, 10].find((s) => s * magnitude >= max / 4) ?? 10;
  return Math.ceil(max / (step * magnitude)) * step * magnitude;
}

export function LineChart({
  points,
  label,
  unit,
  unitLabel,
  locale,
  noDataLabel,
  dayLabel,
  valueLabel,
  instructions,
  size = "regular",
}: {
  points: ChartPoint[];
  /** What the series is, e.g. "Article clicks from Google". Also the table caption. */
  label: string;
  unit: { kind: "count" } | { kind: "currency"; currency: string };
  /** Spoken unit, e.g. "clicks". */
  unitLabel: string;
  locale: Locale;
  noDataLabel: string;
  dayLabel: string;
  valueLabel: string;
  instructions: string;
  size?: keyof typeof SIZES;
}) {
  const { width: WIDTH, height: HEIGHT, pad: PAD } = SIZES[size];
  const id = useId();
  const [active, setActive] = useState<number | null>(null);
  const tag = intlTag(locale);

  const geometry = useMemo(() => {
    const values = points.map((p) => p.value).filter((v): v is number => v !== null);
    const max = niceMax(values.length ? Math.max(...values) : 0);
    const innerW = WIDTH - PAD.left - PAD.right;
    const innerH = HEIGHT - PAD.top - PAD.bottom;
    const x = (i: number) => PAD.left + (points.length <= 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
    const y = (v: number) => PAD.top + innerH - (v / max) * innerH;
    // Segments break at null values.
    const segments: string[] = [];
    let current: string[] = [];
    points.forEach((p, i) => {
      if (p.value === null) {
        if (current.length) segments.push(current.join(" "));
        current = [];
        return;
      }
      current.push(`${current.length ? "L" : "M"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`);
    });
    if (current.length) segments.push(current.join(" "));
    const ticks = [0, max / 2, max];
    return { max, x, y, segments, ticks, innerH };
  }, [points, WIDTH, HEIGHT, PAD]);

  const day = (iso: string, opts: Intl.DateTimeFormatOptions) =>
    new Date(`${iso}T00:00:00Z`).toLocaleDateString(tag, { timeZone: "UTC", ...opts });

  const onKey = (event: KeyboardEvent<SVGSVGElement>) => {
    if (points.length === 0) return;
    const last = points.length - 1;
    const i = active ?? last;
    const next =
      event.key === "ArrowLeft" ? Math.max(0, i - 1)
      : event.key === "ArrowRight" ? Math.min(last, i + 1)
      : event.key === "Home" ? 0
      : event.key === "End" ? last
      : null;
    if (next === null) return;
    event.preventDefault();
    setActive(next);
  };

  const activePoint = active !== null ? points[active] : null;
  const activeText = activePoint
    ? `${day(activePoint.day, { day: "numeric", month: "short", year: "numeric" })}: ${
        activePoint.value === null ? noDataLabel : `${formatValue(activePoint.value, unit, locale)} ${unit.kind === "count" ? unitLabel : ""}`.trim()
      }`
    : "";
  const labelIndexes = points.length > 2 ? [0, Math.floor((points.length - 1) / 2), points.length - 1] : points.map((_, i) => i);

  return (
    <figure className="relative w-full">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="h-auto w-full touch-pan-y rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        role="img"
        tabIndex={0}
        aria-label={`${label}. ${instructions}`}
        aria-describedby={`${id}-live`}
        onKeyDown={onKey}
        onMouseLeave={() => setActive(null)}
        onBlur={() => setActive(null)}
        onPointerMove={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          const ratio = (event.clientX - rect.left) / rect.width;
          const xView = ratio * WIDTH;
          const inner = WIDTH - PAD.left - PAD.right;
          const i = Math.round(((xView - PAD.left) / inner) * (points.length - 1));
          setActive(Math.max(0, Math.min(points.length - 1, i)));
        }}
      >
        {geometry.ticks.map((tick) => (
          <g key={tick}>
            <line x1={PAD.left} x2={WIDTH - PAD.right} y1={geometry.y(tick)} y2={geometry.y(tick)} className="stroke-border" strokeDasharray="3 4" />
            <text x={PAD.left - 6} y={geometry.y(tick) + 4} textAnchor="end" className="fill-muted-foreground text-[11px]">
              {formatValue(tick, unit, locale, true)}
            </text>
          </g>
        ))}
        {labelIndexes.map((i) => (
          <text key={i} x={geometry.x(i)} y={HEIGHT - 8} textAnchor={i === 0 ? "start" : i === points.length - 1 ? "end" : "middle"} className="fill-muted-foreground text-[11px]">
            {points[i] ? day(points[i].day, { day: "numeric", month: "short" }) : ""}
          </text>
        ))}
        {geometry.segments.map((d, i) => (
          <path key={i} d={d} fill="none" className="stroke-violet-600 dark:stroke-violet-400" strokeWidth={2.25} strokeLinejoin="round" strokeLinecap="round" />
        ))}
        {activePoint ? (
          <g>
            <line x1={geometry.x(active!)} x2={geometry.x(active!)} y1={PAD.top} y2={PAD.top + geometry.innerH} className="stroke-muted-foreground" strokeDasharray="2 3" />
            {activePoint.value !== null ? (
              <circle cx={geometry.x(active!)} cy={geometry.y(activePoint.value)} r={4.5} className="fill-violet-600 stroke-background dark:fill-violet-400" strokeWidth={2} />
            ) : null}
          </g>
        ) : null}
      </svg>
      {activePoint ? (
        <div
          className="pointer-events-none absolute top-1 rounded-md border bg-popover px-2 py-1 text-xs shadow-sm"
          style={{ left: `clamp(0px, calc(${(geometry.x(active!) / WIDTH) * 100}% - 70px), calc(100% - 150px))` }}
          aria-hidden="true"
        >
          {activeText}
        </div>
      ) : null}
      <p id={`${id}-live`} className="sr-only" aria-live="polite">
        {activeText}
      </p>
      <figcaption className="sr-only">
        <table>
          <caption>{label}</caption>
          <thead>
            <tr>
              <th scope="col">{dayLabel}</th>
              <th scope="col">{valueLabel}</th>
            </tr>
          </thead>
          <tbody>
            {points.map((p) => (
              <tr key={p.day}>
                <th scope="row">{day(p.day, { day: "numeric", month: "long", year: "numeric" })}</th>
                <td>{p.value === null ? noDataLabel : formatValue(p.value, unit, locale)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </figcaption>
    </figure>
  );
}
