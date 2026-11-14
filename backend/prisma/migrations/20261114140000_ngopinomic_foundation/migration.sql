-- NGOPINOMIC Foundation Migration (Phase 1-5)
-- Creates isolated, auditable tables for Identity, Premium Marketplace, Points, Affiliate/NDR Commission,
-- Append-Only Ledger, BMC Utility Gateway, Ecosystem Consent, Fraud Events, and Admin Audit Logs.

CREATE TABLE IF NOT EXISTS "ngopinomic_user_identities" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "ngopi_id" TEXT NOT NULL,
    "basic_email" TEXT NOT NULL,
    "tier" TEXT NOT NULL DEFAULT 'basic',
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ngopinomic_user_identities_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ngopinomic_user_identities_user_id_key" ON "ngopinomic_user_identities"("user_id");
CREATE UNIQUE INDEX IF NOT EXISTS "ngopinomic_user_identities_ngopi_id_key" ON "ngopinomic_user_identities"("ngopi_id");
CREATE UNIQUE INDEX IF NOT EXISTS "ngopinomic_user_identities_basic_email_key" ON "ngopinomic_user_identities"("basic_email");

CREATE TABLE IF NOT EXISTS "ngopinomic_premium_identities" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "display_value" TEXT NOT NULL,
    "normalized_value" TEXT NOT NULL,
    "rarity_tier" TEXT NOT NULL DEFAULT 'Regular',
    "price_idr" INTEGER NOT NULL,
    "price_points" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'Available',
    "owner_user_id" TEXT,
    "reserved_by_user_id" TEXT,
    "reserved_until" TIMESTAMP(3),
    "sold_at" TIMESTAMP(3),
    "activated_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ngopinomic_premium_identities_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ngopinomic_premium_identities_category_normalized_value_key" ON "ngopinomic_premium_identities"("category", "normalized_value");
CREATE INDEX IF NOT EXISTS "ngopinomic_premium_identities_status_category_idx" ON "ngopinomic_premium_identities"("status", "category");
CREATE INDEX IF NOT EXISTS "ngopinomic_premium_identities_owner_user_id_idx" ON "ngopinomic_premium_identities"("owner_user_id");

CREATE TABLE IF NOT EXISTS "ngopinomic_email_identities" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "email_address" TEXT NOT NULL,
    "inventory_id" TEXT,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ngopinomic_email_identities_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ngopinomic_email_identities_email_address_key" ON "ngopinomic_email_identities"("email_address");
CREATE INDEX IF NOT EXISTS "ngopinomic_email_identities_user_id_idx" ON "ngopinomic_email_identities"("user_id");

CREATE TABLE IF NOT EXISTS "ngopinomic_points_accounts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "lifetime_earned" INTEGER NOT NULL DEFAULT 0,
    "lifetime_redeemed" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ngopinomic_points_accounts_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ngopinomic_points_accounts_user_id_key" ON "ngopinomic_points_accounts"("user_id");

CREATE TABLE IF NOT EXISTS "ngopinomic_points_transactions" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "tx_type" TEXT NOT NULL,
    "activity_code" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "balance_after" INTEGER NOT NULL,
    "reference_code" TEXT NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "reversal_of_id" TEXT,
    "description" TEXT NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ngopinomic_points_transactions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ngopinomic_points_transactions_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "ngopinomic_points_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "ngopinomic_points_transactions_reference_code_key" ON "ngopinomic_points_transactions"("reference_code");
CREATE UNIQUE INDEX IF NOT EXISTS "ngopinomic_points_transactions_idempotency_key_key" ON "ngopinomic_points_transactions"("idempotency_key");
CREATE INDEX IF NOT EXISTS "ngopinomic_points_transactions_user_id_created_at_idx" ON "ngopinomic_points_transactions"("user_id", "created_at");

CREATE TABLE IF NOT EXISTS "ngopinomic_affiliate_profiles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "referral_code" TEXT NOT NULL,
    "payout_preference" TEXT NOT NULL DEFAULT 'rupiah',
    "is_ambassador" BOOLEAN NOT NULL DEFAULT false,
    "is_campaign_promoter" BOOLEAN NOT NULL DEFAULT false,
    "promoter_rate_bps" INTEGER NOT NULL DEFAULT 500,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ngopinomic_affiliate_profiles_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ngopinomic_affiliate_profiles_user_id_key" ON "ngopinomic_affiliate_profiles"("user_id");
