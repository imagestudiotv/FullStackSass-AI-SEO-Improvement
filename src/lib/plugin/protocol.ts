import type { DispatchProtocol } from "@/lib/publishing/dispatch";

/**
 * The WordPress plugin's report protocol, from the version it announces in
 * X-RepGet-Plugin-Version (sent by 1.6.0 and later).
 *
 *   plugin_v2     - 1.6.0+: each report echoes the dispatch id it answers and
 *                   the status WordPress actually stored.
 *   plugin_legacy - anything older, or no header: reports name only the
 *                   article, and the status is the one requested.
 */
export const PLUGIN_V2_MIN = [1, 6, 0] as const;

/**
 * 1.9.0+: links a translation to its article in WPML (lib/articles/
 * translations.ts). An older plugin would publish it as one more post in the
 * site's main language, so it is never handed one.
 */
export const PLUGIN_TRANSLATIONS_MIN = [1, 9, 0] as const;

/**
 * Handed an article it already published, the plugin updates that post rather
 * than creating a second one. Only from 1.10.0 does the featured image follow:
 * 1.6 to 1.9 set it on creation only, so an update with a new picture would be
 * recorded as sent with the old one. Below that, an update is not offered.
 *
 * Also the first that can act on a Publish press on a post it holds as a
 * WordPress draft (existingDraft in lib/plugin/due.ts's feed): it compares the
 * draft with what it wrote, and publishes that same post. An older plugin would
 * overwrite the draft and leave it a draft, so it is never handed one.
 */
export const PLUGIN_UPDATES_MIN = [1, 10, 0] as const;

/** True for a version string at or above `min`; false for anything unreadable. */
function atLeast(version: string | null | undefined, min: readonly [number, number, number]): boolean {
  const match = /^(\d+)\.(\d+)\.(\d+)/.exec((version ?? "").trim());
  if (!match) return false;
  const parts = match.slice(1, 4).map(Number);
  for (let i = 0; i < 3; i++) {
    if (parts[i] > min[i]) return true;
    if (parts[i] < min[i]) return false;
  }
  return true;
}

export function pluginProtocol(version: string | null | undefined): Extract<DispatchProtocol, "plugin_v2" | "plugin_legacy"> {
  return atLeast(version, PLUGIN_V2_MIN) ? "plugin_v2" : "plugin_legacy";
}

export function pluginUpdates(version: string | null | undefined): boolean {
  return atLeast(version, PLUGIN_UPDATES_MIN);
}

export function pluginTranslates(version: string | null | undefined): boolean {
  return atLeast(version, PLUGIN_TRANSLATIONS_MIN);
}

/** The plugin version a key's site info names ("6.4.3 / plugin 1.10.0"). */
export function siteInfoPluginVersion(siteInfo: string | null | undefined): string | undefined {
  return siteInfo?.match(/plugin (\d+\.\d+\.\d+)/)?.[1];
}
