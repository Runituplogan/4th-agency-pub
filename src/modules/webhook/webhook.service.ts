import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { NotificationService } from '../notification/notification.service';
import {
  BadRequestException,
  InternalServerErrorException,
} from 'src/common/exceptions';
import prisma from 'src/shared/service/client';
import { CartStatus, OrderStatus, PaymentStatus } from '@prisma/client';
import { TemplateService } from 'src/templates/template.service';

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);
  private readonly stripe: Stripe;

  constructor(
    private readonly configService: ConfigService,
    private readonly notificationService: NotificationService,
    private readonly templateService: TemplateService,
  ) {
    this.stripe = new Stripe(
      this.configService.getOrThrow('STRIPE_SECRET_KEY'),
      {
        apiVersion: '2026-02-25.clover',
      },
    );
  }

  // constructEvent(payload: Buffer, signature: string): Stripe.Event {
  //   const webhookSecret = this.configService.getOrThrow(
  //     'STRIPE_WEBHOOK_SECRET',
  //   );

  //   try {
  //     return this.stripe.webhooks.constructEvent(
  //       payload,
  //       signature,
  //       webhookSecret,
  //     );
  //   } catch (error) {
  //     this.logger.error(
  //       `Webhook signature verification failed: ${error.message}`,
  //     );
  //     throw new BadRequestException('Invalid webhook signature');
  //   }
  // }

  constructEvent(payload: Buffer, signature: string): Stripe.Event {
    const webhookSecret = this.configService.getOrThrow(
      'STRIPE_WEBHOOK_SECRET',
    );

    this.logger.log(
      `Webhook secret loaded: ${webhookSecret?.substring(0, 10)}...`,
    );
    this.logger.log(`Signature received: ${signature?.substring(0, 20)}...`);

    try {
      return this.stripe.webhooks.constructEvent(
        payload,
        signature,
        webhookSecret,
      );
    } catch (error) {
      this.logger.error(
        `Webhook signature verification failed: ${error.message}`,
      );
      throw new BadRequestException('Invalid webhook signature');
    }
  }

  async handleWebhookEvent(event: Stripe.Event): Promise<void> {
    this.logger.log(`Stripe webhook received: ${event.type} (${event.id})`);

    switch (event.type) {
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded':
        await this.handleCheckoutCompleted(event);
        break;
      case 'checkout.session.expired':
      case 'checkout.session.async_payment_failed':
        await this.handleCheckoutExpired(event);
        break;
      case 'charge.refunded':
        await this.handleRefund(event);
        break;
      default:
        this.logger.log(`Unhandled webhook event: ${event.type}`);
    }
  }

  private async handleCheckoutCompleted(event: Stripe.Event): Promise<void> {
    const session = event.data.object as Stripe.Checkout.Session;

    if (!session.metadata) {
      this.logger.error(`Missing metadata on session ${session.id}`);
      return;
    }
    const { userId, cartId, subtotal, processingFee, amountTotal } =
      session.metadata as {
        userId: string;
        cartId: string;
        subtotal: string;
        processingFee: string;
        amountTotal: string;
      };

    //idempotency — skip if order already exists
    const existingOrder = await prisma.order.findFirst({
      where: { stripePaymentIntentId: session.payment_intent as string },
    });

    if (existingOrder) {
      this.logger.warn(
        `Duplicate webhook for session ${session.id} — skipping`,
      );
      return;
    }

    const cart = await prisma.cart.findUnique({
      where: { id: cartId },
      include: { items: true },
    });

    if (!cart) {
      this.logger.error(`Cart ${cartId} not found for session ${session.id}`);
      return;
    }

    const paymentIntent = await this.stripe.paymentIntents.retrieve(
      session.payment_intent as string,
      { expand: ['latest_charge'] },
    );

    const charge = paymentIntent.latest_charge as Stripe.Charge;

    let order: any;

    try {
      await prisma.$transaction(async (tx) => {
        order = await tx.order.create({
          data: {
            userId,
            cartId,
            status: OrderStatus.PAID,
            stripePaymentIntentId: session.payment_intent as string,
            stripeChargeId: charge?.id ?? null,
            subtotal: parseFloat(subtotal),
            processingFee: parseFloat(processingFee),
            amountTotal: parseFloat(amountTotal),
            currency: session.currency ?? 'usd',
            paidAt: new Date(),
            items: {
              create: cart.items.map((item) => ({
                placementId: item.placementId,
                name: item.name,
                websiteUrl: item.websiteUrl,
                logoUrl: item.logoUrl,
                country: item.country,
                outletName: item.outletName,
                channelType: item.channelType,
                placementType: item.placementType,
                domainAuthority: item.domainAuthority,
                domainRanking: item.domainRanking,
                isDoFollow: item.isDoFollow,
                minDeliveryDays: item.minDeliveryDays,
                maxDeliveryDays: item.maxDeliveryDays,
                unitAmount: item.unitAmount,
                pricingTier: item.pricingTier,
                currency: item.currency,
                quantity: item.quantity,
                contentType: item.contentType,
                contentTypeFee: item.contentTypeFee,
              })),
            },
          },
        });

        await tx.payment.updateMany({
          where: { stripeSessionId: session.id },
          data: {
            orderId: order.id,
            stripePaymentIntentId: session.payment_intent as string,
            status: PaymentStatus.SUCCEEDED,
            stripeChargeId: charge?.id ?? null,
            paymentMethod: charge?.payment_method_details?.type ?? null,
            last4: charge?.payment_method_details?.card?.last4 ?? null,
            cardBrand: charge?.payment_method_details?.card?.brand ?? null,
            paidAt: new Date(),
            stripeEvent: event as any,
          },
        });
        await tx.cartItem.deleteMany({ where: { cartId } });
        await tx.cart.update({
          where: { id: cartId },
          data: { status: CartStatus.ACTIVE },
        });
      });
    } catch (txError) {
      this.logger.error(
        `Transaction failed for session ${session.id}: ${txError.message}`,
      );
      throw txError;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, firstName: true },
    });

    if (user) {
      try {
        const orderItemsHtml = cart.items
          .map(
            (item) => `
        <table width="100%" cellpadding="0" cellspacing="0" border="0"
          style="margin-bottom:10px;background:#f9fafb;border-radius:6px;border:1px solid #e5e7eb;">
          <tr>
            <td style="padding:12px 16px;">
              <p style="margin:0 0 4px;font-size:14px;font-weight:700;color:#111827;">
                ${item.name}
              </p>
              <p style="margin:0 0 4px;font-size:13px;color:#6b7280;">
                ${item.websiteUrl}
              </p>
              <p style="margin:0;font-size:13px;color:#374151;">
               Qty: ${item.quantity} × ${item.currency.toUpperCase()} ${item.unitAmount.toFixed(2)}
= <strong>${item.currency.toUpperCase()} ${(item.quantity * item.unitAmount).toFixed(2)}</strong>
              </p>
            </td>
          </tr>
        </table>
      `,
          )
          .join('');

        const emailTemplate = await this.templateService.orderConfirmedTemplate(
          {
            firstName: user.firstName,
            orderId: order.id,
            orderDate: new Date().toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            }),
            orderTotal: `${session.currency?.toUpperCase() ?? 'USD'} ${parseFloat(amountTotal).toFixed(2)}`,
            orderItems: orderItemsHtml,
            year: new Date().getFullYear().toString(),
          },
        );

        await this.notificationService.sendEmail({
          to: user.email,
          subject: 'Your Order has been Placed — 4E Agency',
          html: emailTemplate,
        });

        this.logger.log(`Order confirmation email sent to ${user.email}`);
      } catch (emailError) {
        this.logger.error(
          `Order confirmation email failed for user ${userId}: ${emailError.message}`,
        );
      }
    }

    this.logger.log(`Order created for session ${session.id}, user ${userId}`);
  }

  private async handleCheckoutExpired(event: Stripe.Event): Promise<void> {
    const session = event.data.object as Stripe.Checkout.Session;

    await prisma.payment.updateMany({
      where: { stripeSessionId: session.id },
      data: {
        status: PaymentStatus.FAILED,
        failureMessage: 'Checkout session expired',
        stripeEvent: event as any,
      },
    });

    this.logger.warn(`Checkout session ${session.id} expired`);
  }

  private async handleRefund(event: Stripe.Event): Promise<void> {
    const charge = event.data.object as Stripe.Charge;
    const paymentIntentId = charge.payment_intent as string;

    if (!paymentIntentId) {
      this.logger.warn(
        `Refund received with no payment intent on charge ${charge.id}`,
      );
      return;
    }

    const isPartial = charge.amount_refunded < charge.amount;

    await prisma.payment.updateMany({
      where: { stripePaymentIntentId: paymentIntentId },
      data: {
        status: isPartial
          ? PaymentStatus.PARTIALLY_REFUNDED
          : PaymentStatus.REFUNDED,
        stripeEvent: event as any,
      },
    });

    await prisma.order.updateMany({
      where: { stripePaymentIntentId: paymentIntentId },
      data: {
        status: OrderStatus.REFUNDED,
      },
    });

    this.logger.log(
      `Refund processed for payment intent ${paymentIntentId} — ${isPartial ? 'partial' : 'full'}`,
    );
  }
}
