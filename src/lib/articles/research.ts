import { load } from "cheerio";
import { z } from "zod/v4";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { anthropic } from "@/lib/ai/client";
import { articleTask, measuredRequest, type MeasureAi } from "@/lib/ai/article-tasks";
import { dataBlock, dataRule } from "@/lib/ai/untrusted";
import { safeFetch, assertPublicHttpUrl } from "@/lib/net/safe-fetch";
import { articleSearch, isDataForSeoConfigured } from "@/lib/providers/dataforseo";
import { normalizeLanguage } from "@/lib/websites/languages";
import type { ArticleBrief } from "./generate";
import type { ResearchBrief, ResearchSource } from "./research-types";
import { researchPageContent } from "./research-page";
import { researchPassages } from "./research-passages";

const synthesisSchema = z.object({
  question: z.string().min(1).max(500),
  intent: z.enum(["informational", "commercial", "transactional", "navigational"]),
  businessAngle: z.string().max(1000),
  subquestions: z.array(z.string().max(300)).min(1).max(8),
  claims: z.array(z.object({
    text: z.string().max(600), sourceId: z.string(),
    quote: z.string().min(20).max(700),
  })).min(1).max(12),
  warnings: z.array(z.string().max(1500)).max(16),
});
const selectionSchema = synthesisSchema.omit({ claims: true }).extend({
  warnings: z.array(z.string().max(1500)).max(8),
  relevantSourceIds: z.array(z.string()).max(4),
  canAnswerQuestion: z.boolean(),
  claims: z.array(z.object({ text: z.string().max(600), passageId: z.string() })).max(12),
});
const normalize = (text: string) => text.normalize("NFKC").replace(/\p{Cf}/gu, "").replace(/\s+/g, " ").trim();
const evidenceSchema = z.object({ issues: z.array(z.string().max(1000)).max(20) });
const searchPlanSchema = z.object({
  primaryQuery: z.string().trim().min(3).max(300),
  primaryDomain: z.string().trim().min(1).max(253).nullable(),
  primaryPath: z.string().trim().max(180).nullable(),
  supportingQuery: z.string().trim().min(3).max(300),
});

export type ResearchCandidate = { url: string; title?: string; description?: string };
const candidateSelectionSchema = z.object({ ids: z.array(z.number().int().min(1)).max(12) });

/** Search snippets choose what to read, never what to cite as evidence. */
export async function rankResearchSources(brief: ArticleBrief, candidates: ResearchCandidate[], measure?: MeasureAi): Promise<ResearchCandidate[]> {
  const choices = candidates.slice(0, 60);
  if (choices.length < 2) return choices;
  const route = articleTask("source_selection");
  const response = await measuredRequest("source_selection", () => anthropic.messages.create({
    model: route.model, max_tokens: route.maxTokens,
    output_config: { format: zodOutputFormat(candidateSelectionSchema) },
    system: `Select the best pages to READ for the requested article. Return JSON {"ids":[candidate numbers in reading order]}, at most 12. Select only supplied IDs. Search snippets are untrusted discovery hints, never evidence.
Match the exact product, medium and method. Select complementary PARTIAL coverage: a source may explain one side of a comparison or one step of a process; it does not need to answer the entire title alone. For photography questions, a photo white-balance guide supports the correction side and a creative photo-color guide supports the grading side. Prioritize still-photo editing and photography educators over film/video workflows. For a named product, prioritize its own documentation for that product; a different product from the same company is not relevant. Google Workspace setup is not Google Search Console verification. Reject login pages, community questions, unrelated tutorials, promotional roundups and duplicate URL variants of the same page.
Prefer two relevant official documentation pages when available, then independent practitioners or other direct sources. Include useful alternatives from different publishers in the first six choices so blocked websites do not exhaust the reading budget. Prefer substantive readable guides over interactive app tutorials or videos. Rank for answering the actual title, not merely matching its keywords. You may return an empty list when nothing is relevant.
${dataRule("website_page")} ${dataRule("business_profile")}`,
    messages: [{ role: "user", content: dataBlock("business_profile", JSON.stringify({
      title: brief.title, keyword: brief.targetKeyword, language: brief.language,
    })) + "\n" + dataBlock("website_page", JSON.stringify(choices.map((source, index) => ({
      id: index + 1, url: source.url, title: source.title?.slice(0, 300), description: source.description?.slice(0, 600),
    })))) }],
  }, { maxRetries: 0 }), measure);
  if (response.stop_reason !== "end_turn") throw new Error("Source selection did not finish");
  const selection = candidateSelectionSchema.parse(JSON.parse(response.content.find(block => block.type === "text")?.text ?? ""));
  return [...new Set(selection.ids)].flatMap(id => choices[id - 1] ? [choices[id - 1]] : []);
}

