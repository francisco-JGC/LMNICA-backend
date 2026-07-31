import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class UpdateSalePointHttpDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(30)
  @Matches(/^[A-Za-z0-9-]+$/, {
    message: 'code must contain only letters, digits and dashes',
  })
  code?: string;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  ownerPartnerId?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsInt()
  @Min(0)
  @Max(100)
  partnerPaymentPercentage?: number | null;
}
