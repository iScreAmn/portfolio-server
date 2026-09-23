CREATE SCHEMA IF NOT EXISTS "public";

CREATE TYPE "Role" AS ENUM ('admin', 'owner', 'developer');

CREATE TYPE "LeadType" AS ENUM ('contact', 'calculator');

CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'admin',
    "password_updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "user_agent" TEXT,
    "ip" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "analytics_events" (
    "id" SERIAL NOT NULL,
    "session_id" TEXT NOT NULL,
    "visitor_id" TEXT,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "category" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "label" TEXT,
    "params" JSONB,
    "path" TEXT,
    "url" TEXT,
    "hostname" TEXT,
    "referrer" TEXT,
    "source_type" TEXT,
    "utm_source" TEXT,
    "utm_medium" TEXT,
    "utm_campaign" TEXT,
    "utm_term" TEXT,
    "utm_content" TEXT,
    "device_type" TEXT,
    "os" TEXT,
    "browser" TEXT,
    "screen_width" INTEGER,
    "screen_height" INTEGER,
    "locale" TEXT,
    "timezone" TEXT,
    "country" TEXT,
    "region" TEXT,
    "city" TEXT,
    "ip" TEXT,

    CONSTRAINT "analytics_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "leads" (
    "id" UUID NOT NULL,
    "type" "LeadType" NOT NULL,
    "name" TEXT NOT NULL,
    "contact" TEXT NOT NULL,
    "method" TEXT,
    "message" TEXT,
    "payload" JSONB,
    "ip" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

CREATE INDEX "refresh_tokens_expires_at_idx" ON "refresh_tokens"("expires_at");

CREATE INDEX "analytics_events_occurred_at_idx" ON "analytics_events"("occurred_at");

CREATE INDEX "analytics_events_session_id_occurred_at_idx" ON "analytics_events"("session_id", "occurred_at");

CREATE INDEX "analytics_events_category_action_occurred_at_idx" ON "analytics_events"("category", "action", "occurred_at");

CREATE INDEX "analytics_events_visitor_id_idx" ON "analytics_events"("visitor_id");

CREATE INDEX "leads_type_created_at_idx" ON "leads"("type", "created_at");

ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

