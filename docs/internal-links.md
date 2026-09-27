# Internal links: how they are chosen, checked and repaired

## The defect (client report, imagestudio.com)

Some articles contained internal links whose destination did not exist. WordPress post 11186 had a link whose href was `#`. Post 11180 linked to `/destination-wedding-photography-films`; imagestudio.com answers that URL with **404**, which was checked on 2026-09-27 with a read-only request.

Root cause:

- **The prompt asked for links it never supplied.** The article writer was told to "work in about N internal links to other pages on this site" (N being `internalLinkTarget`), but was never given a single URL. It invented them: `#` placeholders, and slugs guessed from the topic.
- **Nothing checked them afterwards.** The post-generation linker only added links. It never examined the ones the model wrote. It also offered crawled pages without looking at their HTTP status, so a 404 page could become a target.
- **Contents-list links pointed nowhere.** The contents list's `#section` links targeted heading ids that the sanitizer stripped.
- **Nothing downstream caught it.** The WordPress plugin feed and the direct CMS publishers sent the stored HTML as written.

## What happens now

Every internal link is verified before it is written:

| Where | What happens |
|---|---|
| **The writer (prompt)** | No longer asked for internal links. It is told never to guess the site's URLs or write `#` or placeholder links. The contents list gets heading ids. |
| **After writing** (`add-internal-links` step) | Links the writer made to the site are checked. Unverifiable ones are removed, with their words kept. Then up to `internalLinkTarget` links are added, to pages verified to exist and relevant to the article. `0` means none. If no relevant verified page exists, no link is added. |
| **At publication:** plugin pull, direct CMS publishing, scheduled and retried publishes | The stored article is checked again before it leaves. **Confirmed** defects are fixed in the stored copy, and the original is kept as an article version. The repaired copy is exactly what is sent. A link that could not be checked right now is kept and logged, never removed. |

Per link (`src/lib/articles/link-guard.ts`):

- **Placeholders.** `#`, an empty href, `[LINK]`, `example.com` and unusable schemes are unwrapped. The anchor text and its formatting stay.
- **Section links (`#id`).** Kept if that id exists in the article. Otherwise the link is pointed at the heading with the same text, or unwrapped if there is none. Heading ids now survive sanitizing, restricted to safe slugs, and WordPress keeps them. This was verified on a disposable WordPress 6.8.3.
- **Links to the customer's site.**
  - Resolved against the customer's site. Never the app's domain, and a relative path is not treated as wrong just for being relative.
  - A **confirmed-missing** link is replaced only by a verified page whose title shares at least two distinctive words with the visible anchor text. Otherwise it is unwrapped. The homepage and unrelated pages are never substituted.
  - A link that **could not be verified**: removed from a new article, kept in stored content.
- **Everything else** is untouched: citations, the matched backlink, social links, `mailto:` and `tel:`. Links to the customer's own site are not marked `nofollow`.

## Verifying a page (`src/lib/articles/link-verify.ts`)

Every request goes through the SSRF-safe layer (`fetchPage` → `safeFetch`): public addresses only, checked when the connection opens, and every redirect hop checked. Only the site's own host and its www twin count as the site. Other subdomains and other domains are not followed.

| Result | When |
|---|---|
| **ok** | 2xx on the same site. A redirect counts only if it lands on a related page. |
| **missing** | 404 or 410; an error page served as 200 (WordPress's `error404` body class, or a "not found" title or H1 in EN, IT, ES, FR, DE, NL or PT); a redirect to the homepage |
| **rejected** | A login page; a redirect off the site or to an unrelated page; a non-public address |
| **unavailable** | A timeout, 5xx, 429 or a firewall's 403. **Never treated as proof a page is gone.** |

Limits:

- 8 s per request;
- 256 KB read per page (safe-fetch truncation, no cancelling);
- at most 5 redirects;
- 4 requests at a time;
- a time budget per operation: 8 s per plugin poll, 20 s per publish or generation.

Results are cached per website in `provider_cache`, under the provider `internal-link`, keyed by a hash of the website id and the URL:

| Result | Cached for |
|---|---|
| ok | 7 days |
| missing, rejected | 24 hours |
| unavailable | 15 minutes |

A plugin poll therefore rarely makes a request.

## Where link candidates come from (`src/lib/articles/link-inventory.ts`)

Candidates come from:

- crawled pages that answered 2xx within the last 60 days;
- published articles, at their recorded URL;
- pages already verified for the site;
- the site's sitemap. The sources are tried in order: the configured `sitemapUrl`, then the `Sitemap:` lines in robots.txt, then `/wp-sitemap.xml`, `/sitemap_index.xml` and `/sitemap.xml`. At most 8 files are read, 5 child sitemaps (pages and posts before archives), and 500 entries.

A sitemap entry is only a candidate. The most relevant candidates are verified, at most 12 per article, and only real pages become links.

Checked against the live imagestudio.com (read-only): 281 sitemap candidates, and 9 relevant pages verified for a "destination wedding" article.

## Dry-run audit of existing articles

```sh
node --env-file=<env file with DATABASE_URL> --import tsx scripts/audit-internal-links.ts \
  --website <website id> --article <article id> [--article <id> ...] [--json]
```

It writes nothing: no article, version, cache row or WordPress post changes. For each problem it prints:

- the application article id;
- the WordPress post id and public URL, when a publish recorded them;
- the href and its anchor text;
- the reason and the verification result;
- the proposed replacement or unwrap, as a before/after of the anchor.

Links that could not be checked are listed as kept. Choose the env file deliberately: it decides which database is read.

## Repairing posts already live on WordPress (requires separate authorization)

Nothing here edits a live post. The stored copy of an article is repaired the next time the app publishes it. A post that is **already live** keeps its current content until it is repaired on the site. When authorized, do it like this:

1. Run the dry-run audit for the affected articles and review each finding.
2. In WordPress, open the **same post** by its id, for example 11186 or 11180, and read its **current** content. Never paste the app's copy over it: the client may have edited the post since.
3. Apply only the link changes the audit proposes: unwrap the anchor and keep its text, or change the href to the verified replacement.
4. Update that post in place, without changing its status, dates, slug, author, categories or any other content, and without creating a new post.

Re-publishing an existing article through the app is not a substitute: the plugin only creates posts for articles that are not yet live.

## Tests

| File | Covers |
|---|---|
| `link-guard.test.ts` (43) | The HTML rules: the reported `#` and 404 cases, relative, absolute, `?p=` and multilingual URLs, section links, limits, nesting, idempotency, `nofollow` |
| `link-verify.test.ts` (25) | Missing, soft-404, homepage, redirect, login and uncertain cases; the cache and its freshness; tenant isolation; the sitemap bounds |
| `link-verify-ssrf.test.ts` (9) | The real network layer with simulated DNS: private addresses refused without connecting, and large and compressed bodies |
| `internal-links.integration.test.ts` (8) | Writer → storage → plugin and direct-publish payloads; pre-fix drafts; concurrent edits; tenants; the dry-run audit |

Against the pre-fix code, all 5 end-to-end cases that use existing entry points fail, because `href="#"` reaches the stored article and both payloads.
