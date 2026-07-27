import { randomUUID } from 'crypto';

import { AggregateRoot } from '../../../../shared/domain/aggregate-root';
import { ValidationError } from '../../../../shared/domain/errors/domain.error';
import { GameType } from '../value-objects/game-type';

export interface GameProps {
  slug: string;
  name: string;
  type: GameType;
  exactMultiplier: number | null;
  easyMultiplier: number | null;
  /**
   * Multiplicador para el "premio par en fácil": aplica cuando el ticket
   * gana por fácil (mismos dígitos, distinto orden) Y el número ganador
   * tiene dígitos repetidos (100, 010, 122, etc.). Solo THREE_DIGIT puede
   * tenerlo. Nullable en THREE_DIGIT también — cuando es null la regla no
   * se dispara y el fácil paga el `easyMultiplier` estándar.
   */
  pairEasyMultiplier: number | null;
  imagePath: string | null;
  orderIndex: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateGameInput {
  slug: string;
  name: string;
  type: GameType;
  exactMultiplier: number | null;
  easyMultiplier: number | null;
  pairEasyMultiplier: number | null;
  imagePath: string | null;
  orderIndex: number;
}

export interface UpdateGameInput {
  name?: string;
  exactMultiplier?: number | null;
  easyMultiplier?: number | null;
  pairEasyMultiplier?: number | null;
  imagePath?: string | null;
  orderIndex?: number;
}

export class Game extends AggregateRoot<GameProps> {
  private constructor(id: string, props: GameProps) {
    super(id, props);
  }

  static create(input: CreateGameInput): Game {
    Game.assertMultipliersMatchType(
      input.slug,
      input.type,
      input.exactMultiplier,
      input.easyMultiplier,
      input.pairEasyMultiplier,
    );
    const now = new Date();
    return new Game(randomUUID(), {
      slug: input.slug,
      name: input.name,
      type: input.type,
      exactMultiplier: input.exactMultiplier,
      easyMultiplier: input.easyMultiplier,
      pairEasyMultiplier: input.pairEasyMultiplier,
      imagePath: input.imagePath,
      orderIndex: input.orderIndex,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
  }

  static restore(id: string, props: GameProps): Game {
    return new Game(id, props);
  }

  get slug(): string {
    return this.props.slug;
  }

  get name(): string {
    return this.props.name;
  }

  get type(): GameType {
    return this.props.type;
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

  get imagePath(): string | null {
    return this.props.imagePath;
  }

  get orderIndex(): number {
    return this.props.orderIndex;
  }

  get isActive(): boolean {
    return this.props.isActive;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  update(input: UpdateGameInput): void {
    const nextMain = input.exactMultiplier ?? this.props.exactMultiplier;
    const nextSecondary =
      input.easyMultiplier ?? this.props.easyMultiplier;
    // `pairEasyMultiplier` allows explicit null to clear it. `undefined`
    // means "leave alone", `null` means "unset". Same pattern as other
    // nullable update fields on this entity.
    const nextPair =
      input.pairEasyMultiplier === undefined
        ? this.props.pairEasyMultiplier
        : input.pairEasyMultiplier;

    Game.assertMultipliersMatchType(
      this.props.slug,
      this.props.type,
      nextMain,
      nextSecondary,
      nextPair,
    );

    if (input.name !== undefined) this.props.name = input.name;
    if (input.imagePath !== undefined) this.props.imagePath = input.imagePath;
    if (input.orderIndex !== undefined) this.props.orderIndex = input.orderIndex;
    this.props.exactMultiplier = nextMain;
    this.props.easyMultiplier = nextSecondary;
    this.props.pairEasyMultiplier = nextPair;
    this.props.updatedAt = new Date();
  }

  activate(): void {
    this.props.isActive = true;
    this.props.updatedAt = new Date();
  }

  deactivate(): void {
    this.props.isActive = false;
    this.props.updatedAt = new Date();
  }

  /** Slug del único juego que hoy tiene la regla "premio par en fácil". */
  private static readonly PAIR_EASY_SLUG = 'juega3';

  private static assertMultipliersMatchType(
    slug: string,
    type: GameType,
    main: number | null,
    secondary: number | null,
    pair: number | null,
  ): void {
    const requiresMain = type !== GameType.MULTI_SORTEO;
    const requiresSecondary = type === GameType.THREE_DIGIT;
    // El multiplicador par es específico de Juega 3 por decisión de negocio.
    // Aunque Gana 3 y Tresmonazo también son THREE_DIGIT y podrían soportar
    // la regla técnicamente, no aplica ahí — si en el futuro se quiere
    // habilitar para otro juego, se agrega el slug acá.
    const allowsPair = slug === Game.PAIR_EASY_SLUG;

    if (requiresMain && (main === null || main <= 0)) {
      throw new ValidationError(
        `Game type "${type}" requires a positive exactMultiplier`,
      );
    }
    if (!requiresMain && main !== null) {
      throw new ValidationError(
        `Game type "${type}" must not define a exactMultiplier`,
      );
    }
    if (requiresSecondary && (secondary === null || secondary <= 0)) {
      throw new ValidationError(
        `Game type "${type}" requires a positive easyMultiplier`,
      );
    }
    if (!requiresSecondary && secondary !== null) {
      throw new ValidationError(
        `Game type "${type}" must not define a easyMultiplier`,
      );
    }
    if (!allowsPair && pair !== null) {
      throw new ValidationError(
        `Game "${slug}" must not define a pairEasyMultiplier`,
      );
    }
    if (allowsPair && pair !== null && pair <= 0) {
      throw new ValidationError(
        `pairEasyMultiplier must be positive when set`,
      );
    }
  }
}
