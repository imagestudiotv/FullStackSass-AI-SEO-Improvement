import "server-only";

/**
 * Who may see and choose the Google properties a website imports from.
 *
 * THE PROBLEM. A website's Google connection is ONE Google account's token,
 * and that account usually reaches far more than this website: an agency's
 * account lists every client's Search Console sites and GA4 properties.
 * listProperties used to authorise READ access to the RepGet website and then
 * list everything the account could see - so an invited viewer saw the
 * owner's other clients - and selectProperties let any invited editor save
 * any property id, which the next import then pulled into this website.
 *
 * THE BOUNDARY (server-side; the UI only mirrors it):
 *  - The person who connected the Google account may list and choose its
 *    properties: it is their own account.
 *  - The website's owner side (anyone in the workspace that owns it) may do so
 *    for a connection the owner side made - or one made before this rule was
 *    recorded, which was the owner's.
 *  - Nobody else. A guest editor cannot browse or repoint the owner's
 *    account; a guest viewer cannot do either on any connection; and the
 *    owner cannot browse a GUEST's account (an agency that connected its own
 *    account to a client's site must not expose its other clients either).
 *  - Replacing or disconnecting a connection: its owner side, or the person
 *    who made it. A guest editor cannot swap the owner's account for theirs.
 *
 * A choice is stored as an APPROVAL bound to the connection it was made on
 * (who connected it). The import only fetches an approved, still-current
 * binding, and checks again that the token can reach it - so metadata changed
 * any other way, a queued job, or a reconnect by someone else imports nothing.
 * Being reachable by the token is never enough on its own.
 */

export type ConnectedBy = {
  userId: string;
  /** The connector's access to the website when they connected. */
  access: "owner" | "editor";
  at: string;
};

export type PropertyApproval = {
  searchConsoleSite: string | null;
  analyticsProperty: string | null;
  approvedBy: string;
  approvedAt: string;
  /** connectedBy.userId of the connection it was approved on; null for a pre-rule connection. */
  connection: string | null;
};

/** The parts of the stored Google metadata this module reads. */
export type PropertyMeta = {
  searchConsoleSite?: string | null;
  analyticsProperty?: string | null;
  connectedBy?: ConnectedBy | null;
  approval?: PropertyApproval | null;
};

export type Actor = { userId: string; access: "owner" | "editor" | "viewer" };

export type PropertyPermissions = {
  /** List the account's properties and choose (approve) them for this website. */
  canManageProperties: boolean;
  /** Connect a (different) Google account, or disconnect this one. */
  canReplaceConnection: boolean;
};

export function propertyPermissions(actor: Actor, meta: PropertyMeta | null): PropertyPermissions {
  if (actor.access === "viewer") return { canManageProperties: false, canReplaceConnection: false };
  // No connection yet: an owner or an editor may connect one (their own account).
  if (!meta) return { canManageProperties: false, canReplaceConnection: true };

  const connectedBy = meta.connectedBy ?? null;
  const ownAccount = connectedBy?.userId === actor.userId;
  const ownersConnection = connectedBy === null || connectedBy.access === "owner";

  return {
    canManageProperties: ownAccount || (actor.access === "owner" && ownersConnection),
    canReplaceConnection: ownAccount || actor.access === "owner",
  };
}

/** "sc-domain:example.com" or a URL-prefix property ("https://example.com/"). */
export function isSearchConsoleSiteId(value: string): boolean {
  if (value.length > 2048) return false;
  if (/^sc-domain:[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?)+$/i.test(value)) return true;
  try {
    const url = new URL(value);
    return (url.protocol === "https:" || url.protocol === "http:") && value.endsWith("/") && !url.username && !url.password && !url.search && !url.hash;
  } catch {
    return false;
  }
}

/** "properties/123456789". */
export function isAnalyticsPropertyId(value: string): boolean {
  return /^properties\/[1-9]\d{0,19}$/.test(value);
}

export type ApprovedBinding = {
  searchConsoleSite: string | null;
  analyticsProperty: string | null;
  /**
   * "approved": chosen by someone allowed to, on this connection.
   * "legacy": chosen before approvals were recorded, on a connection made
   * before connectors were recorded - kept importing so nobody's reporting
   * stops; the owner is asked to confirm it.
   * "none": nothing may be imported.
   */
  basis: "approved" | "legacy" | "none";
  /** A choice is stored that may NOT be imported (stale or never approved). */
  unapproved: boolean;
};

/**
 * The properties an import may fetch: the stored choice only where it is
 * approved for the current connection and well-formed.
 */
export function approvedBinding(meta: PropertyMeta | null): ApprovedBinding {
  const selected = {
    searchConsoleSite: meta?.searchConsoleSite ?? null,
    analyticsProperty: meta?.analyticsProperty ?? null,
  };
  const anySelected = Boolean(selected.searchConsoleSite || selected.analyticsProperty);
  const valid = (value: string | null, check: (v: string) => boolean) => (value && check(value) ? value : null);

  if (!meta) return { searchConsoleSite: null, analyticsProperty: null, basis: "none", unapproved: false };

  const approval = meta.approval ?? null;
  if (approval) {
    const connection = meta.connectedBy?.userId ?? null;
    if (approval.connection !== connection) {
      return { searchConsoleSite: null, analyticsProperty: null, basis: "none", unapproved: anySelected };
    }
    const sc = selected.searchConsoleSite === approval.searchConsoleSite ? valid(selected.searchConsoleSite, isSearchConsoleSiteId) : null;
    const ga = selected.analyticsProperty === approval.analyticsProperty ? valid(selected.analyticsProperty, isAnalyticsPropertyId) : null;
    const unapproved = (selected.searchConsoleSite !== null && sc === null) || (selected.analyticsProperty !== null && ga === null);
    return { searchConsoleSite: sc, analyticsProperty: ga, basis: sc || ga ? "approved" : "none", unapproved };
  }

  if (!meta.connectedBy && anySelected) {
    const sc = valid(selected.searchConsoleSite, isSearchConsoleSiteId);
    const ga = valid(selected.analyticsProperty, isAnalyticsPropertyId);
    return { searchConsoleSite: sc, analyticsProperty: ga, basis: sc || ga ? "legacy" : "none", unapproved: true };
  }

  return { searchConsoleSite: null, analyticsProperty: null, basis: "none", unapproved: anySelected };
}

/**
 * The metadata to keep when a Google account is (re)connected.
 *  - The same person reconnecting keeps their choice and its approval.
 *  - The owner side reconnecting a pre-rule connection keeps the choice
 *    visible but unapproved: the owner confirms it with one click.
 *  - Anyone else connecting starts from nothing: a choice approved on another
 *    account is stale and never carries over.
 */
export function metaAfterConnect<T extends PropertyMeta>(previous: T | null, connectedBy: ConnectedBy): PropertyMeta {
  const sameConnector = previous?.connectedBy?.userId === connectedBy.userId;
  if (previous && sameConnector) return { ...previous, connectedBy };
  if (previous && !previous.connectedBy && connectedBy.access === "owner") {
    return {
      ...previous,
      connectedBy,
      approval: null,
    };
  }
  return {
    ...(previous ?? {}),
    connectedBy,
    searchConsoleSite: null,
    analyticsProperty: null,
    approval: null,
  };
}
