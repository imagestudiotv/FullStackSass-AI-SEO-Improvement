import { featuresPageCopy } from "@/lib/i18n/features-page";
import { publicPageMetadata } from "@/lib/seo/page-metadata";

import { FeaturesPageContent } from "../features-page";

const t = featuresPageCopy("en");

export const metadata = {
  title: t.metaTitle,
  description: t.metaDescription,
  ...publicPageMetadata("/features"),
};

/** Everything RepGet does, tool by tool, with the dashboard recordings (features-page.tsx). Other languages: [locale]/features. */
export default function Page() {
  return <FeaturesPageContent />;
}
