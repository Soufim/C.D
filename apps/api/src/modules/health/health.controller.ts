import { Controller, Get, Inject, ServiceUnavailableException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { sql } from 'drizzle-orm';
import { Public } from '../../common/auth.decorators';
import { DB, Database } from '../../database/database.module';

/** Liveness and readiness probes for Docker/monitoring. Reveal no internals. */
@ApiTags('health')
@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(@Inject(DB) private readonly db: Database) {}

  @Public()
  @Get('live')
  live() {
    return { status: 'ok' };
  }

  @Public()
  @Get('ready')
  async ready() {
    try {
      await this.db.execute(sql`select 1`);
      return { status: 'ok', database: 'ok' };
    } catch {
      throw new ServiceUnavailableException({ title: 'Not ready', detail: 'Database unavailable' });
    }
  }
}
