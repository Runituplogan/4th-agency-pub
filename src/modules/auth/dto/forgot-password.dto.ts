import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
} from 'class-validator';
import { Transform } from 'class-transformer';

function IsEmailOrPhone(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      name: 'isEmailOrPhone',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: any, args: ValidationArguments) {
          if (!value || typeof value !== 'string') return false;

          // Email regex pattern
          const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

          const phonePattern = /^[\+]?[(]?[\d\s\-\.\(\)]{10,}$/;

          return emailPattern.test(value) || phonePattern.test(value);
        },
        defaultMessage(args: ValidationArguments) {
          return 'Value must be either a valid email address or phone number';
        },
      },
    });
  };
}

export class ForgotPasswordDto {
  @IsNotEmpty()
  @IsString()
  @IsEmailOrPhone()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      if (value.includes('@')) {
        return value.toLowerCase();
      }

      return value.trim();
    }
    return value;
  })
  identifier: string;
}
