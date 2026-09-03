import { Bot, Check, X } from "lucide-react";

import { DomainToolForm } from "@/components/domain-tool-form";
import {
  MoreTools,
  ToolCta,
  ToolExplainer,
  ToolHero,
} from "@/components/tool-page";
import { AI_CRAWLERS, parseCrawlerAccess } from "@/lib/audit/ai-crawlers";
import { InvalidUrlError, normalizeWebsiteUrl } from "@/lib/websites/url";

export const metadata = {
  title: "AI Crawler Checker",
  description:
    "Check whether GPTBot, ClaudeBot, PerplexityBot and Google-Extended are allowed to read your site. Free, no signup.",
};

export const dynamic = "force-dynamic";

const HREF = "/tools/ai-crawler-checker";

/** Fetches robots.txt, returning null when there is none. */
async function fetchRobotsTxt(origin: string): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(`${origin}/robots.txt`, {
      signal: controller.signal,
      headers: { accept: "text/plain", "user-agent": "SEOVisionBot/1.0" },
    });
    if (!response.ok) return null;
    return (await response.text()).slice(0, 200_000);
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

async function check(input: string): Promise<Outcome> {
  let normalized;
  try {
    normalized = normalizeWebsiteUrl(input);
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof InvalidUrlError
          ? error.message
          : "Enter a valid website address",
    };
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

export default async function AiCrawlerCheckerPage({
  searchParams,
}: PageProps<"/tools/ai-crawler-checker">) {
  const params = await searchParams;
  const domain = typeof params.domain === "string" ? params.domain.trim() : "";
  const outcome = domain ? await check(domain) : null;

  const blocked = outcome?.ok
    ? outcome.crawlers.filter((c) => !c.allowed)
    : [];

  return (
    <div>
      <ToolHero
        title="AI Crawler Checker"
        description="Checks whether the assistants people now ask for recommendations are allowed to read your site. Blocking them is almost always an accident — and nothing in your own dashboard will ever tell you it happened."
      >
        <DomainToolForm
          key={domain}
          action={HREF}
          defaultValue={domain}
          submitLabel="Check AI access"
        />
      </ToolHero>

      <div className="mx-auto max-w-5xl px-4">
        {outcome && !outcome.ok ? (
          <div
            className="mt-10 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm"
            role="alert"
          >
            <p className="font-medium">We could not check that website</p>
            <p className="mt-1 text-muted-foreground">{outcome.error}</p>
          </div>
        ) : null}

        {outcome?.ok ? (
          <div className="mt-10 space-y-4">
            <div
              className={`rounded-xl border p-5 ${
                blocked.length > 0 ? "border-destructive/40 bg-destructive/5" : "bg-card"
              }`}
            >
              <p className="font-medium">
                {blocked.length === 0
                  ? `${outcome.domain} is readable by every major AI assistant.`
                  : `${outcome.domain} blocks ${blocked.length} of ${outcome.crawlers.length} AI crawlers.`}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {outcome.hasRobots ? (
                  <>
                    Read from{" "}
                    <a
                      href={outcome.robotsUrl}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="underline underline-offset-2"
                    >
                      {outcome.robotsUrl}
                    </a>
                    .
                  </>
                ) : (
                  "This site has no robots.txt, which means nothing is blocked."
                )}
              </p>
            </div>

            <ul className="grid gap-3 sm:grid-cols-2">
              {outcome.crawlers.map((crawler) => (
                <li
                  key={crawler.agent}
                  className="flex items-start gap-3 rounded-xl border bg-card p-4"
                >
                  {crawler.allowed ? (
                    <Check
                      className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400"
                      aria-hidden="true"
                    />
                  ) : (
                    <X
                      className="mt-0.5 size-4 shrink-0 text-destructive"
                      aria-hidden="true"
                    />
                  )}
                  <div className="min-w-0">
                    <p className="font-medium">{crawler.owner}</p>
                    <p className="font-mono text-xs text-muted-foreground">
                      {crawler.agent}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {crawler.allowed
                        ? crawler.explicit
                          ? "Allowed by a rule naming it."
                          : "Allowed — nothing blocks it."
                        : crawler.explicit
                          ? "Blocked by a rule naming it directly."
                          : "Blocked by a rule applying to all crawlers."}
                    </p>
                  </div>
                </li>
              ))}
            </ul>

            {/* The fix, spelled out, since this is the whole point of the tool. */}
            {blocked.length > 0 ? (
              <div className="rounded-xl border bg-card p-5">
                <p className="font-medium">How to allow them</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Remove the blocking rules from {outcome.robotsUrl}, or replace
                  them with an explicit allow for each crawler:
                </p>
                <pre className="mt-3 overflow-x-auto rounded-lg bg-muted p-3 font-mono text-xs">
                  {blocked
                    .map((c) => `User-agent: ${c.agent}\nAllow: /`)
                    .join("\n\n")}
                </pre>
              </div>
            ) : null}
          </div>
        ) : null}

        {!outcome ? (
          <div className="mt-10 flex gap-3 rounded-xl border bg-card p-5">
            <Bot
              className="mt-0.5 size-5 shrink-0 text-primary"
              aria-hidden="true"
            />
            <div className="text-sm text-muted-foreground">
              <p>We check these crawlers:</p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {AI_CRAWLERS.map((crawler) => (
                  <li
                    key={crawler.agent}
                    className="rounded-full border px-3 py-1 font-mono text-xs"
                  >
                    {crawler.agent}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : null}
      </div>

      <ToolExplainer
        columns={[
          {
            heading: "What this checks",
            body: "We fetch your robots.txt and read the rules for each AI crawler by name, respecting the precedence robots.txt actually uses — a rule naming GPTBot beats a wildcard rule blocking everything. No robots.txt at all means nothing is blocked, which is both correct and the common case.",
          },
          {
            heading: "Why this happens by accident",
            body: "Security plugins and copied configs add blocks for these agents by default, and a lot of sites picked one up during the wave of \"block AI scrapers\" advice. The result is that a business cannot be cited by ChatGPT at all — while their website, their rankings and their analytics all look completely normal.",
          },
        ]}
      />

      <MoreTools currentHref={HREF} />

      <ToolCta
        headline="Being readable is the start. Being cited is the goal."
        body="SeoVision tracks whether AI assistants actually recommend you, then writes the content that gets you named."
      />
    </div>
  );
}
