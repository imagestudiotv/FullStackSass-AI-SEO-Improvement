import type { Metadata } from "next";

import { DEFAULT_LOCALE } from "@/lib/i18n/config";

import { DirectoryPage, directoryMetadata } from "./directory-page";

/**
 * The RepGet Customer Showcase's directory, /discover (client, 2026-11-11
 * round 2): every business growing with RepGet (lib/discover/profiles.ts).
 * Per request: its counts change with every upvote, comment and view.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = directoryMetadata(DEFAULT_LOCALE);

export default async function DiscoverPage() {
  return <DirectoryPage locale={DEFAULT_LOCALE} />;
}
