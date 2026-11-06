"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState, useSyncExternalStore, type ReactNode } from "react";

import { BrandHomeLink } from "@/components/brand-home-link";
import { CookieSettingsButton } from "@/components/consent-banner";
import { LanguageSwitcher } from "@/components/language-switcher";
import {
  FeaturesShowcase,
  IntegrationsShowcase,
  c,
  type Channel,
} from "@/components/marketing-mega-menu";
import { ArrowUpRightIcon, BarsIcon, ChevronIcon, CloseIcon, MoonIcon, SunIcon } from "@/components/site-icons";
import { ThemeToggle } from "@/components/theme-toggle";
import { localePath, SITE_LANGUAGE_COOKIE, splitLocale } from "@/lib/i18n/config";
import type { siteMenuCopy } from "@/lib/i18n/home/site-menu";
import type { SiteChrome } from "@/lib/i18n/site-chrome";

import footer from "./site-footer.module.css";

/**
 * The public site's header and footer (client's homepage design,
 * 2026-11-03), on every public page.
 *
 * Client components so they can read the current locale from the pathname.
 * The layout is a server component with no access to the URL, so the nav
 * stayed in English on /es — a Spanish page with an English menu reads as a
 * half-finished translation, which is worse than not offering one.
 *
 * The words arrive as a prop (`chrome`, every language) from the server shell.
 * Never import messages.ts here: in a client component that ships the whole
 * dictionary to every visitor (see lib/i18n/site-chrome.ts).
 *
 * Every in-site link is built with localePath, so someone reading in Spanish
 * stays in Spanish as they navigate. Links to pages that exist only in English
 * (sign-in, sign-up, the legal pages) deliberately keep their own paths.
 */

/**
 * Declares the address's language around the banner, header, page and
 * footer, so /es is read as Spanish rather than English.
 *
 * <html lang> comes from the shared root layout, which cannot know the
 * address without making every prerendered page dynamic, so it says "en"
 * everywhere; this nearer lang overrides it for everything inside. It reads
 * the same source as the menu's words (splitLocale of the pathname), so the
 * server and the browser agree - including on "/index", the name the cached
 * home page is regenerated under.
 */
export function MarketingFrame({ className, children }: { className?: string; children: ReactNode }) {
  const { locale } = splitLocale(usePathname());
  return (
    <div lang={locale} className={className}>
      {children}
    </div>
  );
}

type MenuId = "features" | "integrations";

/** The design's hover intent: leaving a trigger or a menu closes it after this long. */
const CLOSE_DELAY = 260;
/** The design's breakpoint for the phone drawer. */
const DRAWER_QUERY = "(max-width:1190px)";
/** The bar shrinks once the page has scrolled this far. */
const SCROLLED_AT = 28;

