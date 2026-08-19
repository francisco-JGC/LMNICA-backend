import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';

import { TicketStatus } from '../../../domain/value-objects/ticket-status';

/**
 * Query del endpoint `GET /tickets`. Deliberadamente sin `page`/`limit`:
 * el use-case devuelve TODO el rango filtrado (bounded internamente a
 * 100k por seguridad). Sin paginación server-side, no hay forma de que
 * "Facturas" y "Boletos ganadores" muestren números distintos para el
 * mismo rango/filtros — ambos corren sobre el mismo set completo.
 */
export class ListTicketsQueryDto {
  @IsOptional()
  @IsUUID()
  sellerId?: string;

  @IsOptional()
  @IsUUID()
  salePointId?: string;

  @IsOptional()
  @IsUUID()
  gameId?: string;

  @IsOptional()
  @IsEnum(TicketStatus)
  status?: TicketStatus;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'drawTime must be HH:MM in 24-hour format',
  })
  drawTime?: string;

  /**
   * Búsqueda por folio (prefix) o cliente (anywhere). Cuando viene, el
   * use-case ignora `from`/`to` — si el operador busca un folio, no le
   * importa el rango de fechas porque un folio es único a nivel sistema.
   */
  @IsOptional()
  @IsString()
  @MaxLength(60)
  search?: string;
}
