import {
  IsNotEmpty,
  IsOptional,
  IsInt,
  Min,
  IsString,
  IsBoolean,
  IsNumber,
} from 'class-validator';

export class AddToCartDto {
  @IsNotEmpty()
  @IsString()
  placementId: string;

  @IsNotEmpty()
  @IsString()
  productId: string;

  @IsNotEmpty()
  @IsString()
  name: string;

  @IsNotEmpty()
  @IsString()
  websiteUrl: string;

  @IsOptional()
  @IsString()
  logoUrl?: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsNotEmpty()
  @IsString()
  type: string;

  @IsOptional()
  @IsInt()
  domainAuthority?: number;

  @IsOptional()
  @IsInt()
  domainRanking?: number;

  @IsOptional()
  @IsBoolean()
  isDoFollow?: boolean;

  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  unitAmount: number;

  @IsNotEmpty()
  @IsString()
  pricingTier: string;

  @IsOptional()
  @IsString()
  currency?: string = 'USD';

  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number = 1;
}
