import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  BadRequestException,
  DuplicateException,
  NotFoundException,
  InternalServerErrorException,
  UnauthorizedException,
  ForbiddenException,
} from 'src/common/exceptions/index';
import { ConfigService } from '@nestjs/config';
import { JsonWebTokenError, JwtService, TokenExpiredError } from '@nestjs/jwt';
import { User, UserStatus } from '@prisma/client';
import { RegisterUserDto } from './dto/register-user.dto';
import * as argon2 from 'argon2';
import { LoginUserDto } from './dto/login-user.dto';
import {
  LoginResponseDto,
  RegisterResponseDto,
} from './interfaces/user-login.interface';
import prisma from '../shared/service/client';

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    public jwtService: JwtService,
    private configService: ConfigService,
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
      expiresIn: '7d',
    });

    return { accessToken };
  }

  async registerUser(
    registerUserDto: RegisterUserDto,
  ): Promise<RegisterResponseDto> {
    try {
      const existingUser = await prisma.user.findFirst({
        where: {
          email: registerUserDto.email,
        },
      });

      if (existingUser) {
        throw new DuplicateException(`A user with that email already exists`);
      }

      if (registerUserDto.password !== registerUserDto.confirmPassword) {
        throw new BadRequestException('Passwords do not match');
      }

      const existingUserByPhone = await prisma.user.findUnique({
        where: { phoneNumber: registerUserDto.phoneNumber },
        select: { id: true, phoneNumber: true, status: true },
      });

      if (existingUserByPhone) {
        throw new DuplicateException(
          `A user with that phone number already exists`,
        );
      }

      const hashPassword = await argon2.hash(registerUserDto.password, {
        type: argon2.argon2id,
      });

      //transaction for atomicity
      const newUser = await prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            firstName: registerUserDto.firstName,
            secondName: registerUserDto.secondName,
            email: registerUserDto.email,
            phoneNumber: registerUserDto.phoneNumber,
            password: hashPassword,
            status: UserStatus.ACTIVE,
          },
        });

        return user;
      });

      this.logger.log(`New user registered: ${newUser.email}`);

      return newUser;
    } catch (error) {
      this.logger.error(`Error registering user: ${error.message}`);

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
        where: {
          email: loginUserDto.email,
        },
      });
      if (!user) {
        throw new NotFoundException('Incorrect username or password');
      }

      if (user.status === UserStatus.DEACTIVATED) {
        throw new ForbiddenException(
          'Your account has been deactivated. Contact support.',
        );
      }

      if (user.status !== UserStatus.ACTIVE) {
        throw new ForbiddenException(
          `Your account is currently ${user.status.toLowerCase()}. Please contact support if you believe this is a mistake.`,
        );
      }

      if (!user.password) {
        throw new BadRequestException('Password is required');
      }

      const checkPassword = await argon2.verify(
        user.password,
        loginUserDto.password,
      );
      if (!checkPassword) {
        throw new UnauthorizedException(
          'Invalid Password, please enter your correct password',
        );
      }
      const payload = {
        sub: user.id,
        firstName: user.firstName,
        secondName: user.secondName,
        email: user.email,
      };

      const accessToken = await this.jwtService.signAsync(payload, {
        secret: process.env.JWT_SECRET,
        expiresIn: '15m',
      });

      return {
        user: {
          id: user.id,
          firstName: user.firstName,
          secondName: user.secondName,
          email: user.email,
          phoneNumber: user.phoneNumber,
          status: user.status,
          passwordChangedAt: user.passwordChangedAt,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
        accessToken,
      };
    } catch (error) {
      this.logger.error(`Error logging in: ${error.message}`);

      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException ||
        error instanceof BadRequestException ||
        error instanceof UnauthorizedException
      ) {
        throw error;
      }

      throw new InternalServerErrorException('Failed to Login');
    }
  }
}
