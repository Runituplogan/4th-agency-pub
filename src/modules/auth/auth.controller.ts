import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import type { Request, Response } from 'express';
import { RegisterUserDto } from './dto/register-user.dto';
import { LoginUserDto } from './dto/login-user.dto';
import { Public } from 'src/common/decorators/public.decorator';
import { UnauthorizedException } from 'src/common/exceptions';
import { UpdatePasswordDto } from './dto/update-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyResetCodeDto } from './dto/verifiy-reset-code.dto';
import { LoginResponseDto } from './interfaces/user-login.interface';
import { VerifyAccountDto } from './dto/verifiy-account.dto';
import { JwtAuthGuard } from 'src/common/guards/auth.guard';
import { ConfigService } from '@nestjs/config';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Public()
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

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async loginUser(
    @Body() loginUser: LoginUserDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { user, accessToken, refreshToken } =
      await this.authService.loginUser(loginUser);

    this.setRefreshTokenCookie(res, refreshToken);

    res.locals.message = 'User logged in successfully';
    return { data: { ...user, accessToken } };
  }

  @Public()
  @Post('refresh-token')
  @HttpCode(HttpStatus.OK)
  async refreshToken(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const oldRefreshToken = req.cookies?.refreshToken;

    if (!oldRefreshToken) {
      throw new UnauthorizedException('No refresh token found');
    }

    const { accessToken, refreshToken, user } =
      await this.authService.refreshToken(oldRefreshToken);

    this.setRefreshTokenCookie(res, refreshToken);

    return { data: { ...user, accessToken } };
  }

  @Public()
  @Post('verify-account')
  @HttpCode(HttpStatus.OK)
  async verifyAccount(
    @Body() verifyAccountDto: VerifyAccountDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.verifyAccount(verifyAccountDto);

    this.setRefreshTokenCookie(res, result.refreshToken);

    res.locals.message = 'Email verified successfully! Account is now active.';
    return { data: result };
  }

  @Public()
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

  @Public()
  @Post('verify-reset-code')
  @HttpCode(HttpStatus.OK)
  async verifyPasswordResetCode(
    @Body() verifyResetCodeDto: VerifyResetCodeDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { resetToken } =
      await this.authService.verifyPasswordResetCode(verifyResetCodeDto);

    res.locals.message =
      'Reset code verified successfully. You may now reset your password.';

    return { data: { resetToken } };
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(
    @Body() resetPasswordDto: ResetPasswordDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { message } = await this.authService.resetPassword(resetPasswordDto);
    res.locals.message = message;
  }

  @Public()
  @Post('resend-code')
  @HttpCode(HttpStatus.OK)
  async resendResetCode(
    @Body() resendCodeDto: ForgotPasswordDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { message } = await this.authService.resendResetCode(resendCodeDto);
    res.locals.message = message;
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

  private setRefreshTokenCookie(res: Response, refreshToken: string): void {
    const isProduction = this.configService.get('NODE_ENV') === 'production';

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'strict' : 'lax',
      path: '/auth/refresh-token',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
  }
}
