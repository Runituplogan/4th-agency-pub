import {
  IsString,
  IsNotEmpty,
  MinLength,
  Matches,
  Length,
  IsEmail,
} from 'class-validator';

export class VerifyAccountDto {
  @IsString()
  @IsNotEmpty({ message: 'Token is required' })
  token: string;

  @IsEmail()
  @IsNotEmpty()
  userId: string;
}
