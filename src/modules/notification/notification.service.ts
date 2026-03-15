import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import sgMail from '@sendgrid/mail';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  private readonly fromEmail: string;

  constructor(private readonly configService: ConfigService) {
    const sendgridApiKey = this.configService.get<string>('sendgrid.apiKey');
    this.fromEmail = this.configService.get<string>('sendgrid.fromEmail') || '';

    if (!sendgridApiKey) {
      throw new Error('Twilio or SendGrid configuration is missing');
    }

    sgMail.setApiKey(sendgridApiKey);
  }

  public async sendEmail({
    to,
    subject,
    html,
  }: {
    to: string;
    subject: string;
    html: string;
  }): Promise<void> {
    try {
      await sgMail.send({
        to,
        from: { email: this.fromEmail },
        subject,
        html,
      });
      this.logger.log(`Email sent to ${to} — subject: "${subject}"`);
    } catch (error) {
      this.logger.error(
        `Failed to send email to ${to}: ${error?.response?.body?.errors ?? error.message}`,
      );
      throw error;
    }
  }
}
