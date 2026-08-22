import { Transform } from 'class-transformer';
import { ArrayUnique, IsDateString, IsOptional, IsUUID } from 'class-validator';

export class MovementsBalanceQueryDto {
  @IsOptional()
  @IsUUID()
  salePointId?: string;

  /**
   * Multi-select por sucursal. Query se pasa como CSV
   * (`?salePointIds=uuid1,uuid2`) porque es más simple para el cliente que
   * repetir el param. Si viene `salePointId` singular tiene precedencia —
   * los clientes viejos que no conocen `salePointIds` siguen funcionando.
   */
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
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}
