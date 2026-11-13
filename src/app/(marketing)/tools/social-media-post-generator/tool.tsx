import { Check } from "lucide-react";
import Link from "next/link";

import { SocialPostGenerator } from "@/components/social-post-generator/social-post-generator";
import { MoreTools, ToolBreadcrumb, ToolExplainer } from "@/components/tool-page";
import type { Locale } from "@/lib/i18n/config";
import { socialPostGeneratorCopy } from "@/lib/i18n/social-post-generator";
import { TOOLS_COMMON } from "@/lib/tools/i18n/common";
import { toolMetadata } from "@/lib/tools/i18n/meta";

const HREF = "/tools/social-media-post-generator";

/**
 * Where "Sign up" and "Sign in" lead: the sign-up flow, then the signed-in
 * app's Social Distribution section (app/(app)/social), where more posts
 * follow the account's own plan. Sign-up and sign-in are English-only pages,
 * like the header's links to them.
 */
const NEXT = encodeURIComponent("/social");
const SIGN_UP_HREF = `/sign-up?next=${NEXT}`;
const SIGN_IN_HREF = `/sign-in?next=${NEXT}`;

export function socialPostGeneratorMetadata(locale: Locale) {
  return toolMetadata(HREF, locale, socialPostGeneratorCopy(locale).metaDescription);
}

/**
 * The free AI Social Media Post Generator (client, 2026-11-13,
 * repget-free-ai-social-media-post-generator.html) in any of the five
 * languages: the design's hero, its two-card workspace (the form and the
 * results, components/social-post-generator) and its closing invitation, on
 * the free tools' page furniture. Prerendered: nothing here reads the request;
 * the browser asks the server what is left (lib/tools/social-posts-actions.ts).
 */
export function SocialPostGeneratorTool({ locale }: { locale: Locale }) {
  const copy = socialPostGeneratorCopy(locale);
  const title = TOOLS_COMMON[locale].tools[HREF].title;

  return (
    <div>
      <div className="bg-primary/[0.04]">
        <div className="mx-auto max-w-6xl px-4 pt-8 pb-12 sm:pb-16">
          <ToolBreadcrumb title={title} locale={locale} />
          <div className="mx-auto mt-10 max-w-3xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-background px-3 py-1 text-[11px] font-semibold tracking-[0.1em] text-primary uppercase">
              <span className="size-1.5 rounded-full bg-primary" aria-hidden="true" />
              {copy.eyebrow}
            </span>
            <h1 className="mt-5 text-4xl font-semibold tracking-tight text-balance sm:text-5xl">{title}</h1>
            <p className="mx-auto mt-4 max-w-xl text-pretty text-muted-foreground">{copy.description}</p>
            <ul className="mt-5 flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm font-medium text-muted-foreground">
              {copy.benefits.map((benefit) => (
                <li key={benefit} className="flex items-center gap-1.5">
                  <Check className="size-4 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                  {benefit}
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-10">
            <SocialPostGenerator copy={copy} locale={locale} signUpHref={SIGN_UP_HREF} signInHref={SIGN_IN_HREF} />
          </div>

          <section className="mt-8 flex flex-col items-start justify-between gap-5 rounded-2xl bg-foreground px-6 py-6 text-background sm:flex-row sm:items-center sm:px-8">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">{copy.cta.title}</h2>
              <p className="mt-1 text-sm opacity-80">{copy.cta.text}</p>
            </div>
            <Link
              prefetch={false}
              href={SIGN_UP_HREF}
              className="inline-flex h-10 shrink-0 items-center rounded-lg bg-background px-4 text-sm font-semibold text-foreground transition-opacity hover:opacity-90"
            >
              {copy.cta.button} <span aria-hidden="true">&nbsp;↗</span>
            </Link>
          </section>
        </div>
      </div>

      <ToolExplainer columns={copy.explainer} />
      <MoreTools currentHref={HREF} locale={locale} />
    </div>
  );
}
