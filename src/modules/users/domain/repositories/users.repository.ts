import { User } from '../entities/user.entity';
import { UserRole } from '../value-objects/user-role';

export const USERS_REPOSITORY = Symbol('USERS_REPOSITORY');

export interface FindUsersOptions {
  role?: UserRole;
  search?: string;
  /**
   * Restrict to users whose `sale_point_id` is in this set. Used for
   * partner scoping. Empty array = no rows.
   */
  salePointIds?: string[];
  /**
   * Restrict to users whose `created_by_id` matches. Used for partner
   * scoping where a partner only sees their own recruits.
   */
  createdById?: string;
  isActive?: boolean;
  limit: number;
  offset: number;
}

export interface UsersRepository {
  save(user: User): Promise<void>;
  findById(id: string): Promise<User | null>;
  findByUsername(username: string): Promise<User | null>;
  findMany(options: FindUsersOptions): Promise<User[]>;
  findByIds(ids: string[]): Promise<User[]>;
  count(options: Omit<FindUsersOptions, 'limit' | 'offset'>): Promise<number>;
  countAll(): Promise<number>;
  /** Counts all tickets and movements belonging to a seller. */
  getTransferCounts(
    userId: string,
  ): Promise<{ ticketCount: number; movementCount: number }>;
  /** Counts tickets/movements for a seller that are NOT in their current branch. */
  getSyncCounts(
    userId: string,
    currentSalePointId: string,
  ): Promise<{ ticketCount: number; movementCount: number }>;
  /**
   * Moves all tickets and movements for a seller to the given branch,
   * in idempotent 500-row chunks. Returns the count of records moved.
   */
  transferBranch(
    userId: string,
    newSalePointId: string,
  ): Promise<{ ticketsMoved: number; movementsMoved: number }>;
}
