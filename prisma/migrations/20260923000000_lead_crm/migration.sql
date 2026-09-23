CREATE TYPE "LeadStatus" AS ENUM ('new', 'in_progress', 'done', 'spam');

ALTER TYPE "LeadType" ADD VALUE 'manual';

ALTER TABLE "leads" ADD COLUMN     "status" "LeadStatus" NOT NULL DEFAULT 'new',
ADD COLUMN     "note" TEXT,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "leads" ALTER COLUMN "updated_at" DROP DEFAULT;

CREATE INDEX "leads_status_created_at_idx" ON "leads"("status", "created_at");
