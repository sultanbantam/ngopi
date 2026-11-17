-- CreateTable green_admin_applications
CREATE TABLE IF NOT EXISTS "green_admin_applications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "deposit_method" TEXT NOT NULL,
    "deposit_amount" DOUBLE PRECISION NOT NULL,
    "points_tx_id" TEXT,
    "bmc_tx_ref" TEXT,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reviewed_by" TEXT,
    "review_reason" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "green_admin_applications_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "green_admin_applications_user_id_created_at_idx" ON "green_admin_applications"("user_id", "created_at");
CREATE INDEX IF NOT EXISTS "green_admin_applications_status_created_at_idx" ON "green_admin_applications"("status", "created_at");

-- Ensure founder = superadmin and admin = admin
UPDATE "User" SET "role" = 'superadmin' WHERE LOWER("username") = 'founder';
UPDATE "User" SET "role" = 'admin' WHERE LOWER("username") = 'admin';
