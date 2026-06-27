-- AlterTable
ALTER TABLE "OutreachEmail" ADD COLUMN "sentAt" TIMESTAMP(3);
ALTER TABLE "OutreachEmail" ADD COLUMN "sentTo" TEXT;
ALTER TABLE "OutreachEmail" ADD COLUMN "brevoMessageId" TEXT;
ALTER TABLE "OutreachEmail" ADD COLUMN "sendError" TEXT;
