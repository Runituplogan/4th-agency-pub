import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

@Injectable()
export class TemplateService {
  private readonly templatesPath: string;
  private readonly logger = new Logger(TemplateService.name);

  constructor(private configService: ConfigService) {
    const possiblePaths = [
      join(process.cwd(), 'src', 'templates', 'email'),
      join(process.cwd(), 'dist', 'src', 'templates', 'email'),
      join(__dirname, '..', 'templates', 'email'),
      join(__dirname, '..', '..', 'templates', 'email'),
    ];
    const foundPath = possiblePaths.find((path) => {
      const testFile = join(path, 'email-verification.html');
      return existsSync(testFile);
    });

    if (!foundPath) {
      throw new Error(
        `Email templates directory not found. Searched paths: ${possiblePaths.join(', ')}`,
      );
    }

    this.templatesPath = foundPath;
  }

  async getEmailTemplate(
    templateName: string,
    data: Record<string, string>,
  ): Promise<string> {
    try {
      const templatePath = join(this.templatesPath, `${templateName}.html`);

      if (!existsSync(templatePath)) {
        throw new Error(`Template file not found: ${templatePath}`);
      }

      let template = readFileSync(templatePath, 'utf-8');

      //replace all placeholders with actual data
      Object.keys(data).forEach((key) => {
        const placeholder = `{{${key}}}`;
        template = template.replace(new RegExp(placeholder, 'g'), data[key]);
      });

      return template;
    } catch (error) {
      this.logger.error(`Error loading template ${templateName}:`, error);
      throw new Error(`Failed to load email template: ${templateName}`);
    }
  }

  async getEmailVerificationTemplate(data: {
    firstName: string;
    verificationCode: string;
    year: string;
    appName?: string;
    supportEmail?: string;
  }): Promise<string> {
    const templateData = {
      FIRST_NAME: data.firstName,
      VERIFICATION_CODE: data.verificationCode,
      YEAR: data.year,
      APP_NAME: '4E AGENCY',
      SUPPORT_EMAIL:
        data.supportEmail ||
        this.configService.get('SUPPORT_EMAIL') ||
        'support@example.com',
    };

    return this.getEmailTemplate('email-verification', templateData);
  }

  async getPasswordResetTemplate(data: {
    firstName: string;
    resetCode: string;
    year: number;
    appName?: string;
    supportEmail?: string;
  }): Promise<string> {
    const templateData = {
      FIRST_NAME: data.firstName,
      RESET_CODE: data.resetCode,
      YEAR: data.year.toString(),
      APP_NAME: '4E AGENCY',
      SUPPORT_EMAIL:
        data.supportEmail ||
        this.configService.get('SUPPORT_EMAIL') ||
        'support@example.com',
    };

    return this.getEmailTemplate('password-reset', templateData);
  }

  async getUpdatePasswordTemplate(data: {
    firstName: string;
    year: number;
    loginUrl?: string;
    appName?: string;
    supportEmail?: string;
  }): Promise<string> {
    const templateData = {
      FIRST_NAME: data.firstName,
      LOGIN_URL: process.env.LOGIN_URL || '',
      YEAR: data.year.toString(),
      APP_NAME: '4E AGENCY',
      SUPPORT_EMAIL:
        data.supportEmail ||
        this.configService.get('SUPPORT_EMAIL') ||
        'support@example.com',
    };
    return this.getEmailTemplate('update-password', templateData);
  }
}
