import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  HttpCode,
  HttpStatus,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { UnauthorizedException } from 'src/common/exceptions';
import { CartService } from './cart.service';
import type { Request, Response } from 'express';
import { AddToCartDto } from './dto/create-cart.dto';
import { UpdateCartItemDto } from './dto/update-cart.dto';
import { JwtAuthGuard } from 'src/common/guards/auth.guard';

@Controller('cart')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Post('add')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async addToCart(
    @Req() req: Request,
    @Body() addToCartDto: AddToCartDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const userId = req.user?.id;
    if (!userId)
      throw new UnauthorizedException('User authentication required');

    const cart = await this.cartService.addToCart(userId, addToCartDto);
    res.locals.message = 'Item added to cart successfully';
    return cart;
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  async getCart(@Req() req: Request) {
    const userId = req.user?.id;
    if (!userId)
      throw new UnauthorizedException('User authentication required');

    return this.cartService.getCart(userId);
  }

  @Patch('items/:itemId')
  @UseGuards(JwtAuthGuard)
  async updateCartItemQuantity(
    @Req() req: Request,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateCartItemDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const userId = req.user?.id;
    if (!userId)
      throw new UnauthorizedException('User authentication required');

    const cart = await this.cartService.updateCartItemQuantity(
      userId,
      itemId,
      dto.quantity,
    );
    res.locals.message = 'Cart item updated successfully';
    return cart;
  }

  @Delete('items/:itemId')
  @UseGuards(JwtAuthGuard)
  async removeFromCart(
    @Req() req: Request,
    @Param('itemId') itemId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const userId = req.user?.id;
    if (!userId)
      throw new UnauthorizedException('User authentication required');

    const cart = await this.cartService.removeFromCart(userId, itemId);
    res.locals.message = 'Item removed from cart successfully';
    return cart;
  }

  @Delete('clear')
  @UseGuards(JwtAuthGuard)
  async clearCart(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ message: string }> {
    const userId = req.user?.id;
    if (!userId)
      throw new UnauthorizedException('User authentication required');

    const result = await this.cartService.clearCart(userId);
    res.locals.message = 'Cart cleared successfully';
    return result;
  }
}
