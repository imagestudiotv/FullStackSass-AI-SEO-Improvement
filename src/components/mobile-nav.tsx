"use client";

import { Menu } from "lucide-react";
import { useState } from "react";

import { BrandLogo } from "@/components/brand-logo";
import { WebsiteSwitcher, type SwitcherWebsite } from "@/components/dashboard/website-switcher";
import { SidebarNav, type SidebarAddon } from "@/components/sidebar-nav";
import type { Messages } from "@/lib/i18n/messages";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

export function MobileNav({
  onboardingComplete = false,
  setupProgress = null,
  selectedWebsiteId = null,
  addons = [],
  hideAddons = false,
  hideCredits = false,
  websites = [],
  currentWebsite,
  switcherText,
  closeLabel,
  t,
}: {
  onboardingComplete?: boolean;
  websites?: SwitcherWebsite[];
  currentWebsite?: SwitcherWebsite | null;
  switcherText?: Messages["app"]["dash"];
  closeLabel?: string;
  /**
   * Forwarded to SidebarNav, so a phone hides Add-ons in the same cases the
   * desktop sidebar does - otherwise an invitee could buy from the phone menu
   * what the desktop never offered them.
   */
  hideAddons?: boolean;
  /** Forwarded to SidebarNav, like hideAddons. */
  hideCredits?: boolean;
  /** Forwarded to SidebarNav: the phone menu shows the same labels. */
  t: Messages["app"]["nav"];
  /** Forwarded to SidebarNav, so the phone menu shows the same progress. */
  setupProgress?: { done: number; total: number } | null;
  /** Forwarded to SidebarNav, so a phone gets the same Add-ons menu. */
  addons?: SidebarAddon[];
  /**
   * Forwarded to SidebarNav. Without it the per-website items are hidden on
   * every page that does not name a site in its URL, so a phone showed a
   * two-item menu on the dashboard.
   */
  selectedWebsiteId?: string | null;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          aria-label={t.main}
        >
          <Menu className="size-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-80 overflow-y-auto overscroll-contain p-0" closeLabel={closeLabel}>
        <SheetHeader className="border-b p-4">
          <SheetTitle className="text-left">
            <span aria-hidden="true"><BrandLogo height={20} /></span>
            <span className="sr-only">{t.main}</span>
          </SheetTitle>
        </SheetHeader>
        {currentWebsite ? (
          <div className="border-b p-3">
            <WebsiteSwitcher websites={websites} current={currentWebsite} t={switcherText} inMenu onNavigate={() => setOpen(false)} />
          </div>
        ) : null}
        <SidebarNav
          onNavigate={() => setOpen(false)}
          onboardingComplete={onboardingComplete}
          setupProgress={setupProgress}
          selectedWebsiteId={selectedWebsiteId}
          addons={addons}
          hideAddons={hideAddons}
          hideCredits={hideCredits}
          t={t}
        />
      </SheetContent>
    </Sheet>
  );
}
