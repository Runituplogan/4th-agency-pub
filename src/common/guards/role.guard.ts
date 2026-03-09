import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/role.decorators';
import { PrismaService } from 'src/modules/shared/service/prisma.service';

@Injectable()
export class RoleGuard implements CanActivate {
  private readonly logger = new Logger(RoleGuard.name);
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.get<string[]>(
      ROLES_KEY,
      context.getHandler(),
    );

    if (!requiredRoles) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();

    if (!user) {
      throw new ForbiddenException(
        'You do not have the necessary permissions to access this resource',
      );
    }

    // const userTypeRoles = Object.values(UserType);
    // const isUserTypeCheck = requiredRoles.some((role) =>
    //   userTypeRoles.includes(role as UserType),
    // );

    // if (isUserTypeCheck) {
    //   return requiredRoles.includes(user.userType);
    // }

    // if (!user.role) {
    //   throw new ForbiddenException(
    //     'You do not have the necessary permissions to access this resource',
    //   );
    // }

    // if (user?.isSuperAdmin) {
    //   return true;
    // }

    // const userPermissions = user.permissions || [];
    // console.log('User permissions:', userPermissions);
    // console.log('Required permissions:', requiredRoles);

    // const hasAllPermissions = requiredRoles.every((role) =>
    //   userPermissions.includes(role),
    // );

    // if (!hasAllPermissions) {
    //   throw new ForbiddenException(
    //     'You do not have the necessary permissions to access this resource',
    //   );
    // }

    return true;
  }
}
