-- RepGet's blog, written in the admin panel (lib/admin/blog.ts) instead of
-- as constants in the source. Additive: one new table, which a build older
-- than this migration ignores. The three posts published so far are copied
-- in unchanged (their HTML passes the sanitiser as it is), with the author
-- shown as "RepGet team".

CREATE TABLE "blog_posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"category" text NOT NULL,
	"author" text NOT NULL,
	"short_answer" text,
	"body_html" text DEFAULT '' NOT NULL,
	"faqs" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"sources" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"published_at" timestamp,
	"revised_at" timestamp,
	"version" integer DEFAULT 0 NOT NULL,
	"created_by" text,
	"updated_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "blog_posts_slug_uidx" ON "blog_posts" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "blog_posts_status_published_idx" ON "blog_posts" USING btree ("status","published_at");--> statement-breakpoint
INSERT INTO "blog_posts" ("slug", "title", "description", "category", "author", "short_answer", "body_html", "faqs", "sources", "status", "published_at", "revised_at", "created_by", "updated_by") VALUES ($rg$why-your-website-isnt-on-google$rg$, $rg$Why your website isn't showing up on Google$rg$, $rg$The four reasons small business websites stay invisible on Google, and how to tell which one is yours.$rg$, $rg$Guides$rg$, $rg$RepGet team$rg$, $rg$A small business website usually stays invisible on Google for one of four reasons: search engines cannot read its pages properly, it covers subjects nobody searches for, nothing links to it, or customers are getting their answer from an AI assistant without ever visiting. The fixes differ completely, so it is worth knowing which one applies before spending anything.$rg$, $rg$<p>If you have a website and it brings you no enquiries, you are not doing anything unusual. Most small business websites are invisible on Google, and almost always for one of four reasons. They are worth knowing apart, because the fix for each is completely different.</p>

<h2>1. Google cannot read your pages properly</h2>
<p>Every page needs a title and a description. Not a heading you can see on the page - the title tag, which is what Google shows in the results list. A surprising number of sites have pages titled "Home" or "Untitled", or the same title repeated on every page.</p>
<p>This is the most common problem and the easiest to fix. If two pages share a title, Google has to guess which one to show, and it often shows neither.</p>

<h2>2. You are writing about the wrong things</h2>
<p>A dentist writes a page about "our practice". Nobody searches for that. They search for "emergency dentist near me" or "how much does a crown cost".</p>
<p>The gap between what a business wants to say and what its customers actually type is the single biggest reason good websites get no traffic. Writing more pages does not help if they are all on the wrong subject.</p>

<h2>3. Nobody links to you</h2>
<p>Google treats a link from another website as a vote. A new site with no links is a site nothing vouches for, so it starts near the bottom regardless of how good the content is.</p>
<p>This is the slowest problem to fix, and the one where most money gets wasted. Buying links is against Google's guidelines and can make things actively worse.</p>

<h2>4. You are being answered without being visited</h2>
<p>This one is new. People increasingly ask an AI assistant for a recommendation instead of searching, and the assistant names a handful of businesses. If you are not one of them, you never find out - there is no ranking to check and no traffic report showing what you missed.</p>

<h2>Which one is yours?</h2>
<p>Usually more than one, but rarely all four. The order matters: fixing your titles is worth doing before chasing links, because the first costs an afternoon and the second takes months.</p>
<p>If you want to know which applies to your site specifically, our <a href="/audit">free website check</a> reads your pages and tells you what it finds - no account needed.</p>$rg$, $rg$[{"question":"How long before a new page shows up on Google?","answer":"<p>Days to weeks for the page to be indexed, and often months before it ranks anywhere useful. Fixing a title on a page Google already knows is the fastest change on the list; earning links is the slowest. Anyone promising results in days is selling something else.</p>"},{"question":"Do I need to submit my site to Google?","answer":"<p>No. Google finds sites by following links, and a sitemap helps it find pages nothing links to yet. Submitting a URL can nudge things along, but it does not make a page rank and it is not the reason a site is invisible.</p>"},{"question":"Is it worth paying someone to fix this?","answer":"<p>It depends which of the four problems you have. Titles and descriptions are an afternoon of work most owners can do themselves. Choosing the right subjects to write about, and then writing them, is where paid help earns its money.</p>"}]$rg$::jsonb, $rg$[{"label":"Google Search Central - SEO Starter Guide","url":"https://developers.google.com/search/docs/fundamentals/seo-starter-guide"},{"label":"Google Search Central - Link spam policies","url":"https://developers.google.com/search/docs/essentials/spam-policies#link-spam"}]$rg$::jsonb, 'published', '2026-08-12 00:00:00', NULL, 'migration 0046', 'migration 0046');--> statement-breakpoint
INSERT INTO "blog_posts" ("slug", "title", "description", "category", "author", "short_answer", "body_html", "faqs", "sources", "status", "published_at", "revised_at", "created_by", "updated_by") VALUES ($rg$how-ai-assistants-recommend-businesses$rg$, $rg$How AI assistants decide which businesses to recommend$rg$, $rg$People increasingly ask ChatGPT instead of searching Google. Here is what actually determines whether your business gets named.$rg$, $rg$Guides$rg$, $rg$RepGet team$rg$, $rg$AI assistants name a business when it has been described clearly and consistently across sources the model has seen, and when those descriptions are easy to quote. You cannot buy a position and there is no tag to add. What you can do is measure it - ask the assistant the questions your customers ask, and see whether you come up.$rg$, $rg$<p>Ask an assistant "who is the best plumber in Bristol" and you get three or four names. Ask about a product category and you get a shortlist. For a growing number of people, that shortlist has replaced the first page of Google entirely.</p>
<p>If your business is not on it, nothing tells you. There is no ranking to check, no impression count, no drop in a report. You are simply not mentioned, and you never learn it happened.</p>

<h2>Where the answer comes from</h2>
<p>An assistant is not looking up a directory. It is drawing on what it learned from a very large amount of text, and increasingly on web results it fetches while answering. In practice that means a business gets named when it is <em>written about</em> - consistently, across sources the model has seen.</p>
<p>That is a meaningful difference from classic SEO. You cannot buy a position, and there is no tag to add. What moves the needle is being described clearly and repeatedly in places that get indexed.</p>

<h2>What seems to matter</h2>
<ul>
<li><strong>Being described in plain terms.</strong> A page that says what you do, where, and for whom is easier for a model to associate with a question than one full of marketing language.</li>
<li><strong>Consistency.</strong> The same business name, the same location, the same services, wherever you appear. Contradictory details make a model less confident about naming you.</li>
<li><strong>Being mentioned elsewhere.</strong> Directories, local press, industry sites. Not for the link - for the description.</li>
<li><strong>Answering real questions.</strong> Content that addresses what customers ask tends to surface when those questions are asked.</li>
</ul>

<h2>What does not appear to matter</h2>
<p>Keyword density, meta keywords, and the various tricks that stopped working for Google years ago do nothing here either. Neither does volume for its own sake: fifty thin pages are not better than five good ones, and may be worse.</p>

<h2>The honest part</h2>
<p>This is a young field and anyone claiming a reliable method is ahead of the evidence. What can be done today is measure it: ask the assistant the questions your customers ask, and see whether you come up. That is the only way to know where you stand, and it is what our AI visibility tracking does - the same questions, asked repeatedly, so you can see the answer change.</p>$rg$, $rg$[{"question":"Can I pay to appear in ChatGPT's answers?","answer":"<p>Not in the organic answer. There is no placement to buy and no submission form. Anyone offering to guarantee a mention is describing something they cannot control.</p>"},{"question":"Does blocking AI crawlers hurt me?","answer":"<p>It prevents an assistant reading your site when it searches the web mid-answer, so you cannot be cited from your own pages. Plenty of sites block these agents by accident via a security plugin. Our <a href=\"/tools/ai-crawler-checker\">AI crawler checker</a> tells you in a few seconds.</p>"},{"question":"How do I know if AI already mentions my business?","answer":"<p>Ask it. Use the questions a customer would actually type, not your business name - being named when someone asks for you is not the same as being named when someone asks for what you sell. Repeat them over time, since answers drift as models update.</p>"}]$rg$::jsonb, $rg$[]$rg$::jsonb, 'published', '2026-08-20 00:00:00', NULL, 'migration 0046', 'migration 0046');--> statement-breakpoint
INSERT INTO "blog_posts" ("slug", "title", "description", "category", "author", "short_answer", "body_html", "faqs", "sources", "status", "published_at", "revised_at", "created_by", "updated_by") VALUES ($rg$what-to-fix-first$rg$, $rg$What to fix first on a website that gets no traffic$rg$, $rg$A practical order of work for a site with no rankings, starting with what costs an afternoon rather than six months.$rg$, $rg$Playbooks$rg$, $rg$RepGet team$rg$, $rg$Fix titles and descriptions first, because it costs an afternoon and is the only change that can show a difference within a week. Then make sure every page is reachable, find out what customers actually search for, write pages that answer those questions, link your own pages together, and only then chase links from other sites.$rg$, $rg$<p>Most SEO advice is a list of everything that could matter, which is useless when you have a limited amount of time. This is an order of work, cheapest and fastest first.</p>

<h2>First: titles and descriptions</h2>
<p>Every page needs its own title tag describing what that page is about, and its own meta description. If any two pages share either, fix that first.</p>
<p>This is an afternoon of work and it is the only change on this list that can produce a visible difference within a week.</p>

<h2>Second: make sure pages are actually reachable</h2>
<p>A page nothing links to is a page Google may never find. Every page should be reachable by clicking from your homepage in two or three steps. Orphan pages are common on sites that have grown over years.</p>

<h2>Third: find out what people actually search for</h2>
<p>Before writing anything new, find out what your customers type. The phrases are usually more specific and more practical than a business expects - less "quality dental care", more "does a filling hurt".</p>
<p>Writing before doing this is the most expensive mistake on the list, because the cost is not the writing. It is the months you wait for pages that were never going to rank.</p>

<h2>Fourth: write pages that answer those questions</h2>
<p>One page per question, answering it properly. A page that genuinely answers something gets linked to and recommended; a page that circles the topic does not.</p>

<h2>Fifth: link your own pages together</h2>
<p>When a new page relates to an older one, link them. This helps Google understand which of your pages are important, and keeps readers moving through your site. It costs nothing and is routinely skipped.</p>

<h2>Last: links from other sites</h2>
<p>This matters, and it is deliberately last. It is the slowest to earn, the easiest to waste money on, and the least useful while the first four are unfixed. A site with duplicate titles and no content worth reading will not be saved by links.</p>

<h2>A note on time</h2>
<p>None of this is fast. Search engines take weeks to recognise changes, and months to reflect them in rankings. Anyone promising results in days is selling something else.</p>
<p>If you want to know where your own site stands on the first two points, our <a href="/audit">free check</a> reads your pages and shows you what it finds.</p>$rg$, $rg$[{"question":"What if I only have one afternoon?","answer":"<p>Spend it on titles and meta descriptions, starting with any two pages that share one. Duplicates make Google choose between your own pages, and it often shows neither.</p>"},{"question":"Should I delete old pages that get no traffic?","answer":"<p>Usually merge rather than delete. A thin page folded into a fuller one, with a redirect from the old address, keeps whatever links and history it had. Deleting outright throws that away.</p>"}]$rg$::jsonb, $rg$[]$rg$::jsonb, 'published', '2026-08-27 00:00:00', NULL, 'migration 0046', 'migration 0046');
