"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "@/components/language-switcher";
import { localePath, splitLocale } from "@/lib/i18n/config";
import { getMessages } from "@/lib/i18n/messages";

/**
 * Marketing header nav and footer links.
 *
 * A client component so it can read the current locale from the pathname. The
 * layout is a server component with no access to the URL, so the nav stayed in
 * English on /es — a Spanish page with an English menu reads as a half-finished
 * translation, which is worse than not offering one.
 *
 * Every in-site link is built with localePath, so someone reading in Spanish
 * stays in Spanish as they navigate. Links to pages that exist only in English
 * (sign-in, sign-up, the legal pages) deliberately keep their own paths.
 */

export function MarketingNav() {
  const pathname = usePathname();
  const { locale } = splitLocale(pathname);
  const t = getMessages(locale);
  const href = (path: string) => localePath(locale, path);

  return (
    <>
      {/* Only pages that exist. Every link here resolves. */}
      <nav className="ml-auto hidden items-center gap-1 sm:flex">
        {[
          { href: href("/#how-it-works"), label: t.nav.howItWorks },
          { href: href("/audit"), label: t.nav.freeCheck },
          { href: href("/tools"), label: t.nav.tools },
          { href: href("/pricing"), label: t.nav.pricing },
          { href: "/blog", label: t.nav.blog },
          { href: "/contact", label: t.nav.contact },
        ].map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="ml-auto flex items-center gap-2 sm:ml-4">
        {/* Hidden on pages that exist in English only. */}
        <LanguageSwitcher />
        <Button variant="ghost" size="sm" asChild>
          <Link href="/sign-in">{t.nav.signIn}</Link>
        </Button>
        <Button size="sm" asChild>
          <Link href="/sign-up">
            {t.nav.startFree}
            <ArrowRight className="size-3.5" />
          </Link>
        </Button>
      </div>
    </>
  );
}

/** Footer link columns, localised the same way. */
export function MarketingFooterLinks() {
  const pathname = usePathname();
  const { locale } = splitLocale(pathname);
  const t = getMessages(locale);
  const href = (path: string) => localePath(locale, path);

  return (
    <div className="flex gap-12 text-sm">
      <div className="space-y-2">
        <p className="font-medium text-foreground">{t.footer.product}</p>
        {[
          { href: href("/audit"), label: t.footer.freeCheck },
          { href: href("/tools"), label: t.footer.freeTools },
          { href: href("/pricing"), label: t.footer.pricing },
          { href: "/blog", label: t.footer.blog },
          { href: "/faq", label: t.footer.faq },
          { href: "/about", label: t.footer.about },
          { href: href("/backlink-exchange"), label: t.footer.backlinkExchange },
          { href: "/publishers", label: t.footer.publishers },
          { href: "/affiliate", label: t.footer.affiliate },
          { href: "/contact", label: t.footer.contact },
        ].map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="block text-muted-foreground hover:text-foreground"
          >
            {item.label}
          </Link>
        ))}
      </div>

      <div className="space-y-2">
        <p className="font-medium text-foreground">{t.footer.legal}</p>
        {/*
          Legal pages stay in English: privacy, terms and refunds carry
          commitments with specific legal meanings, and a mistranslated one is
          a liability rather than a typo.
        */}
        {[
          { href: "/privacy", label: t.footer.privacy },
          { href: "/terms", label: t.footer.terms },
          { href: "/refunds", label: t.footer.refunds },
        ].map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="block text-muted-foreground hover:text-foreground"
          >
            {item.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

/** Tagline under the footer logo. */
export function MarketingTagline() {
  const pathname = usePathname();
  const { locale } = splitLocale(pathname);
  return (
    <p className="mt-2 max-w-xs text-sm text-muted-foreground">
      {getMessages(locale).footer.tagline}
    </p>
  );
}
