import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';

import { CurrentUser } from '../../../../auth/infrastructure/http/decorators/current-user.decorator';
import { Roles } from '../../../../auth/infrastructure/http/decorators/roles.decorator';
import type { RequestUser } from '../../../../auth/infrastructure/strategies/jwt.strategy';
import { UserRole } from '../../../../users/domain/value-objects/user-role';
import { CreateTicket } from '../../../application/use-cases/create-ticket.use-case';
import { FindTicketByFolio } from '../../../application/use-cases/find-ticket-by-folio.use-case';
import { FindTicketById } from '../../../application/use-cases/find-ticket-by-id.use-case';
import { FindTicketByIdForScan } from '../../../application/use-cases/find-ticket-by-id-for-scan.use-case';
import { GetBillingByGame } from '../../../application/use-cases/get-billing-by-game.use-case';
import { GetBranchTotals } from '../../../application/use-cases/get-branch-totals.use-case';
import { GetSalesByNumber } from '../../../application/use-cases/get-sales-by-number.use-case';
import { GetSellerReport } from '../../../application/use-cases/get-seller-report.use-case';
import { GetTicketsByDraw } from '../../../application/use-cases/get-tickets-by-draw.use-case';
import { GetTicketsSummary } from '../../../application/use-cases/get-tickets-summary.use-case';
import { ListTickets } from '../../../application/use-cases/list-tickets.use-case';
import type { ListTicketsOutput } from '../../../application/use-cases/list-tickets.use-case';
import type { BillingByGameOutput } from '../../../application/dtos/billing-by-game.output';
import type { BranchTotalsOutput } from '../../../application/dtos/branch-totals.output';
import type { SalesByNumberOutput } from '../../../application/dtos/sales-by-number.output';
import type { SellerReportOutput } from '../../../application/dtos/seller-report.output';
import type { TicketsByDrawOutput } from '../../../application/dtos/tickets-by-draw.output';
import type { TicketsSummaryOutput } from '../../../application/dtos/tickets-summary.output';
import {
  ListWinningTickets,
  type WinningTicketOutput,
} from '../../../application/use-cases/list-winning-tickets.use-case';
import { VoidTicket } from '../../../application/use-cases/void-ticket.use-case';
import type { TicketOutput } from '../../../application/dtos/ticket.output';
import { CreateTicketHttpDto } from '../dtos/create-ticket-http.dto';
import { ListTicketsQueryDto } from '../dtos/list-tickets-query.dto';
import { TicketsByDrawQueryDto } from '../dtos/tickets-by-draw-query.dto';
import { TicketsSummaryQueryDto } from '../dtos/tickets-summary-query.dto';
import {
  EvaluateTicketById,
  type EvaluateTicketByIdOutput,
} from '../../../application/use-cases/evaluate-ticket-by-id.use-case';
import { BillingByGameQueryDto } from '../dtos/billing-by-game-query.dto';
import { BranchTotalsQueryDto } from '../dtos/branch-totals-query.dto';
import { ListWinnersQueryDto } from '../dtos/list-winners-query.dto';
import { SalesByNumberQueryDto } from '../dtos/sales-by-number-query.dto';
import { SellerReportQueryDto } from '../dtos/seller-report-query.dto';
import { VoidTicketHttpDto } from '../dtos/void-ticket-http.dto';

@Controller('tickets')
export class TicketsController {
  constructor(
    private readonly createTicket: CreateTicket,
    private readonly listTickets: ListTickets,
    private readonly getTicketsSummary: GetTicketsSummary,
    private readonly getTicketsByDraw: GetTicketsByDraw,
    private readonly findTicketById: FindTicketById,
    private readonly findTicketByIdForScan: FindTicketByIdForScan,
    private readonly findTicketByFolio: FindTicketByFolio,
    private readonly voidTicketUseCase: VoidTicket,
    private readonly listWinningTickets: ListWinningTickets,
    private readonly evaluateTicketById: EvaluateTicketById,
    private readonly getSellerReport: GetSellerReport,
    private readonly getBranchTotals: GetBranchTotals,
    private readonly getBillingByGame: GetBillingByGame,
    private readonly getSalesByNumber: GetSalesByNumber,
  ) {}

  @Post()
  create(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateTicketHttpDto,
  ): Promise<TicketOutput> {
    return this.createTicket.execute({
      gameId: dto.gameId,
      salePointId: dto.salePointId,
      sellerId: user.id,
      client: dto.client ?? null,
      lines: dto.lines,
      drawAt: dto.drawAt ? new Date(dto.drawAt) : undefined,
      clientRequestId: dto.clientRequestId ?? null,
    });
  }

