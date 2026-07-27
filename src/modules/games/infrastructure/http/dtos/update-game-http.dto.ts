import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class UpdateGameHttpDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  exactMultiplier?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  easyMultiplier?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pairEasyMultiplier?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  imagePath?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  orderIndex?: number;
}
