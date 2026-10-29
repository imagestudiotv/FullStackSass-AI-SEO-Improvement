# Credits

One credit balance per workspace, spent across RepGet (client, 2026-10-26): "a credit system ... that you can purchase separately and spend for almost everything on the website", and later "everything can be purchased by credits now". Customers pay money for two things only, their plan and credit packs. Everything else is paid with credits.

Credits are on a ten-times scale since 2026-10-26 ("for plan credits we need 10x more than today"): plans give 250 / 700 a month where they gave 25 / 60, a pack holds 100 / 250 / 500 where it held 10 / 25 / 50 (same prices), and a backlink costs 10–100 where it cost 1–10. `drizzle/0076_credit_scale.sql` moved the plans and packs. Balances already held were not converted: there were no paying customers yet.

## Where credits come from

All of these are rows in `credit_ledger` (`lib/backlinks/credits.ts`). The balance is the sum of the rows, never a stored counter. None of them expire.

| Source | Ledger type | Notes |
|---|---|---|
| The plan, every month | `plan_grant` | Grow 250, Scale 700 (`scripts/seed-plans.mjs`). Granted lazily on the first page that shows the balance. |
| Daily credits | `daily_grant` | Admin → Credits, suggested 3. See below. |
| Trial daily credits | `daily_grant` | Admin → Credits, 15 (client, 2026-10-27), on a trial's first 3 days only. See below. |
| Credit packs | `purchase` | 100 / 250 / 500 credits for EUR 79 / 149 / 279, paid by card on Billing. |
| Referrals | `referral` | 200 credits when a referred business starts paying (`lib/referrals`). |
| Hosting a Partner Network link | `link_given` | The link's price, once it is verified live. |
| An administrator | `adjustment` | Admin → Organizations, up to ±10,000 at a time. |

### Daily credits (`lib/credits/daily.ts`)

A workspace with an active paid plan is given the `daily_free` setting's credits on each UTC day it **uses** RepGet: the first page that shows its credits that day (the sidebar is on every page) grants them, keyed `daily:<org>:<YYYY-MM-DD>` so a day is granted once however many pages load at once. A day without a visit gives nothing, which is the reason to come back. Once given they are ordinary credits: they never expire and pay for anything, backlinks included (client: "they are not expire at midnight, but stays forever").

Failed payments and workspaces without a plan get none, as for the monthly credits. 0 turns them off.

**On a trial** (the free articles, client 2026-10-27: "15 a day... the 4th day the free credit is not given") the workspace gets the `trial_daily_free` setting instead, on each of the trial's first `TRIAL_CREDIT_DAYS` (3) days it uses RepGet, keyed `daily:<org>:trial-<1..3>`. The days are whole 24-hour days from the trial's start (the subscription's `current_period_start`), so a trial started at 23:00 still gets three grants, never four. From day 4 nothing is given until the plan starts; the free articles carry on for their 30 days as before. Once the plan is active the paid `daily_free` applies. A trial may also run the website check (the first is free; running it again costs its price) - AI visibility and backlinks still wait for the plan.

The pricing pages and the plan step show the difference side by side (`components/trial-comparison.tsx`), with the numbers read from these settings.

## What credits buy

| What | Price | How it is charged |
|---|---|---|
| A backlink from the Partner Network | 10–100 per link, set by the administrator who places it (`lib/backlinks/managed.ts`) | Reserved when placed, charged (`link_received`) only once the link is seen live (`lib/backlinks/placements.ts`). |
| Running the website check again (`audit_rerun`) | Admin → Credits (suggested 5) | Charged when the check is requested; the first check of a website is always free. Refunded if the check fails or its job can never be delivered. |
| Top 250 live USA Local Citations | `addons.credit_price`, Admin → Credits (250) | Bought on Billing with credits (`buyAddonWithCredits`); the administrators are emailed and deliver it by hand. |
| We fix the errors for you | A quote; `credit_price` (190) is the "from" figure | Requested from Billing; the administrator quotes in credits and, once the customer agrees, takes them with an adjustment in Admin → Organizations. |

The customer sees the list on **/credits** ("What credits are for"), the price on the "Check again" button once it is not free, and the services with their credit prices on **Billing**.

Card checkout (`buyAddon`) sells credit packs only, so a service's old Stripe price is never used again. `npm run stripe:setup` creates prices for credit packs only, and renames a pack's Stripe product when its name changed ("10 link credits" → "100 credits").

### Adding a priced action

1. Add its key to `CREDIT_ACTIONS` in `lib/credits/prices.ts`, with an admin label (`ACTION_ADMIN`) and a ledger note (`ACTION_NOTES`).
2. Name it in `app.credits.actions` and `app.credits.actionHelp` in all five languages (`lib/i18n/messages.ts`).
3. Charge it with `spendCredits(tx, { organizationId, action, key, websiteId })` **inside the transaction that records the work** — for a job, the `write` callback of `reserveAndQueue` (`lib/jobs/outbox.ts`), as `startAudit` does. `organizationId` is the website owner's (`ownerOrgId`), never an invited editor's.
4. Put the key in the job's data as `creditSpendKey`. The outbox refunds it if the job can never be delivered; refund it yourself (`refundSpend(key)`) wherever the job fails without doing the work.

A service is not an action: give its add-on row a `credit_price` (Admin → Credits) and it is on sale.

## How a spend is paid (`lib/credits/spend.ts`)

`chargeCredits` takes a price from what the workspace has **available**: the balance less the credits held for backlinks being placed. If that cannot cover it, nothing is written and the customer is told what it costs and what they have. Otherwise it writes a `credit_spends` row (what was bought, the price, the idempotency key) and a negative `spend` ledger row, in the caller's transaction. `spendCredits` is the same for an action, at its price in Admin → Credits; a price of 0 writes nothing.

Every spend takes the workspace's credit lock (`pg_advisory_xact_lock(hashtext('credits:<org>'))`), the same lock backlink reservations take, so two spends, or a spend and a reservation, can never both pass on the same credits. A key used twice charges once.

**Refunds** (`refundSpend`): the whole price comes back as a `spend_refund` ledger row, once.

## Screens

- **/credits** (sidebar → Credits): available credits, today's daily credits, credits reserved for links, the balance, what credits are for (actions and services), where they come from, and the history (every ledger row). The workspace's own; someone who owns no website is told that shared websites use their owner's credits. The old Backlinks → Credit activity page redirects here.
- **Sidebar**: the available credits, and "+3 today" once today's daily credits are given.
- **Billing → Add-ons**: credit packs by card; services for credits, with a second click that names the price; quotes with their "from" price in credits; purchases show what they cost in credits or money.
- **Admin → Credits**: daily credits and trial daily credits (0–100 each), each action's price (0–1,000) and each service's price (0–100,000; 0 takes it off sale), saved together and recorded in the audit log as `credits.settings_saved`; and what each action and service earned in the last 30 days.

## Setup

1. Apply the migrations before deploying the code: `0075_credit_spends` (the `credit_settings` and `credit_spends` tables, `addons.credit_price`, `addon_purchases.credits_paid`) and `0076_credit_scale` (plans 250 / 700, packs 100 / 250 / 500, the services' credit prices).
2. Run `npm run stripe:setup` so the packs' Stripe products are renamed to "100 credits" etc. (their prices do not change).
3. In Admin → Credits set the daily credits (3), the trial daily credits (15) and the price of running the check again (5). Until then they are off.

## Waiting for the client

- The Refunds and Terms pages still speak of "link credits" ("Unused link credits are not refunded for cash - they are part of your plan rather than a separate purchase"). They are legal text, so the wording is the client's to change.
