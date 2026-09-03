import { PenLine } from "lucide-react";

import { CopyButton } from "@/components/copy-button";
import { DomainToolForm } from "@/components/domain-tool-form";
import {
  MoreTools,
  ToolCta,
  ToolExplainer,
  ToolHero,
} from "@/components/tool-page";
import { SNIPPET_LIMITS } from "@/lib/tools/snippet";
import { writeDescriptions } from "@/lib/tools/description-writer";

export const metadata = {
  title: "Meta Description Generator",
  description:
    "Five meta descriptions written from your actual page content, each with a reason to click. Free, no signup.",
};

export const dynamic = "force-dynamic";

const HREF = "/tools/meta-description-generator";

export default async function MetaDescriptionGeneratorPage({
  searchParams,
}: PageProps<"/tools/meta-description-generator">) {
  const params = await searchParams;
  const domain = typeof params.domain === "string" ? params.domain.trim() : "";
  const outcome = domain ? await writeDescriptions(domain) : null;

  return (
    <div>
      <ToolHero
        title="Meta Description Generator"
        description="Reads your page first, then writes five descriptions from what is actually on it. Each one is checked against the length Google truncates at, so none of them get cut off mid-sentence."
      >
        <DomainToolForm
          key={domain}
          action={HREF}
          defaultValue={domain}
          submitLabel="Write descriptions"
          pendingLabel="Reading your page…"
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
            <p className="font-medium">We could not write descriptions</p>
            <p className="mt-1 text-muted-foreground">{outcome.error}</p>
          </div>
        ) : null}

        {outcome?.ok ? (
          <div className="mt-10 space-y-6">
            {/* What the page has now, so the suggestions can be judged against it. */}
            <div className="rounded-xl border bg-card p-5">
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Currently
              </p>
              {outcome.result.currentDescription ? (
                <>
                  <p className="mt-2 text-sm">
                    {outcome.result.currentDescription}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground tabular-nums">
                    {outcome.result.currentDescription.length} characters
                  </p>
                </>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">
                  This page has no meta description. Google is picking a
                  sentence from the page itself — often the wrong one.
                </p>
              )}
            </div>

            <div>
              <h2 className="font-medium">Suggestions</h2>
              <ul className="mt-3 space-y-3">
                {outcome.result.descriptions.map((description) => (
                  <li
                    key={description.text}
                    className="rounded-xl border bg-card p-5"
                  >
                    <p className="text-sm">{description.text}</p>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                      <span
                        className={`text-xs tabular-nums ${
                          description.fits
                            ? "text-muted-foreground"
                            : "text-amber-600 dark:text-amber-400"
                        }`}
                      >
                        {description.length} characters
                        {description.fits
                          ? ""
                          : ` — outside the ${SNIPPET_LIMITS.metaMin}–${SNIPPET_LIMITS.metaMax} range Google shows`}
                      </span>
                      <CopyButton text={description.text} />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : null}

        {!outcome ? (
          <div className="mt-10 flex gap-3 rounded-xl border bg-card p-5">
            <PenLine
              className="mt-0.5 size-5 shrink-0 text-primary"
              aria-hidden="true"
            />
            <p className="text-sm text-muted-foreground">
              A meta description does not affect ranking. It affects whether
              anyone clicks the ranking you already have, which is usually the
              cheaper thing to fix.
            </p>
          </div>
        ) : null}
      </div>

      <ToolExplainer
        columns={[
          {
            heading: "How this works",
            body: `We fetch your page and read its actual text, then write five descriptions from it, each taking a different angle. Length is enforced in our own code afterwards rather than trusted to the model — ${SNIPPET_LIMITS.metaMin} to ${SNIPPET_LIMITS.metaMax} characters, which is what Google shows before truncating.`,
          },
          {
            heading: "Read them before you use them",
            body: "These are written from your page, but they are still written by a model, and it does not know which claims you can stand behind. Check anything specific — a guarantee, a number, a service you may not offer any more — before it becomes the sentence a stranger reads about your business.",
          },
        ]}
      />

      <MoreTools currentHref={HREF} />

      <ToolCta
        headline="Descriptions win clicks. Content wins rankings."
        body="SeoVision writes the pages that rank, then keeps their titles and descriptions right automatically."
      />
    </div>
  );
}
