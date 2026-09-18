"use client";

import {
  Activity,
  ArrowRight,
  BarChart3,
  ChevronDown,
  ChevronRight,
  FileText,
  Link2,
  Menu,
  Sparkles,
  TrendingDown,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { BrandLogo } from "@/components/brand-logo";
import { LanguageSwitcher } from "@/components/language-switcher";
import { localePath, splitLocale } from "@/lib/i18n/config";
import { getMessages } from "@/lib/i18n/messages";
import { cn } from "@/lib/utils";

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

/**
 * The Platform dropdown.
 *
 * Icons and destinations live here; the words live in messages.ts, so the
 * menu translates with everything else. The order matches the two arrays,
 * which is why both are kept the same length and why a missing icon falls
 * back rather than throwing.
 *
 * Every destination is a section of the homepage that already exists. None of
 * these are separate pages yet: writing six feature pages to fill a menu
 * would mean six thin pages competing with the homepage for the same terms,
 * and a menu that points at real content is worth more than one that points
 * at placeholders.
 */
const PLATFORM_ICONS: LucideIcon[] = [
  FileText,
  Link2,
  Activity,
  BarChart3,
  Sparkles,
  TrendingDown,
];

/**
 * Where each entry goes, in the order the copy lists them.
 *
 * Search Performance and AI Presence share #tracking: that section covers
 * rankings from Search Console and whether assistants name you, so it is
 * genuinely about both. Site Intelligence points at /audit, a real tool that
 * finds exactly what the entry describes.
 */
const PLATFORM_HREFS = [
  "/#content-engine",
  "/#authority-network",
  "/audit",
  "/#tracking",
  "/#tracking",
  "/#traffic-recovery",
];

function PlatformMenu({
  label,
  heading,
  items,
  href,
}: {
  label: string;
  heading: string;
  items: { title: string; detail: string }[];
  href: (path: string) => string;
}) {
  const [open, setOpen] = useState(false);
  const wrapper = useRef<HTMLDivElement>(null);

  /**
   * Close on a click elsewhere or on Escape.
   *
   * Opening on hover alone would leave the menu unusable by keyboard and
   * unreliable on a touchscreen, where there is no hover to leave. It opens
   * on click, and these two handlers are what let it close again.
   */
  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (!wrapper.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div
      ref={wrapper}
      className="relative"
      // Hover opens it as well, for a pointer. The click handlers above stay
      // authoritative, so a keyboard or touch user is never stranded.
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="true"
        className={cn(
          "flex items-center gap-1 rounded-md px-3 py-1.5 text-sm transition-colors",
          open
            ? "bg-accent text-accent-foreground"
            : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
        )}
      >
        {label}
        <ChevronDown
          className={cn("size-3.5 transition-transform", open && "rotate-180")}
          aria-hidden="true"
        />
      </button>

      {open ? (
        <div
          className="absolute left-0 top-full z-50 w-[26rem] max-w-[calc(100vw-2rem)] pt-2"
          role="menu"
        >
          <div className="overflow-hidden rounded-2xl border bg-background shadow-lg">
            <p className="px-5 pt-5 pb-3 text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">
              {heading}
            </p>
            <ul className="pb-2">
              {items.map((item, index) => {
                const Icon = PLATFORM_ICONS[index] ?? FileText;
                const target = PLATFORM_HREFS[index] ?? "/";
                return (
                  <li key={item.title}>
                    <Link
                      href={href(target)}
                      role="menuitem"
                      onClick={() => setOpen(false)}
                      className="group flex items-start gap-4 px-5 py-3 transition-colors hover:bg-accent/60"
                    >
                      <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                        <Icon
                          className="size-5 text-primary"
                          aria-hidden="true"
                        />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold">
                          {item.title}
                        </span>
                        <span className="mt-0.5 block text-sm text-muted-foreground">
                          {item.detail}
                        </span>
                      </span>
                      <ChevronRight
                        className="mt-3 size-4 shrink-0 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5"
                        aria-hidden="true"
                      />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/**
 * The same menu on a narrow screen.
 *
 * The marketing header had no mobile menu at all: below the breakpoint the
 * nav simply vanished and a phone was left with the logo and two buttons.
 * That was survivable while the nav broke at 640px, but the Platform
 * dropdown pushes the row past what a tablet can fit, so the gap would have
 * grown to cover most laptops.
 *
 * A sheet rather than a second dropdown. The platform entries are listed flat
 * inside it, because nesting an accordion in a drawer to save six rows is
 * more machinery than the content justifies.
 */
function MobileMarketingNav({
  t,
  href,
}: {
  t: ReturnType<typeof getMessages>;
  href: (path: string) => string;
}) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  const links = [
    { href: href("/#how-it-works"), label: t.nav.howItWorks },
    { href: "/success-stories", label: t.nav.successStories },
    { href: href("/pricing"), label: t.nav.pricing },
    { href: "/blog", label: t.nav.blog },
    { href: "/contact", label: t.nav.contact },
  ];

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          aria-label="Open menu"
        >
          <Menu className="size-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-80 overflow-y-auto p-0">
        <SheetHeader className="border-b p-4">
          <SheetTitle className="text-left">
            <BrandLogo height={20} />
          </SheetTitle>
        </SheetHeader>

        <div className="p-4">
          <p className="px-2 pb-2 text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">
            {t.nav.platformHeading}
          </p>
          <ul className="space-y-0.5">
            {t.nav.platformItems.map((item, index) => {
              const Icon = PLATFORM_ICONS[index] ?? FileText;
              return (
                <li key={item.title}>
                  <Link
                    href={href(PLATFORM_HREFS[index] ?? "/")}
                    onClick={close}
                    className="flex items-center gap-3 rounded-md px-2 py-2 text-sm transition-colors hover:bg-accent"
                  >
                    <Icon
                      className="size-4 shrink-0 text-primary"
                      aria-hidden="true"
                    />
                    {item.title}
                  </Link>
                </li>
              );
            })}
          </ul>

          <div className="my-3 border-t" role="presentation" />

          <ul className="space-y-0.5">
            {links.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  onClick={close}
                  className="block rounded-md px-2 py-2 text-sm transition-colors hover:bg-accent"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function MarketingNav() {
  const pathname = usePathname();
  const { locale } = splitLocale(pathname);
  const t = getMessages(locale);
  const href = (path: string) => localePath(locale, path);

  return (
    <>
      {/*
        Only pages that exist. Every link here resolves.

        Free check and Tools moved to the footer rather than being deleted:
        both are real pages that bring people in from search, and the footer
        already lists them, so nothing became unreachable.

        Success stories is a real page rather than a placeholder. There are no
        named customers yet, so it shows what the product measures and invites
        the reader to be the first — see that page for why it does not invent
        any.
      */}
      {/*
        Centred in the header rather than pushed against the buttons.

        Both this and the button group carried ml-auto, so the nav was shoved
        as far right as the buttons allowed and read as one long right-hand
        cluster. Centring needs the nav to be the only growing child: it takes
        the free space on both sides with mx-auto, and the button group below
        drops its ml-auto so it no longer competes for the same space.
      */}
      <nav className="mx-auto hidden items-center gap-1 lg:flex">
        <PlatformMenu
          label={t.nav.platform}
          heading={t.nav.platformHeading}
          items={t.nav.platformItems}
          href={href}
        />
        {[
          { href: href("/#how-it-works"), label: t.nav.howItWorks },
          { href: "/success-stories", label: t.nav.successStories },
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

      <div className="ml-auto flex items-center gap-2 lg:ml-0">
        <MobileMarketingNav t={t} href={href} />
        <Button variant="ghost" size="sm" asChild>
          <Link href="/sign-in">{t.nav.signIn}</Link>
        </Button>
        <Button size="sm" asChild>
          <Link href="/sign-up">
            {t.nav.getStartedCta}
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
          // Also in the header; listed here so the footer stays a full index.
          { href: "/success-stories", label: t.nav.successStories },
          { href: "/blog", label: t.footer.blog },
          { href: "/faq", label: t.footer.faq },
          { href: "/about", label: t.footer.about },
          {
            href: href("/backlink-exchange"),
            label: t.footer.backlinkExchange,
          },
          { href: "/publishers", label: t.footer.publishers },
          { href: "/affiliate", label: t.footer.affiliate },
          { href: "/contact", label: t.footer.contact },
        ].map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="block py-1 text-muted-foreground hover:text-foreground"
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
            className="block py-1 text-muted-foreground hover:text-foreground"
          >
            {item.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

/**
 * Tagline under the footer logo, with the language switcher beneath it.
 *
 * The switcher used to sit in the header beside the sign-in buttons. It is a
 * preference someone sets once, not something they navigate with, and in the
 * header it competed for attention with the two things that page is for —
 * signing in and starting. The footer is where a reader looks for it, and it
 * is the convention on most of the sites this one is compared against.
 *
 * Still hidden on pages that exist only in English, which is the component's
 * own behaviour rather than anything decided here.
 */
export function MarketingTagline() {
  const pathname = usePathname();
  const { locale } = splitLocale(pathname);
  return (
    <>
      <p className="mt-2 max-w-xs text-sm text-muted-foreground">
        {getMessages(locale).footer.tagline}
      </p>
      <div className="mt-4">
        <LanguageSwitcher />
      </div>
    </>
  );
}
