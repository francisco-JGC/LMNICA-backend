import { randomUUID } from 'crypto';

import { AggregateRoot } from '../../../../shared/domain/aggregate-root';

export interface SalePointProps {
  name: string;
  code: string;
  /**
   * `users.id` of the partner (socio) that owns this sucursal. `null`
   * means the main admin/owner is the direct operator — those sucursales
   * are only visible to admins.
   */
  ownerPartnerId: string | null;
  /**
   * % de las ventas semanales de esta sucursal que se le paga al
   * `ownerPartnerId` como pago semanal. `null` = sin pago configurado.
   * Rango válido: 0–100 entero. Los "socios asignados" (visibilidad
   * read-only) no cobran — solo el encargado.
   */
  partnerPaymentPercentage: number | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class SalePoint extends AggregateRoot<SalePointProps> {
  private constructor(id: string, props: SalePointProps) {
    super(id, props);
  }

  static create(input: {
    name: string;
    code: string;
    ownerPartnerId: string | null;
    partnerPaymentPercentage?: number | null;
  }): SalePoint {
    validatePercentage(input.partnerPaymentPercentage ?? null);
    const now = new Date();
    return new SalePoint(randomUUID(), {
      name: input.name,
      code: input.code,
      ownerPartnerId: input.ownerPartnerId,
      partnerPaymentPercentage: input.partnerPaymentPercentage ?? null,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
  }

  static restore(id: string, props: SalePointProps): SalePoint {
    return new SalePoint(id, props);
  }

  get name(): string {
    return this.props.name;
  }

  get code(): string {
    return this.props.code;
  }

  get ownerPartnerId(): string | null {
    return this.props.ownerPartnerId;
  }

  get partnerPaymentPercentage(): number | null {
    return this.props.partnerPaymentPercentage;
  }

  get isActive(): boolean {
    return this.props.isActive;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  activate(): void {
    this.props.isActive = true;
    this.props.updatedAt = new Date();
  }

  deactivate(): void {
    this.props.isActive = false;
    this.props.updatedAt = new Date();
  }

  reassignPartner(newOwnerPartnerId: string | null): void {
    this.props.ownerPartnerId = newOwnerPartnerId;
    this.props.updatedAt = new Date();
  }

  update(patch: {
    name?: string;
    code?: string;
    ownerPartnerId?: string | null;
    partnerPaymentPercentage?: number | null;
  }): void {
    if (patch.name !== undefined) this.props.name = patch.name;
    if (patch.code !== undefined) this.props.code = patch.code;
    if (patch.ownerPartnerId !== undefined) {
      this.props.ownerPartnerId = patch.ownerPartnerId;
    }
    if (patch.partnerPaymentPercentage !== undefined) {
      validatePercentage(patch.partnerPaymentPercentage);
      this.props.partnerPaymentPercentage = patch.partnerPaymentPercentage;
    }
    this.props.updatedAt = new Date();
  }
}

function validatePercentage(value: number | null): void {
  if (value === null) return;
  if (!Number.isInteger(value) || value < 0 || value > 100) {
    throw new Error(
      `partnerPaymentPercentage must be an integer between 0 and 100 (got ${value})`,
    );
  }
}
