ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "recovery_pin_hash" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "recovery_email" TEXT;

CREATE TABLE IF NOT EXISTS "password_reset_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'ngopi_inbox',
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "password_reset_tokens_user_id_created_at_idx" ON "password_reset_tokens"("user_id", "created_at");

CREATE TABLE IF NOT EXISTS "library_works" (
    "id" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "author_username" TEXT NOT NULL,
    "author_name" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "synopsis" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'fiksi',
    "cover_emoji" TEXT NOT NULL DEFAULT '📚',
    "status" TEXT NOT NULL DEFAULT 'published',
    "views_count" INTEGER NOT NULL DEFAULT 0,
    "total_tip_points" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "library_works_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "library_works_status_created_at_idx" ON "library_works"("status", "created_at");
CREATE INDEX IF NOT EXISTS "library_works_author_id_created_at_idx" ON "library_works"("author_id", "created_at");

CREATE TABLE IF NOT EXISTS "library_chapters" (
    "id" TEXT NOT NULL,
    "work_id" TEXT NOT NULL,
    "chapter_number" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "word_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "library_chapters_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "library_chapters_work_id_chapter_number_key" ON "library_chapters"("work_id", "chapter_number");

CREATE TABLE IF NOT EXISTS "library_tips" (
    "id" TEXT NOT NULL,
    "work_id" TEXT NOT NULL,
    "from_user_id" TEXT NOT NULL,
    "to_user_id" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "library_tips_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "library_tips_work_id_created_at_idx" ON "library_tips"("work_id", "created_at");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'library_chapters_work_id_fkey'
    ) THEN
        ALTER TABLE "library_chapters"
        ADD CONSTRAINT "library_chapters_work_id_fkey"
        FOREIGN KEY ("work_id") REFERENCES "library_works"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'library_tips_work_id_fkey'
    ) THEN
        ALTER TABLE "library_tips"
        ADD CONSTRAINT "library_tips_work_id_fkey"
        FOREIGN KEY ("work_id") REFERENCES "library_works"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
