import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function MarketingLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-svh flex-col">
      <header className="border-b">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4">
          <Link href="/" className="font-semibold tracking-tight">
            AI SEO Platform
          </Link>
          <nav className="ml-auto flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/sign-in">Sign in</Link>
            </Button>
            <Button size="sm" asChild>
              <Link href="/sign-up">Get started</Link>
            </Button>
          </nav>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-sm text-muted-foreground sm:flex-row sm:items-center">
          <p>&copy; {new Date().getFullYear()} AI SEO Platform</p>
          <p className="sm:ml-auto">Placeholder marketing site.</p>
        </div>
      </footer>
    </div>
  );
}
