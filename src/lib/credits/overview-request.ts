import "server-only";

import { cache } from "react";

import { creditOverview } from "./overview";

/**
 * The credit overview, once per request.
 *
 * The shell shows the balance three times - the pill beside the logo, the
 * phone header's pill and the line under "Earn Credits" - and each would
 * otherwise run creditOverview (and its grant check) again for the same
 * workspace on the same render.
 */
export const creditOverviewForRequest = cache((organizationId: string) => creditOverview(organizationId));
