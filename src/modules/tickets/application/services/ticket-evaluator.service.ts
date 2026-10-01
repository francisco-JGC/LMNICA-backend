import { Inject, Injectable } from '@nestjs/common';

import type { DrawResult } from '../../../games/domain/entities/draw-result.entity';
import type { Game } from '../../../games/domain/entities/game.entity';
import {
  DRAW_RESULTS_REPOSITORY,
  type DrawResultsRepository,
} from '../../../games/domain/repositories/draw-results.repository';
import {
  GAMES_REPOSITORY,
  type GamesRepository,
} from '../../../games/domain/repositories/games.repository';
import { GameType } from '../../../games/domain/value-objects/game-type';
import type { Ticket } from '../../domain/entities/ticket.entity';
import type { TicketLine } from '../../domain/value-objects/ticket-line';

export interface TicketLineEvaluation {
  label: string;
  amount: number;
  prize: number;
  wonPrize: number;
  isWinner: boolean;
  winningNumber: string | null;
  subGameId: string | null;
  subGameName: string | null;
}

export interface TicketEvaluation {
  ticketId: string;
  totalPrize: number;
  isWinner: boolean;
  hasPendingDraw: boolean;
  lines: TicketLineEvaluation[];
}

@Injectable()
export class TicketEvaluator {
  constructor(
    @Inject(GAMES_REPOSITORY) private readonly games: GamesRepository,
    @Inject(DRAW_RESULTS_REPOSITORY)
    private readonly results: DrawResultsRepository,
  ) {}

  async evaluate(ticket: Ticket): Promise<TicketEvaluation> {
    const game = await this.games.findById(ticket.gameId);
    const result = game
      ? await this.results.findByGameAndDraw(ticket.gameId, ticket.drawAt)
      : null;
    return this.evaluateWith(ticket, game, result);
  }

  /**
   * Synchronous variant of `evaluate` that takes pre-resolved dependencies.
   * Use this when scoring a batch of tickets to avoid N+1 database queries:
   * fetch games/results in bulk once, then call this per ticket.
   */
  evaluateWith(
    ticket: Ticket,
    game: Game | null,
    result: DrawResult | null,
  ): TicketEvaluation {
    if (!game || game.type === GameType.MULTI_SORTEO) {
      // Tickets are never created against MULTI_SORTEO games anymore.
      // If we ever encounter one, treat it as pending.
      return this.pending(ticket);
    }
    if (!result) return this.pending(ticket);

    const lines = ticket.lines.map((line) =>
      this.evaluateLine(line, game.type, result.winningNumber),
    );
    return this.assemble(ticket.id, lines);
  }

  private evaluateLine(
    line: TicketLine,
    gameType: GameType,
    winningNumber: string,
  ): TicketLineEvaluation {
    const isWinner = this.isMatch(gameType, line.label, winningNumber);
    const wonPrize = isWinner
      ? this.resolvePrize(line, gameType, winningNumber)
      : 0;
    return {
      label: line.label,
      amount: line.amount,
      prize: line.prize,
      wonPrize,
      isWinner,
      winningNumber,
      subGameId: line.subGameId,
      subGameName: line.subGameName,
    };
  }

  /**
   * Regla "premio par": para THREE_DIGIT, si la línea gana por fácil Y el
   * número ganador tiene dígitos repetidos, se paga el snapshot
   * `line.pairEasyPrize` (que la caja precalculó con el multiplicador
   * `pair_easy_multiplier` efectivo de la sucursal). Si el snapshot no
   * existe — cliente viejo o sucursal sin multiplicador par configurado —
   * cae al `line.prize` estándar sin romper.
   */
  private resolvePrize(
    line: TicketLine,
    gameType: GameType,
    winningNumber: string,
  ): number {
    if (gameType !== GameType.THREE_DIGIT) return line.prize;
    const isFalso = /\(F\)/i.test(line.label);
    if (!isFalso) return line.prize;
    if (line.pairEasyPrize === null) return line.prize;
    if (!this.hasRepeatedDigits(winningNumber)) return line.prize;
    return line.pairEasyPrize;
  }

  private hasRepeatedDigits(value: string): boolean {
    return new Set(value.split('')).size < value.length;
  }

  private isMatch(
    gameType: GameType,
    label: string,
    winningNumber: string,
  ): boolean {
    switch (gameType) {
      case GameType.REGULAR:
      case GameType.FOUR_DIGIT:
        return this.normalizeLabel(label) === winningNumber.toLowerCase();
      case GameType.DATE:
        // El label del boleto usa espacio y sin zero-pad ("5 ene") mientras que
        // el winningNumber se almacena con guión y zero-pad ("05-ene"). Ambos
        // lados se normalizan a "day:abbr" (sin separador, sin zero-pad) para
        // que la comparación sea invariante al separador y al padding del día.
        return this.normalizeDateLabel(label) === this.normalizeDateLabel(winningNumber);
      case GameType.THREE_DIGIT: {
        const isFalso = /\(F\)/i.test(label);
        const digits = label.replace(/\(F\)/i, '').trim();
        if (isFalso) {
          return this.sortDigits(digits) === this.sortDigits(winningNumber);
        }
        return digits === winningNumber;
      }
      case GameType.MULTI_SORTEO:
        return false;
    }
  }

  private normalizeLabel(label: string): string {
    return label.replace(/\(F\)/i, '').trim().toLowerCase();
  }

  private normalizeDateLabel(value: string): string {
    // Acepta "15 ene", "15-ene", "05-ene", "5/ene" — cualquier separador.
    // Devuelve "15:ene" (día sin zero-pad + ":" + abreviatura) para comparar
    // sin que importe el separador ni el zero-padding del día.
    const parts = value.trim().toLowerCase().split(/[\s\-\/]+/);
    if (parts.length !== 2) return value.trim().toLowerCase();
    const day = parseInt(parts[0], 10);
    if (isNaN(day)) return value.trim().toLowerCase();
    return `${day}:${parts[1]}`;
  }

  private sortDigits(value: string): string {
    return value.split('').sort().join('');
  }

  private pendingLine(line: TicketLine): TicketLineEvaluation {
    return {
      label: line.label,
      amount: line.amount,
      prize: line.prize,
      wonPrize: 0,
      isWinner: false,
      winningNumber: null,
      subGameId: line.subGameId,
      subGameName: line.subGameName,
    };
  }

  private assemble(
    ticketId: string,
    lines: TicketLineEvaluation[],
  ): TicketEvaluation {
    const totalPrize = lines.reduce((sum, l) => sum + l.wonPrize, 0);
    return {
      ticketId,
      totalPrize,
      isWinner: totalPrize > 0,
      hasPendingDraw: false,
      lines,
    };
  }

  private pending(ticket: Ticket): TicketEvaluation {
    return {
      ticketId: ticket.id,
      totalPrize: 0,
      isWinner: false,
      hasPendingDraw: true,
      lines: ticket.lines.map((line) => this.pendingLine(line)),
    };
  }
}
