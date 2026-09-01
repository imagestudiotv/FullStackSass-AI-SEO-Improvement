export const metadata = {
  title: "FAQ",
  description: "Common questions about how AI SEO Platform works.",
};

/**
 * FAQ.
 *
 * Answers are honest about limits — no guaranteed rankings, results take
 * months, AI text needs reviewing. A prospect who signs up expecting overnight
 * results churns in week two and asks for a refund; setting the expectation
 * here costs a few signups and saves the ones that matter.
 */
const FAQS: { question: string; answer: string }[] = [
  {
    question: "Do I need to know anything about SEO?",
    answer:
      "No. That is the point of the service. We work out which searches your customers use, write the pages that answer them, and tell you in plain language what changed. You never need to learn what a canonical tag is.",
  },
  {
    question: "How long before I see results?",
    answer:
      "Usually two to four months before new pages start bringing visitors, and longer in competitive industries. Anyone promising results in weeks is not being straight with you. Search engines take time to find, trust and rank new pages.",
  },
  {
    question: "Do you guarantee I will rank first on Google?",
    answer:
      "No, and neither can anyone else. Google decides what to rank and changes how it works constantly. What we do is find the searches you can realistically win, write the pages properly, and show you honestly what happened.",
  },
  {
    question: "Will the articles sound like a robot wrote them?",
    answer:
      "They are written by AI, so you should read them before they go live — we give you an editor for exactly that. They are written for your business, in your language and market, and you can set the tone you want.",
  },
  {
    question: "Do the articles go on my website automatically?",
    answer:
      "Only if you connect your website and choose to publish. We support WordPress, Ghost and Shopify, plus a webhook for anything else. Otherwise they stay as drafts for you to review, edit, or copy elsewhere.",
  },
  {
    question: "What are link credits?",
    answer:
      "Google trusts a website more when other sites link to it. When one of your articles mentions another member's business, you earn a credit. Spend a credit and a different member's article links to you. You never link to whoever linked to you, so the links look natural.",
  },
  {
    question: "Why do you suggest smaller search terms?",
    answer:
      "Because you can win them. A term searched 12,000 times a month that you have no chance of ranking for is worth less than one searched 300 times that brings you customers next month.",
  },
  {
    question: "Can I cancel any time?",
    answer:
      "Yes, from the billing page, with no cancellation fee. Your access continues until the end of the period you have paid for.",
  },
  {
    question: "What happens to my articles if I leave?",
    answer:
      "Anything already published stays on your website — it is your content. You own the articles we write for you.",
  },
];

export default function FaqPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">
        Frequently asked questions
      </h1>

      <dl className="mt-10 divide-y">
        {FAQS.map((item) => (
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
