import type { CostItem, CreativeDirection, MediaItem, ResolvedAsset, ShotScene, VisualSource } from "./formats";
import { FOOTAGE_LIMITS, bestCandidate, configuredProviders, searchProvider, type StockCandidate, type StockProvider } from "./footage";

/**
 * Each scene's picture or clip, chosen when the video is made (never when
 * the idea is written: the swipe preview costs nothing), within the budget:
 *
 *   the scene's preferred source (ShotScene.visual.source) first, then
 *   1. the customer's own media (their library and the idea's own clips),
 *   2. licensed stock (footage/: a licensed collection, Pixabay, Pexels -
 *      only those configured; none configured = no network call),
 *   3. the article's pictures,
 *   4. original AI images (lib/images/generate.ts, at most 2 a video, only
 *      when configured and the budget allows),
 *   5. the brand's colours - only as a deliberate design (Text + Music and
 *      the animated templates): a footage-led video with nothing to show
 *      fails clearly instead (lib/video/make.ts), never falls back silently.
 *
 * Every asset keeps its provenance and licence (ResolvedAsset). The logic
 * takes its database, storage and providers as arguments so it can be tested
 * without any of them.
 */

/** ResolvedAsset plus what the composition needs (stored in video_ideas.assets). */
export type StoredAsset = ResolvedAsset & { durationMs?: number | null; width?: number | null; height?: number | null };

/** A stock file stored by RepGet (video_stock_assets row, or its test stand-in). */
export type CachedStock = {
  id: string;
  provider: string;
  providerId: string;
  kind: string;
  url: string;
  width: number | null;
  height: number | null;
  durationMs: number | null;
  licence: string;
  sourceUrl: string | null;
  author: string | null;
};

export type ResolverDeps = {
  /** The customer's library (video_media). */
  customerMedia(): Promise<MediaItem[]>;
  providers: readonly StockProvider[];
  findCached(query: string, kind: "video" | "image", exclude: Set<string>): Promise<CachedStock | null>;
  storeStock(candidate: StockCandidate, query: string, costUsd: number | null): Promise<CachedStock>;
  /** The per-use cost of a non-free provider's file (null = unknown). */
  stockCost(candidate: StockCandidate): Promise<number | null>;
  ai: {
    provider(): "openai" | "replicate" | null;
    estimateUsd(): number;
    generate(prompt: string): Promise<{ data: Buffer; contentType: string; costUsd: number }>;
    store(data: Buffer, contentType: string): Promise<string>;
  };
  /** Budget: hold before a paid step (throws when refused), test without holding, record after. */
  reserve(key: string, usd: number, label: string): Promise<void>;
  canAfford(key: string, usd: number): Promise<boolean>;
  record(item: Omit<CostItem, "attempt" | "at">, key?: string | null): Promise<void>;
  fetcher?: typeof fetch;
  log?(message: string): void;
};

export type ResolveInput = {
  direction: CreativeDirection;
  /** The plan's scenes, aligned with spokenParts (null entries allowed). */
  scenes: (ShotScene | null)[];
  /** The spokenParts indexes the video shows, in order. */
  parts: number[];
  /** idea.media: the article's pictures and the customer's clips. */
  media: MediaItem[];
  /** Assets already resolved (a retry): kept, nothing fetched again for those scenes. */
  existing?: StoredAsset[];
};

export type ResolveResult = { assets: StoredAsset[]; missing: number[]; notes: string[] };

/** Directions whose look is the footage: they need at least one real visual. */
export const FOOTAGE_LED: readonly CreativeDirection[] = ["meme", "footage", "storytelling", "voiceover"];

export const MAX_AI_IMAGES = 2;

const FALLBACK_ORDER: VisualSource[] = ["customer", "stock", "article", "ai_image", "brand"];

/** The sources to try for a scene: its preferred one, then the fixed order. */
export function sourceOrder(preferred: VisualSource | null | undefined): VisualSource[] {
  const first = preferred && FALLBACK_ORDER.includes(preferred) ? [preferred] : [];
  return [...first, ...FALLBACK_ORDER.filter((source) => source !== preferred)];
}

/** The prompt for an original AI picture: the scene's search words, photographic, never text or real people. */
export function aiPrompt(query: string): string {
  return `${query.trim().slice(0, 300)}. Authentic, realistic photograph, natural light, vertical composition with the subject centred. No text, no words, no letters, no logos, no watermarks. No celebrities or recognisable real people.`;
}

