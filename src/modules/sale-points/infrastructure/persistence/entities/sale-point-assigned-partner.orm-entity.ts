import {
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';

import { UserOrmEntity } from '../../../../users/infrastructure/persistence/entities/user.orm-entity';
import { SalePointOrmEntity } from './sale-point.orm-entity';

@Entity({ name: 'sale_point_assigned_partners' })
export class SalePointAssignedPartnerOrmEntity {
  @PrimaryColumn({ type: 'uuid', name: 'sale_point_id' })
  salePointId!: string;

  @Index()
  @PrimaryColumn({ type: 'uuid', name: 'user_id' })
  userId!: string;

  @CreateDateColumn({ name: 'assigned_at', type: 'timestamptz' })
  assignedAt!: Date;

  @ManyToOne(() => SalePointOrmEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sale_point_id' })
  salePoint?: SalePointOrmEntity;

  @ManyToOne(() => UserOrmEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: UserOrmEntity;
}
