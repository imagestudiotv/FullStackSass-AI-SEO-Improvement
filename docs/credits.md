# Credits

One credit balance per workspace, spent across RepGet (client, 2026-10-26): "a credit system ... that you can purchase separately and spend for almost everything on the website", and later "everything can be purchased by credits now". Customers pay money for two things only, their plan and credit packs. Everything else is paid with credits.

Credits are on a ten-times scale since 2026-10-26 ("for plan credits we need 10x more than today"): plans give 250 / 700 a month where they gave 25 / 60, a pack holds 100 / 250 / 500 where it held 10 / 25 / 50 (same prices), and a backlink costs 10–100 where it cost 1–10. `drizzle/0076_credit_scale.sql` moved the plans and packs. Balances already held were not converted: there were no paying customers yet.

## Where credits come from

All of these are rows in `credit_ledger` (`lib/backlinks/credits.ts`). The balance is the sum of the rows, never a stored counter. None of them expire.

| Source | Ledger type | Notes |
|---|---|---|
| The plan, every month | `plan_grant` | Launch 250, Grow 250, Scale 700 (`scripts/plan-catalog.mjs`). Granted lazily on the first page that shows the balance. |
| Daily credits | `daily_grant` | Admin → Credits, suggested 3. Claimed by the customer's check-in. See below. |
| Trial daily credits | `daily_grant` | Admin → Credits, 15 (client, 2026-10-27), claimed on a trial's first 3 days only. See below. |
| Credit packs | `purchase` | 100 / 250 / 500 credits for EUR 79 / 149 / 279, paid by card on Billing. |
| Referrals | `referral` | `REFERRAL_REWARD_CREDITS` (100) when a referred business starts paying (`lib/referrals`). |
| Hosting a Partner Network link | `link_given` | The link's price, once it is verified live. |
| An administrator | `adjustment` | Admin → Organizations, up to ±10,000 at a time. |

### Daily credits (`lib/credits/daily.ts`)

**Manual since the client's ticket of 2026-11-05.** A workspace with an active paid plan can claim the `daily_free` setting's credits once per UTC day, with a deliberate check-in. Only `claimDailyCredits` writes them, called from the server action `claimDailyCreditsAction` (`lib/credits/daily-actions.ts`), which takes no arguments and uses the session's workspace (`requireOrg`), so a client cannot name another one. `readDailyStatus`, which `creditOverview` calls on every page that shows credits, only reports: eligible, amount, what the ledger holds today, whether a claim is open, when the next one opens, the streak and the days of the strip. **No page load, read, job or email gives daily credits.** Lazy monthly plan credits are a separate matter and are still granted on read.

The ledger's unique key `daily:<org>:<YYYY-MM-DD>` decides: of any number of simultaneous claims one inserts and the rest find its row, so tabs, double clicks and retries give credits once, and the result (claimed, already claimed, not eligible) comes from what the ledger holds. A grant made by the old automatic path on the day this ships has the same key, so it counts as claimed. No migration was needed.

A day without a check-in gives nothing and cannot be claimed later, which is the reason to come back. Once given they are ordinary credits: they never expire and pay for anything, backlinks included (client: "they are not expire at midnight, but stays forever").

Failed payments and workspaces without a plan get none, as for the monthly credits. 0 turns them off.