export async function resolveSceneAssets(input: ResolveInput, deps: ResolverDeps): Promise<ResolveResult> {
  const notes: string[] = [];
  const log = (message: string) => {
    notes.push(message);
    deps.log?.(message);
  };
  const assets: StoredAsset[] = [];
  const done = new Set<number>();
  for (const asset of input.existing ?? []) {
    if (input.parts.includes(asset.sceneIndex) && !done.has(asset.sceneIndex)) {
      assets.push(asset);
      done.add(asset.sceneIndex);
    }
  }

  const library = await deps.customerMedia().catch(() => [] as MediaItem[]);
  const libraryUrls = new Set(library.map((item) => item.url));
  const customer: MediaItem[] = [...input.media.filter((item) => libraryUrls.has(item.url)), ...library.filter((item) => !input.media.some((m) => m.url === item.url))];
  const article: MediaItem[] = input.media.filter((item) => !libraryUrls.has(item.url));
  const used = new Set(assets.map((asset) => asset.url));
  const usedStock = new Set(assets.filter((a) => a.providerId).map((a) => `${a.provider}:${a.providerId}`));
  const providers = configuredProviders(deps.providers);
  let downloads = 0;
  let aiImages = assets.filter((asset) => asset.source === "ai_image").length;
  const brandAllowed = !FOOTAGE_LED.includes(input.direction);

  const pickFrom = (pool: MediaItem[], kind: "video" | "image"): MediaItem | null =>
    pool.find((item) => !used.has(item.url) && item.kind === kind) ?? pool.find((item) => !used.has(item.url)) ?? null;

  for (const part of input.parts) {
    if (done.has(part)) continue;
    const scene = input.scenes[part] ?? null;
    const request = scene?.visual ?? { source: "customer" as VisualSource, query: "", kind: "video" as const };
    const query = request.query?.trim() ?? "";
    let chosen: StoredAsset | null = null;
    let deliberateBrand = false;

    for (const source of sourceOrder(request.source)) {
      if (source === "customer") {
        const item = pickFrom(customer, request.kind);
        if (item) chosen = { sceneIndex: part, url: item.url, kind: item.kind, source: "customer", provider: "customer", providerId: null, licence: "Customer's own media (uploaded by the customer)", sourceUrl: null, author: null, assetId: null };
      } else if (source === "stock") {
        if (!query || !providers.length) continue;
        const stock = await stockFor(part, query, request.kind, providers, usedStock, downloads, deps, log);
        if (stock?.downloaded) downloads += 1;
        chosen = stock?.asset ?? null;
      } else if (source === "article") {
        const item = pickFrom(article, request.kind);
        if (item) chosen = { sceneIndex: part, url: item.url, kind: item.kind, source: "article", provider: "article", providerId: null, licence: "The website's own article picture", sourceUrl: null, author: null, assetId: null };
      } else if (source === "ai_image") {
        if (aiImages >= MAX_AI_IMAGES || !query) continue;
        const provider = deps.ai.provider();
        if (!provider) continue;
        const key = `image:${part}`;
        const estimate = deps.ai.estimateUsd();
        if (!(await deps.canAfford(key, estimate))) {
          log(`Scene ${part}: no AI image - it would pass the production budget.`);
          continue;
        }
        await deps.reserve(key, estimate, "an AI image");
        try {
          const image = await deps.ai.generate(aiPrompt(query));
          await deps.record({ kind: "image", provider, usd: image.costUsd, basis: "estimated", note: `scene ${part}` }, key);
          const url = await deps.ai.store(image.data, image.contentType);
          aiImages += 1;
          chosen = { sceneIndex: part, url, kind: "image", source: "ai_image", provider, providerId: null, licence: "Original AI image generated for this video", sourceUrl: null, author: null, assetId: null };
        } catch (error) {
          // A failed generation may still be billed: recorded as unmeasured, never as free.
          await deps.record({ kind: "image", provider, usd: null, basis: "unmeasured", note: `scene ${part}: failed (${String((error as Error).message).slice(0, 80)})` }, key);
          log(`Scene ${part}: the AI image failed.`);
        }
      } else if (source === "brand") {
        if (brandAllowed) deliberateBrand = true;
      }
      if (chosen || deliberateBrand) break;
    }

    if (chosen) {
      used.add(chosen.url);
      if (chosen.providerId) usedStock.add(`${chosen.provider}:${chosen.providerId}`);
      assets.push(chosen);
      done.add(part);
    }
  }
  const missing = input.parts.filter((part) => !done.has(part));
  return { assets: assets.sort((a, b) => a.sceneIndex - b.sceneIndex), missing, notes };
}

