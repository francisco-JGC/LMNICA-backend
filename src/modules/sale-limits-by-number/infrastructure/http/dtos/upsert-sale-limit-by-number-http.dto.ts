import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

export class UpsertSaleLimitByNumberHttpDto {
  @IsUUID()
  salePointId!: string;

  @IsUUID()
  gameId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  label!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  amount!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  minAmount?: number | null;
}
