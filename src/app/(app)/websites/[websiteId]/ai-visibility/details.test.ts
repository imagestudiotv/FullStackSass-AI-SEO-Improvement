import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { geoPrompts, geoResults, spendReservations, websites } from "@/lib/db/schema";
import { createTestDb, type TestDb } from "@/test/db";
import { seedWebsite } from "@/test/fixtures";

/**
 * The AI Visibility page's extra read, against a real database built from the
 * migrations: what evidence and history it returns per question, where it
 * draws the line between the latest and the previous check, how it reads a
 * requested check's state, and that it never returns another website's rows.
 */

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/lib/db", () => ({
  db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }),
}));
vi.mock("@/lib/tenant", () => ({
  requireWebsite: vi.fn(async (websiteId: string) => {
    const db = state.db as TestDb["db"];
    const [site] = await db.select().from(websites).where(eq(websites.id, websiteId));
    if (!site) throw new Error("not found");
    return { site, access: "owner" };
  }),
}));

import { HISTORY_PER_QUESTION, loadVisibilityDetails } from "./details";

let test: TestDb;

beforeAll(async () => {
  test = await createTestDb();
  state.db = test.db;
});

const NOW = new Date("2026-10-03T12:00:00Z");
const minutesAgo = (m: number) => new Date(NOW.getTime() - m * 60_000);
const daysAgo = (d: number) => minutesAgo(d * 24 * 60);

async function question(websiteId: string, prompt: string, createdAt = daysAgo(60)) {
  const [row] = await test.db
    .insert(geoPrompts)
    .values({ websiteId, prompt, createdAt })
    .returning({ id: geoPrompts.id });
  return row.id;
}

async function answer(
  websiteId: string,
  geoPromptId: string,
  checkedAt: Date,
  over: Partial<typeof geoResults.$inferInsert> = {},
) {
  await test.db.insert(geoResults).values({
    websiteId,
    geoPromptId,
    engine: "claude",
    mentioned: false,
    checkedAt,
    ...over,
  });
}

describe("loadVisibilityDetails", () => {
  it("returns the latest answer's evidence and a bounded history per question", async () => {
    const { websiteId } = await seedWebsite(test);
    const weekly = await question(websiteId, "Which dentist in Utrecht is best for nervous patients?");
    for (let week = 0; week < 8; week += 1) {
      await answer(websiteId, weekly, daysAgo(week * 7), { mentioned: week % 2 === 0, position: week % 2 === 0 ? 2 : null });
    }
    const named = await question(websiteId, "Who does emergency dental work near Utrecht centraal?");
    await answer(websiteId, named, minutesAgo(3), {
      mentioned: true,
      position: 1,
      cited: true,
      competitors: ["Bright Smile", "Tandarts Centrum"],
      excerpt: "Smile Studio is the first name most locals give.",
    });
    const never = await question(websiteId, "Is there a dentist open on Sunday in Utrecht?");

    const details = await loadVisibilityDetails(websiteId, NOW);

    expect(details.questions[weekly].latest).toMatchObject({ mentioned: true, position: 2, assistant: "Claude" });
    // Latest plus four earlier, not all eight.
    expect(details.questions[weekly].earlier).toHaveLength(HISTORY_PER_QUESTION - 1);
    expect(details.questions[weekly].earlier[0]).toEqual({ checkedAt: daysAgo(7), mentioned: false, position: null });

    expect(details.questions[named].latest).toEqual({
      checkedAt: minutesAgo(3),
      mentioned: true,
      position: 1,
      assistant: "Claude",
      cited: true,
      competitors: ["Bright Smile", "Tandarts Centrum"],
      excerpt: "Smile Studio is the first name most locals give.",
    });
    expect(details.questions[named].earlier).toEqual([]);

    // Never checked: present (its creation time matters to a running check) with no answer.
    expect(details.questions[never]).toEqual({ createdAt: daysAgo(60), latest: null, earlier: [] });
    expect(details.assistants).toEqual(["Claude"]);
  });

  it("finds where the latest check started and when the previous one ran", async () => {
    const { websiteId } = await seedWebsite(test);
    const a = await question(websiteId, "Best physiotherapist in Leiden for runners?");
    const b = await question(websiteId, "Affordable sports massage in Leiden?");
    // Latest check: answers 10 and 4 minutes ago. Previous: a week ago, 20 minutes apart.
    await answer(websiteId, a, minutesAgo(10));
    await answer(websiteId, b, minutesAgo(4));
    await answer(websiteId, a, daysAgo(7));
    await answer(websiteId, b, minutesAgo(7 * 24 * 60 + 20));

    const details = await loadVisibilityDetails(websiteId, NOW);
    expect(details.latestRunStartedAt).toEqual(minutesAgo(10));
    expect(details.previousRunAt).toEqual(daysAgo(7));
  });

  it("has no run dates before the first answer", async () => {
    const { websiteId } = await seedWebsite(test);
    await question(websiteId, "Who repairs bicycles in Delft on Saturdays?");
    const details = await loadVisibilityDetails(websiteId, NOW);
    expect(details.latestRunStartedAt).toBeNull();
    expect(details.previousRunAt).toBeNull();
    expect(details.request).toBeNull();
    expect(details.assistants).toEqual([]);
  });

  it("reads the newest requested check and its state from its reservation", async () => {
    const { websiteId, orgId } = await seedWebsite(test);
    await question(websiteId, "Which bakery in Haarlem makes sourdough?");
    const reservation = (createdAt: Date, over: Partial<typeof spendReservations.$inferInsert> = {}) => ({
      key: `geo-check:site:${websiteId}`,
      operation: "geo.check",
      organizationId: orgId,
      websiteId,
      limitValue: 2,
      windowSeconds: 3600,
      countedAt: createdAt,
      createdAt,
      ...over,
    });
    await test.db.insert(spendReservations).values([
      reservation(minutesAgo(50), { state: "consumed", spendStartedAt: minutesAgo(49) }),
      reservation(minutesAgo(2)),
      // Another website's check, and the workspace-wide key, are not this page's.
      { ...reservation(minutesAgo(1)), key: `geo-check:org:${orgId}` },
    ]);

    const details = await loadVisibilityDetails(websiteId, NOW);
    expect(details.request).toMatchObject({
      requestedAt: minutesAgo(2),
      elapsedMs: 2 * 60_000,
      state: "reserved",
      spendStarted: false,
    });
  });

  it("never returns another website's questions or answers", async () => {
    const mine = await seedWebsite(test);
    const theirs = await seedWebsite(test);
    const own = await question(mine.websiteId, "Where can I get a same-day haircut in Gouda?");
    const other = await question(theirs.websiteId, "Where can I get a same-day haircut in Gouda?");
    await answer(theirs.websiteId, other, minutesAgo(5), { mentioned: true, position: 1 });

    const details = await loadVisibilityDetails(mine.websiteId, NOW);
    expect(Object.keys(details.questions)).toEqual([own]);
    expect(details.questions[own].latest).toBeNull();
    expect(details.latestRunStartedAt).toBeNull();
  });
});
