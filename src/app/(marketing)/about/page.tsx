export const metadata = {
  title: "About",
  description: "Why AI SEO Platform exists and who it is for.",
};

/**
 * About page.
 *
 * States the product's actual principle rather than generic startup copy. The
 * scoring rule described here is real — it is how the keyword ranking works —
 * so a prospect who reads this and then uses the product sees the same idea.
 */
export default function AboutPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">
        SEO results without the agency
      </h1>

      <div className="mt-8 space-y-6 text-sm leading-relaxed text-muted-foreground">
        <p>
          A dentist, a plumber or a small law firm knows they should &quot;do
          SEO&quot;. What that actually needs is a keyword researcher, a writer,
          someone who understands technical audits, and outreach for links. An
          agency bundles all of that for a few thousand a month.
        </p>
        <p>
          Most small businesses cannot justify that, so they do nothing — and
          stay invisible on exactly the searches that would bring them
          customers.
        </p>
        <p>
          We built this to do that work automatically, for a price a small
          business can actually pay.
        </p>

        <h2 className="pt-4 text-base font-semibold text-foreground">
          What we believe
        </h2>
        <p>
          <strong className="text-foreground">
            Only recommend what you can realistically win.
          </strong>{" "}
          A search term used 12,000 times a month is worthless to you if you
          have no chance of ranking for it. One used 300 times, by someone ready
          to buy, can bring you a customer next month.
        </p>
        <p>
          That principle is built into the product, not just written here. Our
          scoring deliberately ranks winnable terms above popular ones, and
          weighs whether the searcher actually intends to buy. Our link matching
          refuses to pair a dentist with an unrelated website, even when the
          numbers look good.
        </p>
        <p>
          A tool that produces impressive-looking work nobody will ever find is
          worse than useless. It takes money and delivers nothing.
        </p>

        <h2 className="pt-4 text-base font-semibold text-foreground">
          Who it is for
        </h2>
        <p>
          Small and local businesses who need customers, not dashboards. You
          should never have to learn what &quot;keyword difficulty&quot; means.
          We do the judgement; you see a plan, the articles, and what changed.
        </p>
      </div>
    </div>
  );
}
