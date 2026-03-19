/*
  Warnings:

  - You are about to drop the column `productId` on the `CartItem` table. All the data in the column will be lost.
  - You are about to drop the column `type` on the `CartItem` table. All the data in the column will be lost.
  - You are about to alter the column `unitAmount` on the `CartItem` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Integer`.
  - You are about to drop the column `productId` on the `OrderItem` table. All the data in the column will be lost.
  - You are about to drop the column `type` on the `OrderItem` table. All the data in the column will be lost.
  - You are about to alter the column `unitAmount` on the `OrderItem` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Integer`.
  - Added the required column `placementType` to the `CartItem` table without a default value. This is not possible if the table is not empty.
  - Added the required column `placementType` to the `OrderItem` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "CartItem" DROP COLUMN "productId",
DROP COLUMN "type",
ADD COLUMN     "channelType" TEXT,
ADD COLUMN     "maxDeliveryDays" INTEGER,
ADD COLUMN     "minDeliveryDays" INTEGER,
ADD COLUMN     "outletName" TEXT,
ADD COLUMN     "placementType" TEXT NOT NULL,
ALTER COLUMN "unitAmount" SET DATA TYPE INTEGER,
ALTER COLUMN "currency" SET DEFAULT 'usd';

-- AlterTable
ALTER TABLE "OrderItem" DROP COLUMN "productId",
DROP COLUMN "type",
ADD COLUMN     "channelType" TEXT,
ADD COLUMN     "maxDeliveryDays" INTEGER,
ADD COLUMN     "minDeliveryDays" INTEGER,
ADD COLUMN     "outletName" TEXT,
ADD COLUMN     "placementType" TEXT NOT NULL,
ALTER COLUMN "unitAmount" SET DATA TYPE INTEGER,
ALTER COLUMN "currency" SET DEFAULT 'usd';
