/**
 * Barrel of every Inngest function.
 *
 * serve() reads this list. A function that is not in `functions` silently never
 * runs — no error, no warning — so register it here and nowhere else.
 */
import { analyzeWebsite } from "./analyze-website";
import { auditWebsite } from "./audit-website";
import { checkGeo } from "./check-geo";
import { generateArticle } from "./generate-article";
import { importAnalytics } from "./import-analytics";
import { publishArticleJob } from "./publish-article";
import { researchKeywords } from "./research-keywords";
import { testRetry } from "./test-retry";
import { verifyBacklinks } from "./verify-backlinks";

export const functions = [
  analyzeWebsite,
  auditWebsite,
  researchKeywords,
  generateArticle,
  verifyBacklinks,
  checkGeo,
  publishArticleJob,
  importAnalytics,
  testRetry,
];
