import { CHATGPT_EXAMPLE, CHATGPT_PAGE } from "@/lib/marketing/feature-pages";
import { publicPageMetadata } from "@/lib/seo/page-metadata";

import { FeaturePageContent } from "../feature-page";

export const metadata = {
  title: CHATGPT_PAGE.metaTitle,
  description: CHATGPT_PAGE.metaDescription,
  ...publicPageMetadata("/rank-on-chatgpt"),
};

/** Being named by AI assistants, for a prospect (lib/marketing/feature-pages.ts). English only for now. */
export default function Page() {
  return <FeaturePageContent page={CHATGPT_PAGE} example={CHATGPT_EXAMPLE} />;
}
