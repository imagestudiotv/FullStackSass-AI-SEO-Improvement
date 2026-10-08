import {
  MarketingFooterLinks,
  MarketingNav,
  MarketingTagline,
} from "@/components/marketing-nav";
import { BrandHomeLink } from "@/components/brand-home-link";
import { BrandLogo } from "@/components/brand-logo";
import { ConsentBanner } from "@/components/consent-banner";
import { LiveChat } from "@/components/live-chat";
import { PreviousPageTracker } from "@/components/previous-page";
import { RenderAllOnJump } from "@/components/render-all-on-jump";
import { siteChrome } from "@/lib/i18n/site-chrome";

/**
 * The public site's frame: sticky header with the nav, the page, the compact
 * footer and the live chat. The (marketing) layout wraps every public page in
 * it, and app/not-found.tsx wraps the 404 for addresses that match no route
 * at all - which render outside every route group's layout.
 */
export function MarketingShell({ children }: { children: React.ReactNode }) {
  // The header and footer words, picked out here so the browser never loads
  // the whole dictionary (lib/i18n/site-chrome.ts).
  const chrome = siteChrome();
  return (
    <div className="flex min-h-svh flex-col">
      {/*
        The analytics cookie banner, and the Google Analytics it controls. It
        floats over the page, so its place in the document only sets the
        reading order: first, so a keyboard or screen-reader visitor meets the
        question before the page.
      */}
      <ConsentBanner copy={Object.fromEntries(Object.entries(chrome).map(([locale, words]) => [locale, words.consent]))} />
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
          <MarketingNav chrome={chrome} />
        </div>
      </header>

      <main className="flex-1">{children}</main>
      {/* After the page, so a 404 reports the page the visitor came from (components/previous-page.tsx). */}
      <PreviousPageTracker />
      <RenderAllOnJump />

      {/*
        Brand, tagline and language on the left; Product, Company and Legal
        beside them. Stacks on smaller screens.
      */}
      <footer className="border-t bg-muted/30">
        <div className="mx-auto max-w-6xl px-4 pt-12 pb-8">
          <div className="flex flex-col gap-10 lg:flex-row lg:gap-16">
            <div className="lg:w-72 lg:shrink-0">
              <BrandLogo height={22} />
              <MarketingTagline chrome={chrome} />
            </div>
            <MarketingFooterLinks chrome={chrome} />
          </div>

          <p className="mt-10 border-t pt-6 text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} RepGet
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
