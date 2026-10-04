import { MarketingShell } from "@/components/marketing-shell";

/** Every public page, in the site's frame (components/marketing-shell.tsx). */
export default function MarketingLayout({ children }: LayoutProps<"/">) {
  return <MarketingShell>{children}</MarketingShell>;
}
