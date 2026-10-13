# Credentials: where they live, how they are checked, and what to rotate

This document names credentials by **variable name only**. It never contains a value, and nothing added to this repository should.

## Where credentials belong

| Environment | Location | Committed? |
|---|---|---|
| Local development | `platform/.env.local` (copy `.env.example`, fill in) | Never. Ignored by `.env*` |
| Production and previews | The host's environment settings (Vercel → Project → Settings → Environment Variables) | Never |
| Team sharing | A password manager vault (for example 1Password or Bitwarden) | Never |

`platform/.env.example` is the only committed environment file. It holds placeholders and setup notes, and it must stay tracked. The `!.env.example` rule sits last in `.gitignore` for that reason.

Plain-text notes, backups (`*.bak`), key files (`id_rsa*`, `*.key`, `*.pem`) and exported JSON credentials are ignored as well, as a backstop. They should not be kept next to the code at all.

## Variables, by provider

A **secret** grants access and must be rotated if exposed. An **identifier** is configuration and can be public.

| Provider | Secret | Identifier / config |
|---|---|---|
| Stripe | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | price and product ids |
| PayPal | `PAYPAL_CLIENT_SECRET` | `PAYPAL_CLIENT_ID`, `PAYPAL_WEBHOOK_ID`, `PAYPAL_ENV` |
| Supabase / Postgres | `DATABASE_URL`, `DIRECT_URL` (contain the password), `SUPABASE_SERVICE_ROLE_KEY` | `NEXT_PUBLIC_SUPABASE_URL` |
| Better Auth | `BETTER_AUTH_SECRET` | `BETTER_AUTH_URL` |
| App encryption | `CREDENTIALS_ENCRYPTION_KEY` (encrypts stored CMS credentials) | |
| Anthropic | `ANTHROPIC_API_KEY` | |
| OpenAI / images | `OPENAI_API_KEY`, `REPLICATE_API_TOKEN` | `OPENAI_IMAGE_MODEL`, `IMAGE_PROVIDER` |
| Google OAuth | `GOOGLE_CLIENT_SECRET` | `GOOGLE_CLIENT_ID` |
| Inngest | `INNGEST_SIGNING_KEY`, `INNGEST_EVENT_KEY` | `INNGEST_DEV` |
| Resend | `RESEND_API_KEY` | `EMAIL_FROM` |
| Sentry | `SENTRY_AUTH_TOKEN` | `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT` |
| DataForSEO | `DATAFORSEO_PASSWORD` | `DATAFORSEO_LOGIN` |
| SpeedyIndex | `SPEEDYINDEX_API_KEY` | `SPEEDYINDEX_DAILY_LIMIT` |
| Vercel | `VERCEL_OIDC_TOKEN` (short-lived, written by `vercel env pull`) | |
| Crisp | | `NEXT_PUBLIC_CRISP_WEBSITE_ID` |

`npm run doctor` checks that the variables the app needs are set, without printing them.

## Checks

- `npm run check:secrets` scans tracked files, and the **index copy** of staged files (what a commit would contain, even if the working copy was edited since), for high-signal credential patterns (Stripe, private keys, database URLs with passwords, Anthropic, OpenAI, Google, Inngest, Sentry, Resend, AWS, GitHub, Slack, JWTs, HTTP Basic credentials, and `…SECRET=`/`…PASSWORD=` assignments in env-style files; scripts/secret-patterns.mjs). It prints **file, line and kind**, never the matched text. It exits 1 on a finding.
- `npm run check:secrets -- --all` also scans untracked files that are not ignored.
- `npm run check:secrets -- --history` also scans every line ever added in every local commit (all refs), and reports commit, file, line and kind. A key committed and then removed is still published by a push.
- `.github/workflows/secret-scan.yml` runs the scan with `--history` on a full clone, on every push and pull request.
- **Not covered, by design:** ignored files (`.env.local`, `*.bak`, key files, dumps - they are ignored because they hold credentials or data), anything outside the repository (`env data.txt`, `Git hub SSH key/`, `db-backups/`), and remote history that has not been fetched. Those are covered by keeping them out of the repository (`.gitignore`) and by the runbook below. src/lib/secret-scan.test.ts proves the scanner finds staged and historical secrets without printing them.
- To block a commit locally, add a pre-commit hook. It is optional and per clone:

  ```sh
  printf '#!/bin/sh\nnpm run --silent check:secrets\n' > .git/hooks/pre-commit
  chmod +x .git/hooks/pre-commit
  ```

This scanner covers the patterns this project uses. For a deeper audit, including a fresh clone of the remote, run a dedicated tool such as gitleaks (`gitleaks detect --redact`), which also redacts what it prints.

