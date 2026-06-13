-- AlterTable: per-user "may start calls" lever. New accounts are LOCKED by
-- default (the column default is false).
ALTER TABLE "users" ADD COLUMN     "callsEnabled" BOOLEAN NOT NULL DEFAULT false;

-- Grandfather EXISTING accounts: anyone who signed up before call-authorization
-- existed keeps the ability to call, so this rollout breaks nothing for them.
-- (The default above still applies to every account created from now on.)
UPDATE "users" SET "callsEnabled" = true;
