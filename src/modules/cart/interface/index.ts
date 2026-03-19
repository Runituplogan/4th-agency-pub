import { CartStatus } from '@prisma/client';

export class CartItemResponseDto {
  id: string;
  cartId: string;
  placementId: string;
  name: string;
  websiteUrl: string;
  logoUrl: string | null;
  country: string | null;
  outletName: string | null;
  channelType: string | null;
  placementType: string;
  domainAuthority: number | null;
  domainRanking: number | null;
  isDoFollow: boolean;
  minDeliveryDays: number | null;
  maxDeliveryDays: number | null;
  unitAmount: number;
  pricingTier: string;
  currency: string;
  quantity: number;
  lineTotal: number;
  createdAt: Date;
  updatedAt: Date;
  contentType: string | null;
  contentTypeFee: number;
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
