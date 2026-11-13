import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { plainDocument } from '@inkwell/contracts';
import { verifiedAuthor } from '../support/accounts';
async function post(client: APIRequestContext, origin: string, path: string, data: unknown) {
  const r = await client.post('/api/v1' + path, { headers: { Origin: origin }, data });
  expect(r.ok()).toBe(true);
  return (await r.json()).data;
}
async function fixture(client: APIRequestContext, origin: string) {
  await verifiedAuthor(client, origin);
  const p = await post(client, origin, '/projects', { title: 'Voyage universe' }),
    s = await post(client, origin, `/projects/${p.id}/stories`, { title: 'The voyage' }),
    other = await post(client, origin, `/projects/${p.id}/stories`, { title: 'Other story' });
  return { p, s, other, base: `/projects/${p.id}/stories/${s.id}/plot` };
}
async function holdWrite(page: Page, path: string) {
  let release = () => {},
    reached = () => {};
  const gate = new Promise<void>((r) => {
      release = r;
    }),
    ready = new Promise<void>((r) => {
      reached = r;
    });
  await page.route('**/api/v1' + path, async (route) => {
    if (route.request().method() !== 'POST') return route.continue();
    const response = await route.fetch();
    reached();
    await gate;
    await route.fulfill({ response });
  });
  return { ready, release, remove: () => page.unroute('**/api/v1' + path) };
}
const scene = (title: string) => ({ title, content: plainDocument(title + ' notes') });
test('creators edit grouped scenes, connect sources, duplicate and archive with their provenance intact', async ({
  page,
  context,
  baseURL,
}) => {
  test.setTimeout(120000);
  const origin = baseURL!,
    { p, s, base } = await fixture(context.request, origin);
  const character = await post(context.request, origin, `/projects/${p.id}/canon`, {
      kind: 'CHARACTER',
      name: 'Captain Ada',
      content: plainDocument(''),
    }),
    location = await post(context.request, origin, `/projects/${p.id}/canon?storyId=${s.id}`, {
      kind: 'LOCATION',
      name: 'Harbor',
      content: plainDocument(''),
    }),
    idea = await post(context.request, origin, '/ideas', {
      title: 'Lantern idea',
      content: plainDocument('Source thought'),
    });
  await page.goto(base + '/groups/new');
  await page.getByLabel('Group title', { exact: true }).fill('Act one');
  await page.getByRole('button', { name: 'Create plot group', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(base + '/groups/[a-f0-9-]{36}$'));
  const rootId = page.url().split('/').at(-1)!;
  await page.goto(base + '/groups/new');
  await page.getByLabel('Group title', { exact: true }).fill('Departure');
  await page.getByRole('combobox', { name: 'Parent plot group', exact: true }).selectOption(rootId);
  await page.getByRole('button', { name: 'Create plot group', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Departure');
  const childId = page.url().split('/').at(-1)!;
  await page.goto(base + '/scenes/new');
  await page.getByLabel('Scene title', { exact: true }).fill('First light');
  await page.getByRole('combobox', { name: 'Scene status', exact: true }).selectOption('DRAFT');
  await page.getByRole('combobox', { name: 'Plot group', exact: true }).selectOption(childId);
  const editor = page.getByRole('textbox', { name: 'Scene content', exact: true });
  await editor.fill('');
  await page.getByRole('button', { name: 'Bold', exact: true }).click();
  await editor.pressSequentially('A lantern leaves the harbor.');
  await page.getByRole('button', { name: 'Create scene', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(base + '/scenes/[a-f0-9-]{36}$'));
  const sourceId = page.url().split('/').at(-1)!;
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('First light');
  await page
    .getByRole('combobox', { name: 'Canon record', exact: true })
    .selectOption(character.id);
  const held = await holdWrite(page, base + '/scenes/' + sourceId + '/canon-links');
  try {
    await page.getByRole('button', { name: 'Link canon record', exact: true }).click();
    await held.ready;
    await expect(page.getByLabel('Scene title', { exact: true })).toBeDisabled();
    await expect(page.getByRole('textbox', { name: 'Scene content', exact: true })).toHaveAttribute(
      'contenteditable',
      'false',
    );
  } finally {
    held.release();
  }
  await expect(page.getByRole('link', { name: 'Captain Ada', exact: true })).toBeVisible();
  await held.remove();
  await page
    .getByRole('combobox', { name: 'Canon reference type', exact: true })
    .selectOption('LOCATION');
  await page.getByRole('combobox', { name: 'Canon record', exact: true }).selectOption(location.id);
  await page.getByRole('button', { name: 'Link canon record', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Harbor', exact: true })).toBeVisible();
  await page.getByRole('combobox', { name: 'Source idea', exact: true }).selectOption(idea.id);
  await page.getByRole('button', { name: 'Link idea reference', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Lantern idea', exact: true })).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole('textbox', { name: 'Scene content', exact: true }).locator('strong'),
  ).toContainText('lantern');
  await page
    .getByRole('combobox', { name: 'Canon reference type', exact: true })
    .selectOption('LOCATION');
  await page.getByRole('link', { name: 'Harbor', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Harbor');
  await page.getByRole('link', { name: 'First light', exact: true }).click();
  await expect(page).toHaveURL(base + '/scenes/' + sourceId);
  await page.getByRole('button', { name: 'Duplicate scene', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('First light (copy)');
  const copyId = page.url().split('/').at(-1)!;
  expect(copyId).not.toBe(sourceId);
  await expect(page.getByRole('link', { name: 'the original scene', exact: true })).toHaveAttribute(
    'href',
    base + '/scenes/' + sourceId,
  );
  await expect(page.getByRole('link', { name: 'Lantern idea', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Archive scene', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Restore scene', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Back to Plot Board', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Plot Board');
  await expect(page.getByRole('link', { name: 'First light (copy)', exact: true })).toHaveCount(0);
  await page.getByLabel('Show archived scenes', { exact: true }).check();
  await page.getByRole('link', { name: 'First light (copy)', exact: true }).click();
  await page.getByRole('button', { name: 'Restore scene', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Archive scene', exact: true })).toBeVisible();
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
      .violations,
  ).toEqual([]);
});
test('board and list share atomic drag, keyboard and mobile movement with stale-order protection', async ({
  page,
  context,
  baseURL,
}, testInfo) => {
  test.setTimeout(90000);
  const origin = baseURL!,
    { base } = await fixture(context.request, origin),
    g = await post(context.request, origin, base + '/groups', { title: 'Act one' }),
    one = await post(context.request, origin, base + '/scenes', scene('First')),
    two = await post(context.request, origin, base + '/scenes', scene('Second'));
  await post(context.request, origin, base + '/scenes', scene('Third'));
  const runtime: string[] = [];
  page.on('pageerror', (e) => runtime.push(e.message));
  await page.goto(base);
  const cards = page.locator('[data-scene-id] h2');
  await expect(cards).toHaveText(['First', 'Second', 'Third']);
  const second = page.locator(`[data-scene-id="${two.id}"]`);
  await second.getByRole('button', { name: 'Move earlier', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(cards).toHaveText(['Second', 'First', 'Third']);
  await expect(second.getByRole('link', { name: 'Second', exact: true })).toBeFocused();
  if (testInfo.project.name === 'desktop') {
    await page.getByRole('button', { name: 'Drag scene Third', exact: true }).dragTo(second);
    await expect(cards).toHaveText(['Third', 'Second', 'First']);
  } else {
    await page
      .locator(`[data-scene-id="${one.id}"]`)
      .getByRole('button', { name: 'Move later', exact: true })
      .click();
    await expect(cards).toHaveText(['Second', 'Third', 'First']);
  }
  const first = page.locator(`[data-scene-id="${one.id}"]`);
  await first.getByText('Move or regroup scene', { exact: true }).click();
  await first.getByRole('combobox', { name: 'Destination group', exact: true }).selectOption(g.id);
  await first.getByRole('combobox', { name: 'Insert before', exact: true }).selectOption('');
  await first.getByRole('button', { name: 'Apply scene move', exact: true }).click();
  await expect(first.getByRole('paragraph').filter({ hasText: /^Act one$/ })).toBeVisible();
  const order = await cards.allTextContents();
  await page.getByRole('button', { name: 'List view', exact: true }).click();
  await expect(cards).toHaveText(order);
  await page.reload();
  await expect(cards).toHaveText(order);
  const server = (await (await context.request.get('/api/v1' + base)).json()).data;
  expect(
    (
      await context.request.post('/api/v1' + base + '/scenes/' + one.id + '/move', {
        headers: { Origin: origin, 'If-Match': `"${server.sequenceVersion}"` },
        data: { beforeId: server.items[0].id },
      })
    ).status(),
  ).toBe(200);
  await second.getByRole('button', { name: 'Move later', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'changed elsewhere' })).toBeVisible();
  await expect(cards).toHaveText(order);
  await page.getByRole('button', { name: 'Refresh plot', exact: true }).click();
  await expect(cards.first()).toHaveText('First');
  await expect(page.getByRole('alert').filter({ hasText: 'changed elsewhere' })).toHaveCount(0);
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
      .violations,
  ).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  expect(runtime).toEqual([]);
  if (process.env.INKWELL_SCREENSHOT_DIR) {
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: process.env.INKWELL_SCREENSHOT_DIR + '/plot-' + testInfo.project.name + '.png',
      fullPage: true,
      scale: 'css',
    });
  }
});
test('stale scene and group saves retain drafts until an explicit reload', async ({
  page,
  context,
  baseURL,
}) => {
  const origin = baseURL!,
    { base } = await fixture(context.request, origin),
    r = await post(context.request, origin, base + '/scenes', scene('Opening')),
    g = await post(context.request, origin, base + '/groups', { title: 'Original group' });
  await page.goto(base + '/scenes/' + r.id);
  await page.getByLabel('Scene title', { exact: true }).fill('My unsaved scene');
  expect(
    (
      await context.request.patch('/api/v1' + base + '/scenes/' + r.id, {
        headers: { Origin: origin, 'If-Match': '"1"' },
        data: { title: 'Other tab scene' },
      })
    ).status(),
  ).toBe(200);
  await page.getByRole('button', { name: 'Save scene', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'changed elsewhere' })).toBeVisible();
  await expect(page.getByLabel('Scene title', { exact: true })).toHaveValue('My unsaved scene');
  await page.getByRole('button', { name: 'Discard edits and reload scene', exact: true }).click();
  await expect(page.getByLabel('Scene title', { exact: true })).toHaveValue('Other tab scene');
  await page.goto(base + '/groups/' + g.id);
  await page.getByLabel('Group title', { exact: true }).fill('My unsaved group');
  expect(
    (
      await context.request.patch('/api/v1' + base + '/groups/' + g.id, {
        headers: { Origin: origin, 'If-Match': '"1"' },
        data: { title: 'Other tab group' },
      })
    ).status(),
  ).toBe(200);
  await page.getByRole('button', { name: 'Save plot group', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'changed elsewhere' })).toBeVisible();
  await expect(page.getByLabel('Group title', { exact: true })).toHaveValue('My unsaved group');
  await page.getByRole('button', { name: 'Discard edits and reload group', exact: true }).click();
  await expect(page.getByLabel('Group title', { exact: true })).toHaveValue('Other tab group');
});
test('plot APIs reject foreign ownership, invalid scopes/types, missing preconditions and unsafe input', async ({
  context,
  playwright,
  baseURL,
}) => {
  const origin = baseURL!,
    { p, s, other, base } = await fixture(context.request, origin),
    foreign = await playwright.request.newContext({ baseURL: origin });
  await verifiedAuthor(foreign, origin);
  const r = await post(context.request, origin, base + '/scenes', scene('Private')),
    g = await post(context.request, origin, `/projects/${p.id}/stories/${other.id}/plot/groups`, {
      title: 'Other group',
    }),
    headers = { Origin: origin };
  expect((await foreign.get('/api/v1' + base)).status()).toBe(404);
  expect((await foreign.get('/api/v1' + base + '/scenes/' + r.id)).status()).toBe(404);
  expect((await foreign.get('/api/v1' + base + '/scenes/' + r.id + '/ideas')).status()).toBe(404);
  expect(
    (
      await context.request.patch('/api/v1' + base + '/scenes/' + r.id, {
        headers,
        data: { title: 'No version' },
      })
    ).status(),
  ).toBe(428);
  expect(
    (
      await context.request.post('/api/v1' + base + '/scenes/' + r.id + '/move', {
        headers,
        data: { beforeId: null },
      })
    ).status(),
  ).toBe(428);
  expect(
    (
      await context.request.post('/api/v1' + base + '/scenes', {
        headers,
        data: { ...scene('Injected'), position: 1 },
      })
    ).status(),
  ).toBe(400);
  expect(
    (
      await context.request.post('/api/v1' + base + '/scenes', {
        headers,
        data: { ...scene('Wrong group'), groupId: g.id },
      })
    ).status(),
  ).toBe(404);
  expect(
    (
      await context.request.patch('/api/v1' + base + '/scenes/' + r.id, {
        headers: { ...headers, 'If-Match': '"1"' },
        data: { groupId: g.id },
      })
    ).status(),
  ).toBe(400);
  expect(
    (
      await context.request.patch('/api/v1' + base + '/scenes/' + r.id, {
        headers: { Origin: 'https://foreign.example', 'If-Match': '"1"' },
        data: { title: 'CSRF' },
      })
    ).status(),
  ).toBe(403);
  const lore = await post(context.request, origin, `/projects/${p.id}/canon?storyId=${s.id}`, {
    kind: 'LORE',
    name: 'Private lore',
    content: plainDocument(''),
  });
  expect(
    (
      await context.request.post('/api/v1' + base + '/scenes/' + r.id + '/canon-links', {
        headers: { ...headers, 'If-Match': '"1"' },
        data: { kind: 'CHARACTER', canonId: lore.id },
      })
    ).status(),
  ).toBe(400);
  const before = (await (await context.request.get('/api/v1' + base)).json()).data;
  const requests = await Promise.all([
    context.request.post('/api/v1' + base + '/scenes/' + r.id + '/move', {
      headers: { ...headers, 'If-Match': `"${before.sequenceVersion}"` },
      data: { beforeId: null },
    }),
    context.request.post('/api/v1' + base + '/scenes/' + r.id + '/move', {
      headers: { ...headers, 'If-Match': '"999999"' },
      data: { beforeId: null },
    }),
  ]);
  expect(requests.map((r) => r.status()).sort()).toEqual([200, 409]);
  const read = await context.request.get('/api/v1' + base + '/scenes/' + r.id);
  expect(read.headers()['cache-control']).toContain('no-store');
  expect(read.headers().etag).toBe('"1"');
  await foreign.dispose();
});
