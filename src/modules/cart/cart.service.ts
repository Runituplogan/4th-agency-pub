import { Injectable, Logger } from '@nestjs/common';
import {
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
} from 'src/common/exceptions';
import prisma from 'src/shared/service/client';
import { AddToCartDto } from './dto/create-cart.dto';
import { CartStatus } from '@prisma/client';
import { CartItemResponseDto, CartResponseDto } from './interface';

@Injectable()
export class CartService {
  private readonly logger = new Logger(CartService.name);

  constructor() {}

  async addToCart(
    userId: string,
    addToCartDto: AddToCartDto,
  ): Promise<CartResponseDto> {
    try {
      const cart = await prisma.cart.upsert({
        where: { userId },
        create: { userId, status: CartStatus.ACTIVE },
        update: {},
      });

      if (cart.status === CartStatus.CHECKED_OUT) {
        throw new BadRequestException('Cart has already been checked out');
      }

      const existingItem = await prisma.cartItem.findFirst({
        where: { cartId: cart.id, placementId: addToCartDto.placementId },
      });

      if (existingItem) {
        await prisma.cartItem.update({
          where: { id: existingItem.id },
          data: {
            quantity: existingItem.quantity + (addToCartDto.quantity ?? 1),
          },
        });
      } else {
        await prisma.cartItem.create({
          data: {
            cartId: cart.id,
            placementId: addToCartDto.placementId,
            productId: addToCartDto.productId,
            name: addToCartDto.name,
            websiteUrl: addToCartDto.websiteUrl,
            logoUrl: addToCartDto.logoUrl,
            country: addToCartDto.country,
            type: addToCartDto.type,
            domainAuthority: addToCartDto.domainAuthority,
            domainRanking: addToCartDto.domainRanking,
            isDoFollow: addToCartDto.isDoFollow ?? false,
            unitAmount: addToCartDto.unitAmount,
            pricingTier: addToCartDto.pricingTier,
            currency: addToCartDto.currency ?? 'USD',
            quantity: addToCartDto.quantity ?? 1,
          },
        });
      }

      this.logger.log(
        `Placement ${addToCartDto.placementId} added to cart for user ${userId}`,
      );

      return this.getCartWithTotals(userId);
    } catch (error) {
      this.logger.error(
        `addToCart failed for user ${userId}: ${error.message}`,
      );

      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      throw new InternalServerErrorException('Failed to add item to cart');
    }
  }

  async getCart(userId: string): Promise<CartResponseDto> {
    try {
      const cart = await prisma.cart.findUnique({
        where: { userId },
      });

      if (!cart) {
        throw new NotFoundException('Cart not found');
      }

      return this.getCartWithTotals(userId);
    } catch (error) {
      this.logger.error(`getCart failed for user ${userId}: ${error.message}`);

      if (error instanceof NotFoundException) throw error;

      throw new InternalServerErrorException('Failed to retrieve cart');
    }
  }

  async updateCartItemQuantity(
    userId: string,
    itemId: string,
    quantity: number,
  ): Promise<CartResponseDto> {
    try {
      const cart = await prisma.cart.findUnique({
        where: { userId },
      });

      if (!cart) {
        throw new NotFoundException('Cart not found');
      }

      const item = await prisma.cartItem.findFirst({
        where: { id: itemId, cartId: cart.id },
      });

      if (!item) {
        throw new NotFoundException('Cart item not found');
      }

      if (quantity <= 0) {
        await prisma.cartItem.delete({ where: { id: itemId } });
      } else {
        await prisma.cartItem.update({
          where: { id: itemId },
          data: { quantity },
        });
      }

      this.logger.log(`Cart item ${itemId} quantity updated to ${quantity}`);

      return this.getCartWithTotals(userId);
    } catch (error) {
      this.logger.error(`updateCartItemQuantity failed: ${error.message}`);

      if (error instanceof NotFoundException) throw error;

      throw new InternalServerErrorException('Failed to update cart item');
    }
  }

  async removeFromCart(
    userId: string,
    itemId: string,
  ): Promise<CartResponseDto> {
    try {
      const cart = await prisma.cart.findUnique({
        where: { userId },
      });

      if (!cart) {
        throw new NotFoundException('Cart not found');
      }

      const item = await prisma.cartItem.findFirst({
        where: { id: itemId, cartId: cart.id },
      });

      if (!item) {
        throw new NotFoundException('Cart item not found');
      }

      await prisma.cartItem.delete({ where: { id: itemId } });

      this.logger.log(`Item ${itemId} removed from cart for user ${userId}`);

      return this.getCartWithTotals(userId);
    } catch (error) {
      this.logger.error(`removeFromCart failed: ${error.message}`);

      if (error instanceof NotFoundException) throw error;

      throw new InternalServerErrorException('Failed to remove item from cart');
    }
  }

  async clearCart(userId: string): Promise<{ message: string }> {
    try {
      const cart = await prisma.cart.findUnique({
        where: { userId },
      });

      if (!cart) {
        throw new NotFoundException('Cart not found');
      }

      await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });

      this.logger.log(`Cart cleared for user ${userId}`);

      return { message: 'Cart cleared successfully' };
    } catch (error) {
      this.logger.error(`clearCart failed: ${error.message}`);

      if (error instanceof NotFoundException) throw error;

      throw new InternalServerErrorException('Failed to clear cart');
    }
  }

  private async getCartWithTotals(userId: string): Promise<CartResponseDto> {
    const cart = await prisma.cart.findUnique({
      where: { userId },
      include: { items: true },
    });

    if (!cart) {
      throw new NotFoundException('Cart not found');
    }

    const mappedItems: CartItemResponseDto[] = cart.items.map((item) => ({
      ...item,
      lineTotal: parseFloat((item.unitAmount * item.quantity).toFixed(2)),
    }));

    const subtotal = mappedItems.reduce((sum, item) => sum + item.lineTotal, 0);
    const processingFee = parseFloat((subtotal * 0.03).toFixed(2));
    const total = parseFloat((subtotal + processingFee).toFixed(2));

    return {
      id: cart.id,
      userId: cart.userId,
      status: cart.status,
      items: mappedItems,
      subtotal: parseFloat(subtotal.toFixed(2)),
      processingFee,
      total,
      currency: cart.items[0]?.currency ?? 'USD',
      itemCount: cart.items.reduce((sum, item) => sum + item.quantity, 0),
      createdAt: cart.createdAt,
      updatedAt: cart.updatedAt,
    };
  }
}
