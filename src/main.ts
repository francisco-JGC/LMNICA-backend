import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import compression from 'compression';

import { AppModule } from './app.module';
import type { AppConfig } from './shared/infrastructure/config/env.config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const config = app.get(ConfigService<AppConfig, true>);
  const port = config.get('port', { infer: true });
  const corsOrigins = config.get('corsOrigins', { infer: true });

  // gzip para responses >1KB. Impacto grande en listados de tickets y en el
  // dashboard summary — payloads que van de 50-500KB comprimen 5-10x. Ahorra
  // ancho de banda de Railway y baja el tiempo total del request para el
  // cliente móvil (más importante que el CPU extra de comprimir).
  app.use(compression());

  app.enableCors({
    // Empty list ⇒ reflect the request origin (convenient in dev + when the
    // client is a native mobile app that sends no Origin header). In prod set
    // CORS_ORIGINS to a comma-separated whitelist.
    origin: corsOrigins.length > 0 ? corsOrigins : true,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.setGlobalPrefix('api');

  // Forward SIGTERM (from tini/Railway) to onModuleDestroy hooks so DB pools
  // drain cleanly and in-flight requests get a chance to finish.
  app.enableShutdownHooks();

  // 0.0.0.0 so the container's network namespace routes external requests in;
  // 'localhost' would bind to loopback and be unreachable from outside.
  await app.listen(port, '0.0.0.0');
}

void bootstrap();
