import Image from "next/image";

import {
  BackToTop,
  MarketingFooterLinks,
  MarketingFrame,
  MarketingNav,
  MarketingTagline,
} from "@/components/marketing-nav";
import { BrandHomeLink } from "@/components/brand-home-link";
import { ConsentBanner } from "@/components/consent-banner";
import { LiveChat } from "@/components/live-chat";
import { PreviousPageTracker } from "@/components/previous-page";
import { PromoBanner } from "@/components/promo-banner";
import { RenderAllOnJump } from "@/components/render-all-on-jump";
import { siteChrome } from "@/lib/i18n/site-chrome";
import type { LiveBanner } from "@/lib/promo-banner/banner";

import footer from "./site-footer.module.css";

/**
 * The public site's frame: the floating header with the nav, the page, the
 * footer and the live chat. The two public root layouts - app/(marketing)
 * for English, app/(localized)/[locale] for the translations - wrap every
 * public page in it, and app/(site)/not-found.tsx wraps the 404 of the parts
 * of the app that have none of their own.
 *
 * The frame itself is MarketingFrame, which repeats the address's language
 * (/es -> "es") that <html lang> already carries (see marketing-nav.tsx).
 *
 * `banner` is the administrators' offer bar above the header
 * (components/promo-banner.tsx), read by those two layouts; the app's 404
 * goes without it.
 */
export function MarketingShell({ children, banner = null }: { children: React.ReactNode; banner?: LiveBanner | null }) {
  // The header and footer words, picked out here so the browser never loads
  // the whole dictionary (lib/i18n/site-chrome.ts).
  const chrome = siteChrome();
  const homeLabels = Object.fromEntries(Object.entries(chrome).map(([locale, words]) => [locale, words.a11y.brandHome]));
  return (
    <MarketingFrame className="flex min-h-svh flex-col">
      {/*
        The analytics cookie banner, and the Google Analytics it controls. It
        floats over the page, so its place in the document only sets the
        reading order: first, so a keyboard or screen-reader visitor meets the
        question before the page.
      */}
      <ConsentBanner copy={Object.fromEntries(Object.entries(chrome).map(([locale, words]) => [locale, words.consent]))} />
      {/*
        The design's floating bar (client, 2026-11-03), sticky 16px from the
        top. Its menus and the phone drawer hang from it; see marketing-nav.
        z-index 50 sits above page content but below dialogs.
      */}
      {/* Above the header; it scrolls away with the page while the header stays sticky. */}
      <PromoBanner banner={banner} />
      <MarketingNav chrome={chrome} />

      <main className="flex-1">{children}</main>
      {/* After the page, so a 404 reports the page the visitor came from (components/previous-page.tsx). */}
      <PreviousPageTracker />
      <RenderAllOnJump />

      {/*
        The design's footer: brand, tagline, language and night mode, then
        Product, Company and Legal; the year and "Back to top" below. Columns
        stack on smaller screens.
      */}
      <footer className={footer["rft-footer"]}>
        <div className={footer["rft-inner"]}>
          <div className={footer["rft-grid"]}>
            <div className={footer["rft-brand"]}>
              <BrandHomeLink className={footer["rft-logo-link"]} labels={homeLabels}>
                <Image src="/images/repget-logo.png" alt="RepGet" width={120} height={30} className={footer["rft-logo-light"]} />
                <Image
                  src="/images/repget-logo-light.png"
                  alt=""
                  aria-hidden="true"
                  width={120}
                  height={30}
                  className={footer["rft-logo-dark"]}
                />
              </BrandHomeLink>
              <MarketingTagline chrome={chrome} />
            </div>
            <MarketingFooterLinks chrome={chrome} />
          </div>
          <div className={footer["rft-bottom"]}>
            <span>&copy; {new Date().getFullYear()} RepGet</span>
            <BackToTop chrome={chrome} />
          </div>
        </div>
      </footer>

      {/*
        Anonymous visitors. The signed-in app mounts its own copy with the
        customer attached, so a message arrives already identified.
      */}
      <LiveChat />
    </MarketingFrame>
  );
}
