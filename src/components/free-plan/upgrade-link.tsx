"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { recordUpgradeClickAction } from "@/lib/plans/free-plan-actions";

/**
 * A link to the paid plans from a Free prompt, which also records the click
 * for the launch dashboard (Admin -> Free plan launch: "upgrade requests").
 * The navigation never waits for the record, and never fails because of it.
 */
export function UpgradeLink({
  href,
  source,
  className,
  children,
}: {
  href: string;
  /** Where the prompt is, e.g. "indicator", "backlinks", "videos", "billing". */
  source: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={className}
      onClick={() => {
        void recordUpgradeClickAction(source).catch(() => {});
      }}
    >
      {children}
    </Link>
  );
}
