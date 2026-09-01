import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

import { SalePointOrmEntity } from '../../../../sale-points/infrastructure/persistence/entities/sale-point.orm-entity';
import { UserOrmEntity } from '../../../../users/infrastructure/persistence/entities/user.orm-entity';
import { MovementType } from '../../../domain/value-objects/movement-type';

@Entity({ name: 'movements' })
export class MovementOrmEntity {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @Index()
  @Column({ type: 'uuid', name: 'sale_point_id', nullable: true })
  salePointId!: string | null;

  @ManyToOne(() => SalePointOrmEntity, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'sale_point_id' })
  salePoint?: SalePointOrmEntity | null;

  @Index()
  @Column({ type: 'varchar', length: 20 })
  type!: MovementType;

  @Column({ type: 'integer' })
  amount!: number;

  @Column({ type: 'varchar', length: 255, default: '' })
  description!: string;

  @Index()
  @Column({ type: 'timestamptz', name: 'occurred_at' })
  occurredAt!: Date;

  @Column({ type: 'uuid', name: 'created_by_id', nullable: true })
  createdById!: string | null;

  @ManyToOne(() => UserOrmEntity, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by_id' })
  createdBy?: UserOrmEntity | null;

  @Index({ where: 'seller_id IS NOT NULL' })
  @Column({ type: 'uuid', name: 'seller_id', nullable: true })
  sellerId!: string | null;

  @ManyToOne(() => UserOrmEntity, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'seller_id' })
  seller?: UserOrmEntity | null;

  @Column({ type: 'boolean', name: 'is_prize_payment', default: false })
  isPrizePayment!: boolean;

  /**
   * UUID generado por el cliente para dedupear reintentos. Índice UNIQUE
   * parcial (`IDX_movements_client_request_id`) — dos requests con el
   * mismo id devuelven el mismo movement en vez de crear duplicados.
   */
  @Column({ type: 'uuid', name: 'client_request_id', nullable: true })
  clientRequestId!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
