import { Inject, Injectable } from '@nestjs/common';

import type { UseCase } from '../../../../shared/application/use-case';
import { NotFoundError } from '../../../../shared/domain/errors/domain.error';
import {
  DRAW_RESULTS_REPOSITORY,
  type DrawResultsRepository,
} from '../../../games/domain/repositories/draw-results.repository';
import {
  SALE_POINTS_REPOSITORY,
  type SalePointsRepository,
} from '../../../sale-points/domain/repositories/sale-points.repository';
import {
  USERS_REPOSITORY,
  type UsersRepository,
} from '../../../users/domain/repositories/users.repository';
import { UserRole } from '../../../users/domain/value-objects/user-role';
import {
  TICKETS_REPOSITORY,
  type TicketsRepository,
} from '../../domain/repositories/tickets.repository';
import { toTicketOutput, type TicketOutput } from '../dtos/ticket.output';

export interface FindTicketByIdInput {
  id: string;
  requesterId: string;
  requesterRole: UserRole;
}

@Injectable()
export class FindTicketById implements UseCase<FindTicketByIdInput, TicketOutput> {
  constructor(
    @Inject(TICKETS_REPOSITORY) private readonly tickets: TicketsRepository,
    @Inject(DRAW_RESULTS_REPOSITORY)
    private readonly drawResults: DrawResultsRepository,
    @Inject(SALE_POINTS_REPOSITORY)
    private readonly salePoints: SalePointsRepository,
    @Inject(USERS_REPOSITORY) private readonly users: UsersRepository,
  ) {}

  async execute(input: FindTicketByIdInput): Promise<TicketOutput> {
    const ticket = await this.tickets.findById(input.id);
    if (!ticket) throw new NotFoundError('Ticket', input.id);

    if (
      input.requesterRole === UserRole.SELLER &&
      !ticket.isOwnedBy(input.requesterId)
    ) {
      throw new NotFoundError('Ticket', input.id);
    }

    const [executed, salePoint, seller] = await Promise.all([
      this.drawResults.findByGameAndDraw(ticket.gameId, ticket.drawAt),
      this.salePoints.findById(ticket.salePointId),
      this.users.findById(ticket.sellerId),
    ]);
    return toTicketOutput(
      ticket,
      executed !== null,
      0,
      salePoint?.name ?? null,
      seller?.name ?? null,
    );
  }
}
