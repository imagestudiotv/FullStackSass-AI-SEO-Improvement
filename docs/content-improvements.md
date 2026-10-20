# Article research, task models, and next actions

## Implemented behavior

1. **Research before writing:** one cached, localized DataForSEO organic search; up to six bounded, SSRF-safe page fetches, retaining up to four readable pages (at most two per publisher). A structured brief identifies intent, questions, business relevance, claims and exact supporting excerpts. Unsupported quotations are discarded, with a review warning; no usable claims means incomplete research. The outline and writer receive the brief. An additional evidence check looks for unsupported claims and citation mismatches. Sources and warnings appear beside the saved article.
2. **Models by task:** separate article-only routes for research, outline, body, evidence checking and image descriptions. The existing stronger outline/writer remain defaults; extraction-class models handle research and image descriptions. Evidence checking uses the stronger model: the live pilot found that the cheaper reviewer missed platform-specific advice presented as universal. Overrides do not change GEO, keywords or the marketing blog. Model experiments always require human review. Provider usage, cache tokens, latency, stop reason, prompt version and run/article IDs are recorded before parsing. Unknown usage/prices remain unknown rather than zero. Dated model IDs match their base model's price.
3. **Next actions:** prioritized connection problems, publishing failures, failed articles, research review, audit errors, traffic changes, manual drafts and search appearance opportunities. Tasks show evidence and direct destinations, can be postponed for seven days, and disappear when the underlying issue clears. Actions are tenant-scoped and editor-only. No AI requests occur when loading the dashboard.

Research and model experiments use the existing article allowance and entitlement checks. Completed Inngest steps are reused on normal retries. SDK retries are disabled for the article calls so the job owns visible retries. An ambiguous timeout can still have incurred provider charges; this is recorded as unknown usage, not promised to be exactly-once.

## Deployment and rollout

Migration `0067` was applied and verified on the shared database on 2026-10-20. The local production build now passes. Research remains off for customer sites while synthetic pilot results are reviewed; deployment verification is recorded below.

1. Apply `0067_article_research_and_next_actions` through the existing migration process before serving this build. It adds private evidence/review fields, reminder preferences, and Search Console import coverage. New tables have RLS enabled. Existing article review flags default to false.
2. Deploy with `ARTICLE_RESEARCH_MODE=off` initially. Task routing, actual-usage metering and next actions are available independently.
3. Run a normal Search Console import. Older imports do not have completeness records, so traffic recommendations wait for the first successful new import. A property change, disconnect, partial write, missing page, stale data or row-limit truncation must not be presented as measured traffic loss.
4. Set `ARTICLE_RESEARCH_MODE=pilot` and `ARTICLE_RESEARCH_WEBSITE_IDS` to selected website UUIDs. With an empty allowlist, the selected mode applies to every site. Configure the existing Anthropic and DataForSEO credentials.
5. Review a small representative set across customer industries and languages. Check factual support, relevance, editing time, retries, generation time and total cost. Keep human review enabled until results are acceptable.
6. Use `ARTICLE_RESEARCH_MODE=on` only after the pilot. Incomplete research, research warnings and failed/flagged evidence checks continue to hold publication. Setting the mode back to `off` affects new runs; it does not release existing held drafts.

Every publication path uses the shared research gate: first-article automatic release, scheduling, CMS connection, direct dispatch and plugin pickup. A website editor can approve the saved article through the research panel. Approval records the actor and a hash of the delivered fields. Subsequent changes invalidate that approval. Research approval never bypasses the independent Partner Network review.

## Model experiments

Optional variables:

```text
ARTICLE_MODEL_RESEARCH=
ARTICLE_MODEL_OUTLINE=
ARTICLE_MODEL_BODY=
ARTICLE_MODEL_EVIDENCE_CHECK=
ARTICLE_MODEL_IMAGE_SCENE=
ARTICLE_MODEL_BODY_SCENES=
```

