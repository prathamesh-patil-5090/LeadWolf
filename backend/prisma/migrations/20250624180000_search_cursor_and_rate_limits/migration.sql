-- CreateTable
CREATE TABLE "LeadSearchCursor" (
    "id" TEXT NOT NULL,
    "searchKey" TEXT NOT NULL,
    "rolePages" JSONB NOT NULL DEFAULT '{}',
    "totalFetched" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeadSearchCursor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LeadSearchCursor_searchKey_key" ON "LeadSearchCursor"("searchKey");

-- AlterTable
ALTER TABLE "LeadSearchJob" ADD COLUMN "newLeadsFound" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "LeadSearchJob" ADD COLUMN "skippedExisting" INTEGER NOT NULL DEFAULT 0;
