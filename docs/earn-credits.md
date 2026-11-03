# Earn Credits

Client design 2026-11-02. A page of its own, `/earn-credits`, opened from **Earn Credits** at the bottom of the sidebar. It replaced the referral card on Settings, which now only links to the page.

## What the page has

| Part | Where it comes from |
|---|---|
| Referral code, link, Copy and Share (email, WhatsApp, LinkedIn) | `lib/referrals` (unchanged rules) |
| Daily credits card | `lib/credits/daily.ts` (automatic, nothing to claim) |
| Four more ways to earn | `lib/earn` (reviewed by the team) |
| Referral activity and list | `getReferralSummary` |
| "Were you recommended by someone?" | `enterReferralCode`, shown only to a workspace that is not referred and never paid |
| FAQ | `lib/i18n/earn.ts` |

## Rewards

| Way | Credits | Proof |
|---|---|---|
| Referral (first paid month) | 100 (`REFERRAL_REWARD_CREDITS`) | automatic on the first real payment |
| Share your story | 25 | text (80+ characters), link optional |
| Post about RepGet | 20 | public link |
| Create a quick tutorial | 40 | public link |
| Help improve RepGet | 10 | text (40+ characters) |

The figures are in `lib/earn/ways.ts`. A claim keeps the reward it was sent with.

## Review

- **Admin → Earn Credits** lists claims, waiting first.
- **Approve** adds the credits in the same transaction (ledger type `reward`, key `earn:<id>`), writes the audit log and notifies the customer. Two approvals at once credit once.
- **Decline** needs a reason. The customer sees it on the card and can send again.
- Each way pays once per workspace (partial unique index `earn_submissions_once_key`).
- Check that a public post or tutorial says the author may receive credits. Never decline a claim for being critical.

## Referral code typed in

`enterReferralCode` uses `attachReferral` with no click time, so the 30-day rule for a new workspace applies. Your own code and a second code are refused. The reward still waits for the referred workspace's first real payment.

## Database

Migration `0082_earn_credits`: the table `earn_submissions`.
