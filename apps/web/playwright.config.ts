import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end smoke tests. Expects the API (port 3000, seeded with SEED_DEMO_PASSWORD) and the
 * web dev server (port 5173) to be running — see docs/testing.md. Uses the locally installed
 * Chromium; no cloud browser service is required.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  retries: 0,
  use: { baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:5173', trace: 'off' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'phone', use: { ...devices['Pixel 7'] } },
  ],
});
