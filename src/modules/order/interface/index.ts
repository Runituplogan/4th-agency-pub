import { OrderStatus, PaymentStatus } from '@prisma/client';

export class OrderItemResponseDto {
  id: string;
  placementId: string;
  channelType: string;
  placementType: string;
  name: string;
  websiteUrl: string;
  logoUrl: string | null;
  country: string | null;
  domainAuthority: number | null;
  domainRanking: number | null;
  isDoFollow: boolean;
  unitAmount: number;
  pricingTier: string;
  currency: string;
  quantity: number;
  lineTotal: number;
}

export class OrderPaymentResponseDto {
  id: string;
  status: PaymentStatus;
  paymentMethod: string | null;
  last4: string | null;
  cardBrand: string | null;
  amount: number;
  currency: string;
  paidAt: Date | null;
  failureCode: string | null;
  failureMessage: string | null;
  createdAt: Date;
}

export class OrderResponseDto {
  id: string;
  status: OrderStatus;
  subtotal: number;
  processingFee: number;
  amountTotal: number;
  currency: string;
  paidAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  items: OrderItemResponseDto[];
  payments?: OrderPaymentResponseDto[];
}

export class PaginationMetaDto {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export class PaginatedOrdersResponseDto {
  data: {
    data: OrderResponseDto[];
    meta: PaginationMetaDto;
  };
}