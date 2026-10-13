import { MetaTagsTool, metaTagsMetadata } from "./tool";

export const metadata = metaTagsMetadata("en");

// Fetches a live website per request, so it can never be prerendered (and the nonce CSP needs a per-request render).
export const dynamic = "force-dynamic";

/** /tools/meta-tag-checker (tool.tsx); other languages: [locale]/tools/meta-tag-checker. */
export default async function MetaTagCheckerPage({ searchParams }: PageProps<"/tools/meta-tag-checker">) {
  return <MetaTagsTool locale="en" searchParams={await searchParams} />;
}
