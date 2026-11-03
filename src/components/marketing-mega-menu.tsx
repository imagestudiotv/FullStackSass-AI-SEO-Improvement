"use client";

import {
  ArrowRight,
  ChevronDown,
  ChevronRight,
  FileText,
  Link2,
  Search,
  Share2,
  Sparkles,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";

import { BRAND_NAMES, BrandIcon, type BrandIconName } from "@/components/brand-icons";
import { Button } from "@/components/ui/button";
import type { Locale } from "@/lib/i18n/config";
import type { SiteChrome } from "@/lib/i18n/site-chrome";
import { cn } from "@/lib/utils";

/**
 * The header's Features and Integrations mega-menus (client's design,
 * 2026-11-03: RepGet_Full_Homepage_CTA_Official_Footer.html).
 *
 * The words come from the server with the rest of the header's (`chrome.menu`,
 * see lib/i18n/site-chrome.ts); the destinations and marks live here, so the
 * phone menu (mobile-nav-sheet.tsx) lists exactly the same things.
 */
export type MegaMenuCopy = SiteChrome[Locale]["menu"];

/**
 * Where each tool's "Learn more" goes, in the order the copy lists them
 * (content, social, SEO, backlinks, AI search, growth).
 *
 * Only pages that exist. Three tools have a page of their own (/audit,
 * /backlinks, /rank-on-chatgpt). The other three do not yet, so they point at
 * the nearest real page rather than an address made up to fill the menu:
 *  - Content: the Image Studio case study, which walks through exactly that
 *    plan-write-publish loop on a real site;
 *  - Social: the homepage, the only public page that shows the social side;
 *  - Growth: success stories, which shows what the product measures.
 * A missing entry falls back rather than throwing, so a sixth translated tool
 * never breaks the header.
 */
export const FEATURE_TOOLS: { icon: LucideIcon; href: string }[] = [
  { icon: FileText, href: "/success-stories/image-studio" },
  /* No public social page yet: the homepage feature selector covers social. */
  { icon: Share2, href: "/#features" },
  { icon: Search, href: "/audit" },
  { icon: Link2, href: "/backlinks" },
  { icon: Sparkles, href: "/rank-on-chatgpt" },
  { icon: TrendingUp, href: "/success-stories" },
];

export function featureTool(index: number) {
  return FEATURE_TOOLS[index] ?? { icon: FileText, href: "/" };
}

/**
 * The channels RepGet publishes to: the social networks (lib/social) and the
 * video formats (lib/video). The design also showed LinkedIn and Google
 * Business Profile, which the product does not connect to, so they are left
 * out - an integrations menu is a list of promises.
 */
export const SOCIAL_PLATFORMS: BrandIconName[] = [
  "reddit",
  "quora",
  "x",
  "threads",
  "pinterest",
  "bluesky",
  "instagram",
  "tiktok",
  "youtube",
  "facebook",
];

/**
 * Website and data connections. Each publishing target links to its setup
 * guide (lib/publishing/docs.ts); WordPress goes to the plugin guide, the
 * first and recommended of its two. Search Console and Analytics are
 * connected inside the app and have no public guide, so they are listed
 * without a link.
 */
export const SITE_CONNECTIONS: { name: BrandIconName; guide?: string }[] = [
  { name: "wordpress", guide: "/docs/integrations/wordpress-plugin" },
  { name: "shopify", guide: "/docs/integrations/shopify" },
  { name: "webflow", guide: "/docs/integrations/webflow" },
  { name: "wix", guide: "/docs/integrations/wix" },
  { name: "ghost", guide: "/docs/integrations/ghost" },
  { name: "webhook", guide: "/docs/integrations/webhook" },
  { name: "searchconsole" },
  { name: "analytics" },
];

/** The integrations panel's "See the setup guides". */
export const INTEGRATIONS_HREF = "/docs/integrations";

/** "{n} platforms" with the real count, so the pill cannot drift from the list. */
export function countLabel(template: string, count: number) {
  return template.replace("{n}", String(count));
}

type MenuId = "features" | "integrations";

/**
 * Hover intent. A pointer passing over the bar on its way to the page should
 * not flash a panel open, and one crossing the gap between trigger and panel
 * should not drop it.
 */
const OPEN_DELAY = 120;
const CLOSE_DELAY = 220;
/** A click this soon after hover opened the menu keeps it open instead of closing it again. */
const HOVER_CLICK_GRACE = 600;

// Only ever read inside event handlers and timers, never while rendering.
const now = () => Date.now();

/**
 * Both menus share one piece of state, so only one is ever open.
 *
 * The panels hang from the header itself: neither this nor the nav around it
 * is positioned, so `absolute inset-x-0 top-full` resolves against the sticky
 * <header> in marketing-shell.tsx and the panel spans the full bar width
 * without moving anything in the bar - no layout shift when one opens.
 *
 * They are always in the markup and hidden with `visibility`, which takes
 * them out of the tab order and the accessibility tree while closed, keeps
 * aria-controls pointing at a real element, and lets them fade (the fade is
 * dropped for reduced motion).
 */
export function MarketingMegaMenus({ menu, href }: { menu: MegaMenuCopy; href: (path: string) => string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState<MenuId | null>(null);

  // A route change closes the menu. A link inside it closes it on click too,
  // but back/forward and links elsewhere on the page do not pass through it.
  const [seenPath, setSeenPath] = useState(pathname);
  if (pathname !== seenPath) {
    setSeenPath(pathname);
    setOpen(null);
  }

  const timer = useRef<number | undefined>(undefined);
  const openedBy = useRef<{ how: "hover" | "click"; at: number }>({ how: "click", at: 0 });
  const triggers = useRef<Record<MenuId, HTMLButtonElement | null>>({ features: null, integrations: null });
  const panels = useRef<Record<MenuId, HTMLDivElement | null>>({ features: null, integrations: null });
  const baseId = useId();

  useEffect(() => () => window.clearTimeout(timer.current), []);

  /**
   * Escape, a click elsewhere and focus moving elsewhere all close it.
   * Escape also hands focus back to the trigger when it was inside, so a
   * keyboard user is not left on an element that just disappeared.
   */
  useEffect(() => {
    if (!open) return;
    const current = open;
    const inside = (node: EventTarget | null) =>
      node instanceof Node && Boolean(triggers.current[current]?.contains(node) || panels.current[current]?.contains(node));

    function onPointerDown(event: PointerEvent) {
      if (!inside(event.target)) setOpen(null);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      const hadFocus = inside(document.activeElement);
      setOpen(null);
      if (hadFocus) triggers.current[current]?.focus();
    }
    function onFocusIn(event: FocusEvent) {
      if (!inside(event.target)) setOpen(null);
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("focusin", onFocusIn);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("focusin", onFocusIn);
    };
  }, [open]);

  const schedule = (action: () => void, delay: number) => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(action, delay);
  };

  // Hover is for a mouse only: a touch "hover" is the first half of a tap,
  // and opening on it would make the tap's click close the menu again.
  const onTriggerEnter = (id: MenuId) => (event: ReactPointerEvent) => {
    if (event.pointerType !== "mouse") return;
    if (open === id) {
      window.clearTimeout(timer.current);
      return;
    }
    // Moving from one open menu to the other switches at once.
    schedule(() => {
      openedBy.current = { how: "hover", at: now() };
      setOpen(id);
    }, open ? 0 : OPEN_DELAY);
  };
  const onPanelEnter = (event: ReactPointerEvent) => {
    if (event.pointerType === "mouse") window.clearTimeout(timer.current);
  };
  // A menu opened by click or keyboard stays until it is dismissed; only
  // one that hover opened closes when the pointer leaves.
  const onLeave = (event: ReactPointerEvent) => {
    if (event.pointerType !== "mouse") return;
    if (open && openedBy.current.how === "click") {
      window.clearTimeout(timer.current);
      return;
    }
    schedule(() => setOpen(null), CLOSE_DELAY);
  };

  const toggle = (id: MenuId) => {
    window.clearTimeout(timer.current);
    if (open === id) {
      const { how, at } = openedBy.current;
      // The click that usually follows hovering a trigger pins the menu open.
      if (how === "hover" && now() - at < HOVER_CLICK_GRACE) {
        openedBy.current = { how: "click", at: now() };
        return;
      }
      setOpen(null);
      return;
    }
    openedBy.current = { how: "click", at: now() };
    setOpen(id);
  };

  const close = () => setOpen(null);

  const items: { id: MenuId; label: string; panel: ReactNode }[] = [
    {
      id: "features",
      label: menu.features,
      panel: <FeaturesPanel menu={menu} href={href} onNavigate={close} idBase={`${baseId}-features`} />,
    },
    {
      id: "integrations",
      label: menu.integrations,
      panel: <IntegrationsPanel menu={menu} href={href} onNavigate={close} idBase={`${baseId}-integrations`} />,
    },
  ];

  return (
    <>
      {items.map(({ id, label, panel }) => {
        const isOpen = open === id;
        const triggerId = `${baseId}-${id}-trigger`;
        const panelId = `${baseId}-${id}-panel`;
        return (
          // Trigger and panel side by side in the DOM, so Tab goes from the
          // trigger straight into its open panel and then on to the next item.
          <div key={id} className="contents">
            <button
              ref={(node) => {
                triggers.current[id] = node;
              }}
              id={triggerId}
              type="button"
              aria-expanded={isOpen}
              aria-controls={panelId}
              onClick={() => toggle(id)}
              onPointerEnter={onTriggerEnter(id)}
              onPointerLeave={onLeave}
              className={cn(
                "flex items-center gap-1 rounded-md px-2.5 py-1.5 text-sm whitespace-nowrap transition-colors xl:px-3",
                isOpen
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              )}
            >
              {label}
              <ChevronDown
                className={cn("size-3.5 transition-transform motion-reduce:transition-none", isOpen && "rotate-180")}
                aria-hidden="true"
              />
            </button>
            <div
              ref={(node) => {
                panels.current[id] = node;
              }}
              id={panelId}
              aria-labelledby={triggerId}
              role="region"
              className={cn(
                // The outer layer lets the pointer through to the page beside
                // the card; only the card itself counts as "inside".
                "pointer-events-none absolute inset-x-0 top-full z-50 transition-[opacity,transform,visibility] duration-150 ease-out motion-reduce:transition-none",
                isOpen ? "visible translate-y-0 opacity-100" : "invisible -translate-y-1 opacity-0 motion-reduce:translate-y-0",
              )}
            >
              <div className="mx-auto max-w-6xl px-4 pt-2">
                <div
                  onPointerEnter={onPanelEnter}
                  onPointerLeave={onLeave}
                  // Scrolls inside itself on a short window rather than running off the screen.
                  className="pointer-events-auto max-h-[calc(100dvh-5rem)] overflow-y-auto overscroll-contain rounded-2xl border bg-background text-foreground shadow-xl"
                >
                  {panel}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </>
  );
}

/**
 * Six tools as tabs, with the selected one described beside them.
 *
 * Tabs (roving focus, arrow keys, Home/End) because that is what the list
 * is: one choice switching the pane below. Hover and focus switch it too, as
 * in the design; "Learn more" is the only way out to the tool's page.
 */
function FeaturesPanel({
  menu,
  href,
  onNavigate,
  idBase,
}: {
  menu: MegaMenuCopy;
  href: (path: string) => string;
  onNavigate: () => void;
  idBase: string;
}) {
  const [active, setActive] = useState(0);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const count = menu.tools.length;
  const tool = menu.tools[active] ?? menu.tools[0];
  const tabId = (index: number) => `${idBase}-tab-${index}`;
  const paneId = `${idBase}-pane`;

  const select = (index: number, focus = false) => {
    setActive(index);
    if (focus) tabs.current[index]?.focus();
  };

  const onKeyDown = (index: number) => (event: ReactKeyboardEvent) => {
    let next: number;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") next = (index + 1) % count;
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = (index - 1 + count) % count;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = count - 1;
    else return;
    event.preventDefault();
    select(next, true);
  };

  if (!tool) return null;
  const { icon: ActiveIcon, href: target } = featureTool(active);

  return (
    <div>
      <div className="p-5 pb-4">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
          <div>
            <p className="text-xs font-semibold tracking-[0.14em] text-primary-strong uppercase">{menu.featuresOverline}</p>
            <p className="mt-1 text-xl font-semibold tracking-tight">{menu.featuresTitle}</p>
          </div>
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="size-2 rounded-full bg-primary" aria-hidden="true" />
            {menu.featuresTagline}
          </p>
        </div>

        <div role="tablist" aria-label={menu.featuresTitle} className="mt-4 grid grid-cols-6 gap-2">
          {menu.tools.map((item, index) => {
            const selected = index === active;
            const Icon = featureTool(index).icon;
            return (
              <button
                key={item.title}
                ref={(node) => {
                  tabs.current[index] = node;
                }}
                id={tabId(index)}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls={paneId}
                tabIndex={selected ? 0 : -1}
                onClick={() => select(index)}
                onFocus={() => select(index)}
                onPointerEnter={(event) => {
                  if (event.pointerType === "mouse") select(index);
                }}
                onKeyDown={onKeyDown(index)}
                className={cn(
                  "flex min-w-0 flex-col items-start gap-2 rounded-xl border p-3 text-left transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transition-none",
                  selected ? "border-primary/50 bg-primary/5" : "hover:bg-accent/60",
                )}
              >
                <span
                  className={cn(
                    "flex size-8 items-center justify-center rounded-lg transition-colors",
                    selected ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary",
                  )}
                >
                  <Icon className="size-4" aria-hidden="true" />
                </span>
                <span className="block w-full min-w-0">
                  <span className="block truncate text-sm font-semibold">{item.title}</span>
                  <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">{item.sub}</span>
                </span>
              </button>
            );
          })}
        </div>

        <div
          id={paneId}
          role="tabpanel"
          aria-labelledby={tabId(active)}
          className="mt-3 grid gap-6 rounded-xl border bg-muted/40 p-5 md:grid-cols-[minmax(0,1fr)_16rem]"
        >
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-xs font-semibold tracking-[0.14em] text-primary-strong uppercase">
              <ActiveIcon className="size-3.5" aria-hidden="true" />
              {tool.kicker}
            </p>
            {/* Announced when "Next" changes it, so the button is not silent. */}
            <p aria-live="polite" className="mt-2 text-2xl font-semibold tracking-tight">
              {tool.heading}
            </p>
            <p className="mt-2 max-w-prose text-sm text-muted-foreground">{tool.body}</p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Button size="sm" asChild>
                <Link href={href(target)} onClick={onNavigate}>
                  {menu.open}
                  <ArrowRight aria-hidden="true" />
                </Link>
              </Button>
              <Button size="sm" variant="ghost" type="button" onClick={() => select((active + 1) % count)}>
                {menu.next}
                <ChevronRight aria-hidden="true" />
              </Button>
            </div>
          </div>
          <ol className="flex flex-col justify-center gap-2 self-center">
            {tool.steps.map((step, index) => (
              <li key={step} className="flex items-center gap-3 rounded-lg border bg-background px-3 py-2 text-sm">
                <span
                  className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary-strong"
                  aria-hidden="true"
                >
                  {index + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
        </div>
      </div>
      <p className="border-t bg-muted/40 px-5 py-3 text-xs text-muted-foreground">{menu.bottom}</p>
    </div>
  );
}

/**
 * Where RepGet publishes and what it reads. Platforms are names, not links -
 * there is no page per network; the website connections open their guides.
 */
function IntegrationsPanel({
  menu,
  href,
  onNavigate,
  idBase,
}: {
  menu: MegaMenuCopy;
  href: (path: string) => string;
  onNavigate: () => void;
  idBase: string;
}) {
  const tile = "flex min-w-0 items-center gap-2.5 rounded-lg border px-3 py-2 text-sm";
  const mark = (name: BrandIconName) => (
    <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-foreground">
      <BrandIcon name={name} className="size-4" />
    </span>
  );

  return (
    <div>
      <div className="grid gap-6 p-5 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div role="group" aria-labelledby={`${idBase}-social`}>
          <AreaHead id={`${idBase}-social`} title={menu.socialHead} count={countLabel(menu.platforms, SOCIAL_PLATFORMS.length)} />
          <p className="mt-1 text-sm text-muted-foreground">{menu.socialSub}</p>
          <ul className="mt-3 grid grid-cols-3 gap-2">
            {SOCIAL_PLATFORMS.map((name) => (
              <li key={name} className={tile}>
                {mark(name)}
                <span className="truncate">{BRAND_NAMES[name]}</span>
              </li>
            ))}
          </ul>
        </div>

        <div role="group" aria-labelledby={`${idBase}-site`}>
          <AreaHead id={`${idBase}-site`} title={menu.siteHead} count={countLabel(menu.connections, SITE_CONNECTIONS.length)} />
          <p className="mt-1 text-sm text-muted-foreground">{menu.siteSub}</p>
          <ul className="mt-3 grid grid-cols-2 gap-2">
            {SITE_CONNECTIONS.map(({ name, guide }) => (
              <li key={name}>
                {guide ? (
                  <Link
                    href={href(guide)}
                    onClick={onNavigate}
                    className={cn(tile, "group transition-colors hover:bg-accent/60")}
                  >
                    {mark(name)}
                    <span className="truncate">{BRAND_NAMES[name]}</span>
                    <ChevronRight
                      className="ml-auto size-3.5 shrink-0 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none"
                      aria-hidden="true"
                    />
                  </Link>
                ) : (
                  <span className={tile}>
                    {mark(name)}
                    <span className="truncate">{BRAND_NAMES[name]}</span>
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4 border-t bg-muted/40 px-5 py-4">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Sparkles className="size-4" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{menu.footerTitle}</p>
          <p className="text-sm text-muted-foreground">{menu.footerBody}</p>
        </div>
        <Button size="sm" asChild>
          <Link href={href(INTEGRATIONS_HREF)} onClick={onNavigate}>
            {menu.explore}
            <ArrowRight aria-hidden="true" />
          </Link>
        </Button>
      </div>
    </div>
  );
}

function AreaHead({ id, title, count }: { id: string; title: string; count: string }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <p id={id} className="text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">
        {title}
      </p>
      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[0.7rem] font-medium text-primary-strong">{count}</span>
    </div>
  );
}