## Findings (read-only survey, 2026-09-26)

**Repository and history: nothing found.** The survey covered every ref, tag, `refs/original` and the reflog, 452 commits in all. It used pattern searches and exact-value comparisons against the local secret files, with values never printed. `.env.local`, `.env.local.bak` and `.vercel/` are ignored and were never committed.

**Sensitive files outside the repository (local only).** None of these is in git, but each is a plain-text copy outside any secret store:

| File (relative to the project folder) | Contents (kind only) |
|---|---|
| `env data.txt` | A **live** Stripe secret key and a webhook secret; Anthropic, OpenAI and Resend API keys; DataForSEO login and password; several account email/password pairs, including an admin login; other tokens |
| `Git hub SSH key/id_rsa` | An RSA-4096 private key with **no passphrase** |
| `platform/.env.local.bak` | A duplicate of `.env.local` |
| `stripe-ids-backup.json` | Stripe price, customer and subscription ids (identifiers, customer-linked) |

**Transcript exposure.** During the 2026-09-26 audit session, one scan printed the base64 DataForSEO Basic-auth token into the AI session's tool output. Treat that DataForSEO credential as exposed.

## Status recheck (security review, 2026-10-12)

Rechecked without opening any of the files below: only existence, size and modification date. No credential was used, tested, rotated or revoked in this review, and nothing was moved or deleted.

**Files still present on the workstation** (outside git; never committed - history checked again, see the scan table below):

