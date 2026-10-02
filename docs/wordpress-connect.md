# Connecting WordPress: one-click connect (plugin 1.7.0)

## Why

On 2026-09-29 a client installed the plugin and saw "Connected" in WordPress, while their RepGet account showed "Never used". The WordPress site still held a key from a *second* RepGet account for the same domain, and neither screen said which account WordPress belonged to.

Phase 1 (commit `2407243`, plugin 1.6.0 as installed) helped in three ways:

- **Connect WordPress** makes a key at the moment of the click and opens WordPress with the key already filled in.
- The card waits, then turns green by itself.
- WordPress's "Connected to …" message names the account.

Phase 2, described here, removes the key from the customer's hands entirely:

- **Connect to RepGet** in WordPress, or **Connect WordPress** in RepGet, runs a handshake.
- The key travels once, server to server, and is never shown, copied or put in a URL.
- WordPress always shows which RepGet account and website it is connected to.

Sites on plugin 1.6.x keep working with the phase-1 flow. Every older site needs one manual upload of 1.7.0; from then on, WordPress offers updates itself (see "Updates").

## The flows

### A. Started in RepGet

This is the main path, from the Integrations card.

1. **Press the button.** The customer presses **Connect WordPress**. The server action `connectWordPress` returns two things:
   - a phase-1 key, as today;
   - a **link**: the id of a `plugin_connect_requests` row with origin `repget`, this website, this user and this session.
2. **Open WordPress.** The card opens `<site>/wp-admin/admin.php?page=repget&repget_link=<link>#repget_key=<key>`.
   - **Plugin 1.6.x** ignores `repget_link` and fills the key in from the fragment. That is the phase-1 flow, unchanged.
   - **Plugin 1.7.0** sees `repget_link` and shows a **Finish connecting to RepGet** card with one button. It removes the fragment from the address bar without using the key. That key is never used and is tidied up after the 30-minute grace.
3. **Start the handshake.** The admin presses the button. The plugin calls `POST /api/plugin/connect/start` with `link` (see the API section) and is given an `authorizeUrl`.
4. **Redirect.** The plugin sends the browser to `authorizeUrl`. RepGet recognises the same signed-in session that made the link, with a matching website and domain, and approves at once, without asking. The browser goes straight back to WordPress with a one-time code.
5. **Finish.** The plugin exchanges the code for a key (`POST /api/plugin/connect/token`), verifies the key, saves it, and shows **Connected to <workspace> · <domain>**.
6. **RepGet updates.** The RepGet card turns green by itself, as in phase 1, when any key not used before connects.

### B. Started in WordPress

Typical after activating the plugin.

1. The admin presses **Connect to RepGet** on the plugin screen, and the plugin calls `start` without a link.
2. RepGet opens `/connect/wordpress?request=<id>`, asking the admin to sign in first if needed. It shows:
   - who is signed in;
   - the WordPress the code goes back to (the return address without `wp-admin/admin.php`), not just the site address the plugin named: another install on the same host could name it;
   - the matching website or websites, each with its workspace name.
3. The admin clicks **Connect <domain>**, and the rest of the flow is steps 5 and 6 above.

### C. Moving a site between accounts

This is today's incident. The plugin holds a key from account X, and the admin connects to account Y.

1. `start` receives the old key in `X-Integration-Key`, recorded as `presented_key_id`.
2. The confirm page warns: *"This WordPress site is connected to another RepGet account. If you continue, that account stops publishing here."* The button reads **Move <domain> to <workspace>**.
   - The other workspace is named only if the signed-in person is a member of it.
   - The page asks even in flow A.
3. The old key is revoked only when the NEW key first verifies, never earlier, so a failed connect never disconnects a working site. Account X gets an in-app notification: *"<domain> was connected to another RepGet account."*
4. Only a key of a **different website** is revoked this way. Reconnecting the same website leaves its previous key alone: a staging copy on the same address holds the same key, and reconnecting it must not cut the live site off. `tidyKeys` retires a replaced key once it has been silent for a day, as in phase 1.

## Data: `plugin_connect_requests`

