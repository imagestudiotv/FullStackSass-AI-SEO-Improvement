import { localePath, type Locale } from "@/lib/i18n/config";
import { guestCopilotCopy } from "@/lib/i18n/guest-copilot";
import { TOOLS_COMMON } from "@/lib/tools/i18n/common";

import { GuestCopilotCard } from "./guest-copilot-card";
import styles from "./guest-copilot.module.css";

/** The free tool page's address: "Try the AI copilot free" leads there from the homepage and the tools hub. */
export const GUEST_COPILOT_TOOL = "/tools/growth-copilot";

/**
 * The guest Growth Copilot (client, 2026-11-11): three free questions a day
 * without an account, on the homepage, the free tools hub and its own tool
 * page. "Unlock full access" and every invitation in the chat go to sign-up
 * (an English-only page, like the header's); "Try the AI copilot free" goes
 * to the tool page, or to the chat itself when this IS the tool page.
 *
 * Only this language's words reach the browser.
 */
export function GuestCopilot({
  locale,
  onToolPage = false,
  id,
}: {
  locale: Locale;
  /** The tool page: its name is the page's h1, and "Try" stays on the page. */
  onToolPage?: boolean;
  /** The section's anchor (the homepage keeps the old Copilot section's). */
  id?: string;
}) {
  const titleId = `${id ?? "guest-copilot"}-title`;
  return (
    <section id={id} className={styles.wrap} aria-labelledby={titleId}>
      <GuestCopilotCard
        copy={guestCopilotCopy(locale)}
        locale={locale}
        tryHref={onToolPage ? null : localePath(locale, GUEST_COPILOT_TOOL)}
        signUpHref="/sign-up"
        toolTitle={onToolPage ? TOOLS_COMMON[locale].tools[GUEST_COPILOT_TOOL].title : null}
        titleId={titleId}
      />
    </section>
  );
}
