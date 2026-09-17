
import {
  MarketingFooterLinks,
  MarketingNav,
  MarketingTagline,
} from "@/components/marketing-nav";
import { BrandHomeLink } from "@/components/brand-home-link";
import { BrandLogo } from "@/components/brand-logo";
import { LiveChat } from "@/components/live-chat";

export default function MarketingLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-svh flex-col">
      {/*
        Sticky, matching the signed-in app and the admin area, which were
        already sticky — the marketing site was the one place the menu
        scrolled away, so navigating from a long page meant scrolling back to
        the top first.

        Translucent with a backdrop blur rather than solid, so content passing
        underneath reads as behind the bar instead of being clipped by it. The
        supports- query keeps a solid background where backdrop-filter is not
        available, since a transparent header over scrolling text is unreadable.

        z-40 sits above page content but below the mobile sheet and any
        dialog, which is where the other two layouts put it.
      */}
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4">
          <BrandHomeLink className="flex items-center">
            {/* The page's primary logo, so it is not lazy-loaded. */}
            <BrandLogo height={24} priority />
          </BrandHomeLink>
          <MarketingNav />
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t bg-background">
        <div className="mx-auto max-w-6xl px-4 py-10">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <BrandLogo height={22} />
              <MarketingTagline />
            </div>
            <MarketingFooterLinks />
          </div>

          <p className="mt-10 border-t pt-6 text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} AI SEO Platform
          </p>
        </div>
      </footer>

      {/*
        Anonymous visitors. The signed-in app mounts its own copy with the
        customer attached, so a message arrives already identified.
      */}
      <LiveChat />
    </div>
  );
}
