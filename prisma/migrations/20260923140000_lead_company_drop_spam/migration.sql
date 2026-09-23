ALTER TABLE "leads" ADD COLUMN "company" TEXT;

UPDATE "leads" SET "status" = 'done' WHERE "status" = 'spam';

ALTER TYPE "LeadStatus" RENAME TO "LeadStatus_old";

CREATE TYPE "LeadStatus" AS ENUM ('new', 'in_progress', 'promotion', 'done');

ALTER TABLE "leads" ALTER COLUMN "status" DROP DEFAULT;

ALTER TABLE "leads"
  ALTER COLUMN "status" TYPE "LeadStatus" USING ("status"::text::"LeadStatus");

ALTER TABLE "leads" ALTER COLUMN "status" SET DEFAULT 'new';

DROP TYPE "LeadStatus_old";