CREATE UNIQUE INDEX IF NOT EXISTS "ngopinomic_affiliate_profiles_referral_code_key" ON "ngopinomic_affiliate_profiles"("referral_code");

CREATE TABLE IF NOT EXISTS "ngopinomic_referral_relationships" (
    "id" TEXT NOT NULL,
    "referred_user_id" TEXT NOT NULL,
    "referrer_user_id" TEXT NOT NULL,
    "level2_referrer_id" TEXT,
    "referral_code_used" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'verified',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ngopinomic_referral_relationships_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ngopinomic_referral_relationships_referred_user_id_key" ON "ngopinomic_referral_relationships"("referred_user_id");
CREATE INDEX IF NOT EXISTS "ngopinomic_referral_relationships_referrer_user_id_idx" ON "ngopinomic_referral_relationships"("referrer_user_id");
CREATE INDEX IF NOT EXISTS "ngopinomic_referral_relationships_level2_referrer_id_idx" ON "ngopinomic_referral_relationships"("level2_referrer_id");

CREATE TABLE IF NOT EXISTS "ngopinomic_commission_rules" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "direct_rate_bps" INTEGER NOT NULL DEFAULT 2000,
    "level2_rate_bps" INTEGER NOT NULL DEFAULT 500,
    "ambassador_max_bps" INTEGER NOT NULL DEFAULT 500,
    "promoter_min_bps" INTEGER NOT NULL DEFAULT 500,
    "promoter_max_bps" INTEGER NOT NULL DEFAULT 1000,
    "max_total_cap_bps" INTEGER NOT NULL DEFAULT 3500,
    "tax_rate_bps" INTEGER NOT NULL DEFAULT 1100,
    "payment_fee_bps" INTEGER NOT NULL DEFAULT 200,
    "infra_alloc_bps" INTEGER NOT NULL DEFAULT 300,
    "refund_reserve_bps" INTEGER NOT NULL DEFAULT 400,
    "other_ops_bps" INTEGER NOT NULL DEFAULT 1000,
    "settlement_days" INTEGER NOT NULL DEFAULT 7,
    "bmc_utility_enabled" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "updated_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ngopinomic_commission_rules_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ngopinomic_commission_rules_code_key" ON "ngopinomic_commission_rules"("code");

CREATE TABLE IF NOT EXISTS "ngopinomic_commission_transactions" (
    "id" TEXT NOT NULL,
    "beneficiary_user_id" TEXT NOT NULL,
    "source_user_id" TEXT NOT NULL,
    "source_tx_ref" TEXT NOT NULL,
    "commission_type" TEXT NOT NULL,
    "gross_amount_idr" INTEGER NOT NULL,
    "deductions_json" JSONB NOT NULL,
    "net_distributable_idr" INTEGER NOT NULL,
    "rate_bps" INTEGER NOT NULL,
    "commission_amount_idr" INTEGER NOT NULL,
    "payout_preference" TEXT NOT NULL DEFAULT 'rupiah',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reversal_of_id" TEXT,
    "reference_code" TEXT NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ngopinomic_commission_transactions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ngopinomic_commission_transactions_reference_code_key" ON "ngopinomic_commission_transactions"("reference_code");
CREATE UNIQUE INDEX IF NOT EXISTS "ngopinomic_commission_transactions_idempotency_key_key" ON "ngopinomic_commission_transactions"("idempotency_key");
CREATE INDEX IF NOT EXISTS "ngopinomic_commission_transactions_beneficiary_user_id_created_at_idx" ON "ngopinomic_commission_transactions"("beneficiary_user_id", "created_at");
CREATE INDEX IF NOT EXISTS "ngopinomic_commission_transactions_source_tx_ref_idx" ON "ngopinomic_commission_transactions"("source_tx_ref");

CREATE TABLE IF NOT EXISTS "ngopinomic_wallet_accounts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "instrument" TEXT NOT NULL,
    "available_balance" INTEGER NOT NULL DEFAULT 0,
    "pending_balance" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ngopinomic_wallet_accounts_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ngopinomic_wallet_accounts_user_id_instrument_key" ON "ngopinomic_wallet_accounts"("user_id", "instrument");

CREATE TABLE IF NOT EXISTS "ngopinomic_ledger_transactions" (
    "id" TEXT NOT NULL,
    "reference_code" TEXT NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "tx_type" TEXT NOT NULL,
    "instrument" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'posted',
    "reversal_of_id" TEXT,
    "description" TEXT NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ngopinomic_ledger_transactions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ngopinomic_ledger_transactions_reference_code_key" ON "ngopinomic_ledger_transactions"("reference_code");
CREATE UNIQUE INDEX IF NOT EXISTS "ngopinomic_ledger_transactions_idempotency_key_key" ON "ngopinomic_ledger_transactions"("idempotency_key");
CREATE INDEX IF NOT EXISTS "ngopinomic_ledger_transactions_tx_type_created_at_idx" ON "ngopinomic_ledger_transactions"("tx_type", "created_at");

CREATE TABLE IF NOT EXISTS "ngopinomic_ledger_entries" (
    "id" TEXT NOT NULL,
    "ledger_tx_id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "balance_after" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ngopinomic_ledger_entries_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ngopinomic_ledger_entries_ledger_tx_id_fkey" FOREIGN KEY ("ledger_tx_id") REFERENCES "ngopinomic_ledger_transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ngopinomic_ledger_entries_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "ngopinomic_wallet_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "ngopinomic_ledger_entries_account_id_created_at_idx" ON "ngopinomic_ledger_entries"("account_id", "created_at");

CREATE TABLE IF NOT EXISTS "ngopinomic_bmc_transactions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "utility_code" TEXT NOT NULL,
    "amount_bmc" DOUBLE PRECISION NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'configuration_only',
    "status" TEXT NOT NULL DEFAULT 'recorded',
    "reference_code" TEXT NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ngopinomic_bmc_transactions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ngopinomic_bmc_transactions_reference_code_key" ON "ngopinomic_bmc_transactions"("reference_code");
CREATE UNIQUE INDEX IF NOT EXISTS "ngopinomic_bmc_transactions_idempotency_key_key" ON "ngopinomic_bmc_transactions"("idempotency_key");
CREATE INDEX IF NOT EXISTS "ngopinomic_bmc_transactions_user_id_created_at_idx" ON "ngopinomic_bmc_transactions"("user_id", "created_at");

CREATE TABLE IF NOT EXISTS "ngopinomic_community_memberships" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "membership_tier" TEXT NOT NULL DEFAULT 'komunitas',
    "cooperative_status" TEXT NOT NULL DEFAULT 'not_enrolled',
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ngopinomic_community_memberships_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ngopinomic_community_memberships_user_id_key" ON "ngopinomic_community_memberships"("user_id");

CREATE TABLE IF NOT EXISTS "ngopinomic_ecosystem_apps" (
    "id" TEXT NOT NULL,
    "app_code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "allowed_scopes" TEXT[],
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ngopinomic_ecosystem_apps_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ngopinomic_ecosystem_apps_app_code_key" ON "ngopinomic_ecosystem_apps"("app_code");

CREATE TABLE IF NOT EXISTS "ngopinomic_user_consents" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "app_id" TEXT NOT NULL,
    "granted_scopes" TEXT[],
    "granted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMP(3),
    CONSTRAINT "ngopinomic_user_consents_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ngopinomic_user_consents_app_id_fkey" FOREIGN KEY ("app_id") REFERENCES "ngopinomic_ecosystem_apps"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "ngopinomic_user_consents_user_id_app_id_key" ON "ngopinomic_user_consents"("user_id", "app_id");

CREATE TABLE IF NOT EXISTS "ngopinomic_fraud_events" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "event_type" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'medium',
    "details" JSONB,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ngopinomic_fraud_events_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ngopinomic_fraud_events_user_id_created_at_idx" ON "ngopinomic_fraud_events"("user_id", "created_at");

CREATE TABLE IF NOT EXISTS "ngopinomic_admin_audit_logs" (
    "id" TEXT NOT NULL,
    "actor_user_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "target_entity" TEXT NOT NULL,
    "target_id" TEXT,
    "previous_value" JSONB,
    "new_value" JSONB,
    "reason" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ngopinomic_admin_audit_logs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ngopinomic_admin_audit_logs_actor_user_id_created_at_idx" ON "ngopinomic_admin_audit_logs"("actor_user_id", "created_at");

