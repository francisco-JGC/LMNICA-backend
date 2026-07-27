import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

import { GameOrmEntity } from '../../../../games/infrastructure/persistence/entities/game.orm-entity';
import { SalePointOrmEntity } from '../../../../sale-points/infrastructure/persistence/entities/sale-point.orm-entity';

@Entity({ name: 'sale_point_game_prizes' })
@Unique('UQ_sale_point_game_prizes_sale_point_game', [
  'salePointId',
  'gameId',
])
export class SalePointGamePrizeOrmEntity {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @Index()
  @Column({ type: 'uuid', name: 'sale_point_id' })
  salePointId!: string;

  @ManyToOne(() => SalePointOrmEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sale_point_id' })
  salePoint?: SalePointOrmEntity;

  @Column({ type: 'uuid', name: 'game_id' })
  gameId!: string;

  @ManyToOne(() => GameOrmEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'game_id' })
  game?: GameOrmEntity;

  @Column({ type: 'integer', name: 'exact_multiplier', nullable: true })
  exactMultiplier!: number | null;

  @Column({ type: 'integer', name: 'easy_multiplier', nullable: true })
  easyMultiplier!: number | null;

  @Column({ type: 'integer', name: 'pair_easy_multiplier', nullable: true })
  pairEasyMultiplier!: number | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
