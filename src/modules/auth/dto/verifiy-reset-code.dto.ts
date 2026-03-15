import {
  IsString,
  IsNotEmpty,
  MinLength,
  Matches,
  Length,
  IsEmail,
} from 'class-validator';

export class VerifyResetCodeDto {
  @IsString()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty({ message: 'Verification code is required' })
  @Length(6, 6, { message: 'Verification code must be 6 digits' })
  code: string;
}
