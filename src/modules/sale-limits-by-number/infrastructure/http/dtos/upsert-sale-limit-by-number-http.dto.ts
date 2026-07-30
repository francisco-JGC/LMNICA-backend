import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
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
}
