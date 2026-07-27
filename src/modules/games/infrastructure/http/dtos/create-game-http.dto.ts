import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

import { GameType } from '../../../domain/value-objects/game-type';

export class CreateGameHttpDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(40)
  @Matches(/^[a-z0-9-]+$/, {
    message: 'slug must contain only lowercase letters, digits and dashes',
  })
  slug!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @IsEnum(GameType)
  type!: GameType;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  exactMultiplier: number | null = null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  easyMultiplier: number | null = null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pairEasyMultiplier: number | null = null;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  imagePath: string | null = null;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  orderIndex!: number;
}
