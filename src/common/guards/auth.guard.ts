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
import { JwtPayload } from 'jsonwebtoken';
import { ConfigService } from '@nestjs/config';
import prisma from 'src/shared/service/client';
import { changedPasswordAfter } from 'src/shared/utils/passwordUtil';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly logger = new Logger(JwtAuthGuard.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly reflector: Reflector,
    private readonly configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const token = this.extractJwtFromRequest(request);

    if (!token) {
      this.logger.warn('No token provided in request');
      throw new UnauthorizedException(
        'Access token not found. Please log in to continue.',
      );
    }

    let decodedToken: JwtPayload;

    try {
      decodedToken = await this.jwtService.verifyAsync(token, {
        secret: this.configService.getOrThrow('JWT_SECRET'),
      });
    } catch (error) {
      this.logger.warn(`Token verification failed: ${error.message}`);
      throw new UnauthorizedException(
        'Invalid or expired token. Please log in again.',
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: decodedToken.sub },
      select: {
        id: true,
        firstName: true,
        secondName: true,
        email: true,
        phoneNumber: true,
        status: true,
        verified: true,
        signUpMode: true,
        passwordChangedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      this.logger.warn(`Token valid but user ${decodedToken.sub} not found`);
      throw new UnauthorizedException('Access denied.');
    }

    if (user.status === UserStatus.DEACTIVATED) {
      this.logger.warn(`Access attempt by deactivated user: ${user.id}`);
      throw new UnauthorizedException(
        'Your account has been deactivated. Please contact support.',
      );
    }

    if (user.status === UserStatus.SUSPENDED) {
      this.logger.warn(`Access attempt by suspended user: ${user.id}`);
      throw new UnauthorizedException(
        'Your account has been suspended. Please contact support.',
      );
    }

    if (user.status === UserStatus.DELETED) {
      this.logger.warn(`Access attempt by deleted user: ${user.id}`);
      throw new UnauthorizedException('Access denied.');
    }

    if (
      user.passwordChangedAt &&
      changedPasswordAfter(user.passwordChangedAt, decodedToken.iat ?? 0)
    ) {
      this.logger.warn(
        `Password changed after token issued for user ${user.id}`,
      );
      throw new UnauthorizedException(
        'Password was recently changed. Please log in again.',
      );
    }

    request.user = user;

    return true;
  }

  private extractJwtFromRequest(request: Request): string | null {
    const authHeader = request.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.split(' ')[1];
    }

    return null;
  }
}
