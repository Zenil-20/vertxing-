-- AlterTable
ALTER TABLE "meetings" ADD COLUMN     "participantCount" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "doNotDisturb" BOOLEAN NOT NULL DEFAULT false;
