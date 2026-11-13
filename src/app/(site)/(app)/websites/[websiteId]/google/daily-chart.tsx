"use client";

import { useState } from "react";

import { LineChart, type ChartPoint } from "@/components/reports/line-chart";
import type { Locale } from "@/lib/i18n/config";
import { cn } from "@/lib/utils";

export type DailySeries = {
  key: string;
  /** The button text and the chart's name, e.g. "Clicks". */
  name: string;
  /** What the chart is, for screen readers and its table caption. */
  label: string;
  /** Spoken unit, e.g. "clicks". */
  unitLabel: string;
  points: ChartPoint[];
};

/**
 * One stored daily series at a time, in its own unit (the shared LineChart,
 * as the Dashboard draws it, in the brand colour). Days a source did not
 * report stay null, so the line breaks there instead of dropping to zero.
 *
 * The series choice is local to the chart: it changes no figure and no
 * query, so it is not worth a URL parameter or a server round trip.
 */
export function GoogleDailyChart({
  series,
  locale,
  labels,
}: {
  series: DailySeries[];
  locale: Locale;
  labels: {
    /** Accessible name of the series buttons. */
    choose: string;
    noData: string;
    day: string;
    instructions: string;
    /** Shown instead of an empty chart. */
    empty: string;
  };
}) {
  const [key, setKey] = useState(series[0]?.key ?? "");
  const current = series.find((s) => s.key === key) ?? series[0];
  if (!current) return null;
  const chartable = current.points.some((p) => p.value !== null);

  return (
    <div className="space-y-3">
      {series.length > 1 ? (
        <div role="group" aria-label={labels.choose} className="inline-flex max-w-full flex-wrap rounded-lg border p-0.5 text-sm">
          {series.map((s) => (
            <button
              key={s.key}
              type="button"
              aria-pressed={s.key === current.key}
              onClick={() => setKey(s.key)}
              className={cn(
                "rounded-md px-3 py-1 transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transition-none",
                s.key === current.key ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {s.name}
            </button>
          ))}
        </div>
      ) : null}
      {chartable ? (
        <LineChart
          points={current.points}
          label={current.label}
          unit={{ kind: "count" }}
          unitLabel={current.unitLabel}
          locale={locale}
          noDataLabel={labels.noData}
          dayLabel={labels.day}
          valueLabel={current.name}
          instructions={labels.instructions}
          tone="brand"
        />
      ) : (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">{labels.empty}</p>
      )}
    </div>
  );
}
