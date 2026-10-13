import { LlmsTxtTool, llmsTxtMetadata } from "./tool";

export const metadata = llmsTxtMetadata("en");

// Fetches a live website per request, so it can never be prerendered (and the nonce CSP needs a per-request render).
export const dynamic = "force-dynamic";

/** /tools/llms-txt-generator (tool.tsx); other languages: [locale]/tools/llms-txt-generator. */
export default async function LlmsTxtGeneratorPage({ searchParams }: PageProps<"/tools/llms-txt-generator">) {
  return <LlmsTxtTool locale="en" searchParams={await searchParams} />;
}
