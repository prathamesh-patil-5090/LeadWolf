-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "website" TEXT,
    "scrapedContent" TEXT,
    "summary" TEXT,
    "industry" TEXT,
    "products" TEXT,
    "personalizationHooks" JSONB,
    "discoveredEmails" JSONB,
    "discoveredAt" TIMESTAMP(3),
    "summarizedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN "emailSource" TEXT;
ALTER TABLE "Lead" ADD COLUMN "companyId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Company_domain_key" ON "Company"("domain");
CREATE INDEX "Company_name_idx" ON "Company"("name");
CREATE INDEX "Lead_companyId_idx" ON "Lead"("companyId");

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
