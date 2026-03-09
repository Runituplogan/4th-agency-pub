import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { UserStatus } from '@prisma/client';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import prisma from 'src/modules/shared/service/client';
import { changedPasswordAfter } from 'src/modules/shared/utils/passwordUtil';
@Injectable()
export class JwtAuthGuard implements CanActivate {
  private logger = new Logger(JwtAuthGuard.name);

  constructor(
    private jwtService: JwtService,
    private reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const token = this.extractJwtFromRequest(request);

    if (!token) {
      this.logger.warn('No token provided in request');
      throw new UnauthorizedException(
        'Oops! We couldn’t find your access token. Please log in to continue.',
      );
    }
    let decodedToken;
    try {
      decodedToken = await this.jwtService.verifyAsync(token, {
        secret: process.env.JWT_SECRET,
      });
    } catch (error) {
      this.logger.warn('Token verification failed', error.message);
      throw new UnauthorizedException(
        'Hmm... that token doesn’t look right. Please log in again to continue.',
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: decodedToken.sub },
    });
    if (!user) {
      this.logger.warn(`User with id ${decodedToken.sub} not found`);
      throw new UnauthorizedException('Access denied: User not found');
    }

    if (user.status === UserStatus.DEACTIVATED) {
      this.logger.warn(`Access attempt by deactivated user: ${user.id}`);
      throw new UnauthorizedException(
        'Access denied: Your account has been deactivated. Please contact support if you believe this is an error.',
      );
    }

    if (
      user.deActivatedAt &&
      user.deActivatedAt.getTime() > decodedToken.iat * 1000
    ) {
      throw new UnauthorizedException(
        'Access denied: Account was deactivated after this session began.',
      );
    }

    if (
      user.passwordChangedAt &&
      changedPasswordAfter(user.passwordChangedAt, decodedToken.iat ?? 0)
    ) {
      throw new UnauthorizedException(
        'Access denied: Password changed recently, please log in again.',
      );
    }
    //attach user to request object for middlewares/controllers to use it
    request.user = user;

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
