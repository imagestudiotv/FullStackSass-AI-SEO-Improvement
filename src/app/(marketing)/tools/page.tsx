import { publicPageMetadata } from "@/lib/seo/page-metadata";
import { TOOLS_COMMON } from "@/lib/tools/i18n/common";

import { ToolsHub } from "./tools-hub";

export const metadata = {
  title: TOOLS_COMMON.en.hub.metaTitle,
  description: TOOLS_COMMON.en.hub.metaDescription,
  ...publicPageMetadata("/tools"),
};

/** Free tools hub (tools-hub.tsx); other languages: [locale]/tools. */
export default function ToolsPage() {
  return <ToolsHub locale="en" />;
}
