/**
 * Barrel of every Inngest function.
 *
 * serve() reads this list. A function that is not in `functions` silently never
 * runs — no error, no warning — so register it here and nowhere else.
 */
import { analyzeWebsite } from "./analyze-website";
import { testRetry } from "./test-retry";

export const functions = [analyzeWebsite, testRetry];
