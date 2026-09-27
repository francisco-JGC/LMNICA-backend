import { UserRole } from '../../domain/value-objects/user-role';

export interface UpdateUserInput {
  id: string;
  username?: string;
  name?: string;
  role?: UserRole;
  isActive?: boolean;
  /** New plaintext password. Skipped if undefined. */
  password?: string;
  /** `null` clears the value; `undefined` leaves it untouched. */
  phone?: string | null;
  address?: string | null;
  nationalId?: string | null;
  paymentPercentage?: number | null;
  salePointId?: string | null;
  /** Auth context — set by the controller from the JWT. */
  requesterId: string;
  requesterRole: UserRole;
}
