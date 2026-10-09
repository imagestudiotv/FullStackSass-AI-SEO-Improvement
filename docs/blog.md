# Blog (admin-written)

RepGet's own blog at `/blog` is written in the admin panel: **Admin → Blog** (`/admin/blog`). Until September 2026 the posts were constants in `src/lib/blog/posts.ts`; migration `0046_blog_posts` moved the three published posts into the `blog_posts` table, unchanged apart from the byline (now "RepGet team").

## Writing a post

- **New post** opens an empty editor. The first save creates the post.
- **Fields:**
  - title
  - in the "Search and cards" panel:
    - optional SEO title: the page's HTML title and social previews, exactly as typed; blank uses "title | RepGet"
    - description (see below)
    - optional primary keyword and secondary keywords (up to 30, comma-separated), with checks on where they appear
    - optional breadcrumb label; blank uses the title
  - address (slug), made from the title when left empty
  - category: one of the blog's categories (see Categories below)
  - author
  - description: shown in search results and on cards; about 160 characters
  - short answer: optional, plain text, shown above the article
  - the text, in the same editor as articles, with image upload
  - FAQ rows and sources: optional
- **Preview** shows the post exactly as the blog renders it, unsaved changes included (`components/blog-article.tsx` is shared by the preview and the public page).
- **Buttons follow the post's state:**
  - A draft: **Save draft**, **Publish**, **Delete**.
  - A published post: **Save changes** (goes live at once), **Unpublish**, and a link to the live post.
- Reading time is counted from the words: about 200 a minute, never less than one.

## Rules (enforced on the server, `src/lib/admin/blog.ts`)

| Rule | Why |
|---|---|
| Admins only; every action is in the audit log (`blog.post_*`) | Same as the rest of the admin panel |
| Only `published` posts are public (`src/lib/blog/posts.ts`); a draft's address is a 404 | Unfinished posts are not one guessed URL away |
| Publishing needs a description and some text | Search results and cards show the description |
| The address is unique, not a blog path (`category`), and **locked once published**, even after unpublishing | Changing it breaks every link and loses the post's ranking |
| Each save carries the version it started from; a save from an older copy is refused | Two admins cannot overwrite each other |
| Text and FAQ answers are sanitised like article text; links to RepGet stay normal links, other sites get `nofollow` and open in a new tab | The HTML is published on RepGet's own site |
| Structured data (JSON-LD) is escaped for a script block | Posts are typed by people now |
| Only a post that is not published can be deleted | A live post is unpublished first |
| A change to a live post's content, saved on a later day, shows "Updated <date>" and sets `dateModified`; a change to the search fields alone does not | What readers and search engines use; a new SEO title is not new content |

Pictures inserted in a post are stored in the article-image bucket under `blog/posts/`.

## Rendering

The blog index, post pages, category pages and `sitemap.xml` render per request (`force-dynamic`), as the homepage does for live prices. A published or changed post is live at once, and a build never needs the database. Index, category and author archives now query 30 articles per page, with stable ordering and numbered navigation. The team byline links to `/blog/author/repget-team`.

The SEO title never becomes a second heading. Keywords are editorial inputs and appear in the BlogPosting structured data; they add no hidden text and no meta-keywords tag. Search engines and link previews get the title, description, canonical and Open Graph tags in the initial HTML `<head>`: `htmlLimitedBots` in `next.config.ts` is Next's own crawler list plus Googlebot. People still get streamed metadata.

See [Blog upgrade setup](blog-upgrade-setup.md) for migrations 0051–0052, the "Get Featured in This Article" placements and the release steps.

## Deploying

`0046_blog_posts` only adds a table (and the three posts), so an older build keeps working with it applied. **Apply it before deploying the code that reads it.** Otherwise `/blog`, the posts and `sitemap.xml` fail until it is applied.

1. From `platform/`: `npx drizzle-kit migrate` (uses `DIRECT_URL`).
2. Check: `psql "$DIRECT_URL" -c "select slug, status from blog_posts"` lists the three posts as `published`.
3. Deploy (push `main`).

## Categories

Managed in **Admin → Blog → Categories** (client request, 2026-10-01). They were three constants in the code until then. Migration 0048 creates the `blog_categories` table with those three (Guides, Comparisons, Playbooks), keeping their names, addresses and descriptions.

- **Add:** a name (up to 40 characters, unique in any letter case) and a one-line description. Its page, `/blog/category/<slug>`, exists at once; the slug is made from the name. A category appears on the blog's index once it has a published post. New categories go last in the order.
- **Rename / describe:** the address never changes. A post names its category by name (`blog_posts.category`), so renaming one renames it on its posts, drafts included, in the same transaction.
- **Delete:** only a category no post uses (drafts included). Its page then returns 404.
- Saving a post checks that its category exists while holding a share lock on that category row, so a category cannot be deleted or renamed under a save.
- Every change is recorded in the admin audit log (`blog.category_created`, `blog.category_saved`, `blog.category_deleted`).
