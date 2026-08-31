/**
 * Blog content.
 *
 * Posts are TypeScript modules rather than markdown files or a CMS. For a
 * handful of marketing posts that is the right trade: no parser dependency, no
 * build step, no admin UI to secure, and a typo in a field is a compile error
 * instead of a broken page in production. If this ever grows past a few dozen
 * posts, or a non-developer needs to publish, that is the point to revisit it —
 * not before.
 *
 * The blog exists to be found. That means every post carries the fields search
 * engines and social previews actually read: a description, real dates, and a
 * canonical slug that never changes once published — changing a slug breaks
 * every link and discards whatever ranking the post has earned.
 */

export type BlogPost = {
  /** URL segment. Permanent once published. */
  slug: string;
  title: string;
  /** Meta description and card summary. Kept under ~160 characters. */
  description: string;
  /** ISO date. Drives ordering and the sitemap. */
  publishedAt: string;
  /** ISO date, when meaningfully revised. Search engines read this. */
  updatedAt?: string;
  /** Shown on the post. A real name, since a byline nobody owns reads as spam. */
  author: string;
  /** Rough read time in minutes. */
  readingMinutes: number;
  /**
   * Body as HTML. Written here by us, never user input, so it is rendered
   * directly — the usual injection concern does not apply to a constant in our
   * own source.
   */
  body: string;
};

/**
 * Posts, newest first is NOT assumed — order is derived from publishedAt so
 * adding one in the wrong place cannot silently mis-sort the index.
 */
