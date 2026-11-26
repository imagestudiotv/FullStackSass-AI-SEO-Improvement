// Pure: no imports, so the Remotion bundle (src/remotion) can use it too.

/**
 * Words that present the people on screen as the customer's own clients,
 * staff or results ("our client", "meet the team", "I'm Sarah, the owner")
 * in the content languages. Stock and AI footage under such words is marked
 * illustrative, and the idea writer is asked not to pair them (report to A).
 */
const IDENTITY_CLAIMS = [
  /\b(our|my) (client|customer|team|staff|employee|founder|owner|patient|student)s?\b/i,
  /\bmeet (the|our|my)\b/i,
  /\b(i am|i'm) [A-Z][a-z]+/,
  /\b(this is|these are) (our|my)\b/i,
  /\b(nos|nuestros?|notre|nostri|nostro|unsere?n?|nossos?|onze|nasi|nasz[aey]?|clien[tț]ii no[șs]tri)\s+(clients?|clientes|kunden|klanten|klien[cț]i|clienti|equipo|équipe|team|mitarbeiter|pacientes?)\b/i,
  // Romanian puts the possessive after the noun ("clienții noștri", "echipa noastră").
  /(clien[tț]ii|echipa|angaja[tț]ii|pacien[tț]ii)\s+(no[șs]tri|noastr[ăa]|mei|mea)/i,
];

export function identityClaim(text: string): boolean {
  return IDENTITY_CLAIMS.some((pattern) => pattern.test(text));
}
