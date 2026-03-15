import { Injectable, ExecutionContext, CanActivate } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserStatus } from '@prisma/client';
import { Request } from 'express';
import prisma from 'src/shared/service/client';


@Injectable()
export class OptionalJwtAuthGuard implements CanActivate {
  constructor(private jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = this.extractJwtFromRequest(request);

    //no token? allow, just dont attach a user
    if (!token) {
      request.user = null;
      return true;
    }

    try {
      const decodedToken = await this.jwtService.verifyAsync(token, {
        secret: process.env.JWT_SECRET,
      });

      const user = await prisma.user.findUnique({
        where: { id: decodedToken.sub },
      });

      if (user && user.status !== UserStatus.DEACTIVATED) {
        request.user = {
          ...user,
        };
      } else {
        request.user = null;
      }
    } catch {
      //invalid/expired token, allow through as guest
      request.user = null;
    }

    return true;
  }

  private extractJwtFromRequest(request: Request): string | null {
    if (
      request.headers.authorization &&
      request.headers.authorization.startsWith('Bearer ')
    ) {
      return request.headers.authorization.split(' ')[1];
    }
    return null;
  }
}
