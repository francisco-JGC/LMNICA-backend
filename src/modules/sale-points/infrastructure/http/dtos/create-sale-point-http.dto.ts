import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Matches,
  Min,
  MinLength,
} from 'class-validator';

export class CreateSalePointHttpDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(30)
  @Matches(/^[A-Za-z0-9-]+$/, {
    message: 'code must contain only letters, digits and dashes',
  })
  code!: string;

  @IsOptional()
  @IsUUID()
  ownerPartnerId?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  partnerPaymentPercentage?: number;
}
