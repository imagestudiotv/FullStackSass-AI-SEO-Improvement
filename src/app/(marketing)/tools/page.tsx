import {
  ArrowRight,
  FileSearch,
  Gauge,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";

import { Card, CardContent } from "@/components/ui/card";

export const metadata = {
  title: "Free SEO tools",
  description:
    "Free tools to check your website: a full health check, search snippet preview, and a robots.txt checker. No account needed.",
};

/**
 * Free tools hub.
 *
 * These exist to be found by people searching for the tool rather than for us,
 * and to give them something genuinely useful before asking for anything. Every
 * one works without an account — a "free tool" behind a signup form is a lead
 * form wearing a costume, and people can tell.
 *
 * The audit is listed first because it is the real product doing real work; the
 * others are small and instant.
 */

type Tool = {
  href: string;
  title: string;
  description: string;
  icon: LucideIcon;
  /** Set for the one that does the most. */
  featured?: boolean;
};

const TOOLS: Tool[] = [
  {
    href: "/audit",
    title: "Website health check",
    description:
      "We read your pages and show you what is holding you back on Google — missing titles, thin pages, duplicate descriptions and more.",
    icon: Gauge,
    featured: true,
  },
  {
    href: "/tools/snippet-preview",
    title: "Search result preview",
    description:
      "See how your title and description will look on Google, and whether they are about to be cut short.",
    icon: FileSearch,
  },
  {
    href: "/tools/robots-checker",
    title: "robots.txt checker",
    description:
      "Check whether your site is accidentally telling search engines to stay away — a common leftover from a staging site.",
    icon: ShieldCheck,
  },
];

export default function ToolsPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-16">
      <div className="text-center">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Free SEO tools
        </h1>
        <p className="mx-auto mt-3 max-w-lg text-muted-foreground">
          Useful on their own, no account needed. They use the same checks as
          our paid product.
        </p>
      </div>

      <div className="mt-12 grid gap-4 sm:grid-cols-2">
        {TOOLS.map((tool) => (
          <Link
            key={tool.href}
            href={tool.href}
            // The featured tool takes the full row on wider screens.
            className={tool.featured ? "sm:col-span-2" : undefined}
          >
            <Card className="h-full transition-colors hover:border-primary/40">
              <CardContent className="flex gap-4 py-6">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                  <tool.icon
                    className="size-5 text-muted-foreground"
                    aria-hidden="true"
                  />
                </div>
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 font-medium">
                    {tool.title}
                    <ArrowRight className="size-3.5" aria-hidden="true" />
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {tool.description}
                  </p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <p className="mt-12 text-center text-sm text-muted-foreground">
        Want all of this running automatically, with articles written for you?{" "}
        <Link href="/pricing" className="underline underline-offset-4">
          See pricing
        </Link>
      </p>
    </div>
  );
}
