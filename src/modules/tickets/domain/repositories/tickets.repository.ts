import type { Ticket } from '../entities/ticket.entity';
import type { TicketStatus } from '../value-objects/ticket-status';

export const TICKETS_REPOSITORY = Symbol('TICKETS_REPOSITORY');

export interface FindTicketsFilters {
  sellerId?: string;
  salePointId?: string;
  /**
   * Restrict to tickets belonging to any of these sale points. Used for
   * partner-scoped queries (owner of a subset of sucursales). An empty
   * array is meaningful — return no rows.
   */
  salePointIds?: string[];
  gameId?: string;
  status?: TicketStatus;
  from?: Date;
  to?: Date;
  /**
   * Restrict to tickets whose `draw_at` matches this time-of-day (HH:MM)
   * in the business timezone. Used to filter "el sorteo de las 11:00" over
   * a date range regardless of which specific day each ticket landed on.
   */
  drawTime?: string;
  limit: number;
  offset: number;
}

export interface TicketsRepository {
  save(ticket: Ticket): Promise<void>;
  findById(id: string): Promise<Ticket | null>;
  findByFolio(folio: string): Promise<Ticket | null>;
  /**
   * Lookup por el UUID de idempotencia enviado por el cliente. `CreateTicket`
   * lo usa antes de crear para dedupear reintentos automáticos (timeouts,
   * refresh de token) y toques duplicados del vendedor.
   */
  findByClientRequestId(clientRequestId: string): Promise<Ticket | null>;
  findMany(filters: FindTicketsFilters): Promise<Ticket[]>;
  countMany(filters: FindTicketsFilters): Promise<number>;
}
