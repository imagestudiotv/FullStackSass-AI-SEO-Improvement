CREATE TABLE "partner_applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text,
	"status" text DEFAULT 'submitted' NOT NULL,
	"answers" jsonb NOT NULL,
	"applicant_email" text NOT NULL,
	"applicant_name" text NOT NULL,
	"submitted_at" timestamp NOT NULL,
	"reviewed_at" timestamp,
	"reviewed_by_email" text,
	"review_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "partner_applications_status_check" CHECK ("partner_applications"."status" in ('submitted', 'approved', 'rejected', 'withdrawn'))
);
--> statement-breakpoint
ALTER TABLE "partner_applications" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "partner_attributions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"founding_user_id" text NOT NULL,
	"partner_id" uuid NOT NULL,
	"source" text NOT NULL,
	"click_id" uuid,
	"coupon_id" uuid,
	"status" text DEFAULT 'active' NOT NULL,
	"locked_at" timestamp NOT NULL,
	"rule_version" integer NOT NULL,
	"window_starts_at" timestamp,
	"window_ends_at" timestamp,
	"fraud_signals" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"review_reason" text,
	"disqualified_at" timestamp,
	"disqualified_reason" text,
	"decided_by_email" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "partner_attributions_source_check" CHECK ("partner_attributions"."source" in ('link', 'coupon')),
	CONSTRAINT "partner_attributions_status_check" CHECK ("partner_attributions"."status" in ('active', 'review', 'disqualified'))
);
--> statement-breakpoint
ALTER TABLE "partner_attributions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "partner_balance_projections" (
	"partner_id" uuid NOT NULL,
	"environment" text NOT NULL,
	"currency" text NOT NULL,
	"net_earned" bigint DEFAULT 0 NOT NULL,
	"net_transferred" bigint DEFAULT 0 NOT NULL,
	"liability" bigint DEFAULT 0 NOT NULL,
	"pending" bigint DEFAULT 0 NOT NULL,
	"available" bigint DEFAULT 0 NOT NULL,
	"reserved" bigint DEFAULT 0 NOT NULL,
	"held" bigint DEFAULT 0 NOT NULL,
	"bank_paid" bigint DEFAULT 0 NOT NULL,
	"rebuilt_at" timestamp NOT NULL,
	CONSTRAINT "partner_balance_projections_partner_id_environment_currency_pk" PRIMARY KEY("partner_id","environment","currency")
);
--> statement-breakpoint
ALTER TABLE "partner_balance_projections" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "partner_bank_payout_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"settlement_id" uuid NOT NULL,
	"attempt_number" integer NOT NULL,
	"operation_id" text NOT NULL,
	"environment" text NOT NULL,
	"stripe_account_id" text NOT NULL,
	"currency" text NOT NULL,
	"amount" bigint NOT NULL,
	"status" text DEFAULT 'not_started' NOT NULL,
	"stripe_payout_id" text,
	"arrival_date" timestamp,
	"failure_code" text,
	"failure_message" text,
	"submitted_at" timestamp,
	"paid_at" timestamp,
	"failed_at" timestamp,
	"last_checked_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "partner_bank_payout_attempts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "partner_clicks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"partner_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"clicked_at" timestamp NOT NULL,
	"expires_at" timestamp NOT NULL,
	"landing_path" text,
	"referrer_host" text,
	"visitor_hash" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "partner_clicks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "partner_commissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"environment" text NOT NULL,
	"partner_id" uuid NOT NULL,
	"attribution_id" uuid NOT NULL,
	"payment_fact_id" uuid NOT NULL,
	"currency" text NOT NULL,
	"base_amount" bigint NOT NULL,
	"rate_basis_points" integer NOT NULL,
	"tier_key" text NOT NULL,
	"amount" bigint NOT NULL,
	"reversed_amount" bigint DEFAULT 0 NOT NULL,
	"program_version" integer NOT NULL,
	"program_version_id" uuid NOT NULL,
	"earned_at" timestamp NOT NULL,
	"matures_at" timestamp NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"review_state" text DEFAULT 'approved' NOT NULL,
	"hold_reason" text,
	"paid_settlement_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "partner_commissions_amounts_check" CHECK ("partner_commissions"."amount" >= 0 and "partner_commissions"."reversed_amount" >= 0 and "partner_commissions"."reversed_amount" <= "partner_commissions"."amount"),
	CONSTRAINT "partner_commissions_status_check" CHECK ("partner_commissions"."status" in ('pending', 'available', 'reserved', 'paid', 'reversed')),
	CONSTRAINT "partner_commissions_review_check" CHECK ("partner_commissions"."review_state" in ('approved', 'needs_review', 'rejected'))
);
--> statement-breakpoint
ALTER TABLE "partner_commissions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "partner_coupons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"environment" text NOT NULL,
	"partner_id" uuid NOT NULL,
	"code" text NOT NULL,
	"campaign" text NOT NULL,
	"discount_type" text NOT NULL,
	"percent_off_basis_points" integer,
	"amount_off" bigint,
	"currency" text,
	"duration" text NOT NULL,
	"duration_in_months" integer,
	"applies_to_products" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"starts_at" timestamp,
	"expires_at" timestamp,
	"max_redemptions" integer,
	"first_time_transaction" boolean DEFAULT true NOT NULL,
	"stripe_coupon_id" text,
	"stripe_promotion_code_id" text,
	"status" text DEFAULT 'creating' NOT NULL,
	"created_by_email" text NOT NULL,
	"deactivated_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "partner_coupons" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "partner_ledger_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"environment" text NOT NULL,
	"partner_id" uuid NOT NULL,
	"currency" text NOT NULL,
	"kind" text NOT NULL,
	"amount" bigint NOT NULL,
	"operation_key" text NOT NULL,
	"commission_id" uuid,
	"settlement_id" uuid,
	"payment_fact_id" uuid,
	"reason" text NOT NULL,
	"actor" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "partner_ledger_kind_check" CHECK ("partner_ledger_entries"."kind" in ('commission_earned', 'commission_adjustment', 'transfer_confirmed', 'transfer_reversal'))
);
--> statement-breakpoint
ALTER TABLE "partner_ledger_entries" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "partner_payment_facts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"environment" text NOT NULL,
	"invoice_payment_id" text NOT NULL,
	"invoice_id" text NOT NULL,
	"payment_intent_id" text,
	"charge_id" text,
	"stripe_subscription_id" text,
	"stripe_customer_id" text,
	"organization_id" text NOT NULL,
	"attribution_id" uuid,
	"payment_id" uuid,
	"currency" text NOT NULL,
	"cash_collected" bigint NOT NULL,
	"eligible_base" bigint NOT NULL,
	"tax_share" bigint NOT NULL,
	"invoice_total" bigint NOT NULL,
	"invoice_tax" bigint NOT NULL,
	"invoice_discount" bigint NOT NULL,
	"invoice_subtotal" bigint NOT NULL,
	"invoice_starting_balance" bigint NOT NULL,
	"invoice_amount_paid" bigint NOT NULL,
	"paid_at" timestamp NOT NULL,
	"refunded_amount" bigint DEFAULT 0 NOT NULL,
	"dispute_lost_amount" bigint DEFAULT 0 NOT NULL,
	"dispute_id" text,
	"dispute_status" text,
	"outcome" text NOT NULL,
	"evidence" jsonb NOT NULL,
	"evidence_version" integer NOT NULL,
	"last_synced_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "partner_payment_facts_amounts_check" CHECK ("partner_payment_facts"."cash_collected" >= 0 and "partner_payment_facts"."eligible_base" >= 0)
);
--> statement-breakpoint
ALTER TABLE "partner_payment_facts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "partner_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text,
	"referral_code" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"tier_key" text DEFAULT 'base' NOT NULL,
	"qualifying_customers" integer DEFAULT 0 NOT NULL,
	"display_name" text NOT NULL,
	"contact_email" text NOT NULL,
	"country" text,
	"application_id" uuid,
	"approved_at" timestamp NOT NULL,
	"approved_by_email" text NOT NULL,
	"suspended_at" timestamp,
	"suspended_reason" text,
	"payout_hold_reason" text,
	"payout_hold_set_at" timestamp,
	"payout_hold_by" text,
	"welcome_email_sent_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "partner_profiles_status_check" CHECK ("partner_profiles"."status" in ('active', 'suspended'))
);
--> statement-breakpoint
ALTER TABLE "partner_profiles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "partner_program_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version" integer NOT NULL,
	"policy" jsonb NOT NULL,
	"effective_from" timestamp NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "partner_program_versions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "partner_provider_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"environment" text NOT NULL,
	"stripe_event_id" text NOT NULL,
	"event_type" text NOT NULL,
	"object_id" text NOT NULL,
	"connected_account_id" text,
	"event_created_at" timestamp NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp DEFAULT now() NOT NULL,
	"claim_token" uuid,
	"claimed_until" timestamp,
	"last_error" text,
	"outcome" text,
	"processed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "partner_provider_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "partner_review_cases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"dedupe_key" text NOT NULL,
	"environment" text,
	"partner_id" uuid,
	"attribution_id" uuid,
	"commission_id" uuid,
	"settlement_id" uuid,
	"payment_fact_id" uuid,
	"organization_id" text,
	"summary" text NOT NULL,
	"evidence" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"resolution" text,
	"resolution_reason" text,
	"resolved_by_email" text,
	"resolved_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "partner_review_cases" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "partner_settlement_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"settlement_id" uuid NOT NULL,
	"commission_id" uuid NOT NULL,
	"amount" bigint NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "partner_settlement_items_amount_check" CHECK ("partner_settlement_items"."amount" > 0)
);
--> statement-breakpoint
ALTER TABLE "partner_settlement_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "partner_settlements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"environment" text NOT NULL,
	"partner_id" uuid NOT NULL,
	"currency" text NOT NULL,
	"run_key" text NOT NULL,
	"state" text DEFAULT 'reserved' NOT NULL,
	"gross_amount" bigint NOT NULL,
	"offset_amount" bigint NOT NULL,
	"transfer_amount" bigint NOT NULL,
	"stripe_account_id" text NOT NULL,
	"transfer_group" text NOT NULL,
	"claim_token" uuid,
	"claimed_until" timestamp,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp DEFAULT now() NOT NULL,
	"last_error" text,
	"canceled_reason" text,
	"review_reason" text,
	"created_by" text NOT NULL,
	"transferred_at" timestamp,
	"paid_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "partner_settlements_amounts_check" CHECK ("partner_settlements"."transfer_amount" > 0 and "partner_settlements"."offset_amount" >= 0 and "partner_settlements"."gross_amount" = "partner_settlements"."transfer_amount" + "partner_settlements"."offset_amount")
);
--> statement-breakpoint
ALTER TABLE "partner_settlements" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "partner_signup_eligibility" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"signed_up_at" timestamp NOT NULL,
	"signup_method" text NOT NULL,
	"eligible" boolean NOT NULL,
	"exclusions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"founding_organization_id" text,
	"click_id" uuid,
	"candidate_partner_id" uuid,
	"link_outcome" text NOT NULL,
	"coupon_deadline" timestamp NOT NULL,
	"fraud_signals" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "partner_signup_eligibility" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "partner_stripe_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"partner_id" uuid NOT NULL,
	"environment" text NOT NULL,
	"stripe_account_id" text,
	"status" text DEFAULT 'creating' NOT NULL,
	"country" text,
	"default_currency" text,
	"details_submitted" boolean DEFAULT false NOT NULL,
	"payouts_enabled" boolean DEFAULT false NOT NULL,
	"transfers_capability" text,
	"requirements_currently_due" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"requirements_past_due" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"requirements_pending_verification" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"disabled_reason" text,
	"current_deadline" timestamp,
	"payout_interval" text,
	"creation_key" text NOT NULL,
	"last_synced_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "partner_stripe_accounts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "partner_tier_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"partner_id" uuid NOT NULL,
	"tier_key" text NOT NULL,
	"rate_basis_points" integer NOT NULL,
	"program_version" integer NOT NULL,
	"qualifying_customers" integer NOT NULL,
	"effective_from" timestamp NOT NULL,
	"effective_to" timestamp,
	"evidence" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "partner_tier_history_rate_check" CHECK ("partner_tier_history"."rate_basis_points" between 0 and 10000)
);
--> statement-breakpoint
ALTER TABLE "partner_tier_history" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "partner_transfer_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"settlement_id" uuid NOT NULL,
	"attempt_number" integer NOT NULL,
	"operation_id" text NOT NULL,
	"environment" text NOT NULL,
	"stripe_account_id" text NOT NULL,
	"currency" text NOT NULL,
	"amount" bigint NOT NULL,
	"status" text DEFAULT 'not_started' NOT NULL,
	"stripe_transfer_id" text,
	"stripe_balance_transaction_id" text,
	"amount_reversed" bigint DEFAULT 0 NOT NULL,
	"failure_code" text,
	"failure_message" text,
	"submitted_at" timestamp,
	"confirmed_at" timestamp,
	"last_checked_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "partner_transfer_attempts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "partner_transfer_reversals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transfer_attempt_id" uuid NOT NULL,
	"operation_id" text NOT NULL,
	"amount" bigint NOT NULL,
	"currency" text NOT NULL,
	"status" text DEFAULT 'processing' NOT NULL,
	"stripe_reversal_id" text,
	"reason" text NOT NULL,
	"requested_by" text NOT NULL,
	"failure_message" text,
	"confirmed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "partner_transfer_reversals_amount_check" CHECK ("partner_transfer_reversals"."amount" > 0)
);
--> statement-breakpoint
ALTER TABLE "partner_transfer_reversals" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "partner_applications" ADD CONSTRAINT "partner_applications_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_attributions" ADD CONSTRAINT "partner_attributions_partner_id_partner_profiles_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partner_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_attributions" ADD CONSTRAINT "partner_attributions_click_id_partner_clicks_id_fk" FOREIGN KEY ("click_id") REFERENCES "public"."partner_clicks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_attributions" ADD CONSTRAINT "partner_attributions_coupon_id_partner_coupons_id_fk" FOREIGN KEY ("coupon_id") REFERENCES "public"."partner_coupons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_balance_projections" ADD CONSTRAINT "partner_balance_projections_partner_id_partner_profiles_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partner_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_bank_payout_attempts" ADD CONSTRAINT "partner_bank_payout_attempts_settlement_id_partner_settlements_id_fk" FOREIGN KEY ("settlement_id") REFERENCES "public"."partner_settlements"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_clicks" ADD CONSTRAINT "partner_clicks_partner_id_partner_profiles_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partner_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_commissions" ADD CONSTRAINT "partner_commissions_partner_id_partner_profiles_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partner_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_commissions" ADD CONSTRAINT "partner_commissions_attribution_id_partner_attributions_id_fk" FOREIGN KEY ("attribution_id") REFERENCES "public"."partner_attributions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_commissions" ADD CONSTRAINT "partner_commissions_payment_fact_id_partner_payment_facts_id_fk" FOREIGN KEY ("payment_fact_id") REFERENCES "public"."partner_payment_facts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_commissions" ADD CONSTRAINT "partner_commissions_program_version_id_partner_program_versions_id_fk" FOREIGN KEY ("program_version_id") REFERENCES "public"."partner_program_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_coupons" ADD CONSTRAINT "partner_coupons_partner_id_partner_profiles_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partner_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_ledger_entries" ADD CONSTRAINT "partner_ledger_entries_partner_id_partner_profiles_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partner_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_ledger_entries" ADD CONSTRAINT "partner_ledger_entries_commission_id_partner_commissions_id_fk" FOREIGN KEY ("commission_id") REFERENCES "public"."partner_commissions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_ledger_entries" ADD CONSTRAINT "partner_ledger_entries_settlement_id_partner_settlements_id_fk" FOREIGN KEY ("settlement_id") REFERENCES "public"."partner_settlements"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_ledger_entries" ADD CONSTRAINT "partner_ledger_entries_payment_fact_id_partner_payment_facts_id_fk" FOREIGN KEY ("payment_fact_id") REFERENCES "public"."partner_payment_facts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_payment_facts" ADD CONSTRAINT "partner_payment_facts_attribution_id_partner_attributions_id_fk" FOREIGN KEY ("attribution_id") REFERENCES "public"."partner_attributions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_profiles" ADD CONSTRAINT "partner_profiles_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_profiles" ADD CONSTRAINT "partner_profiles_application_id_partner_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."partner_applications"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_review_cases" ADD CONSTRAINT "partner_review_cases_partner_id_partner_profiles_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partner_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_review_cases" ADD CONSTRAINT "partner_review_cases_attribution_id_partner_attributions_id_fk" FOREIGN KEY ("attribution_id") REFERENCES "public"."partner_attributions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_review_cases" ADD CONSTRAINT "partner_review_cases_commission_id_partner_commissions_id_fk" FOREIGN KEY ("commission_id") REFERENCES "public"."partner_commissions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_review_cases" ADD CONSTRAINT "partner_review_cases_settlement_id_partner_settlements_id_fk" FOREIGN KEY ("settlement_id") REFERENCES "public"."partner_settlements"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_review_cases" ADD CONSTRAINT "partner_review_cases_payment_fact_id_partner_payment_facts_id_fk" FOREIGN KEY ("payment_fact_id") REFERENCES "public"."partner_payment_facts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_settlement_items" ADD CONSTRAINT "partner_settlement_items_settlement_id_partner_settlements_id_fk" FOREIGN KEY ("settlement_id") REFERENCES "public"."partner_settlements"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_settlement_items" ADD CONSTRAINT "partner_settlement_items_commission_id_partner_commissions_id_fk" FOREIGN KEY ("commission_id") REFERENCES "public"."partner_commissions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_settlements" ADD CONSTRAINT "partner_settlements_partner_id_partner_profiles_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partner_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_signup_eligibility" ADD CONSTRAINT "partner_signup_eligibility_click_id_partner_clicks_id_fk" FOREIGN KEY ("click_id") REFERENCES "public"."partner_clicks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_signup_eligibility" ADD CONSTRAINT "partner_signup_eligibility_candidate_partner_id_partner_profiles_id_fk" FOREIGN KEY ("candidate_partner_id") REFERENCES "public"."partner_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_stripe_accounts" ADD CONSTRAINT "partner_stripe_accounts_partner_id_partner_profiles_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partner_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_tier_history" ADD CONSTRAINT "partner_tier_history_partner_id_partner_profiles_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partner_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_transfer_attempts" ADD CONSTRAINT "partner_transfer_attempts_settlement_id_partner_settlements_id_fk" FOREIGN KEY ("settlement_id") REFERENCES "public"."partner_settlements"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_transfer_reversals" ADD CONSTRAINT "partner_transfer_reversals_transfer_attempt_id_partner_transfer_attempts_id_fk" FOREIGN KEY ("transfer_attempt_id") REFERENCES "public"."partner_transfer_attempts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "partner_applications_open_uidx" ON "partner_applications" USING btree ("user_id") WHERE "partner_applications"."status" = 'submitted';--> statement-breakpoint
CREATE INDEX "partner_applications_status_idx" ON "partner_applications" USING btree ("status","submitted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "partner_attributions_org_uidx" ON "partner_attributions" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "partner_attributions_partner_idx" ON "partner_attributions" USING btree ("partner_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "partner_bank_payout_attempts_operation_uidx" ON "partner_bank_payout_attempts" USING btree ("operation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "partner_bank_payout_attempts_number_uidx" ON "partner_bank_payout_attempts" USING btree ("settlement_id","attempt_number");--> statement-breakpoint
CREATE UNIQUE INDEX "partner_bank_payout_attempts_payout_uidx" ON "partner_bank_payout_attempts" USING btree ("stripe_account_id","stripe_payout_id");--> statement-breakpoint
CREATE UNIQUE INDEX "partner_bank_payout_attempts_live_uidx" ON "partner_bank_payout_attempts" USING btree ("settlement_id") WHERE "partner_bank_payout_attempts"."status" in ('unknown', 'pending', 'in_transit', 'paid');--> statement-breakpoint
CREATE UNIQUE INDEX "partner_clicks_token_uidx" ON "partner_clicks" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "partner_clicks_partner_idx" ON "partner_clicks" USING btree ("partner_id","clicked_at");--> statement-breakpoint
CREATE INDEX "partner_clicks_expires_idx" ON "partner_clicks" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "partner_commissions_fact_uidx" ON "partner_commissions" USING btree ("payment_fact_id");--> statement-breakpoint
CREATE INDEX "partner_commissions_partner_idx" ON "partner_commissions" USING btree ("partner_id","environment","currency","status");--> statement-breakpoint
CREATE UNIQUE INDEX "partner_coupons_code_uidx" ON "partner_coupons" USING btree ("environment","code");--> statement-breakpoint
CREATE UNIQUE INDEX "partner_coupons_promotion_uidx" ON "partner_coupons" USING btree ("stripe_promotion_code_id");--> statement-breakpoint
CREATE INDEX "partner_coupons_partner_idx" ON "partner_coupons" USING btree ("partner_id");--> statement-breakpoint
CREATE UNIQUE INDEX "partner_ledger_operation_uidx" ON "partner_ledger_entries" USING btree ("operation_key");--> statement-breakpoint
CREATE INDEX "partner_ledger_partner_idx" ON "partner_ledger_entries" USING btree ("partner_id","environment","currency");--> statement-breakpoint
CREATE INDEX "partner_ledger_commission_idx" ON "partner_ledger_entries" USING btree ("commission_id");--> statement-breakpoint
CREATE UNIQUE INDEX "partner_payment_facts_collection_uidx" ON "partner_payment_facts" USING btree ("environment","invoice_payment_id");--> statement-breakpoint
CREATE INDEX "partner_payment_facts_charge_idx" ON "partner_payment_facts" USING btree ("environment","charge_id");--> statement-breakpoint
CREATE INDEX "partner_payment_facts_intent_idx" ON "partner_payment_facts" USING btree ("environment","payment_intent_id");--> statement-breakpoint
CREATE INDEX "partner_payment_facts_invoice_idx" ON "partner_payment_facts" USING btree ("environment","invoice_id");--> statement-breakpoint
CREATE INDEX "partner_payment_facts_org_idx" ON "partner_payment_facts" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "partner_profiles_user_uidx" ON "partner_profiles" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "partner_profiles_code_uidx" ON "partner_profiles" USING btree ("referral_code");--> statement-breakpoint
CREATE UNIQUE INDEX "partner_program_versions_version_uidx" ON "partner_program_versions" USING btree ("version");--> statement-breakpoint
CREATE UNIQUE INDEX "partner_provider_events_event_uidx" ON "partner_provider_events" USING btree ("stripe_event_id");--> statement-breakpoint
CREATE INDEX "partner_provider_events_due_idx" ON "partner_provider_events" USING btree ("status","next_attempt_at");--> statement-breakpoint
CREATE UNIQUE INDEX "partner_review_cases_dedupe_uidx" ON "partner_review_cases" USING btree ("dedupe_key");--> statement-breakpoint
CREATE INDEX "partner_review_cases_status_idx" ON "partner_review_cases" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "partner_review_cases_partner_idx" ON "partner_review_cases" USING btree ("partner_id");--> statement-breakpoint
CREATE UNIQUE INDEX "partner_settlement_items_active_uidx" ON "partner_settlement_items" USING btree ("commission_id") WHERE "partner_settlement_items"."active";--> statement-breakpoint
CREATE INDEX "partner_settlement_items_settlement_idx" ON "partner_settlement_items" USING btree ("settlement_id");--> statement-breakpoint
CREATE UNIQUE INDEX "partner_settlements_run_uidx" ON "partner_settlements" USING btree ("partner_id","environment","currency","run_key");--> statement-breakpoint
CREATE UNIQUE INDEX "partner_settlements_group_uidx" ON "partner_settlements" USING btree ("transfer_group");--> statement-breakpoint
CREATE UNIQUE INDEX "partner_settlements_open_uidx" ON "partner_settlements" USING btree ("partner_id","environment","currency") WHERE "partner_settlements"."state" in ('reserved', 'transfer_processing', 'transfer_unknown');--> statement-breakpoint
CREATE INDEX "partner_settlements_due_idx" ON "partner_settlements" USING btree ("state","next_attempt_at");--> statement-breakpoint
CREATE UNIQUE INDEX "partner_signup_eligibility_user_uidx" ON "partner_signup_eligibility" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "partner_signup_eligibility_org_idx" ON "partner_signup_eligibility" USING btree ("founding_organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "partner_stripe_accounts_partner_uidx" ON "partner_stripe_accounts" USING btree ("partner_id","environment");--> statement-breakpoint
CREATE UNIQUE INDEX "partner_stripe_accounts_account_uidx" ON "partner_stripe_accounts" USING btree ("stripe_account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "partner_tier_history_open_uidx" ON "partner_tier_history" USING btree ("partner_id") WHERE "partner_tier_history"."effective_to" is null;--> statement-breakpoint
CREATE INDEX "partner_tier_history_partner_idx" ON "partner_tier_history" USING btree ("partner_id","effective_from");--> statement-breakpoint
CREATE UNIQUE INDEX "partner_transfer_attempts_operation_uidx" ON "partner_transfer_attempts" USING btree ("operation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "partner_transfer_attempts_number_uidx" ON "partner_transfer_attempts" USING btree ("settlement_id","attempt_number");--> statement-breakpoint
CREATE UNIQUE INDEX "partner_transfer_attempts_transfer_uidx" ON "partner_transfer_attempts" USING btree ("stripe_transfer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "partner_transfer_attempts_live_uidx" ON "partner_transfer_attempts" USING btree ("settlement_id") WHERE "partner_transfer_attempts"."status" in ('processing', 'unknown', 'confirmed', 'partially_reversed', 'reversed');--> statement-breakpoint
CREATE UNIQUE INDEX "partner_transfer_reversals_operation_uidx" ON "partner_transfer_reversals" USING btree ("operation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "partner_transfer_reversals_stripe_uidx" ON "partner_transfer_reversals" USING btree ("stripe_reversal_id");