# Lifecycle emails

Automatic emails that keep customers informed about their account, billing,
articles and videos. Sent with Resend (`src/lib/email/send.ts`) and Inngest; no
other service. Every email exists in English, Spanish, French, Italian and
German (formal address), in the person's language: the one chosen in
Settings, else their browser's at sign-up, else English.

## Switching them on

They are **off** until an administrator switches them on: **Admin -> Emails**
(`/admin/emails`). Deploying sends nothing. While off nothing is sent and
nothing is logged; once on, they follow what happens from then on (plus
reminders still due, such as a free period ending tomorrow). The same page
shows what was sent, skipped (and why) and failed in the last 30 days.

Not affected by the switch: sign-in codes, invitations, feedback replies, the
administrators' own emails and the existing 1,000-views video email.

## The emails

| Email | Sent when | Type |
| --- | --- | --- |
| Welcome | Right after sign-up (Better Auth hook, `src/lib/auth.ts` -> `lifecycle-signup` job) | Essential |
| Setup reminder | 3 hours after sign-up, if the person still has no website (re-checked then; never for someone invited to a shared site) | Tips and reports |
| Free articles started | A website's subscription becomes `trialing` on its free articles (Stripe or PayPal) | Essential |
| Free period ends tomorrow | Hourly job: trialing, not cancelled, stored trial end within 24 hours (re-checked at send time) | Essential |
| Free period ended | `trialing` -> ended, without the customer having cancelled first | Essential |
| Welcome to your plan | The subscription's first payment of real money (Stripe `invoice.paid`, PayPal `PAYMENT.SALE.COMPLETED`) | Essential |
| Payment failed | The subscription becomes `past_due` / `unpaid`; once per billing period | Essential |
| Cancellation confirmed | Set to cancel at period end (with that date), or ended at once from a paid plan | Essential |
| Article live | An article goes live (publish job or WordPress plugin report), once per article, with its URL | Tips and reports |
| Article not published | Publishing fails for good (publish job's last retry, or the plugin reports a failure); at most one a day per website | Essential |
| Video passed 500 views | The daily video follow-up sees 500+ (and under 1,000) views; once per video | Tips and reports |
| Referral reward | Referral credits are added to the referrer (`convertReferral`) | Essential |
| Weekly summary | Monday 08:00 UTC, workspaces on a plan or free articles that published something that week; only non-zero real figures | Tips and reports |

Billing emails are decided in one place for both providers: after
`syncProviderSubscription` commits, from the row before and after the change
(`emailsAfterSubscriptionSync`). A subscription not attached to a website (a
deleted site, free articles replaced by a plan) emails nobody. Stripe may also
send its own receipts and failed-payment emails; ours link to the app's
Billing page.

## How it works

- `src/lib/email/lifecycle.ts` - `sendLifecycleEmail`: kill switch, then a
  **claim** (a `lifecycle_emails` row, unique on scope + kind + dedupe key,
  inserted before sending, so retries send once; a failed one is retried up
  to 3 times), the recipient (a person, or a workspace's owner), the
  preference, the send, the outcome. Never throws.
- `src/lib/email/lifecycle-copy.ts` - the words (5 languages) and templates.
  Which kinds are essential is fixed here (`ESSENTIAL`).
- `src/lib/email/lifecycle-triggers.ts` - one function per moment.
- `src/inngest/functions/lifecycle-emails.ts` - sign-up (welcome, wait, reminder),
  hourly (free period ending), weekly summary.
- Unsubscribe: every tips-and-reports email has a signed link
  (`unsubscribe-token.ts`, HMAC with `BETTER_AUTH_SECRET`, no expiry) to
  `/unsubscribe/<token>` and a one-click `List-Unsubscribe` header
  (`POST /api/email/unsubscribe`). Also a switch in **Settings -> Emails**.
  Stored in `email_preferences` (no row = everything on).
- Tables: migration `0082_lifecycle_emails`.

## Adding an email

1. Add the kind to `LIFECYCLE_KINDS` and `ESSENTIAL`, its data to
   `LifecycleEmail`, its words to `LIFECYCLE_COPY` in all five languages, and
   its case to `parts()` (`lifecycle-copy.ts`). `lifecycle-copy.test.ts`
   fails until every language has every sentence.
2. Add a trigger in `lifecycle-triggers.ts` that reads its facts from the
   database and calls `sendLifecycleEmail` with a dedupe key that makes it
   one of a kind (an id, a period, a week). Call it right after the thing it
   reports is recorded; never change what the caller does.
3. Add its label to `KIND_ADMIN` (`src/app/admin/emails/page.tsx`) and a row
   to the table above.
