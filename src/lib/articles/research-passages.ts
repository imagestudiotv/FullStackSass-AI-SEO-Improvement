import type { ResearchSource } from "./research-types";

/** The model selects IDs; quotations are copied from fetched text by code. */
export function researchPassages(sources: ResearchSource[]) {
  return sources.flatMap(source => {
    const passages: { id: string; sourceId: string; quote: string }[] = [];
    let offset = 0;
    while (offset < source.excerpt.length) {
      const remaining = source.excerpt.slice(offset);
      let end = Math.min(600, remaining.length);
      if (end < remaining.length) {
        const window = remaining.slice(0, end);
        // Prefer a sentence boundary; use a word boundary for long sentences.
        const boundary = [...window.matchAll(/[.!?](?:\s|$)/g)].at(-1)?.index;
        const space = window.lastIndexOf(" ");
        end = boundary !== undefined && boundary >= 200 ? boundary + 1 : space >= 200 ? space : end;
      }
      const quote = remaining.slice(0, end).trim();
      if (quote.length >= 20) passages.push({ id: `${source.id}:P${passages.length + 1}`, sourceId: source.id, quote });
      offset += end;
    }
    return passages;
  });
}
