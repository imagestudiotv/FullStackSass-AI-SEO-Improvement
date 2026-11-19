import { and, eq, inArray } from "drizzle-orm";
import { Clapperboard } from "lucide-react";
import type { Metadata } from "next";

import { Badge } from "@/components/ui/badge";
import { db } from "@/lib/db";
import { videoStockAssets } from "@/lib/db/schema";
import { formatDate, formatNumber } from "@/lib/i18n/format";
import { AI_HOOK_LIBRARY, AI_PROVIDER, AI_REJECTED_TAKES, aiClipPath, type AiHookClip } from "@/lib/video/footage/ai-library";
import type { HookType } from "@/lib/video/formats";
import { sharedFileUrl } from "@/lib/video/storage";

import { AdminPage, AdminPageHeader, AdminSection, AdminStat } from "../_ui/page";
import { AdminEmpty, AdminUnavailable } from "../_ui/states";
import { formatSeconds, formatUsd, summarizeClips } from "./summary";

export const metadata: Metadata = { title: "AI clips" };

/**
 * Admin -> AI clips (client, 2026-11-19: "it's not clear how much we spend,
 * what exact videos we generate"): every clip in RepGet's AI hook library
 * (lib/video/footage/ai-library.ts), what each cost to make, the batch it came
 * in, and when a customer's video last used it. Reads the library and one
 * query; makes no AI call.
 */

const TYPE_LABEL: Record<HookType, { label: string; hint: string }> = {
  anticipation: { label: "Anticipation", hint: "An ending the viewer has to see" },
  impossible: { label: "Impossible", hint: "Something that looks impossible" },
  danger: { label: "Danger", hint: "One wrong move ends it" },
};

const DAY: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" };

/** When each clip was last used in a video, by clip id; null when the query failed. */
async function lastUsedByClip(ids: string[]): Promise<Map<string, Date> | null> {
  if (ids.length === 0) return new Map();
  try {
    const rows = await db
      .select({ providerId: videoStockAssets.providerId, lastUsedAt: videoStockAssets.lastUsedAt })
      .from(videoStockAssets)
      .where(and(eq(videoStockAssets.provider, AI_PROVIDER), inArray(videoStockAssets.providerId, ids)));
    const used = new Map<string, Date>();
    for (const row of rows) {
      if (!row.lastUsedAt) continue;
      const known = used.get(row.providerId);
      if (!known || row.lastUsedAt > known) used.set(row.providerId, row.lastUsedAt);
    }
    return used;
  } catch (error) {
    console.error("[admin/ai-clips] last-used query failed", error);
    return null;
  }
}

