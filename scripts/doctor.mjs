/**
 * Preflight check: is this deployment actually ready to take money?
 *
 * Integrations here fail lazily and one at a time, deep inside a checkout or a
 * publish. That is right for the app - a missing DataForSEO key must not stop
 * the site booting - but it makes "did I configure everything?" unanswerable
 * without clicking through every flow. This answers it in one command.
 *
 * Two failures matter most because they are SILENT. Stripe price ids and
 * PayPal plan ids live in the database, not in env, so switching a key to live
 * mode leaves the old test-mode ids in place. Nothing detects that until a
 * real customer's checkout dies. Both are checked explicitly below.
 *
 *   npm run doctor
 *
 * Read-only: it never writes to the database or to the payment providers.
 */
import nextEnv from "@next/env";
import postgres from "postgres";

nextEnv.loadEnvConfig(process.cwd());

const pass = [];
const warn = [];
const fail = [];

const ok = (m) => pass.push(m);
const caution = (m, hint) => warn.push({ m, hint });
const bad = (m, hint) => fail.push({ m, hint });

const env = process.env;
const has = (k) => Boolean(env[k] && env[k].trim());

// ---------------------------------------------------------------- core

for (const key of ["DATABASE_URL", "DIRECT_URL", "BETTER_AUTH_SECRET"]) {
  if (has(key)) ok(`${key} is set`);
  else bad(`${key} is missing`, "The app cannot start without it.");
}

if (has("NEXT_PUBLIC_APP_URL")) {
  const url = env.NEXT_PUBLIC_APP_URL;
  if (url.includes("localhost")) {
    caution(
      `NEXT_PUBLIC_APP_URL is ${url}`,
      "Fine locally. In production this must be the real domain, or OAuth redirects and Stripe return URLs send customers to localhost.",
    );
  } else if (!url.startsWith("https://")) {
    bad(
      `NEXT_PUBLIC_APP_URL is not https (${url})`,
      "OAuth providers reject non-https redirect URLs.",
    );
  } else if (url.endsWith("/")) {
    caution(
      "NEXT_PUBLIC_APP_URL has a trailing slash",
      "Callback URLs may end up doubled (//callback).",
    );
  } else {
    ok(`NEXT_PUBLIC_APP_URL is ${url}`);
  }
} else {
  bad(
    "NEXT_PUBLIC_APP_URL is missing",
    "Checkout return URLs and OAuth callbacks are built from it.",
  );
}

if (has("CREDENTIALS_ENCRYPTION_KEY")) {
  ok("CREDENTIALS_ENCRYPTION_KEY is set");
} else if (has("BETTER_AUTH_SECRET")) {
  caution(
    "CREDENTIALS_ENCRYPTION_KEY is not set; falling back to BETTER_AUTH_SECRET",
    "Works, but rotating the auth secret would then make every stored WordPress/GSC credential undecryptable.",
  );
}

if (has("ANTHROPIC_API_KEY")) ok("ANTHROPIC_API_KEY is set");
else bad("ANTHROPIC_API_KEY is missing", "Article generation cannot run.");

if (has("ADMIN_EMAILS")) ok(`ADMIN_EMAILS is set (${env.ADMIN_EMAILS})`);
else caution("ADMIN_EMAILS is not set", "Nobody can reach /admin.");

/**
 * Images need a second AI vendor: Anthropic does not generate them. Absence is
 * a warning, not a blocker — articles publish fine without a header image.
 */
const imageProvider = env.IMAGE_PROVIDER?.trim().toLowerCase();
const hasOpenAi = has("OPENAI_API_KEY");
const hasReplicate = has("REPLICATE_API_TOKEN");

if (imageProvider === "openai" && !hasOpenAi) {
  bad("IMAGE_PROVIDER is openai but OPENAI_API_KEY is missing", "Articles publish without images.");
} else if (imageProvider === "replicate" && !hasReplicate) {
  bad(
    "IMAGE_PROVIDER is replicate but REPLICATE_API_TOKEN is missing",
    "Articles publish without images.",
  );
} else if (hasOpenAi && hasReplicate && !imageProvider) {
  caution(
    "Both OPENAI_API_KEY and REPLICATE_API_TOKEN are set",
    "Set IMAGE_PROVIDER to choose; until then image generation stays off rather than guessing.",
  );
} else if (hasOpenAi || hasReplicate) {
  const chosen = imageProvider ?? (hasOpenAi ? "openai" : "replicate");
  const model =
    chosen === "openai"
      ? ` using ${env.OPENAI_IMAGE_MODEL?.trim() || "gpt-image-2"}`
      : "";
  ok(`Article images enabled (${chosen}${model})`);
  caution(
    "Image generation has not been proven against the live API",
    "Run `npm run check:images` once. A wrong model id only fails at publish time, inside a job, after the article is written.",
  );
} else {
  caution(
    "No image provider configured",
    "Articles publish without a header image. Set OPENAI_API_KEY or REPLICATE_API_TOKEN to enable.",
  );
}

