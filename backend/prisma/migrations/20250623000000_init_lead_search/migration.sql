-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'ENRICHED', 'DOMAIN_FOUND', 'CONTACT_FOUND', 'VERIFIED', 'EMAIL_GENERATED', 'SENT', 'OPENED', 'REPLIED');

-- CreateEnum
CREATE TYPE "LeadSearchJobStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "LeadSearchJob" (
    "id" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "role" TEXT,
    "location" TEXT,
    "company" TEXT,
    "limit" INTEGER NOT NULL DEFAULT 25,
    "status" "LeadSearchJobStatus" NOT NULL DEFAULT 'PENDING',
    "leadsFound" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeadSearchJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "profileUrl" TEXT NOT NULL,
    "website" TEXT,
    "githubUrl" TEXT,
    "email" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
    "searchJobId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Lead_profileUrl_key" ON "Lead"("profileUrl");

-- CreateIndex
CREATE INDEX "Lead_status_idx" ON "Lead"("status");

-- CreateIndex
CREATE INDEX "Lead_company_idx" ON "Lead"("company");

-- CreateIndex
CREATE INDEX "Lead_role_idx" ON "Lead"("role");

-- CreateIndex
CREATE INDEX "Lead_searchJobId_idx" ON "Lead"("searchJobId");

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_searchJobId_fkey" FOREIGN KEY ("searchJobId") REFERENCES "LeadSearchJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;
