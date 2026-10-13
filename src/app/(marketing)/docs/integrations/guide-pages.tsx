import { AlertCircle, ArrowRight, Check, ExternalLink } from "lucide-react";
import Link from "next/link";

import { jsonLdScript } from "@/lib/blog/shared";
import { localePath, type Locale } from "@/lib/i18n/config";
import { docsUi, integrationDocs, type IntegrationDoc } from "@/lib/publishing/docs";
import { siteUrl } from "@/lib/site-url";
import { breadcrumbList } from "@/lib/structured-data";

/**
 * The integration guides' two pages - the index and one guide - in any of
 * the five languages. /docs/integrations and /[locale]/docs/integrations
 * render the same components with a different locale.
 *
 * Public rather than behind the login: the person who administers the CMS is
 * often not the person holding the account, and sending them a link they
 * cannot open is how setup stalls for a week.
 */

export function GuidesIndex({ locale }: { locale: Locale }) {
  const ui = docsUi(locale);
  const href = (path: string) => localePath(locale, path);
  return (
    <div>
      <div className="bg-primary/[0.04]">
        <div className="mx-auto max-w-3xl px-4 py-14">
          <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Link href={href("/")} className="text-primary hover:underline">
              {ui.home}
            </Link>
            <span aria-hidden="true">/</span>
            <span className="text-foreground">{ui.breadcrumb}</span>
          </nav>

          <h1 className="mt-5 text-3xl font-semibold tracking-tight sm:text-4xl">{ui.title}</h1>
          <p className="mt-4 max-w-2xl text-pretty text-muted-foreground">{ui.intro}</p>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-4 py-12">
        <ul className="grid gap-4 sm:grid-cols-2">
          {integrationDocs(locale).map((doc) => (
            <li key={doc.slug}>
              <Link
                href={href(`/docs/integrations/${doc.slug}`)}
                className="flex h-full flex-col rounded-xl border bg-card p-5 transition-colors hover:border-primary/40"
              >
                <span className="flex items-center gap-1.5 font-medium">
                  {doc.name}
                  <ArrowRight className="size-3.5" aria-hidden="true" />
                </span>
                <span className="mt-1 text-sm text-muted-foreground">{doc.summary}</span>
              </Link>
            </li>
          ))}
        </ul>

        <p className="mt-10 text-sm text-muted-foreground">
          {ui.otherBefore}{" "}
          <Link href={href("/docs/integrations/webhook")} className="underline underline-offset-4">
            {ui.otherLink}
          </Link>{" "}
          {ui.otherAfter}
        </p>
      </div>
    </div>
  );
}

export function Guide({ doc, locale }: { doc: IntegrationDoc; locale: Locale }) {
  const ui = docsUi(locale);
  const href = (path: string) => localePath(locale, path);
  const [readyBefore, readyAfter] = ui.readyBody.replaceAll("{name}", doc.name).split("{button}");

  // The visible trail below, as structured data: same names, same order.
  const trail = breadcrumbList(siteUrl(), [
    { name: ui.home, path: href("/") },
    { name: ui.breadcrumb, path: href("/docs/integrations") },
    { name: doc.name, path: href(`/docs/integrations/${doc.slug}`) },
  ]);

  return (
    <div>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(trail) }} />
      <div className="bg-primary/[0.04]">
        <div className="mx-auto max-w-3xl px-4 py-12">
          <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
            <Link href={href("/")} className="text-primary hover:underline">
              {ui.home}
            </Link>
            <span aria-hidden="true">/</span>
            <Link href={href("/docs/integrations")} className="text-primary hover:underline">
              {ui.breadcrumb}
            </Link>
            <span aria-hidden="true">/</span>
            <span className="text-foreground">{doc.name}</span>
          </nav>

          <h1 className="mt-5 text-3xl font-semibold tracking-tight sm:text-4xl">{ui.connectTitle.replace("{name}", doc.name)}</h1>
          <p className="mt-4 max-w-2xl text-pretty text-muted-foreground">{doc.summary}</p>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-4 py-12">
        <section>
          <h2 className="text-xl font-semibold tracking-tight">{ui.before}</h2>
          <ul className="mt-4 space-y-2">
            {doc.requirements.map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-sm">
                <Check className="mt-0.5 size-4 shrink-0 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
                <span className="text-muted-foreground">{item}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-12">
          <h2 className="text-xl font-semibold tracking-tight">{ui.setup}</h2>
          {doc.note ? <p className="mt-2 text-sm text-muted-foreground">{doc.note}</p> : null}
          <ol className="mt-5 space-y-5">
            {doc.steps.map((step, index) => (
              <li key={step.title} className="flex gap-4">
                <span
                  className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground"
                  aria-hidden="true"
                >
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <p className="font-medium">{step.title}</p>
                  <p className="mt-1 text-pretty text-muted-foreground">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-12">
          <h2 className="text-xl font-semibold tracking-tight">{ui.wrong}</h2>
          <ul className="mt-5 space-y-4">
            {doc.troubleshooting.map((item) => (
              <li key={item.problem} className="rounded-xl border bg-card p-4">
                <p className="flex items-start gap-2 font-medium">
                  <AlertCircle className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
                  {item.problem}
                </p>
                <p className="mt-1.5 pl-6 text-pretty text-muted-foreground">{item.fix}</p>
              </li>
            ))}
          </ul>
        </section>

        {doc.officialUrl ? (
          <p className="mt-10 text-sm text-muted-foreground">
            {ui.official.replace("{name}", doc.name)}{" "}
            <a
              href={doc.officialUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-primary underline underline-offset-4"
            >
              {ui.readHere}
              <ExternalLink className="size-3" aria-hidden="true" />
            </a>
          </p>
        ) : null}

        <div className="mt-10 rounded-xl border bg-card p-5">
          <p className="font-medium">{ui.ready}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {readyBefore}
            <span className="font-medium text-foreground">{ui.publishTest}</span>
            {readyAfter}
          </p>
          {/*
            Through sign-in: /websites itself redirects a visitor who is not
            signed in, which audit tools report as a link to a redirect. Sign-in
            sends someone already signed in straight on to /websites.
          */}
          <Link
            href="/sign-in?next=%2Fwebsites"
            className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
          >
            {ui.goToWebsites}
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </div>
  );
}
