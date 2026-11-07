import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { randomUUID } from 'node:crypto';
import { ConfigModule } from './config/config.module';
import { loadEnv } from './config/env';
import { DatabaseModule } from './database/database.module';
import { ProblemDetailsFilter } from './common/problem-details.filter';
import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { WorkflowModule } from './modules/workflow/workflow.module';
import { InstitutionsModule } from './modules/institutions/institutions.module';
import { ReferenceDataModule } from './modules/reference-data/reference-data.module';
import { FrameworksModule } from './modules/frameworks/frameworks.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { TemplatesModule } from './modules/templates/templates.module';
import { CurriculaModule } from './modules/curricula/curricula.module';
import { AdminModule } from './modules/admin/admin.module';
import { FilesModule } from './modules/files/files.module';
import { ImportExportModule } from './modules/import-export/import-export.module';
import { InsightsModule } from './modules/insights/insights.module';
import { HealthModule } from './modules/health/health.module';

const env = loadEnv();

/**
 * Modular monolith. Platform modules (config, db, auth, audit, workflow, notifications) are
 * global; domain modules depend on them but never on each other's internals except via
 * exported services (see docs/architecture.md → module boundaries).
 */
@Module({
  imports: [
    ConfigModule,
    LoggerModule.forRoot({
      pinoHttp: {
        level: env.LOG_LEVEL,
        genReqId: (req, res) => {
          const id = (req.headers['x-request-id'] as string)?.slice(0, 64) || randomUUID();
          res.setHeader('X-Request-Id', id);
          return id;
        },
        redact: { paths: ['req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]'], censor: '[redacted]' },
        transport: env.NODE_ENV === 'development' ? { target: 'pino-pretty', options: { singleLine: true } } : undefined,
        autoLogging: { ignore: (req) => req.url?.startsWith('/api/v1/health') ?? false },
      },
    }),
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: env.NODE_ENV === 'test' ? 10_000 : 300 }]),
    DatabaseModule,
    AuditModule,
    AuthModule,
    NotificationsModule,
    WorkflowModule,
    InstitutionsModule,
    ReferenceDataModule,
    FrameworksModule,
    CatalogModule,
    TemplatesModule,
    CurriculaModule,
    AdminModule,
    FilesModule,
    ImportExportModule,
    InsightsModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_FILTER, useClass: ProblemDetailsFilter },
  ],
})
export class AppModule {}