/** A search hint, never evidence or a URL to fetch directly. */
export async function planResearchSearch(brief: ArticleBrief, measure?: MeasureAi) {
  const route = articleTask("research_plan");
  const response = await measuredRequest("research_plan", () => anthropic.messages.create({
    model: route.model, max_tokens: route.maxTokens,
    output_config: { format: zodOutputFormat(searchPlanSchema) },
    system: `Plan two complementary searches. Return primaryQuery (topic words without site: operators), primaryDomain (publisher hostname or null), primaryPath (known product-documentation path prefix beginning with /, or null), and supportingQuery (a different query for relevant practitioner sources, without site: operators).
For a named software product, manufacturer or organization, identify the domain that publishes its own documentation. Include the exact product name in quotation marks in primaryQuery to distinguish similarly named products. Do not just add "official guide" to a generic query: that returns third-party tutorials. For example, Google Search Console documentation is published on support.google.com.
For other topics, identify a relevant professional association, original research publisher or practitioner with direct expertise when confidently known. Use null if no primary publisher can be identified confidently; never invent a domain. Avoid social videos, shopping results and generic SEO compilations.
When a publisher hosts several products or a community, scope to the product's documentation path when known. For example, Search Console help articles are under support.google.com/webmasters/answer, not Google Workspace help or community threads. The path is only a search constraint; never invent a complete article URL.
Use null for the path when uncertain. Do not guess a locale or a marketing directory. A broad publisher domain is preferable to a nonexistent path.
Use supportingQuery to disambiguate the medium or method and find complementary evidence rather than repeat the target keyword. For still-photography color questions, search photo editing, white balance and creative color grading of photographs, not film footage or video scopes. Preserve the title's subject in both queries.
Use the reader's language where possible; official documentation in another language is acceptable when it answers the question better.
Keep the actual subject and qualifiers (such as whole coffee beans versus ground coffee). Do not expand to a different question. Return a search query, not an answer, URL or claim of credibility.
${dataRule("business_profile")}`,
    // Private customer facts/services are not needed for a public search plan.
    messages: [{ role: "user", content: dataBlock("business_profile", JSON.stringify({
      topic: brief.title, keyword: brief.targetKeyword, language: brief.language, country: brief.country,
    })) }],
  }, { maxRetries: 0 }), measure);
  if (response.stop_reason !== "end_turn") throw new Error("Research search planning did not finish");
  const plan = searchPlanSchema.parse(JSON.parse(response.content.find(b => b.type === "text")?.text ?? ""));
  const domain = plan.primaryDomain?.toLowerCase() ?? null;
  if (domain && !/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}$/.test(domain)) {
    throw new Error("Research planner returned an invalid publisher domain");
  }
  if (domain) assertPublicHttpUrl(`https://${domain}`);
  const path = plan.primaryPath;
  if (path && (!domain || !/^\/[a-zA-Z0-9_\/-]*$/.test(path) || path.includes("..") || path.includes("//"))) {
    throw new Error("Research planner returned an invalid documentation path");
  }
  return {
    primaryDomain: domain,
    primaryPath: path,
    supportingQuery: plan.supportingQuery.replace(/\bsite:\S+/gi, "").trim(),
    primaryQuery: domain
      ? `${`site:${domain}${path ?? ""} ${plan.primaryQuery.replace(/\bsite:\S+/gi, "").trim()}`.slice(0, 240)} -inurl:thread -inurl:forum -inurl:community`
      : plan.primaryQuery,
  };
}

