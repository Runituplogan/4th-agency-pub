import { CartStatus } from '@prisma/client';

export class CartItemResponseDto {
  id: string;
  cartId: string;
  placementId?: string | undefined; 
  name: string | null;
  websiteUrl: string | null;
  logoUrl: string | null;
  country: string | null;
  outletName: string | null;
  channelType: string | null;
  placementType: string | null;
  domainAuthority: number | null;
  domainRanking: number | null;
  isDoFollow: boolean;
  minDeliveryDays: number | null;
  maxDeliveryDays: number | null;
  unitAmount: number | null; 
  pricingTier: string | null; 
  currency: string;
  quantity: number;
  lineTotal: number;
  contentType: string | null;
  contentTypeFee: number;
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
  itemCount?: number | null;
  createdAt: Date;
  updatedAt: Date;
}
