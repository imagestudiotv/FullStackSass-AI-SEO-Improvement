"use client";

import { useState, type ReactNode } from "react";

import styles from "./pricing.module.css";

/**
 * The design's Monthly / Yearly switch and the plans it changes. Every card
 * carries both figures (server-rendered); this only says which one shows, so
 * without JavaScript the page reads as monthly, as the design opens.
 */
export function PlansBilling({
  sectionLabel,
  label,
  monthly,
  yearly,
  saving,
  children,
}: {
  sectionLabel: string;
  label: string;
  monthly: string;
  yearly: string;
  saving: string;
  children: ReactNode;
}) {
  const [period, setPeriod] = useState<"month" | "year">("month");

  return (
    <section aria-label={sectionLabel} className={`${styles.container} ${styles["plans-section"]}`} id="plans" data-billing={period}>
      <div className={styles["billing-wrap"]}>
        <div role="group" aria-label={label} className={styles.billing}>
          <button type="button" aria-pressed={period === "month"} onClick={() => setPeriod("month")}>
            {monthly}
          </button>
          <button type="button" aria-pressed={period === "year"} onClick={() => setPeriod("year")}>
            {yearly}
          </button>
        </div>
        <span className={styles.saving}>{saving}</span>
      </div>
      {children}
    </section>
  );
}
