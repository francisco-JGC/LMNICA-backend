import { Inject, Injectable } from '@nestjs/common';

import type { UseCase } from '../../../../shared/application/use-case';
import { NotFoundError } from '../../../../shared/domain/errors/domain.error';
import {
  GAMES_REPOSITORY,
  type GamesRepository,
} from '../../domain/repositories/games.repository';
import { toGameOutput, type GameOutput } from '../dtos/game.output';
import type { UpdateGameApplicationInput } from '../dtos/update-game.input';

@Injectable()
export class UpdateGame implements UseCase<UpdateGameApplicationInput, GameOutput> {
  constructor(
    @Inject(GAMES_REPOSITORY) private readonly games: GamesRepository,
  ) {}

  async execute(input: UpdateGameApplicationInput): Promise<GameOutput> {
    const game = await this.games.findById(input.id);
    if (!game) throw new NotFoundError('Game', input.id);

    game.update({
      name: input.name,
      exactMultiplier: input.exactMultiplier,
      easyMultiplier: input.easyMultiplier,
      pairEasyMultiplier: input.pairEasyMultiplier,
      imagePath: input.imagePath,
      orderIndex: input.orderIndex,
    });

    await this.games.save(game);
    return toGameOutput(game);
  }
}
