import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';

import { Roles } from '../../../../auth/infrastructure/http/decorators/roles.decorator';
import { UserRole } from '../../../../users/domain/value-objects/user-role';
import type { GameOutput } from '../../../application/dtos/game.output';
import { CreateGame } from '../../../application/use-cases/create-game.use-case';
import { FindGameBySlug } from '../../../application/use-cases/find-game-by-slug.use-case';
import { ListGames } from '../../../application/use-cases/list-games.use-case';
import { ToggleGame } from '../../../application/use-cases/toggle-game.use-case';
import { UpdateGame } from '../../../application/use-cases/update-game.use-case';
import { CreateGameHttpDto } from '../dtos/create-game-http.dto';
import { ListGamesQueryDto } from '../dtos/list-games-query.dto';
import { ToggleGameHttpDto } from '../dtos/toggle-game-http.dto';
import { UpdateGameHttpDto } from '../dtos/update-game-http.dto';

@Controller('games')
export class GamesController {
  constructor(
    private readonly createGame: CreateGame,
    private readonly listGames: ListGames,
    private readonly findGameBySlug: FindGameBySlug,
    private readonly updateGame: UpdateGame,
    private readonly toggleGame: ToggleGame,
  ) {}

  @Post()
  @Roles(UserRole.ADMIN)
  create(@Body() dto: CreateGameHttpDto): Promise<GameOutput> {
    return this.createGame.execute({
      slug: dto.slug,
      name: dto.name,
      type: dto.type,
      exactMultiplier: dto.exactMultiplier,
      easyMultiplier: dto.easyMultiplier,
      pairEasyMultiplier: dto.pairEasyMultiplier,
      imagePath: dto.imagePath,
      orderIndex: dto.orderIndex,
    });
  }

  @Get()
  list(@Query() query: ListGamesQueryDto): Promise<GameOutput[]> {
    return this.listGames.execute({ onlyActive: query.onlyActive });
  }

  @Get(':slug')
  findOne(@Param('slug') slug: string): Promise<GameOutput> {
    return this.findGameBySlug.execute(slug);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateGameHttpDto,
  ): Promise<GameOutput> {
    return this.updateGame.execute({
      id,
      name: dto.name,
      exactMultiplier: dto.exactMultiplier,
      easyMultiplier: dto.easyMultiplier,
      pairEasyMultiplier: dto.pairEasyMultiplier,
      imagePath: dto.imagePath,
      orderIndex: dto.orderIndex,
    });
  }

  @Patch(':id/toggle')
  @Roles(UserRole.ADMIN)
  toggle(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: ToggleGameHttpDto,
  ): Promise<GameOutput> {
    return this.toggleGame.execute({ id, active: dto.active });
  }
}
