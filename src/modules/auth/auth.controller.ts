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
} from '@nestjs/common';
import { AuthService } from './auth.service';
import type { Request, Response } from 'express';
import { RegisterUserDto } from './dto/register-user.dto';
import { LoginUserDto } from './dto/login-user.dto';
import { Public } from 'src/common/decorators/public.decorator';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  async registerUser(
    @Body() registerUser: RegisterUserDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<null> {
    await this.authService.registerUser(registerUser);
    res.locals.message = 'Registration successful';
    return null;
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async loginUser(
    @Body() loginUser: LoginUserDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { user, accessToken } = await this.authService.loginUser(loginUser);

    const isProduction = process.env.NODE_ENV === 'production';

    res.cookie('refreshToken', accessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'strict' : 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.locals.message = 'User logged in successfully';
    return {
      data: {
        ...user,
        accessToken,
      },
    };
  }
}
