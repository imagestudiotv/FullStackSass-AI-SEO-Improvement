import { MetaDescriptionTool, metaDescriptionMetadata } from "./tool";

export const metadata = metaDescriptionMetadata("en");

// Fetches a live website per request, so it can never be prerendered (and the nonce CSP needs a per-request render).
export const dynamic = "force-dynamic";

/** /tools/meta-description-generator (tool.tsx); other languages: [locale]/tools/meta-description-generator. */
export default async function MetaDescriptionGeneratorPage({ searchParams }: PageProps<"/tools/meta-description-generator">) {
  return <MetaDescriptionTool locale="en" searchParams={await searchParams} />;
}
