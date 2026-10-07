"use client";

import { ArrowRight, Compass } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

import { lastShownPath } from "@/components/previous-page";
import { Button } from "@/components/ui/button";
import { localePath, splitLocale } from "@/lib/i18n/config";
import type { NotFoundCopy } from "@/lib/i18n/site-chrome";

/**
 * The public site's "page not found" (client's launch review, 2026-10-03).
 *
 * A client component for the same reason as the marketing nav: only the
 * address says which language the visitor was reading, and a server
 * not-found file is not told the address. /es/anything gets Spanish. The
 * words come from the server as a prop, in every language, so the browser
 * does not load all of messages.ts (lib/i18n/site-chrome.ts).
 *
 * It also reports the miss once, for the server log (lib/not-found-log.ts):
 * which address, and which page linked to it.
 */

/** The last path reported, so a re-render does not report it twice. */
let reported = "";

function reportMiss(path: string) {
  if (reported === path) return;
  reported = path;
  try {
    // Reached by a link inside the site: the page it was on. Otherwise whatever opened the tab.
    const previous = lastShownPath();
    const referrer = previous && previous !== path ? `${window.location.origin}${previous}` : document.referrer;
    const body = JSON.stringify({ path, referrer });
    // sendBeacon survives the visitor leaving at once; fetch is the fallback.
    if (!navigator.sendBeacon?.("/api/not-found", new Blob([body], { type: "application/json" }))) {
      void fetch("/api/not-found", { method: "POST", body, keepalive: true, headers: { "content-type": "application/json" } }).catch(() => {});
    }
  } catch {
    // Reporting is best effort; the page itself is what matters.
  }
}

export function NotFoundPanel({ copy }: { copy: NotFoundCopy }) {
  const pathname = usePathname() ?? "/";
  const { locale } = splitLocale(pathname);
  const t = copy[locale];

  useEffect(() => {
    reportMiss(window.location.pathname);
  }, [pathname]);

  /*
    The tab's title. The server sends "Page not found | RepGet" with the 404,
    but the browser's render of the page then puts back the site's default
    title, so it is set here - in the visitor's language.
  */
  useEffect(() => {
    document.title = `${t.notFound.metaTitle} | RepGet`;
  }, [t.notFound.metaTitle]);

  /*
    Places most visitors were probably looking for. The blog and the tools
    are English-only, so they are linked as they are; the rest follow the
    visitor's language.
  */
  const elsewhere = [
    { href: localePath(locale, "/pricing"), label: t.nav.pricing },
    { href: "/blog", label: t.nav.blog },
    { href: "/tools", label: t.footer.freeTools },
    { href: localePath(locale, "/contact"), label: t.nav.contact },
  ];

  return (
    <section className="mx-auto flex max-w-2xl flex-col items-center px-4 py-20 text-center sm:py-28">
      <div className="flex size-12 items-center justify-center rounded-full bg-muted">
        <Compass className="size-6 text-muted-foreground" aria-hidden="true" />
      </div>
      <p className="mt-6 text-sm font-medium text-primary">{t.notFound.eyebrow}</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">{t.notFound.title}</h1>
      <p className="mt-4 max-w-md text-muted-foreground text-pretty">{t.notFound.body}</p>

      <Button asChild size="lg" className="mt-8">
        <Link href={localePath(locale, "/")}>
          {t.notFound.home}
          <ArrowRight aria-hidden="true" />
        </Link>
      </Button>

      <nav aria-label={t.notFound.elsewhere} className="mt-10 w-full border-t pt-6">
        <p className="text-sm text-muted-foreground">{t.notFound.elsewhere}</p>
        <ul className="mt-3 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm font-medium">
          {elsewhere.map((link) => (
            <li key={link.href}>
              <Link href={link.href} className="underline-offset-4 hover:text-primary hover:underline">
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </section>
  );
}
