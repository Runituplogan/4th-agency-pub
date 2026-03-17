import { Module } from '@nestjs/common';
import { WebhookService } from './webhook.service';
import { WebhookController } from './webhook.controller';
import { NotificationService } from '../notification/notification.service';
import { AuthModule } from '../auth/auth.module';
import { TemplateService } from 'src/templates/template.service';

@Module({
  imports: [AuthModule],
  controllers: [WebhookController],
  providers: [WebhookService, NotificationService, TemplateService],
})
export class WebhookModule {}
