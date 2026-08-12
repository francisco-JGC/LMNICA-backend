import { randomUUID } from 'crypto';

import { AggregateRoot } from '../../../../shared/domain/aggregate-root';
import { ValidationError } from '../../../../shared/domain/errors/domain.error';

export interface SaleLimitBySellerNumberProps {
  salePointId: string;
  sellerId: string;
  gameId: string;
  label: string;
  amount: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Cuota por vendedor de un número, dentro del tope de sucursal. El partner
 * (o admin) reparte el `sale_limits_by_number.amount` entre los vendedores
 * de la sucursal. Sellers sin cuota específica caen al pool común.
 */
export class SaleLimitBySellerNumber extends AggregateRoot<SaleLimitBySellerNumberProps> {
  private constructor(id: string, props: SaleLimitBySellerNumberProps) {
    super(id, props);
  }

  static create(input: {
    salePointId: string;
    sellerId: string;
    gameId: string;
    label: string;
    amount: number;
  }): SaleLimitBySellerNumber {
    SaleLimitBySellerNumber.assertValid(input.label, input.amount);
    const now = new Date();
    return new SaleLimitBySellerNumber(randomUUID(), {
      salePointId: input.salePointId,
      sellerId: input.sellerId,
      gameId: input.gameId,
      label: input.label.trim(),
      amount: input.amount,
      createdAt: now,
      updatedAt: now,
    });
  }

  static restore(
    id: string,
    props: SaleLimitBySellerNumberProps,
  ): SaleLimitBySellerNumber {
    return new SaleLimitBySellerNumber(id, props);
  }

  setAmount(amount: number): void {
    SaleLimitBySellerNumber.assertAmount(amount);
    this.props.amount = amount;
    this.props.updatedAt = new Date();
  }

  get salePointId(): string {
    return this.props.salePointId;
  }
  get sellerId(): string {
    return this.props.sellerId;
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
    SaleLimitBySellerNumber.assertAmount(amount);
  }

  private static assertAmount(amount: number): void {
    if (!Number.isInteger(amount) || amount <= 0) {
      throw new ValidationError('amount must be a positive integer');
    }
  }
}
