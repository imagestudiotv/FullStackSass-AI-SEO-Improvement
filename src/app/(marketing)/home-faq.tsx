import { Plus } from "lucide-react";
import Link from "next/link";

import type { Messages } from "@/lib/i18n/messages";
import { OFFSCREEN, SectionHeading } from "./home-sections";

/**
 * The FAQ on the homepage: an introduction column and the questions beside
 * it, stacking on a phone.
 *
 * The questions are the FAQ page's own list (`faq.items`), so the two cannot
 * disagree - but not its component: FaqContent carries the page's h1, and a
 * second h1 on the homepage would compete with the headline. Here the title
 * is an h2.
 *
 * Native <details>/<summary>: keyboard, screen readers and find-in-page work
 * without any JavaScript, and an answer is in the HTML for crawlers whether
 * or not it is open.
 *
 * NO FAQPage structured data here. /faq already publishes it for these same
 * questions; the same FAQPage on two URLs is duplicate markup, and the FAQ
 * page is where it belongs.
 */
export function HomeFaq({
  t,
  faq,
  href,
}: {
  t: Messages["home"];
  faq: Messages["faq"];
  /** Locale-aware paths, as every homepage section takes. */
  href: (path: string) => string;
}) {
  if (faq.items.length === 0) return null;

  return (
    <section id="faq" className={`${OFFSCREEN} scroll-mt-20 border-t px-4 py-20`}>
      <div className="mx-auto grid grid-cols-1 max-w-6xl gap-10 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:gap-16">
        <div>
          <SectionHeading eyebrow={t.faqEyebrow} title={faq.title} sub={faq.subtitle} />
          <p className="mt-6 text-sm text-muted-foreground">
            {t.faqMore}{" "}
            <Link href={href("/contact")} className="font-medium text-foreground underline underline-offset-4 hover:text-primary">
              {t.faqContact}
            </Link>
          </p>
        </div>

        <div className="divide-y rounded-2xl border bg-card px-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] sm:px-6">
          {faq.items.map((item) => (
            <details key={item.question} className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-md py-4 font-medium focus-visible:ring-3 focus-visible:ring-primary/40 focus-visible:outline-none [&::-webkit-details-marker]:hidden">
                {item.question}
                <span
                  aria-hidden="true"
                  className="flex size-7 shrink-0 items-center justify-center rounded-full border text-muted-foreground transition-colors group-open:border-primary/30 group-open:bg-primary/10 group-open:text-primary"
                >
                  <Plus className="size-4 motion-safe:transition-transform group-open:rotate-45" />
                </span>
              </summary>
              <p className="pb-5 text-sm leading-relaxed text-muted-foreground">{item.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
