import { LlmHtmlTool, llmHtmlMetadata } from "./tool";

export const metadata = llmHtmlMetadata("en");

// Fetches a live website per request, so it can never be prerendered (and the nonce CSP needs a per-request render).
export const dynamic = "force-dynamic";

/** /tools/llm-html-checker (tool.tsx); other languages: [locale]/tools/llm-html-checker. */
export default async function LlmHtmlCheckerPage({ searchParams }: PageProps<"/tools/llm-html-checker">) {
  return <LlmHtmlTool locale="en" searchParams={await searchParams} />;
}
