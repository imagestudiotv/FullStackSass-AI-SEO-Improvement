import { Check } from "lucide-react";
import Link from "next/link";

import { TOOL_CATEGORIES, toolsByCategory } from "@/lib/tools/registry";

export const metadata = {
  title: "Free SEO & AI visibility tools",
  description:
    "Free tools to check your site: SEO score, robots.txt, sitemaps, AI crawler access, llms.txt, keyword density and more. No signup, real results.",
};

/**
 * Free tools hub.
 *
 * These exist to be found by people searching for the tool rather than for us,
 * and to give them something genuinely useful before asking for anything. Every
 * one works without an account — a "free tool" behind a signup form is a lead
 * form wearing a costume, and people can tell.
 */
export default function ToolsPage() {
  return (
    <div>
      {/* Tinted hero, matching the tool pages themselves. */}
      <div className="bg-primary/[0.04]">
        <div className="mx-auto max-w-5xl px-4 py-16 text-center sm:py-20">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 px-3 py-1 text-xs font-medium text-primary">
            <Check className="size-3" aria-hidden="true" />
            Free tools
          </span>
          <h1 className="mt-6 text-3xl font-semibold tracking-tight text-balance sm:text-5xl">
            Try our free SEO &amp; AI visibility tools
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-pretty text-muted-foreground">
            No signup required — every tool runs a real check and shows the full
            result instantly.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-5xl space-y-12 px-4 py-16">
        {TOOL_CATEGORIES.map((category) => (
          <section key={category}>
            <h2 className="text-xs font-semibold tracking-[0.14em] text-primary uppercase">
              {category}
            </h2>

            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {toolsByCategory(category).map((tool) => (
                <Link
                  key={tool.href}
                  href={tool.href}
                  className="flex gap-3 rounded-xl border bg-card p-4 transition-colors hover:border-primary/40"
                >
                  <span
                    className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-lg"
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
          </section>
        ))}

        <p className="text-center text-sm text-muted-foreground">
          Want all of this running automatically, with articles written for you?{" "}
          <Link href="/pricing" className="underline underline-offset-4">
            See pricing
          </Link>
        </p>
      </div>
    </div>
  );
}
