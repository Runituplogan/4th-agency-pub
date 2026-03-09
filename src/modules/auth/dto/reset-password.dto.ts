import {
  IsString,
  IsNotEmpty,
  MinLength,
  Matches,
  ValidateIf,
  Validate,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  MaxLength,
} from 'class-validator';

//validator to check if password and confirmPassword match
@ValidatorConstraint({ name: 'MatchPasswords', async: false })
class MatchPasswords implements ValidatorConstraintInterface {
  validate(value: any, args: ValidationArguments) {
    const obj = args.object as any;
    return obj.password === obj.confirmPassword;
  }

  defaultMessage(args: ValidationArguments) {
    return 'Passwords do not match';
  }
}

export class ResetPasswordDto {
  @IsNotEmpty({ message: 'code is required' })
  @IsString()
  code: string;

  @IsNotEmpty({ message: 'Password is required' })
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @MaxLength(128, { message: 'Password must be at most 128 characters long' })
  @Matches(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+{}\[\]:;<>,.?~\\/-]).+$/,
    {
      message:
        'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
    },
  )
  password: string;

  @IsNotEmpty({ message: 'Please confirm your new password' })
  @IsString()
  confirmPassword: string;

  @Validate(MatchPasswords)
  matchingPasswords: string;
}
