import { User } from '../../domain/entities/user.entity';
import { UserRole } from '../../domain/value-objects/user-role';

export interface UserOutput {
  id: string;
  username: string;
  name: string;
  role: UserRole;
  isActive: boolean;
  phone: string | null;
  address: string | null;
  nationalId: string | null;
  paymentPercentage: number | null;
  salePointId: string | null;
  mobileSalesEnabled: boolean;
  defaultSalePointId: string | null;
  createdById: string | null;
  createdByName: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export const toUserOutput = (
  user: User,
  createdByName: string | null = null,
): UserOutput => ({
  id: user.id,
  username: user.username,
  name: user.name,
  role: user.role,
  isActive: user.isActive,
  phone: user.phone,
  address: user.address,
  nationalId: user.nationalId,
  paymentPercentage: user.paymentPercentage,
  salePointId: user.salePointId,
  mobileSalesEnabled: user.mobileSalesEnabled,
  defaultSalePointId: user.defaultSalePointId,
  createdById: user.createdById,
  createdByName,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});