This is migration 0047, an additive table: older builds ignore it.

| column | type | notes |
|---|---|---|
| `id` | text pk | 32 random bytes, base64url. The only value in RepGet URLs. |
| `origin` | text not null | `repget` or `wordpress` |
| `website_id` | uuid null → websites (cascade) | Set up front for `repget`; set on approval for `wordpress`. |
| `created_by_user_id` | text null | `repget` origin only |
| `created_session_id` | text null | `repget` origin only |
| `link_key_id` | uuid null → integration_keys (set null) | `repget` origin only: the key the same press made for plugin 1.6. Plugin 1.7 never uses it, so the token exchange revokes it (while unused) and approval does not count it, so a press takes one key slot, not two. |
| `site_url`, `site_host`, `return_url` | text null | Registered by the plugin in `start`. |
| `plugin_state` | text null | The plugin's state, echoed back on the redirect. |
| `code_challenge` | text null | PKCE S256, 43 base64url chars. |
| `plugin_version` | text null | |
| `caller_hash` | text null | Hash of the address that called `start` (never the address itself), for the per-caller limit. |
| `presented_key_id` | uuid null → integration_keys (set null) | The key the plugin held at `start`, if valid. |
| `viewer_session_id` | text null | The first RepGet session that opened the confirm page. |
| `approved_by_user_id`, `approved_at` | | |
| `code_hash`, `code_expires_at` | | SHA-256 of the one-time code; valid 5 minutes. |
| `consumed_at`, `issued_key_id` | | |
| `created_at`, `expires_at` | timestamp | `expires_at` is 30 minutes for `repget`, 15 for `wordpress`. |

Whenever a new row is written, rows that never issued a key are deleted once they (and any code) have expired, and rows that did are deleted a day after they expire. The day matters: the step that retires a moved site's old key reads the row when the new key first verifies, which can be just after expiry.

Every time that is compared (`expires_at`, `code_expires_at`) is set and read on the database's clock (`localtimestamp`), like the key tidy-up.

## API (all JSON, `Cache-Control: no-store`, no CORS headers: only servers call these)

### `POST /api/plugin/connect/start`

Called by the plugin.

- **Body:** `{ siteUrl, returnUrl, state, challenge, pluginVersion, link? }`.
- **Optional header:** `X-Integration-Key`, the plugin's current key.

**Checks:**

- `siteUrl` and `returnUrl` must be http(s), with no user or password and not an internal host (`isInternalHostname`).
- `returnUrl`'s path must end in `/wp-admin/admin.php`, and its host must equal `siteUrl`'s host (both without `www.`, as `acceptableSyncUrl` compares).
- `returnUrl` must be the RepGet screen itself: its query may hold only `page=repget` and `repget_connect=callback`. `admin.php?page=<anything>` is any plugin's screen, and one that redirects on a query parameter would carry the code to whoever registered the request, who holds its verifier.
- `state` must be 16–128 url-safe characters.
- `challenge` must be exactly 43 base64url characters.

**The presented key:**

- It is looked up without recording use: this must NOT write `last_used_at`, which would tick "Connect your site".
- A bad key is ignored rather than answered with 401. A 401 would make the plugin show "rejected".

**With `link`** (tried first, and no limit applies to it: attaching adds no row, and a RepGet editor made the link): a conditional UPDATE attaches the site to that row. It applies only if the row:

- has origin `repget`;
- has not expired;
- has no site yet;
- belongs to a website whose domain equals the site host (both without `www.`).

If any condition fails, a fresh `wordpress` row is created instead.

**Limits.** Start needs no credentials, and a request names whatever site its caller likes, so nothing is limited per SITE: a cap there would let anyone lock a site out of connecting by sending requests in its name.

- **Per caller** (the address that called start, a WordPress server, from `x-real-ip` set by the platform): at most 30 open requests, else 429 for that caller alone.
- **In all:** at most 5000 open requests. A new one makes room by deleting the oldest open rows without a live code. The delete re-checks that, so a request approved meanwhile stays. Only a request whose code is out (approved, not yet exchanged: minutes at most) is never dropped, because holding one takes a RepGet editor's approval. Only when every open row has a live code does start answer 429.
- Both are checked under one advisory lock, so requests arriving together cannot overrun them.

