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
| Fingers crossed (free period, day 2) | Hourly job: trialing on its free articles, not cancelled, started 24-48 hours ago (re-checked at send time); "{domain} has started its journey with RepGet" plus its first real figures (articles written, articles live, topics planned - only non-zero ones); once per subscription | Tips and reports |
| Free period ends tomorrow: continue growing | Hourly job: trialing, not cancelled, stored trial end within 24 hours (re-checked at send time). The billing facts (end date, plan starts and first payment is taken, change or cancel in Billing before then) plus "Continue growing with RepGet": a blog post about the business, a mention on RepGet's social channels, a dofollow link from a DR 60+ site | Essential |
| Free period ended | `trialing` -> ended, without the customer having cancelled first | Essential |
| Welcome to your plan | The subscription's first payment of real money (Stripe `invoice.paid`, PayPal `PAYMENT.SALE.COMPLETED`) | Essential |
| Payment failed | The subscription becomes `past_due` / `unpaid`; once per billing period | Essential |
| Cancellation confirmed | Set to cancel at period end (with that date), or ended at once from a paid plan | Essential |
| Article live | An article goes live (publish job or WordPress plugin report), once per article, with its URL | Tips and reports |
| Article not published | Publishing fails for good (publish job's last retry, or the plugin reports a failure); at most one a day per website | Essential |
| Video passed 500 views | The daily video follow-up sees 500+ (and under 1,000) views; once per video | Tips and reports |
| Referral reward | Referral credits are added to the referrer (`convertReferral`) | Essential |
| Weekly summary | Monday 08:00 UTC, workspaces on a plan or free articles that published something that week; only non-zero real figures | Tips and reports |
| Win-back offer | About 2 days after a subscription the customer LEFT has ended (a free period cancelled or ended without a plan, a paid plan set to cancel, or ended at once from active; never an unpaid plan ended by the provider) - queued by `emailsAfterSubscriptionSync`, sent by the `lifecycle-winback` job after re-checking that it is still ended and the owner has no subscription running anywhere; once per PERSON ever. 20% off the first payment of a restarted Launch/Grow/Scale plan plus 100 credits after that payment (see below). Only while `WINBACK_OFFER_ENABLED=1` | Tips and reports |

Billing emails are decided in one place for both providers: after
`syncProviderSubscription` commits, from the row before and after the change
(`emailsAfterSubscriptionSync`). A subscription not attached to a website (a
deleted site, free articles replaced by a plan) emails nobody. Stripe may also
send its own receipts and failed-payment emails; ours link to the app's
Billing page.

## The win-back offer

`src/lib/billing/winback-offer.ts` (rules), `src/lib/billing/winback.ts` (credits).
RepGet has no pause feature, so "leave or pause" means a subscription that ended.

- **Discount**: 20% off the first payment of a restarted Launch, Grow or Scale
  plan, monthly or yearly; never the Grow + Visibility bundle. Applied by the
  server at checkout (`automaticOffer` in `src/lib/billing/checkouts.ts`) for an
  account one of whose owners was **sent** the win-back email; one use per
  account (a completed checkout carrying `offer: "WINBACK"`), never stacked:
  an account still eligible for REPGET gets REPGET (40%, bigger) instead and the
  20% is not applied (the 100 credits still are, below); a checkout carrying either has no promotion-code box,
  so no partner code on top. Stripe: coupon `WINBACK20` (20% off, once,
  Launch/Grow/Scale products), made by `scripts/stripe-setup.mjs`. PayPal: the
  REPGET offer plans' intro cycle, priced per subscription at 80%; a plan
  without offer plans is card-only for it, as for REPGET.
- **Credits**: 100 credits when that restarted plan's first payment for money
  goes through (Stripe `invoice.paid`, PayPal `PAYMENT.SALE.COMPLETED`), through
  the credit ledger with the key `winback-bonus:<userId>`: once per person, safe
  under retried or simultaneous webhooks. Also when REPGET won at checkout: a
  plan restarted with REPGET, by an account whose owner was sent the win-back
  email BEFORE that checkout, gets the 100 credits too (the email promised
  them). That restart uses the win-back up: no win-back discount afterwards.
- **Switch**: `WINBACK_OFFER_ENABLED=1`. Off, the email is not sent and no
  checkout carries the coupon. Turn it on only after `WINBACK20` exists in Stripe.
- Billing and the onboarding plan step say "Welcome back: 20% OFF applied" while
  it applies (`WINBACK_OFFER_CODE`, `src/lib/i18n/offer-code.ts`).

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
  win-back (wait 2 days, then send),
  hourly (free period day 2, free period ending), weekly summary.
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
