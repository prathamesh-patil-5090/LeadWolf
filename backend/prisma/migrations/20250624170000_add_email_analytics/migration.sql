-- AlterEnum
ALTER TYPE "LeadStatus" ADD VALUE 'BOUNCED';

-- CreateEnum
CREATE TYPE "EmailEventType" AS ENUM ('SENT', 'DELIVERED', 'OPENED', 'CLICKED', 'BOUNCED', 'SOFT_BOUNCE', 'SPAM', 'UNSUBSCRIBED', 'REPLIED');

-- CreateTable
CREATE TABLE "EmailEvent" (
    "id" TEXT NOT NULL,
    "outreachEmailId" TEXT,
    "leadId" TEXT,
    "eventType" "EmailEventType" NOT NULL,
    "source" TEXT NOT NULL,
    "externalId" TEXT,
    "recipientEmail" TEXT,
    "payload" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmailEvent_leadId_idx" ON "EmailEvent"("leadId");

-- CreateIndex
CREATE INDEX "EmailEvent_outreachEmailId_idx" ON "EmailEvent"("outreachEmailId");

-- CreateIndex
CREATE INDEX "EmailEvent_eventType_idx" ON "EmailEvent"("eventType");

-- CreateIndex
CREATE INDEX "EmailEvent_occurredAt_idx" ON "EmailEvent"("occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "EmailEvent_source_externalId_key" ON "EmailEvent"("source", "externalId");

-- AddForeignKey
ALTER TABLE "EmailEvent" ADD CONSTRAINT "EmailEvent_outreachEmailId_fkey" FOREIGN KEY ("outreachEmailId") REFERENCES "OutreachEmail"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailEvent" ADD CONSTRAINT "EmailEvent_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;
