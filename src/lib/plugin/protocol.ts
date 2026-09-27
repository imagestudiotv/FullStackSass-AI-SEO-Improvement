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

export function pluginProtocol(version: string | null | undefined): Extract<DispatchProtocol, "plugin_v2" | "plugin_legacy"> {
  const match = /^(\d+)\.(\d+)\.(\d+)/.exec((version ?? "").trim());
  if (!match) return "plugin_legacy";
  const parts = match.slice(1, 4).map(Number);
  for (let i = 0; i < 3; i++) {
    if (parts[i] > PLUGIN_V2_MIN[i]) return "plugin_v2";
    if (parts[i] < PLUGIN_V2_MIN[i]) return "plugin_legacy";
  }
  return "plugin_v2";
}
