import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GetOrdersQueryDto } from './dto/get-orders-query.dto';
import { OrderResponseDto, PaginatedOrdersResponseDto } from './interface';
import { Prisma } from '@prisma/client';
import prisma from 'src/shared/service/client';

@Injectable()
export class OrderService {
  private readonly logger = new Logger(OrderService.name);

  constructor(private readonly configService: ConfigService) {}

  async getUserOrders(
    userId: string,
    query: GetOrdersQueryDto,
  ): Promise<PaginatedOrdersResponseDto> {
    try {
      const { page = 1, limit = 10, status } = query;
      const skip = (page - 1) * limit;

      const where: Prisma.OrderWhereInput = {
        userId,
        ...(status && { status }),
      };

      const [orders, total] = await Promise.all([
        prisma.order.findMany({
          where,
          include: { items: true },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
        }),
        prisma.order.count({ where }),
      ]);

      this.logger.log(`Fetched ${orders.length} orders for user ${userId}`);

      return {
        data: orders.map(this.mapOrderToResponse),
        meta: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
          hasNextPage: page < Math.ceil(total / limit),
          hasPreviousPage: page > 1,
        },
      };
    } catch (error) {
      this.logger.error(
        `getUserOrders failed for user ${userId}: ${error.message}`,
      );
      throw new InternalServerErrorException('Failed to retrieve orders');
    }
  }

  async getOrderById(
    userId: string,
    orderId: string,
  ): Promise<OrderResponseDto> {
    try {
      const order = await prisma.order.findFirst({
        where: { id: orderId, userId },
        include: {
          items: true,
          payments: {
            select: {
              id: true,
              status: true,
              paymentMethod: true,
              last4: true,
              cardBrand: true,
              amount: true,
              currency: true,
              paidAt: true,
              failureCode: true,
              failureMessage: true,
              createdAt: true,
            },
          },
        },
      });

      if (!order) {
        throw new NotFoundException('Order not found');
      }

      this.logger.log(`Order ${orderId} fetched for user ${userId}`);

      return this.mapOrderToResponse(order);
    } catch (error) {
      this.logger.error(
        `getOrderById failed for user ${userId}, order ${orderId}: ${error.message}`,
      );

      if (error instanceof NotFoundException) throw error;

      throw new InternalServerErrorException('Failed to retrieve order');
    }
  }

  async getOrderByPaymentIntent(
    userId: string,
    paymentIntentId: string,
  ): Promise<OrderResponseDto> {
    try {
      const order = await prisma.order.findFirst({
        where: { stripePaymentIntentId: paymentIntentId, userId },
        include: { items: true },
      });

      if (!order) {
        throw new NotFoundException('Order not found');
      }

      return this.mapOrderToResponse(order);
    } catch (error) {
      this.logger.error(
        `getOrderByPaymentIntent failed for user ${userId}: ${error.message}`,
      );

      if (error instanceof NotFoundException) throw error;

      throw new InternalServerErrorException('Failed to retrieve order');
    }
  }

  private mapOrderToResponse(order: any): OrderResponseDto {
    return {
      id: order.id,
      status: order.status,
      subtotal: order.subtotal,
      processingFee: order.processingFee,
      amountTotal: order.amountTotal,
      currency: order.currency,
      paidAt: order.paidAt,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      items: order.items.map((item: any) => ({
        id: item.id,
        placementId: item.placementId,
        productId: item.productId,
        name: item.name,
        websiteUrl: item.websiteUrl,
        logoUrl: item.logoUrl,
        country: item.country,
        type: item.type,
        domainAuthority: item.domainAuthority,
        domainRanking: item.domainRanking,
        isDoFollow: item.isDoFollow,
        unitAmount: item.unitAmount,
        pricingTier: item.pricingTier,
        currency: item.currency,
        quantity: item.quantity,
        lineTotal: parseFloat((item.unitAmount * item.quantity).toFixed(2)),
      })),
      //only include payments if they were fetched
      ...(order.payments && { payments: order.payments }),
    };
  }
}
