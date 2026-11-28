import { ArrowRight, ArrowUpRight, Sparkles } from "lucide-react";
import Link from "next/link";

import { FeatureLoop } from "@/components/marketing/feature-loop";
import { Button } from "@/components/ui/button";
import { localePath, type Locale } from "@/lib/i18n/config";
import { featuresPageCopy, type FeaturesPageCopy } from "@/lib/i18n/features-page";
import {
  featureClip,
  PRODUCT_TOOL_COUNT,
  PRODUCT_TOOLS,
  TOOL_ANCHORS,
  TOOL_FEATURES,
  TOOL_LINKS,
  type ProductTool,
} from "@/lib/marketing/product-tools";

/**
 * /features - everything RepGet does (client, 2026-11-27, with
 * heycatch.ai/features as the reference for its structure, in RepGet's own
 * look): the headline, the "Top features" index of the five tools, then each
 * tool with its features - title, a few sentences and the dashboard recording
 * - and a link to the page that says more, then Growth Copilot, which runs
 * them all, what is coming soon, and the closing call.
 *
 * The tools, their order and their recordings are lib/marketing/product-tools.ts,
 * the words lib/i18n/features-page.ts. Server-rendered and static; only the
 * recordings are client components, and each loads when it is reached
 * (components/marketing/feature-loop.tsx).
 */

const CTA = "h-12 rounded-full px-7 text-base";

/** The recordings' box: the full column on phones, about half the page beside the words. */
const CLIP_SIZES = "(min-width: 1024px) 36rem, 100vw";

export function FeaturesPageContent({ locale = "en" }: { locale?: Locale }) {
  const t = featuresPageCopy(locale);
  const href = (path: string) => localePath(locale, path);

  return (
    <>
      <section className="px-4 pt-16 pb-12 text-center sm:pt-24">
        <div className="mx-auto max-w-3xl">
          <p className="text-xs font-semibold tracking-[0.14em] text-primary uppercase">{t.eyebrow}</p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-balance sm:text-5xl">{t.title}</h1>
          <p className="mx-auto mt-5 max-w-2xl text-pretty text-muted-foreground sm:text-lg">{t.intro}</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button size="lg" asChild className={CTA}>
              <Link href="/sign-up">
                {t.primaryCta}
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild className={CTA}>
              <Link href={href("/pricing")}>{t.secondaryCta}</Link>
            </Button>
          </div>
        </div>
      </section>

      <nav aria-labelledby="features-index" className="border-t px-4 py-12 sm:py-16">
        <div className="mx-auto max-w-6xl">
          <h2 id="features-index" className="text-center text-2xl font-semibold tracking-tight sm:text-3xl">
            {t.indexTitle}
          </h2>
          <ol className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {PRODUCT_TOOLS.map((tool, index) => (
              <li key={tool}>
                <a
                  href={`#${TOOL_ANCHORS[tool]}`}
                  className="flex h-full flex-col rounded-2xl border bg-card p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-colors hover:border-primary/40 focus-visible:ring-3 focus-visible:ring-primary/40 focus-visible:outline-none"
                >
                  <span className="text-xs font-semibold text-primary tabular-nums">{String(index + 1).padStart(2, "0")}</span>
                  <span className="mt-2 font-semibold">{t.tools[tool].name}</span>
                  <span className="mt-1 text-sm leading-snug text-muted-foreground">{t.tools[tool].tagline}</span>
                </a>
              </li>
            ))}
          </ol>
          <p className="mt-4 text-center text-sm">
            <a href={`#${TOOL_ANCHORS.copilot}`} className="inline-flex items-center gap-1.5 font-medium text-primary underline-offset-4 hover:underline">
              <Sparkles className="size-4" aria-hidden="true" />
              {t.copilot.name}: {t.copilot.tagline}
            </a>
          </p>
        </div>
      </nav>

      {PRODUCT_TOOLS.map((tool, index) => (
        <ToolSection
          key={tool}
          t={t}
          tool={tool}
          kicker={t.toolNumber.replace("{n}", String(index + 1)).replace("{count}", String(PRODUCT_TOOL_COUNT))}
          href={href}
          tinted={index % 2 === 0}
        />
      ))}
      <ToolSection t={t} tool="copilot" kicker={t.copilot.badge} href={href} tinted={PRODUCT_TOOL_COUNT % 2 === 0} />

      <section aria-labelledby="features-soon" className="border-t px-4 py-16 sm:py-20">
        <div className="mx-auto max-w-3xl text-center">
          <h2 id="features-soon" className="text-3xl font-semibold tracking-tight sm:text-4xl">
            {t.comingSoonTitle}
          </h2>
          <p className="mt-3 text-muted-foreground">{t.comingSoonIntro}</p>
          <ul className="mt-8 flex flex-wrap justify-center gap-3">
            {t.comingSoon.map((item) => (
              <li key={item} className="rounded-full border border-dashed px-4 py-2 text-sm">
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="border-t px-4 py-16 text-center sm:py-20">
        <div className="mx-auto max-w-2xl">
          <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">{t.closingTitle}</h2>
          <p className="mt-4 text-muted-foreground sm:text-lg">{t.closingBody}</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button size="lg" asChild className={CTA}>
              <Link href="/sign-up">
                {t.primaryCta}
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild className={CTA}>
              <Link href={href("/pricing")}>{t.secondaryCta}</Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}

/** One tool (or Growth Copilot): its head, then each feature beside its recording, sides alternating. */
function ToolSection({
  t,
  tool,
  kicker,
  href,
  tinted,
}: {
  t: FeaturesPageCopy;
  tool: ProductTool | "copilot";
  kicker: string;
  href: (path: string) => string;
  tinted: boolean;
}) {
  const words = tool === "copilot" ? t.copilot : t.tools[tool];
  const headingId = `features-${TOOL_ANCHORS[tool]}-title`;

  return (
    <section
      id={TOOL_ANCHORS[tool]}
      aria-labelledby={headingId}
      className={`scroll-mt-24 border-t px-4 py-16 sm:py-20 ${tinted ? "bg-muted/30" : ""}`}
    >
      <div className="mx-auto max-w-6xl">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold tracking-[0.14em] text-primary uppercase">{kicker}</p>
          <h2 id={headingId} className="mt-3 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            {words.name}
          </h2>
          <p className="mt-2 text-lg font-medium">{words.tagline}</p>
          <p className="mt-3 text-pretty text-muted-foreground">{words.intro}</p>
          <p className="mt-4">
            <Link href={href(TOOL_LINKS[tool])} className="inline-flex items-center gap-1 font-medium text-primary underline-offset-4 hover:underline">
              {words.link}
              <ArrowUpRight className="size-4" aria-hidden="true" />
            </Link>
          </p>
        </div>

        <ul className="mt-10 space-y-10 lg:space-y-14">
          {TOOL_FEATURES[tool].map((key, index) => {
            const feature = t.features[key];
            const clip = featureClip(key);
            return (
              <li key={key} className="grid grid-cols-1 items-center gap-6 lg:grid-cols-2 lg:gap-12">
                <div className={index % 2 === 1 ? "lg:order-2" : ""}>
                  <h3 className="text-xl font-semibold tracking-tight">{feature.title}</h3>
                  <p className="mt-2 leading-relaxed text-muted-foreground">{feature.body}</p>
                </div>
                <FeatureLoop
                  mp4={clip.mp4}
                  poster={clip.poster}
                  label={t.clipLabel.replace("{feature}", feature.title)}
                  sizes={CLIP_SIZES}
                  className="rounded-2xl border bg-card shadow-[0_8px_30px_rgba(0,0,0,0.06)]"
                />
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
