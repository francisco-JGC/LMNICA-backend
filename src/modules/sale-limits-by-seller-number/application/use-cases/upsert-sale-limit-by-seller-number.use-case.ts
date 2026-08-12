import { ForbiddenException, Inject, Injectable } from '@nestjs/common';

import type { UseCase } from '../../../../shared/application/use-case';
import {
  NotFoundError,
  ValidationError,
} from '../../../../shared/domain/errors/domain.error';
import {
  GAMES_REPOSITORY,
  type GamesRepository,
} from '../../../games/domain/repositories/games.repository';
import {
  SALE_LIMITS_BY_NUMBER_REPOSITORY,
  type SaleLimitsByNumberRepository,
} from '../../../sale-limits-by-number/domain/repositories/sale-limits-by-number.repository';
import { PartnerScopeService } from '../../../sale-points/application/services/partner-scope.service';
import {
  SALE_POINTS_REPOSITORY,
  type SalePointsRepository,
} from '../../../sale-points/domain/repositories/sale-points.repository';
import {
  USERS_REPOSITORY,
  type UsersRepository,
} from '../../../users/domain/repositories/users.repository';
import { UserRole } from '../../../users/domain/value-objects/user-role';
import { SaleLimitBySellerNumber } from '../../domain/entities/sale-limit-by-seller-number.entity';
import {
  SALE_LIMITS_BY_SELLER_NUMBER_REPOSITORY,
  type SaleLimitsBySellerNumberRepository,
} from '../../domain/repositories/sale-limits-by-seller-number.repository';
import {
  toSaleLimitBySellerNumberOutput,
  type SaleLimitBySellerNumberOutput,
} from '../dtos/sale-limit-by-seller-number.output';

export interface UpsertSaleLimitBySellerNumberInput {
  requesterId: string;
  requesterRole: UserRole;
  salePointId: string;
  sellerId: string;
  gameId: string;
  label: string;
  amount: number;
}

/**
 * Crea o actualiza la cuota de un vendedor sobre un número. Reglas:
 *   1. Sellers no pueden llamar esto.
 *   2. Partners solo tocan sus sucursales asignadas.
 *   3. El seller destino debe pertenecer a esa misma sucursal.
 *   4. Debe existir un tope de sucursal (`sale_limits_by_number`) para el
 *      mismo `(salePoint, game, label)` — sin tope no tiene sentido repartir.
 *   5. La suma de cuotas de todos los sellers para ese `(sp, game, label)`
 *      no puede exceder el tope. Al actualizar, contamos la propia como
 *      "nuevo valor" (no la vieja) para permitir subir o bajar sin choque.
 */
@Injectable()
export class UpsertSaleLimitBySellerNumber
  implements
    UseCase<
      UpsertSaleLimitBySellerNumberInput,
      SaleLimitBySellerNumberOutput
    >
{
  constructor(
    @Inject(SALE_LIMITS_BY_SELLER_NUMBER_REPOSITORY)
    private readonly repo: SaleLimitsBySellerNumberRepository,
    @Inject(SALE_LIMITS_BY_NUMBER_REPOSITORY)
    private readonly sucursalLimits: SaleLimitsByNumberRepository,
    @Inject(GAMES_REPOSITORY) private readonly games: GamesRepository,
    @Inject(SALE_POINTS_REPOSITORY)
    private readonly salePoints: SalePointsRepository,
    @Inject(USERS_REPOSITORY) private readonly users: UsersRepository,
    private readonly scope: PartnerScopeService,
  ) {}

  async execute(
    input: UpsertSaleLimitBySellerNumberInput,
  ): Promise<SaleLimitBySellerNumberOutput> {
    if (input.requesterRole === UserRole.SELLER) {
      throw new ForbiddenException('Los vendedores no configuran cuotas');
    }

    const game = await this.games.findById(input.gameId);
    if (!game) throw new NotFoundError('Game', input.gameId);

    const salePoint = await this.salePoints.findById(input.salePointId);
    if (!salePoint) throw new NotFoundError('SalePoint', input.salePointId);

    if (input.requesterRole === UserRole.PARTNER) {
      const owned = await this.scope.getAccessibleSalePointIds(
        input.requesterId,
        input.requesterRole,
      );
      if (!owned.includes(input.salePointId)) {
        throw new ForbiddenException('Esa sucursal no te pertenece');
      }
    }

    const seller = await this.users.findById(input.sellerId);
    if (!seller) throw new NotFoundError('User', input.sellerId);
    if (seller.role !== UserRole.SELLER) {
      throw new ValidationError('El destino de la cuota debe ser un vendedor');
    }
    if (seller.salePointId !== input.salePointId) {
      throw new ValidationError('Ese vendedor no pertenece a esta sucursal');
    }

    const label = input.label.trim();

    // Regla clave: tope de sucursal debe existir. Si no, no hay techo bajo
    // el cual repartir — el partner está intentando dividir aire.
    const sucursalLimit = await this.sucursalLimits.findByKey(
      input.salePointId,
      input.gameId,
      label,
    );
    if (!sucursalLimit) {
      throw new ValidationError(
        `Primero el admin debe configurar el tope de la sucursal para el número "${label}".`,
      );
    }

    // Validación de suma: cuotas actuales + nuevo (o delta si existe) ≤ tope.
    const quotas = await this.repo.quotasFor(
      input.salePointId,
      input.gameId,
      label,
    );
    const previous = quotas.get(input.sellerId) ?? 0;
    const sumOthers = Array.from(quotas.entries())
      .filter(([sid]) => sid !== input.sellerId)
      .reduce((acc, [, amt]) => acc + amt, 0);
    const projected = sumOthers + input.amount;
    if (projected > sucursalLimit.amount) {
      const availableExtra = Math.max(
        0,
        sucursalLimit.amount - sumOthers - previous,
      );
      const availableFresh = Math.max(0, sucursalLimit.amount - sumOthers);
      throw new ValidationError(
        `La suma de cuotas superaría el tope de la sucursal (C$${sucursalLimit.amount}). ` +
          `Suma actual de otros vendedores: C$${sumOthers}. ` +
          `Máximo asignable a este vendedor: C$${availableFresh}` +
          (previous > 0 ? ` (subiendo C$${availableExtra} sobre lo actual).` : '.'),
      );
    }

    const existing = await this.repo.findByKey(
      input.sellerId,
      input.gameId,
      label,
    );

    if (existing) {
      existing.setAmount(input.amount);
      await this.repo.save(existing);
      return toSaleLimitBySellerNumberOutput(existing);
    }

    const created = SaleLimitBySellerNumber.create({
      salePointId: input.salePointId,
      sellerId: input.sellerId,
      gameId: input.gameId,
      label,
      amount: input.amount,
    });
    await this.repo.save(created);
    return toSaleLimitBySellerNumberOutput(created);
  }
}
