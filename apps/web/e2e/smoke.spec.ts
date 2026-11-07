import { expect, test } from '@playwright/test';

const PASSWORD = process.env.E2E_PASSWORD ?? 'Demo-Passw0rd-2026';

test.beforeEach(async ({ page }) => {
  await page.goto('/login');
  await page.locator('input[type=email]').fill('developer@cdms.local');
  await page.locator('input[type=password]').fill(PASSWORD);
  await page.locator('button[type=submit]').click();
  await expect(page).toHaveURL('/');
});

test('dashboard and curricula list render without horizontal scroll', async ({ page }) => {
  await expect(page.locator('h1')).toBeVisible();
  await page.goto('/curricula');
  await expect(page.getByText('CUR-ELEC-BLD').filter({ visible: true }).first()).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

test('language switch flips document direction', async ({ page }) => {
  const dir = await page.evaluate(() => document.documentElement.dir);
  await page.getByRole('button', { name: /language|اللغة/i }).click();
  await expect.poll(() => page.evaluate(() => document.documentElement.dir)).not.toBe(dir);
});

test('curriculum detail shows coverage analysis', async ({ page }) => {
  await page.goto('/curricula?q=CUR-ICT');
  await page.getByText('CUR-ICT-SUP').filter({ visible: true }).first().click();
  await page.getByRole('tab').nth(2).click();
  await expect(page.getByRole('progressbar')).toBeVisible();
});
