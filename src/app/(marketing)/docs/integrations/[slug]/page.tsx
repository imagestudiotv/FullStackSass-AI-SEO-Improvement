import { AlertCircle, ArrowRight, Check, ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { INTEGRATION_DOCS, getIntegrationDoc } from "@/lib/publishing/docs";

/** Every guide is known at build time, so all of them are prerendered. */
export function generateStaticParams() {
  return INTEGRATION_DOCS.map((doc) => ({ slug: doc.slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/docs/integrations/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const doc = getIntegrationDoc(slug);

  if (!doc) return { title: "Guide not found" };

  return {
    title: `Connect ${doc.name}`,
    description: doc.summary,
    alternates: { canonical: `/docs/integrations/${doc.slug}` },
  };
}

export default async function IntegrationDocPage({
  params,
}: PageProps<"/docs/integrations/[slug]">) {
  const { slug } = await params;
  const doc = getIntegrationDoc(slug);

  // An unknown slug is a real 404: a soft one keeps a dead URL indexed.
  if (!doc) notFound();

  return (
    <div>
      <div className="bg-primary/[0.04]">
        <div className="mx-auto max-w-3xl px-4 py-12">
          <nav
            aria-label="Breadcrumb"
            className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground"
          >
            <Link href="/" className="text-primary hover:underline">
              Home
            </Link>
            <span aria-hidden="true">/</span>
            <Link
              href="/docs/integrations"
              className="text-primary hover:underline"
            >
              Integration guides
            </Link>
            <span aria-hidden="true">/</span>
            <span className="text-foreground">{doc.name}</span>
          </nav>

          <h1 className="mt-5 text-3xl font-semibold tracking-tight sm:text-4xl">
            Connect {doc.name}
          </h1>
          <p className="mt-4 max-w-2xl text-pretty text-muted-foreground">
            {doc.summary}
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-4 py-12">
        <section>
          <h2 className="text-xl font-semibold tracking-tight">
            Before you start
          </h2>
          <ul className="mt-4 space-y-2">
            {doc.requirements.map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-sm">
                <Check
                  className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400"
                  aria-hidden="true"
                />
                <span className="text-muted-foreground">{item}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-12">
          <h2 className="text-xl font-semibold tracking-tight">Setup</h2>
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
                  <p className="mt-1 text-pretty text-muted-foreground">
                    {step.body}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-12">
          <h2 className="text-xl font-semibold tracking-tight">
            If something goes wrong
          </h2>
          <ul className="mt-5 space-y-4">
            {doc.troubleshooting.map((item) => (
              <li key={item.problem} className="rounded-xl border bg-card p-4">
                <p className="flex items-start gap-2 font-medium">
                  <AlertCircle
                    className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400"
                    aria-hidden="true"
                  />
                  {item.problem}
                </p>
                <p className="mt-1.5 pl-6 text-pretty text-muted-foreground">
                  {item.fix}
                </p>
              </li>
            ))}
          </ul>
        </section>

        {doc.officialUrl ? (
          <p className="mt-10 text-sm text-muted-foreground">
            {doc.name}&apos;s own documentation:{" "}
            <a
              href={doc.officialUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-primary underline underline-offset-4"
            >
              read it here
              <ExternalLink className="size-3" aria-hidden="true" />
            </a>
          </p>
        ) : null}

        <div className="mt-10 rounded-xl border bg-card p-5">
          <p className="font-medium">Ready to connect?</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Open your website in the app, go to Publishing, and choose{" "}
            {doc.name}. Then press{" "}
            <span className="font-medium text-foreground">
              Publish test article
            </span>{" "}
            — we create a real draft on your site so you can confirm the whole
            path works before anything is scheduled.
          </p>
          <Link
            href="/websites"
            className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
          >
            Go to my websites
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </div>
  );
}
