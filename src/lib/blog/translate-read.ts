/**
 * The AI translation's answer, read and checked (lib/blog/translate.ts).
 * Plain functions, no imports: tested on their own.
 */

export type TranslatableFields = {
  title: string;
  seoTitle: string;
  description: string;
  shortAnswer: string;
  breadcrumbLabel: string;
  primaryKeyword: string;
  secondaryKeywords: string[];
  bodyHtml: string;
  faqs: { question: string; answer: string }[];
};

export type TranslatedPost = TranslatableFields & { slug: string };

const text = (value: unknown, max: number) => (typeof value === "string" ? value.trim().slice(0, max) : "");

/**
 * The model's answer as fields, checked: a missing title or body is a
 * failure, never an empty draft, and an empty original field stays empty.
 */
export function readTranslation(input: unknown, original: TranslatableFields): TranslatedPost {
  const raw = (input ?? {}) as Record<string, unknown>;
  const title = text(raw.title, 200);
  const bodyHtml = typeof raw.bodyHtml === "string" ? raw.bodyHtml : "";
  if (!title || !bodyHtml.trim()) throw new Error("The translation came back without a title or text");
  const keep = (key: keyof TranslatableFields, max: number) => (original[key] ? text(raw[key], max) : "");
  const faqs = Array.isArray(raw.faqs)
    ? raw.faqs
        .map((faq) => ({ question: text((faq as Record<string, unknown>)?.question, 300), answer: text((faq as Record<string, unknown>)?.answer, 20_000) }))
        .filter((faq) => faq.question && faq.answer)
    : [];
  return {
    title,
    slug: text(raw.slug, 100),
    seoTitle: keep("seoTitle", 200),
    description: text(raw.description, 300),
    shortAnswer: keep("shortAnswer", 1000),
    breadcrumbLabel: keep("breadcrumbLabel", 200),
    primaryKeyword: keep("primaryKeyword", 200),
    secondaryKeywords: Array.isArray(raw.secondaryKeywords)
      ? raw.secondaryKeywords.map((keyword) => text(keyword, 200)).filter(Boolean)
      : [],
    bodyHtml,
    faqs,
  };
}
