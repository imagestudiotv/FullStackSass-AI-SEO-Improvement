import type { ReactNode } from "react";

/**
 * Shared shell for policy pages.
 *
 * Long-form legal text needs a narrower measure than the app's pages — around
 * 65 characters per line — or it becomes genuinely hard to read, which is the
 * opposite of what a policy is for.
 */
export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  /** Shown to the reader; policies are meaningless without a date. */
  updated: string;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Last updated {updated}
      </p>
      <div
        className="mt-10 space-y-6 text-sm leading-relaxed text-muted-foreground
          [&_a]:font-medium [&_a]:text-foreground [&_a]:underline [&_a]:underline-offset-4
          [&_h2]:mt-10 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-foreground
          [&_li]:my-1 [&_p]:my-3 [&_strong]:text-foreground
          [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5"
      >
        {children}
      </div>
    </div>
  );
}
