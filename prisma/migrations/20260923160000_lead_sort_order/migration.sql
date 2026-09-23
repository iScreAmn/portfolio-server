ALTER TABLE "leads" ADD COLUMN "sort_order" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX "leads_sort_order_created_at_idx" ON "leads"("sort_order", "created_at");
