/*
  Warnings:

  - A unique constraint covering the columns `[emailVerificationCode]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "SignupMode" AS ENUM ('OAUTH', 'REGULAR');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "emailCodeExpires" TIMESTAMP(3),
ADD COLUMN     "emailVerificationCode" TEXT,
ADD COLUMN     "googleId" TEXT,
ADD COLUMN     "profileImage" TEXT,
ADD COLUMN     "refreshToken" TEXT,
ADD COLUMN     "signUpMode" "SignupMode",
ADD COLUMN     "verified" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX "User_emailVerificationCode_key" ON "User"("emailVerificationCode");