  @Get()
  list(
    @CurrentUser() user: RequestUser,
    @Query() query: ListTicketsQueryDto,
  ): Promise<ListTicketsOutput> {
    return this.listTickets.execute({
      requesterId: user.id,
      requesterRole: user.role,
      salePointId: query.salePointId,
      gameId: query.gameId,
      sellerId: query.sellerId,
      status: query.status,
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
      drawTime: query.drawTime,
      search: query.search,
    });
  }

  @Get('summary')
  summary(
    @CurrentUser() user: RequestUser,
    @Query() query: TicketsSummaryQueryDto,
  ): Promise<TicketsSummaryOutput> {
    return this.getTicketsSummary.execute({
      requesterId: user.id,
      requesterRole: user.role,
      salePointId: query.salePointId,
      gameId: query.gameId,
      sellerId: query.sellerId,
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
    });
  }

  @Get('billing-by-game')
  @Roles(UserRole.ADMIN, UserRole.PARTNER)
  billingByGame(
    @CurrentUser() user: RequestUser,
    @Query() query: BillingByGameQueryDto,
  ): Promise<BillingByGameOutput> {
    return this.getBillingByGame.execute({
      requesterId: user.id,
      requesterRole: user.role,
      salePointId: query.salePointId,
      sellerId: query.sellerId,
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
    });
  }

  @Get('branch-totals')
  @Roles(UserRole.ADMIN, UserRole.PARTNER)
  branchTotals(
    @CurrentUser() user: RequestUser,
    @Query() query: BranchTotalsQueryDto,
  ): Promise<BranchTotalsOutput> {
    return this.getBranchTotals.execute({
      requesterId: user.id,
      requesterRole: user.role,
      gameId: query.gameId,
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
    });
  }

  @Get('seller-report')
  sellerReport(
    @CurrentUser() user: RequestUser,
    @Query() query: SellerReportQueryDto,
  ): Promise<SellerReportOutput> {
    return this.getSellerReport.execute({
      requesterId: user.id,
      requesterRole: user.role,
      salePointId: query.salePointId,
      sellerId: query.sellerId,
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
    });
  }

  @Get('by-draw')
  byDraw(
    @CurrentUser() user: RequestUser,
    @Query() query: TicketsByDrawQueryDto,
  ): Promise<TicketsByDrawOutput> {
    return this.getTicketsByDraw.execute({
      requesterId: user.id,
      requesterRole: user.role,
      salePointId: query.salePointId,
      gameId: query.gameId,
      sellerId: query.sellerId,
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
    });
  }

  @Get('sales-by-number')
  salesByNumber(
    @CurrentUser() user: RequestUser,
    @Query() query: SalesByNumberQueryDto,
  ): Promise<SalesByNumberOutput> {
    return this.getSalesByNumber.execute({
      requesterId: user.id,
      requesterRole: user.role,
      salePointId: query.salePointId,
      gameId: query.gameId,
      sellerId: query.sellerId,
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
    });
  }

  @Get('winners')
  listWinners(
    @CurrentUser() user: RequestUser,
    @Query() query: ListWinnersQueryDto,
  ): Promise<WinningTicketOutput[]> {
    return this.listWinningTickets.execute({
      requesterId: user.id,
      requesterRole: user.role,
      salePointId: query.salePointId,
      gameId: query.gameId,
      sellerId: query.sellerId,
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
      drawTime: query.drawTime,
      search: query.search,
    });
  }

  @Get('folio/:folio')
  findByFolio(
    @CurrentUser() user: RequestUser,
    @Param('folio') folio: string,
  ): Promise<TicketOutput> {
    return this.findTicketByFolio.execute({
      folio,
      requesterId: user.id,
      requesterRole: user.role,
    });
  }

  @Get(':id/evaluation')
  evaluate(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<EvaluateTicketByIdOutput> {
    return this.evaluateTicketById.execute(id);
  }

  /**
   * Lookup por ID sin restricción de dueño — usado por el escáner del móvil
   * para permitir a los vendedores escanear boletos de compañeros de sucursal
   * o de días pasados (replicar boletos). Se requiere el ID exacto (llega
   * por QR físico), lo que mantiene bajo el riesgo de acceso indebido.
   */
  @Get(':id/scan')
  findOneForScan(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<TicketOutput> {
    return this.findTicketByIdForScan.execute({ id });
  }

  @Get(':id')
  findOne(
    @CurrentUser() user: RequestUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<TicketOutput> {
    return this.findTicketById.execute({
      id,
      requesterId: user.id,
      requesterRole: user.role,
    });
  }

  @Post(':id/void')
  voidTicket(
    @CurrentUser() user: RequestUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: VoidTicketHttpDto,
  ): Promise<TicketOutput> {
    return this.voidTicketUseCase.execute({
      id,
      reason: dto.reason ?? null,
      requesterId: user.id,
      requesterRole: user.role,
    });
  }
}
