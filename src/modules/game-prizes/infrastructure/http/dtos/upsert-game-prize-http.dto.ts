import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsUUID,
  Min,
  ValidateIf,
} from 'class-validator';

export class UpsertGamePrizeHttpDto {
  @IsUUID()
  salePointId!: string;

  @IsUUID()
  gameId!: string;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @Type(() => Number)
  @IsInt()
  @Min(0)
  exactMultiplier: number | null = null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @Type(() => Number)
  @IsInt()
  @Min(0)
  easyMultiplier: number | null = null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @Type(() => Number)
  @IsInt()
  @Min(0)
  pairEasyMultiplier: number | null = null;
}
