import { AlertTriangle, ArrowLeft, ArrowRight, Check, Info } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { checkRobots } from "@/lib/tools/robots";
import { RobotsForm } from "./robots-form";

export const metadata = {
  title: "robots.txt checker",
  description:
    "Check whether your robots.txt is accidentally blocking search engines from your website. Free, no account needed.",
  alternates: { canonical: "/tools/robots-checker" },
};

// Fetches a live website per request, so it can never be prerendered.
export const dynamic = "force-dynamic";

export default async function RobotsCheckerPage({
  searchParams,
}: PageProps<"/tools/robots-checker">) {
  const params = await searchParams;
  const domain = typeof params.domain === "string" ? params.domain.trim() : "";

  const outcome = domain ? await checkRobots(domain) : null;

  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <Button variant="ghost" size="sm" asChild className="-ml-2 mb-6">
        <Link href="/tools">
          <ArrowLeft className="size-4" />
          All tools
        </Link>
      </Button>

      <h1 className="text-3xl font-semibold tracking-tight">
        robots.txt checker
      </h1>
      <p className="mt-3 text-muted-foreground">
        A robots.txt file tells search engines which parts of your site they may
        read. A single wrong line can hide your entire website from Google, and
        you cannot tell by looking at the site.
      </p>

      <div className="mt-8">
        <RobotsForm key={domain} defaultValue={domain} />
      </div>

      {outcome && !outcome.ok ? (
        <div
          className="mt-8 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm"
          role="alert"
        >
          <p className="font-medium">We could not check that website</p>
          <p className="mt-1 text-muted-foreground">{outcome.error}</p>
        </div>
      ) : null}

      {outcome?.ok ? (
        <div className="mt-10 space-y-4">
          {/*
            The headline verdict. "Disallow: /" for all crawlers is the one
            finding that matters more than everything else on the page, so it
            is stated first and unmistakably.
          */}
          {outcome.result.blocksEverything ? (
            <Card className="border-destructive/40">
              <CardContent className="flex gap-3 py-5">
                <AlertTriangle
                  className="mt-0.5 size-5 shrink-0 text-destructive"
                  aria-hidden="true"
                />
                <div>
                  <p className="font-medium">
                    Your site is blocking all search engines
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    robots.txt contains <code>Disallow: /</code> for every
                    crawler, which asks Google to ignore the whole site. This is
                    usually left over from a staging site. Until it is removed,
                    nothing here can rank.
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : !outcome.result.found ? (
            <Card>
              <CardContent className="flex gap-3 py-5">
                <Info
                  className="mt-0.5 size-5 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
                <div>
                  <p className="font-medium">No robots.txt found</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    That is usually fine — with no file, search engines may read
                    everything. Adding one lets you point them at your sitemap.
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="flex gap-3 py-5">
                <Check
                  className="mt-0.5 size-5 shrink-0 text-emerald-600 dark:text-emerald-400"
                  aria-hidden="true"
                />
                <div>
                  <p className="font-medium">
                    Search engines are not blocked from your site
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Nothing in robots.txt stops crawlers reading your pages.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="space-y-4 py-5 text-sm">
              <div>
                <p className="font-medium">Sitemap</p>
                {outcome.result.sitemaps.length > 0 ? (
                  <ul className="mt-1 space-y-1">
                    {outcome.result.sitemaps.map((sitemap) => (
                      <li key={sitemap} className="truncate text-muted-foreground">
                        {sitemap}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1 text-muted-foreground">
                    No sitemap is listed. Adding one helps search engines find
                    every page instead of following links to them.
                  </p>
                )}
              </div>

              {outcome.result.disallowed.length > 0 ? (
                <div>
                  <p className="font-medium">Blocked paths</p>
                  <ul className="mt-1 space-y-1">
                    {outcome.result.disallowed.slice(0, 10).map((rule, i) => (
                      <li
                        key={`${rule}-${i}`}
                        className="truncate font-mono text-xs text-muted-foreground"
                      >
                        {rule}
                      </li>
                    ))}
                  </ul>
                  {outcome.result.disallowed.length > 10 ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      and {outcome.result.disallowed.length - 10} more
                    </p>
                  ) : null}
                </div>
              ) : null}

              <p className="text-xs text-muted-foreground">
                Read the file yourself at{" "}
                <a
                  href={outcome.result.robotsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-4"
                >
                  {outcome.result.robotsUrl}
                </a>
              </p>
            </CardContent>
          </Card>

          <div className="rounded-lg border bg-muted/30 p-6">
            <p className="font-medium">Check the rest of your site</p>
            <p className="mt-1 text-sm text-muted-foreground">
              robots.txt is one of many things that can keep a site out of
              Google. Our free check reads your pages and reports the rest.
            </p>
            <Button asChild className="mt-4">
              <Link href={`/audit?domain=${encodeURIComponent(outcome.result.domain)}`}>
                Check my website
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
