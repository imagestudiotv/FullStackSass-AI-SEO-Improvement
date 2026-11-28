import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { creditSettings, spendReservations } from "@/lib/db/schema";
import { createTestDb, type TestDb } from "@/test/db";

/**
 * The site checkers in Admin -> Free tools (owner, 2026-11-27): each check
 * the shared guard admits is one use of its page, and a page switched off
 * fetches nothing.
 */

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/lib/db", () => ({
  db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }),
  isDatabaseConfigured: () => true,
}));

import { guardPublicTool } from "./public-guard";

let test: TestDb;

beforeAll(async () => {
  test = await createTestDb();
  state.db = test.db;
});

beforeEach(async () => {
  await test.db.delete(spendReservations);
  await test.db.delete(creditSettings);
});

const useRows = async () => (await test.db.select().from(spendReservations)).filter((row) => row.operation === "free_tool.use");

describe("the guarded site checks", () => {
  it("record one use of the tool page for each admitted check", async () => {
    const run = vi.fn(async () => "checked");
    expect(await guardPublicTool({ tool: "robots", site: "example.com", visitor: "v1", run })).toEqual({ ok: true, value: "checked" });
    expect(await guardPublicTool({ tool: "readability", site: "example.com", visitor: "v1", run, page: "keyword-density" })).toEqual({ ok: true, value: "checked" });
    const rows = await useRows();
    expect(rows.map((row) => row.key).sort()).toEqual(["free-tool:use:keyword-density", "free-tool:use:robots-checker"]);
    expect(rows[0].metadata).toMatchObject({ path: "server", visitor: "v1" });
  });

  it("fetch nothing while the page is switched off", async () => {
    await test.db.insert(creditSettings).values({ key: "tool_enabled:robots-checker", value: 0 });
    const run = vi.fn(async () => "checked");
    const outcome = await guardPublicTool({ tool: "robots", site: "example.com", visitor: "v1", run });
    expect(outcome).toMatchObject({ ok: false, refusal: { kind: "unavailable" } });
    expect(run).not.toHaveBeenCalled();
    expect(await test.db.select().from(spendReservations)).toHaveLength(0);
  });

  it("leave the audit and the homepage preview out: they are not free tool pages", async () => {
    await guardPublicTool({ tool: "preview", site: "example.com", visitor: "v1", run: async () => null });
    expect(await useRows()).toHaveLength(0);
  });
});
