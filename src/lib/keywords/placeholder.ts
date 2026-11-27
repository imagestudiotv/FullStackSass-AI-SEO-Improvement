/**
 * The example in the "add your own keywords" field, from the website's own
 * profile.
 *
 * It said "wedding videographer tuscany, elopement film italy" to every
 * website - the first customer's - and a Ukrainian greetings site was told
 * that is the kind of thing to type (review of 2026-11-27). Now: two of the
 * site's own services, as search terms, or nothing, and the field shows a
 * neutral hint instead.
 */
export function keywordExamples(profile: { services?: unknown; industry?: string | null }): string | null {
  const services = Array.isArray(profile.services)
    ? profile.services.filter((item): item is string => typeof item === "string")
    : [];
  const terms = [...services, ...(profile.industry ? [profile.industry] : [])]
    .map((term) => term.normalize("NFC").toLowerCase().replace(/[.,;:!?"«»“”]+/g, " ").replace(/\s+/g, " ").trim())
    // A search term, not a sentence.
    .filter((term) => term.length >= 3 && term.length <= 40 && term.split(" ").length <= 5);
  const unique = [...new Set(terms)].slice(0, 2);
  return unique.length ? unique.join(", ") : null;
}
