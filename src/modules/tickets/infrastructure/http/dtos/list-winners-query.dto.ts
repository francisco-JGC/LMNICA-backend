import {
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';

export class ListWinnersQueryDto {
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
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  /**
   * Hora del sorteo en formato "HH:MM" (24h, wall-clock Managua) para
   * filtrar solo los ganadores de sorteos que ocurren a esa hora.
   */
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'drawTime must be HH:MM (24h)',
  })
  drawTime?: string;

  /** Igual que en `ListTicketsQueryDto.search` — folio prefix o cliente. */
  @IsOptional()
  @IsString()
  @MaxLength(60)
  search?: string;
}
