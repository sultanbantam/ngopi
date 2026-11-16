-- Additive migration for NGOPI GREEN (zero destructive changes to existing tables)

CREATE TABLE "green_activity_categories" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name_id" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "description_id" TEXT NOT NULL,
    "description_en" TEXT NOT NULL,
    "icon" TEXT NOT NULL DEFAULT 'leaf-outline',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "green_activity_categories_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "green_activity_categories_code_key" ON "green_activity_categories"("code");

CREATE TABLE "green_activity_types" (
    "id" TEXT NOT NULL,
    "category_code" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name_id" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "requires_evidence" BOOLEAN NOT NULL DEFAULT true,
    "is_green_eligible" BOOLEAN NOT NULL DEFAULT true,
    "metadata_json" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "green_activity_types_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "green_activity_types_category_code_fkey" FOREIGN KEY ("category_code") REFERENCES "green_activity_categories"("code") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "green_activity_types_code_key" ON "green_activity_types"("code");
CREATE INDEX "green_activity_types_category_code_idx" ON "green_activity_types"("category_code");

CREATE TABLE "green_emission_factors" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "version" TEXT NOT NULL DEFAULT 'v1.0-2026',
    "activity_type_code" TEXT NOT NULL,
    "region" TEXT NOT NULL DEFAULT 'Indonesia',
    "factor_kgco2e_per_unit" DECIMAL(12,6) NOT NULL,
    "baseline_factor_kgco2e_unit" DECIMAL(12,6),
    "unit" TEXT NOT NULL,
    "source_name" TEXT NOT NULL,
    "methodology" TEXT NOT NULL,
    "confidence" TEXT NOT NULL DEFAULT 'estimated',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "green_emission_factors_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "green_emission_factors_code_key" ON "green_emission_factors"("code");
CREATE INDEX "green_emission_factors_activity_type_code_is_active_idx" ON "green_emission_factors"("activity_type_code", "is_active");

CREATE TABLE "green_reward_rules" (
    "id" TEXT NOT NULL,
    "activity_type_code" TEXT NOT NULL,
    "version" TEXT NOT NULL DEFAULT 'v1.0-2026',
    "base_points" INTEGER NOT NULL DEFAULT 0,
    "unit_step" DECIMAL(10,2) NOT NULL DEFAULT 1,
    "max_points_per_submission" INTEGER NOT NULL DEFAULT 20,
    "daily_cap_points" INTEGER NOT NULL DEFAULT 40,
    "requires_verification" BOOLEAN NOT NULL DEFAULT true,
    "requires_evidence" BOOLEAN NOT NULL DEFAULT true,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "green_reward_rules_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "green_reward_rules_activity_type_code_key" ON "green_reward_rules"("activity_type_code");

CREATE TABLE "green_submissions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "category_code" TEXT NOT NULL,
    "activity_type_code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "quantity" DECIMAL(12,3) NOT NULL,
    "unit" TEXT NOT NULL,
    "activity_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "location_name" TEXT,
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "location_consent" BOOLEAN NOT NULL DEFAULT false,
    "is_public" BOOLEAN NOT NULL DEFAULT false,
    "metadata_json" JSONB,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "awarded_points" INTEGER NOT NULL DEFAULT 0,
    "points_tx_id" TEXT,
    "duplicate_warning" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "green_submissions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "green_submissions_user_id_created_at_idx" ON "green_submissions"("user_id", "created_at");
CREATE INDEX "green_submissions_status_created_at_idx" ON "green_submissions"("status", "created_at");
CREATE INDEX "green_submissions_category_code_status_idx" ON "green_submissions"("category_code", "status");

CREATE TABLE "green_evidence" (
    "id" TEXT NOT NULL,
    "submission_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "file_url" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "file_size" INTEGER NOT NULL,
    "sha256_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "green_evidence_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "green_evidence_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "green_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "green_evidence_sha256_hash_idx" ON "green_evidence"("sha256_hash");
CREATE INDEX "green_evidence_submission_id_idx" ON "green_evidence"("submission_id");

CREATE TABLE "green_verifications" (
    "id" TEXT NOT NULL,
    "submission_id" TEXT NOT NULL,
    "reviewer_user_id" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "awarded_points" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "green_verifications_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "green_verifications_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "green_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "green_verifications_submission_id_created_at_idx" ON "green_verifications"("submission_id", "created_at");

CREATE TABLE "green_impact_records" (
    "id" TEXT NOT NULL,
    "submission_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "metric_name" TEXT NOT NULL,
    "actual_emissions_kgco2e" DECIMAL(12,4),
    "baseline_emissions_kgco2e" DECIMAL(12,4),
    "avoided_emissions_kgco2e" DECIMAL(12,4),
    "sequestered_carbon_kgco2e" DECIMAL(12,4),
    "waste_prevented_kg" DECIMAL(12,4),
    "water_saved_liters" DECIMAL(12,3),
    "energy_saved_kwh" DECIMAL(12,4),
    "factor_version" TEXT NOT NULL,
    "method_id" TEXT NOT NULL,
    "data_quality" TEXT NOT NULL DEFAULT 'estimated',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "green_impact_records_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "green_impact_records_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "green_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "green_impact_records_user_id_created_at_idx" ON "green_impact_records"("user_id", "created_at");
CREATE INDEX "green_impact_records_submission_id_idx" ON "green_impact_records"("submission_id");

CREATE TABLE "green_plants" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "submission_id" TEXT,
    "common_name" TEXT NOT NULL,
    "scientific_name" TEXT,
    "species_group" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "ecosystem_type" TEXT NOT NULL,
    "planted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "location_name" TEXT,
    "survival_status" TEXT NOT NULL DEFAULT 'planted',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "green_plants_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "green_plants_user_id_planted_at_idx" ON "green_plants"("user_id", "planted_at");

CREATE TABLE "green_plant_monitoring" (
    "id" TEXT NOT NULL,
    "plant_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "submission_id" TEXT,
    "health_status" TEXT NOT NULL,
    "notes" TEXT,
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "green_plant_monitoring_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "green_plant_monitoring_plant_id_fkey" FOREIGN KEY ("plant_id") REFERENCES "green_plants"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "green_plant_monitoring_plant_id_recorded_at_idx" ON "green_plant_monitoring"("plant_id", "recorded_at");

CREATE TABLE "green_environment_reports" (
    "id" TEXT NOT NULL,
    "submission_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "report_category" TEXT NOT NULL,
    "subcategory" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'medium',
    "status" TEXT NOT NULL DEFAULT 'submitted',
    "is_anonymous" BOOLEAN NOT NULL DEFAULT false,
    "public_area_label" TEXT,
    "approx_lat" DECIMAL(8,4),
    "approx_lng" DECIMAL(8,4),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "green_environment_reports_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "green_environment_reports_submission_id_key" ON "green_environment_reports"("submission_id");
CREATE INDEX "green_environment_reports_status_report_category_idx" ON "green_environment_reports"("status", "report_category");

CREATE TABLE "green_challenges" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title_id" TEXT NOT NULL,
    "title_en" TEXT NOT NULL,
    "description_id" TEXT NOT NULL,
    "description_en" TEXT NOT NULL,
    "category_code" TEXT NOT NULL,
    "target_metric" TEXT NOT NULL,
    "target_value" DECIMAL(12,2) NOT NULL,
    "reward_points" INTEGER NOT NULL DEFAULT 0,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "green_challenges_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "green_challenges_code_key" ON "green_challenges"("code");

CREATE TABLE "green_challenge_members" (
    "id" TEXT NOT NULL,
    "challenge_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "opt_in_board" BOOLEAN NOT NULL DEFAULT false,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "green_challenge_members_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "green_challenge_members_challenge_id_fkey" FOREIGN KEY ("challenge_id") REFERENCES "green_challenges"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "green_challenge_members_challenge_id_user_id_key" ON "green_challenge_members"("challenge_id", "user_id");

CREATE TABLE "green_audit_logs" (
    "id" TEXT NOT NULL,
    "actor_user_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "target_entity" TEXT NOT NULL,
    "target_id" TEXT NOT NULL,
    "previous_value" JSONB,
    "new_value" JSONB,
    "reason" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "green_audit_logs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "green_audit_logs_actor_user_id_created_at_idx" ON "green_audit_logs"("actor_user_id", "created_at");
CREATE INDEX "green_audit_logs_target_entity_target_id_idx" ON "green_audit_logs"("target_entity", "target_id");
