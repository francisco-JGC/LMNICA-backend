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

@Entity({ name: 'sale_limits' })
@Unique('UQ_sale_limits_game_sale_point', ['gameId', 'salePointId'])
export class SaleLimitOrmEntity {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @Column({ type: 'uuid', name: 'game_id' })
  gameId!: string;

  @ManyToOne(() => GameOrmEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'game_id' })
  game?: GameOrmEntity;

  @Index()
  @Column({ type: 'uuid', name: 'sale_point_id' })
  salePointId!: string;

  @ManyToOne(() => SalePointOrmEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sale_point_id' })
  salePoint?: SalePointOrmEntity;

  @Column({ type: 'integer' })
  amount!: number;

  @Column({ type: 'integer', name: 'max_per_ticket', nullable: true })
  maxPerTicket!: number | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
