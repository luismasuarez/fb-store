/*
  Warnings:

  - You are about to drop the `groups` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE "groups";

-- CreateTable
CREATE TABLE "Group" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "maxPosts" INTEGER NOT NULL DEFAULT 30,
    "purpose" TEXT,
    "reject_threshold" DOUBLE PRECISION NOT NULL DEFAULT 0.2,
    "classify_threshold" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "lastScraped" TIMESTAMP(3),
    "lastError" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Group_pkey" PRIMARY KEY ("id")
);
