import { AiCrawlersTool, aiCrawlersMetadata } from "./tool";

export const metadata = aiCrawlersMetadata("en");

// Fetches a live website per request, so it can never be prerendered (and the nonce CSP needs a per-request render).
export const dynamic = "force-dynamic";

/** /tools/ai-crawler-checker (tool.tsx); other languages: [locale]/tools/ai-crawler-checker. */
export default async function AiCrawlerCheckerPage({ searchParams }: PageProps<"/tools/ai-crawler-checker">) {
  return <AiCrawlersTool locale="en" searchParams={await searchParams} />;
}
