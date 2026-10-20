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

const synthesisSchema = z.object({
  question: z.string().min(1).max(500),
  intent: z.enum(["informational", "commercial", "transactional", "navigational"]),
  businessAngle: z.string().max(1000),
  subquestions: z.array(z.string().max(300)).min(1).max(8),
  claims: z.array(z.object({
    text: z.string().max(600), sourceId: z.string(),
    quote: z.string().min(20).max(700),
  })).min(1).max(12),
  warnings: z.array(z.string().max(400)).max(8),
});
const normalize = (text: string) => text.normalize("NFKC").replace(/\p{Cf}/gu, "").replace(/\s+/g, " ").trim();
const evidenceSchema = z.object({ issues: z.array(z.string().max(1000)).max(20) });

/** Evidence must really occur in the fetched page. This is provenance, not proof of truth. */
export function validateResearch(text: string, sources: ResearchSource[]) {
  const result = synthesisSchema.parse(JSON.parse(text));
  const verified = result.claims.filter(claim => {
    const source = sources.find(s => s.id === claim.sourceId);
    return source && normalize(source.excerpt).includes(normalize(claim.quote));
  });
  if (!verified.length) throw new Error("Research contains only unsupported source quotations");
  return { ...result, claims: verified, warnings: [
    ...result.warnings,
    ...(verified.length < result.claims.length ? ["Some research claims were omitted because their quotations could not be verified."] : []),
  ] };
}

export async function collectResearchSources(
  brief: ArticleBrief,
  onSearchCost: (cost: number | undefined) => Promise<void>,
  onSource?: (result: { url: string; outcome: string }) => void,
): Promise<ResearchSource[]> {
  if (!isDataForSeoConfigured()) throw new Error("Research search provider is not configured");
  const language = normalizeLanguage(brief.language);
  if (!language || !brief.country) throw new Error("Research requires a supported language and target country");
  const search = await articleSearch(brief.targetKeyword || brief.title, brief.country, language, onSearchCost);
  const seen = new Set<string>();
  const hosts = new Map<string, number>();
  const fetchedUrls = new Set<string>();
  const sources: ResearchSource[] = [];
  // Six fetches maximum, retaining at most four pages and two per publisher.
  // Several official pages can be better evidence than an unrelated second publisher.
  const candidates = search.items.filter(item => {
    try {
      const url = assertPublicHttpUrl(item.url);
      const host = url.hostname.replace(/^www\./, "");
      if (seen.has(url.href) || (hosts.get(host) ?? 0) >= 2) return false;
      seen.add(url.href);
      hosts.set(host, (hosts.get(host) ?? 0) + 1);
      return true;
    } catch { return false; }
  }).slice(0, 6);
  hosts.clear();
  for (const item of candidates) {
    if (sources.length >= 4) break;
    try {
      const response = await safeFetch(item.url, {
        timeoutMs: 12000, maxBytes: 1_500_000,
        headers: { accept: "text/html", "user-agent": "RepGetResearch/1.0" },
      });
      if (!response.ok || !response.headers.get("content-type")?.includes("text/html")) {
        onSource?.({ url: item.url, outcome: `not_html_or_http_${response.status}` });
        continue;
      }
      const finalUrl = response.url || item.url;
      const finalHost = assertPublicHttpUrl(finalUrl).hostname.replace(/^www\./, "");
      if (fetchedUrls.has(finalUrl) || (hosts.get(finalHost) ?? 0) >= 2) continue;
      const $ = load(await response.text());
      const title = $("title").first().text().trim().slice(0, 250) || item.title || item.url;
      $("script,style,nav,footer,header,aside,form,noscript").remove();
      const main = $("main,article").first();
      const excerpt = normalize((main.length ? main : $("body")).text()).slice(0, 6000);
      if (excerpt.length < 250) { onSource?.({ url: item.url, outcome: "insufficient_text" }); continue; }
      fetchedUrls.add(finalUrl);
      hosts.set(finalHost, (hosts.get(finalHost) ?? 0) + 1);
      sources.push({
        id: `S${sources.length + 1}`, url: finalUrl, title,
        retrievedAt: new Date().toISOString(), excerpt,
      });
      onSource?.({ url: finalUrl, outcome: "read" });
    } catch (error) {
      onSource?.({ url: item.url, outcome: error instanceof Error ? error.name : "fetch_failed" });
    }
  }
  return sources;
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
  const route = articleTask("research");
  const response = await measuredRequest("research", () => anthropic.messages.create({
    model: route.model, max_tokens: route.maxTokens,
    output_config: { format: zodOutputFormat(synthesisSchema) },
    system: `Prepare a research brief, not an article. Return JSON only with question, intent (informational/commercial/transactional/navigational), businessAngle, subquestions (1-8), claims (1-12 objects: text, sourceId, quote), warnings.
Write in the customer's language. Select relevant claims supported by verbatim quotes (20-700 characters) from the supplied excerpts. A claim must not be broader than its quote.
Prefer original research, official documentation and first-party sources. Search position does not establish credibility. Reject unsupported, stale, promotional or conflicting claims; explain gaps in warnings. Never invent a URL, statistic, service or quotation. Keep the business angle relevant without pretending sources describe the customer's business.
State the relevant platform, product, country, date and verification method INSIDE each claim. A Wix or Squarespace help page supports advice for that platform, not universal Google requirements. Do not confuse crawling, indexing and ownership verification. If the sources cannot answer the general question, say so in warnings and narrow the brief.
${dataRule("website_page")} ${dataRule("business_profile")}`,
    messages: [{ role: "user", content:
      dataBlock("business_profile", JSON.stringify({
        topic: brief.title, keyword: brief.targetKeyword, intent: brief.intent,
        language: brief.language, country: brief.country, business: brief.brandName,
        services: brief.services, audience: brief.targetAudience, facts: brief.facts,
      })) + "\n" + dataBlock("website_page", JSON.stringify(sources)),
    }],
  }, { maxRetries: 0 }), measure);
  if (response.stop_reason !== "end_turn") throw new Error("Research did not finish");
  const text = response.content.find(b => b.type === "text")?.text ?? "";
  return { ...base, ...validateResearch(text, sources), status: "ready" };
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
Actively check scope: platform-specific advice must not be presented as universal. Compare the source title, publisher, relevant method and caveats with EACH claim. In particular, ownership verification, crawling and indexing are different operations; a restriction on one does not establish a restriction on the others. Flag unsupported universal requirements, guarantees, and timelines even if a sentence resembles a quoted excerpt.
${dataRule("website_page")} ${dataRule("business_profile")}`,
    messages: [{ role: "user", content:
      dataBlock("business_profile", JSON.stringify({ language: brief.language, facts: brief.facts, services: brief.services })) +
      "\n" + dataBlock("website_page", JSON.stringify({ research, draft: html.slice(0, 65000) })),
    }],
  }, { maxRetries: 0 }), measure);
  if (response.stop_reason !== "end_turn") throw new Error("Evidence review did not finish");
  const result = evidenceSchema.parse(
    JSON.parse(response.content.find(b => b.type === "text")?.text ?? ""),
  );
  return { checked: true, issues: [...issues, ...result.issues] };
}
