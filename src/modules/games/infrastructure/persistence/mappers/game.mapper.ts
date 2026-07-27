import { Game } from '../../../domain/entities/game.entity';
import { GameOrmEntity } from '../entities/game.orm-entity';

export class GameMapper {
  static toDomain(orm: GameOrmEntity): Game {
    return Game.restore(orm.id, {
      slug: orm.slug,
      name: orm.name,
      type: orm.type,
      exactMultiplier: orm.exactMultiplier,
      easyMultiplier: orm.easyMultiplier,
      pairEasyMultiplier: orm.pairEasyMultiplier,
      imagePath: orm.imagePath,
      orderIndex: orm.orderIndex,
      isActive: orm.isActive,
      createdAt: orm.createdAt,
      updatedAt: orm.updatedAt,
    });
  }

  static toOrm(game: Game): GameOrmEntity {
    const entity = new GameOrmEntity();
    entity.id = game.id;
    entity.slug = game.slug;
    entity.name = game.name;
    entity.type = game.type;
    entity.exactMultiplier = game.exactMultiplier;
    entity.easyMultiplier = game.easyMultiplier;
    entity.pairEasyMultiplier = game.pairEasyMultiplier;
    entity.imagePath = game.imagePath;
    entity.orderIndex = game.orderIndex;
    entity.isActive = game.isActive;
    entity.createdAt = game.createdAt;
    entity.updatedAt = game.updatedAt;
    return entity;
  }
}
