import { Controller, Get, Param, Req, Query, UseGuards } from '@nestjs/common';
import { OrderService } from './order.service';
import type { Request, Response } from 'express';
import { GetOrdersQueryDto } from './dto/get-orders-query.dto';
import { OrderResponseDto, PaginatedOrdersResponseDto } from './interface';
import { UnauthorizedException } from 'src/common/exceptions';
import { JwtAuthGuard } from 'src/common/guards/auth.guard';

@Controller('order')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
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
  @UseGuards(JwtAuthGuard)
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
  @UseGuards(JwtAuthGuard)
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