// These pages need platform-specific transcript/post readers. Their public HTML
// commonly contains only login/navigation text, even when it exceeds 250 chars.
const unreadablePublishers = [
  "instagram.com", "facebook.com", "fb.com", "youtube.com", "youtu.be",
  "tiktok.com", "pinterest.com", "x.com", "twitter.com", "threads.net", "threads.com",
];
function unsupportedSource(url: URL) {
  return unreadablePublishers.some(host => url.hostname === host || url.hostname.endsWith(`.${host}`)) ||
    /(?:^|\.)(?:community|communities|forum|forums|discuss|discussions)\./i.test(url.hostname) ||
    /\/(?:forum|forums|thread|threads|community)(?:\/|$)/i.test(url.pathname) ||
    /\/(?:login|log-in|signin|sign-in|signup|sign-up)(?:\/|$)/i.test(url.pathname);
}

/** Evidence must really occur in the fetched page. This is provenance, not proof of truth. */
export function validateResearch(text: string, sources: ResearchSource[]) {
  // Provider structured output does not guarantee every local length rule.
  // Discard an invalid claim, never truncate a quote or lose other valid evidence.
  const result = synthesisSchema.omit({ claims: true }).extend({
    claims: z.array(z.unknown()).min(1).max(100),
  }).parse(JSON.parse(text));
  const verified = result.claims.flatMap(candidate => {
    const parsed = synthesisSchema.shape.claims.element.safeParse(candidate);
    if (!parsed.success) return [];
    const claim = parsed.data;
    const source = sources.find(s => s.id === claim.sourceId);
    return source && normalize(source.excerpt).includes(normalize(claim.quote)) ? [claim] : [];
  }).slice(0, 12);
  if (!verified.length) throw new Error("Research contains only unsupported source quotations");
  return { ...result, claims: verified, warnings: [
    ...result.warnings,
    ...(verified.length < result.claims.length ? ["Some research claims were omitted because they exceeded limits or their supporting quotations could not be verified."] : []),
  ] };
}

