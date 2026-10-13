import { SnippetTool, snippetMetadata } from "./tool";

export const metadata = snippetMetadata("en");

/** /tools/snippet-preview (tool.tsx); other languages: [locale]/tools/snippet-preview. */
export default function SnippetPreviewPage() {
  return <SnippetTool locale="en" />;
}
