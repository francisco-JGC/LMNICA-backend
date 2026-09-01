import { Type } from 'class-transformer';
import {
  IsBoolean,
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
  /** Requerido para movimientos de sucursal. Omitir cuando se envía sellerId. */
  @IsOptional()
  @IsUUID()
  salePointId?: string;

  /** UUID del vendedor para movimientos de vendedor. Mutuamente excluyente con salePointId. */
  @IsOptional()
  @IsUUID()
  sellerId?: string;

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

  @IsOptional()
  @IsUUID()
  clientRequestId?: string;

  @IsOptional()
  @IsBoolean()
  isPrizePayment?: boolean;
}
