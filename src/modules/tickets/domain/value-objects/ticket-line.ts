import { ValueObject } from '../../../../shared/domain/value-object';

export interface TicketLineProps {
  label: string;
  amount: number;
  prize: number;
  /**
   * Snapshot del premio si esta línea gana por fácil y el número ganador
   * tiene dígitos repetidos ("premio par"). Se calcula al crearse el ticket
   * usando `sale_point_game_prizes.pair_easy_multiplier` efectivo, para
   * congelar la tarifa del momento de la venta.
   *
   * Null → la regla no aplica (juego que no es Juega 3, línea no fácil, o
   * la sucursal no tiene multiplicador par configurado). En ese caso el
   * evaluador cae al `prize` estándar aunque el ganador sea par.
   */
  pairEasyPrize: number | null;
  subGameId: string | null;
  subGameName: string | null;
  orderIndex: number;
}

export class TicketLine extends ValueObject<TicketLineProps> {
  constructor(props: TicketLineProps) {
    super(props);
  }

  get label(): string {
    return this.props.label;
  }

  get amount(): number {
    return this.props.amount;
  }

  get prize(): number {
    return this.props.prize;
  }

  get pairEasyPrize(): number | null {
    return this.props.pairEasyPrize;
  }

  get subGameId(): string | null {
    return this.props.subGameId;
  }

  get subGameName(): string | null {
    return this.props.subGameName;
  }

  get orderIndex(): number {
    return this.props.orderIndex;
  }
}
