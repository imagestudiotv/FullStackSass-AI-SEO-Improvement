import { MarketingShell } from "@/components/marketing-shell";
import { readLiveBanner } from "@/lib/promo-banner/read";

/**
 * Every public page, in the site's frame (components/marketing-shell.tsx),
 * with the administrators' offer bar above the header when one is on
 * (Admin -> Site banner). Prebuilt pages carry the bar they were built with;
 * saving the banner rebuilds them (lib/admin/site-banner.ts).
 */
export default async function MarketingLayout({ children }: LayoutProps<"/">) {
  return <MarketingShell banner={await readLiveBanner()}>{children}</MarketingShell>;
}