Opening a request (the claim below) protects nothing here: any signed-in account can open a request, so a claim must not be able to hold a row against eviction.

**Replies:**

- **200:** `{ ok: true, authorizeUrl: "<origin>/connect/wordpress?request=<id>" }`, where `<origin>` is the address the plugin called. That is the plugin's `repget_endpoint()`, the only prefix it accepts, so a custom `NEXT_PUBLIC_APP_URL` or a staging plugin pointed at staging still works.
- **400:** `{ ok: false, error }`.

**RepGet's address.** The plugin's default `repget_endpoint()` is `https://www.repget.com` since 1.7.1 (a stored pre-1.7.1 Vercel address reads as the default). 1.7.0 defaulted to `https://full-stack-sass-ai-seo-improvement.vercel.app`, the deployment's own address from before repget.com was live. It still answers, so 1.7.0 installs keep working and receive the 1.7.1 update from it, and the payment webhooks are registered there.

### `GET /connect/wordpress?request=<id>`

A page outside `(app)`, like `src/app/invite/[token]`, sent with `Referrer-Policy: no-referrer`.

Opened on the old Vercel address (1.7.0's default), it first redirects the browser to the same page on the canonical address (`legacyRedirect` in `src/lib/site-url.ts`), before reading the session: the customer's sign-in lives on repget.com, and on the old host they were asked to sign in again. The plugin checks only the `authorizeUrl` string, not where the browser ends up, so nothing else changes. Only that exact host is redirected; previews and staging are not.

- **Signed out:** redirect to `/sign-in?next=…`.
- **Unknown, expired or consumed request:** a plain message telling the admin to go back to WordPress and press Connect to RepGet again.
- **First view:** the page claims `viewer_session_id` with a conditional update, and only for a request WordPress has registered (`site_host` set). Any other session sees *"This connection was opened somewhere else."* A claim passes on only once the claiming session no longer exists, which is what "Use a different account" (sign out, sign in) relies on.
- **A "Connect WordPress" link** (`origin` = `repget`) can be claimed only by the session that pressed the button (`created_session_id`). The link is the address of the WordPress tab it opened, so it can leak (access logs, history). Otherwise someone else could claim it, approve it for a website of their own with the same domain (any account can add any domain), and hand the WordPress admin a callback that connects the site to their website.
- **Candidates:** websites the person can edit in ANY of their workspaces, as a member or through `website_members` with the editor role, whose domain equals the site host. For a request started with "Connect WordPress", only that website is offered while the person can still edit it.
- **Auto-approve** when all of these hold:
  - origin is `repget`;
  - `created_session_id` equals the current session;
  - `website_id` is among the candidates;
  - there is no `presented_key_id` of a different website.

**Approve action:**

1. Re-check the request (unexpired, not yet approved, same session), the person's edit access and the domain match. A "Connect WordPress" link connects only the website it was pressed on.
2. Set `website_id`, `approved_*`, `code_hash` (SHA-256 of 32 random bytes, base64url) and `code_expires_at` (5 minutes).
3. Redirect to the STORED `return_url` with these set (replacing any of the same name): `repget_connect=callback`, `request`, `code`, `state` (= `plugin_state`). Never redirect anywhere else.

Before approving, the page checks the website has room for another key (five at most), so a full website hears it on RepGet rather than as an error inside WordPress.

**Cancel:** expire the row, then redirect to `return_url` with `repget_connect=cancelled` and `state`.

**None match:** *"<domain> isn't in this RepGet account yet"*, with a link to add it and a "Use a different account" sign-out link.

### `POST /api/plugin/connect/token`

Called by the plugin. **Body:** `{ request, code, verifier }`.

**Checks:**

- The request must be approved, unconsumed and within `code_expires_at`.
- `sha256(code)` must equal `code_hash` (timing-safe compare).
- `base64url(sha256(verifier))` must equal `code_challenge`.

**A wrong verifier or code** clears `code_hash`, so the code is used up, and gets 400.

**On success**, inside one transaction under the per-website key lock (`lockWebsiteKeys`):

1. Set `consumed_at` with a conditional update. If a concurrent exchange already set it, reply 400.
2. Revoke the press's `link_key_id` if it is still unused, tidy up (`tidyKeys`) and check the five-key cap.
3. Create a key labelled `CONNECT_KEY_LABEL`, and set `issued_key_id` to it.

**Reply:** `{ ok: true, key, website: { id, domain, name }, workspace: { name } }`.

### Changes to the existing `POST /api/plugin/verify`

After `revokeLeftoverKeys`, the route runs a second step. If this key is a request's `issued_key_id` and that request's `presented_key_id` is a still-live key of a DIFFERENT website, it:

- revokes that key;
- sends the revoked key's check-now address a signal (`signalRevokedKey`), unless it is the address this verify reported. The site that moved holds the new key, and a check still running there on the old key would mark it rejected just after it connected;
- notifies the old key's workspace (`plugin.moved`), naming another account or another website in the same workspace.

This happens once only: the step sets `presented_key_id` to null.

### `POST /api/plugin/disconnect`

Authenticated by the key. **Body:** the verify body (`syncUrl` matters). **Reply:** `{ ok: true, revoked }`.

A host's one-click staging copies the live site's database, key included, and shows the same Disconnect button: in a subfolder of the same domain, or on a subdomain. Revoking there would stop the LIVE site publishing. `sync_url` cannot tell the two apart, because it follows whoever reported last, and the copy's settings page verifies (reports) just before its Disconnect button is pressed.

So each key also remembers which install it belongs to (`integration_keys`, migration 0047):

- `install_url`: set once, never overwritten. For a key the handshake issued, it is the check-now address beside the `return_url` of the WordPress that asked for it, set at the exchange. For any other key, it is the first address reported with it (verify body or `X-RepGet-Sync-Url`). Any well-formed `…/admin-ajax.php` on any host: it identifies, and is never called.
- `install_since`: when that was set. `other_install_at`: the last time a DIFFERENT address used the key (noted at most hourly).

The key is revoked (`revokeForDisconnect`, one conditional update) only when all of these hold:

- the caller reports the key's `install_url`;
- that address is settled: recorded in the key's first 10 minutes (the WordPress that received it; no copy can exist yet), or at least 2 hours ago (long enough for any other copy's hourly check to report);
- no other address has used the key in the last 30 days.

