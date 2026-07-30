import { Inject, Injectable } from '@nestjs/common';

import type { UseCase } from '../../../../shared/application/use-case';
import {
  NotFoundError,
  ValidationError,
} from '../../../../shared/domain/errors/domain.error';
import { ResolveNextDraw } from '../../../games/application/use-cases/resolve-next-draw.use-case';
import {
  DRAW_RESULTS_REPOSITORY,
  type DrawResultsRepository,
} from '../../../games/domain/repositories/draw-results.repository';
import { UserRole } from '../../../users/domain/value-objects/user-role';
import {
  TICKETS_REPOSITORY,
  type TicketsRepository,
} from '../../domain/repositories/tickets.repository';
import { toTicketOutput, type TicketOutput } from '../dtos/ticket.output';

const SELLER_VOID_WINDOW_MINUTES = 5;

export interface VoidTicketInput {
  id: string;
  reason: string;
  requesterId: string;
  requesterRole: UserRole;
}

@Injectable()
export class VoidTicket implements UseCase<VoidTicketInput, TicketOutput> {
  constructor(
    @Inject(TICKETS_REPOSITORY) private readonly tickets: TicketsRepository,
    @Inject(DRAW_RESULTS_REPOSITORY)
    private readonly drawResults: DrawResultsRepository,
    private readonly resolveNextDraw: ResolveNextDraw,
  ) {}

  async execute(input: VoidTicketInput): Promise<TicketOutput> {
    const ticket = await this.tickets.findById(input.id);
    if (!ticket) throw new NotFoundError('Ticket', input.id);

    const executed = await this.drawResults.findByGameAndDraw(
      ticket.gameId,
      ticket.drawAt,
    );
    if (executed) {
      throw new ValidationError(
        'El sorteo ya se corrió, el ticket no se puede anular',
      );
    }

    const now = new Date();
    const minutesUntilDraw = ticket.minutesUntilDraw(now);
    if (minutesUntilDraw <= ticket.cutoffMinutes) {
      throw new ValidationError(
        `Ticket cannot be voided within ${ticket.cutoffMinutes} minutes of the draw`,
      );
    }

    if (input.requesterRole === UserRole.SELLER) {
      if (!ticket.isOwnedBy(input.requesterId)) {
        throw new NotFoundError('Ticket', input.id);
      }
      const elapsed = ticket.minutesSinceCreation(now);
      if (elapsed > SELLER_VOID_WINDOW_MINUTES) {
        throw new ValidationError(
          `Sellers can only void tickets within ${SELLER_VOID_WINDOW_MINUTES} minutes`,
        );
      }

      // Defensa D: el sorteo que era el "próximo natural" al momento de
      // crear el ticket no debe haber corrido todavía. Cubre casos donde
      // `ticket.drawAt` quedó desalineado (bugs históricos de cutoff) y
      // apunta lejos en el futuro mientras el sorteo real ya se ejecutó,
      // dejando pasar los checks anteriores. Admin/partner no necesitan
      // esta defensa — pueden anular manualmente si es un caso legítimo.
      const intended = await this.resolveNextDraw.execute({
        gameId: ticket.gameId,
        at: ticket.createdAt,
      });
      if (now.getTime() >= intended.drawAt.getTime()) {
        throw new ValidationError(
          'El sorteo original de este ticket ya se corrió, no se puede anular',
        );
      }
    }

    ticket.void(input.reason);
    await this.tickets.save(ticket);
    return toTicketOutput(ticket);
  }
}
