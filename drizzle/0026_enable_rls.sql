-- Row Level Security, on every table.
--
-- Supabase reports these tables as "publicly accessible" because RLS is off.
-- Nothing can actually reach them today: this project has no anon key in use,
-- the app talks to Postgres through Drizzle as the service role, and an
-- unauthenticated PostgREST request is refused before RLS would matter —
-- checked with a live request, which returned 401.
--
-- But that protection rests on nobody ever enabling the public API, and an
-- anon key is one dashboard click away. Enabling RLS moves the guarantee from
-- "no key exists" to "a key would be useless", which is the one that survives
-- somebody else's Tuesday.
--
-- NO POLICIES ARE CREATED, deliberately. RLS with no policy denies every row
-- to every ordinary role, which is exactly the intent: nothing should read
-- these tables except the connection the app already uses. Adding a
-- permissive policy "to be safe" would undo the entire migration.
--
-- ENABLE, not FORCE. The app connects as `postgres`, which owns all 47 tables
-- and carries rolbypassrls — verified against the live database — so its
-- queries are unaffected either way. FORCE would additionally subject the
-- owner to these policies, which buys nothing here (bypassrls still wins) and
-- would silently lock the application out of its own data the day ownership
-- moved to a role without that attribute. Tenant isolation is enforced in
-- lib/tenant.ts, on every query; this is a second wall behind it, not a
-- replacement.
--
-- Reversible: ALTER TABLE "<name>" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "account" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "addon_purchases" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "addons" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "admin_audit_log" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "agency_workspaces" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "article_versions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "articles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "audits" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "backlink_requests" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "billing_customers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "brand_voice" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "calendar_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "clusters" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "competitors" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "crawls" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "credit_ledger" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "ga_metrics" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "geo_prompts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "geo_results" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "gsc_metrics" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "integration_keys" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "integrations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "invitation" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "issues" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "keywords" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "link_checks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "member" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "network_sites" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "notifications" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "organization" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "pages" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "payments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "placements" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "plans" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "provider_cache" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "publish_logs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "referral_codes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "referrals" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "session" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "subscriptions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "usage_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "user" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "verification" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "webhook_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "website_invitations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "website_members" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "websites" ENABLE ROW LEVEL SECURITY;
