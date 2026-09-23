CREATE TYPE "ReviewStatus" AS ENUM ('pending', 'approved');

CREATE TABLE "reviews" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "company" TEXT,
    "text" TEXT NOT NULL,
    "photo" TEXT,
    "logo" TEXT,
    "status" "ReviewStatus" NOT NULL DEFAULT 'pending',
    "approved_at" TIMESTAMP(3),
    "ip" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "reviews_status_created_at_idx" ON "reviews"("status", "created_at");
