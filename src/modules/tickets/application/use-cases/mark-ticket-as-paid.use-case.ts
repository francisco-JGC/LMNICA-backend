import { Inject, Injectable } from '@nestjs/common';

import type { UseCase } from '../../../../shared/application/use-case';
import {
  NotFoundError,
  ValidationError,
} from '../../../../shared/domain/errors/domain.error';
import { UserRole } from '../../../users/domain/value-objects/user-role';
import {
  TICKETS_REPOSITORY,
  type TicketsRepository,
} from '../../domain/repositories/tickets.repository';
import { toTicketOutput, type TicketOutput } from '../dtos/ticket.output';
import { TicketEvaluator } from '../services/ticket-evaluator.service';

export interface MarkTicketAsPaidInput {
  id: string;
  requesterId: string;
  requesterRole: UserRole;
}

@Injectable()
export class MarkTicketAsPaid
  implements UseCase<MarkTicketAsPaidInput, TicketOutput>
{
  constructor(
    @Inject(TICKETS_REPOSITORY) private readonly tickets: TicketsRepository,
    private readonly evaluator: TicketEvaluator,
  ) {}

  async execute(input: MarkTicketAsPaidInput): Promise<TicketOutput> {
    const ticket = await this.tickets.findById(input.id);
    if (!ticket) throw new NotFoundError('Ticket', input.id);

    if (ticket.isPaid) {
      throw new ValidationError('El boleto ya fue marcado como pagado');
    }

    const evaluation = await this.evaluator.evaluate(ticket);
    if (!evaluation.isWinner) {
      throw new ValidationError('Solo se pueden pagar boletos ganadores');
    }
    if (evaluation.hasPendingDraw) {
      throw new ValidationError(
        'El sorteo aún no se ha corrido, no se puede pagar',
      );
    }

    ticket.markAsPaid(evaluation.totalPrize, input.requesterId);
    await this.tickets.save(ticket);

    return toTicketOutput(ticket, true, evaluation.totalPrize);
  }
}
