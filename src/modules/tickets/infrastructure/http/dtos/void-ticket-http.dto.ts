import { IsOptional, IsString, MaxLength } from 'class-validator';

export class VoidTicketHttpDto {
  /**
   * Motivo de la anulación — OPCIONAL. Si el vendedor no lo escribe se
   * guarda `null`. Un string vacío o solo espacios también se normaliza
   * a `null` en el use-case.
   */
  @IsOptional()
  @IsString()
  @MaxLength(255)
  reason?: string;
}
