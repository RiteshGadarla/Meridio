-- Basic activity feed (sidebar): one row per product create / edit / stock adjust / delete.
CREATE TYPE "ActivityAction" AS ENUM ('PRODUCT_CREATED', 'PRODUCT_UPDATED', 'STOCK_ADJUSTED', 'PRODUCT_DELETED');

CREATE TABLE "ActivityLog" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT,
    "action" "ActivityAction" NOT NULL,
    "productId" TEXT,
    "productName" TEXT NOT NULL,
    "productSku" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ActivityLog_organizationId_createdAt_idx" ON "ActivityLog"("organizationId", "createdAt");

ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
