import Link from "next/link";

import { Button } from "@/components/ui/button";
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
          {/* Only pages that exist. Every link here resolves. */}
          <nav className="ml-auto hidden items-center gap-1 sm:flex">
            {[
              { href: "/audit", label: "Free check" },
              { href: "/tools", label: "Tools" },
              { href: "/pricing", label: "Pricing" },
              { href: "/blog", label: "Blog" },
              { href: "/faq", label: "FAQ" },
              { href: "/about", label: "About" },
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
            <Button variant="ghost" size="sm" asChild>
              <Link href="/sign-in">Sign in</Link>
            </Button>
            <Button size="sm" asChild>
              <Link href="/sign-up">Get started</Link>
            </Button>
          </div>
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
              <p className="mt-2 max-w-xs text-sm text-muted-foreground">
                SEO results for small businesses, without the agency.
              </p>
            </div>

            <div className="flex gap-12 text-sm">
              <div className="space-y-2">
                <p className="font-medium text-foreground">Product</p>
                {[
                  { href: "/audit", label: "Free website check" },
                  { href: "/tools", label: "Free tools" },
                  { href: "/pricing", label: "Pricing" },
                  { href: "/blog", label: "Blog" },
                  { href: "/faq", label: "FAQ" },
                  { href: "/about", label: "About" },
                  { href: "/backlink-exchange", label: "Backlink exchange" },
                  { href: "/publishers", label: "Monetize your blog" },
                  { href: "/affiliate", label: "Refer a business" },
                  { href: "/contact", label: "Contact" },
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
                <p className="font-medium text-foreground">Legal</p>
                {[
                  { href: "/privacy", label: "Privacy" },
                  { href: "/terms", label: "Terms" },
                  { href: "/refunds", label: "Refunds" },
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
