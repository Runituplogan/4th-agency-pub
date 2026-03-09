import { UserStatus } from '@prisma/client';

// export enum UserStatus {
//   ACTIVE = 'ACTIVE',
//   SUSPENDED = 'SUSPENDED',
//   DELETED = 'DELETED',
// }

// export enum SignupMode {
//   OAUTH = 'OAUTH',
//   REGULAR = 'REGULAR',
// }

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
    passwordChangedAt: Date | null;
    status: UserStatus;
    createdAt: Date;
    updatedAt: Date;
  };
  accessToken: string;
}

export class RegisterResponseDto {
  id: string;
  firstName: string;
  secondName: string;
  email: string;
  phoneNumber: string;
  status: UserStatus;
  createdAt: Date;
  updatedAt: Date;
}
