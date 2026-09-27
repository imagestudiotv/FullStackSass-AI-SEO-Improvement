-- Dispatch identity, exact acknowledgements, actual CMS outcomes, and page
-- identity for reporting. Additive: nullable or defaulted columns, one
-- function, one control row; two data corrections (abandoned -> expired,
-- protocol backfill) and an unambiguous-only first_live_at backfill. A build
-- older than this migration ignores all of it (docs/managed-network.md).

ALTER TABLE "articles" ADD COLUMN "first_live_at" timestamp;--> statement-breakpoint
ALTER TABLE "publication_dispatches" ADD COLUMN "protocol" text;--> statement-breakpoint
ALTER TABLE "publication_dispatches" ADD COLUMN "integration_id" uuid;--> statement-breakpoint
ALTER TABLE "publication_dispatches" ADD COLUMN "request_snapshot" jsonb;--> statement-breakpoint
ALTER TABLE "publication_dispatches" ADD COLUMN "remote_status" text;--> statement-breakpoint
ALTER TABLE "publication_dispatches" ADD COLUMN "late" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "publication_dispatches" ADD COLUMN "lookup_attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "publication_dispatches" ADD COLUMN "last_lookup_at" timestamp;--> statement-breakpoint
ALTER TABLE "publication_dispatches" ADD COLUMN "lookup_result" text;--> statement-breakpoint
ALTER TABLE "publication_dispatches" ADD COLUMN "reconciled_by" text;--> statement-breakpoint
ALTER TABLE "publication_dispatches" ADD COLUMN "reconciled_at" timestamp;--> statement-breakpoint
ALTER TABLE "publication_dispatches" ADD COLUMN "reconcile_note" text;--> statement-breakpoint
ALTER TABLE "publish_logs" ADD COLUMN "remote_status" text;--> statement-breakpoint
ALTER TABLE "publish_logs" ADD COLUMN "dispatch_id" uuid;--> statement-breakpoint
ALTER TABLE "publish_logs" ADD CONSTRAINT "publish_logs_dispatch_id_publication_dispatches_id_fk" FOREIGN KEY ("dispatch_id") REFERENCES "public"."publication_dispatches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "publish_logs_dispatch_uidx" ON "publish_logs" USING btree ("dispatch_id") WHERE "publish_logs"."dispatch_id" is not null and "publish_logs"."status" = 'published';
--> statement-breakpoint
-- Page identity for reporting: the SQL twin of lib/reporting/page-key.ts
-- (tested against each other). Keeps path case and meaningful query
-- parameters; ignores scheme, "www.", host case, default port, trailing
-- slash, fragment, tracking parameters and parameter order. A host-less
-- path (Google Analytics pagePath) is resolved against fallback_host.
CREATE OR REPLACE FUNCTION repget_page_key(url text, fallback_host text)
RETURNS text
LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE
AS $$
DECLARE
  s text := btrim(coalesce(url, ''));
  q int;
  rest text;
  query text;
  slash int;
  host text;
  path text;
  params text;
BEGIN
  IF s = '' THEN RETURN NULL; END IF;
  IF left(s, 2) = '//' THEN
    s := 'https:' || s;
  ELSIF left(s, 1) = '/' THEN
    IF fallback_host IS NOT NULL AND fallback_host <> '' THEN
      s := split_part(regexp_replace(fallback_host, '^[a-zA-Z][a-zA-Z0-9+.-]*://', ''), '/', 1) || s;
    END IF;
  END IF;
  s := regexp_replace(s, '^[a-zA-Z][a-zA-Z0-9+.-]*://', '');
  s := split_part(s, '#', 1);
  q := strpos(s, '?');
  IF q > 0 THEN
    rest := left(s, q - 1);
    query := substr(s, q + 1);
  ELSE
    rest := s;
    query := '';
  END IF;
  slash := strpos(rest, '/');
  IF slash > 0 THEN
    host := left(rest, slash - 1);
    path := substr(rest, slash);
  ELSE
    host := rest;
    path := '';
  END IF;
  host := lower(host);
  host := regexp_replace(host, '^.*@', '');
  host := regexp_replace(host, ':(80|443)$', '');
  host := regexp_replace(host, '^www\.', '');
  path := regexp_replace(path, '/+$', '');
  IF path = '' THEN path := '/'; END IF;
  SELECT string_agg(p, '&' ORDER BY p COLLATE "C") INTO params
  FROM unnest(string_to_array(query, '&')) AS p
  WHERE p <> ''
    AND lower(split_part(p, '=', 1)) !~ '^(utm_[a-z0-9_]*|gclid|gbraid|wbraid|dclid|fbclid|msclkid|yclid|igshid|mc_cid|mc_eid|_ga|_gl)$';
  RETURN host || path || coalesce('?' || params, '');
END;
$$;
--> statement-breakpoint
-- Plugin hand-overs that timed out unacknowledged were "abandoned" and could
-- be re-offered as a different revision. They are "expired" from now on: a
-- lease that ran out is not a completed delivery, and the plugin may still
-- report it.
UPDATE "publication_dispatches" SET "status" = 'expired' WHERE "status" = 'abandoned';
--> statement-breakpoint
-- Dispatches before this migration: the protocol they used, as far as it is
-- known. Plugin rows came from plugins that did not echo a dispatch id.
UPDATE "publication_dispatches" SET "protocol" = CASE WHEN "channel" = 'plugin' THEN 'plugin_legacy' ELSE 'direct' END WHERE "protocol" IS NULL;
--> statement-breakpoint
-- First live date, backfilled ONLY where the history is unambiguous: the
-- article is published in RepGet and has exactly one delivery on record, so
-- that delivery is when it went live. Two or more deliveries (the first may
-- have been a WordPress draft) stay NULL - "date unknown" - rather than an
-- invented date. See docs/backlink-reporting.md.
UPDATE "articles" a SET "first_live_at" = one.created_at
FROM (
  SELECT pl.article_id, min(pl.created_at) AS created_at
  FROM "publish_logs" pl
  WHERE pl.status = 'published'
  GROUP BY pl.article_id
  HAVING count(*) = 1
) one
WHERE one.article_id = a.id AND a.status = 'published' AND a.first_live_at IS NULL;
--> statement-breakpoint
-- When this build's managed-review activation boundary begins: drafts created
-- from here on, on Partner Network websites, can be brought under review when
-- an operator enables managed_review (lib/publishing/controls.ts). Disabled,
-- like every control row; ON CONFLICT keeps an existing marker. now(), as the
-- created_at defaults use, so the two compare on the same clock.
INSERT INTO "platform_controls" ("key", "enabled", "reason", "updated_by", "updated_at")
VALUES ('managed_review_cutover', false, 'Migration 0045 applied: drafts created after this time are covered by managed-review activation', 'migration:0045', now())
ON CONFLICT ("key") DO NOTHING;
