# Feedback

Customers and site visitors can send RepGet an idea, report a problem, or say anything else (client request, 2026-10-19). Administrators read it in **Admin → Feedback**, set its status, reply by email, and delete what is dealt with. Nothing is public, and there is no voting board.

## Where people send it

| Who | Where | Reply goes to |
|---|---|---|
| A signed-in customer | **Feedback** button in the dashboard header (a dialog) | their account address; they are not asked for one |
| Anyone | the form on the Contact page (`/contact#feedback`, every language), linked as **Send feedback** in the footer | the address they type |

The form has three parts:
- **What it is about:** Idea, Problem or Something else.
- **The message:** 10 to 5,000 characters.
- **Pictures (optional):** up to 5. They can be chosen (several at once), dropped onto the form, or pasted into the message, and each can be removed before sending.

The page it was sent from and the visitor's language go with it. Errors are shown in the page's language. The words are in `src/lib/feedback/copy.ts`, and a page passes only its own language's words to the browser.

## What happens when it is sent (`src/lib/feedback/send.ts`)

- **Checks:**
  - The type must be one of the three.
  - The message must be 10 to 5,000 characters, with at most 5 links.
  - The email address must be valid, and the name at most 100 characters.
  - The page is kept only if it is on repget.com.
- **Spam:**
  - A hidden field, `company`, is filled in only by bots.
  - A form sent less than 3 seconds after it appeared is treated as a bot.
  - Bots are told "thank you", and nothing is stored or emailed.
- **Limits:** these share the free tools' ledger (`spend_reservations`).
  - Per visitor: 5 an hour and 20 a day, by hashed IP.
  - Per signed-in customer: 10 a day.
  - Overall: 100 an hour.
  - The slots are marked used once the message is saved; a slot left "reserved" would be released after 6 hours, and the daily limit would forget it.
- **Pictures:**
  - A server action accepts 1 MB in all, so the pictures share 900 KB. When the form is sent, the browser shrinks each one to its share (`shrinkScreenshot`): one picture may use all 900 KB, five get a fifth each. It lowers the quality first, then the width (1,600, 1,200, then 900 px).
  - The server refuses more than 5 pictures, or more than 900 KB together, before reading them. It then re-encodes each picture as WebP, at most 1,600 px wide.
  - They are stored in the `feedback_screenshots` table (bytea, numbered 1 to 5 in the order added), never in the public picture bucket, because they may show someone's dashboard. They are deleted with the message.
- **Email:** every administrator (`ADMIN_EMAILS`) gets one with a link to the message. Its Reply-To is the sender, so a reply from the inbox reaches them directly.

## Admin → Feedback (`src/lib/admin/feedback.ts`, `src/app/admin/feedback`)

- **The list:**
  - Status tabs with counts: New (the default), Planned, Done, Won't do, All.
  - Type filters: ideas, problems, others.
  - 25 per page, newest first.
  - The Overview's needs-attention list counts **New feedback**.
- **A message:**
  - The full text, and the pictures, each served by `/admin/feedback/<id>/screenshots/<n>` and opening full size in a new tab. Those addresses are for administrators only; for anyone else they answer 404, like the rest of `/admin`.
  - The sender, the page, the language, and the customer's account and workspace.
  - The replies sent.
- **Status:** one click. Nothing is sent to the sender.
- **Reply:**
  - Emailed in the sender's language (`src/lib/feedback/reply-email.ts`), with their message quoted underneath. When the sender writes back, it goes to `SUPPORT_EMAIL`.
  - The reply can also move the message to Planned, Done or Won't do; the email then says so.
  - A reply is recorded (`feedback.replies`) only once the email has gone. If sending fails, nothing is saved and the page says why.
- **Delete:**
  - Only a message marked **Done** or **Won't do** can be deleted, so nothing still waiting for an answer disappears by mistake.
  - A confirmation comes first. The message, its pictures and its replies are then gone for good.
- **Audit log:** status changes, replies and deletions are recorded as `feedback.status_changed`, `feedback.replied` and `feedback.deleted`. A deletion keeps the sender's address, the type, the status, and how many pictures and replies it had; it does not keep the message.

## Setup

Migration `0061_feedback` creates the `feedback` table. Migration `0062_feedback_screenshots` creates `feedback_screenshots` and copies any screenshot sent before it into that table as picture 1. Both tables have row-level security on. **Apply each migration before deploying the code that uses it.**

`feedback.screenshot` and `feedback.screenshot_type` held a message's one screenshot before 0062, and the app no longer uses them. A later migration should copy any screenshot that arrived between 0062 and the deploy (the old code was still running then), and then drop both columns.

| Needed for | Variables |
|---|---|
| Emails to administrators | `RESEND_API_KEY`, `ADMIN_EMAILS` |
| Replies to senders | `RESEND_API_KEY`, `EMAIL_FROM`; answers go to `SUPPORT_EMAIL` |

Without email, messages are still stored and shown in Admin → Feedback, but replies are refused, saying why.
