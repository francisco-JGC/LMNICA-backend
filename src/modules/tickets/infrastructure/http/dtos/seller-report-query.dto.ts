import { Transform } from 'class-transformer';
import {
  ArrayUnique,
  IsDateString,
  IsOptional,
  IsUUID,
} from 'class-validator';

export class SellerReportQueryDto {
  @IsOptional()
  @IsUUID()
  salePointId?: string;

  /** Multi-sucursal (CSV). Ver comentario en `MovementsBalanceQueryDto`. */
  @IsOptional()
  @Transform(({ value }) => {
    if (Array.isArray(value)) return value;
    if (typeof value !== 'string') return value;
    return value
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  })
  @IsUUID('all', { each: true })
  @ArrayUnique()
  salePointIds?: string[];

  @IsOptional()
  @IsUUID()
  sellerId?: string;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}