export async function collectResearchSources(
  brief: ArticleBrief,
  onSearchCost: (cost: number | undefined) => Promise<void>,
  onSource?: (result: { url: string; outcome: string }) => void,
  options: { primaryQuery?: string; primaryDomain?: string | null; primaryPath?: string | null; supportingQuery?: string;
    search?: typeof articleSearch; rank?: (candidates: ResearchCandidate[]) => Promise<ResearchCandidate[]> } = {},
): Promise<ResearchSource[]> {
  if (!isDataForSeoConfigured()) throw new Error("Research search provider is not configured");
  const language = normalizeLanguage(brief.language);
  if (!language || !brief.country) throw new Error("Research requires a supported language and target country");
  const search = options.search ?? articleSearch;
  const domain = options.primaryDomain?.replace(/^www\./, "").toLowerCase();
  const isPrimary = (input: string) => {
    if (!domain) return false;
    try {
      const url = new URL(input);
      const host = url.hostname.replace(/^www\./, "");
      const path = options.primaryPath?.replace(/\/$/, "");
      return (host === domain || host.endsWith(`.${domain}`)) &&
        (!path || url.pathname === path || url.pathname.startsWith(`${path}/`));
    } catch { return false; }
  };
  // Two planned searches, with at most one original-query fallback when a
  // publisher scope or both planned queries yield nothing. Hints are not evidence.
  const queries = [...new Set([options.primaryQuery, options.supportingQuery || brief.targetKeyword || brief.title]
    .filter((q): q is string => Boolean(q?.trim())).map(q => q.trim().slice(0, 300)))];
  const focused: Awaited<ReturnType<typeof articleSearch>>["items"] = [];
  const general: typeof focused = [];
  const offScope: typeof focused = [];
  let completedSearches = 0;
  for (const query of queries) {
    try {
      const result = await search(query, brief.country, language, onSearchCost);
      const isFocused = Boolean(domain && query === options.primaryQuery?.trim().slice(0, 300));
      for (const item of result.items) {
        (isFocused ? isPrimary(item.url) ? focused : offScope : general).push(item);
      }
      completedSearches++;
    } catch {
      // One provider failure must not discard the other search's usable results.
      onSource?.({ url: "", outcome: "search_failed" });
    }
  }
  const fallback = (brief.targetKeyword || brief.title).trim().slice(0, 300);
  if (!focused.length && (domain || !general.length) && options.supportingQuery && !queries.includes(fallback)) {
    try {
      const result = await search(fallback, brief.country, language, onSearchCost);
      general.push(...result.items);
      completedSearches++;
    } catch { onSource?.({ url: "", outcome: "fallback_search_failed" }); }
  }
  if (!completedSearches) throw new Error("Research searches could not be completed");
  // Search providers sometimes relax site: and return useful secondary guides.
  // If the other searches fail, let relevance ranking assess these discoveries
  // rather than discard the only results. They never become primary sources.
  if (!general.length) general.push(...offScope);
  // A blocked primary publisher must not consume all six fetches through its
  // different subdomains. Reserve early attempts for the independent search.
  const items = [...focused.slice(0, 2), ...general, ...focused.slice(2)];
  const seen = new Set<string>();
  const hosts = new Map<string, number>();
  const hostAttempts = new Map<string, number>();
  const fetchedUrls = new Set<string>();
  const attemptedUrls = new Set<string>();
  const retriedUrls = new Set<string>();
  const sources: ResearchSource[] = [];
  // Six fetches maximum and two pages per publisher. Synthesis selects up to
  // four relevant pages; do not discard a useful late fallback before it reads it.
  // Several official pages can be better evidence than an unrelated second publisher.
  let candidates: ResearchCandidate[] = items.filter(item => {
    try {
      const url = assertPublicHttpUrl(item.url);
      if (unsupportedSource(url)) {
        onSource?.({ url: item.url, outcome: "unsupported_page" });
        return false;
      }
      url.hash = "";
      if (seen.has(url.href)) return false;
      seen.add(url.href);
      return true;
    } catch { return false; }
  });
  if (options.rank && candidates.length > 1) {
    // The callback owns entitlement/reservations and usage reporting. Only
    // original candidates can survive, even if an implementation invents URLs.
    const ranked = await options.rank(candidates.slice(0, 60));
    const urls = new Set(ranked.map(candidate => candidate.url));
    candidates = ranked.filter((candidate, index) =>
      ranked.findIndex(other => other.url === candidate.url) === index &&
      candidates.some(original => original.url === candidate.url)).map(candidate =>
      candidates.find(original => original.url === candidate.url)!);
    onSource?.({ url: "", outcome: `selected_${Math.min(urls.size, candidates.length)}_candidates` });
  }
  let fetches = 0;
  while (candidates.length && fetches < 6) {
    if (sources.length >= 4 && (!domain || sources.some(s => isPrimary(s.url)))) break;
    const item = candidates.shift()!;
    try {
      const host = assertPublicHttpUrl(item.url).hostname.replace(/^www\./, "");
      if ((hosts.get(host) ?? 0) >= 2 || (hostAttempts.get(host) ?? 0) >= 2) continue;
      hostAttempts.set(host, (hostAttempts.get(host) ?? 0) + 1);
      fetches++;
      attemptedUrls.add(new URL(item.url).href.split("#")[0]);
      const response = await safeFetch(item.url, {
        timeoutMs: 20000, maxBytes: 4_000_000,
        headers: { accept: "text/html", "accept-encoding": "gzip, br", "user-agent": "RepGetResearch/1.0" },
      });
      if (!response.ok || !response.headers.get("content-type")?.includes("text/html")) {
        onSource?.({ url: item.url, outcome: `not_html_or_http_${response.status}` });
        continue;
      }
      const parsedUrl = assertPublicHttpUrl(response.url || item.url);
      parsedUrl.hash = "";
      const finalUrl = parsedUrl.href;
      if (unsupportedSource(parsedUrl)) { onSource?.({ url: finalUrl, outcome: "unsupported_page" }); continue; }
      const finalHost = parsedUrl.hostname.replace(/^www\./, "");
      if (fetchedUrls.has(finalUrl) || (hosts.get(finalHost) ?? 0) >= 2) continue;
      const $ = load(await response.text());
      const title = $("title").first().text().trim().slice(0, 250) || item.title || item.url;
      if (/^(?:just a moment|access denied|attention required|verify (?:you are|you're) human|sign in|log in|iniciar sesi[oó]n)(?:\b|[.!])/i.test(title)) {
        onSource?.({ url: finalUrl, outcome: "access_gate" }); continue;
      }
      const { content, excerpt } = researchPageContent($, title,
        `${brief.title} ${brief.targetKeyword ?? ""} ${options.supportingQuery ?? ""}`);
      if (excerpt.length < 250) { onSource?.({ url: item.url, outcome: "insufficient_text" }); continue; }
      // Search engines may omit the primary publisher even for a site: query.
      // Follow at most two actual links to it from a readable secondary page;
      // these share the SAME six-fetch budget, with no guessed destination.
      if (domain && !isPrimary(finalUrl)) {
        const discovered: typeof candidates = [];
        for (const link of content.find("a[href]").toArray()) {
          if (discovered.length >= 2) break;
          try {
            const url = assertPublicHttpUrl(new URL($(link).attr("href")!, finalUrl));
            url.hash = "";
            if (!isPrimary(url.href) || attemptedUrls.has(url.href) || discovered.some(d => d.url === url.href)) continue;
            const pending = candidates.findIndex(c => new URL(c.url).href.split("#")[0] === url.href);
            if (pending >= 0) candidates.splice(pending, 1);
            else if (seen.has(url.href)) continue;
            seen.add(url.href);
            discovered.push({ url: url.href, title: $(link).text().slice(0, 250) });
          } catch { /* Only public URLs on the intended publisher are eligible. */ }
        }
        candidates.unshift(...discovered);
      }
      fetchedUrls.add(finalUrl);
      hosts.set(finalHost, (hosts.get(finalHost) ?? 0) + 1);
      sources.push({
        id: `S${sources.length + 1}`, url: finalUrl, title,
        retrievedAt: new Date().toISOString(), excerpt,
      });
      onSource?.({ url: finalUrl, outcome: "read" });
    } catch (error) {
      onSource?.({ url: item.url, outcome: error instanceof Error ? error.name : "fetch_failed" });
      // A slow official page deserves one more bounded attempt, after an
      // independent candidate. Reuse the six-fetch/two-per-host limits; never
      // retry access denials, unsafe destinations or arbitrary failures.
      if (error instanceof Error && error.name === "TimeoutError" && isPrimary(item.url) &&
        !retriedUrls.has(item.url) && fetches < 6) {
        retriedUrls.add(item.url);
        candidates.splice(Math.min(1, candidates.length), 0, item);
        onSource?.({ url: item.url, outcome: "primary_timeout_retry_queued" });
      }
    }
  }
  return sources.sort((a, b) => Number(isPrimary(b.url)) - Number(isPrimary(a.url)))
    .map((source, index) => ({ ...source, id: `S${index + 1}` }));
}

export async function synthesizeResearch(
  brief: ArticleBrief, sources: ResearchSource[], mode: "pilot" | "on", measure?: MeasureAi,
): Promise<ResearchBrief> {
  const base = {
    version: 1 as const, mode, checkedAt: new Date().toISOString(), sources,
    question: brief.title, intent: brief.intent ?? "informational", businessAngle: "",
    subquestions: [] as string[], claims: [] as ResearchBrief["claims"], warnings: [] as string[],
  };
  if (sources.length < 2) return { ...base, status: "incomplete", warnings: ["Not enough readable source material. Review the article before publishing."] };
  const passages = researchPassages(sources);
  if (!passages.length) return { ...base, status: "incomplete", warnings: ["No usable source passages. Review before publishing."] };
  const route = articleTask("research");
  const response = await measuredRequest("research", () => anthropic.messages.create({
    model: route.model, max_tokens: route.maxTokens,
    output_config: { format: zodOutputFormat(selectionSchema) },
    system: `Prepare a research brief, not an article. Return JSON only with question, intent (informational/commercial/transactional/navigational), businessAngle, subquestions (1-8), relevantSourceIds, canAnswerQuestion, claims (0-12 objects: text, passageId), warnings.
First decide which sources actually answer the requested topic. Put only their source IDs in relevantSourceIds. A page about another product, medium or method is not relevant just because it shares a publisher or keyword: Google Workspace domain setup is not Google Search Console verification; video-specific color workflow is not evidence for photography-specific technical claims. Exclude those pages and all their claims. Mark canAnswerQuestion false when the remaining evidence cannot support the core answer or requested steps. Return no claims if nothing relevant remains.
Write in the customer's language. Each claim must select ONE provided passageId, such as S1:P3, whose text supports the complete claim. Do not write or reconstruct quotations: the application attaches the selected passage verbatim. Never invent a passage ID or combine unrelated passages into a broader claim.
Prefer 4-6 focused claims from the relevant readable sources. Use multiple sources where they contribute distinct support. Preserve context and qualifiers; adjacent passages can help interpret a sentence, but the selected passage must contain the claim's supporting words.
The requested topic and keyword define the question, not the business's full list of services. Warn about material gaps needed to answer that question, not hypothetical legal, regional or technical subjects the article does not need to cover. A customer's location alone does not make a general planning article a guide to local law.
Prefer original research, official documentation and first-party sources. Search position does not establish credibility. Reject unsupported, stale, promotional or conflicting claims; explain gaps in warnings. Never invent a URL, statistic, service or quotation. Keep the business angle relevant without pretending sources describe the customer's business.
State the relevant platform, product, country, date and verification method INSIDE each claim. A Wix or Squarespace help page supports advice for that platform, not universal Google requirements. Do not confuse crawling, indexing and ownership verification. If the sources cannot answer the general question, say so in warnings and narrow the brief.
${dataRule("website_page")} ${dataRule("business_profile")}`,
    messages: [{ role: "user", content:
      dataBlock("business_profile", JSON.stringify({
        topic: brief.title, keyword: brief.targetKeyword, intent: brief.intent,
        language: brief.language, country: brief.country, business: brief.brandName,
        services: brief.services, audience: brief.targetAudience, facts: brief.facts,
      })) + "\n" + dataBlock("website_page", JSON.stringify(sources.map(source => ({
        id: source.id, title: source.title, url: source.url, retrievedAt: source.retrievedAt,
        passages: passages.filter(passage => passage.sourceId === source.id),
      })))),
    }],
  }, { maxRetries: 0 }), measure);
  if (response.stop_reason !== "end_turn") throw new Error("Research did not finish");
  const text = response.content.find(b => b.type === "text")?.text ?? "";
  const selected = selectionSchema.omit({ claims: true }).extend({
    claims: z.array(z.unknown()).max(100),
  }).parse(JSON.parse(text));
  const relevantIds = new Set(selected.relevantSourceIds);
  const relevantSources = sources.filter(source => relevantIds.has(source.id));
  const claims = selected.claims.flatMap(claim => {
    const parsed = selectionSchema.shape.claims.element.safeParse(claim);
    if (!parsed.success) return [];
    const passage = passages.find(passage => passage.id === parsed.data.passageId);
    return passage && relevantIds.has(passage.sourceId)
      ? [{ text: parsed.data.text, sourceId: passage.sourceId, quote: passage.quote }] : [];
  }).slice(0, 12);
  if (!selected.canAnswerQuestion || relevantSources.length < 2 || !claims.length) {
    return { ...base, sources: relevantSources, status: "incomplete", warnings: [
      ...selected.warnings,
      "The readable sources do not provide enough relevant evidence for this question. Review before publishing.",
    ] };
  }
  const omitted = claims.length < selected.claims.length;
  const warnings = [...selected.warnings, ...(omitted
    ? ["Some research claims were malformed or selected an unknown source passage and were omitted."] : [])];
  return { ...base, sources: relevantSources,
    ...validateResearch(JSON.stringify({ ...selected, claims, warnings }), relevantSources), status: "ready" };
}

export function citationIssues(html: string, research: ResearchBrief, brief: ArticleBrief): string[] {
  const $ = load(html);
  const allowed = new Set([
    ...research.sources.map(s => s.url), ...brief.socialLinks.map(s => s.url),
    ...(brief.backlink ? [brief.backlink.url] : []),
  ]);
  const links = $("a[href]").map((_, node) => $(node).attr("href")!).get();
  const issues: string[] = [];
  if (links.some(url => !url.startsWith("#") && !allowed.has(url))) issues.push("The draft contains a link outside the supplied sources.");
  if (research.claims.length && !links.some(url => research.sources.some(s => s.url === url))) {
    issues.push("The draft does not cite its research sources.");
  }
  return issues;
}

export async function checkResearchEvidence(
  html: string, brief: ArticleBrief, research: ResearchBrief, measure?: MeasureAi,
): Promise<NonNullable<ResearchBrief["quality"]>> {
  const issues = citationIssues(html, research, brief);
  if (html.length > 65000) issues.push("The draft exceeds the automated evidence check's length limit. Review the full article.");
  if (research.status !== "ready") return { checked: false, issues: [...issues, "Research is incomplete."] };
  const route = articleTask("evidence_check");
  const response = await measuredRequest("evidence_check", () => anthropic.messages.create({
    model: route.model, max_tokens: route.maxTokens,
    output_config: { format: zodOutputFormat(evidenceSchema) },
    system: `Check the draft against the provided evidence and business facts. Return JSON only: {"issues": ["specific unsupported claim or citation mismatch"]}. Use an empty list only when no material issues are found.
Check factual specifics, invented services, quotations, numbers, conflicting evidence, and whether cited sources actually support the associated sentences. A citation's presence is not proof. Describe each issue in the article's language. Do not rewrite the article. Do not treat paid placements as evidence.
Check how sources are introduced: locations, credentials, awards and market position of a publisher are factual claims too. Flag added descriptors absent from the supplied evidence, even when the publisher is familiar.
Distinguish factual assertions from clearly framed recommendations, questions to ask a supplier and hypothetical examples. Ordinary advice such as "ask who owns the footage" does not require a citation. An embedded factual claim still does: "ask for the required national licence" asserts that such a licence is required. Do not flag a claim merely because the writer did not use it, nor demand that every source be cited. Do not flag absence of general research coverage as a defect in an otherwise supported sentence. For each reported issue identify the actual draft wording and the missing or conflicting support; avoid speculative objections.
The business profile includes the same saved description, services and differentiators supplied to the writer, as well as the owner's confirmed facts. For descriptions of THIS business, those supplied details are sufficient support: accept locations and working approach explicitly given in the description or differentiators even when the research sources list is empty. Do not demand outside citations for them or flag the absence of independent verification. This check tests consistency with the saved profile; independently verifying that profile is outside its scope. Do flag contradictions or details the writer added beyond the profile. The profile does not establish claims about other businesses, regional markets, industry trends, prices or outcomes.
Actively check scope: platform-specific advice must not be presented as universal. Compare the source title, publisher, relevant method and caveats with EACH claim. In particular, ownership verification, crawling and indexing are different operations; a restriction on one does not establish a restriction on the others. Flag unsupported universal requirements, guarantees, and timelines even if a sentence resembles a quoted excerpt.
Review the WHOLE draft in three passes before returning findings: (1) opening and all paragraphs, including causal or outcome claims such as "most delays disappear"; (2) table cells and FAQ answers, including invented definitions, typical lengths or industry practices; (3) business figures, differentiators and every citation. Return all material findings together, not just the first few. Advice can remain advice without an unsupported promise explaining why it works. Do not overlook an assertion because it sounds plausible or appears in an introduction.
Judge the exact wording and modality. An optional example or suggestion in a source does not establish a mandatory standard; distinguish "can", "may" and "recommended" from "must", "always" and "standard". Applying a saved business-wide working approach to one of its listed services is not itself a contradiction; inventing service-specific totals, exclusivity or outcomes is. Report material factual problems, not alternative stylistic preferences.
${dataRule("website_page")} ${dataRule("business_profile")}`,
    messages: [{ role: "user", content:
      dataBlock("business_profile", JSON.stringify({
        language: brief.language, brandName: brief.brandName, industry: brief.industry,
        country: brief.country, description: brief.description, targetAudience: brief.targetAudience,
        differentiators: brief.usps, facts: brief.facts, services: brief.services,
      })) +
      // Do not bias this independent check with a previous check's verdict.
      "\n" + dataBlock("website_page", JSON.stringify({
        research: {
          question: research.question, intent: research.intent,
          sources: research.sources, claims: research.claims, warnings: research.warnings,
        },
        draft: html.slice(0, 65000),
      })),
    }],
  }, { maxRetries: 0 }), measure);
  if (response.stop_reason !== "end_turn") throw new Error("Evidence review did not finish");
  const result = evidenceSchema.parse(
    JSON.parse(response.content.find(b => b.type === "text")?.text ?? ""),
  );
  return { checked: true, issues: [...issues, ...result.issues] };
}
