import { CalendarDays, Rocket } from "lucide-react";
import Image from "next/image";

import { BrandIcon } from "@/components/brand-icons";

import styles from "../home.module.css";
import { rich } from "../text";
import type { SectionProps } from "../types";
import own from "./story.module.css";

/**
 * Who the founder is, as the client's design gives it
 * (RepGet_Full_Homepage_CTA_Official_Footer.html, "Built by"): his name and
 * his own two profiles. Nothing else in the codebase names him, so this is
 * the one place to correct it. A null name shows the role as the heading;
 * an empty list hides the profile buttons.
 */
const FOUNDER: {
  name: string | null;
  profiles: { network: "linkedin" | "instagram"; label: string; url: string }[];
} = {
  name: "Dumitru Culiuc",
  profiles: [
    { network: "linkedin", label: "LinkedIn", url: "https://www.linkedin.com/in/imagestudio" },
    { network: "instagram", label: "Instagram", url: "https://www.instagram.com/dumitruculiuc/" },
  ],
};

/**
 * Built by: the founder, in his own words, with his photograph.
 *
 * The two pills on the portrait say what the copy says (yearsValue,
 * ledValue): a length of experience he gave, not a result.
 */
export function Founder({ c, m }: SectionProps) {
  const t = c.founder;

  return (
    <section id="repget-founder" className={styles.founder} aria-labelledby="repget-founder-title">
      <div className={styles.founderInner}>
        <div className={styles.reveal} data-reveal>
          <span className={styles.eyebrowPill}>{t.eyebrow}</span>
          <h2 id="repget-founder-title">{FOUNDER.name ?? t.role}</h2>
          {FOUNDER.name ? <p className={styles.founderRole}>{t.role}</p> : null}
          <p className={styles.bodyText}>{rich(t.body)}</p>
          <p className={styles.bodyText}>{rich(t.body2)}</p>

          {FOUNDER.profiles.length > 0 ? (
            <div className={styles.socials}>
              {FOUNDER.profiles.map((profile) => (
                <a
                  key={profile.network}
                  href={profile.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={own.focusRing}
                >
                  {profile.network === "linkedin" ? <LinkedInMark /> : <BrandIcon name="instagram" />}
                  {FOUNDER.name ? <span className={styles.srOnly}>{FOUNDER.name} </span> : null}
                  {profile.label}
                  <span className={styles.srOnly}> {m.home.opensInNewTab}</span>
                </a>
              ))}
            </div>
          ) : null}
        </div>

        <div className={`${styles.portrait} ${styles.reveal}`} data-reveal data-delay="1">
          <div className={styles.portraitCircle}>
            <Image
              src="/images/home/founder.webp"
              alt={FOUNDER.name ?? ""}
              width={560}
              height={560}
              sizes="(max-width: 900px) 360px, 440px"
            />
          </div>
          <div className={`${styles.portraitPill} ${styles.pillTop}`}>
            <i aria-hidden="true">
              <CalendarDays strokeWidth={1.6} />
            </i>
            <div>
              <strong>{t.yearsValue}</strong>
              <span>{t.yearsLabel}</span>
            </div>
          </div>
          <div className={`${styles.portraitPill} ${styles.pillBottom}`}>
            <i aria-hidden="true">
              <Rocket strokeWidth={1.6} />
            </i>
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

/**
 * LinkedIn's mark, drawn here rather than in brand-icons.tsx: that file lists
 * only platforms the product connects to, and LinkedIn is not one of them.
 */
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
