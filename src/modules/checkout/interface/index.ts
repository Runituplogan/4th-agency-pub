export class CheckoutSessionResponseDto {
  sessionId: string;
  status: string | null;
  paymentStatus: string;
  amountTotal: number;
  currency: string | null;
  expiresAt: Date;
  url: string | null;
}
