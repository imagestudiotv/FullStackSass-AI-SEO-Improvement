/**
 * "Watch an ad to earn credits" on Earn Credits (client ticket, 2026-11-13):
 * the deployment's settings, read from the environment.
 *
 * NO IMPORTS: src/proxy.ts reads this to decide whether /earn-credits' policy
 * allows Google Publisher Tag, and the page, the server actions and the card
 * read the same answer.
 *
 * OFF UNLESS EVERY DECISION IS MADE. The feature needs an Ad Manager rewarded
 * ad unit, and the reward and the daily limit are the owner's choice: none of
 * them has a default, so until all are set the card is not shown and every
 * action refuses. The other bounds have conservative defaults.
 *
 *   REWARDED_ADS_ENABLED=1                 the switch
 *   REWARDED_AD_UNIT_PATH=/1234567/unit    the Ad Manager rewarded ad unit (GPT ad unit path)
 *   REWARDED_ADS_CREDITS                   credits per ad watched to the end (no default)
 *   REWARDED_ADS_DAILY_LIMIT               ads per person per UTC day (no default)
 *   REWARDED_ADS_COOLDOWN_SECONDS          wait after a rewarded ad (default 300)
 *   REWARDED_ADS_WORKSPACE_DAILY_CAP       rewarded ads per workspace per day (default: the daily limit)
 *   REWARDED_ADS_GLOBAL_DAILY_CAP          rewarded ads across RepGet per day (default 200)
 *   REWARDED_ADS_MIN_SECONDS               shortest start-to-reward time accepted (default 8)
 *   REWARDED_ADS_SESSION_MINUTES           how long a started ad may take (default 15)
 *   REWARDED_ADS_TEST_MODE=1               Google's sample test ad unit; never on production
 */

/** Google's sample rewarded ad unit (developers.google.com/publisher-tag/samples/display-rewarded-ad). */
export const TEST_AD_UNIT_PATH = "/22639388115/rewarded_web_example";

/**
 * GPT loaded from its limited-ads address, so limited ads (no cookies or
 * local storage) can be switched on for a visitor who has not accepted
 * cookies (developers.google.com/publisher-tag/samples/display-limited-ad).
 */
export const GPT_SCRIPT_URL = "https://pagead2.googlesyndication.com/tag/js/gpt.js";

export const REWARDED_ADS_MAX = {
  credits: 100,
  dailyLimit: 50,
  cooldownSeconds: 24 * 60 * 60,
  globalDailyCap: 100_000,
  minSeconds: 120,
  sessionMinutes: 60,
} as const;

export type RewardedAdsProblem = "off" | "no_ad_unit" | "no_reward" | "no_limit" | "test_mode_in_production";

export type RewardedAdsConfig = {
  enabled: boolean;
  /** Why it is off; null when enabled. For the report and the admin, never shown to customers. */
  problem: RewardedAdsProblem | null;
  adUnitPath: string | null;
  testMode: boolean;
  rewardCredits: number;
  dailyLimit: number;
  cooldownSeconds: number;
  workspaceDailyCap: number;
  globalDailyCap: number;
  minSeconds: number;
  sessionMinutes: number;
};

type Env = Record<string, string | undefined>;

/** A whole number in [min, max], or the fallback when unset or invalid. */
function whole(raw: string | undefined, fallback: number, min: number, max: number): number {
  const value = raw?.trim();
  if (!value || !/^\d+$/.test(value)) return fallback;
  const n = Number(value);
  return n >= min && n <= max ? n : fallback;
}

/** A GPT ad unit path: "/<network code>[,<child network>]/<unit>[/<child unit>...]". */
export function isAdUnitPath(value: string | undefined | null): value is string {
  return typeof value === "string" && value.length <= 200 && /^\/\d{2,20}(?:,\d{2,20})?(?:\/[A-Za-z0-9_.\-]{1,100}){1,5}$/.test(value);
}

export function rewardedAdsConfig(env: Env = process.env): RewardedAdsConfig {
  const switched = env.REWARDED_ADS_ENABLED?.trim() === "1";
  const testMode = env.REWARDED_ADS_TEST_MODE?.trim() === "1";
  // A positive "production" only, as lib/deployment.ts reads it.
  const production = env.VERCEL_ENV === "production";
  const unit = env.REWARDED_AD_UNIT_PATH?.trim();
  const rewardCredits = whole(env.REWARDED_ADS_CREDITS, 0, 0, REWARDED_ADS_MAX.credits);
  const dailyLimit = whole(env.REWARDED_ADS_DAILY_LIMIT, 0, 0, REWARDED_ADS_MAX.dailyLimit);
  const adUnitPath = testMode && !production ? TEST_AD_UNIT_PATH : isAdUnitPath(unit) ? unit : null;

  const problem: RewardedAdsProblem | null = !switched
    ? "off"
    : testMode && production
      ? "test_mode_in_production"
      : !adUnitPath
        ? "no_ad_unit"
        : rewardCredits <= 0
          ? "no_reward"
          : dailyLimit <= 0
            ? "no_limit"
            : null;

  return {
    enabled: problem === null,
    problem,
    adUnitPath: problem === null ? adUnitPath : null,
    testMode: testMode && !production,
    rewardCredits,
    dailyLimit,
    cooldownSeconds: whole(env.REWARDED_ADS_COOLDOWN_SECONDS, 300, 0, REWARDED_ADS_MAX.cooldownSeconds),
    workspaceDailyCap: whole(env.REWARDED_ADS_WORKSPACE_DAILY_CAP, dailyLimit, 1, REWARDED_ADS_MAX.globalDailyCap),
    globalDailyCap: whole(env.REWARDED_ADS_GLOBAL_DAILY_CAP, 200, 1, REWARDED_ADS_MAX.globalDailyCap),
    minSeconds: whole(env.REWARDED_ADS_MIN_SECONDS, 8, 1, REWARDED_ADS_MAX.minSeconds),
    sessionMinutes: whole(env.REWARDED_ADS_SESSION_MINUTES, 15, 1, REWARDED_ADS_MAX.sessionMinutes),
  };
}
