import { MarketingShell } from "@/components/marketing-shell";
import { readLiveBanner } from "@/lib/promo-banner/read";

import { ROOT_METADATA, RootDocument } from "../root-document";

/**
 * Root layout of the English public pages (app/root-document.tsx explains
 * the three roots), in the site's frame (components/marketing-shell.tsx),
 * with the administrators' offer bar above the header when one is on
 * (Admin -> Site banner). Prebuilt pages carry the bar they were built with;
 * saving the banner rebuilds them (lib/admin/site-banner.ts).
 *
 * The translated pages (/es, /fr, /it, /de) have their own root,
 * app/(localized)/[locale]/layout.tsx, drawn the same way.
 */
export const metadata = ROOT_METADATA;

export default async function MarketingLayout({ children }: LayoutProps<"/">) {
  return (
    <RootDocument lang="en">
      <MarketingShell banner={await readLiveBanner()}>{children}</MarketingShell>
    </RootDocument>
  );
}
