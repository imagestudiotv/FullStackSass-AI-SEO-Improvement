import { Plus } from "lucide-react";
import Link from "next/link";

import styles from "../home.module.css";
import type { SectionProps } from "../types";
import local from "./closing.module.css";

/**
 * Questions (client's design, 2026-11-03): the introduction on the left,
 * sticky beside the list on a computer, above it on a phone.
 *
 * The questions are the FAQ page's own list (`m.faq.items`), in its order,
 * as the old homepage FAQ (home-faq.tsx) - so the two cannot disagree. The
 * design came with its own questions, some quoting social post allowances no
 * plan has; they are not used. The title is an h2: /faq's h1 would compete
 * with the hero's.
 *
 * Native <details>/<summary>: keyboard, screen readers and find-in-page work
 * without any JavaScript, and every answer is in the HTML.
 *
 * NO FAQPage structured data here, as before: /faq publishes it for these
 * same questions, and the same FAQPage on two URLs is duplicate markup.
 */
export function Faq({ c, m, href }: SectionProps) {
  const faq = m.faq;
  if (faq.items.length === 0) return null;

  return (
    <section id="faq" className={styles.faq} aria-labelledby="faq-title">
      <div className={styles.faqInner}>
        <div className={`${styles.faqIntro} ${styles.reveal}`} data-reveal="">
          <div className={styles.kicker}>{c.faq.eyebrow}</div>
          <h2 id="faq-title" className={styles.sectionTitle}>
            {faq.title}
          </h2>
          <p>{faq.subtitle}</p>
          <div className={styles.faqContact}>
            {c.faq.contactLead}{" "}
            <Link href={href("/contact")} className={local.focusRing}>
              {c.faq.contact}
            </Link>
          </div>
        </div>

        <div className={`${styles.faqList} ${styles.reveal}`} data-reveal="" data-delay="1">
          {faq.items.map((item) => (
            <details key={item.question} className={styles.faqItem}>
              <summary className={local.focusRing}>
                {item.question}
                <span className={styles.plus} aria-hidden="true">
                  <Plus />
                </span>
              </summary>
              <p>{item.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
