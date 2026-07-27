import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

import { GameType } from '../../../domain/value-objects/game-type';

@Entity({ name: 'games' })
export class GameOrmEntity {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 40 })
  slug!: string;

  @Column({ type: 'varchar', length: 120 })
  name!: string;

  @Column({ type: 'varchar', length: 20 })
  type!: GameType;

  @Column({ type: 'integer', name: 'exact_multiplier', nullable: true })
  exactMultiplier!: number | null;

  @Column({ type: 'integer', name: 'easy_multiplier', nullable: true })
  easyMultiplier!: number | null;

  @Column({ type: 'integer', name: 'pair_easy_multiplier', nullable: true })
  pairEasyMultiplier!: number | null;

  @Column({ type: 'varchar', name: 'image_path', length: 255, nullable: true })
  imagePath!: string | null;

  @Column({ type: 'integer', name: 'order_index', default: 0 })
  orderIndex!: number;

  @Column({ type: 'boolean', name: 'is_active', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