/**
 * Live chat is optional and marketing-only, so an unset id is a note rather
 * than a warning — the site works perfectly without it.
 */
const crispId = env.NEXT_PUBLIC_CRISP_WEBSITE_ID?.trim();
if (crispId) {
  const validId =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      crispId,
    );
  if (validId) ok("Live chat is enabled");
  else
    bad(
      "NEXT_PUBLIC_CRISP_WEBSITE_ID is not a valid Crisp id",
      "It should be a UUID from Crisp → Settings → Website Settings. The widget is skipped entirely until it is.",
    );
}

// ------------------------------------------------------------- support

const supportEmail = env.NEXT_PUBLIC_SUPPORT_EMAIL;
if (!supportEmail) {
  bad(
    "NEXT_PUBLIC_SUPPORT_EMAIL is not set",
    "Legal pages still show support@example.com. Privacy, terms and refunds all promise a contact address, so this must be real before launch.",
  );
} else if (supportEmail.endsWith("@example.com")) {
  bad(
    `NEXT_PUBLIC_SUPPORT_EMAIL is still a placeholder (${supportEmail})`,
    "Use a monitored address.",
  );
} else {
  ok(`Support email is ${supportEmail}`);
}

// ------------------------------------------------------------- billing

const stripeKey = env.STRIPE_SECRET_KEY ?? "";
const stripeLive = stripeKey.startsWith("sk_live_");

if (!stripeKey) {
  bad("STRIPE_SECRET_KEY is missing", "Card checkout is unavailable.");
} else if (stripeLive) {
  ok("Stripe is in LIVE mode");
} else {
  caution(
    "Stripe is in TEST mode",
    "Real cards will be declined. Switch to sk_live_ before launch.",
  );
}

if (has("STRIPE_WEBHOOK_SECRET")) ok("STRIPE_WEBHOOK_SECRET is set");
else if (stripeKey)
  bad(
    "STRIPE_WEBHOOK_SECRET is missing",
    "Payments would succeed at Stripe but never activate the subscription here.",
  );

const paypalLive = env.PAYPAL_ENV === "live";
if (has("PAYPAL_CLIENT_ID") && has("PAYPAL_CLIENT_SECRET")) {
  ok(`PayPal is configured (${paypalLive ? "LIVE" : "SANDBOX"})`);
  if (!has("PAYPAL_WEBHOOK_ID"))
    bad(
      "PAYPAL_WEBHOOK_ID is missing",
      "PayPal webhook signatures cannot be verified, so events are rejected.",
    );
} else {
  caution("PayPal is not configured", "Card-only checkout. Fine if intended.");
}

// ------------------------------------------------------------ database

