"use client";

import { useRef, useState, type KeyboardEvent, type ReactNode } from "react";

import styles from "./audit-landing.module.css";

/**
 * The sample report's tabs (client's design, 2026-11-05). Only which tab is
 * open lives here: the panels are rendered on the server and handed in. The
 * arrow keys, Home and End move between tabs, as the tabs pattern expects.
 */
export function AuditSampleTabs({
  title,
  label,
  note,
  tabs,
  panels,
}: {
  title: string;
  label: string;
  note: ReactNode;
  tabs: { id: string; label: string; icon: ReactNode }[];
  panels: ReactNode[];
}) {
  const [active, setActive] = useState(0);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const last = tabs.length - 1;
    const target =
      event.key === "ArrowRight" || event.key === "ArrowDown"
        ? index === last ? 0 : index + 1
        : event.key === "ArrowLeft" || event.key === "ArrowUp"
          ? index === 0 ? last : index - 1
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? last
              : null;
    if (target === null) return;
    event.preventDefault();
    setActive(target);
    buttons.current[target]?.focus();
  }

  return (
    <div className={styles.reportMain}>
      <div className={styles.reportNav}>
        <p className={styles.reportNavTitle}>{title}</p>
        <div role="tablist" aria-label={label} aria-orientation="vertical" className={styles.reportTabs}>
          {tabs.map((tab, index) => (
            <button
              key={tab.id}
              ref={(element) => {
                buttons.current[index] = element;
              }}
              id={`audit-tab-${tab.id}`}
              type="button"
              role="tab"
              aria-selected={index === active}
              aria-controls={`audit-panel-${tab.id}`}
              tabIndex={index === active ? 0 : -1}
              className={styles.reportTab}
              onClick={() => setActive(index)}
              onKeyDown={(event) => handleKeyDown(event, index)}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
        <div className={styles.reportNote}>{note}</div>
      </div>
      <div className={styles.reportPanels}>
        {tabs.map((tab, index) => (
          <div key={tab.id} id={`audit-panel-${tab.id}`} role="tabpanel" aria-labelledby={`audit-tab-${tab.id}`} hidden={index !== active}>
            {panels[index]}
          </div>
        ))}
      </div>
    </div>
  );
}
