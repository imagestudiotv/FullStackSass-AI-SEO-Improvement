"use client";

import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import type { RefObject } from "react";

import { BrandLogo } from "@/components/brand-logo";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

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
 */
export function MobileNavSheet({
  open,
  onOpenChange,
  returnFocusTo,
  heading,
  platform,
  links,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  returnFocusTo: RefObject<HTMLButtonElement | null>;
  heading: string;
  platform: { title: string; href: string; icon: LucideIcon }[];
  links: { href: string; label: string }[];
}) {
  const close = () => onOpenChange(false);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="left"
        className="w-80 overflow-y-auto p-0"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          returnFocusTo.current?.focus();
        }}
      >
        <SheetHeader className="border-b p-4">
          <SheetTitle className="text-left">
            <BrandLogo height={20} />
          </SheetTitle>
        </SheetHeader>

        <div className="p-4">
          <p className="px-2 pb-2 text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">
            {heading}
          </p>
          <ul className="space-y-0.5">
            {platform.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.title}>
                  <Link
                    href={item.href}
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
