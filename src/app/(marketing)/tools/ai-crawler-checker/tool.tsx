import { headers } from "next/headers";
import { Bot, Check, X } from "lucide-react";

import { DomainToolForm } from "@/components/domain-tool-form";
import { MoreTools, ToolCta, ToolExplainer, ToolHero } from "@/components/tool-page";
import { AI_CRAWLERS, parseCrawlerAccess } from "@/lib/audit/ai-crawlers";
import { localePath, type Locale } from "@/lib/i18n/config";
import { safeFetch } from "@/lib/net/safe-fetch";
import { TOOLS_COMMON } from "@/lib/tools/i18n/common";
import { localizeToolMessage } from "@/lib/tools/i18n/messages";
import { domainParam, toolMetadata } from "@/lib/tools/i18n/meta";
import { guardedSiteTool } from "@/lib/tools/public-guard";
import { visitorKey } from "@/lib/visitor-key";
import { InvalidUrlError, normalizeWebsiteUrl } from "@/lib/websites/url";

import { AI_CRAWLERS_COPY } from "./copy";

const HREF = "/tools/ai-crawler-checker";

export const aiCrawlersMetadata = (locale: Locale) => toolMetadata(HREF, locale, AI_CRAWLERS_COPY[locale].metaDescription);

/** Fetches robots.txt, returning null when there is none. */
async function fetchRobotsTxt(origin: string): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await safeFetch(`${origin}/robots.txt`, {
      signal: controller.signal,
      // Cut while streaming, not after downloading the whole file.
      maxBytes: 200_000,
      overflow: "truncate",
      headers: { accept: "text/plain", "user-agent": "RepGetBot/1.0 (+https://repget.com)" },
    });
    if (!response.ok) return null;
    return await response.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

type Outcome =
  | {
      ok: true;
      domain: string;
      robotsUrl: string;
      hasRobots: boolean;
      crawlers: ReturnType<typeof parseCrawlerAccess>;
    }
  | { ok: false; error: string };

/** Behind the shared abuse protection, like every free tool (lib/tools/public-guard.ts). */
async function check(input: string, visitor: string): Promise<Outcome> {
  return guardedSiteTool("ai-crawlers", input, visitor, () => checkUnguarded(input));
}

async function checkUnguarded(input: string): Promise<Outcome> {
  let normalized;
  try {
    normalized = normalizeWebsiteUrl(input);
  } catch (error) {
    return { ok: false, error: error instanceof InvalidUrlError ? error.message : "Enter a valid website address" };
  }

  const origin = new URL(normalized.url).origin;
  const robotsTxt = await fetchRobotsTxt(origin);

  return {
    ok: true,
    domain: normalized.domain,
    robotsUrl: `${origin}/robots.txt`,
    // No robots.txt means everything is allowed — a real answer, not a failure.
    hasRobots: robotsTxt !== null,
    crawlers: parseCrawlerAccess(robotsTxt),
  };
}

/** The AI Crawler Checker in any of the five languages. */
export async function AiCrawlersTool({ locale, searchParams }: { locale: Locale; searchParams: Record<string, string | string[] | undefined> }) {
  const t = AI_CRAWLERS_COPY[locale];
  const common = TOOLS_COMMON[locale];
  const domain = domainParam(searchParams);
  const outcome = domain ? await check(domain, visitorKey(await headers())) : null;

  const blocked = outcome?.ok ? outcome.crawlers.filter((c) => !c.allowed) : [];

  return (
    <div>
      <ToolHero title={common.tools[HREF].title} description={t.description} locale={locale}>
        <DomainToolForm
          key={domain}
          action={localePath(locale, HREF)}
          defaultValue={domain}
          submitLabel={t.submit}
          pendingLabel={common.checking}
          placeholder={common.placeholder}
          label={common.fieldLabel}
        />
      </ToolHero>

      <div className="mx-auto max-w-5xl px-4">
        {outcome && !outcome.ok ? (
          <div className="mt-10 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm" role="alert">
            <p className="font-medium">{common.couldNotCheck}</p>
            <p className="mt-1 text-muted-foreground">{localizeToolMessage(outcome.error, locale)}</p>
          </div>
        ) : null}

        {outcome?.ok ? (
          <div className="mt-10 space-y-4">
            <div className={`rounded-xl border p-5 ${blocked.length > 0 ? "border-destructive/40 bg-destructive/5" : "bg-card"}`}>
              <p className="font-medium">
                {blocked.length === 0
                  ? t.readableAll.replace("{domain}", outcome.domain)
                  : t.blocksSome
                      .replace("{domain}", outcome.domain)
                      .replace("{blocked}", String(blocked.length))
                      .replace("{total}", String(outcome.crawlers.length))}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {outcome.hasRobots ? (
                  <>
                    {t.readFrom}{" "}
                    <a href={outcome.robotsUrl} target="_blank" rel="noopener noreferrer nofollow" className="underline underline-offset-2">
                      {outcome.robotsUrl}
                    </a>
                    .
                  </>
                ) : (
                  t.noRobots
                )}
              </p>
            </div>

            <ul className="grid gap-3 sm:grid-cols-2">
              {outcome.crawlers.map((crawler) => (
                <li key={crawler.agent} className="flex items-start gap-3 rounded-xl border bg-card p-4">
                  {crawler.allowed ? (
                    <Check className="mt-0.5 size-4 shrink-0 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
                  ) : (
                    <X className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden="true" />
                  )}
                  <div className="min-w-0">
                    <p className="font-medium">{crawler.owner}</p>
                    <p className="font-mono text-xs text-muted-foreground">{crawler.agent}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {crawler.allowed
                        ? crawler.explicit
                          ? t.allowedNamed
                          : t.allowedNothing
                        : crawler.explicit
                          ? t.blockedNamed
                          : t.blockedAll}
                    </p>
                  </div>
                </li>
              ))}
            </ul>

            {/* The fix, spelled out, since this is the whole point of the tool. */}
            {blocked.length > 0 ? (
              <div className="rounded-xl border bg-card p-5">
                <p className="font-medium">{t.howTitle}</p>
                <p className="mt-1 text-sm text-muted-foreground">{t.howBody.replace("{url}", outcome.robotsUrl)}</p>
                <pre className="mt-3 overflow-x-auto rounded-lg bg-muted p-3 font-mono text-xs">
                  {blocked.map((c) => `User-agent: ${c.agent}\nAllow: /`).join("\n\n")}
                </pre>
              </div>
            ) : null}
          </div>
        ) : null}

        {!outcome ? (
          <div className="mt-10 flex gap-3 rounded-xl border bg-card p-5">
            <Bot className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
            <div className="text-sm text-muted-foreground">
              <p>{t.weCheck}</p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {AI_CRAWLERS.map((crawler) => (
                  <li key={crawler.agent} className="rounded-full border px-3 py-1 font-mono text-xs">
                    {crawler.agent}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : null}
      </div>

      <ToolExplainer columns={t.explainer} />

      <MoreTools currentHref={HREF} locale={locale} />

      <ToolCta headline={t.ctaHeadline} body={t.ctaBody} locale={locale} />
    </div>
  );
}
