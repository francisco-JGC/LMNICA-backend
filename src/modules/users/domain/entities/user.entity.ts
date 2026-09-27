import { randomUUID } from 'crypto';

import { AggregateRoot } from '../../../../shared/domain/aggregate-root';
import { UserRole } from '../value-objects/user-role';

export interface UserProps {
  username: string;
  hashedPassword: string;
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
  createdAt: Date;
  updatedAt: Date;
}

export class User extends AggregateRoot<UserProps> {
  private constructor(id: string, props: UserProps) {
    super(id, props);
  }

  static create(input: {
    username: string;
    hashedPassword: string;
    name: string;
    role: UserRole;
    phone?: string | null;
    address?: string | null;
    nationalId?: string | null;
    paymentPercentage?: number | null;
    salePointId?: string | null;
    createdById?: string | null;
  }): User {
    const now = new Date();
    return new User(randomUUID(), {
      username: input.username,
      hashedPassword: input.hashedPassword,
      name: input.name,
      role: input.role,
      isActive: true,
      phone: input.phone ?? null,
      address: input.address ?? null,
      nationalId: input.nationalId ?? null,
      paymentPercentage: input.paymentPercentage ?? null,
      salePointId: input.salePointId ?? null,
      mobileSalesEnabled: false,
      defaultSalePointId: null,
      createdById: input.createdById ?? null,
      createdAt: now,
      updatedAt: now,
    });
  }

  update(patch: {
    username?: string;
    name?: string;
    role?: UserRole;
    isActive?: boolean;
    phone?: string | null;
    address?: string | null;
    nationalId?: string | null;
    paymentPercentage?: number | null;
    salePointId?: string | null;
    mobileSalesEnabled?: boolean;
    defaultSalePointId?: string | null;
    hashedPassword?: string;
  }): void {
    if (patch.username !== undefined) this.props.username = patch.username;
    if (patch.name !== undefined) this.props.name = patch.name;
    if (patch.role !== undefined) this.props.role = patch.role;
    if (patch.isActive !== undefined) this.props.isActive = patch.isActive;
    if (patch.phone !== undefined) this.props.phone = patch.phone;
    if (patch.address !== undefined) this.props.address = patch.address;
    if (patch.nationalId !== undefined)
      this.props.nationalId = patch.nationalId;
    if (patch.paymentPercentage !== undefined)
      this.props.paymentPercentage = patch.paymentPercentage;
    if (patch.salePointId !== undefined)
      this.props.salePointId = patch.salePointId;
    if (patch.mobileSalesEnabled !== undefined)
      this.props.mobileSalesEnabled = patch.mobileSalesEnabled;
    if (patch.defaultSalePointId !== undefined)
      this.props.defaultSalePointId = patch.defaultSalePointId;
    if (patch.hashedPassword !== undefined)
      this.props.hashedPassword = patch.hashedPassword;
    this.props.updatedAt = new Date();
  }

  static restore(id: string, props: UserProps): User {
    return new User(id, props);
  }

  get username(): string {
    return this.props.username;
  }

  get name(): string {
    return this.props.name;
  }

  get role(): UserRole {
    return this.props.role;
  }

  get hashedPassword(): string {
    return this.props.hashedPassword;
  }

  get isActive(): boolean {
    return this.props.isActive;
  }

  get phone(): string | null {
    return this.props.phone;
  }

  get address(): string | null {
    return this.props.address;
  }

  get nationalId(): string | null {
    return this.props.nationalId;
  }

  get paymentPercentage(): number | null {
    return this.props.paymentPercentage;
  }

  get salePointId(): string | null {
    return this.props.salePointId;
  }

  get mobileSalesEnabled(): boolean {
    return this.props.mobileSalesEnabled;
  }

  get defaultSalePointId(): string | null {
    return this.props.defaultSalePointId;
  }

  get createdById(): string | null {
    return this.props.createdById;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }
}
