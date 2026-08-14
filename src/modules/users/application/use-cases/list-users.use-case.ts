import { Inject, Injectable } from '@nestjs/common';

import type { UseCase } from '../../../../shared/application/use-case';
import { PartnerScopeService } from '../../../sale-points/application/services/partner-scope.service';
import {
  USERS_REPOSITORY,
  type UsersRepository,
} from '../../domain/repositories/users.repository';
import { UserRole } from '../../domain/value-objects/user-role';
import { toUserOutput, type UserOutput } from '../dtos/user.output';

export interface ListUsersInput {
  requesterId: string;
  requesterRole: UserRole;
  role?: UserRole;
  search?: string;
  limit: number;
  offset: number;
}

export interface ListUsersOutput {
  items: UserOutput[];
  total: number;
  limit: number;
  offset: number;
}

@Injectable()
export class ListUsers implements UseCase<ListUsersInput, ListUsersOutput> {
  constructor(
    @Inject(USERS_REPOSITORY) private readonly users: UsersRepository,
    private readonly scope: PartnerScopeService,
  ) {}

  async execute(input: ListUsersInput): Promise<ListUsersOutput> {
    // Partner scoping: los partners ven vendedores que pertenecen a
    // cualquiera de sus sucursales asignadas (por `sale_point_id`), no
    // "usuarios que ellos crearon". Antes el scope era `createdById` y
    // fallaba en el caso típico: sucursales asignadas a un partner cuyos
    // vendedores fueron creados por el ADMIN → el partner no los veía
    // aunque legítimamente le pertenecieran.
    //
    // Admin sin filtro (ve todos). Sellers nunca llegan (rol-gated).
    let salePointIds: string[] | undefined;
    if (input.requesterRole === UserRole.PARTNER) {
      salePointIds = await this.scope.getAccessibleSalePointIds(
        input.requesterId,
        input.requesterRole,
      );
      // Sin sucursales asignadas → array vacío → repo devuelve [] (guard
      // en TypeOrmUsersRepository). Coherente con "no ves nada".
      if (salePointIds.length === 0) {
        return { items: [], total: 0, limit: input.limit, offset: input.offset };
      }
    }

    const filters = {
      role: input.role,
      search: input.search,
      salePointIds,
      limit: input.limit,
      offset: input.offset,
    };

    const [items, total] = await Promise.all([
      this.users.findMany(filters),
      this.users.count({
        role: input.role,
        search: input.search,
        salePointIds,
      }),
    ]);

    // Bulk-resolve creator names to avoid N+1 in the "Creado por" column.
    const creatorIds = Array.from(
      new Set(
        items
          .map((u) => u.createdById)
          .filter((id): id is string => id !== null),
      ),
    );
    const creators = await this.users.findByIds(creatorIds);
    const creatorNameById = new Map(creators.map((c) => [c.id, c.name]));

    return {
      items: items.map((u) =>
        toUserOutput(u, u.createdById ? creatorNameById.get(u.createdById) ?? null : null),
      ),
      total,
      limit: input.limit,
      offset: input.offset,
    };
  }
}
