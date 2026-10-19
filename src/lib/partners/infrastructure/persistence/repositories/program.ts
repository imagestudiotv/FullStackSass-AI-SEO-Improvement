import { asc, desc, eq, inArray, lte } from "drizzle-orm";

import { partnerProgramVersions, platformControls } from "@/lib/db/schema";
import type { Executor } from "@/lib/db/types";

import { parseProgramPolicy } from "../../../domain/policies/program";
import type {
  ControlsRepository,
  PartnerControlKey,
  ProgramRepository,
  ProgramVersion,
} from "../../../application/ports/repositories";

export const PARTNER_CONTROL_KEYS: PartnerControlKey[] = ["partner_program", "partner_commissions", "partner_payouts"];

function toVersion(row: typeof partnerProgramVersions.$inferSelect): ProgramVersion {
  return { id: row.id, policy: parseProgramPolicy(row.policy), effectiveFrom: row.effectiveFrom };
}

export function programRepository(db: Executor): ProgramRepository {
  return {
    async versionAt(at) {
      const [inForce] = await db
        .select()
        .from(partnerProgramVersions)
        .where(lte(partnerProgramVersions.effectiveFrom, at))
        .orderBy(desc(partnerProgramVersions.effectiveFrom), desc(partnerProgramVersions.version))
        .limit(1);
      if (inForce) return toVersion(inForce);
      const [earliest] = await db
        .select()
        .from(partnerProgramVersions)
        .orderBy(asc(partnerProgramVersions.effectiveFrom))
        .limit(1);
      if (!earliest) throw new Error("No partner program version exists (migration 0064 seeds version 1)");
      return toVersion(earliest);
    },
    async current() {
      return this.versionAt(new Date());
    },
  };
}

export function controlsRepository(db: Executor): ControlsRepository {
  return {
    async isEnabled(key) {
      const [row] = await db
        .select({ enabled: platformControls.enabled })
        .from(platformControls)
        .where(eq(platformControls.key, key))
        .limit(1);
      // A missing row means disabled.
      return row?.enabled ?? false;
    },
    async read() {
      const rows = await db
        .select()
        .from(platformControls)
        .where(inArray(platformControls.key, PARTNER_CONTROL_KEYS));
      const result = {} as Awaited<ReturnType<ControlsRepository["read"]>>;
      for (const key of PARTNER_CONTROL_KEYS) {
        const row = rows.find((r) => r.key === key);
        result[key] = {
          enabled: row?.enabled ?? false,
          reason: row?.reason ?? null,
          updatedBy: row?.updatedBy ?? null,
          updatedAt: row?.updatedAt ?? null,
        };
      }
      return result;
    },
    async write(key, enabled, meta) {
      const now = new Date();
      await db
        .insert(platformControls)
        .values({ key, enabled, reason: meta.reason, updatedBy: meta.actor, updatedAt: now })
        .onConflictDoUpdate({
          target: platformControls.key,
          set: { enabled, reason: meta.reason, updatedBy: meta.actor, updatedAt: now },
        });
    },
  };
}
