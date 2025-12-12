/*
  Warnings:

  - You are about to drop the `SuggestedReply` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `contactId` to the `Call` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "SuggestedReply" DROP CONSTRAINT "SuggestedReply_callId_fkey";

-- AlterTable
ALTER TABLE "Call" ADD COLUMN     "contactId" TEXT NOT NULL;

-- DropTable
DROP TABLE "SuggestedReply";

-- CreateTable
CREATE TABLE "Contact" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "name" TEXT,
    "memo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Contact_userId_createdAt_idx" ON "Contact"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Contact_userId_phoneNumber_key" ON "Contact"("userId", "phoneNumber");

-- CreateIndex
CREATE INDEX "Call_contactId_createdAt_idx" ON "Call"("contactId", "createdAt");

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Call" ADD CONSTRAINT "Call_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
