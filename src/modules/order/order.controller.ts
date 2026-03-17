import { Controller, Get, Param, Req, Query } from '@nestjs/common';
import { OrderService } from './order.service';
import type { Request, Response } from 'express';
import { GetOrdersQueryDto } from './dto/get-orders-query.dto';
import { OrderResponseDto, PaginatedOrdersResponseDto } from './interface';
import { UnauthorizedException } from 'src/common/exceptions';

@Controller('order')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Get()
  async getUserOrders(
    @Req() req: Request,
    @Query() query: GetOrdersQueryDto,
  ): Promise<PaginatedOrdersResponseDto> {
    const userId = req.user?.id;
    if (!userId)
      throw new UnauthorizedException('User authentication required');

    return this.orderService.getUserOrders(userId, query);
  }

  @Get(':orderId')
  async getOrderById(
    @Req() req: Request,
    @Param('orderId') orderId: string,
  ): Promise<OrderResponseDto> {
    const userId = req.user?.id;
    if (!userId)
      throw new UnauthorizedException('User authentication required');

    return this.orderService.getOrderById(userId, orderId);
  }

  @Get('by-payment/:paymentIntentId')
  async getOrderByPaymentIntent(
    @Req() req: Request,
    @Param('paymentIntentId') paymentIntentId: string,
  ): Promise<OrderResponseDto> {
    const userId = req.user?.id;
    if (!userId)
      throw new UnauthorizedException('User authentication required');

    return this.orderService.getOrderByPaymentIntent(userId, paymentIntentId);
  }
}
