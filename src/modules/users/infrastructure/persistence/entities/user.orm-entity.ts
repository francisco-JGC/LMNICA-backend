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
import { UserRole } from '../../../domain/value-objects/user-role';

@Entity({ name: 'users' })
export class UserOrmEntity {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 60 })
  username!: string;

  @Column({ type: 'varchar', name: 'hashed_password' })
  hashedPassword!: string;

  @Column({ type: 'varchar', length: 120 })
  name!: string;

  @Column({ type: 'varchar', length: 20 })
  role!: UserRole;

  @Column({ type: 'boolean', name: 'is_active', default: true })
  isActive!: boolean;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  address!: string | null;

  @Column({ type: 'varchar', length: 20, name: 'national_id', nullable: true })
  nationalId!: string | null;

  @Column({ type: 'integer', name: 'payment_percentage', nullable: true })
  paymentPercentage!: number | null;

  @Index()
  @Column({ type: 'uuid', name: 'sale_point_id', nullable: true })
  salePointId!: string | null;

  @ManyToOne(() => SalePointOrmEntity, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'sale_point_id' })
  salePoint?: SalePointOrmEntity | null;

  @Column({ type: 'boolean', name: 'mobile_sales_enabled', default: false })
  mobileSalesEnabled!: boolean;

  @Column({ type: 'uuid', name: 'default_sale_point_id', nullable: true })
  defaultSalePointId!: string | null;

  @ManyToOne(() => SalePointOrmEntity, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'default_sale_point_id' })
  defaultSalePoint?: SalePointOrmEntity | null;

  @Index()
  @Column({ type: 'uuid', name: 'created_by_id', nullable: true })
  createdById!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
