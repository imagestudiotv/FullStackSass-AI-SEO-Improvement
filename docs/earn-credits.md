# Earn Credits

Client design 2026-11-02. A page of its own, `/earn-credits`, opened from **Earn Credits** at the bottom of the sidebar. It replaced the referral card on Settings, which now only links to the page.

## What the page has

| Part | Where it comes from |
|---|---|
| Referral artwork, code, link and Copy | `lib/referrals` (unchanged rules) |
| Daily credits card and check-in | `lib/credits/daily.ts`, claimed by the customer: see docs/credits.md |
| Share kit | `share-kit.tsx`, `lib/earn/share-templates.ts`, `lib/i18n/earn-share.ts` |
| Four more ways to earn | `lib/earn` (reviewed by the team) |
| Referral activity and list | `getReferralSummary` |
| "Were you recommended by someone?" | `enterReferralCode`, shown only to a workspace that is not referred and never paid |
| FAQ | `lib/i18n/earn.ts` |

## Share kit

Client design 2026-11-05. A ready-made message for LinkedIn, Facebook, X, WhatsApp and Email, with the reader's own referral link (`/r/<code>` on the production domain, from `getReferralSummary`). The text is editable per platform, and switching platform keeps the edits; Reset restores that platform's template. Each template says the author may receive RepGet credits, as the claim rules ask, and claims no result or experience.

- **Limits**: LinkedIn 3,000, Facebook 63,206, X 280 (a link counts as 23, wide characters as 2, as X counts them), WhatsApp 65,536, Email none. Over the limit, Copy & Open is disabled and the reader is told by how much. Taking the link out of the text brings a warning.
- **Copy & Open**: copies the text, then a real link opens the platform, URL-encoded. X, WhatsApp and Email open with the text filled in (mail line breaks are CRLF). LinkedIn and Facebook accept only a link, so the reader pastes the copied text; so do WhatsApp and Email when the message is too long for an address.
- **When the browser refuses to copy**: the kit says so, selects the text and says what to press. The code and link do the same in a field of their own.
- **It posts nothing and credits nothing.** The kit reaches only the clipboard and an address: no server action, no route. RepGet cannot know whether anything was posted, so no wording says it was. Credits still come only from a referral's first real payment and from a claim the team approves.

The artwork (`public/images/earn/referral-invite.webp`, from the client's design) has English words and "+100" drawn into it. It is shown only while `REFERRAL_REWARD_CREDITS` is 100.

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
