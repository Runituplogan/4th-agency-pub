import { Global, Module } from '@nestjs/common';
import { PrismaService } from './service/prisma.service';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

@Global()
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
  providers: [PrismaService],
  exports: [PrismaService],
})
export class SharedModule {}
