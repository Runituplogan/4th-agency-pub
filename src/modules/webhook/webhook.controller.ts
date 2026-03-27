import {
  Controller,
  Post,
  HttpCode,
  HttpStatus,
  Req,
  Headers,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import { WebhookService } from './webhook.service';
import { BadRequestException } from 'src/common/exceptions';
import type { Request, Response } from 'express';
import { Public } from 'src/common/decorators/public.decorator';
import { SkipThrottle } from '@nestjs/throttler';

@SkipThrottle()
@Public()
@Controller('webhook')
export class WebhookController {
  constructor(private readonly webhookService: WebhookService) {}

  @Post('stripe')
  @HttpCode(HttpStatus.OK)
  async handleStripeWebhook(
    @Req() req: Request,
    @Headers('stripe-signature') signature: string,
  ) {
    if (!signature) {
      throw new BadRequestException('Missing stripe-signature header');
    }
    const payload = req.body;

    if (!payload || !Buffer.isBuffer(payload)) {
      throw new BadRequestException('Missing raw body in request');
    }
    const event = this.webhookService.constructEvent(payload, signature);

    await this.webhookService.handleWebhookEvent(event);

    return { received: true };
  }
}
