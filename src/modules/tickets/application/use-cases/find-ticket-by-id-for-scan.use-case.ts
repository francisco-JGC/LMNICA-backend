import { Inject, Injectable } from '@nestjs/common';

import type { UseCase } from '../../../../shared/application/use-case';
import { NotFoundError } from '../../../../shared/domain/errors/domain.error';
import {
  DRAW_RESULTS_REPOSITORY,
  type DrawResultsRepository,
} from '../../../games/domain/repositories/draw-results.repository';
import {
  TICKETS_REPOSITORY,
  type TicketsRepository,
} from '../../domain/repositories/tickets.repository';
import { toTicketOutput, type TicketOutput } from '../dtos/ticket.output';

export interface FindTicketByIdForScanInput {
  id: string;
}

/**
 * Lookup por ID pensado para el flujo de scan del QR — a diferencia de
 * `FindTicketById`, no aplica la restricción de dueño para vendedores.
 *
 * Rationale: escanear requiere tener el QR físico en mano, y los vendedores
 * necesitan poder replicar boletos de compañeros de sucursal (o de días
 * pasados) sin que el backend les tape con 404. El resto del endpoint
 * `GET /tickets/:id` mantiene su restricción para navegación directa por
 * ID desde la UI, que sí queremos aislada por vendedor.
 */
@Injectable()
export class FindTicketByIdForScan
  implements UseCase<FindTicketByIdForScanInput, TicketOutput>
{
  constructor(
    @Inject(TICKETS_REPOSITORY) private readonly tickets: TicketsRepository,
    @Inject(DRAW_RESULTS_REPOSITORY)
    private readonly drawResults: DrawResultsRepository,
  ) {}

  async execute(input: FindTicketByIdForScanInput): Promise<TicketOutput> {
    const ticket = await this.tickets.findById(input.id);
    if (!ticket) throw new NotFoundError('Ticket', input.id);

    const executed = await this.drawResults.findByGameAndDraw(
      ticket.gameId,
      ticket.drawAt,
    );
    return toTicketOutput(ticket, executed !== null);
  }
}
