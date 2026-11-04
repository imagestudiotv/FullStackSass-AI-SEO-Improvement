import type { PlanRow } from "@/lib/billing-shared";
import type { Locale } from "@/lib/i18n/config";
import type { Testimonial } from "@/lib/marketing/testimonials";
import styles from "./_home/home.module.css";
import { RevealRoot } from "./_home/reveal";
import { Copilot } from "./_home/sections/copilot";
import { Engines } from "./_home/sections/engines";
import { Faq } from "./_home/sections/faq";
import { Features } from "./_home/sections/features";
import { FinalCta } from "./_home/sections/final-cta";
import { Founder } from "./_home/sections/founder";
import { Hero } from "./_home/sections/hero";
import { Pricing } from "./_home/sections/pricing";
import { Reviews } from "./_home/sections/reviews";
import { Ribbon } from "./_home/sections/ribbon";
import { Steps } from "./_home/sections/steps";
import { VideoSection } from "./_home/sections/video";
import type { SectionProps } from "./_home/types";

/**
 * The homepage's sections, in order - ONE list for every language.
 *
 * The English page and the localised ones render this same composition, so a
 * section moved here moves in every language.
 *
 * The order and the look are the client's approved design (2026-11-04,
 * RepGet_Full_Homepage_Back_To_Top.html): the promise and the free start, the
 * platforms with a real count of what RepGet has made, the top features, the
 * four growth engines, the walkthrough video, the three steps to start,
 * Growth Copilot, the founder, what customers say (only when there are
 * published reviews), pricing, questions, and the closing call.
 *
 * The header (with its new Features and Integrations menus), the footer and
 * the live chat come from the marketing layout, as on every public page.
 */
export function HomePageSections({
  locale,
  href,
  testimonials,
  contentCount,
  plans,
}: {
  locale: Locale;
  /** Builds locale-aware paths: unchanged on English, prefixed elsewhere. */
  href: (path: string) => string;
  /**
   * The PUBLISHED testimonials from Admin -> Testimonials
   * (lib/marketing/testimonials-db.ts): the hero's reviewer avatars and the
   * reviews section. None published means neither is shown.
   */
  testimonials: Testimonial[];
  /** Articles, posts and videos really made (lib/marketing/content-count.ts); null hides the counter. */
  contentCount: number | null;
  /** The plans on sale (lib/billing.ts), which the pricing section shows. */
  plans: PlanRow[];
}) {
  const props: SectionProps = { locale, href };

  return (
    <div className={styles.page}>
      <RevealRoot />
      <Hero {...props} testimonials={testimonials} />
      <Ribbon {...props} contentCount={contentCount} />
      <Features {...props} />
      <Engines {...props} />
      <VideoSection {...props} />
      <Steps {...props} />
      <Copilot {...props} />
      <Founder {...props} />
      <Reviews {...props} testimonials={testimonials} />
      <Pricing {...props} plans={plans} />
      <Faq {...props} />
      <FinalCta {...props} />
    </div>
  );
}
