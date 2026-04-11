-- CreateEnum
CREATE TYPE "EntryStatus" AS ENUM ('PENDING', 'REVIEWING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "owner_entries" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "projectTitle" TEXT NOT NULL,
    "projectSummary" TEXT NOT NULL,
    "projectStory" TEXT NOT NULL,
    "status" "EntryStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "owner_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "owner_entries_status_idx" ON "owner_entries"("status");

-- CreateIndex
CREATE INDEX "owner_entries_createdAt_idx" ON "owner_entries"("createdAt");
