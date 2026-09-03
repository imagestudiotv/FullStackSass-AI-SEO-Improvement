import { AlertTriangle, Check, Info } from "lucide-react";

import { DomainToolForm } from "@/components/domain-tool-form";
import {
  MoreTools,
  ToolCta,
  ToolExplainer,
  ToolHero,
} from "@/components/tool-page";
import { checkRobots } from "@/lib/tools/robots";

export const metadata = {
  title: "Robots.txt Checker",
  description:
    "Check whether your robots.txt is accidentally blocking search engines from your website. Free, no account needed.",
  alternates: { canonical: "/tools/robots-checker" },
};

// Fetches a live website per request, so it can never be prerendered.
export const dynamic = "force-dynamic";

const HREF = "/tools/robots-checker";

export default async function RobotsCheckerPage({
  searchParams,
}: PageProps<"/tools/robots-checker">) {
  const params = await searchParams;
  const domain = typeof params.domain === "string" ? params.domain.trim() : "";

  const outcome = domain ? await checkRobots(domain) : null;

  return (
    <div>
      <ToolHero
        title="Robots.txt Checker"
        description="A robots.txt file tells search engines which parts of your site they may read. A single wrong line can hide your entire website from Google, and you cannot tell by looking at the site."
      >
        <DomainToolForm
          key={domain}
          action={HREF}
          defaultValue={domain}
          submitLabel="Check robots.txt"
        />
      </ToolHero>

      <div className="mx-auto max-w-5xl px-4">
        {outcome && !outcome.ok ? (
          <div
            className="mt-10 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm"
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
              <div className="flex gap-3 rounded-xl border border-destructive/40 bg-destructive/5 p-5">
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
              </div>
            ) : !outcome.result.found ? (
              <div className="flex gap-3 rounded-xl border bg-card p-5">
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
              </div>
            ) : (
              <div className="flex gap-3 rounded-xl border bg-card p-5">
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
              </div>
            )}

            <div className="space-y-4 rounded-xl border bg-card p-5 text-sm">
              <div>
                <p className="font-medium">Sitemap</p>
                {outcome.result.sitemaps.length > 0 ? (
                  <ul className="mt-1 space-y-1">
                    {outcome.result.sitemaps.map((sitemap) => (
                      <li
                        key={sitemap}
                        className="truncate text-muted-foreground"
                      >
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
                  rel="noopener noreferrer nofollow"
                  className="underline underline-offset-4"
                >
                  {outcome.result.robotsUrl}
                </a>
              </p>
            </div>
          </div>
        ) : null}
      </div>

      <ToolExplainer
        columns={[
          {
            heading: "What this checks",
            body: "We fetch your robots.txt and look for the one thing that matters most: a rule blocking every crawler from the whole site. We also list any sitemaps it declares and the paths it blocks, and show you the raw file's address so you can read exactly what we read.",
          },
          {
            heading: "The failure nobody notices",
            body: "A site launches, and the \"Disallow: /\" from the staging server comes with it. The website works perfectly. Every page loads. Nothing in any dashboard complains. It simply never appears in Google, and by the time somebody thinks to check this file, months of content have been published into a site search engines were told to ignore.",
          },
        ]}
      />

      <MoreTools currentHref={HREF} />

      <ToolCta
        headline="Check the rest of your site"
        body="robots.txt is one of many things that can keep a site out of Google. Our free check reads your pages and reports the rest."
      />
    </div>
  );
}
