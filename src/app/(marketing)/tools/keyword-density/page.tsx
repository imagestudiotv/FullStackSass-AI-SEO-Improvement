import { KeywordDensityTool, keywordDensityMetadata } from "./tool";

export const metadata = keywordDensityMetadata("en");

// Fetches a live website per request, so it can never be prerendered (and the nonce CSP needs a per-request render).
export const dynamic = "force-dynamic";

/** /tools/keyword-density (tool.tsx); other languages: [locale]/tools/keyword-density. */
export default async function KeywordDensityPage({ searchParams }: PageProps<"/tools/keyword-density">) {
  return <KeywordDensityTool locale="en" searchParams={await searchParams} />;
}
