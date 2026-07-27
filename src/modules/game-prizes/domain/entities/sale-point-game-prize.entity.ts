import { randomUUID } from 'crypto';

import { AggregateRoot } from '../../../../shared/domain/aggregate-root';
import { ValidationError } from '../../../../shared/domain/errors/domain.error';

export interface SalePointGamePrizeProps {
  salePointId: string;
  gameId: string;
  /** Overrides `games.exact_multiplier`. Null = inherit game default. */
  exactMultiplier: number | null;
  /** Overrides `games.easy_multiplier`. Null = inherit game default. */
  easyMultiplier: number | null;
  /**
   * Overrides `games.pair_easy_multiplier` (premio par en fácil, solo THREE_DIGIT).
   * Null = inherit game default.
   */
  pairEasyMultiplier: number | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Per-`(sale_point, game)` payout override. Absence of a row means "use the
 * game's default multipliers"; each field on a row is independently
 * nullable so operators can override just one side and inherit the other.
 */
export class SalePointGamePrize extends AggregateRoot<SalePointGamePrizeProps> {
  private constructor(id: string, props: SalePointGamePrizeProps) {
    super(id, props);
  }

  static create(input: {
    salePointId: string;
    gameId: string;
    exactMultiplier: number | null;
    easyMultiplier: number | null;
    pairEasyMultiplier: number | null;
  }): SalePointGamePrize {
    SalePointGamePrize.assertMultiplier(input.exactMultiplier, 'exact');
    SalePointGamePrize.assertMultiplier(input.easyMultiplier, 'easy');
    SalePointGamePrize.assertMultiplier(input.pairEasyMultiplier, 'pairEasy');
    const now = new Date();
    return new SalePointGamePrize(randomUUID(), {
      salePointId: input.salePointId,
      gameId: input.gameId,
      exactMultiplier: input.exactMultiplier,
      easyMultiplier: input.easyMultiplier,
      pairEasyMultiplier: input.pairEasyMultiplier,
      createdAt: now,
      updatedAt: now,
    });
  }

  static restore(id: string, props: SalePointGamePrizeProps): SalePointGamePrize {
    return new SalePointGamePrize(id, props);
  }

  updateMultipliers(
    exactMultiplier: number | null,
    easyMultiplier: number | null,
    pairEasyMultiplier: number | null,
  ): void {
    SalePointGamePrize.assertMultiplier(exactMultiplier, 'exact');
    SalePointGamePrize.assertMultiplier(easyMultiplier, 'easy');
    SalePointGamePrize.assertMultiplier(pairEasyMultiplier, 'pairEasy');
    this.props.exactMultiplier = exactMultiplier;
    this.props.easyMultiplier = easyMultiplier;
    this.props.pairEasyMultiplier = pairEasyMultiplier;
    this.props.updatedAt = new Date();
  }

  /** True when all overrides are cleared — caller should delete the row. */
  get isEmpty(): boolean {
    return (
      this.exactMultiplier === null &&
      this.easyMultiplier === null &&
      this.pairEasyMultiplier === null
    );
  }

  get salePointId(): string {
    return this.props.salePointId;
  }

  get gameId(): string {
    return this.props.gameId;
  }

  get exactMultiplier(): number | null {
    return this.props.exactMultiplier;
  }

  get easyMultiplier(): number | null {
    return this.props.easyMultiplier;
  }

  get pairEasyMultiplier(): number | null {
    return this.props.pairEasyMultiplier;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  private static assertMultiplier(
    value: number | null,
    label: 'exact' | 'easy' | 'pairEasy',
  ): void {
    if (value === null) return;
    if (!Number.isInteger(value) || value < 0) {
      throw new ValidationError(
        `${label} multiplier must be a non-negative integer`,
      );
    }
  }
}
