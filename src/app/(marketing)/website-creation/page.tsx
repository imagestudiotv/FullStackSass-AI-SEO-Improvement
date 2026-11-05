import { WEBSITE_CREATION_COPY } from "@/lib/marketing/website-creation/copy";
import { publicPageMetadata } from "@/lib/seo/page-metadata";

import { WebsiteCreationContent } from "./website-creation-page";

const t = WEBSITE_CREATION_COPY.en;

export const metadata = {
  title: t.metaTitle,
  description: t.metaDescription,
  ...publicPageMetadata("/website-creation"),
};

/** Website builds and redesigns. Other languages: [locale]/website-creation. */
export default function WebsiteCreationPage() {
  return <WebsiteCreationContent />;
}
