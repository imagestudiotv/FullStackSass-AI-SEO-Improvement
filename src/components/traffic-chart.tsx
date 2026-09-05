"use client";

import { useId, useState } from "react";

import type { TrafficPoint } from "@/lib/articles/decay";

/**
 * Daily Search Console clicks across the two comparison windows.
 *
 * The decay list says WHICH pages fell and by how much; a pair of totals cannot
 * say WHEN. A steady slide and a cliff after one algorithm update produce
 * identical before/after numbers and need completely different responses, so
 * the shape is the part worth drawing.
 *
 * Hand-rolled SVG rather than a charting dependency: this is one line over
 * fifty-odd points, the project ships no chart library, and the audit page
 * already draws its score ring the same way.
 *
 * Colours are the brand orange at steps validated against both surfaces —
 * oklch L 0.646 on white and L 0.655 on the dark card, which is inside the
 * 0.48–0.67 band dark mode requires. A single series needs no legend; the
 * card title names it.
 */

/** Chart geometry, in SVG user units. */
const WIDTH = 640;
const HEIGHT = 160;
const PAD_LEFT = 34;
const PAD_RIGHT = 8;
const PAD_TOP = 12;
const PAD_BOTTOM = 22;

const PLOT_W = WIDTH - PAD_LEFT - PAD_RIGHT;
const PLOT_H = HEIGHT - PAD_TOP - PAD_BOTTOM;

function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

export function TrafficChart({ series }: { series: TrafficPoint[] }) {
  const gradientId = useId();
  const [hover, setHover] = useState<number | null>(null);

  if (series.length < 2) return null;

  const max = Math.max(...series.map((p) => p.clicks), 1);
  const x = (i: number) => PAD_LEFT + (i / (series.length - 1)) * PLOT_W;
  const y = (v: number) => PAD_TOP + PLOT_H - (v / max) * PLOT_H;

  const line = series.map((p, i) => `${x(i)},${y(p.clicks)}`).join(" ");
  const area = `${PAD_LEFT},${PAD_TOP + PLOT_H} ${line} ${PAD_LEFT + PLOT_W},${PAD_TOP + PLOT_H}`;

  /**
   * The boundary between the two windows the decay comparison uses. Drawing it
   * is what lets someone see whether the drop happened before or after the
   * point the numbers above are measured from.
   */
  const midIndex = Math.floor(series.length / 2);

  const total = series.reduce((sum, p) => sum + p.clicks, 0);
  const recent = series.slice(midIndex).reduce((s, p) => s + p.clicks, 0);
  const prior = total - recent;

  const active = hover === null ? null : series[hover];

  return (
    <figure className="m-0">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full"
        role="img"
        aria-label={`Daily clicks over the last ${series.length} days. ${prior} clicks in the earlier window, ${recent} in the recent one.`}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--chart-line)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--chart-line)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Recessive gridlines: three is enough to read a magnitude against. */}
        {[0, 0.5, 1].map((frac) => (
          <line
            key={frac}
            x1={PAD_LEFT}
            x2={PAD_LEFT + PLOT_W}
            y1={PAD_TOP + PLOT_H * frac}
            y2={PAD_TOP + PLOT_H * frac}
            className="stroke-border"
            strokeWidth="1"
          />
        ))}

        {/* y labels: only max and zero — a value on every gridline is noise. */}
        <text x="0" y={PAD_TOP + 4} className="fill-muted-foreground text-[10px]">
          {max}
        </text>
        <text
          x="0"
          y={PAD_TOP + PLOT_H + 4}
          className="fill-muted-foreground text-[10px]"
        >
          0
        </text>

        {/* The window boundary. Dashed so it reads as an annotation, not data. */}
        <line
          x1={x(midIndex)}
          x2={x(midIndex)}
          y1={PAD_TOP}
          y2={PAD_TOP + PLOT_H}
          className="stroke-muted-foreground/40"
          strokeWidth="1"
          strokeDasharray="3 3"
        />

        <polygon points={area} fill={`url(#${gradientId})`} />
        <polyline
          points={line}
          fill="none"
          stroke="var(--chart-line)"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Crosshair and marker for the hovered day. */}
        {active ? (
          <>
            <line
              x1={x(hover!)}
              x2={x(hover!)}
              y1={PAD_TOP}
              y2={PAD_TOP + PLOT_H}
              className="stroke-muted-foreground/50"
              strokeWidth="1"
            />
            <circle
              cx={x(hover!)}
              cy={y(active.clicks)}
              r="4"
              fill="var(--chart-line)"
              // A surface-coloured ring keeps the marker legible over the line.
              className="stroke-card"
              strokeWidth="2"
            />
          </>
        ) : null}

        {/* Date labels at each end, so the span is readable without a tooltip. */}
        <text
          x={PAD_LEFT}
          y={HEIGHT - 6}
          className="fill-muted-foreground text-[10px]"
        >
          {formatDate(series[0].date)}
        </text>
        <text
          x={PAD_LEFT + PLOT_W}
          y={HEIGHT - 6}
          textAnchor="end"
          className="fill-muted-foreground text-[10px]"
        >
          {formatDate(series[series.length - 1].date)}
        </text>

        {/*
          Invisible hit areas, one per day and far wider than the line itself.
          Pointing at a 2px stroke is not a realistic target.
        */}
        {series.map((point, i) => (
          <rect
            key={point.date}
            x={x(i) - PLOT_W / series.length / 2}
            y={PAD_TOP}
            width={PLOT_W / series.length}
            height={PLOT_H}
            fill="transparent"
            onMouseEnter={() => setHover(i)}
          />
        ))}
      </svg>

      <figcaption className="mt-1 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>
          {active ? (
            <>
              <span className="font-medium text-foreground">
                {active.clicks} {active.clicks === 1 ? "click" : "clicks"}
              </span>
              <span className="mx-1.5">·</span>
              {formatDate(active.date)}
            </>
          ) : (
            <>
              Earlier 28 days:{" "}
              <span className="font-medium text-foreground">{prior}</span>
              <span className="mx-1.5">·</span>
              Last 28:{" "}
              <span className="font-medium text-foreground">{recent}</span>
            </>
          )}
        </span>
        <span className="tabular-nums">{total} clicks total</span>
      </figcaption>
    </figure>
  );
}
