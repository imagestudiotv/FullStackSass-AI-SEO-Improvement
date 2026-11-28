import { describe, expect, it } from "vitest";

import { LOCALES } from "@/lib/i18n/config";
import { getMessages } from "@/lib/i18n/messages";
import { topicMetrics } from "./labels";

describe("topicMetrics", () => {
  const en = getMessages("en").app.calendar;
  it("shows an unmeasured difficulty as a dash, never as 0", () => {
    expect(topicMetrics(0, 900, en)).toBe("Difficulty - · Volume 900");
    expect(topicMetrics(null, 900, en)).toBe("Difficulty - · Volume 900");
    expect(topicMetrics(34, 900, en)).toBe("Difficulty 34 · Volume 900");
    expect(topicMetrics(34, null, en)).toBe("Difficulty 34");
  });
  it("shows nothing when neither figure is known", () => {
    expect(topicMetrics(0, null, en)).toBeNull();
    expect(topicMetrics(null, null, en)).toBeNull();
  });
  it("speaks each dashboard language", () => {
    expect(topicMetrics(0, 50, getMessages("es").app.calendar)).toBe("Dificultad - · Volumen 50");
    expect(topicMetrics(0, 50, getMessages("de").app.calendar)).toBe("Schwierigkeit - · Suchvolumen 50");
    for (const locale of LOCALES) {
      const t = getMessages(locale).app.calendar;
      expect(t.difficulty.trim()).not.toBe("");
      expect(t.volume.trim()).not.toBe("");
    }
  });
});
