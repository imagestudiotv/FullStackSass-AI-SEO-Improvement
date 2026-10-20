# Article research, task models, and next actions

## Implemented behavior

1. **Research before writing:** a small, metered planning call proposes one focused search for primary evidence using only the topic, keyword, language and country. Up to two cached, localized DataForSEO searches combine that query with the original keyword. Only returned URLs are fetched; the plan is not evidence. Up to six bounded, SSRF-safe page fetches retain at most four readable pages (at most two per hostname). Social/video pages without a supported text reader, sign-in destinations and recognizable access challenges are excluded. Article text is preferred over surrounding page chrome. A structured brief identifies intent, questions, business relevance, claims and exact supporting excerpts. Unsupported quotations are discarded, with a review warning; no usable claims means incomplete research. The outline and writer receive the brief. An additional evidence check looks for unsupported claims and citation mismatches, using the same saved business description and differentiators available to the writer alongside confirmed facts and services. It checks consistency with the profile, not independent truth of owner-supplied details. Sources and warnings appear beside the saved article.
2. **Models by task:** separate article-only routes for search planning, research, outline, body, evidence checking and image descriptions. The existing stronger outline/writer remain defaults; extraction-class models handle planning, research and image descriptions. Evidence checking uses the stronger model: the live pilot found that the cheaper reviewer missed platform-specific advice presented as universal. Overrides do not change GEO, keywords or the marketing blog. Model experiments always require human review. Provider usage, cache tokens, latency, stop reason, prompt version and run/article IDs are recorded before parsing. Unknown usage/prices remain unknown rather than zero. Dated model IDs match their base model's price.
3. **Next actions:** prioritized connection problems, publishing failures, failed articles, research review, audit errors, traffic changes, manual drafts and search appearance opportunities. Tasks show evidence and direct destinations, can be postponed for seven days, and disappear when the underlying issue clears. Actions are tenant-scoped and editor-only. No AI requests occur when loading the dashboard.

Research and model experiments use the existing article allowance and entitlement checks. Completed Inngest steps are reused on normal retries. SDK retries are disabled for the article calls so the job owns visible retries. An ambiguous timeout can still have incurred provider charges; this is recorded as unknown usage, not promised to be exactly-once.

Planning failure falls back to the original query. One search failure preserves the other search's results; both failing produces unavailable research. Each search independently rechecks entitlement and records spend. Planning adds at most one AI request, with a 1,000-token output limit, and one extra search. A known primary publisher becomes a `site:` query, with domain validation on the returned results. Readable secondary pages can also supply up to two actual links to that publisher; these share the same six-fetch limit, and primary pages are retained first. Community threads are deprioritized. Each hostname gets at most two attempts, and each page is limited to 4 MB after decompression and 12 seconds. The retained excerpt remains limited to 6,000 characters. The system never constructs article URLs from model memory.

