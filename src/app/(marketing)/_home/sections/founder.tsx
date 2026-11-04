import Image from "next/image";

import { copilotFounderReviewsCopy } from "@/lib/i18n/home/copilot-founder-reviews";
import { getMessages } from "@/lib/i18n/messages";

import { rich } from "../text";
import type { SectionProps } from "../types";
import styles from "./founder.module.css";

/** The design's class names, through the module. */
const c = (names: string) =>
  names
    .split(" ")
    .map((name) => styles[name] ?? name)
    .join(" ");

/**
 * Who the founder is, as the client's design gives it: his name and his own
 * two profiles. Nothing else in the codebase names him, so this is the one
 * place to correct it.
 */
const FOUNDER = {
  name: "Dumitru Culiuc",
  profiles: [
    { network: "linkedin", label: "LinkedIn", url: "https://www.linkedin.com/in/imagestudio" },
    { network: "instagram", label: "Instagram", url: "https://www.instagram.com/dumitruculiuc/" },
  ],
} as const;

/**
 * Built by (client's design, design.html `#repget-founder`): the founder, in
 * his own words, with his photograph and two pills that say what the copy
 * says - a length of experience he gave, not a result.
 */
export function Founder({ locale }: SectionProps) {
  const t = copilotFounderReviewsCopy(locale).founder;

  return (
    <section className={c("rp2-founder")} id="repget-founder" aria-labelledby="rp2-founder-title">
      <div className={c("rp2-founder-inner")}>
        <div className={c("rp2-founder-text")}>
          <span className={c("rp2-eyebrow")}>{t.eyebrow}</span>
          <h2 id="rp2-founder-title">{FOUNDER.name}</h2>
          <p className={c("rp2-founder-role")}>{t.role}</p>
          <p className={c("rp2-founder-copy")}>{rich(t.body)}</p>
          <p className={c("rp2-founder-copy rp2-founder-copy-last")}>{rich(t.body2)}</p>
          <div className={c("rp2-social-links")} role="group" aria-label={t.profilesLabel}>
            {FOUNDER.profiles.map((profile) => (
              <a
                key={profile.network}
                target="_blank"
                rel="noopener noreferrer"
                href={profile.url}
                aria-label={`${t.profile.replace("{name}", FOUNDER.name).replace("{network}", profile.label)} ${getMessages(locale).home.opensInNewTab}`}
              >
                {profile.network === "linkedin" ? <LinkedInMark /> : <InstagramMark />} {profile.label}
              </a>
            ))}
          </div>
        </div>

        <div className={c("rp2-founder-portrait-column")}>
          <div className={c("rp2-founder-circle")}>
            <Image src="/images/home/founder-dumitru-culiuc.webp" alt={t.portraitAlt} width={535} height={486} sizes="(max-width: 720px) 360px, 440px" />
          </div>
          <div className={c("rp2-founder-pill rp2-founder-pill-top")}>
            <span className={c("rp2-pill-icon")} aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                <rect x="3" y="5" width="18" height="16" rx="3" />
                <path d="M7 3v5M17 3v5M3 10h18" />
              </svg>
            </span>
            <div>
              <strong>{t.yearsValue}</strong>
              <span>{t.yearsLabel}</span>
            </div>
          </div>
          <div className={c("rp2-founder-pill rp2-founder-pill-bottom")}>
            <span className={c("rp2-pill-icon")} aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M5 14 3 21l7-2 9-9-5-5-9 9Z" />
                <path d="m13 6 5 5" />
                <path d="M15 4c3-2 5-2 6-1 1 2-1 4-3 6" />
              </svg>
            </span>
            <div>
              <strong>{t.ledValue}</strong>
              <span>{t.ledLabel}</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/** LinkedIn's mark, as the design draws it on the profile button. */
function LinkedInMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        d="M20.4 2H3.6C2.72 2 2 2.7 2 3.56v16.88c0 .86.72 1.56 1.6 1.56h16.8c.88 0 1.6-.7 1.6-1.56V3.56c0-.86-.72-1.56-1.6-1.56ZM7.94 18.76H4.98V9.2h2.96v9.56ZM6.46 7.9a1.72 1.72 0 1 1 0-3.44 1.72 1.72 0 0 1 0 3.44Zm12.32 10.86h-2.95V14.1c0-1.1-.02-2.53-1.55-2.53-1.56 0-1.8 1.2-1.8 2.45v4.74H9.53V9.2h2.83v1.3h.04c.39-.74 1.36-1.54 2.79-1.54 2.99 0 3.55 1.97 3.55 4.54v5.26Z"
      />
    </svg>
  );
}

/** Instagram's outline, as the design draws it on the profile button. */
function InstagramMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="2.5" y="2.5" width="19" height="19" rx="5.5" />
      <circle cx="12" cy="12" r="4.1" />
      <circle cx="17.8" cy="6.4" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}
