DO $$
BEGIN
  CREATE TYPE "TicketStatus" AS ENUM ('open', 'in_progress', 'resolved', 'closed');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "role" TEXT NOT NULL DEFAULT 'user';

CREATE TABLE IF NOT EXISTS "platforms" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "display_name" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "website_url" TEXT NOT NULL,
  "icon" TEXT,
  "support_agent_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "platforms_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "platforms_name_key" ON "platforms"("name");
CREATE INDEX IF NOT EXISTS "platforms_support_agent_id_idx" ON "platforms"("support_agent_id");

CREATE TABLE IF NOT EXISTS "faqs" (
  "id" TEXT NOT NULL,
  "platform_id" TEXT NOT NULL,
  "question" TEXT NOT NULL,
  "answer" TEXT NOT NULL,
  "keywords" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "faqs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "faqs_platform_id_question_key" ON "faqs"("platform_id", "question");
CREATE INDEX IF NOT EXISTS "faqs_platform_id_idx" ON "faqs"("platform_id");

CREATE TABLE IF NOT EXISTS "tickets" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "platform_id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "status" "TicketStatus" NOT NULL DEFAULT 'open',
  "assigned_agent_id" TEXT,
  "is_escalated" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "tickets_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "tickets_user_id_idx" ON "tickets"("user_id");
CREATE INDEX IF NOT EXISTS "tickets_platform_id_idx" ON "tickets"("platform_id");
CREATE INDEX IF NOT EXISTS "tickets_assigned_agent_id_idx" ON "tickets"("assigned_agent_id");
CREATE INDEX IF NOT EXISTS "tickets_status_idx" ON "tickets"("status");

CREATE TABLE IF NOT EXISTS "ticket_messages" (
  "id" TEXT NOT NULL,
  "ticket_id" TEXT NOT NULL,
  "sender_id" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "is_internal" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ticket_messages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ticket_messages_ticket_id_idx" ON "ticket_messages"("ticket_id");
CREATE INDEX IF NOT EXISTS "ticket_messages_sender_id_idx" ON "ticket_messages"("sender_id");
CREATE INDEX IF NOT EXISTS "ticket_messages_is_internal_idx" ON "ticket_messages"("is_internal");

CREATE TABLE IF NOT EXISTS "ticket_audit_logs" (
  "id" TEXT NOT NULL,
  "ticket_id" TEXT NOT NULL,
  "actor_id" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ticket_audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ticket_audit_logs_ticket_id_idx" ON "ticket_audit_logs"("ticket_id");
CREATE INDEX IF NOT EXISTS "ticket_audit_logs_actor_id_idx" ON "ticket_audit_logs"("actor_id");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'platforms_support_agent_id_fkey') THEN
    ALTER TABLE "platforms" ADD CONSTRAINT "platforms_support_agent_id_fkey" FOREIGN KEY ("support_agent_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'faqs_platform_id_fkey') THEN
    ALTER TABLE "faqs" ADD CONSTRAINT "faqs_platform_id_fkey" FOREIGN KEY ("platform_id") REFERENCES "platforms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tickets_user_id_fkey') THEN
    ALTER TABLE "tickets" ADD CONSTRAINT "tickets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tickets_platform_id_fkey') THEN
    ALTER TABLE "tickets" ADD CONSTRAINT "tickets_platform_id_fkey" FOREIGN KEY ("platform_id") REFERENCES "platforms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tickets_assigned_agent_id_fkey') THEN
    ALTER TABLE "tickets" ADD CONSTRAINT "tickets_assigned_agent_id_fkey" FOREIGN KEY ("assigned_agent_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ticket_messages_ticket_id_fkey') THEN
    ALTER TABLE "ticket_messages" ADD CONSTRAINT "ticket_messages_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ticket_messages_sender_id_fkey') THEN
    ALTER TABLE "ticket_messages" ADD CONSTRAINT "ticket_messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ticket_audit_logs_ticket_id_fkey') THEN
    ALTER TABLE "ticket_audit_logs" ADD CONSTRAINT "ticket_audit_logs_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ticket_audit_logs_actor_id_fkey') THEN
    ALTER TABLE "ticket_audit_logs" ADD CONSTRAINT "ticket_audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;