export default async function AdminAiClipsPage() {
  const summary = summarizeClips(AI_HOOK_LIBRARY, new Date(), AI_REJECTED_TAKES);
  const used = await lastUsedByClip(AI_HOOK_LIBRARY.map((clip) => clip.id));
  const usedCount = used ? AI_HOOK_LIBRARY.filter((clip) => used.has(clip.id)).length : null;
  const monthName = formatDate(`${summary.month}-01T00:00:00Z`, "en", { month: "long", year: "numeric", timeZone: "UTC" });

  return (
    <AdminPage>
      <AdminPageHeader
        title="AI clips"
        description="RepGet's own AI-made hook clips (Google Gemini Omni Flash, 8 s, vertical 720p) that open viral videos; the customer's text and brand go on top. They are made in batches of about 10 per ticket and checked by hand before they are added. A customer's video costs nothing more for using one."
      />

      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <AdminStat
          label="Clips"
          value={formatNumber(summary.count, "en")}
          hint={usedCount === null ? "Use in videos unavailable" : `${formatNumber(usedCount, "en")} used in a video so far`}
        />
        <AdminStat label="Total spent" value={formatUsd(summary.totalUsd)} hint={`Every take made, at the Gemini API's price per second${summary.rejected ? `, including ${formatNumber(summary.rejected, "en")} not kept` : ""}.`} />
        <AdminStat
          label="Spent this month"
          value={formatUsd(summary.monthUsd)}
          hint={`${formatNumber(summary.monthCount, "en")} ${summary.monthCount === 1 ? "clip" : "clips"} made in ${monthName} (UTC).`}
        />
        {(Object.keys(TYPE_LABEL) as HookType[]).map((type) => (
          <AdminStat key={type} label={TYPE_LABEL[type].label} value={formatNumber(summary.byType[type], "en")} hint={TYPE_LABEL[type].hint} />
        ))}
      </div>

      {used === null ? (
        <AdminUnavailable
          title="Could not load when the clips were last used"
          description="The clips and costs below are complete; only the last-used dates are missing. Reload the page to try again."
        />
      ) : null}

      {summary.batches.length === 0 ? (
        <AdminSection bodyClassName="p-0">
          <AdminEmpty
            filtering={false}
            icon={Clapperboard}
            noun="clips"
            title="No AI clips yet"
            description="Each checked batch shows here with its clips, prompts and cost. Until the first one is added, viral videos open with the hand-picked Pixabay clips."
          />
        </AdminSection>
      ) : (
        summary.batches.map((batch) => (
          <AdminSection
            key={batch.madeOn}
            id={`batch-${batch.madeOn}`}
            title={`Made ${formatDate(`${batch.madeOn}T00:00:00Z`, "en", DAY)}`}
            description={`${formatNumber(batch.clips.length, "en")} ${batch.clips.length === 1 ? "clip" : "clips"}${batch.rejected ? ` (+${formatNumber(batch.rejected, "en")} ${batch.rejected === 1 ? "take" : "takes"} not kept)` : ""} · ${formatUsd(batch.costUsd)}`}
          >
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {batch.clips.map((clip) => (
                <ClipCard key={clip.id} clip={clip} lastUsed={used === null ? undefined : (used.get(clip.id) ?? null)} />
              ))}
            </ul>
          </AdminSection>
        ))
      )}
    </AdminPage>
  );
}

/** One clip: the preview, its facts, its tags and the prompt it was made from. */
function ClipCard({ clip, lastUsed }: { clip: AiHookClip; lastUsed: Date | null | undefined }) {
  return (
    <li className="flex min-w-0 flex-col gap-3 rounded-lg border p-3">
      <video
        src={sharedFileUrl(aiClipPath(clip.id))}
        muted
        loop
        playsInline
        controls
        preload="metadata"
        aria-label={`AI clip ${clip.id}`}
        className="mx-auto aspect-[9/16] w-full max-w-[220px] rounded-md bg-black object-cover"
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="min-w-0 font-mono text-xs [overflow-wrap:anywhere]">{clip.id}</p>
        <Badge variant="secondary">{TYPE_LABEL[clip.type].label}</Badge>
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        <dt className="text-muted-foreground">Length</dt>
        <dd className="tabular-nums">{formatSeconds(clip.durationMs)}</dd>
        <dt className="text-muted-foreground">Climax at</dt>
        <dd className="tabular-nums">{formatSeconds(clip.climaxMs)}</dd>
        <dt className="text-muted-foreground">Cost</dt>
        <dd className="tabular-nums">{formatUsd(clip.costUsd)}</dd>
        <dt className="text-muted-foreground">Last used</dt>
        <dd>
          {lastUsed === undefined
            ? "Unavailable"
            : lastUsed === null
              ? "Not used yet"
              : `In a video: ${formatDate(lastUsed, "en", DAY)}`}
        </dd>
      </dl>
      {clip.tags.length > 0 ? (
        <ul className="flex flex-wrap gap-1" aria-label="Tags">
          {clip.tags.map((tag) => (
            <li key={tag} className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
              {tag}
            </li>
          ))}
        </ul>
      ) : null}
      <details className="text-sm">
        <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Prompt</summary>
        <p className="mt-2 whitespace-pre-wrap text-foreground/85 [overflow-wrap:anywhere]">{clip.prompt}</p>
      </details>
    </li>
  );
}
