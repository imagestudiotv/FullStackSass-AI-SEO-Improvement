import { Mail } from "lucide-react";

import type { Messages } from "@/lib/i18n/messages";

/**
 * About, FAQ and Contact, rendered from the dictionary.
 *
 * Shared by the English routes and the localised ones, the way the homepage
 * already works. The alternative — a copy of each page per language — is how
 * the localised homepage started out, and it drifted: the English page grew to
 * nine sections while the translations still had one, so switching language
 * visibly downgraded the site. Taking the copy from `Messages` makes that
 * impossible.
 */

export function AboutContent({ t }: { t: Messages }) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">{t.about.title}</h1>

      <div className="mt-8 space-y-6 text-sm leading-relaxed text-muted-foreground">
        {t.about.intro.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}

        <h2 className="pt-4 text-base font-semibold text-foreground">
          {t.about.beliefTitle}
        </h2>
        <p>
          {/*
            The lead sits inside the first paragraph rather than as its own
            heading: it is the sentence the paragraph explains, and splitting
            them made the page read as a list of slogans.
          */}
          <strong className="text-foreground">{t.about.beliefLead}</strong>{" "}
          {t.about.belief[0]}
        </p>
        {t.about.belief.slice(1).map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}

        <h2 className="pt-4 text-base font-semibold text-foreground">
          {t.about.audienceTitle}
        </h2>
        <p>{t.about.audience}</p>
      </div>
    </div>
  );
}

export function FaqContent({ t }: { t: Messages }) {
  /**
   * FAQPage structured data, built from the same items the page renders — so
   * the markup can never describe questions the page does not show, and every
   * locale gets it without a second copy of the content.
   *
   * Guarded on a non-empty list: an FAQPage with no mainEntity is a structured
   * data error rather than a missed opportunity.
   */
  const faqSchema =
    t.faq.items.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: t.faq.items.map((item) => ({
            "@type": "Question",
            name: item.question,
            acceptedAnswer: { "@type": "Answer", text: item.answer },
          })),
        }
      : null;

  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      {faqSchema ? (
        <script
          type="application/ld+json"
          // Serialised from our own translation files, never user input.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
        />
      ) : null}
      <h1 className="text-3xl font-semibold tracking-tight">{t.faq.title}</h1>
      <p className="mt-3 text-muted-foreground">{t.faq.subtitle}</p>

      <dl className="mt-10 divide-y">
        {t.faq.items.map((item) => (
          <div key={item.question} className="py-6 first:pt-0">
            <dt className="font-medium">{item.question}</dt>
            <dd className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {item.answer}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function ContactContent({
  t,
  supportEmail,
  /** Prefilled subject, when billing sent someone here for a quote. */
  subject,
  title,
  subtitle,
}: {
  t: Messages;
  supportEmail: string;
  subject?: string;
  title?: string;
  subtitle?: string;
}) {
  const href = subject
    ? `mailto:${supportEmail}?subject=${encodeURIComponent(subject)}`
    : `mailto:${supportEmail}`;

  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">
        {title ?? t.contact.title}
      </h1>
      <p className="mt-3 text-muted-foreground">
        {subtitle ?? t.contact.subtitle}
      </p>

      <div className="mt-8 rounded-lg border bg-background p-6">
        <div className="flex items-start gap-4">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted">
            <Mail className="size-5 text-muted-foreground" aria-hidden="true" />
          </div>
          <div>
            <p className="font-medium">{t.contact.emailLabel}</p>
            <a
              href={href}
              className="text-sm text-muted-foreground underline underline-offset-4"
            >
              {supportEmail}
            </a>
            <p className="mt-2 text-sm text-muted-foreground">
              {t.contact.accountNote}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
