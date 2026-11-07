/**
 * Creates a fresh test database, applies all migrations and seeds demo data.
 * Requires a PostgreSQL server; the role in TEST_DATABASE_URL needs CREATEDB.
 */
import { Client } from 'pg';

export default async function setup() {
  const url = new URL(
    process.env.TEST_DATABASE_URL ?? 'postgres://cdms:cdms@localhost:5432/cdms_test',
  );
  const dbName = url.pathname.slice(1);
  if (!/^[a-z0-9_]+_test$/.test(dbName))
    throw new Error(`Refusing to reset non-test database "${dbName}"`);
  const admin = new Client({
    connectionString: Object.assign(new URL(url), { pathname: '/postgres' }).toString(),
  });
  await admin.connect();
  await admin.query(`DROP DATABASE IF EXISTS ${dbName} WITH (FORCE)`);
  await admin.query(`CREATE DATABASE ${dbName}`);
  await admin.end();

  process.env.DATABASE_URL = url.toString();
  process.env.JWT_ACCESS_SECRET ??= 'test-secret-test-secret-test-secret-123456';
  const { runMigrations } = await import('../src/database/migrate');
  await runMigrations(url.toString());
  const { seed } = await import('../src/database/seed');
  await seed({ demo: true, adminPassword: 'Test-Passw0rd-2026', quiet: true });
}
