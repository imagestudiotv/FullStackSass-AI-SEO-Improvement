import { redirect } from "next/navigation";

import { requireSession } from "@/lib/auth-guard";
import { listAccessibleWebsites } from "@/lib/websites/accessible";
import { readSelectedWebsite, resolveWebsiteId } from "@/lib/websites/selected";

export const dynamic = "force-dynamic";

/**
 * /social: Social Distribution for the website being worked on - the
 * address the free AI Social Media Post Generator (/tools/social-media-post-generator)
 * sends a visitor to after signing up or in, when it cannot know which
 * website they have. The same choice the sidebar and the dashboard make
 * (lib/websites/selected.ts); without a website, the dashboard, which leads
 * a new account through onboarding. Whatever the plan allows there applies:
 * this page grants nothing.
 */
export default async function SocialRedirectPage() {
  await requireSession();
  const websites = await listAccessibleWebsites();
  const id = resolveWebsiteId(
    null,
    await readSelectedWebsite(),
    websites.map((website) => website.id),
  );
  redirect(id ? `/websites/${id}/social` : "/dashboard");
}
