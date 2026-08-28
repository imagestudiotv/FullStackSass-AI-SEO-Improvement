import { sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { inngest } from "@/inngest/client";

/**
 * Two-step function proving Inngest step memoisation.
 *
 * Step one writes a row and increments a counter. Step two updates that row,
 * or throws when the event asks it to. On retry Inngest replays the function
 * from the top but returns step one's *memoised* result instead of running it
 * again — so the counter must not move on retries.
 *
 * The whole article-generation pipeline (Days 10-11) depends on this: without
 * memoisation a failure in the publish step would re-run generation and burn
 * LLM spend on every retry.
 *
 * Rows live in provider_cache because it is the only table with no foreign
 * keys, so this test needs no organization or website fixtures.
 */

const COUNTER_HASH = "inngest-test:step-one-executions";

export const testRetry = inngest.createFunction(
  {
    id: "test-retry",
    retries: 2,
    triggers: [{ event: "test/retry.demo" }],
  },
  async ({ event, step }) => {
    const runKey = `inngest-test:run:${event.data?.runKey ?? "default"}`;
    const shouldFail = Boolean(event.data?.fail);

    const stepOne = await step.run("write-row", async () => {
      // Atomic increment; counts every real execution of this step.
      const counter = await db.execute(sql`
        insert into provider_cache (provider, endpoint, params_hash, response)
        values ('inngest-test', 'counter', ${COUNTER_HASH}, '{"count":1}'::jsonb)
        on conflict (params_hash) do update
          set response = jsonb_set(
            provider_cache.response,
            '{count}',
            to_jsonb(coalesce((provider_cache.response->>'count')::int, 0) + 1)
          )
        returning (response->>'count')::int as count
      `);

      await db.execute(sql`
        insert into provider_cache (provider, endpoint, params_hash, response)
        values ('inngest-test', 'run', ${runKey}, jsonb_build_object('stepOne', true, 'stepTwo', false))
        on conflict (params_hash) do update
          set response = jsonb_set(provider_cache.response, '{stepOne}', 'true'::jsonb)
      `);

      const row = counter[0] as { count: number } | undefined;
      return { wrote: runKey, stepOneExecutions: row?.count ?? -1 };
    });

    const stepTwo = await step.run("update-row", async () => {
      if (shouldFail) {
        throw new Error("Deliberate failure in step two (retry test)");
      }
      await db.execute(sql`
        update provider_cache
        set response = jsonb_set(provider_cache.response, '{stepTwo}', 'true'::jsonb)
        where params_hash = ${runKey}
      `);
      return { updated: runKey };
    });

    return { stepOne, stepTwo };
  },
);