const POSTS: BlogPost[] = [
  {
    slug: "why-your-website-isnt-on-google",
    title: "Why your website isn't showing up on Google",
    description:
      "The four reasons small business websites stay invisible on Google, and how to tell which one is yours.",
    publishedAt: "2026-08-12",
    author: "The SEO Platform team",
    readingMinutes: 6,
    body: `
<p>If you have a website and it brings you no enquiries, you are not doing anything unusual. Most small business websites are invisible on Google, and almost always for one of four reasons. They are worth knowing apart, because the fix for each is completely different.</p>

<h2>1. Google cannot read your pages properly</h2>
<p>Every page needs a title and a description. Not a heading you can see on the page — the title tag, which is what Google shows in the results list. A surprising number of sites have pages titled "Home" or "Untitled", or the same title repeated on every page.</p>
<p>This is the most common problem and the easiest to fix. If two pages share a title, Google has to guess which one to show, and it often shows neither.</p>

<h2>2. You are writing about the wrong things</h2>
<p>A dentist writes a page about "our practice". Nobody searches for that. They search for "emergency dentist near me" or "how much does a crown cost".</p>
<p>The gap between what a business wants to say and what its customers actually type is the single biggest reason good websites get no traffic. Writing more pages does not help if they are all on the wrong subject.</p>

<h2>3. Nobody links to you</h2>
<p>Google treats a link from another website as a vote. A new site with no links is a site nothing vouches for, so it starts near the bottom regardless of how good the content is.</p>
<p>This is the slowest problem to fix, and the one where most money gets wasted. Buying links is against Google's guidelines and can make things actively worse.</p>

<h2>4. You are being answered without being visited</h2>
<p>This one is new. People increasingly ask an AI assistant for a recommendation instead of searching, and the assistant names a handful of businesses. If you are not one of them, you never find out — there is no ranking to check and no traffic report showing what you missed.</p>

<h2>Which one is yours?</h2>
<p>Usually more than one, but rarely all four. The order matters: fixing your titles is worth doing before chasing links, because the first costs an afternoon and the second takes months.</p>
<p>If you want to know which applies to your site specifically, our <a href="/audit">free website check</a> reads your pages and tells you what it finds — no account needed.</p>
`.trim(),
  },
  {
    slug: "how-ai-assistants-recommend-businesses",
    title: "How AI assistants decide which businesses to recommend",
    description:
      "People increasingly ask ChatGPT instead of searching Google. Here is what actually determines whether your business gets named.",
    publishedAt: "2026-08-20",
    author: "The SEO Platform team",
    readingMinutes: 5,
    body: `
<p>Ask an assistant "who is the best plumber in Bristol" and you get three or four names. Ask about a product category and you get a shortlist. For a growing number of people, that shortlist has replaced the first page of Google entirely.</p>
<p>If your business is not on it, nothing tells you. There is no ranking to check, no impression count, no drop in a report. You are simply not mentioned, and you never learn it happened.</p>

<h2>Where the answer comes from</h2>
<p>An assistant is not looking up a directory. It is drawing on what it learned from a very large amount of text, and increasingly on web results it fetches while answering. In practice that means a business gets named when it is <em>written about</em> — consistently, across sources the model has seen.</p>
<p>That is a meaningful difference from classic SEO. You cannot buy a position, and there is no tag to add. What moves the needle is being described clearly and repeatedly in places that get indexed.</p>

<h2>What seems to matter</h2>
<ul>
<li><strong>Being described in plain terms.</strong> A page that says what you do, where, and for whom is easier for a model to associate with a question than one full of marketing language.</li>
<li><strong>Consistency.</strong> The same business name, the same location, the same services, wherever you appear. Contradictory details make a model less confident about naming you.</li>
<li><strong>Being mentioned elsewhere.</strong> Directories, local press, industry sites. Not for the link — for the description.</li>
<li><strong>Answering real questions.</strong> Content that addresses what customers ask tends to surface when those questions are asked.</li>
</ul>

<h2>What does not appear to matter</h2>
<p>Keyword density, meta keywords, and the various tricks that stopped working for Google years ago do nothing here either. Neither does volume for its own sake: fifty thin pages are not better than five good ones, and may be worse.</p>

<h2>The honest part</h2>
<p>This is a young field and anyone claiming a reliable method is ahead of the evidence. What can be done today is measure it: ask the assistant the questions your customers ask, and see whether you come up. That is the only way to know where you stand, and it is what our AI visibility tracking does — the same questions, asked repeatedly, so you can see the answer change.</p>
`.trim(),
  },
  {
    slug: "what-to-fix-first",
    title: "What to fix first on a website that gets no traffic",
    description:
      "A practical order of work for a site with no rankings, starting with what costs an afternoon rather than six months.",
    publishedAt: "2026-08-27",
    author: "The SEO Platform team",
    readingMinutes: 7,
    body: `
<p>Most SEO advice is a list of everything that could matter, which is useless when you have a limited amount of time. This is an order of work, cheapest and fastest first.</p>

<h2>First: titles and descriptions</h2>
<p>Every page needs its own title tag describing what that page is about, and its own meta description. If any two pages share either, fix that first.</p>
<p>This is an afternoon of work and it is the only change on this list that can produce a visible difference within a week.</p>

<h2>Second: make sure pages are actually reachable</h2>
<p>A page nothing links to is a page Google may never find. Every page should be reachable by clicking from your homepage in two or three steps. Orphan pages are common on sites that have grown over years.</p>

<h2>Third: find out what people actually search for</h2>
<p>Before writing anything new, find out what your customers type. The phrases are usually more specific and more practical than a business expects — less "quality dental care", more "does a filling hurt".</p>
<p>Writing before doing this is the most expensive mistake on the list, because the cost is not the writing. It is the months you wait for pages that were never going to rank.</p>

<h2>Fourth: write pages that answer those questions</h2>
<p>One page per question, answering it properly. A page that genuinely answers something gets linked to and recommended; a page that circles the topic does not.</p>

<h2>Fifth: link your own pages together</h2>
<p>When a new page relates to an older one, link them. This helps Google understand which of your pages are important, and keeps readers moving through your site. It costs nothing and is routinely skipped.</p>

<h2>Last: links from other sites</h2>
<p>This matters, and it is deliberately last. It is the slowest to earn, the easiest to waste money on, and the least useful while the first four are unfixed. A site with duplicate titles and no content worth reading will not be saved by links.</p>

<h2>A note on time</h2>
<p>None of this is fast. Search engines take weeks to recognise changes, and months to reflect them in rankings. Anyone promising results in days is selling something else.</p>
<p>If you want to know where your own site stands on the first two points, our <a href="/audit">free check</a> reads your pages and shows you what it finds.</p>
`.trim(),
  },
];

/** Every post, newest first. */
export function listPosts(): BlogPost[] {
  return [...POSTS].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}

/** One post by slug, or null when it does not exist. */
export function getPost(slug: string): BlogPost | null {
  return POSTS.find((post) => post.slug === slug) ?? null;
}

/**
 * Posts to read next, excluding the current one.
 *
 * Deliberately simple: the newest others. With a handful of posts, a relevance
 * score would be dressing up an arbitrary choice as an informed one.
 */
export function relatedPosts(slug: string, limit = 2): BlogPost[] {
  return listPosts()
    .filter((post) => post.slug !== slug)
    .slice(0, limit);
}
