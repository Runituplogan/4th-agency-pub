import { Injectable, Logger } from '@nestjs/common';
import { CreateCheckoutDto } from './dto/create-checkout.dto';
import { UpdateCheckoutDto } from './dto/update-checkout.dto';
import {
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
} from 'src/common/exceptions';
import prisma from 'src/shared/service/client';
import { CartStatus, PaymentStatus } from '@prisma/client';
import Stripe from 'stripe';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class CheckoutService {
  private readonly logger = new Logger(CheckoutService.name);
  private readonly stripe: Stripe;
  private readonly processingFeePercent = 0.03; // 3%

  constructor(private readonly configService: ConfigService) {
    this.stripe = new Stripe(
      this.configService.getOrThrow('STRIPE_SECRET_KEY'),
      {
        apiVersion: '2026-02-25.clover',
      },
    );
  }

  async createCheckoutSession(userId: string): Promise<{
    // clientSecret: string;
    paymentIntentId: string;
    amountTotal: number;
    currency: string;
  }> {
    try {
      // Fetch cart with items
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
        throw new BadRequestException('Cart is empty');
      }

      // Compute totals — same logic as getCartWithTotals
      const subtotal = cart.items.reduce(
        (sum, item) => sum + item.unitAmount * item.quantity,
        0,
      );
      const processingFee = parseFloat(
        (subtotal * this.processingFeePercent).toFixed(2),
      );
      const amountTotal = parseFloat((subtotal + processingFee).toFixed(2));

      // Stripe expects amount in smallest currency unit (cents)
      const amountInCents = Math.round(amountTotal * 100);
      const currency = cart.items[0].currency.toLowerCase();

      // Create Stripe Payment Intent
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: amountInCents,
        currency,
        metadata: {
          userId,
          cartId: cart.id,
          subtotal: subtotal.toString(),
          processingFee: processingFee.toString(),
          amountTotal: amountTotal.toString(),
        },
        automatic_payment_methods: { enabled: true },
      });

      // Create a PENDING payment record immediately
      // so we have an audit trail even if the user abandons
      await prisma.payment.create({
        data: {
          orderId: '', // no order yet — will be updated by webhook
          userId,
          stripePaymentIntentId: paymentIntent.id,
          amount: amountTotal,
          currency,
          status: PaymentStatus.PENDING,
          stripeEvent: undefined,
        },
      });

      this.logger.log(
        `Payment intent ${paymentIntent.id} created for user ${userId}, amount: ${amountTotal} ${currency}`,
      );

      return {
        // clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        amountTotal,
        currency,
      };
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
}
