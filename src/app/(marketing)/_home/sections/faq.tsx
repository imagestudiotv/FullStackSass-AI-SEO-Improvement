import Link from "next/link";
import { Fragment } from "react";

import { faqCopy } from "@/lib/i18n/home/faq";
import type { SectionProps } from "../types";
import styles from "./faq.module.css";
import { OneOpen } from "./faq-one-open";

/** The design's class names, through the module. */
const c = (names: string) =>
  names
    .split(" ")
    .map((name) => styles[name] ?? name)
    .join(" ");

/**
 * Questions (client's design, 2026-11-03; <section class="rpf-faq"
 * id="repget-faq">): the introduction on the left, sticky beside the list on
 * a computer, above it on a phone.
 *
 * The questions are the design's 14 in its three groups (client, 2026-11-04:
 * "i updated the faq with more options"), from lib/i18n/home/faq.ts. The
 * /faq page keeps its own list.
 *
 * Native <details>/<summary>: keyboard, screen readers and find-in-page work
 * without any JavaScript, and every answer is in the HTML. With JavaScript,
 * opening one closes the others, as in the design (OneOpen).
 *
 * NO FAQPage structured data here: /faq publishes it for its own questions.
 */
export function Faq({ locale, href }: SectionProps) {
  const t = faqCopy(locale);

  return (
    <section className={c("rpf-faq")} id="repget-faq" aria-labelledby="rpf-heading">
      <div className={c("rpf-faq-inner")}>
        <div className={c("rpf-intro")}>
          <div className={c("rpf-eyebrow")}>{t.eyebrow}</div>
          <h2 id="rpf-heading">{t.title}</h2>
          <p>{t.intro}</p>
          <div className={c("rpf-contact")}>
            {t.contactLead} <Link href={href("/contact")}>{t.contact}</Link>
          </div>
        </div>
        <div className={c("rpf-list")}>
          {t.groups.map((group) => (
            <Fragment key={group.title}>
              <div className={c("rpf-section")}>{group.title}</div>
              {group.items.map((item) => (
                <details key={item.question} className={c("rpf-item")}>
                  <summary>
                    <span>{item.question}</span>
                    <span className={c("rpf-plus")} aria-hidden="true">
                      +
                    </span>
                  </summary>
                  <div className={c("rpf-answer")}>
                    <p>{item.answer}</p>
                  </div>
                </details>
              ))}
            </Fragment>
          ))}
        </div>
      </div>
      <OneOpen sectionId="repget-faq" />
    </section>
  );
}
