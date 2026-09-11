/**
 * Barrel of every Inngest function.
 *
 * serve() reads this list. A function that is not in `functions` silently never
 * runs — no error, no warning — so register it here and nowhere else.
 *
 * test-retry is deliberately NOT registered. It is a demo function proving
 * step memoisation, and registering it exposes a live endpoint that anyone
 * able to send events could trigger in production. The file is kept because
 * it documents the memoisation guarantee the paid jobs depend on.
 */
import { analyzeWebsite } from "./analyze-website";
import { auditWebsite } from "./audit-website";
import { checkGeo } from "./check-geo";
import { generateArticle } from "./generate-article";
import { importAnalytics } from "./import-analytics";
import { publishArticleJob } from "./publish-article";
import { researchKeywords } from "./research-keywords";
import { scheduledArticles } from "./scheduled-articles";
import { verifyBacklinks } from "./verify-backlinks";

export const functions = [
  analyzeWebsite,
  auditWebsite,
  researchKeywords,
  generateArticle,
  verifyBacklinks,
  checkGeo,
  publishArticleJob,
  scheduledArticles,
  importAnalytics,
];
