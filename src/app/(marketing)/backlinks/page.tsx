import { featurePageContent } from "@/lib/marketing/feature-pages";
import { publicPageMetadata } from "@/lib/seo/page-metadata";

import { FeaturePageContent } from "../feature-page";

const { page, example } = featurePageContent("/backlinks", "en");

export const metadata = {
  title: page.metaTitle,
  description: page.metaDescription,
  ...publicPageMetadata("/backlinks"),
};

/** Backlinks from the partner network, for a prospect (lib/marketing/feature-pages.ts). Other languages: [locale]/backlinks. */
export default function Page() {
  return <FeaturePageContent page={page} example={example} />;
}
