import Link from "next/link";

import {
  MarketingFooterLinks,
  MarketingNav,
  MarketingTagline,
} from "@/components/marketing-nav";
import { LiveChat } from "@/components/live-chat";

export default function MarketingLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-svh flex-col">
      <header className="border-b bg-background">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4">
          <Link
            href="/"
            className="flex items-center gap-2 font-semibold tracking-tight"
          >
            <span className="flex size-6 items-center justify-center rounded-md bg-primary text-[11px] font-bold text-primary-foreground">
              AI
            </span>
            SEO Platform
          </Link>
          <MarketingNav />
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t bg-background">
        <div className="mx-auto max-w-6xl px-4 py-10">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex items-center gap-2 font-semibold tracking-tight">
                <span className="flex size-6 items-center justify-center rounded-md bg-primary text-[11px] font-bold text-primary-foreground">
                  AI
                </span>
                SEO Platform
              </div>
              <MarketingTagline />
            </div>
            <MarketingFooterLinks />
          </div>

          <p className="mt-10 border-t pt-6 text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} AI SEO Platform
          </p>
        </div>
      </footer>

      {/*
        Marketing pages only. Loading chat inside the signed-in app would send
        a third party the pages where customers' own data is displayed, for no
        benefit — someone already signed in has support routes that identify
        them properly.
      */}
      <LiveChat />
    </div>
  );
}
