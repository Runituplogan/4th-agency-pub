/*
  Warnings:

  - You are about to drop the column `emailCodeExpires` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `emailVerificationCode` on the `User` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[emailVerificationToken]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "User_emailVerificationCode_key";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "emailCodeExpires",
DROP COLUMN "emailVerificationCode",
ADD COLUMN     "emailTokenExpires" TIMESTAMP(3),
ADD COLUMN     "emailVerificationToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_emailVerificationToken_key" ON "User"("emailVerificationToken");
