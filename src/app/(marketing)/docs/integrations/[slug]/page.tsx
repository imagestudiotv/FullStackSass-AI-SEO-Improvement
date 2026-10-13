import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { DOCS_UI_EN, INTEGRATION_DOCS, getIntegrationDoc } from "@/lib/publishing/docs";
import { publicPageMetadata } from "@/lib/seo/page-metadata";

import { Guide } from "../guide-pages";

/** Every guide is known at build time, so all of them are prerendered. */
export function generateStaticParams() {
  return INTEGRATION_DOCS.map((doc) => ({ slug: doc.slug }));
}

export async function generateMetadata({ params }: PageProps<"/docs/integrations/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const doc = getIntegrationDoc(slug);
  if (!doc) return { title: DOCS_UI_EN.notFound };
  return {
    title: DOCS_UI_EN.connectTitle.replace("{name}", doc.name),
    description: doc.summary,
    ...publicPageMetadata(`/docs/integrations/${doc.slug}`),
  };
}

export default async function IntegrationDocPage({ params }: PageProps<"/docs/integrations/[slug]">) {
  const { slug } = await params;
  const doc = getIntegrationDoc(slug);
  // An unknown slug is a real 404: a soft one keeps a dead URL indexed.
  if (!doc) notFound();
  return <Guide doc={doc} locale="en" />;
}
