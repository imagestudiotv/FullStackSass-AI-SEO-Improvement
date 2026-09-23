"use client";

import { Menu } from "lucide-react";
import { useState } from "react";

import { BrandLogo } from "@/components/brand-logo";
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
  t,
}: {
  onboardingComplete?: boolean;
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
      <SheetContent side="left" className="w-64 p-0" closeLabel={t.main}>
        <SheetHeader className="border-b p-4">
          <SheetTitle className="text-left">
            <BrandLogo height={20} />
          </SheetTitle>
        </SheetHeader>
        <SidebarNav
          onNavigate={() => setOpen(false)}
          onboardingComplete={onboardingComplete}
          setupProgress={setupProgress}
          selectedWebsiteId={selectedWebsiteId}
          addons={addons}
          t={t}
        />
      </SheetContent>
    </Sheet>
  );
}
