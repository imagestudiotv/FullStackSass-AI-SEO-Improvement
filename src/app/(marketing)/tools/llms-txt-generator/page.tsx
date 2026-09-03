import { FileText } from "lucide-react";

import { CopyButton } from "@/components/copy-button";
import { DomainToolForm } from "@/components/domain-tool-form";
import {
  MoreTools,
  ToolCta,
  ToolExplainer,
  ToolHero,
} from "@/components/tool-page";
import { generateLlmsTxt } from "@/lib/tools/llms-txt";

export const metadata = {
  title: "llms.txt Generator",
  description:
    "Generate a valid llms.txt from your live site — built from a real crawl of your pages, not a template. Free, no signup.",
};

export const dynamic = "force-dynamic";

const HREF = "/tools/llms-txt-generator";

export default async function LlmsTxtGeneratorPage({
  searchParams,
}: PageProps<"/tools/llms-txt-generator">) {
  const params = await searchParams;
  const domain = typeof params.domain === "string" ? params.domain.trim() : "";
  const outcome = domain ? await generateLlmsTxt(domain) : null;

  return (
    <div>
      <ToolHero
        title="llms.txt Generator"
        description="Reads your site and writes an llms.txt from what is actually there — your real pages, with their real descriptions. Not a template with your domain pasted in."
      >
        <DomainToolForm
          key={domain}
          action={HREF}
          defaultValue={domain}
          submitLabel="Generate llms.txt"
          pendingLabel="Reading your site…"
        />
      </ToolHero>

      <div className="mx-auto max-w-5xl px-4">
        {outcome && !outcome.ok ? (
          <div
            className="mt-10 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm"
            role="alert"
          >
            <p className="font-medium">We could not read that website</p>
            <p className="mt-1 text-muted-foreground">{outcome.error}</p>
          </div>
        ) : null}

        {outcome?.ok ? (
          <div className="mt-10 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-medium">Your llms.txt</h2>
                <p className="text-sm text-muted-foreground">
                  Built from {outcome.result.pagesRead}{" "}
                  {outcome.result.pagesRead === 1 ? "page" : "pages"}. Save this
                  as{" "}
                  <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
                    /llms.txt
                  </code>{" "}
                  at the root of your site.
                </p>
              </div>
              <CopyButton text={outcome.result.content} label="Copy file" />
            </div>

            <pre className="overflow-x-auto rounded-xl border bg-card p-5 font-mono text-xs leading-relaxed">
              {outcome.result.content}
            </pre>

            <div className="rounded-xl border bg-card p-5">
              <p className="font-medium">Where to put it</p>
              <p className="mt-1 text-sm text-muted-foreground">
                It belongs at{" "}
                <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
                  {outcome.result.path}
                </code>
                . On most hosts that means dropping the file in your public or
                static folder — the same place robots.txt lives.
              </p>
            </div>
          </div>
        ) : null}

        {!outcome ? (
          <div className="mt-10 flex gap-3 rounded-xl border bg-card p-5">
            <FileText
              className="mt-0.5 size-5 shrink-0 text-primary"
              aria-hidden="true"
            />
            <p className="text-sm text-muted-foreground">
              llms.txt is a proposed convention: a short markdown file telling an
              AI assistant what your site is and which pages matter, so it does
              not have to work that out from your navigation.
            </p>
          </div>
        ) : null}
      </div>

      <ToolExplainer
        columns={[
          {
            heading: "How this is built",
            body: "We crawl up to a dozen pages of your site, take the name and summary from your homepage, then list your real pages with the descriptions you already wrote for them. Titles have the trailing brand name trimmed, because \"Pricing | Acme\" reads worse in a list than \"Pricing\".",
          },
          {
            heading: "Is this a standard?",
            body: "Not yet — it is a proposal that some tools have started reading, and adoption is genuinely uneven. It costs one small file to add and nothing breaks if nobody reads it. Worth doing on that basis, and worth being honest that it is not the reason assistants will start recommending you.",
          },
        ]}
      />

      <MoreTools currentHref={HREF} />

      <ToolCta
        headline="A file helps. Content is what gets cited."
        body="SeoVision tracks whether assistants name your business, and writes the pages that make them."
      />
    </div>
  );
}
