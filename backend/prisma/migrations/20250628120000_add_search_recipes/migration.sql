-- CreateTable
CREATE TABLE "SearchRecipe" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "query" TEXT NOT NULL,
    "role" TEXT,
    "roles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "location" TEXT,
    "company" TEXT,
    "limit" INTEGER NOT NULL DEFAULT 15,
    "expandTechRoles" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SearchRecipe_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SearchRecipe_slug_key" ON "SearchRecipe"("slug");
