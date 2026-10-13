import { DOCS_UI_EN } from "@/lib/publishing/docs";
import { publicPageMetadata } from "@/lib/seo/page-metadata";

import { GuidesIndex } from "./guide-pages";

export const metadata = {
  title: DOCS_UI_EN.metaTitle,
  description: DOCS_UI_EN.metaDescription,
  ...publicPageMetadata("/docs/integrations"),
};

/** Index of the per-integration setup guides (guide-pages.tsx); other languages: [locale]/docs/integrations. */
export default function IntegrationDocsPage() {
  return <GuidesIndex locale="en" />;
}
