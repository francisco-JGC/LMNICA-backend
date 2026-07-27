import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class CreateTicketLineHttpDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  label!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  amount!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  prize!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  pairEasyPrize?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  subGameId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  subGameName?: string | null;
}

export class CreateTicketHttpDto {
  @IsUUID()
  gameId!: string;

  @IsUUID()
  salePointId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  client?: string | null;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => CreateTicketLineHttpDto)
  lines!: CreateTicketLineHttpDto[];

  @IsOptional()
  @IsDateString()
  drawAt?: string;
}
