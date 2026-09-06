import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { INTEGRATION_DOCS } from "@/lib/publishing/docs";

export const metadata = {
  title: "Integration guides",
  description:
    "How to connect WordPress, Ghost, Shopify or your own endpoint so articles publish automatically.",
  alternates: { canonical: "/docs/integrations" },
};

/**
 * Index of the per-integration setup guides.
 *
 * Public rather than behind the login: the person who administers the CMS is
 * often not the person holding the account, and sending them a link they
 * cannot open is how setup stalls for a week.
 */
export default function IntegrationDocsPage() {
  return (
    <div>
      <div className="bg-primary/[0.04]">
        <div className="mx-auto max-w-3xl px-4 py-14">
          <nav
            aria-label="Breadcrumb"
            className="flex items-center gap-1.5 text-sm text-muted-foreground"
          >
            <Link href="/" className="text-primary hover:underline">
              Home
            </Link>
            <span aria-hidden="true">/</span>
            <span className="text-foreground">Integration guides</span>
          </nav>

          <h1 className="mt-5 text-3xl font-semibold tracking-tight sm:text-4xl">
            Connect your website
          </h1>
          <p className="mt-4 max-w-2xl text-pretty text-muted-foreground">
            Connect once and every article we write publishes to your site on
            its own. Pick your platform below for the exact steps, including
            where each value lives in that platform&apos;s admin.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-4 py-12">
        <ul className="grid gap-4 sm:grid-cols-2">
          {INTEGRATION_DOCS.map((doc) => (
            <li key={doc.slug}>
              <Link
                href={`/docs/integrations/${doc.slug}`}
                className="flex h-full flex-col rounded-xl border bg-card p-5 transition-colors hover:border-primary/40"
              >
                <span className="flex items-center gap-1.5 font-medium">
                  {doc.name}
                  <ArrowRight className="size-3.5" aria-hidden="true" />
                </span>
                <span className="mt-1 text-sm text-muted-foreground">
                  {doc.summary}
                </span>
              </Link>
            </li>
          ))}
        </ul>

        <p className="mt-10 text-sm text-muted-foreground">
          Using something else? The{" "}
          <Link
            href="/docs/integrations/webhook"
            className="underline underline-offset-4"
          >
            webhook integration
          </Link>{" "}
          sends finished articles to any endpoint you control.
        </p>
      </div>
    </div>
  );
}
