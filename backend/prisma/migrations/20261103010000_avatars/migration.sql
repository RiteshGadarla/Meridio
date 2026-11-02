-- Persist avatar looks so they stay stable. Nullable: existing rows render white-on-black.
ALTER TABLE "Organization" ADD COLUMN "avatar" JSONB;
ALTER TABLE "User" ADD COLUMN "avatar" JSONB;
