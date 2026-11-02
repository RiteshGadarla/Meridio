-- Display currency per organization; INR (rupees) by default.
ALTER TABLE "Organization" ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'INR';
