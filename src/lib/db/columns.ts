import { text, timestamp, uuid } from "drizzle-orm/pg-core";

import { organization, user } from "./auth-tables";

/**
 * Shared column helpers. Use these everywhere so the schema stays consistent.
 *
 * Application tables use their own uuid primary keys. Foreign keys pointing at
 * Better Auth's organization.id or user.id must be TEXT — those columns are
 * text, and a uuid column referencing them fails the migration with a
 * confusing type error.
 */

/** uuid primary key for application tables. */
export const pk = () => uuid("id").primaryKey().defaultRandom();

/** Tenant foreign key. Text, not uuid. Cascades so deleting an org cleans up. */
export const organizationId = () =>
  text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" });

/** Optional actor foreign key. Text, not uuid. */
export const userId = () =>
  text("user_id").references(() => user.id, { onDelete: "set null" });

export const timestamps = {
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
};
