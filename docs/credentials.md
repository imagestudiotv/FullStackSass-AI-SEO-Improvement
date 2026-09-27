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
| Vercel | `VERCEL_OIDC_TOKEN` (short-lived, written by `vercel env pull`) | |
| Crisp | | `NEXT_PUBLIC_CRISP_WEBSITE_ID` |

`npm run doctor` checks that the variables the app needs are set, without printing them.

## Checks

- `npm run check:secrets` scans tracked and staged files for high-signal credential patterns (Stripe, private keys, database URLs with passwords, Anthropic, OpenAI, Google, Inngest, Sentry, Resend, AWS, GitHub, Slack, JWTs, and `…SECRET=`/`…PASSWORD=` assignments in env-style files). It prints **file, line and kind**, never the matched text. It exits 1 on a finding.
- `npm run check:secrets -- --all` also scans untracked files that are not ignored.
- `.github/workflows/secret-scan.yml` runs the scan on every push and pull request.
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

## Relocation, cleanup and rotation plan

The owner carries these out. Nothing here has been done automatically: no file was moved or deleted, and no credential was rotated or revoked.

### 1. Rotate first: exposed outside a secret store

| Credential | Where to rotate | Then |
|---|---|---|
| Stripe **live** secret key | Stripe Dashboard → Developers → API keys → Roll key (choose an expiry for the old one) | Update `STRIPE_SECRET_KEY` in the host environment and redeploy. Confirm checkout and webhooks. |
| Stripe live webhook secret | Stripe Dashboard → Developers → Webhooks → the endpoint → Roll secret | Update `STRIPE_WEBHOOK_SECRET` and redeploy. |
| DataForSEO password | DataForSEO account → API access → change password | Update `DATAFORSEO_PASSWORD` locally and in the host. |
| Account logins in `env data.txt`, including the admin login | Each service's password settings | Turn on two-factor authentication wherever it is offered. |
| Anthropic, OpenAI and Resend keys (in the notes file and `.env.local`) | Each provider's console: create a new key, deploy it, then revoke the old one | Update `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `RESEND_API_KEY`. |

### 2. Relocate and clean up

1. Copy anything still needed from `env data.txt` into a password-manager vault. Then delete the file, including any copy in cloud sync, backups or the recycle bin.
2. SSH key. Check GitHub → Settings → SSH keys, and each repository's Deploy keys, for this key's fingerprint (`ssh-keygen -lf "Git hub SSH key/id_rsa.pub"`).
   - If it is registered: create a new key with a passphrase (`ssh-keygen -t ed25519`), register it, remove the old one from GitHub, then delete the `Git hub SSH key` folder.
   - If it is not registered: delete the folder.
3. Once `.env.local` is confirmed correct, delete `platform/.env.local.bak`.
4. Move `stripe-ids-backup.json` into the vault or a private operations folder. It holds customer-linked identifiers rather than secrets.

### 3. Rotate if the machine or those files were ever shared (lower priority)

These are only in `.env.local`. Each rotation has a caveat:

- `DATABASE_URL`, `DIRECT_URL` (Supabase database password): reset in Supabase, then update both variables everywhere at the same moment.
- `SUPABASE_SERVICE_ROLE_KEY`: rotate the JWT secret in Supabase. This also changes the anon key.
- `BETTER_AUTH_SECRET`: rotating it signs everyone out.
- `CREDENTIALS_ENCRYPTION_KEY`: **do not rotate on its own.** It decrypts the CMS credentials stored in the database, so it needs a re-encryption step first.
- `INNGEST_SIGNING_KEY`: rotate in Inngest. Set the old key as `INNGEST_SIGNING_KEY_FALLBACK` during the switch.
- `GOOGLE_CLIENT_SECRET`, `SENTRY_AUTH_TOKEN`, `PAYPAL_CLIENT_SECRET` (sandbox): rotate in each console and update the variables.

### DataForSEO rotation: status BLOCKED (owner action)

Not rotated. Changing the DataForSEO API password needs the account's dashboard login, and nobody authorized using it. An API credential in `.env.local` is not authorization to change the account. The exposed value was never re-read to check anything.

Owner steps, in order:

1. Sign in at app.dataforseo.com. Under **API Access**, change the API password. That invalidates the exposed one.
2. Put the new value in `DATAFORSEO_PASSWORD`:
   - in Vercel, for every environment that has it (Production, Preview, Development), then redeploy;
   - in `platform/.env.local`.

   `DATAFORSEO_LOGIN` does not change.
3. Verify without spending anything. `GET https://api.dataforseo.com/v3/appendix/user_data` with the new login and password is an account-information call, not a billed task, and it must return `status_code` 20000. The same call with the old password must now fail with 401.
4. Record the date of the rotation here. Do not record the value.

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

### 4. History

No rewrite is needed: no secret was found in any local ref. The local refs show an earlier history rewrite, whose backups are also clean. To be sure the remote (`origin`) holds nothing older than what was scanned, run gitleaks on a fresh clone of the remote.
