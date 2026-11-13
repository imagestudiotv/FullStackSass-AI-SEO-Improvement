import { permanentRedirect } from "next/navigation";

/**
 * The workspace's credit history moved to /credits (client, 2026-10-26):
 * credits are spent across RepGet now, not only on backlinks, and they
 * always belonged to the workspace rather than to one website. Old links and
 * bookmarks land there.
 */
export default function CreditActivityPage(): never {
  permanentRedirect("/credits");
}
