import { Check } from "lucide-react";
import Link from "next/link";

import { relatedTools } from "@/lib/tools/registry";

/**
 * Shared furniture for a tool page, following the reference layout: breadcrumb,
 * three reassurance badges, title and description, then the form, then prose
 * and a grid of other tools.
 *
 * Every tool page having the same skeleton is the point — these pages are
 * mostly reached from search, one at a time, and someone landing on the third
 * one should recognise it immediately.
 */

export function ToolBreadcrumb({ title }: { title: string }) {
  return (
    <nav
      aria-label="Breadcrumb"
      className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground"
    >
      <Link href="/" className="hover:text-foreground">
        Home
      </Link>
      <span aria-hidden="true">/</span>
      <Link href="/tools" className="text-primary hover:underline">
        Free tools
      </Link>
      <span aria-hidden="true">/</span>
      {/* The current page is not a link — it is where you already are. */}
      <span className="text-foreground">{title}</span>
    </nav>
  );
}

/** The reference's "100% free · No signup · Instant result" row. */
export function ToolBadges() {
  return (
    <ul className="mt-5 flex flex-wrap gap-2">
      {["100% free", "No signup", "Instant result"].map((label) => (
        <li
          key={label}
          className="flex items-center gap-1.5 rounded-full border border-primary/30 px-3 py-1 text-xs font-medium text-primary"
        >
          <Check className="size-3" aria-hidden="true" />
          {label}
        </li>
      ))}
    </ul>
  );
}

/**
 * The tinted hero the reference puts behind every tool's title and form.
 *
 * Full-bleed: it runs edge to edge while its content stays on the page grid.
 */
export function ToolHero({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-primary/[0.04]">
      <div className="mx-auto max-w-5xl px-4 py-10 sm:py-14">
        <ToolBreadcrumb title={title} />
        <ToolBadges />
        <h1 className="mt-5 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          {title}
        </h1>
        <p className="mt-4 max-w-3xl text-pretty text-muted-foreground">
          {description}
        </p>
        <div className="mt-8">{children}</div>
      </div>
    </div>
  );
}

/** Two columns of explanation, as the reference has under each tool. */
export function ToolExplainer({
  columns,
}: {
  columns: { heading: string; body: string }[];
}) {
  return (
    <div className="mx-auto grid max-w-5xl gap-10 px-4 py-14 sm:grid-cols-2">
      {columns.map((column) => (
        <section key={column.heading}>
          <h2 className="text-xl font-semibold tracking-tight">
            {column.heading}
          </h2>
          <p className="mt-3 text-pretty text-muted-foreground">
            {column.body}
          </p>
        </section>
      ))}
    </div>
  );
}

/** "More free tools" — the same card as the hub, three across. */
export function MoreTools({ currentHref }: { currentHref: string }) {
  const tools = relatedTools(currentHref);

  return (
    <div className="mx-auto max-w-5xl px-4 pb-16">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-xl font-semibold tracking-tight">More free tools</h2>
        <Link
          href="/tools"
          className="text-sm font-medium text-primary hover:underline"
        >
          All tools
        </Link>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tools.map((tool) => (
          <Link
            key={tool.href}
            href={tool.href}
            className="flex gap-3 rounded-xl border bg-card p-4 transition-colors hover:border-primary/40"
          >
            <span
              className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-base"
              aria-hidden="true"
            >
              {tool.emoji}
            </span>
            <span className="min-w-0">
              <span className="block font-medium">{tool.title}</span>
              <span className="mt-0.5 block text-sm text-muted-foreground">
                {tool.blurb}
              </span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

/** The dark closing CTA the reference ends every tool page with. */
export function ToolCta({
  headline,
  body,
}: {
  headline: string;
  body: string;
}) {
  return (
    <div className="bg-foreground text-background">
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h2 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
          {headline}
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-pretty opacity-80">{body}</p>
        <Link
          href="/audit"
          className="mt-8 inline-flex h-11 items-center rounded-full bg-primary px-7 font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          Get your free audit
        </Link>
      </div>
    </div>
  );
}
