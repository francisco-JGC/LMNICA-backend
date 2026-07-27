import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';

import { TicketOrmEntity } from './ticket.orm-entity';

@Entity({ name: 'ticket_lines' })
export class TicketLineOrmEntity {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @Column({ type: 'uuid', name: 'ticket_id' })
  ticketId!: string;

  @ManyToOne(() => TicketOrmEntity, (ticket) => ticket.lines, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'ticket_id' })
  ticket?: TicketOrmEntity;

  @Column({ type: 'varchar', length: 40 })
  label!: string;

  @Column({ type: 'integer' })
  amount!: number;

  @Column({ type: 'integer' })
  prize!: number;

  @Column({ type: 'integer', name: 'pair_easy_prize', nullable: true })
  pairEasyPrize!: number | null;

  @Column({ type: 'varchar', length: 40, name: 'sub_game_id', nullable: true })
  subGameId!: string | null;

  @Column({
    type: 'varchar',
    length: 120,
    name: 'sub_game_name',
    nullable: true,
  })
  subGameName!: string | null;

  @Column({ type: 'integer', name: 'order_index' })
  orderIndex!: number;
}