An override holds newly generated articles for review. Verify candidate model support and pricing before a larger experiment. Usage-based USD amounts are estimates, not invoices; the defaults were checked against [Anthropic pricing](https://platform.claude.com/docs/en/about-claude/pricing) on 2026-10-20. Negotiated rates, regional premiums and provider billing reconciliation are outside these estimates.

The initial approach intentionally keeps the strong writer. Adding research has a cost; reducing editing and regeneration must be measured rather than assumed.

## Verification

Unit/integration tests use PGlite and mocked providers. Tests cover source provenance, safe fetching limits, citation checks, task isolation, usage and cache pricing, unknown spend, research failure, job-step replay, publication holds, stale approvals, tenant isolation, reminder expiry, traffic completeness and localized UI rendering.

The optional live pilot uses a disposable PGlite database, a synthetic business and actual paid Anthropic/DataForSEO calls. It creates no customer accounts, emails, CMS posts or production database rows. It compares:

- A: current outline/writer without research.
- B: the same writer with a research brief.
- C: the same brief and writer with a cheaper outline.

Run from the platform directory with the required provider credentials in the process environment:

```powershell
$env:REPGET_CONTENT_LIVE_PILOT = "1"
npx vitest run --config e2e/content/vitest.config.mts e2e/content/pilot.live.ts
```

The report is written to ignored `test-results/content-pilot/report.json`. The pilot caps call count and stops starting calls after its estimated-spend threshold; a request already started can exceed that threshold. Its single synthetic topic is a smoke test, not proof that a model is better across customer content. Human review is still required.

Set `REPGET_CONTENT_PILOT_CASE=coffee-es` to repeat the comparison for a synthetic Spanish coffee business. That report is saved separately as `coffee-es.json`. No customer records or publishing integrations are used by either case.

## Scope

Additional AI visibility engines are a separate feature. Article task routing does not claim to measure the consumer interfaces of ChatGPT, Gemini, or Perplexity.

## Verification record — 2026-10-20

- Final focused run: 75 tests passed across eight suites, including the generation pipeline, source validation, approvals, task reminders, dashboard rendering, analytics permissions and dispatch controls.
- Managed Partner Network regression suite: 50 tests passed.
- TypeScript and ESLint passed for the changed source.
- A live three-variant synthetic article trial completed. Initial estimated writing/checking costs were $0.0470 without research, $0.0887 with research, and $0.0625 with a cheaper outline; the latter two additionally share a $0.0120 research/search preparation cost when compared individually. These initial figures used the cheaper reviewer and therefore do not describe the final default configuration.
- Manual review found platform-specific guidance presented too broadly despite the cheaper reviewer's empty issue list. A separate live comparison with the stronger reviewer detected those issues in both drafts and passed a deliberate source-scope regression case. The writer/brief instructions were tightened and the stronger reviewer became the default. The existing stronger outline remains the default pending a broader quality comparison.
- Live artifacts are in ignored `test-results/content-pilot/`. These are synthetic examples, not customer work, and nothing was published.
- `npm run build` compiled and completed its TypeScript stage, then failed while prerendering the existing homepage because the shared Supabase connection timed out reading `plans`. No production migration or deployment was attempted. Database access and a successful full release build remain required before rollout.

## Release follow-up — 2026-10-20

- Both database connections became reachable. The applied migration history matched the repository through `0066`; only `0067` was pending. `npx drizzle-kit migrate` completed, and its stored hash, all five article fields, and RLS on both new tables were verified.
- The complete production build passed, including all 170 static page generation tasks. All 75 focused tests passed again; the CSP route check and secret scan also passed.
- A Vercel CLI dry run revealed that the upload did not inherit all Git exclusions. Added `.vercelignore` and verified that local environment backups and pilot reports are excluded before uploading.
- A fresh English trial used the final stronger evidence reviewer. Estimated text/search costs were $0.0497 for baseline, $0.1685 for researched writing, and $0.1445 for the cheaper-outline experiment. Each research variant includes the same $0.0140 preparation cost for comparison; this trial excludes images, hosting, human editing and further regeneration. The checker reported six issues in the default research draft and nine in the cheaper-outline draft. These are review findings, not independently adjudicated error counts.
- Source coverage was incomplete and both researched drafts remained review-required. This does not justify a broad research rollout or switching the outline to the cheaper model. The default outline/writer remain unchanged.
- The Spanish coffee-business comparison also completed. Estimated text/search costs were $0.0701 baseline, $0.1853 researched, and $0.1430 with the cheaper outline, including $0.0183 preparation for each research comparison. The checker reported three and five issues respectively. The source set included a social video without a readable transcript, so source selection needs further work before a broad rollout. Neither comparison measures human editing time or proves better final content.
- Release `7682279` was deployed to Vercel, verified before promotion, and promoted to `www.repget.com`. Production has explicit `ARTICLE_RESEARCH_MODE=off`; task routing, usage metering and next actions are live independently. The homepage, sign-in and database health returned 200; anonymous dashboard access redirected to sign-in; unsigned Inngest access returned 401.
- Triggered the normal analytics import for the one existing approved Search Console connection. A new completeness record was verified for 2026-08-18 through 2026-10-17.
- Browser checks on production used a temporary synthetic account and a database-only trial fixture with no payment-provider identifiers. The tested draft came from the live English trial and was inserted as a held draft for UI verification; this is not a claim that a production Inngest generation job was exercised. Postpone/restore, source disclosure, saved-version approval and renewed review after a saved edit all worked. No CMS was connected and nothing was published.
- Browser verification caught research holds using Partner Network wording. The correction distinguishes the review source in publishing, editing, rewriting and image-change notices. Four focused regression suites passed (45 tests), including the independent team-review case.

### Remaining rollout work

Improve source selection so primary documentation and usable text evidence are preferred over thin social pages and platform-specific tutorials. Then compare representative customer briefs with human review, editing time and full generation costs. Keep research off for customer sites until a deliberately selected pilot is ready; keep the stronger default outline and writer until the cheaper alternative meets the quality bar.