Otherwise the reply is `revoked: false`: the caller forgets the key, and the key stays live. When in doubt nothing is revoked: a key left live is harmless, while a live site cut off is not. A copy on the very same address cannot be told apart. The plugin says when RepGet kept the key, and where to revoke it.

### `GET /api/plugin/articles` change

The plugin version in the key's site details is refreshed from the `X-RepGet-Plugin-Version` header every call sends (one conditional write, only when it changed). Otherwise the card kept offering the update to 1.7 after the customer had installed it, until WordPress next verified its key.

## Plugin 1.7.0

- **Version:** `REPGET_VERSION` is `1.7.0`, plus the header, readme Stable tag and changelog.
- **"Connect to RepGet" button:** a form posting to `admin-post.php?action=repget_connect_start`, with `wp_nonce_field('repget_connect')`, requiring `manage_options`.
  - It makes `state` and `verifier` (each 32 random bytes, base64url) and `challenge = base64url(sha256(verifier))`.
  - It stores `{state, verifier}` in a 15-minute transient for THIS WordPress user.
  - It calls `start` through a request function that never touches `repget_status`, sending the current key if there is one.
  - It accepts `authorizeUrl` only if it starts with `repget_endpoint() . '/connect/wordpress?request='`, then redirects with `wp_redirect`.
