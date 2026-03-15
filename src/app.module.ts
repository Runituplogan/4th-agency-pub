import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { AuthModule } from './modules/auth/auth.module';
import { SharedModule } from './shared/shared.module';
import sendgridConfig from './common/config/sendgrid.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [sendgridConfig],
    }),
    SharedModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
