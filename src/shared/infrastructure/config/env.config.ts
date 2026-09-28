import * as Joi from 'joi';

export interface AppConfig {
  nodeEnv: 'development' | 'test' | 'production';
  port: number;
  /**
   * Comma-separated list of allowed CORS origins parsed into an array.
   * Empty ⇒ reflect any origin (dev-friendly). In production always set
   * this to the exact admin-web + mobile deep-link origins.
   */
  corsOrigins: string[];
  database: {
    /** Preferred on hosted Postgres (Railway, Neon, Supabase, etc). */
    url: string | null;
    host: string | null;
    port: number | null;
    user: string | null;
    password: string | null;
    name: string | null;
  };
  jwt: {
    secret: string;
    expiresIn: string;
    refreshExpiresIn: string;
  };
}

/**
 * We validate what's always required. DB connection is accepted either as
 * `DATABASE_URL` or as the split `DB_*` variables — enforced with a custom
 * rule below.
 */
export const envSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
  PORT: Joi.number().integer().default(3000),
  CORS_ORIGINS: Joi.string().allow('').default(''),
  DATABASE_URL: Joi.string().uri({ scheme: ['postgres', 'postgresql'] }).optional(),
  DB_HOST: Joi.string().optional(),
  DB_PORT: Joi.number().integer().optional(),
  DB_USER: Joi.string().optional(),
  DB_PASSWORD: Joi.string().optional(),
  DB_NAME: Joi.string().optional(),
  JWT_SECRET: Joi.string().min(16).required(),
  JWT_EXPIRES_IN: Joi.string().default('24h'),
  JWT_REFRESH_EXPIRES_IN: Joi.string().default('365d'),
}).custom((value, helpers) => {
  const hasUrl = Boolean(value.DATABASE_URL);
  const hasSplit = Boolean(
    value.DB_HOST && value.DB_USER && value.DB_PASSWORD && value.DB_NAME,
  );
  if (!hasUrl && !hasSplit) {
    return helpers.message({
      custom: 'Provide DATABASE_URL, or DB_HOST + DB_USER + DB_PASSWORD + DB_NAME',
    });
  }
  return value;
});

export const envLoader = (): AppConfig => ({
  nodeEnv: process.env.NODE_ENV as AppConfig['nodeEnv'],
  port: Number(process.env.PORT),
  corsOrigins: (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  database: {
    url: process.env.DATABASE_URL ?? null,
    host: process.env.DB_HOST ?? null,
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : null,
    user: process.env.DB_USER ?? null,
    password: process.env.DB_PASSWORD ?? null,
    name: process.env.DB_NAME ?? null,
  },
  jwt: {
    secret: process.env.JWT_SECRET!,
    expiresIn: process.env.JWT_EXPIRES_IN ?? '24h',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '365d',
  },
});