- **Callback:** `admin_init`, when `page=repget` and `repget_connect=callback`.
  - It requires `manage_options`, loads the transient and compares `state` with `hash_equals`.
  - **Unknown state:** POST `token` with an empty verifier to use the code up, then show an error.
  - **Otherwise:**
    1. POST `token` to get the key.
    2. Verify the NEW key: call `/api/plugin/verify` with it.
    3. Unless that verification is REJECTED (HTTP 401):
       - save the key;
       - set `repget_status` to `connected`;
       - save `repget_connection` (`workspace`, `website`, `domain`, `websiteId`, `connected_at`);
       - delete the transient;
       - redirect to the settings page with a success notice.
    - **If verification is rejected,** the old key stays.
    - **If it gets no answer** (a timeout, a reset, an error page), it is tried once more, and then the new key is saved anyway, with the account and website from the token reply. The check may well have reached RepGet, which then retired the key this site held for another website. Keeping the old key would leave the site holding a revoked key while saying nothing changed. The settings page checks the new key live.
    - **After saving,** it schedules one run of the hourly check's hook (`repget_sync_event`) for now. RepGet's nudge when the new key verified is signed with the new key and arrives before the save, so the site turned it away, and the website's first article would otherwise wait for the next hourly check.
  - **`repget_connect=cancelled`:** *"Connection cancelled. Nothing changed."*
- **Settings page:**
  - **Not connected:** one sentence and **Connect to RepGet**.
  - **With `?repget_link=`:** a **Finish connecting to RepGet** card, with the button posting that link.
  - **Connected:** *"Connected to <workspace> · <domain>"*, from a live verify cached for 5 minutes, instead of the stored status alone. The buttons are:
    - **Check for articles now**
    - **Connect to a different RepGet account** (the same form)
    - **Disconnect** (calls `/api/plugin/disconnect` with the verify body, then clears the key, status and connection; a 401 there means RepGet had already stopped accepting the key, and is reported as disconnected)
  - **Publish articles as:** stays.
  - **Advanced: use an Integration Key:** collapsed. It holds the 1.6 key field, "Save and connect", and the `#repget_key` prefill (ignored when `repget_link` is present).
  - **Help text:** "In RepGet: Integrations → WordPress plugin → Connect WordPress."
- **Fix:** changing "Publish articles as" must not call the claiming `GET /api/plugin/articles`. It claimed articles and then threw the list away, so they sat "in flight" for 10 minutes.

## Updates

`npm run plugin:build` writes `public/repget-connector.zip` and `public/repget-connector.json`:

```json
{ "version": "1.7.0", "package": "/repget-connector.zip", "sha256": "…", "requires": "5.6", "requires_php": "7.4", "tested": "6.8", "changelog": "…" }
```

Plugin 1.7.0+ declares an `Update URI` header (1.7.1: `https://www.repget.com/repget-connector.json`; it only opts out of wordpress.org, the filters below do not depend on it), so WordPress never offers a same-named plugin from wordpress.org as an update to it. It reads that manifest from `repget_endpoint() . '/repget-connector.json'` and caches it for 12 hours, using three filters:

- `pre_set_site_transient_update_plugins` offers an update when `version` is newer than the version ON DISK. That is what WordPress read (`$transient->checked`), or else the plugin file's own header (`get_file_data`); `REPGET_VERSION` is used only if both fail. Right after an update, the OLD code still in memory runs again, and must not offer the version just installed. WordPress's first save of the transient starts from an empty object, with no `checked`.
- `plugins_api` shows the details.
- `upgrader_pre_download`, for that package only, downloads the zip and refuses it unless its SHA-256 matches.

## Security

- **The key** never appears in a URL, page, log or clipboard. It crosses the network once, in the body of a server-to-server reply.
- **The browser** carries only the request id, a one-time code and the plugin's state. None of them works alone:
  - the code works once, for 5 minutes;
  - it is bound by PKCE to a verifier that never leaves WordPress.
- **Addresses:** the site address and return URL are registered server to server, and RepGet redirects only to the stored return URL.
- **Domain rule:** the website's domain must equal the WordPress host, the same rule used for check-now addresses, so nudges keep working.
- **WordPress side:**
  - the start button needs a nonce and `manage_options`;
  - the callback needs `manage_options` and a state stored for that WordPress user;
  - a link or code alone never connects anything.
- **Auto-approval** happens only for a request the SAME RepGet session started, and never when the site would be moved away from another website.
