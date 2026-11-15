-- CreateTable
CREATE TABLE "ngopinomic_digital_mous" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "ngopi_id" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "partnership_role" TEXT NOT NULL,
    "mou_version" TEXT NOT NULL DEFAULT 'v1.0-2026',
    "mou_number" TEXT NOT NULL,
    "signature_text" TEXT NOT NULL,
    "signature_hash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'signed',
    "signed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ngopinomic_digital_mous_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ngopinomic_digital_mous_mou_number_key" ON "ngopinomic_digital_mous"("mou_number");

-- CreateIndex
CREATE INDEX "ngopinomic_digital_mous_user_id_signed_at_idx" ON "ngopinomic_digital_mous"("user_id", "signed_at");
