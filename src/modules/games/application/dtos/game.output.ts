import type { Game } from '../../domain/entities/game.entity';
import type { GameType } from '../../domain/value-objects/game-type';

export interface GameOutput {
  id: string;
  slug: string;
  name: string;
  type: GameType;
  exactMultiplier: number | null;
  easyMultiplier: number | null;
  /** Only THREE_DIGIT games can have this set; null disables the pair rule. */
  pairEasyMultiplier: number | null;
  imagePath: string | null;
  orderIndex: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export const toGameOutput = (game: Game): GameOutput => ({
  id: game.id,
  slug: game.slug,
  name: game.name,
  type: game.type,
  exactMultiplier: game.exactMultiplier,
  easyMultiplier: game.easyMultiplier,
  pairEasyMultiplier: game.pairEasyMultiplier,
  imagePath: game.imagePath,
  orderIndex: game.orderIndex,
  isActive: game.isActive,
  createdAt: game.createdAt,
  updatedAt: game.updatedAt,
});