Source ranking, a suggested publisher domain and readable text are not proof of credibility or factual correctness. DataForSEO charges more for search operators such as `site:`; its [documented multiplier](https://docs.dataforseo.com/v3/serp/google/organic/live/advanced/) is five times the ordinary task price. Actual provider-reported charges are recorded, including the targeted query, instead of assuming both searches cost the same.

## Deployment and rollout

Migration `0067` was applied and verified on the shared database on 2026-10-20. Research is deployed through an explicit website scope, with a review-required pilot before broader use. Historical trial and release results are recorded below.

1. Apply `0067_article_research_and_next_actions` through the existing migration process before serving this build. It adds private evidence/review fields, reminder preferences, and Search Console import coverage. New tables have RLS enabled. Existing article review flags default to false.
2. Deploy with `ARTICLE_RESEARCH_MODE=off` initially. Task routing, actual-usage metering and next actions are available independently.
3. Run a normal Search Console import. Older imports do not have completeness records, so traffic recommendations wait for the first successful new import. A property change, disconnect, partial write, missing page, stale data or row-limit truncation must not be presented as measured traffic loss.
4. Set `ARTICLE_RESEARCH_MODE=pilot` and `ARTICLE_RESEARCH_WEBSITE_IDS` to selected website UUIDs. An empty scope disables research. Exactly `*` explicitly selects all websites; a wildcard mixed with IDs does not widen their scope. Configure the existing Anthropic and DataForSEO credentials.
5. Review a small representative set across customer industries and languages. Check factual support, relevance, editing time, retries, generation time and total cost. Keep human review enabled until results are acceptable.
6. Use `ARTICLE_RESEARCH_MODE=on` only after the pilot. Incomplete research, research warnings and failed/flagged evidence checks continue to hold publication. Setting the mode back to `off` affects new runs; it does not release existing held drafts.

Every publication path uses the shared research gate: first-article automatic release, scheduling, CMS connection, direct dispatch and plugin pickup. A website editor can approve the saved article through the research panel. Approval records the actor and a hash of the delivered fields. Subsequent changes invalidate that approval. Research approval never bypasses the independent Partner Network review.

## Using the improvements

1. Confirm the business profile, services, audience, language and factual details in Business Settings and Article Settings.
2. Open Planned Articles. Selected websites show a notice explaining research and the publication hold. Generate a small set of representative topics through the normal article controls and allowance.
3. Open each completed article, expand **Research and sources**, inspect its source links and findings, and edit as needed. Save edits before using **Approve this saved version**. Approval clears the research hold for the saved revision; it does not itself deliver an article or bypass other publishing checks. Existing automatic publishing rules can release it after approval.
4. Use the dashboard's prioritized next actions. Open a task to resolve the underlying issue, or postpone it for seven days. A recent complete Search Console import is required for traffic comparisons.
5. Administrators can open **Content → Content performance** (`/admin/content-performance`) to see deployment rollout status, current task models, 30-day request costs/latency by model and prompt version, and recent article research findings. Access is checked before every report read. This page makes no provider calls.
6. Review the first articles for factual accuracy, usefulness and actual editing minutes. The report excludes image generation, other enrichment, hosting and human work; request latency is not end-to-end generation time. Unknown costs remain unknown. Do not claim savings or automatic factual correctness from these figures alone.

The report includes recorded retries and failures, limits the recent-article list to 20, and separates model/prompt versions. Earlier unmetered runs do not become zero-cost observations. Pilot notices are translated into the application's five supported languages.

## Model experiments

Optional variables:

```text
ARTICLE_MODEL_RESEARCH_PLAN=
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

Set `REPGET_CONTENT_PILOT_STAGE=sources` to stop after planning and retrieval, before synthesis or writing. These smaller checks write `<case>-sources.json`; the English case requires a readable Google help source. Full trials also apply that retrieval requirement before paying for article generation. The reports include search queries/results and retrieval outcomes so missing coverage can be investigated without guessing.

### Private business-profile comparison

Use a real saved profile and an explicitly selected planned calendar item without creating a production article:

```powershell
node scripts/content-pilot-snapshot.mjs WEBSITE_UUID CALENDAR_UUID customer-TOPIC-DATE
$env:REPGET_CONTENT_LIVE_PILOT = "1"
$env:REPGET_CONTENT_PILOT_INPUT = "test-results/content-pilot/customer-inputs/customer-TOPIC-DATE.json"
npx vitest run --config e2e/content/vitest.config.mts e2e/content/pilot.live.ts
node scripts/content-pilot-review.mjs customer-TOPIC-DATE.json
```

Use lowercase letters, digits and hyphens in the case name. The snapshot uses a read-only transaction and explicit columns; it checks that the planned item belongs to the selected website. It captures brand voice, verified business facts, topic instructions and article preferences. It does not read integration credentials, reserve backlink placements, edit the calendar, use customer allowance or create publishing events. Snapshot filenames cannot overwrite an existing export.

The paid harness validates the snapshot and runs against disposable PGlite with production database, email and payment credentials disabled. It creates A (the existing writer) and B (the same writer with research). Both receive the same stronger evidence check. The baseline's evidence check is evaluation overhead, reported separately from its normal generation cost. A citation missing from an unresearched draft is a coverage difference; automated findings are not adjudicated factual-error counts. Generation costs include the relevant preparation and evidence calls but exclude images, subsequent enrichment, hosting, retries and human editing. Call time is not full end-to-end generation time.

The HTML review contains the private drafts, preferences, source links, supported claims, warnings and cost breakdowns. Readers inspect the original pages through their links; full retrieved excerpts remain in the private machine-readable reports. It strips scripts, images and unsafe links and applies a restrictive CSP. Open `test-results/content-pilot/customer-review.html` locally; no server or login is required. All snapshots and reports remain under `test-results/`, excluded from Git and deployment uploads. Do not put these customer artifacts in `public/`.

To recheck saved drafts after an evidence-checker change without paying to regenerate them, set `REPGET_CONTENT_REVIEW_REPORTS` to one or two original customer report filenames, separated by a comma, and run `e2e/content/customer-review.live.ts` with the same opt-in config. It retains the original report and writes a revision-specific `-reviewed-vN.json`. The original evidence findings remain in `previousEvidence`; replacement check measurements are in `evidenceReplay`. Its small positive/negative probe tests acceptance of supplied business details and rejection of an invented award. The renderer accepts these reviewed filenames as well. Separate attempts remain separate reports; per-report totals are not a total of all experiments.

Record human factual corrections, business relevance, usefulness, required edits and actual editing minutes before selecting a winner. A successful harness run means the comparison completed, not that the drafts are approved. This offline pilot does not exercise the production Inngest job, generated images, CMS delivery or human editing.

### Compare a writing revision with identical research

Set `REPGET_CONTENT_REVISION_REPORTS` to one or two original customer report filenames, comma separated, and run:

```powershell
$env:REPGET_CONTENT_LIVE_PILOT = "1"
$env:REPGET_CONTENT_REVISION_REPORTS = "customer-TOPIC-DATE.json"
npx vitest run --config e2e/content/vitest.config.mts e2e/content/writing-revision.live.ts
node scripts/content-pilot-review.mjs customer-TOPIC-DATE-writing-v4.json
```

This creates a new outline and draft from the saved business brief and research, without new searches, database access or publishing. It rechecks the original researched draft and the revised draft with the same current evidence checker. The four-call comparison stops starting requests after $1 in known cost or an unknown-cost request; a call already started can exceed that threshold. A separate two-call probe checks that ordinary advice is accepted and an unsupported software citation is detected. Revision reports are created exclusively and never overwrite an earlier run.

Per-article estimates include the original preparation cost in both versions, even though preparation was reused without charge for this experiment. Additional experiment spend is shown separately. Human editing minutes remain unmeasured.

For ready research, outline/body prompts now receive compact evidence cards pairing claims with exact quotations and source URLs. Unused pages, the search brief's potentially broader question/subquestions and previous review verdicts are excluded from the writer context. The article title and intent control the structure. The quotation limits the claim; exact matching does not establish truth or semantic support. Optional keywords, table settings and product mentions cannot justify unsupported regional comparisons or product details. Where comparative facts are missing, tables can compare questions to ask each option. Outline points identify their basis as advice, business profile or a source ID; those labels must not appear in the final text. Adaptive articles can be shorter when evidence is limited, and advice must be distinguished from factual assertions.

Researched bodies use structured output containing a `bodyHtml` string. After sanitization, a fragment must contain HTML headings and paragraphs and no loose text outside its elements; Markdown/plain text is rejected before saving. Provider usage is recorded before this validation, so a failed response still counts toward actual spend. Normal generation without ready research retains its existing writing instructions and response format. The independent checker receives the full saved excerpts, but no prior quality verdict, and still requires human review of material findings.

For a separately corrected sample, preserve the generated report and add `editorialDraft.bodyHtml` and a `changes` list in a new private report. Set `REPGET_CONTENT_EDITORIAL_REPORTS` to one or two such filenames and run `e2e/content/editorial-review.live.ts` with the opt-in config. It sanitizes the draft, makes one evidence-check call per sample and writes an exclusive `-checked-vN.json` report. The check fails when findings remain, retaining the output for inspection. The HTML renderer labels the sample as an AI-assisted editorial edit, keeps the untouched generation comparison visible and reports the additional check as evaluation overhead. This path cannot grant production approval.

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
- Final application release: `e59728f`, Vercel deployment `dpl_8BUQNrehixStYfNnYKsfwqCaLt1S`, promoted to `www.repget.com`. Its production build passed; the final live health check returned `{ok:true, db:true}`. The corrected research-change message was verified in the production browser.
- Dashboard layout was visually checked in both themes. Screenshots are retained locally under ignored `test-results/content-pilot/`. The temporary user, workspace, website, trial fixture, drafts and reminders were deleted; a follow-up database check confirmed no test user or website remained.
- Application and release notes are committed locally. These releases used the Vercel CLI; no Git push was performed.

### Remaining rollout work

Compare representative customer briefs with human review, editing time and full generation costs. Keep research off for customer sites until a deliberately selected pilot is ready; keep the stronger default outline and writer until the cheaper alternative meets the quality bar.

## Source-selection follow-up — 2026-10-20

- Added bounded primary-source planning, hostname-filtered search results and discovery through actual links on readable pages. Excluded unsupported social/video shells, sign-in pages and recognizable access challenges; retained article text ahead of unrelated page chrome.
- The first repeated English trial showed that adding “official guide” to a query was insufficient. A focused retrieval probe also caught results outside the requested domain. Those results are now excluded from that query; the original localized query remains an independent fallback.
- A subsequent probe found the correct Google documentation but exposed the old 1.5 MB page limit. The normal safe fetcher could read it at a 4 MB limit. Two-attempt hostname limits prevent an inaccessible publisher from consuming all six fetches. The final retrieval probe successfully retained Google's own verification documentation ahead of supporting tutorials.
- Added a retrieval-only pilot stage and per-query diagnostics. It stops before synthesis/writing when the selected test requires a primary source but none was obtained. The direct public-document fetch check makes oversized/inaccessible pages easier to distinguish from search failures.
- Live structured output exceeded local quotation and claim-count limits. Validation now discards malformed or oversized claims, retains at most 12 claims with exact supporting quotations, and adds a review warning; it does not truncate quotations. No surviving verified claims still fails the brief. Regression tests cover both partial recovery and complete rejection.
- The Spanish trial completed with four readable text sources and no social-video shell. Estimated costs, including preparation for each research comparison: $0.0636 baseline, $0.2188 researched, $0.1705 cheaper-outline experiment. The evidence checker flagged three issues in each researched draft, including a business recommendation absent from the supplied company facts and mismatched citations. The intended primary publisher was not obtained, and one retained source focuses on ground coffee. Source relevance and business-fact fidelity still need human evaluation; this is not evidence for a broad rollout or guaranteed savings.
- The final English comparison completed with Google's own Search Console documentation. Estimated text/search costs were $0.0445 baseline, $0.1694 researched, and $0.1484 with the cheaper outline; the latter two each include $0.0262 preparation. The checker flagged three and six issues respectively. Manual inspection confirmed unsupported verification-timing and comparative-durability claims. A retrieved Google Business Profile page was recognized as a different process and excluded from the brief's claims. The two-topic sample does not establish overall quality improvement, editing-time savings or a safe change of default model.
- Focused verification passed: 21 source/validation/model tests, five generation/replay/failure tests, three image-pipeline tests, TypeScript, changed-file ESLint and the CSP route check. The direct Google-document fetch and final English/Spanish live comparisons also passed their execution checks; the review findings above remain unresolved editorial work. Local production builds passed during the source-reader changes; the final claim-validation changes also passed tests and TypeScript, with the final release build verified on Vercel.
- Application release `777e735` was built as `dpl_9R7rFP3RXuNNENfYd82mzMGNVfYY`, checked before promotion, and promoted to `www.repget.com`. The deployment explicitly sets `ARTICLE_RESEARCH_MODE=off`; the production project has no article-model overrides. Canonical-domain inspection confirmed the new deployment. Health returned 200 with `{ok:true, db:true}` at 2026-10-20T13:29:23Z; sign-in returned 200, anonymous dashboard access redirected to sign-in, and unsigned Inngest access returned 401.
- The final credential scan passed across 1,562 files. Pilot reports and diagnostic files remain excluded from Git and Vercel uploads. This follow-up used synthetic businesses and disposable test databases, created no production test accounts, and published no customer articles. Code and release notes are committed locally; no Git push was performed.

## Real business-profile pilot — 2026-10-20

- The shared database contained one real business profile. Selected two of its existing planned topics, one commercial comparison and one technical photography guide, preserving its saved English/Italy preferences, brand voice and adaptive article length. The four private drafts contain 1,747–1,897 words. Both selected calendar items were still `planned` after the trials; no production articles, accounts, publication events or customer usage records were created.
- Both original comparisons completed. Unlike the earlier synthetic trial, the baseline also received the stronger evidence check, charged separately as evaluation overhead. Four readable sources were retained per topic. Commercial sources did not establish Italian regional market comparisons; the technical source set did not establish several software-specific details. Both pairs still need editorial corrections.
- The trial exposed a checker input mismatch: the writer received the saved description and differentiators, while the checker received only services and confirmed facts. The checker consequently labelled supplied locations and working style as invented. The fix passes the same business context inside the untrusted-data boundary and explicitly distinguishes consistency with the supplied profile from independent verification.
- The first candidate (`article-evidence_check-v2`) still demanded external corroboration in a targeted positive probe. The revised `v3` accepted the supplied locations/working approach and flagged a deliberately invented award. Both customer comparisons were then rechecked without regenerating their drafts. The final checker stopped labelling the supplied company details invented, while retaining findings about unsupported regional assertions, software citations and other extrapolations. These checks are not proof of perfect factual detection: some ordinary editorial advice is still flagged too strictly.
- Final estimated generation costs for the commercial topic: $0.0975 baseline and $0.2321 researched. For the technical topic: $0.0873 baseline and $0.2154 researched. Research figures include search/planning/synthesis, outline, writing and the current evidence checker. Baseline evaluation-only checks cost another $0.0551 and $0.0473 respectively. These estimates exclude images, subsequent enrichment, infrastructure, regeneration and human editing; they do not establish total cost savings.
- The private HTML review presents all four drafts, source links, warnings, costs and a preliminary AI-assisted editorial assessment. Original excerpts and superseded checks remain in ignored JSON reports for comparison. Human approval, factual adjudication by a subject specialist and actual editing minutes remain unmeasured.
- Verification: 22 research/model tests, five input-boundary tests, five generation-pipeline tests, two report-safety/cost tests, TypeScript and changed-file ESLint passed. Both live A/B generation comparisons, the final four-draft evidence replay and the final positive/negative context probe passed their execution checks. Browser inspection confirmed the review page renders and expands a researched draft correctly.
- Keep research off for normal customer generation and preserve the stronger outline/writer. The next quality work is to keep unsupported regional comparisons and software details out of drafts, improve source-to-claim matching, and measure the customer's actual editing effort on the private review set before enabling a selected-site pilot.
- The initial shared-workspace deployment `dpl_HKkJYTx3Qy2HQFFBKFi6bLim4Mjv` built and passed route/health checks. A final workspace check revealed concurrent, unrelated partner-payment edits, including files modified before the upload. To exclude that work from this release, restored the prior deployment and rebuilt from a clean detached checkout of `3a3f3fe`. The concurrent edits were left untouched.
- Final release: commit `3a3f3fe`, deployment `dpl_GYLn8pFBzdLjgRPq36hEyEfqrLJu`, built in 127 seconds. Its database health passed before promotion. After promotion, canonical `www.repget.com` resolved to the isolated deployment and health returned `{ok:true, db:true}` at 2026-10-20T14:00:56Z. Sign-in returned 200, anonymous dashboard access returned 307 to sign-in, and unsigned Inngest access returned 401. Deployment explicitly retained `ARTICLE_RESEARCH_MODE=off`. The isolated upload excluded local environment files, private reports and Git metadata. The credential scan passed across 1,568 tracked files. The temporary release checkout, localhost preview and browser tab were cleaned up. Code and notes are committed locally; no Git push was performed.

## Evidence-scoped writing follow-up — 2026-10-20

- Compared three candidate writing revisions against the same two saved business briefs and source sets. Original reports remain untouched. No new searches, customer database access, quota consumption or publication occurred. A revised checker (`article-evidence_check-v4`) distinguishes recommendations from factual assertions and excludes previous verdicts. A live positive/negative probe accepted ordinary advice and supplied business details while identifying a deliberately unsupported product citation.
- The first writer candidate reduced some issues but still invented experience and software details. The next candidate followed the requested comparison topic more closely but returned Markdown for one article. That finding prompted structured HTML output and validation before saving. Final outline/body prompts are `v4`; normal generation without ready research retains its existing instructions and response format.
- Final automatic drafts contain 1,095 and 1,077 words. The commercial draft replaced the unsupported regional comparison with a supplier-question checklist. The photography draft stopped adding unsupported Capture One/Photoshop comparisons. The same checker reported 8 versus 1 findings for commercial and 4 versus 4 for photography. These counts are unconfirmed review signals, not independently verified factual-error rates. Editorial inspection still found overstated advice and unsupported links between business experience and outcomes.
- Estimated text/search generation cost, including the original preparation cost and current check in both versions: commercial $0.231744 before and $0.149786 after; photography $0.205697 before and $0.151405 after. These are comparisons with the previous researched version, not the cheaper unresearched baseline. Shorter output contributes to the reduction. Images, later enrichment, infrastructure, human editing and these revision experiments are excluded.
- Prepared separately labelled AI-assisted editorial corrections rather than presenting edited text as untouched model output. The commercial sample (810 words) passed its evidence check. The first photography check raised two overly broad objections despite the supplied profile and explicit Lightroom scope; the second edit removed optional business promotion and made the exercise/FAQ explicitly Lightroom-specific. The final photography sample (779 words) passed its check. Both samples still require the business owner's judgment and approval. No human editing minutes were measured.
- Total additional known provider-cost estimate for this follow-up: $1.33098, comprising three eight-call writing comparisons, a two-call reviewer probe and three editorial checks. All calls had known usage/pricing. Reports retain failed candidates and superseded checks rather than hiding them.
- Verification passed: 64 focused regression tests (including invalid HTML rejection with usage retained), three report rendering/safety/cost tests, TypeScript and changed-file ESLint. The final live writing comparison completed for both topics; the final corrected samples each passed their own evidence check. The initial photography editorial-check failure is preserved in its report.
- The local HTML review retains the untouched before/after comparison, separately displays corrected samples and explains extra evaluation costs. Private reports and draft files remain excluded from Git and Vercel. Keep research off for normal customer generation until owner review and a deliberately selected pilot; keep the stronger default writer. A zero-finding check is not proof of perfect factual accuracy or permission to publish.
- Release: application commit `d0f98cc`, built from a clean detached checkout as `dpl_GJhCicZPT62aWE3h3kNgvXaekJpj` in 58 seconds. The upload contained 1,570 regular files and excluded private reports, local environment files and Git metadata. Concurrent partner-payment and blog-translation work in the shared checkout was excluded. Deployment explicitly sets `ARTICLE_RESEARCH_MODE=off`; the project environment has no article-model overrides.
- The first pre-promotion health request timed out; a subsequent authenticated request returned `{ok:true, db:true}`. Confirmed that the canonical deployment still matched the expected prior release before promotion. After promotion, `www.repget.com` resolved to the new deployment. At 2026-10-20T14:58:55Z, health and sign-in returned 200, anonymous dashboard access returned 307 to `/sign-in`, and unsigned Inngest access returned 401.
- Browser inspection verified the before/after labels, costs, separate editorial corrections, expandable article and comparison table. Saved `test-results/content-pilot/writing-review.png`; closed the temporary browser tab and stopped the localhost preview. Removed the clean temporary release checkout after verifying its exact path and absence of uncommitted files. The final credential scan passed across 1,571 tracked files. Code and release notes are committed locally; no Git push was performed.

## Selected-site launch — 2026-10-20

- Enabled the review-required research pilot for the existing ImageStudio website (`4aec4382-f158-4deb-b7a3-b4968aac6b41`). The deployment and persistent production environment both use `ARTICLE_RESEARCH_MODE=pilot` with that exact website scope. Other websites remain outside the pilot. Existing articles are not rewritten. Every new researched article, including an automatically generated one, requires saved-version approval before publication.
- Fixed empty rollout scope to disable research. Only exactly `*` explicitly selects all websites. Added translated rollout notices to Planned Articles and Article Settings, and an administrator-only Content performance page for task models, recorded cost/latency, unknown measurements and recent research findings.
- Read-only production checks confirmed the selected Search Console connection, a complete import at 2026-10-20T15:09:43Z, and active publishing-plugin connections. No reconnect is required based on these checks.
- Verification passed: 59 focused research/pipeline/review/next-action/report/navigation tests, three UI rendering tests, TypeScript, changed-file ESLint, CSP route checking and the isolated credential scan (1,576 tracked files). Browser preview creation timed out twice; fresh visual inspection was not completed. The temporary synthetic preview server was stopped. No live AI experiment or customer article generation was triggered by this follow-up; owner review and actual editing time remain the next validation step.
- Main-workspace implementation commit: `f79db77`. Built a clean release from prior live commit `d0f98cc`, cherry-picking only the earlier content release notes and this implementation. Retained isolated release commit `2e9f780` on `release/content-rollout-20261020`; unrelated partner and blog work was excluded. The 1,575-file upload excluded private reports, environment credentials and Git metadata.
- Deployment `dpl_7xf31jeXm98eKhid2yEk6qxhkc2Y` built successfully and passed database health before promotion. Confirmed the canonical domain still pointed to the expected previous release before promoting. At 2026-10-20T15:24:59Z, canonical health returned 200 with `{ok:true, db:true}`, sign-in returned 200, anonymous dashboard/content access redirected to sign-in, the admin report returned 404 anonymously, and unsigned Inngest access returned 401.
- To stop new research, set the production mode to `off` and redeploy; existing held drafts still require review. Previous known-good application deployment is `dpl_GJhCicZPT62aWE3h3kNgvXaekJpj`, which explicitly had research off. Code and operational notes are committed locally; no Git push was performed.

## Real article and browser validation — 2026-10-20

The functional checks passed. **Do not expand the pilot or enable unreviewed publication on the strength of this batch.** All three untouched drafts required substantive editorial correction. The saved-version publishing gate worked, but the writer still overgeneralized sources and business facts. Corrected samples are separate evidence from automatic generation quality.

Three existing ImageStudio calendar items were queued through the normal allowance, outbox and Inngest workflow. They consumed three normal article slots and remain saved drafts. No test publication or external CMS delivery was attempted.

| New article | Original words | End-to-end generation | Recorded generation cost | Initial check findings |
| --- | ---: | ---: | ---: | ---: |
| Comparing Commercial Video Production Companies (`d298f0de-553f-47cc-a585-f72e9e127899`) | 1,242 | 4.98 min | $0.265568 | 1 |
| Color Grading in Photography: A Beginner's Guide (`9f18ec4c-0a61-47a4-b822-c46c8a9d11c8`) | 1,221 | 4.43 min | $0.217631 | 2 |
| Video Production for Weddings: A Planning Checklist (`a965a800-f056-4637-b213-55edf5bb63bc`) | 1,210 | 4.92 min | $0.222573 | 3 |

- The batch recorded 39 provider requests and $0.705772 in estimated costs, with no unknown cost entries. This includes a cover and three body images per article; all 12 image URLs returned HTTP 200 with JPEG content. Durations use original creation-to-completion timestamps, before editorial edits. These figures exclude later evaluation, hosting and editing time, and are not invoices or evidence of savings against the old workflow.
- Read the full drafts and their research excerpts. Independently opened the [photography guide](https://www.smugmug.com/blog/a-complete-guide-to-color-grading-and-photography), [video color guide](https://lwks.com/blog/color-grading-beginners-guide) and [wedding planning guide](https://www.jankofilms.co.uk/post/essential-wedding-video-planning-checklist-for-your-big-day). The web reader could not open the [commercial production guide](https://killerspots.com/blog/commercial-video-production); a direct HTTP check returned 200 and confirmed the relevant planning/deliverables text.
- Confirmed errors included company-wide figures narrowed to one service, mobile apps assigned capabilities absent from the cited passage, video-specific guidance presented as universal photography practice, and the company's style generalized to other providers. Editorial review also identified loaded comparison questions and excessive quotation. Removed or narrowed those claims, made comparison questions consistent and preserved source links and images.
- Saved corrected versions under the normal article edit lock, with each previous body preserved in `article_versions`. The corrected commercial and wedding drafts (969 and 937 words) passed their follow-up evidence checks. The photography draft (991 words) received a further manual correction after its last check; its saved quality status explicitly says the current version still needs review. All three retain research and Partner Network review holds. None was approved or published.
- Five bounded editorial-check attempts produced four responses and one connection failure. Known extra evaluation cost was $0.224956; the failed request supplied no usage, so its cost is unconfirmed. Original outputs, superseded findings and corrected versions remain in ignored `test-results/content-validation/`. No customer editing minutes were fabricated.

Browser coverage used a disposable account with no payment-provider subscription and no publishing connection. Production checks covered reminder postponement/restoration, source expansion, saved-version approval, and invalidation after a title edit. The administrator report was denied to the ordinary production account. An authenticated request to another workspace's article returned the streamed not-found result without exposing its body.

The isolated local build used the same committed production code plus the validation fixes. A localhost-only administrator allowlist enabled inspection of the actual three article previews and the cost report. It did not grant that account production administrator access. Checked desktop titles, body text, tables and images, plus research approval and the pilot notice at a real 390px iframe viewport in both themes. Screenshots are saved privately. The fixture account's synthetic article tests UI behavior only and is not counted as an article-quality sample.

Two bugs found during this review were fixed and committed:

- `3bc31f2`: Today's article now checks the current research approval hash and explains the review hold before suggesting scheduling/publication. Editing a previously approved draft restores this state. Uses existing translations in all five supported languages.
- `7304896`: Legacy article usage without a `task` field now uses its recorded purpose. Old writing/outline requests are no longer mislabeled as source searches. Total costs are unchanged.

Validation passed: 67 distinct focused regression tests across the seven research, pipeline, review, recommendation, dashboard and report suites, TypeScript, changed-file ESLint and the isolated production build. The report fix's three tests were rerun after that change. Browser inspection confirmed the corrected legacy labels locally and the corrected dashboard state on production.

Released only these two fixes on top of the previous isolated content release, as commit `d4901c4` on `release/content-rollout-20261020`. Deployment `dpl_5VqTG4hp8P8dyfMHTCV8JqoUqJJk` (`full-stack-sass-ai-seo-improvement-puzmk0r4o-ai-seo-sass.vercel.app`) built successfully, passed database health, and was promoted after confirming the expected previous canonical deployment. Concurrent blog, indexing and billing work in the shared checkout was excluded. Production remains `pilot` for the same single ImageStudio website.

At 2026-10-20T16:21:49Z, canonical health and sign-in returned 200, anonymous dashboard access redirected to sign-in, the admin report returned 404 anonymously, and unsigned Inngest access returned 401. The previous content deployment `dpl_7xf31jeXm98eKhid2yEk6qxhkc2Y` remains the immediate rollback.

Cleanup completed: deleted the disposable user, workspace, website, article, sessions and signup-eligibility row, then verified zero remaining rows for those exact fixture IDs. Removed its credentials file, closed the temporary browser tab, stopped the localhost server and removed the isolated worktree after removing its dependency junction safely. The three real ImageStudio drafts remain held; the final snapshot at 16:27 UTC showed zero publish logs. The isolated credential scan passed across 1,577 tracked files. No Git push was performed.

**Remaining acceptance work:** improve source relevance and the writer's preservation of factual scope, then test fresh untouched articles across more than one business/topic family. Compare editing required, relevance, factual accuracy, total generation cost and completion time against the existing workflow. The current sample supports continued review-required pilot operation; it does not establish readiness for a platform-wide automatic rollout or reduced human editing.
