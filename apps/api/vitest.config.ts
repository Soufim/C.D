import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

const TEST_DB = process.env.TEST_DATABASE_URL ?? 'postgres://cdms:cdms@localhost:5432/cdms_test';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
    environment: 'node',
    globalSetup: ['./test/global-setup.ts'],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 120_000,
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: TEST_DB,
      JWT_ACCESS_SECRET: 'test-secret-test-secret-test-secret-123456',
      STORAGE_DIR: './storage-test',
      LOG_LEVEL: 'fatal',
      SEED_DEMO_DATA: '1',
      SEED_DEMO_PASSWORD: 'Test-Passw0rd-2026',
      SEED_ADMIN_PASSWORD: 'Test-Passw0rd-2026',
      LOGIN_MAX_FAILED_ATTEMPTS: '3',
    },
  },
  plugins: [swc.vite({ module: { type: 'es6' } })],
});
