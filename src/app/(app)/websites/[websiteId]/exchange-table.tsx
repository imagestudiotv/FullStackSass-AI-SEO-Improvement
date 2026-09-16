"use client";

import { ChevronDown, Info } from "lucide-react";
import { useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

/**
 * The two exchange tables: links this site gave, and links it received.
 *
 * Both answer the same shape of question — which article, whose website, when,
 * what did it cost — so they share one component rather than drifting into two
 * tables that gradually stop matching.
 *
 * Five rows, then "Show more". A site in the network for a year has hundreds
 * of these, and the page exists to be glanced at: the recent ones are what
 * anybody checks, and the rest are there when someone is actually auditing.
 * Client-side rather than paged, because the whole list is already loaded and
 * a round trip to reveal rows already in memory would be slower for no gain.
 */

const FIRST_SHOWN = 5;

/** A column heading with an explanation behind an icon. */
function HeadingHint({ text }: { text: string }) {
  return (
    <span
      title={text}
      aria-label={text}
      className="ml-1 inline-flex translate-y-px cursor-help text-muted-foreground/70"
    >
      <Info className="size-3.5" aria-hidden="true" />
    </span>
  );
}

export type ExchangeColumn<Row> = {
  key: string;
  header: string;
  /** Shown behind the info icon beside the heading. */
  hint?: string;
  /** Hidden below md, for columns that are not worth a phone's width. */
  secondary?: boolean;
  className?: string;
  render: (row: Row) => ReactNode;
};

export function ExchangeTable<Row extends { id: string }>({
  rows,
  columns,
  /** Newest first by default; the Date heading flips it. */
  sortValue,
  empty,
  minWidth = "40rem",
}: {
  rows: Row[];
  columns: ExchangeColumn<Row>[];
  sortValue: (row: Row) => number;
  /**
   * Optional: callers that already handle the empty case above the table
   * render nothing here rather than passing a placeholder.
   */
  empty?: ReactNode;
  minWidth?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [newestFirst, setNewestFirst] = useState(true);

  if (rows.length === 0) return <>{empty ?? null}</>;

  const sorted = [...rows].sort((a, b) =>
    newestFirst ? sortValue(b) - sortValue(a) : sortValue(a) - sortValue(b),
  );
  const shown = expanded ? sorted : sorted.slice(0, FIRST_SHOWN);
  const hidden = sorted.length - shown.length;

  return (
    <div className="overflow-hidden rounded-xl border">
      <Table minWidth={minWidth}>
        <TableHeader>
          <TableRow className="bg-muted/40">
            {columns.map((column) => (
              <TableHead
                key={column.key}
                className={[
                  column.className ?? "",
                  column.secondary ? "hidden md:table-cell" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {/*
                  Only the date sorts. Sorting by article title or domain is
                  a control nobody reaches for here, and every extra affordance
                  in a heading row is one more thing to read past.
                */}
                {column.key === "date" ? (
                  <button
                    type="button"
                    onClick={() => setNewestFirst((value) => !value)}
                    aria-label={
                      newestFirst
                        ? "Sort by date, oldest first"
                        : "Sort by date, newest first"
                    }
                    className="inline-flex items-center gap-1 transition-colors hover:text-foreground"
                  >
                    {column.header}
                    <ChevronDown
                      className={[
                        "size-3.5 transition-transform",
                        newestFirst ? "" : "rotate-180",
                      ].join(" ")}
                      aria-hidden="true"
                    />
                  </button>
                ) : (
                  column.header
                )}
                {column.hint ? <HeadingHint text={column.hint} /> : null}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {shown.map((row) => (
            <TableRow key={row.id}>
              {columns.map((column) => (
                <TableCell
                  key={column.key}
                  className={[
                    column.className ?? "",
                    column.secondary ? "hidden md:table-cell" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {column.render(row)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {hidden > 0 || expanded ? (
        <div className="border-t p-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setExpanded((value) => !value)}
            aria-expanded={expanded}
          >
            <ChevronDown
              className={[
                "size-4 transition-transform",
                expanded ? "rotate-180" : "",
              ].join(" ")}
              aria-hidden="true"
            />
            {expanded ? "Show less" : `Show more (${hidden} more)`}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
