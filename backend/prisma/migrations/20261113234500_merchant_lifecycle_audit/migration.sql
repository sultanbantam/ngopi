-- CreateEnum
CREATE TYPE "MerchantReviewStatus" AS ENUM ('pending', 'approved', 'rejected');

-- AlterTable
ALTER TABLE "merchant_profiles" ADD COLUMN     "business_category" TEXT,
ADD COLUMN     "is_showcase" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "rejection_reason" TEXT,
ADD COLUMN     "review_status" "MerchantReviewStatus" NOT NULL DEFAULT 'pending',
ADD COLUMN     "reviewed_at" TIMESTAMP(3),
ADD COLUMN     "reviewed_by" TEXT,
ADD COLUMN     "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "supporting_docs" JSONB,
ADD COLUMN     "deleted_at" TIMESTAMP(3),
ALTER COLUMN "user_id" DROP NOT NULL,
ALTER COLUMN "is_verified" SET DEFAULT false;

-- CreateTable
CREATE TABLE "merchant_review_audits" (
    "id" TEXT NOT NULL,
    "merchant_id" TEXT NOT NULL,
    "actor_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "from_status" "MerchantReviewStatus",
    "to_status" "MerchantReviewStatus" NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "merchant_review_audits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "merchant_review_audits_merchant_id_created_at_idx" ON "merchant_review_audits"("merchant_id", "created_at");

-- CreateIndex
CREATE INDEX "merchant_review_audits_actor_id_created_at_idx" ON "merchant_review_audits"("actor_id", "created_at");

-- CreateIndex
CREATE INDEX "merchant_profiles_review_status_is_showcase_idx" ON "merchant_profiles"("review_status", "is_showcase");

-- CreateIndex
CREATE INDEX "merchant_profiles_reviewed_by_idx" ON "merchant_profiles"("reviewed_by");

-- AddForeignKey
ALTER TABLE "merchant_profiles" ADD CONSTRAINT "merchant_profiles_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merchant_review_audits" ADD CONSTRAINT "merchant_review_audits_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "merchant_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merchant_review_audits" ADD CONSTRAINT "merchant_review_audits_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

