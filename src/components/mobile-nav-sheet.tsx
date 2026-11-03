"use client";

import { ArrowRight, ChevronDown, ChevronRight, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useId, useState, type ReactNode, type RefObject } from "react";

import { BrandIcon, type BrandIconName } from "@/components/brand-icons";
import { BrandLogo } from "@/components/brand-logo";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

/**
 * The marketing menu's sheet on a narrow screen (see MobileMarketingNav in
 * marketing-nav.tsx, which owns the button and the open state).
 *
 * In its own file so the sheet's code - Radix Dialog with its focus trap and
 * scroll lock - is fetched when the menu is first wanted, not with every
 * public page before its first paint.
 *
 * The button lives outside Radix (it is there before this file is), so focus
 * is handed back to it explicitly on close; Radix does that only for its own
 * trigger.
 *
 * Radix portals the sheet to <body>, outside MarketingFrame and its lang, so
 * the sheet declares the page's language itself, and its close button says
 * "close" in that language.
 */
export type MobileFeatures = {
  label: string;
  items: { title: string; sub: string; href: string; icon: LucideIcon }[];
};

export type MobileIntegrations = {
  label: string;
  socialHead: string;
  socialCount: string;
  social: { icon: BrandIconName; name: string }[];
  siteHead: string;
  siteCount: string;
  /** A connection without a public setup guide has no href and is listed as a name. */
  sites: { icon: BrandIconName; name: string; href?: string }[];
  explore: { label: string; href: string };
};

export function MobileNavSheet({
  open,
  onOpenChange,
  returnFocusTo,
  lang,
  closeLabel,
  menuLabel,
  themeLabel,
  features,
  integrations,
  links,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  returnFocusTo: RefObject<HTMLButtonElement | null>;
  /** The page's language (the address's locale). */
  lang: string;
  /** The close button's screen-reader label, in that language. */
  closeLabel: string;
  menuLabel: string;
  themeLabel: string;
  features: MobileFeatures;
  integrations: MobileIntegrations;
  links: { href: string; label: string }[];
}) {
  const close = () => onOpenChange(false);
  const mark = (icon: BrandIconName) => (
    <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-muted text-foreground">
      <BrandIcon name={icon} className="size-3.5" />
    </span>
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="left"
        lang={lang}
        closeLabel={closeLabel}
        className="w-80 overflow-y-auto p-0"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          returnFocusTo.current?.focus();
        }}
      >
        <SheetHeader className="border-b p-4">
          <SheetTitle className="text-left">
            <span aria-hidden="true"><BrandLogo height={20} /></span>
            <span className="sr-only">{menuLabel}</span>
          </SheetTitle>
        </SheetHeader>

        <div className="p-4">
          <div className="mb-3 flex items-center justify-between gap-3 border-b pb-3 sm:hidden">
            <span className="text-sm">{themeLabel}</span>
            <ThemeToggle label={themeLabel} />
          </div>

          <Section label={features.label}>
            <ul className="space-y-0.5">
              {features.items.map((item) => {
                const Icon = item.icon;
                return (
                  <li key={item.title}>
                    <Link
                      href={item.href}
                      onClick={close}
                      className="flex items-center gap-3 rounded-md px-2 py-2 text-sm transition-colors hover:bg-accent"
                    >
                      <Icon className="size-4 shrink-0 text-primary" aria-hidden="true" />
                      <span className="min-w-0">
                        <span className="block font-medium">{item.title}</span>
                        <span className="block text-xs text-muted-foreground">{item.sub}</span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </Section>

          <Section label={integrations.label}>
            <GroupHead title={integrations.socialHead} count={integrations.socialCount} />
            {/* Names, not links: there is no page per network. */}
            <ul className="grid grid-cols-2 gap-1 px-2 pb-3">
              {integrations.social.map((item) => (
                <li key={item.icon} className="flex min-w-0 items-center gap-2 py-1 text-sm">
                  {mark(item.icon)}
                  <span className="truncate">{item.name}</span>
                </li>
              ))}
            </ul>
            <GroupHead title={integrations.siteHead} count={integrations.siteCount} />
            <ul className="space-y-0.5">
              {integrations.sites.map((item) => (
                <li key={item.icon}>
                  {item.href ? (
                    <Link
                      href={item.href}
                      onClick={close}
                      className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent"
                    >
                      {mark(item.icon)}
                      <span className="min-w-0 flex-1 truncate">{item.name}</span>
                      <ChevronRight className="size-3.5 shrink-0 text-muted-foreground/60" aria-hidden="true" />
                    </Link>
                  ) : (
                    <span className="flex items-center gap-2 px-2 py-1.5 text-sm">
                      {mark(item.icon)}
                      <span className="min-w-0 truncate">{item.name}</span>
                    </span>
                  )}
                </li>
              ))}
            </ul>
            <Link
              href={integrations.explore.href}
              onClick={close}
              className="mt-2 flex items-center gap-1.5 rounded-md px-2 py-2 text-sm font-medium text-primary-strong transition-colors hover:bg-accent"
            >
              {integrations.explore.label}
              <ArrowRight className="size-3.5" aria-hidden="true" />
            </Link>
          </Section>

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

/**
 * One collapsible section: a real button that says whether it is open and
 * which list it controls. Closed by default, so the page links stay in view
 * when the sheet opens; the list stays in the markup (hidden), so search
 * engines and the tests still see where it leads.
 */
function Section({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <div className="border-b pb-1 mb-1 last:border-b-0">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((value) => !value)}
        className="flex min-h-11 w-full items-center justify-between rounded-md px-2 text-sm font-medium transition-colors hover:bg-accent"
      >
        {label}
        <ChevronDown
          className={cn("size-4 text-muted-foreground transition-transform motion-reduce:transition-none", open && "rotate-180")}
          aria-hidden="true"
        />
      </button>
      <div id={id} hidden={!open} className="pt-1 pb-2">
        {children}
      </div>
    </div>
  );
}

function GroupHead({ title, count }: { title: string; count: string }) {
  return (
    <p className="flex items-center gap-2 px-2 pt-1 pb-1.5 text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">
      {title}
      <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[0.65rem] font-medium tracking-normal text-primary-strong normal-case">
        {count}
      </span>
    </p>
  );
}
