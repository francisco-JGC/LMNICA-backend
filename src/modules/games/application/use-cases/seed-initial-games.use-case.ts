import { Inject, Injectable, Logger } from '@nestjs/common';

import { Game } from '../../domain/entities/game.entity';
import {
  GAMES_REPOSITORY,
  type GamesRepository,
} from '../../domain/repositories/games.repository';
import { GameType } from '../../domain/value-objects/game-type';

interface InitialGame {
  slug: string;
  name: string;
  type: GameType;
  exactMultiplier: number | null;
  easyMultiplier: number | null;
  /** Only meaningful for THREE_DIGIT. Null = pair rule disabled for that game. */
  pairEasyMultiplier: number | null;
}

const INITIAL_GAMES: readonly InitialGame[] = [
  { slug: 'diaria', name: 'Diaria', type: GameType.REGULAR, exactMultiplier: 80, easyMultiplier: null, pairEasyMultiplier: null },
  { slug: 'juega3', name: 'Juega 3', type: GameType.THREE_DIGIT, exactMultiplier: 600, easyMultiplier: 100, pairEasyMultiplier: 200 },
  { slug: 'fechas', name: 'Fechas', type: GameType.DATE, exactMultiplier: 200, easyMultiplier: null, pairEasyMultiplier: null },
  { slug: 'combo', name: 'Combo', type: GameType.FOUR_DIGIT, exactMultiplier: 4000, easyMultiplier: null, pairEasyMultiplier: null },
  { slug: 'terminacion2', name: 'Terminación 2', type: GameType.REGULAR, exactMultiplier: 80, easyMultiplier: null, pairEasyMultiplier: null },
  { slug: 'tica', name: 'Tica', type: GameType.REGULAR, exactMultiplier: 80, easyMultiplier: null, pairEasyMultiplier: null },
  { slug: 'tresmonazo', name: 'Tresmonazo', type: GameType.THREE_DIGIT, exactMultiplier: 600, easyMultiplier: 100, pairEasyMultiplier: null },
  { slug: 'hondurena', name: 'Hondureña', type: GameType.REGULAR, exactMultiplier: 80, easyMultiplier: null, pairEasyMultiplier: null },
  { slug: 'gana3', name: 'Gana 3', type: GameType.THREE_DIGIT, exactMultiplier: 600, easyMultiplier: 100, pairEasyMultiplier: null },
  { slug: 'primera', name: 'Primera', type: GameType.REGULAR, exactMultiplier: 80, easyMultiplier: null, pairEasyMultiplier: null },
  { slug: 'salvadorena', name: 'Salvadoreña', type: GameType.REGULAR, exactMultiplier: 80, easyMultiplier: null, pairEasyMultiplier: null },
  { slug: 'rifas', name: 'Rifas', type: GameType.REGULAR, exactMultiplier: 80, easyMultiplier: null, pairEasyMultiplier: null },
  { slug: 'multisorteo', name: 'Multi Sorteo', type: GameType.MULTI_SORTEO, exactMultiplier: null, easyMultiplier: null, pairEasyMultiplier: null },
];

@Injectable()
export class SeedInitialGames {
  private readonly logger = new Logger(SeedInitialGames.name);

  constructor(
    @Inject(GAMES_REPOSITORY) private readonly games: GamesRepository,
  ) {}

  async execute(): Promise<number> {
    const existing = await this.games.count();
    if (existing > 0) return 0;

    for (let i = 0; i < INITIAL_GAMES.length; i++) {
      const template = INITIAL_GAMES[i];
      const game = Game.create({
        slug: template.slug,
        name: template.name,
        type: template.type,
        exactMultiplier: template.exactMultiplier,
        easyMultiplier: template.easyMultiplier,
        pairEasyMultiplier: template.pairEasyMultiplier,
        imagePath: `assets/images/games/${template.slug}.jpeg`,
        orderIndex: i + 1,
      });
      await this.games.save(game);
    }

    this.logger.log(`Seeded ${INITIAL_GAMES.length} initial games`);
    return INITIAL_GAMES.length;
  }
}