if (has("DIRECT_URL")) {
  const sql = postgres(env.DIRECT_URL, { connect_timeout: 20 });
  try {
    const plans = await sql`
      select name, tier, interval, stripe_price_id, paypal_plan_id
      from plans where is_active = true order by sort_order
    `;

    if (plans.length === 0) {
      bad(
        "No active plans in the database",
        "Run `npm run db:seed`. Nothing can be purchased.",
      );
    } else {
      ok(`${plans.length} active plan(s)`);

      const noStripe = plans.filter((p) => !p.stripe_price_id);
      if (stripeKey && noStripe.length)
        bad(
          `${noStripe.length} plan(s) have no Stripe price id`,
          `Run \`npm run stripe:setup${stripeLive ? " -- --live" : ""}\`. Affected: ${noStripe
            .map((p) => `${p.tier}/${p.interval}`)
            .join(", ")}`,
        );

      /**
       * The silent killer. Stripe price ids are mode-scoped: a live key cannot
       * charge a test-mode price. Because the ids sit in the database, swapping
       * the key alone looks like it worked right up until a customer pays.
       *
       * Test-mode price ids are not reliably distinguishable by prefix, so this
       * asks Stripe to resolve one under the current key instead.
       */
      const sample = plans.find((p) => p.stripe_price_id);
      if (stripeKey && sample) {
        const res = await fetch(
          `https://api.stripe.com/v1/prices/${sample.stripe_price_id}`,
          { headers: { Authorization: `Bearer ${stripeKey}` } },
        );
        if (res.ok) {
          /**
           * Which ACCOUNT the key belongs to, printed alongside.
           *
           * Mode is only half the story: two different Stripe accounts each
           * have their own test mode, and objects are never shared between
           * them. A price can therefore be perfectly valid here and missing on
           * a deployment whose key belongs to a different account — which this
           * check would otherwise pass while checkout fails. Printing the
           * account id makes the two environments directly comparable.
           */
          let account = "";
          const acctRes = await fetch("https://api.stripe.com/v1/account", {
            headers: { Authorization: `Bearer ${stripeKey}` },
          });
          if (acctRes.ok) {
            const acct = await acctRes.json();
            const name = acct.settings?.dashboard?.display_name;
            account = ` on account ${acct.id}${name ? ` (${name})` : ""}`;
          }
          ok(
            `Stored Stripe price ids resolve under the current ${stripeLive ? "live" : "test"} key${account}`,
          );
        } else if (res.status === 404) {
          bad(
            `Stripe price ids in the database do not exist under the current ${stripeLive ? "LIVE" : "TEST"} key`,
            `Left over from the other mode. Run \`npm run stripe:setup${stripeLive ? " -- --live" : ""}\` to recreate them. Checkout WILL fail for every customer until you do.`,
          );
        } else {
          caution(
            `Could not verify Stripe price ids (HTTP ${res.status})`,
            "Check the key is valid.",
          );
        }
      }

      /**
       * Stored CUSTOMER ids are mode-scoped too, and are the half of this that
       * is easy to miss: prices are rewritten by `stripe:setup`, but customer
       * ids are written by checkout itself and nothing re-checks them. A
       * database that has seen both keys ends up with live prices and test
       * customers (or the reverse), and every affected workspace fails at
       * checkout while a freshly created one works.
       */
      const customerRows = await sql`
        select stripe_customer_id from subscriptions
        where stripe_customer_id is not null limit 5
      `;
      if (stripeKey && customerRows.length > 0) {
        let stale = 0;
        for (const row of customerRows) {
          const res = await fetch(
            `https://api.stripe.com/v1/customers/${row.stripe_customer_id}`,
            { headers: { Authorization: `Bearer ${stripeKey}` } },
          );
          if (res.status === 404) stale += 1;
        }
        if (stale === 0) {
          ok(`Stored Stripe customer ids resolve under the current ${stripeLive ? "live" : "test"} key`);
        } else {
          bad(
            `${stale} of ${customerRows.length} stored Stripe customer id(s) do not exist under the current ${stripeLive ? "LIVE" : "TEST"} key`,
            "Left over from the other mode. Those workspaces cannot check out until the id is cleared: `update subscriptions set stripe_customer_id = null where stripe_customer_id = '<id>';` — a new customer is created automatically on the next attempt.",
          );
        }
      }

      /**
       * Add-ons are mode-scoped exactly like plan prices, and fail the same
       * silent way: the button works, checkout opens, and the payment dies
       * against a price the live key cannot see.
       */
      const addonRows = await sql`
        select slug, stripe_price_id from addons where is_active = true
      `;
      const noAddonPrice = addonRows.filter((a) => !a.stripe_price_id);
      if (stripeKey && addonRows.length > 0) {
        if (noAddonPrice.length > 0) {
          bad(
            `${noAddonPrice.length} add-on(s) have no Stripe price id`,
            `Run \`npm run stripe:setup${stripeLive ? " -- --live" : ""}\`. Affected: ${noAddonPrice
              .map((a) => a.slug)
              .join(", ")}`,
          );
        } else {
          ok(`${addonRows.length} add-on(s) have a Stripe price`);
        }
      }

      const noPaypal = plans.filter((p) => !p.paypal_plan_id);
      if (has("PAYPAL_CLIENT_ID") && noPaypal.length)
        bad(
          `${noPaypal.length} plan(s) have no PayPal plan id`,
          "Run `npm run paypal:setup`. PayPal checkout fails for those tiers.",
        );

      if (has("PAYPAL_CLIENT_ID") && !noPaypal.length)
        caution(
          `PayPal plan ids are assumed to be ${paypalLive ? "LIVE" : "SANDBOX"}`,
          "PayPal plan ids are environment-scoped like Stripe's. If you switched PAYPAL_ENV, re-run `npm run paypal:setup`.",
        );
    }

    const [{ count: users }] = await sql`select count(*)::int from "user"`;
    ok(`Database reachable (${users} user(s))`);
  } catch (error) {
    bad(
      `Database check failed: ${error.message}`,
      "Confirm DIRECT_URL and that the schema is migrated.",
    );
  } finally {
    await sql.end();
  }
}

// -------------------------------------------------------------- report

const line = "-".repeat(64);
console.log(`\n${line}\n  DEPLOYMENT PREFLIGHT\n${line}\n`);
for (const m of pass) console.log(`  [ok]   ${m}`);
if (warn.length) {
  console.log("");
  for (const { m, hint } of warn) {
    console.log(`  [warn] ${m}`);
    console.log(`         ${hint}`);
  }
}
if (fail.length) {
  console.log("");
  for (const { m, hint } of fail) {
    console.log(`  [FAIL] ${m}`);
    console.log(`         ${hint}`);
  }
}
console.log(`\n${line}`);
console.log(
  `  ${pass.length} ok, ${warn.length} warning(s), ${fail.length} blocker(s)`,
);
console.log(
  fail.length === 0
    ? "  No blockers. Safe to take payments.\n"
    : "  NOT ready to take payments - resolve the blockers above.\n",
);
process.exit(fail.length ? 1 : 0);
