import { AlertTriangle, Check, Tag, X } from "lucide-react";

import { DomainToolForm } from "@/components/domain-tool-form";
import {
  MoreTools,
  ToolCta,
  ToolExplainer,
  ToolHero,
} from "@/components/tool-page";
import { checkMetaTags, type TagStatus } from "@/lib/tools/meta-tags";

export const metadata = {
  title: "Meta Tag Checker",
  description:
    "Check every meta tag Google and the social networks read on your page — titles, descriptions, Open Graph and Twitter cards. Free, no signup.",
};

export const dynamic = "force-dynamic";

const HREF = "/tools/meta-tag-checker";

function StatusIcon({ status }: { status: TagStatus }) {
  if (status === "good") {
    return (
      <Check
        className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400"
        aria-hidden="true"
      />
    );
  }
  if (status === "warn") {
    return (
      <AlertTriangle
        className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400"
        aria-hidden="true"
      />
    );
  }
  return (
    <X className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden="true" />
  );
}

export default async function MetaTagCheckerPage({
  searchParams,
}: PageProps<"/tools/meta-tag-checker">) {
  const params = await searchParams;
  const domain = typeof params.domain === "string" ? params.domain.trim() : "";
  const outcome = domain ? await checkMetaTags(domain) : null;

  return (
    <div>
      <ToolHero
        title="Meta Tag Checker"
        description="Reads every tag Google and the social networks actually use on your page, and tells you which are missing, which are the wrong length, and what each one does."
      >
        <DomainToolForm
          key={domain}
          action={HREF}
          defaultValue={domain}
          submitLabel="Check meta tags"
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
            <p className="font-medium">We could not check that page</p>
            <p className="mt-1 text-muted-foreground">{outcome.error}</p>
          </div>
        ) : null}

        {outcome?.ok ? (
          <div className="mt-10 space-y-6">
            <div className="grid gap-4 sm:grid-cols-3">
              {[
                {
                  label: "Good",
                  value: outcome.result.counts.good,
                  tone: "text-emerald-600 dark:text-emerald-400",
                },
                {
                  label: "Needs attention",
                  value: outcome.result.counts.warn,
                  tone: "text-amber-600 dark:text-amber-400",
                },
                {
                  label: "Missing",
                  value: outcome.result.counts.missing,
                  tone: "text-destructive",
                },
              ].map((stat) => (
                <div key={stat.label} className="rounded-xl border bg-card p-5">
                  <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    {stat.label}
                  </p>
                  <p
                    className={`mt-2 text-2xl font-semibold tabular-nums ${stat.value > 0 ? stat.tone : ""}`}
                  >
                    {stat.value}
                  </p>
                </div>
              ))}
            </div>

            {outcome.result.groups.map((group) => (
              <section key={group.heading}>
                <h2 className="text-xs font-semibold tracking-[0.14em] text-primary uppercase">
                  {group.heading}
                </h2>
                <ul className="mt-3 space-y-3">
                  {group.tags.map((tag) => (
                    <li
                      key={tag.name}
                      className="flex gap-3 rounded-xl border bg-card p-4"
                    >
                      <StatusIcon status={tag.status} />
                      <div className="min-w-0 flex-1">
                        <p className="flex flex-wrap items-center gap-2 font-medium">
                          {tag.label}
                          <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs font-normal text-muted-foreground">
                            {tag.name}
                          </code>
                        </p>
                        {tag.value ? (
                          <p className="mt-1 text-sm break-words text-muted-foreground">
                            {tag.value}
                          </p>
                        ) : (
                          <p className="mt-1 text-sm text-muted-foreground italic">
                            Not set
                          </p>
                        )}
                        {tag.note ? (
                          <p className="mt-2 border-l-2 border-primary/30 pl-2.5 text-sm">
                            {tag.note}
                          </p>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        ) : null}

        {!outcome ? (
          <div className="mt-10 flex gap-3 rounded-xl border bg-card p-5">
            <Tag
              className="mt-0.5 size-5 shrink-0 text-primary"
              aria-hidden="true"
            />
            <p className="text-sm text-muted-foreground">
              Meta tags are what search engines and social networks read instead
              of looking at your page. They decide what your result says on
              Google and what your link looks like when somebody shares it.
            </p>
          </div>
        ) : null}
      </div>

      <ToolExplainer
        columns={[
          {
            heading: "What this checks",
            body: "Fourteen tags in three groups: the ones search engines read (title, description, canonical, language, robots, viewport), the Open Graph tags Facebook, LinkedIn, Slack and WhatsApp read, and the Twitter card tags. Lengths are checked against what Google actually truncates, not round numbers.",
          },
          {
            heading: "The one people miss",
            body: "og:image. Without it your link shares as a grey box on every platform, and you only find out after somebody posts it — by which point the post is already up and getting the clicks it was going to get. It costs nothing to set and it is the single highest-impact tag on this list.",
          },
        ]}
      />

      <MoreTools currentHref={HREF} />

      <ToolCta
        headline="Meta tags are the easy half"
        body="SeoVision checks these across your whole site automatically, then writes the pages that earn the clicks."
      />
    </div>
  );
}
