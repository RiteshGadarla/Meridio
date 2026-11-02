-- Raw SQL migration: things Prisma's schema language cannot express.
-- Do not delete: the application relies on these as a safety net and for search speed.

-- ===== CHECK constraints =====
-- WHY: validation lives in the API (Zod), but a bug there must never be able to store a negative
-- stock level or price. The database is the last line of defence.

-- Stock can never go below zero (also protects concurrent decrements later).
ALTER TABLE "Product"
  ADD CONSTRAINT "Product_quantityOnHand_nonneg_chk" CHECK ("quantityOnHand" >= 0);

-- Prices are optional (NULL passes a CHECK), but when present must be non-negative.
ALTER TABLE "Product"
  ADD CONSTRAINT "Product_costPrice_nonneg_chk" CHECK ("costPrice" >= 0);
ALTER TABLE "Product"
  ADD CONSTRAINT "Product_sellingPrice_nonneg_chk" CHECK ("sellingPrice" >= 0);

-- Per-product threshold override: NULL means "use the org default"; 0 is a valid explicit value.
ALTER TABLE "Product"
  ADD CONSTRAINT "Product_lowStockThreshold_nonneg_chk" CHECK ("lowStockThreshold" >= 0);

-- Organization-wide default threshold.
ALTER TABLE "Organization"
  ADD CONSTRAINT "Organization_defaultLowStockThreshold_nonneg_chk" CHECK ("defaultLowStockThreshold" >= 0);

-- ===== Fast substring search (pg_trgm) =====
-- WHY: product search uses ILIKE '%text%', which a normal B-tree index cannot accelerate.
-- Trigram GIN indexes make it fast even with many rows. Available on Neon.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX "Product_name_trgm_idx" ON "Product" USING GIN ("name" gin_trgm_ops);
CREATE INDEX "Product_sku_trgm_idx" ON "Product" USING GIN ("sku" gin_trgm_ops);
