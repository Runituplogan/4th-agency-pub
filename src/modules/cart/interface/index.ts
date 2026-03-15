import { CartStatus } from '@prisma/client';

export class CartItemResponseDto {
  id: string;
  cartId: string;
  placementId: string;
  productId: string;
  name: string;
  websiteUrl: string;
  logoUrl: string | null;
  country: string | null;
  type: string;
  domainAuthority: number | null;
  domainRanking: number | null;
  isDoFollow: boolean;
  unitAmount: number;
  pricingTier: string;
  currency: string;
  quantity: number;
  lineTotal: number;
  createdAt: Date;
  updatedAt: Date;
}

export class CartResponseDto {
  id: string;
  userId: string;
  status: CartStatus;
  items: CartItemResponseDto[];
  subtotal: number;
  processingFee: number;
  total: number;
  currency: string;
  itemCount: number;
  createdAt: Date;
  updatedAt: Date;
}
