import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import type { Request, Response } from 'express';
import { RegisterUserDto } from './dto/register-user.dto';
import { LoginUserDto } from './dto/login-user.dto';
import { Public } from 'src/common/decorators/public.decorator';
import {
  BadRequestException,
  UnauthorizedException,
} from 'src/common/exceptions';
import { UpdatePasswordDto } from './dto/update-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from 'src/common/guards/auth.guard';
import { ResetPasswordDto } from './dto/reset-password.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async registerUser(
    @Body() registerUser: RegisterUserDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<null> {
    await this.authService.registerUser(registerUser);
    res.locals.message =
      'Registration successful – check your inbox to verify your e-mail';
    return null;
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async loginUser(
    @Body() loginUser: LoginUserDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { user, accessToken, refreshToken } =
      await this.authService.loginUser(loginUser);

    res.locals.message = 'User logged in successfully';
    return { data: { ...user, accessToken, refreshToken } };
  }

  @Post('refresh-token')
  @HttpCode(HttpStatus.OK)
  async refreshToken(
    @Req() req: Request,
    @Body() body: { refreshToken?: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    const oldRefreshToken = req.cookies?.refreshToken ?? body?.refreshToken;

    if (!oldRefreshToken) {
      throw new UnauthorizedException('No refresh token found');
    }

    const { accessToken, refreshToken, user } =
      await this.authService.refreshToken(oldRefreshToken);

    return { data: { ...user, accessToken, refreshToken } };
  }

  @Get('verify-email')
  @HttpCode(HttpStatus.OK)
  async verifyEmail(
    @Query('token') token: string,
    @Query('userId') userId: string,
  ) {
    if (!token || !userId) {
      throw new BadRequestException('Token and userId are required');
    }

    await this.authService.verifyEmail(token, userId);

    return { message: 'Email verified successfully. You can now log in.' };
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(
    @Body() forgotPasswordDto: ForgotPasswordDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { message } =
      await this.authService.forgotPassword(forgotPasswordDto);
    res.locals.message = message;
  }

  @Post('reset-password')
  async resetPassword(
    @Query('token') token: string,
    @Body() resetPasswordDto: ResetPasswordDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (!token) {
      throw new BadRequestException('Reset token is required');
    }

    await this.authService.resetPassword({
      resetToken: token,
      newPassword: resetPasswordDto.newPassword,
      confirmPassword: resetPasswordDto.confirmPassword,
    });

    res.locals.message = 'Password reset successful. You can now log in.';
  }

  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  async resendVerificationEmail(
    @Body('email') email: string,
  ): Promise<{ message: string }> {
    return this.authService.resendVerificationEmail(email);
  }

  @Patch('update-password')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async updatePassword(
    @Body() updatePasswordDto: UpdatePasswordDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const userId = req.user?.id;
    if (!userId) {
      throw new UnauthorizedException('User authentication required.');
    }
    await this.authService.updatePassword(updatePasswordDto, userId);
    res.locals.message = 'Password updated successfully. Please log in again.';
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies.refreshToken;

    if (!refreshToken) {
      throw new UnauthorizedException('No refresh token found');
    }

    const result = await this.authService.logout(refreshToken);
    res.locals.message = 'Successfully logged out';

    return result;
  }
}
