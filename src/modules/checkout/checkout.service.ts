import { Injectable, Logger } from '@nestjs/common';
import {
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
} from 'src/common/exceptions';
import prisma from 'src/shared/service/client';
import { CartStatus, PaymentStatus } from '@prisma/client';
import Stripe from 'stripe';
import { ConfigService } from '@nestjs/config';
import { CheckoutSessionResponseDto } from './interface';

@Injectable()
export class CheckoutService {
  private readonly logger = new Logger(CheckoutService.name);
  private readonly stripe: Stripe;
  private readonly processingFeePercent = 0.03;

  constructor(private readonly configService: ConfigService) {
    this.stripe = new Stripe(
      this.configService.getOrThrow('STRIPE_SECRET_KEY'),
      {
        apiVersion: '2026-02-25.clover',
      },
    );
  }

  async createCheckoutSession(userId: string): Promise<{ url: string | null }> {
    try {
      const cart = await prisma.cart.findUnique({
        where: { userId },
        include: { items: true },
      });

      if (!cart) {
        throw new NotFoundException('Cart not found');
      }

      if (cart.status === CartStatus.CHECKED_OUT) {
        throw new BadRequestException('Cart has already been checked out');
      }

      if (cart.items.length === 0) {
        throw new BadRequestException('Your cart is empty');
      }

      const frontendUrl = this.configService.getOrThrow('FRONTEND_URL');
      const currency = cart.items[0].currency.toLowerCase();

      const subtotal = cart.items.reduce(
        (sum, item) =>
          sum + (item.unitAmount + item.contentTypeFee) * item.quantity,
        0,
      );
      const processingFee = parseFloat(
        (subtotal * this.processingFeePercent).toFixed(2),
      );
      const amountTotal = parseFloat((subtotal + processingFee).toFixed(2));

      const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
        ...cart.items.flatMap((item) => [
          {
            price_data: {
              currency,
              product_data: {
                name: item.name,
                description:
                  `${item.websiteUrl} • ${item.country ?? ''}`.trim(),
                images: item.logoUrl ? [item.logoUrl] : [],
                metadata: {
                  placementId: item.placementId,
                  channelType: item.channelType ?? '',
                  placementType: item.placementType,
                  domainAuthority: item.domainAuthority?.toString() ?? '',
                  isDoFollow: item.isDoFollow.toString(),
                },
              },
              unit_amount: Math.round(item.unitAmount * 100),
            },
            quantity: item.quantity,
          },
          ...(item.contentTypeFee > 0
            ? [
                {
                  price_data: {
                    currency,
                    product_data: {
                      name: `${item.name} — ${
                        item.contentType === 'personal'
                          ? 'Personal Profile'
                          : item.contentType === 'marketing'
                            ? 'Marketing Blast'
                            : 'Content Fee'
                      }`,
                      description: 'Content type fee',
                    },
                    unit_amount: Math.round(item.contentTypeFee * 100),
                  },
                  quantity: item.quantity,
                },
              ]
            : []),
        ]),
        {
          price_data: {
            currency,
            product_data: {
              name: 'Processing Fee (3%)',
              description: 'Payment processing fee',
            },
            unit_amount: Math.round(processingFee * 100),
          },
          quantity: 1,
        },
      ];
      const session = await this.stripe.checkout.sessions.create({
        mode: 'payment',
        line_items: lineItems,
        expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
        success_url: `${frontendUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${frontendUrl}/cart`,
        customer_email: await this.getUserEmail(userId),
        metadata: {
          userId,
          cartId: cart.id,
          subtotal: subtotal.toFixed(2),
          processingFee: processingFee.toFixed(2),
          amountTotal: amountTotal.toFixed(2),
        },
        payment_intent_data: {
          metadata: {
            userId,
            cartId: cart.id,
            subtotal: subtotal.toFixed(2),
            processingFee: processingFee.toFixed(2),
            amountTotal: amountTotal.toFixed(2),
          },
        },
      });

      // if (!session.payment_intent) {
      //   this.logger.error(`No payment intent on session ${session.id}`);
      //   return { url: session.url };
      // }

      await prisma.payment.create({
        data: {
          userId,
          stripePaymentIntentId: '',
          stripeSessionId: session.id,
          stripeClientSecret: null,
          amount: amountTotal,
          currency,
          status: PaymentStatus.PENDING,
          expiresAt: new Date(Date.now() + 30 * 60 * 1000),
        },
      });

      this.logger.log(
        `Checkout session ${session.id} created for user ${userId}, amount: $${amountTotal} ${currency}`,
      );

      return { url: session.url };
    } catch (error) {
      this.logger.error(
        `createCheckoutSession failed for user ${userId}: ${error.message}`,
      );

      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      throw new InternalServerErrorException(
        'Failed to create checkout session',
      );
    }
  }

  async getCheckoutSession(
    sessionId: string,
    userId: string,
  ): Promise<CheckoutSessionResponseDto> {
    try {
      const session = await this.stripe.checkout.sessions.retrieve(sessionId, {
        expand: ['line_items', 'payment_intent'],
      });

      if (!session) {
        throw new NotFoundException('Checkout session not found');
      }

      if (session.metadata?.userId !== userId) {
        throw new NotFoundException('Checkout session not found');
      }

      return {
        sessionId: session.id,
        status: session.status,
        paymentStatus: session.payment_status,
        amountTotal: session.amount_total ? session.amount_total / 100 : 0,
        currency: session.currency,
        expiresAt: new Date(session.expires_at * 1000),
        url: session.url,
      };
    } catch (error) {
      this.logger.error(
        `getCheckoutSession failed for session ${sessionId}: ${error.message}`,
      );

      if (error instanceof NotFoundException) throw error;

      throw new InternalServerErrorException(
        'Failed to retrieve checkout session',
      );
    }
  }

  private async getUserEmail(userId: string): Promise<string | undefined> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    return user?.email;
  }
}
