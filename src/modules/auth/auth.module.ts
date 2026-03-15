import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'src/shared/service/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { TemplateService } from 'src/templates/template.service';

@Module({
  imports: [
    JwtModule.registerAsync({
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: { expiresIn: '15m', algorithm: 'HS512' },
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [AuthService, PrismaService, NotificationService, TemplateService],
  controllers: [AuthController],
  exports: [JwtModule],
})
export class AuthModule {}
