import { Search } from "lucide-react";

import { WorkspaceSection } from "@/components/workspace/section";
import type { Messages } from "@/lib/i18n/messages";

import { savedForm, slugFromInput } from "./draft-state";

/**
 * The article's metadata as a search result may show it - title, address
 * and meta description - in the supporting panel, so it can be checked from
 * Preview too (and by viewers, who have no Edit tab), not only while the
 * fields are open. It follows the working copy: what is typed shows here at
 * once, and the description says when that includes unsaved changes. The
 * values are shown as they would be saved (the address tidied, the text
 * trimmed and capped).
 */
export function SearchAppearance({
  title,
  slug,
  metaDescription,
  websiteDomain,
  unsaved,
  t,
}: {
  title: string;
  slug: string;
  metaDescription: string;
  websiteDomain: string | null;
  /** The values include edits that are not saved yet. */
  unsaved: boolean;
  t: Messages["app"]["editor"];
}) {
  const shownTitle = savedForm("title", title);
  const shownMeta = savedForm("metaDescription", metaDescription);
  const address = slugFromInput(slug);

  return (
    <WorkspaceSection
      id="article-search"
      icon={Search}
      title={t.searchPreviewTitle}
      description={unsaved ? `${t.searchPreviewHelp} ${t.searchPreviewUnsaved}` : t.searchPreviewHelp}
    >
      <div className="min-w-0 space-y-1 rounded-lg border bg-muted/20 p-4">
        <p className="text-xs text-muted-foreground wrap-anywhere">
          {[websiteDomain, address].filter(Boolean).join(" › ")}
        </p>
        <p className="line-clamp-2 text-base font-medium text-foreground wrap-anywhere">{shownTitle || "-"}</p>
        {shownMeta ? (
          <p className="line-clamp-3 text-sm text-muted-foreground wrap-anywhere">{shownMeta}</p>
        ) : (
          <p className="text-sm text-muted-foreground">{t.metaNone}</p>
        )}
      </div>
    </WorkspaceSection>
  );
}