async function stockFor(
  part: number,
  query: string,
  kind: "video" | "image",
  providers: StockProvider[],
  usedStock: Set<string>,
  downloads: number,
  deps: ResolverDeps,
  log: (message: string) => void,
): Promise<{ asset: StoredAsset; downloaded: boolean } | null> {
  const kinds: ("video" | "image")[] = kind === "video" ? ["video", "image"] : ["image", "video"];
  for (const wanted of kinds) {
    // 1. Already stored for this query: no network call, no cost.
    const cached = await deps.findCached(query, wanted, usedStock);
    if (cached) return { asset: fromCached(part, cached), downloaded: false };
    if (downloads >= FOOTAGE_LIMITS.maxAssetsPerVideo) continue;
    for (const provider of providers) {
      let candidates: StockCandidate[];
      try {
        candidates = await searchProvider(provider, { query, kind: wanted }, deps.fetcher);
      } catch (error) {
        log(`Scene ${part}: ${provider.id} search failed (${(error as Error).message}).`);
        continue;
      }
      const best = bestCandidate(candidates, usedStock);
      if (!best) continue;
      const key = `footage:${part}`;
      let cost: number | null = provider.free ? 0 : await deps.stockCost(best);
      if (!provider.free) await deps.reserve(key, cost ?? 0.01, `${provider.id} footage`);
      try {
        const stored = await deps.storeStock(best, query, cost);
        await deps.record(
          provider.free
            ? { kind: "footage", provider: provider.id, usd: 0, basis: "measured", note: `free provider, ${best.kind} ${best.providerId}` }
            : { kind: "footage", provider: provider.id, usd: cost, basis: cost === null ? "unmeasured" : "measured", note: `${best.kind} ${best.providerId}` },
          provider.free ? null : key,
        );
        return { asset: fromCached(part, stored), downloaded: true };
      } catch (error) {
        cost = null;
        if (!provider.free) await deps.record({ kind: "footage", provider: provider.id, usd: null, basis: "unmeasured", note: "download failed" }, key);
        log(`Scene ${part}: ${provider.id} download failed (${(error as Error).message}).`);
      }
    }
  }
  return null;
}

function fromCached(part: number, row: CachedStock): StoredAsset {
  return {
    sceneIndex: part,
    url: row.url,
    kind: row.kind === "image" ? "image" : "video",
    source: "stock",
    provider: row.provider,
    providerId: row.providerId,
    licence: row.licence,
    sourceUrl: row.sourceUrl,
    author: row.author,
    assetId: row.id,
    durationMs: row.durationMs,
    width: row.width,
    height: row.height,
  };
}

/**
 * Words that present the people on screen as the customer's own clients,
 * staff or results ("our client", "meet the team", "I'm Sarah, the owner")
 * in the content languages. Stock and AI footage under such words is marked
 * illustrative, and the idea writer is asked not to pair them (report to A).
 */
const IDENTITY_CLAIMS = [
  /\b(our|my) (client|customer|team|staff|employee|founder|owner|patient|student)s?\b/i,
  /\bmeet (the|our|my)\b/i,
  /\b(i am|i'm) [A-Z][a-z]+/,
  /\b(this is|these are) (our|my)\b/i,
  /\b(nos|nuestros?|notre|nostri|nostro|unsere?n?|nossos?|onze|nasi|nasz[aey]?|clien[tț]ii no[șs]tri)\s+(clients?|clientes|kunden|klanten|klien[cț]i|clienti|equipo|équipe|team|mitarbeiter|pacientes?)\b/i,
  // Romanian puts the possessive after the noun ("clienții noștri", "echipa noastră").
  /(clien[tț]ii|echipa|angaja[tț]ii|pacien[tț]ii)\s+(no[șs]tri|noastr[ăa]|mei|mea)/i,
];

export function identityClaim(text: string): boolean {
  return IDENTITY_CLAIMS.some((pattern) => pattern.test(text));
}

/** Stored assets read back from video_ideas.assets (anything malformed dropped). */
export function storedAssets(value: unknown): StoredAsset[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is StoredAsset =>
      Boolean(item && typeof item === "object" && typeof (item as StoredAsset).url === "string" && typeof (item as StoredAsset).sceneIndex === "number"),
  );
}
