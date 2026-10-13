import { featurePageContent } from "@/lib/marketing/feature-pages";
import { publicPageMetadata } from "@/lib/seo/page-metadata";

import { FeaturePageContent } from "../feature-page";

const { page, example } = featurePageContent("/rank-on-chatgpt", "en");

export const metadata = {
  title: page.metaTitle,
  description: page.metaDescription,
  ...publicPageMetadata("/rank-on-chatgpt"),
};

/** Being named by AI assistants, for a prospect (lib/marketing/feature-pages.ts). Other languages: [locale]/rank-on-chatgpt. */
export default function Page() {
  return <FeaturePageContent page={page} example={example} />;
}
