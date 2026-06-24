-- AlterTable
ALTER TABLE "LeadSearchJob" ADD COLUMN "roles" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "LeadSearchJob" ADD COLUMN "expandTechRoles" BOOLEAN NOT NULL DEFAULT true;
