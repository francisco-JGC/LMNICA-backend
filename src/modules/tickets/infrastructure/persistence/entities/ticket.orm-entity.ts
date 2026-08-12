import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

import { GameOrmEntity } from '../../../../games/infrastructure/persistence/entities/game.orm-entity';
import { SalePointOrmEntity } from '../../../../sale-points/infrastructure/persistence/entities/sale-point.orm-entity';
import { UserOrmEntity } from '../../../../users/infrastructure/persistence/entities/user.orm-entity';
import { TicketStatus } from '../../../domain/value-objects/ticket-status';
import { TicketLineOrmEntity } from './ticket-line.orm-entity';

@Entity({ name: 'tickets' })
export class TicketOrmEntity {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 20 })
  folio!: string;

  @Index()
  @Column({ type: 'uuid', name: 'game_id' })
  gameId!: string;

  @ManyToOne(() => GameOrmEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'game_id' })
  game?: GameOrmEntity;

  @Index()
  @Column({ type: 'uuid', name: 'sale_point_id' })
  salePointId!: string;

  @ManyToOne(() => SalePointOrmEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'sale_point_id' })
  salePoint?: SalePointOrmEntity;

  @Index()
  @Column({ type: 'uuid', name: 'seller_id' })
  sellerId!: string;

  @ManyToOne(() => UserOrmEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'seller_id' })
  seller?: UserOrmEntity;

  @Column({ type: 'varchar', length: 120, nullable: true })
  client!: string | null;

  @Column({ type: 'varchar', length: 20 })
  status!: TicketStatus;

  @Column({ type: 'timestamptz', name: 'voided_at', nullable: true })
  voidedAt!: Date | null;

  @Column({ type: 'varchar', length: 255, name: 'voided_reason', nullable: true })
  voidedReason!: string | null;

  @Column({ type: 'integer', default: 0 })
  total!: number;

  @Column({ type: 'integer', name: 'total_prize', default: 0 })
  totalPrize!: number;

  @Index()
  @Column({ type: 'timestamptz', name: 'draw_at' })
  drawAt!: Date;

  @Column({ type: 'integer', name: 'cutoff_minutes', default: 2 })
  cutoffMinutes!: number;

  @Column({ type: 'timestamptz', name: 'paid_at', nullable: true })
  paidAt!: Date | null;

  @Column({ type: 'uuid', name: 'paid_by_id', nullable: true })
  paidById!: string | null;

  @Column({ type: 'integer', name: 'paid_prize', default: 0 })
  paidPrize!: number;

  /**
   * UUID generado por el cliente para dedupear reintentos. Índice UNIQUE
   * parcial en la migración (`IDX_tickets_client_request_id`) — dos
   * requests con el mismo id devuelven el mismo ticket.
   */
  @Column({ type: 'uuid', name: 'client_request_id', nullable: true })
  clientRequestId!: string | null;

  @OneToMany(() => TicketLineOrmEntity, (line) => line.ticket, {
    cascade: true,
    eager: true,
  })
  lines!: TicketLineOrmEntity[];

  @Index()
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
