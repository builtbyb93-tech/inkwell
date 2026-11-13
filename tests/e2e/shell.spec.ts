import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('shell supports keyboard access, theme selection, and honest empty states', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Every great story starts somewhere.',
  );
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('main')).toBeFocused();
  await page.getByLabel('Theme', { exact: true }).selectOption('dark');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(page.getByLabel('Theme', { exact: true })).toHaveValue('dark');
  await expect(page.getByText('Account access and creative tools', { exact: false })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});

test('light and dark shells have no detected WCAG A/AA violations', async ({ page }) => {
  await page.goto('/');
  for (const theme of ['light', 'dark']) {
    await page.getByLabel('Theme', { exact: true }).selectOption(theme);
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    expect(results.violations).toEqual([]);
  }
});

test('operational routes reveal no infrastructure details', async ({ request }) => {
  const health = await request.get('/api/v1/health');
  expect(health.status()).toBe(200);
  const ready = await request.get('/api/v1/ready');
  expect(ready.status()).toBe(503);
  expect(ready.headers()['cache-control']).toContain('no-store');
  const body = await ready.json();
  expect(body.error.code).toBe('SERVICE_UNAVAILABLE');
  expect(body.error.message).toBe('Service is not ready.');
  expect(Object.keys(body.error).sort()).toEqual(['code', 'message', 'requestId']);
});

test('theme selection works when browser storage is denied', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(Storage.prototype, 'getItem', {
      value: () => {
        throw new DOMException('Storage unavailable', 'SecurityError');
      },
    });
    Object.defineProperty(Storage.prototype, 'setItem', {
      value: () => {
        throw new DOMException('Storage unavailable', 'SecurityError');
      },
    });
  });
  await page.goto('/');
  await page.getByLabel('Theme', { exact: true }).selectOption('dark');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.getByLabel('Theme', { exact: true })).toHaveValue('dark');
});

test('theme selection uses memory when storage reads work but writes fail', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('inkwell-theme', 'light');
    Object.defineProperty(Storage.prototype, 'setItem', {
      value: () => {
        throw new DOMException('Storage full', 'QuotaExceededError');
      },
    });
  });
  await page.goto('/');
  await expect(page.getByLabel('Theme', { exact: true })).toHaveValue('light');
  await page.getByLabel('Theme', { exact: true }).selectOption('dark');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.getByLabel('Theme', { exact: true })).toHaveValue('dark');
  expect(await page.evaluate(() => localStorage.getItem('inkwell-theme'))).toBe('light');
});