**On a trial** (the free articles, client 2026-10-27: "15 a day... the 4th day the free credit is not given") the workspace can claim the `trial_daily_free` setting instead, on each of the trial's first `TRIAL_CREDIT_DAYS` (3) days, keyed `daily:<org>:trial-<1..3>`. The days are whole 24-hour days from the trial's start (the subscription's `current_period_start`), so a trial started at 23:00 still gets three grants, never four. From day 4 nothing is given until the plan starts; the free articles carry on for their 30 days as before. Once the plan is active the paid `daily_free` applies. A trial may also run the website check (the first is free; running it again costs its price) - AI visibility and backlinks still wait for the plan.

The pricing pages and the plan step show the difference side by side (`components/trial-comparison.tsx`), with the numbers read from these settings.

**Who gets what is unchanged, and still waiting for the client's answer** (ticket, decision 4): paid plans get `daily_free`, a trial `trial_daily_free` on its first days, everything else nothing. Only how they are received changed.

**The streak and the strip** come from the stored `daily_grant` rows, never the browser.

- The streak counts consecutive **UTC calendar days** with a check-in, up to today, or up to yesterday while today's is still open. A paid key names its day. A trial's key names a trial day, 24 hours from the trial's start, which spans two calendar days, so a trial's claim records its UTC day in the row's `reference_id`. Trial rows from before claims have none and use `created_at`, which is UTC wall-clock in production; a local database in another time zone shifts only those old rows. Two trial days claimed on one calendar day count one day of streak, and a trial day claimed early followed by the next one claimed late can leave a calendar day empty and restart the streak, although no trial day was missed.
- On a paid plan the strip is seven days counted from the workspace's first paid check-in, starting again after the seventh. The calendar decides the position, so a missed day shows as missed. Only the strip cycles: the balance never resets and day 7 pays what day 1 pays.
- On a trial the strip is the trial's own three days, read from their keys, so it never promises a fourth.

**The next check-in** is the next UTC midnight on a paid plan, and the next 24-hour mark on a trial. Screens print it in UTC.

**Launchers** (`components/daily-claim.tsx`, on the Radix dialog): the sidebar's row and, on a phone, a chip in the top bar; a banner on the dashboard beside a site the reader owns, which stays once today's is claimed, with a disabled "Claimed today" from what the ledger holds; a button on Earn Credits and on /credits. None appears when there is nothing to claim: no plan, a failed payment, a trial past its days, an amount of 0, or a shared site, because there it would be a promise the server refuses. Earn Credits says why instead and links to the plans.

## What credits buy

| What | Price | How it is charged |
|---|---|---|
| A backlink from the Partner Network | 10–100 per link, set by the administrator who places it (`lib/backlinks/managed.ts`) | Reserved when placed, charged (`link_received`) only once the link is seen live (`lib/backlinks/placements.ts`). |
| Running the website check again (`audit_rerun`) | Admin → Credits (suggested 5) | Charged when the check is requested; the first check of a website is always free. Refunded if the check fails or its job can never be delivered. |
| Top 250 live USA Local Citations | `addons.credit_price`, Admin → Credits (250) | Bought on Billing with credits (`buyAddonWithCredits`); the administrators are emailed and deliver it by hand. |
| We fix the errors for you | A quote; `credit_price` (190) is the "from" figure | Requested from Billing; the administrator quotes in credits and, once the customer agrees, takes them with an adjustment in Admin → Organizations. |

The customer sees the list on **/credits** ("What credits can do": the four actions first, the backlink and the services behind "See all credit costs"), the price on the "Check again" button once it is not free, and the services with their credit prices on **Billing**.

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

- **/credits** (sidebar → Credits; laid out from the client's design of 2026-11-02): the available credits, with the balance and what backlinks hold, and **today's credits earned and used** (`creditToday` in `lib/credits/overview.ts`); what credits can do; the ways to earn more (daily credits, referrals and rewards → /earn-credits, top up → Billing → Add-ons, the same place as the sidebar's Buy credits); and the recent activity (every ledger row), 25 a page (`?page=`), filtered All / Earned / Spent (`?kind=`). The workspace's own; someone who owns no website is told that shared websites use their owner's credits. The old Backlinks → Credit activity page redirects here.
  - **Today** is the UTC day, the day daily credits are claimed on. **Spent** is every credit paid out plus what came back from a payment (`spend_refund`, a removed link's `refund`), so a video that could not be made sits beside its charge; **Earned** is every other credit that came in. "Used today" is the spent rows net of their refunds, never below 0.
- **Sidebar**: the available credits, the daily check-in, and "+3 today" (the amount the ledger holds) once today's has been claimed.
- **Billing → Add-ons**: credit packs by card; services for credits, with a second click that names the price; quotes with their "from" price in credits; purchases show what they cost in credits or money.
- **Admin → Credits**: daily credits and trial daily credits (0–100 each), each action's price (0–1,000) and each service's price (0–100,000; 0 takes it off sale), saved together and recorded in the audit log as `credits.settings_saved`; and what each action and service earned in the last 30 days.

## Setup

1. Apply the migrations before deploying the code: `0075_credit_spends` (the `credit_settings` and `credit_spends` tables, `addons.credit_price`, `addon_purchases.credits_paid`) and `0076_credit_scale` (plans 250 / 700, packs 100 / 250 / 500, the services' credit prices).
2. Run `npm run stripe:setup` so the packs' Stripe products are renamed to "100 credits" etc. (their prices do not change).
3. In Admin → Credits set the daily credits (3), the trial daily credits (15) and the price of running the check again (5). Until then they are off.

## Waiting for the client

- The Refunds and Terms pages still speak of "link credits" ("Unused link credits are not refunded for cash - they are part of your plan rather than a separate purchase"). They are legal text, so the wording is the client's to change.
