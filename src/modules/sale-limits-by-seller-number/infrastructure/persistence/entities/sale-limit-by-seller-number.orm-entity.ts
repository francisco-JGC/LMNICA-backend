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
import { UserOrmEntity } from '../../../../users/infrastructure/persistence/entities/user.orm-entity';

@Entity({ name: 'sale_limits_by_seller_number' })
@Unique('UQ_slbsn_seller_game_label', ['sellerId', 'gameId', 'label'])
@Index('IDX_slbsn_sp_game_label', ['salePointId', 'gameId', 'label'])
export class SaleLimitBySellerNumberOrmEntity {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @Column({ type: 'uuid', name: 'sale_point_id' })
  salePointId!: string;

  @ManyToOne(() => SalePointOrmEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sale_point_id' })
  salePoint?: SalePointOrmEntity;

  @Index()
  @Column({ type: 'uuid', name: 'seller_id' })
  sellerId!: string;

  @ManyToOne(() => UserOrmEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'seller_id' })
  seller?: UserOrmEntity;

  @Column({ type: 'uuid', name: 'game_id' })
  gameId!: string;

  @ManyToOne(() => GameOrmEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'game_id' })
  game?: GameOrmEntity;

  @Column({ type: 'varchar', length: 40 })
  label!: string;

  @Column({ type: 'integer' })
  amount!: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
