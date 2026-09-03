import { AlertTriangle, Check, Eye, X } from "lucide-react";

import { DomainToolForm } from "@/components/domain-tool-form";
import {
  MoreTools,
  ToolCta,
  ToolExplainer,
  ToolHero,
} from "@/components/tool-page";
import { checkReadability } from "@/lib/tools/readability";

export const metadata = {
  title: "LLM HTML Visibility Checker",
  description:
    "See how much of your page an AI assistant can actually read — the text that survives without JavaScript. Free, no signup.",
};

export const dynamic = "force-dynamic";

const HREF = "/tools/llm-html-checker";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default async function LlmHtmlCheckerPage({
  searchParams,
}: PageProps<"/tools/llm-html-checker">) {
  const params = await searchParams;
  const domain = typeof params.domain === "string" ? params.domain.trim() : "";
  const outcome = domain ? await checkReadability(domain) : null;

  return (
    <div>
      <ToolHero
        title="LLM HTML Visibility Checker"
        description="AI assistants read the HTML your server sends, not the page a browser builds afterwards. This shows how much of your content survives that — and flags the pages that come back effectively empty."
      >
        <DomainToolForm
          key={domain}
          action={HREF}
          defaultValue={domain}
          submitLabel="Check readability"
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
            {/* The verdict, stated before any numbers. */}
            <div
              className={`flex gap-3 rounded-xl border p-5 ${
                outcome.result.needsJavaScript
                  ? "border-destructive/40 bg-destructive/5"
                  : "bg-card"
              }`}
            >
              {outcome.result.needsJavaScript ? (
                <AlertTriangle
                  className="mt-0.5 size-5 shrink-0 text-destructive"
                  aria-hidden="true"
                />
              ) : (
                <Check
                  className="mt-0.5 size-5 shrink-0 text-emerald-600 dark:text-emerald-400"
                  aria-hidden="true"
                />
              )}
              <div>
                <p className="font-medium">
                  {outcome.result.needsJavaScript
                    ? "This page is nearly empty without JavaScript."
                    : "AI assistants can read this page."}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {outcome.result.needsJavaScript
                    ? `We found only ${outcome.result.wordCount} words in the HTML your server sent. An assistant reading this page would see almost none of your content, however complete it looks in a browser.`
                    : `We found ${outcome.result.wordCount.toLocaleString()} words in the HTML your server sent, before any JavaScript runs.`}
                </p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {[
                {
                  label: "Readable words",
                  value: outcome.result.wordCount.toLocaleString(),
                },
                {
                  label: "Text vs. code",
                  value: `${outcome.result.textRatio}%`,
                },
                {
                  label: "Page weight",
                  value: formatBytes(outcome.result.htmlBytes),
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

            {/* Structure: what an assistant uses to make sense of the page. */}
            <section className="rounded-xl border bg-card p-5">
              <h2 className="font-medium">What an assistant can understand</h2>
              <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                {[
                  {
                    label: "Page title",
                    ok: Boolean(outcome.result.structure.title),
                    detail:
                      outcome.result.structure.title ?? "Not set",
                  },
                  {
                    label: "Main heading",
                    ok: Boolean(outcome.result.structure.h1),
                    detail: outcome.result.structure.h1 ?? "Not set",
                  },
                  {
                    label: "Headings",
                    ok: outcome.result.structure.headings > 0,
                    detail: `${outcome.result.structure.headings} found`,
                  },
                  {
                    label: "Paragraphs",
                    ok: outcome.result.structure.paragraphs > 0,
                    detail: `${outcome.result.structure.paragraphs} found`,
                  },
                  {
                    label: "Structured data",
                    ok: outcome.result.structure.structuredData > 0,
                    detail:
                      outcome.result.structure.structuredData > 0
                        ? `${outcome.result.structure.structuredData} JSON-LD block${outcome.result.structure.structuredData === 1 ? "" : "s"}`
                        : "None — assistants have to infer the facts",
                  },
                  {
                    label: "Image descriptions",
                    ok:
                      outcome.result.structure.images === 0 ||
                      outcome.result.structure.imagesWithAlt ===
                        outcome.result.structure.images,
                    detail: `${outcome.result.structure.imagesWithAlt} of ${outcome.result.structure.images} images described`,
                  },
                ].map((row) => (
                  <li key={row.label} className="flex items-start gap-2.5">
                    {row.ok ? (
                      <Check
                        className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400"
                        aria-hidden="true"
                      />
                    ) : (
                      <X
                        className="mt-0.5 size-4 shrink-0 text-destructive"
                        aria-hidden="true"
                      />
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{row.label}</p>
                      <p className="truncate text-sm text-muted-foreground">
                        {row.detail}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        ) : null}

        {!outcome ? (
          <div className="mt-10 flex gap-3 rounded-xl border bg-card p-5">
            <Eye
              className="mt-0.5 size-5 shrink-0 text-primary"
              aria-hidden="true"
            />
            <p className="text-sm text-muted-foreground">
              A page built entirely in the browser can look perfect to you and
              be blank to an assistant. This is the check that tells the two
              apart.
            </p>
          </div>
        ) : null}
      </div>

      <ToolExplainer
        columns={[
          {
            heading: "What this checks",
            body: "We request your page exactly as an assistant would and never run any JavaScript. Then we strip the scripts and styling and measure what is left: how many words, how much of the document is text rather than code, and whether the structural signals — headings, paragraphs, JSON-LD, image descriptions — are actually there.",
          },
          {
            heading: "Why this differs from Google",
            body: "Google renders JavaScript, eventually, on a second pass. AI assistants generally do not — they read the HTML that comes back and move on. A single-page app can therefore rank respectably on Google and be completely invisible to ChatGPT, which is a gap most site owners have no way to see.",
          },
        ]}
      />

      <MoreTools currentHref={HREF} />

      <ToolCta
        headline="Readable is not the same as recommended"
        body="SeoVision checks whether assistants actually name your business, and writes the content that gets you cited."
      />
    </div>
  );
}
