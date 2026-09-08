import { FaqContent } from "../static-pages";
import { getMessages } from "@/lib/i18n/messages";

const t = getMessages("en");

export const metadata = {
  title: t.faq.metaTitle,
  description: t.faq.metaDescription,
};

/**
 * FAQ.
 *
 * Answers are honest about limits — no guaranteed rankings, results take
 * months, AI text needs reviewing. A prospect who signs up expecting overnight
 * results churns in week two and asks for a refund; setting the expectation
 * here costs a few signups and saves the ones that matter.
 */
export default function FaqPage() {
  return <FaqContent t={t} />;
}
