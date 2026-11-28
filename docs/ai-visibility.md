# AI visibility check: engines, settings and cost

The weekly AI visibility check (`src/inngest/functions/check-geo.ts`) puts each of a website's questions
to the assistants this deployment is set up for, with web search on, a few times each, and stores the share
of answers that name the business. Code: `src/lib/geo/engines.ts` (which engines, which models, how many runs),
`src/lib/geo/assistants.ts` (the calls and the price of each answer).

## Which assistants are asked

An assistant is asked only when **both** are true:

1. its key is set (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GOOGLE_AI_API_KEY`), and
2. it is named in `GEO_ENGINES`.

With `GEO_ENGINES` unset or blank, **only Claude is asked**. `OPENAI_API_KEY` is already set in production for
pictures, so a key alone never starts ChatGPT (or its bill). Every page that names the assistants (home, pricing
FAQ, feature page, sign-in panel, method section, Copilot) is worded from the same list.

| Variable | Default | Meaning |
|---|---|---|
| `GEO_ENGINES` | `claude` | Assistants to ask, of those with a key: `claude`, `chatgpt`, `gemini` |
| `GEO_RUNS_PER_QUESTION` | `2` | Answers per question per assistant in one check (1-5) |
| `GEO_CLAUDE_MODEL` | `claude-haiku-5-5` | Claude model (the cheapest current Claude with the web search tool) |
| `GEO_OPENAI_MODEL` | `gpt-5-mini` | ChatGPT model (Responses API, `web_search` tool) |
| `GEO_GEMINI_MODEL` | `gemini-flash-lite-latest` | Gemini model (Google Search grounding) |
| `GEO_WEEKLY_CHECKS_PER_WEBSITE` | `3` | Checks per website in any 7 days, the Monday one included |

## Three set-ups and what they cost

These are estimates, not measurements. Each answer's real price is recorded in `usage_events`
(`metadata.purpose = 'geo_check_answer'`, with the engine, searches and tokens), so measure the real figure
from the first week's checks before quoting a margin. List prices were checked on 2026-11-28.

| Option | Env settings | Answers per question | $ per check (20 questions) | $ / site / month, 1 check a week | $ / site / month, cap of 3 a week |
|---|---|---|---|---|---|
| **A**: 3 engines x 3 runs, full models | `GEO_ENGINES=claude,chatgpt,gemini` `GEO_RUNS_PER_QUESTION=3` `GEO_CLAUDE_MODEL=claude-sonnet-5` `GEO_OPENAI_MODEL=gpt-5-mini` `GEO_GEMINI_MODEL=gemini-flash-latest` | 9 | about 8.70 | about 38 | about 113 |
| **B**: 3 engines x 2 runs, cheaper models (recommended) | `GEO_ENGINES=claude,chatgpt,gemini` (the rest are the defaults) | 6 | about 3.30 | about 14 | about 43 |
| **C**: Claude only x 3 runs | `GEO_RUNS_PER_QUESTION=3` `GEO_CLAUDE_MODEL=claude-sonnet-5` (`GEO_ENGINES` unset) | 3 | about 5.10 | about 22 | about 67 |

With no settings at all (Claude only, Haiku 5.5, 2 runs) a check is about $1.10 and a month about $5 a site.
C on the default Haiku 5.5 instead of Sonnet 5 is about $1.60 a check and $7 a month.

"1 check a week" is the Monday run alone (4.33 a month). The cap allows 3 checks a website in any 7 days, so the
last column is the most a customer pressing "Check again" can cost. A Scale plan with 50 questions costs 2.5 times
as much. ChatGPT is `gpt-5-mini` in both A and B: it already is OpenAI's low-cost tier, and `gpt-5-nano` is
not listed for web search in OpenAI's guide.

### What the estimate assumes, per answer

| Engine and model | Input tokens | Output tokens | Searches | Price per answer |
|---|---|---|---|---|
| Claude Sonnet 5 ($2 / $10 per M) | 25,000 (search results are billed as input) | 1,200 | 2 x $0.01 | $0.082 |
| Claude Haiku 5.5 ($0.10 / $0.50 per M) | 25,000 | 1,200 | 2 x $0.01 | $0.023 |
| ChatGPT gpt-5-mini ($0.25 / $2 per M) | 10,000 (search content billed as input) | 2,000 (with reasoning) | 1 x $0.01 | $0.017 |
| Gemini Flash ($0.75 / $3.75 per M) | 3,000 | 1,500 (with thinking) | 2 x $0.014 | $0.036 |
| Gemini 3.5 Flash-Lite ($0.30 / $2.50 per M) | 3,000 | 1,500 | 2 x $0.014 | $0.033 |
| Brand extraction, Claude Haiku 4.5 ($1 / $5 per M), once per answer | 2,000 | 300 | - | $0.004 |

Notes:

- The search fee is most of the price of a cheap model's answer, so the number of searches matters more than
  the model. Claude is capped at 3 searches an answer.
- Gemini 3 and newer bill every search query the model runs, with 5,000 free a month per Google project. B uses
  about 80 Gemini searches a check (about 350 a site a month), so the free allowance covers roughly 14 sites. The
  table does not subtract it.
- Google's Gemini Flash price doubles on 2027-01-01 ($1.50 / $7.50). That adds about $0.50 to a check on A.
- Claude Haiku 5.5 has a higher rate ($0.50 / $2.50) for prompts over 100K tokens. A search-heavy answer can
  reach that, which the per-answer cost in the code accounts for.
