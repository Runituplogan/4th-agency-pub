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
  @IsOptional()
  @IsString()
  placementId?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  websiteUrl?: string;

  @IsOptional()
  @IsString()
  logoUrl?: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsString()
  outletName?: string;

  @IsOptional()
  @IsString()
  channelType?: string;

  @IsOptional()
  @IsString()
  placementType?: string;

  @IsOptional()
  @IsInt()
  domainAuthority?: number;

  @IsOptional()
  @IsInt()
  domainRanking?: number;

  @IsOptional()
  @IsBoolean()
  isDoFollow?: boolean;

  @IsOptional()
  @IsInt()
  minDeliveryDays?: number;

  @IsOptional()
  @IsInt()
  maxDeliveryDays?: number;

  @IsNotEmpty()
  @IsInt()
  unitAmount?: number;

  @IsOptional()
  @IsString()
  pricingTier?: string;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;

  @IsOptional()
  @IsString()
  contentType?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  contentTypeFee?: number;
}
