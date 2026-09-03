import { AlertTriangle, Check, FileCode, X } from "lucide-react";

import { DomainToolForm } from "@/components/domain-tool-form";
import {
  MoreTools,
  ToolCta,
  ToolExplainer,
  ToolHero,
} from "@/components/tool-page";
import { checkSitemap } from "@/lib/tools/sitemap";

export const metadata = {
  title: "Sitemap Checker & Finder",
  description:
    "Find your XML sitemap the way a search engine does, and check it actually works. Free, no signup.",
};

// Fetches a live website per request, so it can never be prerendered.
export const dynamic = "force-dynamic";

const HREF = "/tools/sitemap-checker";

export default async function SitemapCheckerPage({
  searchParams,
}: PageProps<"/tools/sitemap-checker">) {
  const params = await searchParams;
  const domain = typeof params.domain === "string" ? params.domain.trim() : "";
  const outcome = domain ? await checkSitemap(domain) : null;

  return (
    <div>
      <ToolHero
        title="Sitemap Checker & Finder"
        description="Finds your sitemap the way a search engine does — robots.txt first, then the usual locations — then checks it actually parses and counts what is in it. Index files are followed, so you get a real page count rather than a zero."
      >
        <DomainToolForm
          key={domain}
          action={HREF}
          defaultValue={domain}
          submitLabel="Check sitemap"
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
            {/* Headline numbers first. */}
            <div className="grid gap-4 sm:grid-cols-3">
              {[
                {
                  label: "Sitemaps found",
                  value: String(
                    outcome.result.found.filter((f) => f.ok).length,
                  ),
                },
                {
                  label: "Pages listed",
                  value: outcome.result.totalUrls.toLocaleString(),
                },
                {
                  label: "In robots.txt",
                  value: outcome.result.declaredInRobots.length > 0 ? "Yes" : "No",
                },
              ].map((stat) => (
                <div key={stat.label} className="rounded-xl border bg-card p-5">
                  <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    {stat.label}
                  </p>
                  <p className="mt-2 text-2xl font-semibold tabular-nums">
                    {stat.value}
                  </p>
                </div>
              ))}
            </div>

            {/*
              Not being declared in robots.txt is the single most common real
              problem here, and it is invisible from the site itself.
            */}
            {outcome.result.declaredInRobots.length === 0 ? (
              <div className="flex gap-3 rounded-xl border border-amber-500/40 bg-amber-500/5 p-4">
                <AlertTriangle
                  className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400"
                  aria-hidden="true"
                />
                <div className="text-sm">
                  <p className="font-medium">
                    Your sitemap is not listed in robots.txt
                  </p>
                  <p className="mt-1 text-muted-foreground">
                    Add a line reading{" "}
                    <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
                      Sitemap: {outcome.result.found[0]?.url ?? `https://${outcome.result.domain}/sitemap.xml`}
                    </code>{" "}
                    to {outcome.result.robotsUrl} so crawlers find it without
                    guessing.
                  </p>
                </div>
              </div>
            ) : null}

            {outcome.result.found.length === 0 ? (
              <div className="rounded-xl border bg-card p-6">
                <p className="font-medium">We could not find a sitemap</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  We checked robots.txt and the six usual locations. Without one,
                  search engines have to find every page by following links —
                  which usually means the newest pages are found last.
                </p>
              </div>
            ) : (
              <ul className="space-y-3">
                {outcome.result.found.map((finding) => (
                  <li
                    key={finding.url}
                    className="rounded-xl border bg-card p-5"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      {finding.ok ? (
                        <Check
                          className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400"
                          aria-hidden="true"
                        />
                      ) : (
                        <X
                          className="size-4 shrink-0 text-destructive"
                          aria-hidden="true"
                        />
                      )}
                      <a
                        href={finding.url}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        className="min-w-0 truncate font-mono text-sm hover:underline"
                      >
                        {finding.url}
                      </a>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                        {finding.source}
                      </span>
                      {finding.isIndex ? (
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                          index
                        </span>
                      ) : null}
                    </div>

                    {finding.problem ? (
                      <p className="mt-2 text-sm text-destructive">
                        {finding.problem}
                      </p>
                    ) : (
                      <>
                        <p className="mt-2 text-sm text-muted-foreground">
                          {finding.entryCount.toLocaleString()}{" "}
                          {finding.isIndex
                            ? finding.entryCount === 1
                              ? "sitemap"
                              : "sitemaps"
                            : finding.entryCount === 1
                              ? "page"
                              : "pages"}{" "}
                          listed.
                        </p>
                        {finding.entries.length > 0 ? (
                          <ul className="mt-2 space-y-0.5">
                            {finding.entries.slice(0, 5).map((entry) => (
                              <li
                                key={entry}
                                className="truncate font-mono text-xs text-muted-foreground"
                              >
                                {entry}
                              </li>
                            ))}
                            {finding.entryCount > 5 ? (
                              <li className="text-xs text-muted-foreground">
                                and {(finding.entryCount - 5).toLocaleString()}{" "}
                                more
                              </li>
                            ) : null}
                          </ul>
                        ) : null}
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}

        {!outcome ? (
          <div className="mt-10 flex gap-3 rounded-xl border bg-card p-5">
            <FileCode
              className="mt-0.5 size-5 shrink-0 text-primary"
              aria-hidden="true"
            />
            <p className="text-sm text-muted-foreground">
              A sitemap is a list of your pages written for machines. It does not
              make you rank, but it does make sure everything gets found —
              especially pages nothing links to yet.
            </p>
          </div>
        ) : null}
      </div>

      <ToolExplainer
        columns={[
          {
            heading: "What this checks",
            body: "We read robots.txt for a declared sitemap, then try the six locations crawlers guess at. Each file is fetched and parsed: we report whether it loads, whether it is valid XML, whether it is an index pointing at other sitemaps, and how many URLs it lists. Index files are followed one level down so the page count is real.",
          },
          {
            heading: "Why a broken sitemap is invisible",
            body: "Nothing on your website tells you the sitemap 404s, lists staging URLs, or was never declared in robots.txt. The site looks fine. Search engines just quietly fall back to following links, and the pages nothing links to — new products, recent posts — are the ones that never get indexed.",
          },
        ]}
      />

      <MoreTools currentHref={HREF} />

      <ToolCta
        headline="A sitemap gets you found. Content gets you chosen."
        body="SeoVision checks this automatically, then writes the pages that answer what your customers actually search for."
      />
    </div>
  );
}
