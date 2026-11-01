# AI chat ("Ask RepGet")

Client decisions of 2026-10-31. A chat on the Home page (Dashboard), above the task list, which stays. The customer asks about their website and RepGet answers from the website's own data. It can also **do things**, each only after the customer presses **Confirm** on a card that shows the price. This follows Shopify Sidekick and Ask Ahrefs: answers grounded in the workspace's data, links to the page where you act, and no change without approval.

| Step | What happens | Where |
|---|---|---|
| Ask | The question is stored. It is one of the workspace's **5 free messages a day** (UTC), then costs `chat_message` credits each (Admin → Credits, client: 1). A per-workspace lock stops two messages sent at once from both using the last free one. | `lib/chat/actions.ts` `sendChatMessage`, `lib/chat/quota.ts` |
| Answer | Claude (`MODELS.GENERATION`) with RepGet's data as tools, at most 8 model calls per answer. Tool results go in `<site_data>` blocks: titles, queries and discussion excerpts are material, never instructions (`lib/ai/untrusted.ts`). Answers are in the customer's language (en, es, fr, it, de). | `lib/chat/engine.ts`, `lib/chat/tools.ts` |
| No answer | If the model fails or returns nothing, the message is removed and a paid one's credit returned: an unanswered question is never counted. | `sendChatMessage` |
| Offer | `propose_*` tools only create a card. Each proposal is checked first (the idea, article or task must belong to this website); at most 3 per answer. | `lib/chat/actions-catalog.ts` |
| Confirm | Runs once (a `proposed` → `running` claim), through the **same server action as the feature's own page**, so the same checks (editor, plan, credits, rate limits) and price apply. | `confirmChatAction` |
| History | Each person sees only their own chats about the website. Chats are deleted 30 days after their last message (`chat-cleanup-daily`, 03:30 UTC). | `lib/chat/store.ts`, `inngest/functions/chat.ts` |

## What it can look up

`get_overview` (Dashboard figures and the task list), `get_search_performance` (Google Search Console and Analytics, 7/28/90 days), `get_losing_traffic`, `get_articles` (articles and the plan), `get_website_health`, `get_ai_visibility`, `get_backlinks`, `get_social`, `get_videos`, `get_credits` (owner only). Each answer shows up to 3 "Open" buttons for the pages it used. Links written in the answer only work when they point inside RepGet (`components/chat/chat-markdown.tsx`); the answer is rendered as React elements, never as HTML.

## What it can do (after Confirm)

| Action | Runs | Price |
|---|---|---|
| Add topics to the planned articles | `addKeywords` | part of the plan's monthly articles |
| Write a planned article now | `generateFromCalendarItem` | one of the plan's monthly articles |
| Run the website check again | `startAudit` | `audit_rerun` (the first check is free) |
| Find new social media suggestions | `findSocialSuggestions` | free (posting costs, on the Social page) |
| Make a video from one of today's ideas | `approveVideoIdea` | `video_post` |
| Write today's video ideas | `requestVideoIdeas` | free |
| Hide a task for 7 days | `snoozeNextAction` | free |
| Get backlinks to a page of the website | `addTarget` | free |

## Who can use it

Owners and editors of the website, with a paid plan or the free-articles trial (client: trials get the chat, with the same 5 free messages). A viewer sees a note instead: messages spend the owner's credits.

## Costs

About 1–4 US cents a message on the Claude API (system prompt and tools are cached). Each answer is recorded in `usage_events` (`purpose: chat`).

## Setup

- Migration `0080_chat` (tables `chat_threads`, `chat_messages`, `chat_actions`).
- After deploying: resync Inngest (one new function, `chat-cleanup-daily`), and set Admin → Credits **"AI chat message"** to 1. An unset price is free.
- `ANTHROPIC_API_KEY` (already set for the rest of RepGet).
