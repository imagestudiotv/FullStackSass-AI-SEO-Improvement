import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { addons } from "@/lib/db/schema";
import { createTestDb, type TestDb } from "@/test/db";

import { TOP_UP_PACK_SLUG } from "./buy-credits";
import { smallestCreditPack } from "./pack-rate";

/** The rate partners are paid in credits at: the smallest real pack, whatever else is on sale. */

let test: TestDb;

beforeAll(async () => {
  test = await createTestDb();
});

beforeEach(async () => {
  await test.client.exec("delete from addons;");
});

const pack = (slug: string, creditsGranted: number, priceCents: number) => ({
  slug,
  name: `${creditsGranted} credits`,
  priceCents,
  currency: "eur",
  creditsGranted,
  kind: "credits",
  isActive: true,
});

describe("the partners' credit rate", () => {
  it("is the smallest pack's", async () => {
    await test.db.insert(addons).values([pack("credits_25", 250, 14900), pack("credits_10", 100, 7900)]);
    expect(await smallestCreditPack(test.db)).toEqual({ priceCents: 7900, credits: 100, currency: "eur" });
  });

  it("is not changed by putting the 50-credit top-up on sale", async () => {
    await test.db.insert(addons).values([pack(TOP_UP_PACK_SLUG, 50, 4900), pack("credits_10", 100, 7900)]);
    expect(await smallestCreditPack(test.db)).toEqual({ priceCents: 7900, credits: 100, currency: "eur" });
  });
});
