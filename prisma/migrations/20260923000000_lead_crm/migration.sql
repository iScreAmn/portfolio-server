-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('new', 'in_progress', 'done', 'spam');

-- AlterEnum
-- Новое значение в этой же транзакции не используется, поэтому Postgres 16
-- принимает ADD VALUE без отдельной миграции.
ALTER TYPE "LeadType" ADD VALUE 'manual';

-- AlterTable
ALTER TABLE "leads" ADD COLUMN     "status" "LeadStatus" NOT NULL DEFAULT 'new',
ADD COLUMN     "note" TEXT,
-- DEFAULT здесь только чтобы проставить значение уже лежащим строкам: в схеме
-- у updatedAt дефолта нет (@updatedAt пишет его сам), поэтому сразу снимаем.
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "leads" ALTER COLUMN "updated_at" DROP DEFAULT;

-- CreateIndex
CREATE INDEX "leads_status_created_at_idx" ON "leads"("status", "created_at");
