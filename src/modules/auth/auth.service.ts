import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  BadRequestException,
  DuplicateException,
  NotFoundException,
  InternalServerErrorException,
  UnauthorizedException,
  ForbiddenException,
  TooManyRequestsException,
} from 'src/common/exceptions/index';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { SignupMode, User, UserStatus } from '@prisma/client';
import { RegisterUserDto } from './dto/register-user.dto';
import * as argon2 from 'argon2';
import { randomBytes, randomInt } from 'crypto';
import { LoginUserDto } from './dto/login-user.dto';
import {
  LoginResponseDto,
  RegisterResponseDto,
} from './interfaces/user-login.interface';
import { JwtPayload } from 'jsonwebtoken';
import { UpdatePasswordDto } from './dto/update-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import {
  ResetPasswordDto,
  ResetPasswordPayload,
} from './dto/reset-password.dto';
import { VerifyResetCodeDto } from './dto/verifiy-reset-code.dto';
import { VerifyAccountDto } from './dto/verifiy-account.dto';
import prisma from 'src/shared/service/client';
import { TemplateService } from 'src/templates/template.service';
import { NotificationService } from '../notification/notification.service';

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
    private readonly notificationService: NotificationService,
    private readonly templateService: TemplateService,
  ) {}

  async onModuleInit() {}

  async generateJwtToken(user: User) {
    const payload = {
      sub: user.id,
      email: user.email,
      firstName: user.firstName,
      secondName: user.secondName,
    };

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: process.env.JWT_SECRET,
      expiresIn: '15m',
    });

    return { accessToken };
  }

  async registerUser(registerUserDto: RegisterUserDto) {
    try {
      const normalizedEmail = registerUserDto.email.toLowerCase().trim();

      const existingUser = await prisma.user.findFirst({
        where: {
          email: normalizedEmail,
        },
        select: { email: true, phoneNumber: true },
      });

      if (existingUser?.email === normalizedEmail) {
        throw new DuplicateException('A user with that email already exists');
      }

      const verificationToken = randomBytes(32).toString('hex');
      const hashedPassword = await argon2.hash(registerUserDto.password, {
        type: argon2.argon2id,
      });
      const hashedToken = await argon2.hash(verificationToken);
      const codeExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

      const newUser = await prisma.$transaction(async (tx) => {
        return tx.user.create({
          data: {
            firstName: registerUserDto.firstName.trim(),
            secondName: registerUserDto.secondName.trim(),
            email: normalizedEmail,
            password: hashedPassword,
            signUpMode: SignupMode.REGULAR,
            status: UserStatus.ACTIVE,
            verified: false,
            emailVerificationToken: hashedToken,
            emailTokenExpires: codeExpiry,
          },
          select: {
            id: true,
            firstName: true,
            secondName: true,
            email: true,
            phoneNumber: true,
            status: true,
            verified: true,
            signUpMode: true,
            createdAt: true,
          },
        });
      });

      const verificationLink = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}&userId=${newUser.id}`;

      let emailTemplate: string;
      try {
        emailTemplate = await this.templateService.getEmailVerificationTemplate(
          {
            firstName: registerUserDto.firstName,
            verificationLink,
            year: new Date().getFullYear().toString(),
            expiration_time: codeExpiry,
          },
        );
      } catch (error) {
        this.logger.error(
          `Failed to load verification email template: ${error.message}`,
        );
        throw new InternalServerErrorException(
          'Unable to process registration. Please try again later.',
        );
      }

      try {
        await this.notificationService.sendEmail({
          to: newUser.email,
          subject: 'Verify your Account',
          html: emailTemplate,
        });
      } catch (emailError) {
        this.logger.error(
          `Verification email failed for user ${newUser.id}: ${emailError.message}`,
        );
      }

      this.logger.log(
        `New user registered: ${newUser.email} (id: ${newUser.id})`,
      );
      return newUser;
    } catch (error) {
      this.logger.error(`Registration failed: ${error.message}`);
      if (
        error instanceof DuplicateException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to register user');
    }
  }

  async loginUser(loginUserDto: LoginUserDto): Promise<LoginResponseDto> {
    try {
      const user = await prisma.user.findFirst({
        where: { email: loginUserDto.email.toLowerCase().trim() },
      });

      const invalidCredentialsError = new UnauthorizedException(
        'Incorrect email or password',
      );

      if (!user) {
        throw invalidCredentialsError;
      }

      if (!user.verified) {
        throw new ForbiddenException(
          'Your account has not been verified. Please check your email for a verification code.',
        );
      }

      if (user.status === UserStatus.DEACTIVATED) {
        throw new ForbiddenException(
          'Your account has been deactivated. Please contact support.',
        );
      }

      if (user.status === UserStatus.SUSPENDED) {
        throw new ForbiddenException(
          'Your account has been suspended. Please contact support.',
        );
      }

      if (user.status === UserStatus.DELETED) {
        throw new ForbiddenException('This account no longer exists.');
      }

      if (user.signUpMode !== SignupMode.REGULAR) {
        throw new BadRequestException(
          'This account uses Google sign-in. Please use the Google login option.',
        );
      }

      if (!user.password) {
        throw new InternalServerErrorException('Failed to login');
      }

      const isPasswordValid = await argon2.verify(
        user.password,
        loginUserDto.password,
      );

      if (!isPasswordValid) {
        throw invalidCredentialsError;
      }

      const payload: JwtPayload = {
        sub: user.id,
        email: user.email,
        firstName: user.firstName,
        secondName: user.secondName,
        signUpMode: user.signUpMode,
      };

      const [accessToken, refreshToken] = await Promise.all([
        this.jwtService.signAsync(payload, {
          secret: this.configService.getOrThrow('JWT_SECRET'),
          expiresIn: '15m',
        }),

        this.jwtService.signAsync(payload, {
          secret: this.configService.getOrThrow('JWT_REFRESH_SECRET'),
          expiresIn: '7d',
        }),
      ]);

      const hashedRefreshToken = await argon2.hash(refreshToken);

      await prisma.user.update({
        where: { id: user.id },
        data: { refreshToken: hashedRefreshToken },
      });

      return {
        user: {
          id: user.id,
          firstName: user.firstName,
          secondName: user.secondName,
          email: user.email,
          phoneNumber: user.phoneNumber,
          googleId: user.googleId,
          status: user.status,
          verified: user.verified,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
          signUpMode: user.signUpMode,
        },
        accessToken,
        refreshToken,
      };
    } catch (error) {
      this.logger.error(
        `Login failed for email "${loginUserDto.email}": ${error.message}`,
      );

      if (
        error instanceof UnauthorizedException ||
        error instanceof ForbiddenException ||
        error instanceof BadRequestException ||
        error instanceof InternalServerErrorException
      ) {
        throw error;
      }

      throw new InternalServerErrorException('Failed to login');
    }
  }

  async verifyEmail(token: string, userId: string): Promise<LoginResponseDto> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          firstName: true,
          secondName: true,
          email: true,
          phoneNumber: true,
          googleId: true,
          status: true,
          verified: true,
          signUpMode: true,
          emailVerificationToken: true,
          emailTokenExpires: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (!user) {
        throw new BadRequestException('Verification link is invalid');
      }

      if (user.verified) {
        throw new BadRequestException('Account is already verified');
      }

      if (!user.emailTokenExpires || user.emailTokenExpires < new Date()) {
        throw new BadRequestException('Verification link has expired');
      }

      if (!user.emailVerificationToken) {
        throw new BadRequestException('Verification link is invalid');
      }

      const isTokenValid = await argon2.verify(
        user.emailVerificationToken,
        token,
      );
      if (!isTokenValid) {
        throw new BadRequestException('Verification link is invalid');
      }

      const payload: JwtPayload = {
        sub: user.id,
        email: user.email,
        firstName: user.firstName,
        secondName: user.secondName,
        signUpMode: user.signUpMode,
      };

      const [accessToken, refreshToken] = await Promise.all([
        this.jwtService.signAsync(payload, {
          secret: this.configService.getOrThrow('JWT_SECRET'),
          expiresIn: '15m',
        }),
        this.jwtService.signAsync(payload, {
          secret: this.configService.getOrThrow('JWT_REFRESH_SECRET'),
          expiresIn: '7d',
        }),
      ]);

      const hashedRefreshToken = await argon2.hash(refreshToken);

      await prisma.user.update({
        where: { id: user.id },
        data: {
          verified: true,
          emailVerificationToken: null,
          emailTokenExpires: null,
          refreshToken: hashedRefreshToken,
        },
      });

      this.logger.log(
        `User ${user.email} (id: ${user.id}) successfully verified`,
      );

      return {
        user: {
          id: user.id,
          firstName: user.firstName,
          secondName: user.secondName,
          email: user.email,
          phoneNumber: user.phoneNumber,
          googleId: user.googleId,
          status: user.status,
          verified: true,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
          signUpMode: user.signUpMode,
        },
        accessToken,
        refreshToken,
      };
    } catch (error) {
      this.logger.error(
        `Account verification failed for user "${userId}": ${error.message}`,
      );

      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new InternalServerErrorException('Failed to verify user account');
    }
  }

  async refreshToken(oldRefreshToken: string): Promise<LoginResponseDto> {
    let payload: JwtPayload;

    try {
      payload = await this.jwtService.verifyAsync(oldRefreshToken, {
        secret: this.configService.getOrThrow('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    try {
      const user = await prisma.user.findUnique({
        where: { id: payload.sub },
        select: {
          id: true,
          firstName: true,
          secondName: true,
          email: true,
          phoneNumber: true,
          googleId: true,
          status: true,
          verified: true,
          signUpMode: true,
          refreshToken: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (!user || !user.refreshToken) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      if (user.status !== UserStatus.ACTIVE) {
        throw new UnauthorizedException('Account is no longer active');
      }

      const isRefreshTokenValid = await argon2.verify(
        user.refreshToken,
        oldRefreshToken,
      );

      if (!isRefreshTokenValid) {
        await prisma.user.update({
          where: { id: user.id },
          data: { refreshToken: null },
        });
        this.logger.warn(`Refresh token reuse detected for user ${user.id}`);
        throw new UnauthorizedException('Invalid refresh token');
      }

      await prisma.user.update({
        where: { id: user.id },
        data: { refreshToken: null },
      });

      const newPayload: JwtPayload = {
        sub: user.id,
        email: user.email,
        firstName: user.firstName,
        secondName: user.secondName,
        signUpMode: user.signUpMode,
      };

      const [accessToken, refreshToken] = await Promise.all([
        this.jwtService.signAsync(newPayload, {
          secret: this.configService.getOrThrow('JWT_SECRET'),
          expiresIn: '15m',
        }),
        this.jwtService.signAsync(newPayload, {
          secret: this.configService.getOrThrow('JWT_REFRESH_SECRET'),
          expiresIn: '7d',
        }),
      ]);

      const hashedRefreshToken = await argon2.hash(refreshToken);

      await prisma.user.update({
        where: { id: user.id },
        data: { refreshToken: hashedRefreshToken },
      });

      this.logger.log(`Refresh token rotated for user ${user.id}`);

      return {
        user: {
          id: user.id,
          firstName: user.firstName,
          secondName: user.secondName,
          email: user.email,
          phoneNumber: user.phoneNumber,
          googleId: user.googleId,
          status: user.status,
          verified: user.verified,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
          signUpMode: user.signUpMode,
        },
        accessToken,
        refreshToken,
      };
    } catch (error) {
      this.logger.error(
        `Refresh token failed for user ${payload.sub}: ${error.message}`,
      );

      if (error instanceof UnauthorizedException) {
        throw error;
      }

      throw new InternalServerErrorException('Failed to refresh token');
    }
  }

  async resendVerificationEmail(email: string): Promise<{ message: string }> {
    const genericResponse = {
      message:
        'If an account with that email exists, we have sent a verification email.',
    };

    try {
      const identifier = email.trim().toLowerCase();

      const user = await prisma.user.findFirst({
        where: {
          email: identifier,
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          verified: true,
          status: true,
        },
      });

      if (!user) return genericResponse;

      if (user.verified) {
        throw new BadRequestException(
          'Your account has been verified, please Log in',
        );
      }

      const verificationToken = randomBytes(32).toString('hex');
      const hashedToken = await argon2.hash(verificationToken);
      const codeExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

      await prisma.user.update({
        where: { id: user.id },
        data: {
          emailVerificationToken: hashedToken,
          emailTokenExpires: codeExpiry,
        },
      });

      const verificationLink = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}&userId=${user.id}`;

      let emailTemplate: string;
      try {
        emailTemplate =
          await this.templateService.resendEmailVerificationTemplate({
            firstName: user.firstName,
            verificationLink,
            year: new Date().getFullYear().toString(),
            expiration_time: codeExpiry,
          });
      } catch (error) {
        this.logger.error(
          `Failed to load verification email template: ${error.message}`,
        );
        throw new InternalServerErrorException(
          'Unable to process registration. Please try again later.',
        );
      }

      try {
        await this.notificationService.sendEmail({
          to: user.email,
          subject: 'Verify your Account',
          html: emailTemplate,
        });
      } catch (emailError) {
        this.logger.error(
          `Verification email failed for user ${user.id}: ${emailError.message}`,
        );
      }

      return genericResponse;
    } catch (error) {
      this.logger.error(`Resend verification email failed: ${error.message}`);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Failed to resend verification email',
      );
    }
  }

  async forgotPassword(
    forgotPasswordDto: ForgotPasswordDto,
  ): Promise<{ message: string }> {
    const genericResponse = {
      message:
        'If an account with that email exists, we have sent a password reset link.',
    };

    try {
      const email = forgotPasswordDto.email.toLowerCase().trim();

      const user = await prisma.user.findFirst({
        where: { email },
        select: {
          id: true,
          email: true,
          firstName: true,
          verified: true,
          status: true,
          signUpMode: true,
          passwordResetAttempts: true,
          passwordResetLastSent: true,
          passwordResetAttemptResetAt: true,
        },
      });

      if (!user) return genericResponse;

      if (
        !user.verified ||
        user.status !== UserStatus.ACTIVE ||
        user.signUpMode !== SignupMode.REGULAR
      ) {
        return genericResponse;
      }

      const MAX_ATTEMPTS = 3;
      const RESET_WINDOW_MS = 60 * 60 * 1000; // 1 hour
      const now = new Date();

      const windowExpired =
        !user.passwordResetAttemptResetAt ||
        user.passwordResetAttemptResetAt < now;

      const currentAttempts = windowExpired ? 0 : user.passwordResetAttempts;

      if (currentAttempts >= MAX_ATTEMPTS) {
        this.logger.warn(`Password reset rate limit hit for: ${email}`);
        return genericResponse;
      }

      const resetToken = await this.jwtService.signAsync(
        { sub: user.id, purpose: 'password_reset' },
        {
          secret: this.configService.getOrThrow('JWT_SECRET'),
          expiresIn: '10m',
        },
      );

      const resetLink = `${this.configService.getOrThrow('FRONTEND_URL')}/reset-password?token=${resetToken}`;

      await prisma.user.update({
        where: { id: user.id },
        data: {
          passwordResetLastSent: now,
          passwordResetAttempts: currentAttempts + 1,
          passwordResetAttemptResetAt: windowExpired
            ? new Date(now.getTime() + RESET_WINDOW_MS)
            : user.passwordResetAttemptResetAt,
        },
      });

      let emailTemplate: string;
      try {
        emailTemplate = await this.templateService.resetPasswordTemplate({
          firstName: user.firstName,
          resetLink,
          year: new Date().getFullYear().toString(),
          expiration_time: new Date(Date.now() + 10 * 60 * 1000),
        });
      } catch (error) {
        this.logger.error(
          `Failed to load reset email template: ${error.message}`,
        );
        throw new InternalServerErrorException(
          'Unable to process password reset. Please try again later.',
        );
      }

      try {
        await this.notificationService.sendEmail({
          to: user.email,
          subject: 'Reset Your Password',
          html: emailTemplate,
        });
      } catch (emailError) {
        this.logger.error(
          `password  reset email failed for user ${user.id}: ${emailError.message}`,
        );
      }

      this.logger.log(
        `Password reset link sent to: ${user.email} (id: ${user.id})`,
      );

      return genericResponse;
    } catch (error) {
      this.logger.error(`Forgot password failed: ${error.message}`);
      throw new InternalServerErrorException(
        'Failed to process password reset request',
      );
    }
  }

  async resetPassword(dto: ResetPasswordPayload): Promise<{ message: string }> {
    try {
      let payload: { sub: string; purpose: string };

      try {
        payload = await this.jwtService.verifyAsync(dto.resetToken, {
          secret: this.configService.getOrThrow('JWT_SECRET'),
        });
      } catch {
        throw new UnauthorizedException('Invalid or expired reset token');
      }

      if (payload.purpose !== 'password_reset') {
        throw new UnauthorizedException('Invalid reset token');
      }

      const user = await prisma.user.findUnique({
        where: { id: payload.sub },
        select: {
          id: true,
          status: true,
          verified: true,
          signUpMode: true,
        },
      });

      if (!user) {
        throw new UnauthorizedException('Invalid or expired reset token');
      }

      if (
        !user.verified ||
        user.status !== UserStatus.ACTIVE ||
        user.signUpMode !== SignupMode.REGULAR
      ) {
        throw new UnauthorizedException('Invalid or expired reset token');
      }

      const hashedPassword = await argon2.hash(dto.newPassword, {
        type: argon2.argon2id,
      });

      await prisma.user.update({
        where: { id: user.id },
        data: {
          password: hashedPassword,
          passwordChangedAt: new Date(),
          refreshToken: null,
          passwordResetLastSent: null,
          passwordResetAttempts: 0,
          passwordResetAttemptResetAt: null,
        },
      });

      this.logger.log(`Password reset successful for user ${user.id}`);

      return { message: 'Password reset successful. You can now log in.' };
    } catch (error) {
      this.logger.error(`resetPassword failed: ${error.message}`);

      if (
        error instanceof UnauthorizedException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      throw new InternalServerErrorException('Failed to reset password');
    }
  }

  async logout(refreshToken: string) {
    try {
      const payload = await this.jwtService.verifyAsync(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET,
      });
      await prisma.user.update({
        where: { id: payload.sub },
        data: { refreshToken: null },
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async updatePassword(updatePassword: UpdatePasswordDto, userId: string) {
    try {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        throw new NotFoundException('User not found');
      }
      if (!user.password) {
        throw new UnauthorizedException('Password not set');
      }

      const isCurrentPassword = await argon2.verify(
        user.password,
        updatePassword.currentPassword,
      );

      if (!isCurrentPassword) {
        throw new BadRequestException('Current password is incorrect');
      }

      if (updatePassword.newPassword !== updatePassword.confirmNewPassword) {
        throw new BadRequestException(
          'New password and confirm password do not match',
        );
      }

      const isSameAsOld = await argon2.verify(
        user.password,
        updatePassword.newPassword,
      );
      if (isSameAsOld) {
        throw new BadRequestException(
          'New password cannot be the same as old password',
        );
      }

      const hashedNewPassword = await argon2.hash(updatePassword.newPassword, {
        type: argon2.argon2id,
        memoryCost: 2 ** 16,
        timeCost: 3,
        parallelism: 1,
      });

      await prisma.user.update({
        where: { id: userId },
        data: {
          password: hashedNewPassword,
          refreshToken: null,
          passwordChangedAt: new Date(),
        },
      });

      let emailTemplate: string;

      return 'Password update successful, please log-in again';
    } catch (error) {
      this.logger.error('failed to update password', error.message);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to update password');
    }
  }
}
