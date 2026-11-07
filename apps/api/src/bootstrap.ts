import { INestApplication, VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { loadEnv } from './config/env';

/** Builds the configured application (shared by main.ts and integration tests). */
export async function createApp(opts: { logger?: boolean } = {}): Promise<INestApplication> {
  const env = loadEnv();
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true, logger: opts.logger === false ? false : undefined });
  if (opts.logger !== false) app.useLogger(app.get(Logger));
  if (env.TRUST_PROXY) app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use(
    helmet({
      contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } },
      crossOriginResourcePolicy: { policy: 'same-site' },
    }),
  );
  app.use(cookieParser());
  app.useBodyParser('json', { limit: '2mb' });
  app.enableCors({ origin: env.CORS_ORIGINS, credentials: true, methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'], maxAge: 600 });
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.enableShutdownHooks();

  if (env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('CDMS API')
      .setDescription('Curriculum Development & Management System — REST API (OpenAPI 3). Errors use RFC 9457 problem+json.')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const doc = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, doc, { jsonDocumentUrl: 'api/docs/openapi.json' });
  }
  return app;
}
