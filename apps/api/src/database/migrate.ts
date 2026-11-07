/**
 * Applies pending SQL migrations from ./drizzle in order, inside a transaction, recording them in
 * drizzle.__drizzle_migrations. Safe to run repeatedly. Run before starting a new release.
 */
import path from 'node:path';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { loadEnv } from '../config/env';
import { createPool } from './database.module';

export async function runMigrations(databaseUrl?: string) {
  const env = loadEnv();
  const pool = createPool({ ...env, DATABASE_URL: databaseUrl ?? env.DATABASE_URL });
  try {
    const migrationsFolder = path.resolve(__dirname, '../../drizzle');
    await migrate(drizzle(pool), { migrationsFolder });
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  runMigrations()
    .then(() => {
      console.log('Migrations applied.');
    })
    .catch((err) => {
      console.error('Migration failed:', err);
      process.exit(1);
    });
}
