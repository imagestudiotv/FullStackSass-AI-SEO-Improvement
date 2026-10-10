import { BACKLINKS_EXAMPLE, BACKLINKS_PAGE } from "@/lib/marketing/feature-pages";
import { publicPageMetadata } from "@/lib/seo/page-metadata";

import { FeaturePageContent } from "../feature-page";

export const metadata = {
  title: BACKLINKS_PAGE.metaTitle,
  description: BACKLINKS_PAGE.metaDescription,
  ...publicPageMetadata("/backlinks"),
};

/** Backlinks from the partner network, for a prospect (lib/marketing/feature-pages.ts). English only for now. */
export default function Page() {
  return <FeaturePageContent page={BACKLINKS_PAGE} example={BACKLINKS_EXAMPLE} />;
}