| File (relative to the project folder) | Present | Modified | Holds (kind only, from the 2026-09-26 survey) |
|---|---|---|---|
| `env data.txt` | yes, 4,159 bytes | 2026-10-05 (changed since the first survey) | live Stripe secret key and webhook secret; Anthropic, OpenAI, Resend keys; DataForSEO login and password; account email/password pairs incl. an admin login; other tokens |
| `Git hub SSH key/id_rsa` (+ `id_rsa.pub`) | yes, 3,389 bytes | 2026-08-27 | RSA-4096 private key, no passphrase |
| `platform/.env.local.bak` | yes, 7,948 bytes | 2026-09-23 | an older copy of `.env.local` (production database URL and the app's secrets) |
| `platform/.env.local` | yes (intended: the local configuration; points at the PRODUCTION database) | 2026-09-30 | the app's secrets |
| `stripe-ids-backup.json` | yes | - | Stripe ids (customer-linked identifiers, not secrets) |
| `db-backups/` | yes: three `prod-*.dump` files, 2026-09-27 and 2026-09-30, about 1.9 MB | - | full PRODUCTION database dumps: customer data, session rows, encrypted CMS credentials. Not credentials files, but as sensitive as one. |

**Credential status** - what is known, not what is hoped:

| Credential | Status | Evidence |
|---|---|---|
| DataForSEO API login/password | **Known exposed** | Its Basic-auth token was printed into an AI session's tool output on 2026-09-26. No rotation has been recorded. |
| GitHub SSH key (`Git hub SSH key/id_rsa`, `SHA256:L97HiBECZ0dJgkOhlAjU2hP/FAY1eUZa/hVxKQucej0`) | **Active - verified still registered** on the GitHub account `imagestudiotv` (2026-10-12, from GitHub's public key list - the public key only; the private key was not used). Stored unencrypted with no passphrase. A second key (ED25519, `SHA256:7PsiBygaRL1wsXQTcP9cNXlfbkkBlbW2aDxdbvvySi4`) is registered too. | `https://github.com/imagestudiotv.keys`. Repository deploy keys could not be listed (`gh` is not signed in). |
| Stripe live secret key, Stripe live webhook secret, Anthropic, OpenAI and Resend keys, the account passwords in `env data.txt` | **Unknown** - stored in a plain-text file outside any secret store since at least 2026-09-26; no rotation recorded; whether the file ever left the machine is not known | file present (above) |
| Everything only in `.env.local` / `.env.local.bak` (database password, `SUPABASE_SERVICE_ROLE_KEY`, `BETTER_AUTH_SECRET`, `CREDENTIALS_ENCRYPTION_KEY`, Google, Inngest, Sentry, PayPal) | **Unknown**, lower priority: on the workstation only, in ignored files, never committed | files present (above) |
| Any credential verified as revoked | **None.** Nothing can be marked revoked until the owner rotates it and the old value is shown to fail. | - |

A deleted file does not make a credential safe, and a clean scan does not either: only a rotation, with the old value verified dead, does. Record each one in the log at the end of this document.

## Rotation and cleanup runbook (owner actions)

Order: **1** Stripe, DataForSEO and the SSH key (known exposed or verified active), **2** the other provider keys and the account passwords from `env data.txt`, **3** relocation and cleanup, **4** the lower-priority secrets. Do one provider at a time and verify it before the next.

General rules for every step:

- Get the new value from the provider's own console, signed in as the owner. Never use an exposed credential to make account changes, and never paste values into chat, tickets or this repository.
- Put the new value in the password-manager vault first, then in Vercel (Project → Settings → Environment Variables: Production, and Preview if it has one), then in `platform/.env.local` if that uses it.
- Vercel only applies changed variables to NEW deployments: redeploy production (Deployments → the current one → Redeploy) after each change.
- Revoke the old value only after the new deployment is verified, and then confirm the old value fails.
- Write the date (never the value) in the log at the end of this document.

### Stripe live secret key (`STRIPE_SECRET_KEY`)

1. Replace: Stripe Dashboard (live mode) → Developers → API keys → secret key → **Roll key**, choosing an expiry for the old key (for example 12 hours) so the running site keeps working during the switch.
2. Environment: `STRIPE_SECRET_KEY` in Vercel Production. `.env.local` should hold a TEST key (`sk_test_…`), never the live one.
3. Deploy: redeploy production.
4. Verify: as an admin, open Admin → Billing (or a customer's billing page) - it reads from Stripe; Stripe Dashboard → Developers → Logs shows the requests made with the new key. Do not create a real checkout or charge.
5. Revoke: when verified, expire the old key now (API keys → the rolled key → Expire). It must then appear as expired.
6. Clean up: remove the old key from `env data.txt` and anywhere else it was written.

### Stripe live webhook secret (`STRIPE_WEBHOOK_SECRET`)

1. Replace: Developers → Webhooks → the production endpoint (`https://www.repget.com/api/stripe/webhook`) → **Roll secret**, keeping the old secret valid for a while (up to 24 hours). While both are valid Stripe signs each event with both, so the site accepts events throughout.
2. Environment and deploy: `STRIPE_WEBHOOK_SECRET` in Vercel Production, redeploy.
3. Verify: the endpoint's event deliveries show 200 for events after the redeploy. To check at once, **Resend** an event that was already delivered successfully: the app records event ids, so a replay changes nothing and must return 200.
4. Revoke: expire the old secret in the same screen. Clean up as above.

### DataForSEO (`DATAFORSEO_LOGIN`, `DATAFORSEO_PASSWORD`) - known exposed

1. Replace: sign in at app.dataforseo.com as the owner → **API Access** → change the API password. This invalidates the exposed one immediately, so do steps 2-3 right after.
2. Environment and deploy: `DATAFORSEO_PASSWORD` in Vercel (every environment that has it) and in `.env.local`; redeploy. `DATAFORSEO_LOGIN` does not change.
3. Verify without spending: `GET https://api.dataforseo.com/v3/appendix/user_data` with the new login and password is an account-information call, not a billed task, and must return `status_code` 20000. The same call with the old password must fail with 401.
4. Clean up: remove it from `env data.txt`. (Customer-facing text never names this provider - see the project rules.)

### Anthropic (`ANTHROPIC_API_KEY`), OpenAI (`OPENAI_API_KEY`), Resend (`RESEND_API_KEY`)

For each:

1. Replace: create a new key in the console (console.anthropic.com → API keys; platform.openai.com → API keys, scoped to the RepGet project; resend.com → API keys, "Sending access" limited to the sending domain). Name it with the date.
2. Environment and deploy: the variable in Vercel Production (and Preview), redeploy; `.env.local` too.
3. Verify without cost: Anthropic and OpenAI - `GET /v1/models` with the new key returns 200 (lists models; no tokens used). Resend - the next email the site sends (an invitation or password reset to an owner-controlled address) appears as delivered in Resend → Emails.
4. Revoke: delete (OpenAI, Anthropic: disable or delete) the old key; the same `GET /v1/models` with the old key must now fail with 401.
5. Clean up: remove them from `env data.txt`.

### Account passwords in `env data.txt` (including the admin login)

For each account: change the password in that service, turn on two-factor authentication where offered, and sign out other sessions. For the RepGet admin account, change the password while signed in and sign out other devices; if the same password was used anywhere else, change it there as well. Then remove the pair from the file. Verify by signing in with the new password and confirming the old one is refused.

### GitHub SSH key - verified still registered

1. Replace: make sure a replacement works first. If the ED25519 key above is this machine's, confirm it is loaded and protected (`ssh-add -l`), otherwise create one with a passphrase: `ssh-keygen -t ed25519 -C "imagestudiotv <year>"`, and add its `.pub` in GitHub → Settings → SSH and GPG keys.
2. Verify the replacement: `ssh -T git@github.com` greets `imagestudiotv`, and `git fetch` in `platform/` works.
3. Revoke: GitHub → Settings → SSH and GPG keys → delete the RSA key with fingerprint `SHA256:L97HiBECZ0dJgkOhlAjU2hP/FAY1eUZa/hVxKQucej0`. Also check each repository's Settings → Deploy keys for the same fingerprint, and any server's `~/.ssh/authorized_keys` it may have been added to.
4. Confirm: `https://github.com/imagestudiotv.keys` no longer lists it (compare fingerprints with `ssh-keygen -lf`).
5. Clean up: only then delete the `Git hub SSH key` folder - it is the only copy, so not before the replacement is proven.

### Relocation and cleanup

1. Move anything still needed from `env data.txt` into the vault. Delete the file only after every credential in it is rotated (above) and the vault copy is checked - then also from cloud sync, backups and the recycle bin.
2. Compare `platform/.env.local.bak` with `.env.local` (in an editor, not in a shared session); keep `.env.local`, delete the `.bak`. Keep local backups of env files in the vault, never as `*.bak` next to the code.
3. `db-backups/`: production dumps. Move them to encrypted storage (an encrypted volume or the vault's file storage) or delete those no longer needed for a restore; never next to the code. `*.dump` and `db-backups/` are now ignored by git as a backstop.
4. `stripe-ids-backup.json`: into the vault or a private operations folder.

### Lower priority (only in `.env.local` / `.env.local.bak`)

Rotate if the machine or those files were ever shared. Each has a caveat:

- `DATABASE_URL`, `DIRECT_URL`: reset the database password in Supabase, then update both variables in Vercel and `.env.local` at the same moment and redeploy; verify the site loads a signed-in page. `npm run check:db-security` (with `CHECK_DATABASE_URL`) confirms access afterwards.
- `SUPABASE_SERVICE_ROLE_KEY`: rotating Supabase's JWT secret also changes the anon key.
- `BETTER_AUTH_SECRET`: rotating signs everyone out. **If `CREDENTIALS_ENCRYPTION_KEY` is not set in an environment, stored credentials there are encrypted with `BETTER_AUTH_SECRET` (src/lib/crypto.ts falls back to it) - then the caveat below applies to it as well.** `npm run doctor` says which is in use.
- `CREDENTIALS_ENCRYPTION_KEY`: **never rotate it on its own.** It decrypts the CMS credentials stored in the database (WordPress, Ghost, webhook secrets, Google tokens), and src/lib/crypto.ts has no key versioning: changing it makes every stored credential unreadable. A rotation needs, first, a reviewed re-encryption job that decrypts each stored value with the old key and re-encrypts it with the new one in a transaction, tested on a restored copy of the database, with the old key kept in the vault until every value has been re-read successfully. That job does not exist yet.
- `INNGEST_SIGNING_KEY`: rotate in Inngest; set the old key as `INNGEST_SIGNING_KEY_FALLBACK` during the switch.
- `GOOGLE_CLIENT_SECRET`, `SENTRY_AUTH_TOKEN`, `PAYPAL_CLIENT_SECRET`: rotate in each console, update the variable, redeploy, verify (Google sign-in; a build uploads source maps; a PayPal sandbox/live API call from Admin), then delete the old one.

### Rotation log

Record only rotations that were done and verified (old value shown to fail). Dates only, never values.

| Credential | Rotated on | Old value verified dead on | By |
|---|---|---|---|
| (none recorded yet, 2026-10-12) | | | |

## Secret scans

### Secret scan, 2026-09-26 (release readiness): what each check covered

| Layer | Command | Coverage | Result |
|---|---|---|---|
| Working tree, tracked | `npm run check:secrets` | Current contents of 538 tracked files | nothing found |
| Working tree, all | `npm run check:secrets -- --all` | Also untracked, not-ignored files (628 in all) | nothing found |
| Staged content | `git diff --cached --name-only` | Nothing was staged, so there were no staged blobs to scan. The scanner reads the working-tree copy of staged files, not the index blob. | n/a (empty index) |
| History | The scanner's own patterns, applied to every added line of `git log --all -p` (a one-off script, not part of the repository) | 452 commits, 300,675 added lines, every local ref | nothing found |

Limits:

- These are pattern checks. A DataForSEO login and password has no distinctive format, and is only caught in env-style files (`…PASSWORD=`).
- Ignored files (`.env.local`, `.env.local.bak`) and files outside the repository were deliberately not opened.
- The remote was not scanned. Run gitleaks on a fresh clone of it to cover that.

### History

No rewrite is needed: no secret was found in any local ref. The local refs show an earlier history rewrite, whose backups are also clean. To be sure the remote (`origin`) holds nothing older than what was scanned, run gitleaks on a fresh clone of the remote.
