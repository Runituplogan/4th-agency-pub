import {
  Controller,
  Post,
  HttpStatus,
  HttpCode,
  Req,
  Res,
  UseGuards,
  Get,
  Param,
} from '@nestjs/common';
import { CheckoutService } from './checkout.service';
import { UnauthorizedException } from 'src/common/exceptions';
import type { Request, Response } from 'express';
import { JwtAuthGuard } from 'src/common/guards/auth.guard';

@Controller('checkout')
export class CheckoutController {
  constructor(private readonly checkoutService: CheckoutService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async createCheckoutSession(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const userId = req.user?.id;
    if (!userId)
      throw new UnauthorizedException('User authentication required');

    const { url } = await this.checkoutService.createCheckoutSession(userId);
    res.locals.message = 'Checkout session created successfully';
    return { data: { url } };
  }

  @Get(':sessionId')
  @UseGuards(JwtAuthGuard)
  async getCheckoutSession(
    @Req() req: Request,
    @Param('sessionId') sessionId: string,
  ) {
    const userId = req.user?.id;
    if (!userId)
      throw new UnauthorizedException('User authentication required');

    return this.checkoutService.getCheckoutSession(sessionId, userId);
  }
}
