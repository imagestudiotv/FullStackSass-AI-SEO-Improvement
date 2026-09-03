import { BarChart3 } from "lucide-react";

import { DomainToolForm } from "@/components/domain-tool-form";
import {
  MoreTools,
  ToolCta,
  ToolExplainer,
  ToolHero,
} from "@/components/tool-page";
import { checkReadability, type KeywordCount } from "@/lib/tools/readability";

export const metadata = {
  title: "Keyword Density Checker",
  description:
    "See what your page actually talks about — the words and phrases it uses most, and how often. Free, no signup.",
};

export const dynamic = "force-dynamic";

const HREF = "/tools/keyword-density";

/**
 * A term list as bars.
 *
 * Scaled against the most frequent term rather than the raw percentage, so the
 * shape of the distribution is readable — real densities sit near 1%, and bars
 * drawn to that scale would all be invisible.
 */
function TermList({ terms }: { terms: KeywordCount[] }) {
  const top = terms[0]?.count ?? 1;

  return (
    <ul className="space-y-2">
      {terms.map((term) => (
        <li key={term.term}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate font-medium">{term.term}</span>
            <span className="shrink-0 tabular-nums text-muted-foreground">
              {term.count}× · {term.density}%
            </span>
          </div>
          <div
            className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted"
            aria-hidden="true"
          >
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${Math.max((term.count / top) * 100, 4)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

export default async function KeywordDensityPage({
  searchParams,
}: PageProps<"/tools/keyword-density">) {
  const params = await searchParams;
  const domain = typeof params.domain === "string" ? params.domain.trim() : "";
  const outcome = domain ? await checkReadability(domain) : null;

  return (
    <div>
      <ToolHero
        title="Keyword Density Checker"
        description="Reads your page and counts what it actually says — the words and two-word phrases it uses most. Useful for the gap between what a page is about and what it never quite says."
      >
        <DomainToolForm
          key={domain}
          action={HREF}
          defaultValue={domain}
          submitLabel="Analyse page"
          label="Page address"
          placeholder="yourwebsite.com/page"
        />
      </ToolHero>

      <div className="mx-auto max-w-5xl px-4">
        {outcome && !outcome.ok ? (
          <div
            className="mt-10 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm"
            role="alert"
          >
            <p className="font-medium">We could not analyse that page</p>
            <p className="mt-1 text-muted-foreground">{outcome.error}</p>
          </div>
        ) : null}

        {outcome?.ok ? (
          <div className="mt-10 space-y-6">
            <div className="grid gap-4 sm:grid-cols-3">
              {[
                {
                  label: "Words",
                  value: outcome.result.wordCount.toLocaleString(),
                },
                {
                  label: "Distinct terms shown",
                  value: String(outcome.result.topWords.length),
                },
                {
                  label: "Main heading",
                  value: outcome.result.structure.h1 ? "Set" : "Missing",
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

            {outcome.result.topWords.length === 0 ? (
              <div className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">
                There is not enough repeated text on this page to find a
                pattern. That is itself worth knowing — a page this thin rarely
                ranks for anything.
              </div>
            ) : (
              <div className="grid gap-6 lg:grid-cols-2">
                <section className="rounded-xl border bg-card p-5">
                  <h2 className="font-medium">Most used words</h2>
                  <p className="mt-1 mb-4 text-sm text-muted-foreground">
                    Common words like &ldquo;the&rdquo; and &ldquo;and&rdquo; are
                    left out.
                  </p>
                  <TermList terms={outcome.result.topWords} />
                </section>

                <section className="rounded-xl border bg-card p-5">
                  <h2 className="font-medium">Most used phrases</h2>
                  <p className="mt-1 mb-4 text-sm text-muted-foreground">
                    Two words together — usually closer to what people search
                    for.
                  </p>
                  {outcome.result.topPhrases.length > 0 ? (
                    <TermList terms={outcome.result.topPhrases} />
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No phrase appears more than once.
                    </p>
                  )}
                </section>
              </div>
            )}
          </div>
        ) : null}

        {!outcome ? (
          <div className="mt-10 flex gap-3 rounded-xl border bg-card p-5">
            <BarChart3
              className="mt-0.5 size-5 shrink-0 text-primary"
              aria-hidden="true"
            />
            <p className="text-sm text-muted-foreground">
              There is no target density worth chasing. This is for reading what
              a page emphasises, and noticing when the thing you sell is not on
              the list.
            </p>
          </div>
        ) : null}
      </div>

      <ToolExplainer
        columns={[
          {
            heading: "What this checks",
            body: "We fetch the page, strip scripts and styling, and count the visible words a reader would see. Words shorter than three letters and a short list of very common ones are excluded. Two-word phrases are counted from the original word order, so they are real phrases rather than words that happen to be frequent.",
          },
          {
            heading: "What density is not",
            body: "It is not a target. Writing to hit a percentage produces the stilted copy search engines have penalised for a decade, and no modern ranking system rewards it. The useful signal is the opposite one: a page selling emergency plumbing that never once says \"emergency plumber\" has a real problem, and this is how you notice.",
          },
        ]}
      />

      <MoreTools currentHref={HREF} />

      <ToolCta
        headline="Knowing the gap is the easy part"
        body="SeoVision finds what your customers actually search for, then writes the pages that answer it."
      />
    </div>
  );
}
