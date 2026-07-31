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

import { UserOrmEntity } from '../../../../users/infrastructure/persistence/entities/user.orm-entity';

@Entity({ name: 'sale_points' })
export class SalePointOrmEntity {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @Column({ type: 'varchar', length: 120 })
  name!: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 30 })
  code!: string;

  @Index()
  @Column({ type: 'uuid', name: 'owner_partner_id', nullable: true })
  ownerPartnerId!: string | null;

  @ManyToOne(() => UserOrmEntity, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'owner_partner_id' })
  ownerPartner?: UserOrmEntity | null;

  @Column({
    type: 'smallint',
    name: 'partner_payment_percentage',
    nullable: true,
  })
  partnerPaymentPercentage!: number | null;

  @Column({ type: 'boolean', name: 'is_active', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
