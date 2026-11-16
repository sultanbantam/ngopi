-- CreateTable
CREATE TABLE "cekkes_user_records" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "profile_json" JSONB,
    "telemetry_json" JSONB,
    "findings_json" JSONB,
    "checklist_json" JSONB,
    "checklist_date" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cekkes_user_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cekkes_user_records_user_id_key" ON "cekkes_user_records"("user_id");
