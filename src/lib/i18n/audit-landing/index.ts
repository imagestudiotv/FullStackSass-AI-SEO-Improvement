import type { Locale } from "@/lib/i18n/config";

import { de } from "./de";
import { en } from "./en";
import { es } from "./es";
import { fr } from "./fr";
import { it } from "./it";
import type { AuditLandingCopy } from "./types";

export type { AuditLandingCopy, AuditLandingItem } from "./types";

const COPY: Record<Locale, AuditLandingCopy> = { en, es, fr, it, de };

export function auditLandingCopy(locale: Locale): AuditLandingCopy {
  return COPY[locale];
}
