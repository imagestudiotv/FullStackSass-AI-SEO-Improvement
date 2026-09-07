import { ArrowUpRight, Link2 } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { AuthorityPoint } from "@/lib/dashboard/overview";

/**
 * Website authority: backlinks earned, credits left, and the trend.
 *
 * An area chart rather than a bar chart, because the series is a running
 * total. Bars invite reading each day as a separate quantity, which would make
 * a steady climb look like a repeated event.
 *
 * Hand-drawn SVG rather than a charting library: it is one series with no
 * axes, no legend and no interaction, and the whole thing is smaller than the
 * import would be.
 */

function Sparkline({ points }: { points: AuthorityPoint[] }) {
  if (points.length < 2) return null;

  const width = 560;
  const height = 120;
  const max = Math.max(...points.map((p) => p.backlinks), 1);

  const coords = points.map((point, index) => {
    const x = (index / (points.length - 1)) * width;
    // Inverted: SVG y grows downward, and a rising count should rise.
    const y = height - (point.backlinks / max) * (height - 8);
    return { x, y };
  });

  const line = coords
    .map((c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(1)},${c.y.toFixed(1)}`)
    .join(" ");

  // Closed back along the baseline so the area under the line can be filled.
  const area = `${line} L${width},${height} L0,${height} Z`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className="h-24 w-full"
      role="img"
      aria-label={`Backlinks over the last ${points.length - 1} days, ending at ${points[points.length - 1].backlinks}`}
    >
      <defs>
        <linearGradient id="authority-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--chart-line)" stopOpacity="0.28" />
          <stop offset="100%" stopColor="var(--chart-line)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#authority-fill)" />
      <path
        d={line}
        fill="none"
        stroke="var(--chart-line)"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

export function AuthorityPanel({
  websiteId,
  verifiedBacklinks,
  availableCredits,
  chart,
}: {
  websiteId: string;
  verifiedBacklinks: number;
  availableCredits: number;
  chart: AuthorityPoint[];
}) {
  const first = chart[0];
  const last = chart[chart.length - 1];

  return (
    <Card>
      <CardContent className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">
              Website authority
            </p>
            <h2 className="mt-1 flex items-center gap-2 text-lg font-semibold">
              Backlinks
            </h2>
          </div>
          <Button variant="ghost" size="sm" asChild className="size-8 p-0">
            <Link
              href={`/websites/${websiteId}/backlinks`}
              aria-label="Open backlinks"
            >
              <ArrowUpRight className="size-4" />
            </Link>
          </Button>
        </div>

        <div className="rounded-lg border bg-muted/30 p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <Link2 className="size-3.5" aria-hidden="true" />
              Backlink exchange
            </p>
            <Button variant="outline" size="sm" asChild className="h-7 text-xs">
              <Link href="/billing">Get credits</Link>
            </Button>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-4">
            <div>
              <p className="text-2xl font-semibold tabular-nums">
                {verifiedBacklinks}
              </p>
              <p className="text-xs text-muted-foreground">Verified backlinks</p>
            </div>
            <div>
              <p className="text-2xl font-semibold tabular-nums">
                {availableCredits}
              </p>
              <p className="text-xs text-muted-foreground">Available credits</p>
            </div>
          </div>

          {verifiedBacklinks > 0 ? (
            <div className="mt-3">
              <Sparkline points={chart} />
              <div className="flex justify-between text-[0.7rem] text-muted-foreground">
                <span>{first?.date}</span>
                <span>{last?.date}</span>
              </div>
            </div>
          ) : (
            <p className="mt-4 text-xs text-muted-foreground">
              No links yet. Once other sites in the network link to yours, the
              count and the trend appear here.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
