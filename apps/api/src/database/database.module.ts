import { Global, Inject, Module, OnApplicationShutdown } from '@nestjs/common';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { ENV, Env } from '../config/env';
import * as schema from './schema';

export type Database = NodePgDatabase<typeof schema>;
/** A transaction handle has the same query API as the database. */
export type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];
export type DbOrTx = Database | Tx;

export const DB = Symbol('DB');
export const PG_POOL = Symbol('PG_POOL');

export function createPool(env: Pick<Env, 'DATABASE_URL' | 'DATABASE_POOL_MAX'>): Pool {
  return new Pool({
    connectionString: env.DATABASE_URL,
    max: env.DATABASE_POOL_MAX,
    idleTimeoutMillis: 30_000,
    statement_timeout: 30_000,
    application_name: 'cdms-api',
  });
}

@Global()
@Module({
  providers: [
    { provide: PG_POOL, inject: [ENV], useFactory: (env: Env) => createPool(env) },
    { provide: DB, inject: [PG_POOL], useFactory: (pool: Pool) => drizzle(pool, { schema }) },
  ],
  exports: [DB, PG_POOL],
})
export class DatabaseModule implements OnApplicationShutdown {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}
  async onApplicationShutdown() {
    await this.pool.end();
  }
}
