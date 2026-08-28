import { randomUUID } from 'crypto';

import { AggregateRoot } from '../../../../shared/domain/aggregate-root';
import { ValidationError } from '../../../../shared/domain/errors/domain.error';
import { MovementType } from '../value-objects/movement-type';

export interface MovementProps {
  salePointId: string;
  type: MovementType;
  /** Always non-negative. Sign of contribution is derived from `type`. */
  amount: number;
  description: string;
  occurredAt: Date;
  createdById: string | null;
  /**
   * UUID de idempotencia enviado por el cliente. Ver comentario en
   * `movement.orm-entity.ts`. Legacy movements creados antes del
   * feature son `null`.
   */
  clientRequestId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export class Movement extends AggregateRoot<MovementProps> {
  private constructor(id: string, props: MovementProps) {
    super(id, props);
  }

  static create(input: {
    salePointId: string;
    type: MovementType;
    amount: number;
    description?: string;
    occurredAt?: Date;
    createdById: string | null;
    clientRequestId?: string | null;
  }): Movement {
    if (!Number.isInteger(input.amount) || input.amount < 0) {
      throw new ValidationError('amount must be a non-negative integer');
    }
    const now = new Date();
    return new Movement(randomUUID(), {
      salePointId: input.salePointId,
      type: input.type,
      amount: input.amount,
      description: input.description?.trim() ?? '',
      occurredAt: input.occurredAt ?? now,
      createdById: input.createdById,
      clientRequestId: input.clientRequestId ?? null,
      createdAt: now,
      updatedAt: now,
    });
  }

  static restore(id: string, props: MovementProps): Movement {
    return new Movement(id, props);
  }

  get salePointId(): string {
    return this.props.salePointId;
  }

  get type(): MovementType {
    return this.props.type;
  }

  get amount(): number {
    return this.props.amount;
  }

  get description(): string {
    return this.props.description;
  }

  get occurredAt(): Date {
    return this.props.occurredAt;
  }

  get createdById(): string | null {
    return this.props.createdById;
  }

  get clientRequestId(): string | null {
    return this.props.clientRequestId;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }
}
