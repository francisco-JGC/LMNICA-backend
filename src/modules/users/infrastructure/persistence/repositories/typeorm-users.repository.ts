import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, In, type FindOptionsWhere, Repository } from 'typeorm';

import { User } from '../../../domain/entities/user.entity';
import type {
  FindUsersOptions,
  UsersRepository,
} from '../../../domain/repositories/users.repository';
import { UserOrmEntity } from '../entities/user.orm-entity';
import { UserMapper } from '../mappers/user.mapper';

@Injectable()
export class TypeOrmUsersRepository implements UsersRepository {
  constructor(
    @InjectRepository(UserOrmEntity)
    private readonly repo: Repository<UserOrmEntity>,
  ) {}

  async save(user: User): Promise<void> {
    await this.repo.save(UserMapper.toOrm(user));
  }

  async findById(id: string): Promise<User | null> {
    const found = await this.repo.findOne({ where: { id } });
    return found ? UserMapper.toDomain(found) : null;
  }

  async findByUsername(username: string): Promise<User | null> {
    const found = await this.repo.findOne({ where: { username } });
    return found ? UserMapper.toDomain(found) : null;
  }

  async findByIds(ids: string[]): Promise<User[]> {
    if (ids.length === 0) return [];
    const rows = await this.repo.find({ where: { id: In(ids) } });
    return rows.map(UserMapper.toDomain);
  }

  async findMany(options: FindUsersOptions): Promise<User[]> {
    if (options.salePointIds && options.salePointIds.length === 0) return [];
    const rows = await this.repo.find({
      where: this.buildWhere(options),
      order: { createdAt: 'DESC' },
      take: options.limit,
      skip: options.offset,
    });
    return rows.map(UserMapper.toDomain);
  }

  count(
    options: Omit<FindUsersOptions, 'limit' | 'offset'>,
  ): Promise<number> {
    if (options.salePointIds && options.salePointIds.length === 0) {
      return Promise.resolve(0);
    }
    return this.repo.count({
      where: this.buildWhere({ ...options, limit: 0, offset: 0 }),
    });
  }

  countAll(): Promise<number> {
    return this.repo.count();
  }

  async getTransferCounts(
    userId: string,
  ): Promise<{ ticketCount: number; movementCount: number }> {
    const [{ count: tc }]: [{ count: string }] =
      await this.repo.manager.query(
        `SELECT COUNT(*) AS count FROM tickets WHERE seller_id = $1`,
        [userId],
      );
    const [{ count: mc }]: [{ count: string }] =
      await this.repo.manager.query(
        `SELECT COUNT(*) AS count FROM movements WHERE seller_id = $1`,
        [userId],
      );
    return { ticketCount: Number(tc), movementCount: Number(mc) };
  }

  async getSyncCounts(
    userId: string,
    currentSalePointId: string,
  ): Promise<{ ticketCount: number; movementCount: number }> {
    const [{ count: tc }]: [{ count: string }] =
      await this.repo.manager.query(
        `SELECT COUNT(*) AS count FROM tickets WHERE seller_id = $1 AND sale_point_id <> $2`,
        [userId, currentSalePointId],
      );
    // movements.sale_point_id is nullable: IS NULL rows are also out-of-sync
    const [{ count: mc }]: [{ count: string }] =
      await this.repo.manager.query(
        `SELECT COUNT(*) AS count FROM movements
         WHERE seller_id = $1 AND (sale_point_id IS NULL OR sale_point_id <> $2)`,
        [userId, currentSalePointId],
      );
    return { ticketCount: Number(tc), movementCount: Number(mc) };
  }

  async transferBranch(
    userId: string,
    newSalePointId: string,
  ): Promise<{ ticketsMoved: number; movementsMoved: number }> {
    const CHUNK = 500;

    // Update the seller's sale_point_id first so re-runs are idempotent.
    await this.repo.update({ id: userId }, { salePointId: newSalePointId });

    // Tickets: sale_point_id is NOT NULL so <> is always safe.
    let ticketsMoved = 0;
    for (;;) {
      const rows: { id: string }[] = await this.repo.manager.query(
        `UPDATE tickets SET sale_point_id = $1
         WHERE id IN (
           SELECT id FROM tickets
           WHERE seller_id = $2 AND sale_point_id <> $1
           LIMIT $3
         )
         RETURNING id`,
        [newSalePointId, userId, CHUNK],
      );
      ticketsMoved += rows.length;
      if (rows.length < CHUNK) break;
    }

    // Movements: sale_point_id IS nullable — include NULL rows too.
    let movementsMoved = 0;
    for (;;) {
      const rows: { id: string }[] = await this.repo.manager.query(
        `UPDATE movements SET sale_point_id = $1
         WHERE id IN (
           SELECT id FROM movements
           WHERE seller_id = $2
             AND (sale_point_id IS NULL OR sale_point_id <> $1)
           LIMIT $3
         )
         RETURNING id`,
        [newSalePointId, userId, CHUNK],
      );
      movementsMoved += rows.length;
      if (rows.length < CHUNK) break;
    }

    return { ticketsMoved, movementsMoved };
  }

  private buildWhere(
    options: FindUsersOptions,
  ): FindOptionsWhere<UserOrmEntity> | FindOptionsWhere<UserOrmEntity>[] {
    const base: FindOptionsWhere<UserOrmEntity> = {};
    if (options.role) base.role = options.role;
    if (options.salePointIds && options.salePointIds.length > 0) {
      base.salePointId = In(options.salePointIds);
    }
    if (options.createdById) base.createdById = options.createdById;
    const search = options.search?.trim();
    if (!search) return base;
    // Match on either username or display name, case-insensitive.
    return [
      { ...base, name: ILike(`%${search}%`) },
      { ...base, username: ILike(`%${search}%`) },
    ];
  }
}
