import type { GameType } from '../../domain/value-objects/game-type';

export interface CreateGameApplicationInput {
  slug: string;
  name: string;
  type: GameType;
  exactMultiplier: number | null;
  easyMultiplier: number | null;
  pairEasyMultiplier: number | null;
  imagePath: string | null;
  orderIndex: number;
}
