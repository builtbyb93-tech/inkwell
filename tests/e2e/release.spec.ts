import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { verifiedAuthor } from '../support/accounts';
test('PWA installs its public shell and never caches private pages, APIs or share capabilities', async ({
  playwright,
  baseURL,
}, testInfo) => {
  const profile = await mkdtemp(join(tmpdir(), 'inkwell-pwa-proof-'));
  const context = await playwright.chromium.launchPersistentContext(profile, {
    channel: 'chromium',
    headless: true,
    baseURL: baseURL!,
    viewport: testInfo.project.use.viewport!,
  });
  const page = context.pages()[0]!;
  try {
    await verifiedAuthor(context.request, baseURL!);
    const marker = 'Private offline proof';
    const projectResponse = await context.request.post('/api/v1/projects', {
      headers: { Origin: baseURL! },
      data: { title: marker },
    });
    expect(projectResponse.status()).toBe(201);
    const project = (await projectResponse.json()).data;
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.name));
    await page.goto('/projects/' + project.id);
    await expect(page.getByLabel('Title', { exact: true })).toHaveValue(marker);
    const registration = await page.evaluate(async () => {
      const result = await navigator.serviceWorker.ready;
      return { scope: result.scope, script: result.active?.scriptURL };
    });
    expect(registration.scope).toBe(baseURL + '/');
    expect(registration.script).toBe(baseURL + '/sw.js');
    await page.reload();
    const manifest = await (await context.request.get('/manifest.webmanifest')).json();
    expect(manifest).toMatchObject({ name: 'Inkwell', display: 'standalone' });
    for (const size of [192, 512]) {
      expect(manifest.icons).toContainEqual(
        expect.objectContaining({ src: '/icon-' + size + '.png', sizes: size + 'x' + size }),
      );
      expect(
        await page.evaluate(async (size) => {
          const image = new Image();
          image.src = '/icon-' + size + '.png';
          await image.decode();
          return [image.naturalWidth, image.naturalHeight];
        }, size),
      ).toEqual([size, size]);
    }
    const protocol = await context.newCDPSession(page);
    await protocol.send('Page.enable');
    const installability = await protocol.send('Page.getInstallabilityErrors');
    expect(installability.installabilityErrors).toEqual([]);
    const accessibility = await protocol.send('Accessibility.getFullAXTree');
    const roles = accessibility.nodes.map((node) => node.role?.value);
    for (const role of ['main', 'heading', 'textbox']) expect(roles).toContain(role);
    await protocol.detach();
    await page.goto('/share#token=' + 'x'.repeat(43));
    await expect(page.getByRole('main').getByRole('alert')).toBeVisible();
    const cached = await page.evaluate(async () => {
      const output: string[] = [];
      for (const name of await caches.keys())
        if (name.startsWith('inkwell-static-')) {
          const cache = await caches.open(name);
          for (const request of await cache.keys()) output.push(new URL(request.url).pathname);
        }
      return output.sort();
    });
    expect(cached).toEqual(['/icon-192.png', '/icon-512.png', '/offline.html']);
    await context.setOffline(true);
    await page.goto('/projects/' + project.id);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Your stories will be here when you reconnect.',
    );
    await expect(page.locator('body')).not.toContainText(marker);
    expect(
      await page.evaluate(async () => {
        try {
          await fetch('/api/v1/projects');
          return true;
        } catch {
          return false;
        }
      }),
    ).toBe(false);
    await context.setOffline(false);
    await page.reload();
    await expect(page.getByLabel('Title', { exact: true })).toHaveValue(marker);
    expect(errors).toEqual([]);
  } finally {
    await context.close();
    await rm(profile, { recursive: true, force: true });
  }
});
test('private navigation and capture reflow at narrow widths and enlarged text with keyboard access', async ({
  page,
  context,
  baseURL,
}, testInfo) => {
  await verifiedAuthor(context.request, baseURL!);
  await page.goto('/dashboard');
  for (const width of [1280, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate(() => {
      document.documentElement.style.fontSize = '200%';
    });
    const dimensions = await page.evaluate(() => ({
      width: innerWidth,
      total: document.documentElement.scrollWidth,
      overflow: Array.from(document.querySelectorAll('body *'))
        .filter(
          (el) =>
            el.getBoundingClientRect().right > innerWidth + 1 ||
            el.scrollWidth > el.clientWidth + 1,
        )
        .slice(0, 8)
        .map((el) => ({
          tag: el.tagName,
          className: el.className,
          width: el.clientWidth,
          scroll: el.scrollWidth,
          right: el.getBoundingClientRect().right,
        })),
    }));
    expect(dimensions.total, JSON.stringify(dimensions)).toBeLessThanOrEqual(dimensions.width);
  }
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '';
  });
  await page.goto('/dashboard');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('main')).toBeFocused();
  await page.getByText('Explore', { exact: true }).focus();
  await page.keyboard.press('Enter');
  await page
    .getByRole('navigation', { name: 'Mobile navigation' })
    .getByRole('link', { name: 'Idea Vault', exact: true })
    .click();
  await expect(page).toHaveURL(/\/ideas$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Idea Vault.');
  for (const theme of ['light', 'dark']) {
    await page.getByLabel('Theme', { exact: true }).selectOption(theme);
    expect(
      (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
        .violations,
    ).toEqual([]);
  }
  await page.screenshot({ path: '/tmp/inkwell-phase7-reflow-' + testInfo.project.name + '.png' });
});
test('release headers bound scripts, workers, framing and private response caching', async ({
  request,
}) => {
  const page = await request.get('/sign-in'),
    again = await request.get('/sign-in');
  const csp = page.headers()['content-security-policy']!;
  for (const rule of [
    "worker-src 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'none'",
  ])
    expect(csp).toContain(rule);
  expect(csp).not.toContain('unsafe-eval');
  expect(csp).not.toBe(again.headers()['content-security-policy']);
  expect(page.headers()['cache-control']).toContain('no-store');
  expect(page.headers()['referrer-policy']).toBe('no-referrer');
  expect(page.headers()['x-robots-tag']).toContain('noindex');
  const worker = await request.get('/sw.js');
  expect(worker.status()).toBe(200);
  expect(worker.headers()['cache-control']).toContain('no-store');
  expect(worker.headers()['service-worker-allowed']).toBe('/');
});
