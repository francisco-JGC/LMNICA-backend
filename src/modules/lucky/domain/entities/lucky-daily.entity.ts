import { randomUUID } from 'crypto';

import { AggregateRoot } from '../../../../shared/domain/aggregate-root';
import { ValidationError } from '../../../../shared/domain/errors/domain.error';
import { LuckyKind } from '../value-objects/lucky-kind';

export interface CrossPayload {
  kind: LuckyKind.CROSS;
  // Corners: top-left, top-right, bottom-left, bottom-right
  corners: { tl: number; tr: number; bl: number; br: number };
  // Cardinal (inner) points: north, east, south, west
  inner: { n: number; e: number; s: number; w: number };
  recommended: string[];
}

export type LuckyPayload = CrossPayload;

export interface LuckyDailyProps {
  kind: LuckyKind;
  forDate: Date;
  payload: LuckyPayload;
  createdAt: Date;
}

export interface CreateLuckyDailyInput {
  kind: LuckyKind;
  forDate: Date;
  payload: LuckyPayload;
}

export class LuckyDaily extends AggregateRoot<LuckyDailyProps> {
  private constructor(id: string, props: LuckyDailyProps) {
    super(id, props);
  }

  static create(input: CreateLuckyDailyInput): LuckyDaily {
    if (input.payload.kind !== input.kind) {
      throw new ValidationError(
        'payload kind must match entity kind',
      );
    }
    return new LuckyDaily(randomUUID(), {
      kind: input.kind,
      forDate: input.forDate,
      payload: input.payload,
      createdAt: new Date(),
    });
  }

  static restore(id: string, props: LuckyDailyProps): LuckyDaily {
    return new LuckyDaily(id, props);
  }

  get kind(): LuckyKind {
    return this.props.kind;
  }

  get forDate(): Date {
    return this.props.forDate;
  }

  get payload(): LuckyPayload {
    return this.props.payload;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }
}
