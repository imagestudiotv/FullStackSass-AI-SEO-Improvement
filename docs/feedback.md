# Feedback

Customers and site visitors can send RepGet an idea, report a problem, or say anything else (client request, 2026-10-19). Administrators read it in **Admin → Feedback**, set its status and reply by email. Nothing is public, and there is no voting board.

## Where people send it

| Who | Where | Reply goes to |
|---|---|---|
| A signed-in customer | **Feedback** button in the dashboard header (a dialog) | their account address; they are not asked for one |
| Anyone | the form on the Contact page (`/contact#feedback`, every language), linked as **Send feedback** in the footer | the address they type |

The form has three parts:
- **What it is about:** Idea, Problem or Something else.
- **The message:** 10 to 5,000 characters.
- **A screenshot (optional):** chosen, or pasted into the message.

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
- **Screenshot:**
  - The browser shrinks it before sending (`shrinkScreenshot`), because a server action accepts 1 MB in all.
  - The server rejects a file over 900 KB, then re-encodes the picture as WebP, at most 1,600 px wide.
  - It is stored in the `feedback.screenshot` column (bytea), never in the public picture bucket, because it may show someone's dashboard.
- **Email:** every administrator (`ADMIN_EMAILS`) gets one with a link to the message. Its Reply-To is the sender, so a reply from the inbox reaches them directly.

## Admin → Feedback (`src/lib/admin/feedback.ts`, `src/app/admin/feedback`)

- **The list:**
  - Status tabs with counts: New (the default), Planned, Done, Won't do, All.
  - Type filters: ideas, problems, others.
  - 25 per page, newest first.
  - The Overview's needs-attention list counts **New feedback**.
- **A message:**
  - The full text, and the screenshot, served by `/admin/feedback/<id>/screenshot`. That address is for administrators only; for anyone else it answers 404, like the rest of `/admin`.
  - The sender, the page, the language, and the customer's account and workspace.
  - The replies sent.
- **Status:** one click. Nothing is sent to the sender.
- **Reply:**
  - Emailed in the sender's language (`src/lib/feedback/reply-email.ts`), with their message quoted underneath. When the sender writes back, it goes to `SUPPORT_EMAIL`.
  - The reply can also move the message to Planned, Done or Won't do; the email then says so.
  - A reply is recorded (`feedback.replies`) only once the email has gone. If sending fails, nothing is saved and the page says why.
- **Audit log:** status changes and replies are recorded as `feedback.status_changed` and `feedback.replied`.

## Setup

Migration `0061_feedback` creates the `feedback` table, with row-level security on. **Apply it before deploying the code.**

| Needed for | Variables |
|---|---|
| Emails to administrators | `RESEND_API_KEY`, `ADMIN_EMAILS` |
| Replies to senders | `RESEND_API_KEY`, `EMAIL_FROM`; answers go to `SUPPORT_EMAIL` |

Without email, messages are still stored and shown in Admin → Feedback, but replies are refused, saying why.
