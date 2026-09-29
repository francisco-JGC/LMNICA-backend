import { randomUUID } from 'crypto';

import { AggregateRoot } from '../../../../shared/domain/aggregate-root';
import { ValidationError } from '../../../../shared/domain/errors/domain.error';

export interface SaleLimitProps {
  gameId: string;
  salePointId: string;
  /** Cap in centavos on how much of a single number can be sold per draw. */
  amount: number;
  maxPerTicket: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export class SaleLimit extends AggregateRoot<SaleLimitProps> {
  private constructor(id: string, props: SaleLimitProps) {
    super(id, props);
  }

  static create(input: {
    gameId: string;
    salePointId: string;
    amount: number;
    maxPerTicket?: number | null;
  }): SaleLimit {
    if (!Number.isInteger(input.amount) || input.amount < 0) {
      throw new ValidationError('amount must be a non-negative integer');
    }
    const now = new Date();
    return new SaleLimit(randomUUID(), {
      gameId: input.gameId,
      salePointId: input.salePointId,
      amount: input.amount,
      maxPerTicket: input.maxPerTicket ?? null,
      createdAt: now,
      updatedAt: now,
    });
  }

  static restore(id: string, props: SaleLimitProps): SaleLimit {
    return new SaleLimit(id, props);
  }

  setAmount(amount: number): void {
    if (!Number.isInteger(amount) || amount < 0) {
      throw new ValidationError('amount must be a non-negative integer');
    }
    this.props.amount = amount;
    this.props.updatedAt = new Date();
  }

  setMaxPerTicket(value: number | null): void {
    this.props.maxPerTicket = value;
    this.props.updatedAt = new Date();
  }

  get gameId(): string {
    return this.props.gameId;
  }

  get salePointId(): string {
    return this.props.salePointId;
  }

  get amount(): number {
    return this.props.amount;
  }

  get maxPerTicket(): number | null {
    return this.props.maxPerTicket;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }
}
