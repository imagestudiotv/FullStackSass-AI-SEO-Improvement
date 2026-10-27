-- Credits are spent across RepGet, at ten times today's scale (client, 2026-10-26:
-- "for plan credits we need 10x more than today, and what you mentioned works
-- just great"). Plans give 10x the credits, a pack holds 10x the credits for
-- the same money, and a backlink costs 10-100 credits (lib/backlinks/managed.ts).
-- Balances already held are not converted: there were no paying customers yet.
UPDATE "plans" SET "monthly_credits" = 250, "updated_at" = now() WHERE "tier" = 'grow';--> statement-breakpoint
UPDATE "plans" SET "monthly_credits" = 700, "updated_at" = now() WHERE "tier" = 'scale';--> statement-breakpoint
UPDATE "addons" SET "credits_granted" = 100, "name" = '100 credits', "description" = 'One hundred credits to spend on anything in RepGet.', "updated_at" = now() WHERE "slug" = 'credits_10';--> statement-breakpoint
UPDATE "addons" SET "credits_granted" = 250, "name" = '250 credits', "description" = 'Two hundred and fifty credits. Better value per credit.', "updated_at" = now() WHERE "slug" = 'credits_25';--> statement-breakpoint
UPDATE "addons" SET "credits_granted" = 500, "name" = '500 credits', "description" = 'Five hundred credits. Best value per credit.', "updated_at" = now() WHERE "slug" = 'credits_50';--> statement-breakpoint
-- Services are bought with credits now; only credit packs are paid by card.
UPDATE "addons" SET "credit_price" = 250, "updated_at" = now() WHERE "slug" = 'usa_local_citations';--> statement-breakpoint
UPDATE "addons" SET "credit_price" = 190, "updated_at" = now() WHERE "slug" = 'audit_fix';
