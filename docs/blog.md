# Blog (admin-written)

RepGet's own blog at `/blog` is written in the admin panel: **Admin → Blog** (`/admin/blog`). Until September 2026 the posts were constants in `src/lib/blog/posts.ts`; migration `0046_blog_posts` moved the three published posts into the `blog_posts` table, unchanged apart from the byline (now "RepGet team").

## Writing a post

- **New post** opens an empty editor. The first save creates the post.
- **Fields:**
  - title
  - address (slug), made from the title when left empty
  - category: Guides, Comparisons or Playbooks
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
| A change to a live post, saved on a later day, shows "Updated <date>" and sets `dateModified` | What readers and search engines use |

Pictures inserted in a post are stored in the article-image bucket under `blog/posts/`.

## Rendering

The blog index, post pages, category pages and `sitemap.xml` render per request (`force-dynamic`), as the homepage does for live prices. A published or changed post is live at once, and a build never needs the database.

## Deploying

`0046_blog_posts` only adds a table (and the three posts), so an older build keeps working with it applied. **Apply it before deploying the code that reads it.** Otherwise `/blog`, the posts and `sitemap.xml` fail until it is applied.

1. From `platform/`: `npx drizzle-kit migrate` (uses `DIRECT_URL`).
2. Check: `psql "$DIRECT_URL" -c "select slug, status from blog_posts"` lists the three posts as `published`.
3. Deploy (push `main`).
