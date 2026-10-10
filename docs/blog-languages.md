# The blog in other languages

Added 2026-10-10. The client asked for the same articles in every language the site has, Italian first, translated and adapted rather than word for word. Code: `lib/blog/locale.ts`, `lib/blog/translate.ts`, `lib/admin/blog.ts` (`createBlogTranslation`), and the pages under `app/(marketing)/[locale]/blog`.

## Addresses

| Page | English | Other languages |
|---|---|---|
| Blog front page | `/blog` | `/it/blog`, `/es/blog`, `/fr/blog`, `/de/blog` |
| A post | `/blog/<address>` | `/it/blog/<address>` ... |
| Categories, author page | `/blog/category/...`, `/blog/author/...` | English only |

- A language's front page lists its own posts, then the latest English ones. With no post yet, it says so in that language.
- A post's address is unique across all languages. An Italian translation gets its own Italian address.
- Every published language of one article links to the others: hreflang tags, plus a visible "Also in: Italiano" line on the post. Search engines then treat them as one article in several languages, not as copies.
- Translated posts are in the sitemap. The words around a post (date, "min read", "In this article", FAQ, "Sources") follow its language.

## Writing a translation (Admin -> Blog)

1. Open the **English** post and save any changes. A translation is always made from the saved post.
2. In the **Language** box on the right, find the language, then choose one:
   - **Draft with AI** translates and adapts the post: title, headings, description, keywords, text and FAQs. Links, pictures and facts stay as they are. A long post takes a minute or two.
   - **Copy** copies the English text, so a person can translate it by hand.
3. The draft opens. It is **not published**, and it is marked **Needs review**.
4. Have a **native speaker** read and correct it. Check the title, the headings and the primary keyword above all: they should be the words people actually search with in that country. Check the address too: it can still change until the post is published.
5. Tick **Reviewed by a native speaker**, then **Publish**. Publish stays disabled until the box is ticked, and the server refuses it too.

## Writing a post directly in another language

Some topics only matter in one country. Admin -> Blog -> New post: choose the language in the **Language** box **before the first save**. A post keeps its language after that. Such a post has no English version, so it has no "Also in" line.

## Good practice

- Translate first the articles people search for in that country. Search Console then shows which languages bring visits.
- Never publish an unchecked machine translation: Google treats it as low quality. This is why the review box exists.
- After you change the English post, open its translations and update them too. They are separate posts and are not updated by themselves.

## Setup

- **Database:** migration `0054_blog_translations` adds the language, the link to the original and the review mark. Existing posts become English. Nothing else changes.
- **AI drafts** use the same `ANTHROPIC_API_KEY` as articles. Without it, "Draft with AI" says so, and "Copy" still works.
