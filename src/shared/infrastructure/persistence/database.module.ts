import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule, type TypeOrmModuleOptions } from '@nestjs/typeorm';

import type { AppConfig } from '../config/env.config';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (
        config: ConfigService<AppConfig, true>,
      ): TypeOrmModuleOptions => {
        const db = config.get('database', { infer: true });
        const nodeEnv = config.get('nodeEnv', { infer: true });
        const shared: TypeOrmModuleOptions = {
          type: 'postgres',
          autoLoadEntities: true,
          synchronize: false,
          logging: nodeEnv === 'development' ? ['error', 'warn'] : ['error'],
          // Connection pool tuning (pasa a `pg`). El default de `pg` es 10 —
          // insuficiente bajo carga concurrente: cada request que hace >1
          // query en paralelo compite por el pool y las que llegan cuando
          // está lleno esperan. Con 30 tenemos margen para picos sin llegar
          // al techo típico de Postgres en Railway (100 conexiones default).
          // Si escalás a 3 réplicas: 3 × 30 = 90 conexiones activas, dentro
          // del límite. Si necesitás más réplicas hay que subir el max_connections
          // del Postgres o bajar el pool a 20 por réplica.
          extra: {
            max: 30,
            // Timeouts razonables — si el pool se llena, un cliente espera
            // como mucho 5s antes de fallar rápido en vez de colgar el request.
            connectionTimeoutMillis: 5_000,
            idleTimeoutMillis: 30_000,
          },
        };
        // Hosted Postgres (Railway/Neon/Supabase) — prefer DATABASE_URL + SSL.
        if (db.url) {
          return {
            ...shared,
            url: db.url,
            ssl: { rejectUnauthorized: false },
          };
        }
        return {
          ...shared,
          host: db.host!,
          port: db.port!,
          username: db.user!,
          password: db.password!,
          database: db.name!,
        };
      },
    }),
  ],
})
export class DatabaseModule {}
