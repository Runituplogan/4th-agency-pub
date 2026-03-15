import { SignupMode, UserStatus } from '@prisma/client';

export interface User {
  id: string;
  firstName: string;
  secondName: string;
  email: string;
  phoneNumber: string;
  password?: string;
  profileImage?: string;
  passwordChangedAt?: Date;
  passwordResetCode?: string;
  passwordResetExpires?: Date;
  status: UserStatus;
  createdAt: Date;
  updatedAt: Date;
}
export interface LoginResponseDto {
  user: {
    id: string;
    firstName: string;
    secondName: string;
    email: string;
    phoneNumber: string;
    status: UserStatus;
    googleId: string | null;
    verified: boolean;
    signUpMode: SignupMode | null;
    createdAt: Date;
    updatedAt: Date;
  };
  accessToken: string;
  refreshToken: string;
}

export class RegisterResponseDto {
  user: {
    id: string;
    firstName: string;
    secondName: string;
    email: string;
    phoneNumber: string;
    status: UserStatus;
    signUpMode: SignupMode;
    verified: boolean;
    googleId?: string;
    profileImage?: string;
    emailVerificationCode?: string;
    emailCodeExpires?: Date;
    createdAt: Date;
    updatedAt: Date;
  };
  accessToken: string;
}