function subscribeDrawerQuery(onChange: () => void) {
  const query = window.matchMedia(DRAWER_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/** Whether the drawer replaces the bar's menus. False on the server, which renders the desktop placement. */
function useDrawerLayout() {
  return useSyncExternalStore(
    subscribeDrawerQuery,
    () => window.matchMedia(DRAWER_QUERY).matches,
    () => false,
  );
}

const themeIcons = {
  light: <MoonIcon fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.85" />,
  dark: <SunIcon fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.85" />,
};

/**
 * The floating bar: logo, the nav pill (Features and Integrations menus,
 * then the pages), and night mode, Sign in and Get Started. At 1190px and
 * below the pill gives way to a menu button and a drawer under the bar.
 *
 * Behaviour as in the design: a trigger opens its menu on hover, focus or
 * click; leaving the trigger or the menu closes it after 260ms; hovering a
 * plain link, a click outside, Escape and crossing the breakpoint close
 * everything. Added for keyboards: each menu sits right after its trigger,
 * so Tab walks into it; focus leaving the header closes it; Escape hands
 * focus back to the trigger or the menu button.
 */
export function MarketingNav({ chrome }: { chrome: SiteChrome }) {
  const pathname = usePathname();
  const { locale } = splitLocale(pathname);
  const t = chrome[locale];
  const href = (path: string) => localePath(locale, path);
  const homeLabels = Object.fromEntries(Object.entries(chrome).map(([key, words]) => [key, words.a11y.brandHome]));

  const [open, setOpen] = useState<MenuId | null>(null);
  const [drawer, setDrawer] = useState(false);
  const [accordion, setAccordion] = useState<Record<MenuId, boolean>>({ features: false, integrations: false });
  const [scrolled, setScrolled] = useState(false);
  // The two showcases' state, kept here so it survives moving between the bar and the drawer.
  const [feature, setFeature] = useState(0);
  const [channel, setChannel] = useState<Channel["key"] | null>(null);
  const inDrawer = useDrawerLayout();

  // For sign-in and sign-up, whose address cannot say which language this visitor is reading.
  useEffect(() => {
    document.cookie = `${SITE_LANGUAGE_COOKIE}=${locale}; path=/; max-age=31536000; samesite=lax${window.location.protocol === "https:" ? "; secure" : ""}`;
  }, [locale]);
  /*
    A visitor is about to open a menu: draw its icons and load the words of its
    drawings (marketing-mega-menu.tsx). A failed download only leaves the
    drawings out; the links and the words of the menu are already there.
  */
  const [awake, setAwake] = useState(false);
  const [drawingWords, setDrawingWords] = useState<{ of: typeof siteMenuCopy } | null>(null);
  const woken = useRef(false);
  const wake = () => {
    if (woken.current) return;
    woken.current = true;
    setAwake(true);
    import("@/lib/i18n/home/site-menu").then(
      (words) => setDrawingWords({ of: words.siteMenuCopy }),
      () => {},
    );
  };
  const drawings = drawingWords?.of(locale) ?? null;

  const zone = useRef<HTMLDivElement>(null);
  const triggers = useRef<Record<MenuId, HTMLButtonElement | null>>({ features: null, integrations: null });
  const menuButton = useRef<HTMLButtonElement>(null);
  const timer = useRef<number | undefined>(undefined);
  // Focus handed back to a trigger by Escape must not reopen its menu.
  const quietFocus = useRef(false);
  const id = useId();

  // A route change closes everything: links inside close on click, but
  // back/forward and links elsewhere on the page do not pass through them.
  const [seenPath, setSeenPath] = useState(pathname);
  if (pathname !== seenPath) {
    setSeenPath(pathname);
    setOpen(null);
    setDrawer(false);
  }
  // So does crossing the drawer breakpoint.
  const [seenLayout, setSeenLayout] = useState(inDrawer);
  if (inDrawer !== seenLayout) {
    setSeenLayout(inDrawer);
    setOpen(null);
    setDrawer(false);
  }

  const show = (menu: MenuId | null) => {
    if (menu) wake();
    window.clearTimeout(timer.current);
    setOpen(menu);
  };
  const scheduleClose = () => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setOpen(null), CLOSE_DELAY);
  };
  const closeAll = () => {
    show(null);
    setDrawer(false);
  };

  useEffect(() => () => window.clearTimeout(timer.current), []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > SCROLLED_AT);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!open && !drawer) return;
    const inside = (node: EventTarget | null) => node instanceof Node && Boolean(zone.current?.contains(node));
    function onPointerDown(event: PointerEvent) {
      if (!inside(event.target)) {
        window.clearTimeout(timer.current);
        setOpen(null);
        setDrawer(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      const hadFocus = inside(document.activeElement);
      window.clearTimeout(timer.current);
      if (open) {
        setOpen(null);
        if (hadFocus) {
          quietFocus.current = true;
          triggers.current[open]?.focus();
          quietFocus.current = false;
        }
      }
      if (drawer) {
        setDrawer(false);
        if (hadFocus) menuButton.current?.focus();
      }
    }
    function onFocusIn(event: FocusEvent) {
      if (!inside(event.target)) {
        setOpen(null);
        setDrawer(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("focusin", onFocusIn);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("focusin", onFocusIn);
    };
  }, [open, drawer]);

  const features = (
    <FeaturesShowcase
      menu={t.menu}
      site={t.site}
      href={href}
      active={feature}
      awake={awake}
      drawings={drawings}
      onSelect={setFeature}
      onNavigate={closeAll}
    />
  );
  const integrations = (
    <IntegrationsShowcase
      menu={t.menu}
      site={t.site}
      href={href}
      selected={channel}
      awake={awake}
      drawings={drawings}
      onSelect={setChannel}
      onNavigate={closeAll}
    />
  );

  const menus: { id: MenuId; label: string; panel: ReactNode; className: string }[] = [
    { id: "features", label: t.menu.features, panel: features, className: "menu features-menu" },
    { id: "integrations", label: t.menu.integrations, panel: integrations, className: "menu integrations-menu" },
  ];
  const links = [
    { href: href("/success-stories"), label: t.nav.successStories },
    { href: href("/pricing"), label: t.nav.pricing },
    { href: href("/blog"), label: t.nav.blog },
    { href: href("/contact"), label: t.nav.contact },
  ];
  const drawerId = `${id}-drawer`;

  return (
    <header className={c(`header${scrolled ? " scrolled" : ""}`)}>
      {/* Reaching the header is the first sign of a menu about to open: the drawings are ready by then. */}
      <div ref={zone} className={c("header-shell")} onPointerEnter={wake}>
        <div className={c("bar")}>
          <BrandHomeLink className={c("brand")} labels={homeLabels}>
            {/* The page's primary logo, so it is not lazy-loaded. */}
            <Image
              src="/images/repget-logo.png"
              alt="RepGet"
              width={167}
              height={42}
              priority
              className={c("brand-logo brand-logo-light")}
            />
            {/* The dark theme's copy: lazy, so a light page never fetches it. */}
            <Image
              src="/images/repget-logo-light.png"
              alt=""
              aria-hidden="true"
              width={167}
              height={42}
              className={c("brand-logo brand-logo-dark")}
            />
          </BrandHomeLink>

          <nav aria-label={t.site.primaryNav} className={c("nav-pill")}>
            {menus.map((menu) => {
              const isOpen = open === menu.id;
              const triggerId = `${id}-${menu.id}-trigger`;
              const panelId = `${id}-${menu.id}-menu`;
              return (
                // Trigger and menu side by side, so Tab goes from the trigger
                // into its open menu and then on to the next item.
                <div key={menu.id} style={{ display: "contents" }}>
                  <button
                    ref={(node) => {
                      triggers.current[menu.id] = node;
                    }}
                    id={triggerId}
                    type="button"
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                    data-menu-trigger={menu.id}
                    className={c(`nav-link${isOpen ? " active" : ""}`)}
                    onMouseEnter={() => show(menu.id)}
                    onMouseLeave={scheduleClose}
                    onClick={() => show(menu.id)}
                    onFocus={() => {
                      if (!quietFocus.current) show(menu.id);
                    }}
                  >
                    {menu.label}
                    <ChevronIcon className={c("chev")} fill="none" stroke="currentColor" strokeWidth="2" />
                  </button>
                  <div
                    id={panelId}
                    role="region"
                    aria-labelledby={triggerId}
                    data-menu={menu.id}
                    className={c(`${menu.className}${isOpen ? " open" : ""}`)}
                    onMouseEnter={() => window.clearTimeout(timer.current)}
                    onMouseLeave={scheduleClose}
                  >
                    {inDrawer ? null : menu.panel}
                  </div>
                </div>
              );
            })}
            {links.map((link) => (
              <Link prefetch={false} key={link.href} href={link.href} className={c("nav-link")} onMouseEnter={() => show(null)}>
                {link.label}
              </Link>
            ))}
          </nav>

          <div className={c("actions")}>
            <ThemeToggle label={t.a11y.darkMode} className={c("theme")} icons={themeIcons} />
            <Link prefetch={false} href="/sign-in" className={c("signin")}>
              {t.nav.signIn}
            </Link>
            <Link prefetch={false} href="/sign-up" className={c("cta")}>
              {t.nav.getStartedCta}{" "}
              <span className={c("cta-arrow")}>
                <ArrowUpRightIcon fill="none" stroke="white" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
              </span>
            </Link>
            <button
              ref={menuButton}
              type="button"
              aria-controls={drawerId}
              aria-expanded={drawer}
              aria-label={drawer ? t.site.closeMenu : t.a11y.openMenu}
              className={c("mob-button")}
              onClick={() => {
                wake();
                show(null);
                setDrawer((value) => !value);
              }}
            >
              {drawer ? (
                <CloseIcon fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
              ) : (
                <BarsIcon fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
              )}
            </button>
          </div>
        </div>

        <nav id={drawerId} aria-label={t.site.primaryNav} className={c(`drawer${drawer ? " open" : ""}`)}>
          {menus.map((menu) => {
            const panelId = `${id}-${menu.id}-drawer`;
            const expanded = accordion[menu.id];
            return (
              <div key={menu.id} className={c("drawer-row")}>
                <button
                  type="button"
                  aria-expanded={expanded}
                  aria-controls={panelId}
                  className={c("drawer-toggle")}
                  onClick={() => setAccordion((state) => ({ ...state, [menu.id]: !state[menu.id] }))}
                >
                  {menu.label}
                  <ChevronIcon fill="none" stroke="currentColor" strokeWidth="2" />
                </button>
                <div
                  id={panelId}
                  className={c(`drawer-panel mobile-${menu.id}${expanded ? " open" : ""}`)}
                >
                  {inDrawer ? menu.panel : null}
                </div>
              </div>
            );
          })}
          {links.map((link) => (
            <Link prefetch={false} key={link.href} href={link.href} className={c("drawer-link")} onClick={() => setDrawer(false)}>
              {link.label}
            </Link>
          ))}
          <div className={c("drawer-footer")}>
            <Link prefetch={false} href="/sign-in" onClick={() => setDrawer(false)}>
              {t.nav.signIn}
            </Link>
            <Link prefetch={false} href="/sign-up" onClick={() => setDrawer(false)}>
              {t.nav.getStartedCta} ↗
            </Link>
          </div>
        </nav>
      </div>
    </header>
  );
}

/**
 * Footer link groups, localised the same way: Product, Company and Legal,
 * as the design's three columns beside the brand.
 */
export function MarketingFooterLinks({ chrome }: { chrome: SiteChrome }) {
  const pathname = usePathname();
  const { locale } = splitLocale(pathname);
  const t = chrome[locale];
  const href = (path: string) => localePath(locale, path);

  const groups = [
    {
      title: t.footer.product,
      items: [
        { href: href("/website-creation"), label: t.footer.websiteCreation },
        { href: href("/audit"), label: t.footer.freeCheck },
        { href: href("/tools"), label: t.footer.freeTools },
        { href: href("/pricing"), label: t.footer.pricing },
        // English-only pages for now: href() leaves them on their own path.
        { href: href("/backlinks"), label: t.footer.backlinks },
        { href: href("/rank-on-chatgpt"), label: t.footer.rankOnChatgpt },
        { href: href("/backlink-exchange"), label: t.footer.backlinkExchange },
        { href: href("/publishers"), label: t.footer.publishers },
        /*
          The cash Affiliate Program only (client, 2026-10-23: two
          "partner" links side by side confused visitors). The credit
          referral page, /affiliate, is still linked from /partners and
          customers keep their referral link in Settings.
        */
        { href: href("/partners"), label: t.footer.partners },
      ],
    },
    {
      /*
        Through href() too: about, stories, FAQ and contact have translated
        pages, and a German reader following one from here should land on the
        German one. (href leaves a page that exists only in English on its
        own path; the blog's front page has a page per language.)
      */
      title: t.footer.company,
      items: [
        { href: href("/about"), label: t.footer.about },
        // Also in the header; listed here so the footer stays a full index.
        { href: href("/success-stories"), label: t.nav.successStories },
        { href: href("/blog"), label: t.footer.blog },
        { href: href("/faq"), label: t.footer.faq },
        { href: href("/contact"), label: t.footer.contact },
        { href: `${href("/contact")}#feedback`, label: t.footer.feedback },
      ],
    },
    {
      /*
        Legal pages stay in English: privacy, terms and refunds carry
        commitments with specific legal meanings, and a mistranslated one is
        a liability rather than a typo.
      */
      title: t.footer.legal,
      cookieSettings: true,
      items: [
        { href: "/privacy", label: t.footer.privacy },
        { href: "/terms", label: t.footer.terms },
        { href: "/refunds", label: t.footer.refunds },
      ],
    },
  ];

  return (
    <>
      {groups.map((group) => (
        <nav key={group.title} aria-label={group.title} className={footer["rft-column"]}>
          <p className={footer["rft-column-title"]}>{group.title}</p>
          <ul>
            {group.items.map((item) => (
              <li key={item.href}>
                <Link prefetch={false} href={item.href}>{item.label}</Link>
              </li>
            ))}
            {/* Opens the cookie panel: the choice, or that there is none with no Google tag configured. */}
            {group.cookieSettings ? (
              <li>
                <CookieSettingsButton label={t.consent.settings} className={footer["rft-footer-link"]} />
              </li>
            ) : null}
          </ul>
        </nav>
      ))}
    </>
  );
}

/**
 * Tagline under the footer logo, with the language switcher and night mode
 * beneath it, drawn as the design's footer controls.
 *
 * The switcher is still hidden on pages that exist only in English, which is
 * the component's own behaviour rather than anything decided here.
 */
export function MarketingTagline({ chrome }: { chrome: SiteChrome }) {
  const pathname = usePathname();
  const { locale } = splitLocale(pathname);
  const t = chrome[locale];
  const icon = { fill: "none", stroke: "currentColor", strokeWidth: "1.8", strokeLinecap: "round", strokeLinejoin: "round" } as const;
  return (
    <>
      <p>{t.footer.tagline}</p>
      <div className={footer["rft-controls"]}>
        <LanguageSwitcher
          label={t.a11y.changeLanguage}
          appearance={{
            summary: footer["rft-language"],
            name: footer["rft-language-name"],
            icon: (
              <svg viewBox="0 0 24 24" aria-hidden="true" {...icon}>
                <circle cx="12" cy="12" r="9" />
                <path d="M3 12h18M12 3c-5 5.4-5 12.6 0 18M12 3c5 5.4 5 12.6 0 18" />
              </svg>
            ),
            chevron: <span className={footer["rft-language-chevron"]} aria-hidden="true" />,
          }}
        />
        <ThemeToggle
          label={t.a11y.darkMode}
          className={footer["rft-theme-toggle"]}
          icons={{
            light: (
              <svg viewBox="0 0 24 24" aria-hidden="true" {...icon}>
                <path d="M20.6 14.4A8.6 8.6 0 0 1 9.6 3.4 8.6 8.6 0 1 0 20.6 14.4Z" />
              </svg>
            ),
            dark: (
              <svg viewBox="0 0 24 24" aria-hidden="true" {...icon}>
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42" />
              </svg>
            ),
          }}
        />
      </div>
    </>
  );
}

/**
 * The footer's "Back to top": a smooth scroll to the top of the page, or an
 * instant one for someone who asked for reduced motion. A link to "#top"
 * underneath, which every browser scrolls to the top even without script.
 */
export function BackToTop({ chrome }: { chrome: SiteChrome }) {
  const { locale } = splitLocale(usePathname());
  const t = chrome[locale].site;
  return (
    <a
      href="#top"
      aria-label={t.backToTopLabel}
      className={footer["rft-back-to-top"]}
      onClick={(event) => {
        event.preventDefault();
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
      }}
    >
      {t.backToTop}{" "}
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 19V5m-6 6 6-6 6 6" />
      </svg>
    </a>
  );
}
