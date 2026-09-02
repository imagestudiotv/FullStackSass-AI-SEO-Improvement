import { Bot, FileSearch, ListChecks } from "lucide-react";

import { runPublicAudit } from "@/lib/audit/public-audit";
import { AuditForm } from "./audit-form";
import { AuditResult } from "./audit-result";

export const metadata = {
  title: "Free website check",
  description:
    "See what is holding your website back on Google and whether AI assistants can read your site. No account needed.",
};

// Crawls a live website per request, so it can never be prerendered.
export const dynamic = "force-dynamic";

/**
 * Free public audit — the lead magnet.
 *
 * Shows real findings from a real crawl, then stops. The visitor sees that we
 * found genuine problems on their site, and signing up is how they see the
 * rest and get them fixed. Nothing here is invented: if the crawl fails, the
 * page says so rather than showing a made-up score.
 */
export default async function AuditPage({
  searchParams,
}: PageProps<"/audit">) {
  const params = await searchParams;
  const domain = typeof params.domain === "string" ? params.domain.trim() : "";

  const outcome = domain ? await runPublicAudit(domain) : null;

  return (
    <div className="mx-auto max-w-4xl px-4 py-16 sm:py-20">
      <div className="text-center">
        <p className="text-xs font-semibold tracking-[0.14em] text-primary uppercase">
          Free website check
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-balance sm:text-5xl">
          Your free <span className="text-primary">growth plan</span>
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-pretty text-muted-foreground sm:text-lg">
          Enter your website and we will read your pages, score them, and show
          you what is holding you back on Google — and whether AI assistants can
          read your site at all.
        </p>
      </div>

      <div className="mx-auto mt-8 max-w-xl">
        <AuditForm key={domain} defaultValue={domain} />
        <p className="mt-3 text-center text-xs text-muted-foreground">
          No account, no card. Takes about a minute.
        </p>
      </div>

      {/*
        What the check actually does. Shown only before a result, where the
        reference runs its three-step build animation — the same reassurance
        that something real is happening, without pretending to a progress bar
        we cannot honestly drive from a server component.
      */}
      {!outcome ? (
        <div className="mt-16 grid gap-4 sm:grid-cols-3">
          {[
            {
              icon: FileSearch,
              title: "We read your pages",
              body: "Up to five of them, the way a search engine would — titles, headings, images, links.",
            },
            {
              icon: ListChecks,
              title: "We score what we find",
              body: "Every problem comes with what to change and roughly how long it takes.",
            },
            {
              icon: Bot,
              title: "We check AI access",
              body: "Whether ChatGPT, Claude, Perplexity and Gemini are allowed to read and cite you.",
            },
          ].map((step) => (
            <div key={step.title} className="rounded-xl border bg-card p-5">
              <step.icon className="size-5 text-primary" aria-hidden="true" />
              <p className="mt-3 font-medium">{step.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{step.body}</p>
            </div>
          ))}
        </div>
      ) : null}

      {outcome && !outcome.ok ? (
        <div
          className="mx-auto mt-8 max-w-xl rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm"
          role="alert"
        >
          <p className="font-medium">We could not check that website</p>
          <p className="mt-1 text-muted-foreground">{outcome.error.message}</p>
        </div>
      ) : null}

      {outcome?.ok ? <AuditResult result={outcome.result} /> : null}
    </div>
  );
}
