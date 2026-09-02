import { ArrowRight, Check } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";
import { isLocale, localePath, LOCALES } from "@/lib/i18n/config";
import { getMessages } from "@/lib/i18n/messages";

/**
 * Localised homepage.
 *
 * The English homepage stays where it is; this serves /es, /fr, /it and /de
 * from the same structure with translated copy.
 *
 * hreflang tags tell search engines these are the same page in different
 * languages rather than duplicates competing with each other — without them,
 * five translations of one page are five near-duplicate results.
 */
export async function generateMetadata({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  if (!isLocale(locale)) return {};

  const t = getMessages(locale);

  return {
    title: t.home.title,
    description: t.home.subtitle,
    alternates: {
      canonical: localePath(locale, "/"),
      languages: Object.fromEntries(
        LOCALES.map((l) => [l, localePath(l, "/")]),
      ),
    },
  };
}

export default async function LocalisedHomePage({
  params,
}: PageProps<"/[locale]">) {
  const { locale } = await params;
  if (!isLocale(locale) || locale === "en") notFound();

  const t = getMessages(locale);

  return (
    <div className="mx-auto max-w-3xl px-4 py-20 sm:py-28">
      <section className="text-center">
        <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
          {t.home.title}
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-lg text-pretty text-muted-foreground">
          {t.home.subtitle}
        </p>

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button size="lg" asChild>
            <Link href={localePath(locale, "/audit")}>
              {t.home.checkFree}
              <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            {/* Sign-up is not localised, so it keeps its own path. */}
            <Link href="/sign-up">{t.home.getStarted}</Link>
          </Button>
        </div>
      </section>

      <section id="how-it-works" className="mt-16 scroll-mt-20 border-t pt-10">
        <h2 className="text-center text-2xl font-semibold tracking-tight">
          {t.home.howItWorks}
        </h2>
        <p className="mx-auto mt-3 max-w-md text-center text-muted-foreground">
          {t.home.howItWorksSub}
        </p>
        <ul className="mx-auto mt-8 grid max-w-lg gap-3 text-left">
          {t.home.included.map((item) => (
            <li key={item} className="flex items-start gap-3">
              <span
                className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10"
                aria-hidden="true"
              >
                <Check className="size-3 text-primary" />
              </span>
              <span className="text-sm text-muted-foreground">{item}</span>
            </li>
          ))}
        </ul>
      </section>

      <section id="pricing" className="mt-16 scroll-mt-20 border-t pt-10">
        <h2 className="text-center text-2xl font-semibold tracking-tight">
          {t.home.pricingTitle}
        </h2>
        <p className="mx-auto mt-3 max-w-md text-center text-muted-foreground">
          {t.home.pricingSub}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button asChild>
            <Link href={localePath(locale, "/pricing")}>
              {t.home.seePlans}
              <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/refunds#guarantee">{t.home.guarantee}</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
