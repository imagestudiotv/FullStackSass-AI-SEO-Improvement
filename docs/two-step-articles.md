# Two-step articles

Client request 2026-11-02: "Only 2 clear steps. 1. We receive the articles on the admin dashboard and do our work (editing, adding backlinks). 2. The client sees a ready version to publish."

The flow sits behind one switch: **Admin → Network → Operations → Two-step articles**. It is off after a deploy, so nothing changes until an operator turns it on, as with managed review.

## With the switch on

1. **The team.** Every new draft goes to the review queue (`/admin/network`). That covers every website, Partner Network or not, and the free articles of new customers too. A new customer's first article is marked **First article** and listed first. Articles whose sources are flagged are marked **Check sources**, and the review page shows the sources and their warnings. The team edits, places links, and approves once.
2. **The customer.** The team's approval covers the sources, so the customer is never asked to approve them. When the customer publishes it themselves, they get a bell notification: "Your article is ready to publish". Their own later edits keep the approval. The exception is an edit that removes a placed Partner Network link: that article goes back to the queue, because another customer's credits are reserved against that link.

Turning the switch on also moves drafts that were still waiting for a customer's source approval into the team's queue (`activateTwoStep`).

## With the switch off

Behaviour is exactly as before. Only Partner Network websites wait for the team, and only with managed review on. Customers approve flagged sources themselves, and any edit after approval goes back to review.

## Code

- `lib/publishing/controls.ts`: the `two_step_articles` control and `activateTwoStep`.
- `lib/articles/review.ts`:
  - `twoStepArticles()`.
  - `reviewStatusForNewDraft`, which with the switch on returns pending for every draft.
  - `followCustomerEdit`, which replaces `syncApproval` in the customer's article and image saves.
- `lib/backlinks/managed.ts` (`approveArticle`): with the switch on, the approval also stamps the research approval.
- Tests: `lib/articles/two-step.test.ts`.
