import { randomUUID } from 'crypto';

import { AggregateRoot } from '../../../../shared/domain/aggregate-root';
import { ValidationError } from '../../../../shared/domain/errors/domain.error';

export interface SaleLimitByNumberProps {
  salePointId: string;
  gameId: string;
  /**
   * Etiqueta (label) del ticket line que este tope cubre. Formato depende
   * del juego: `"00"..."99"` para 2 dígitos, `"000"..."999"` para Juega 3,
   * puede incluir `(F)` para fácil, etc. Se compara literal contra
   * `ticket_lines.label` en la enforce logic.
   */
  label: string;
  amount: number;
  createdAt: Date;
  updatedAt: Date;
}

export class SaleLimitByNumber extends AggregateRoot<SaleLimitByNumberProps> {
  private constructor(id: string, props: SaleLimitByNumberProps) {
    super(id, props);
  }

  static create(input: {
    salePointId: string;
    gameId: string;
    label: string;
    amount: number;
  }): SaleLimitByNumber {
    SaleLimitByNumber.assertValid(input.label, input.amount);
    const now = new Date();
    return new SaleLimitByNumber(randomUUID(), {
      salePointId: input.salePointId,
      gameId: input.gameId,
      label: input.label.trim(),
      amount: input.amount,
      createdAt: now,
      updatedAt: now,
    });
  }

  static restore(
    id: string,
    props: SaleLimitByNumberProps,
  ): SaleLimitByNumber {
    return new SaleLimitByNumber(id, props);
  }

  setAmount(amount: number): void {
    SaleLimitByNumber.assertAmount(amount);
    this.props.amount = amount;
    this.props.updatedAt = new Date();
  }

  get salePointId(): string {
    return this.props.salePointId;
  }
  get gameId(): string {
    return this.props.gameId;
  }
  get label(): string {
    return this.props.label;
  }
  get amount(): number {
    return this.props.amount;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  private static assertValid(label: string, amount: number): void {
    if (!label || label.trim().length === 0) {
      throw new ValidationError('label must not be empty');
    }
    if (label.length > 40) {
      throw new ValidationError('label must be at most 40 characters');
    }
    SaleLimitByNumber.assertAmount(amount);
  }

  private static assertAmount(amount: number): void {
    if (!Number.isInteger(amount) || amount <= 0) {
      throw new ValidationError('amount must be a positive integer');
    }
  }
}
