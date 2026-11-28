import { BlogWriterTool, blogWriterMetadata } from "./tool";

export const metadata = blogWriterMetadata("en");

/** /tools/blog-writer (tool.tsx); other languages: [locale]/tools/blog-writer. */
export default function BlogWriterPage() {
  return <BlogWriterTool locale="en" />;
}
