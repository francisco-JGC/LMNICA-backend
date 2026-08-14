import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import { UserRole } from '../../../domain/value-objects/user-role';

export class ListUsersQueryDto {
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  // Techo alto (1000) porque varias vistas del web filtran vendedores
  // localmente por sucursal — necesitan traer todos los sellers en scope
  // del partner/admin logueado para poder cruzarlos. `SellerQuotasSection`
  // (cuotas por vendedor) es el caso más claro: si el operador tiene 100+
  // vendedores en total, con `Max(100)` la sucursal seleccionada podría
  // no ver los suyos y aparecía "no hay vendedores activos".
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;
}
