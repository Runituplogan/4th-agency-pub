-- AlterTable
ALTER TABLE "CartItem" ADD COLUMN     "contentType" TEXT,
ADD COLUMN     "contentTypeFee" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "contentType" TEXT,
ADD COLUMN     "contentTypeFee" DOUBLE PRECISION NOT NULL DEFAULT 0;
