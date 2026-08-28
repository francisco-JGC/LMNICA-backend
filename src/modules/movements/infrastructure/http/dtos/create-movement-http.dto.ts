import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

import { MovementType } from '../../../domain/value-objects/movement-type';

export class CreateMovementHttpDto {
  @IsUUID()
  salePointId!: string;

  @IsEnum(MovementType)
  type!: MovementType;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  amount!: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;

  @IsOptional()
  @IsDateString()
  occurredAt?: string;

  /**
   * UUID v4 opcional para dedupear reintentos. Ver comentario del use
   * case. Se acepta como opcional para no romper clientes antiguos.
   */
  @IsOptional()
  @IsUUID()
  clientRequestId?: string;
}
