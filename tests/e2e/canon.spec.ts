import { test, expect, type APIRequestContext } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { plainDocument, CanonKind } from '@inkwell/contracts';
import { verifiedAuthor } from '../support/accounts';
async function post(
  client: APIRequestContext,
  origin: string,
  path: string,
  data: unknown,
  headers: Record<string, string> = {},
) {
  const r = await client.post('/api/v1' + path, { headers: { Origin: origin, ...headers }, data });
  expect(r.ok()).toBe(true);
  return (await r.json()).data;
}
async function fixture(client: APIRequestContext, origin: string) {
  await verifiedAuthor(client, origin);
  const p = await post(client, origin, '/projects', { title: 'Lantern universe' }),
    s = await post(client, origin, `/projects/${p.id}/stories`, { title: 'First voyage' }),
    s2 = await post(client, origin, `/projects/${p.id}/stories`, { title: 'Second voyage' });
  return { p, s, s2, base: `/projects/${p.id}/canon` };
}
test('authors manage five shared canon types, story-local records and accessible backlinks', async ({
  page,
  context,
  baseURL,
}, testInfo) => {
  test.setTimeout(90000);
  const origin = baseURL!,
    { p, s, s2, base } = await fixture(context.request, origin);
  const uiErrors: string[] = [];
  page.on('pageerror', (e) => uiErrors.push(e.message));
  const ids: Record<string, string> = {};
  for (const kind of CanonKind.options) {
    await page.goto(base + '/new');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('A new canon record.');
    await page.getByRole('combobox', { name: 'Record type', exact: true }).selectOption(kind);
    await page.getByLabel('Canon name', { exact: true }).fill('Lantern ' + kind.toLowerCase());
    await page
      .getByRole('textbox', { name: 'Canon notes', exact: true })
      .fill('A detail worth keeping.');
    await page.getByRole('button', { name: 'Create canon', exact: true }).click();
    await expect(page).toHaveURL(new RegExp(base + '/[a-f0-9-]{36}$'));
    ids[kind] = page.url().split('/').at(-1)!;
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Lantern ' + kind.toLowerCase(),
    );
  }
  await page.goto(base + '/' + ids.CHARACTER);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Lantern character');
  await page
    .getByRole('combobox', { name: 'Related canon', exact: true })
    .selectOption(ids.LOCATION!);
  await page
    .getByRole('combobox', { name: 'Relationship type', exact: true })
    .selectOption('LOCATED_IN');
  await page.getByLabel('New relationship label', { exact: true }).fill('Lives near the sea');
  await page.getByRole('button', { name: 'Add relationship', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Lantern location', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Lantern location', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Lantern location');
  await expect(
    page.getByText('Backlink · located in · Project relationship', { exact: true }),
  ).toBeVisible();
  const relationship = page.getByRole('form', { name: 'Edit relationship to Lantern character' });
  await relationship.getByLabel('Relationship label', { exact: true }).fill('Home port');
  await relationship.getByRole('button', { name: 'Save relationship label', exact: true }).click();
  await expect(
    relationship.getByRole('button', { name: 'Save relationship label' }),
  ).toBeDisabled();
  await relationship.getByRole('button', { name: 'Archive relationship' }).click();
  await expect(page.getByRole('link', { name: 'Lantern character', exact: true })).toHaveCount(0);
  await page.getByLabel('Show archived relationships', { exact: true }).check();
  await expect(page.getByRole('link', { name: 'Lantern character', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Restore relationship', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Lantern character', exact: true })).toHaveCount(0);
  await page.goto(`/projects/${p.id}/stories/${s.id}/canon/new`);
  await page.getByRole('combobox', { name: 'Record type', exact: true }).selectOption('LORE');
  await page.getByLabel('Canon name', { exact: true }).fill('Only in the first voyage');
  await page.getByRole('button', { name: 'Create canon', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Only in the first voyage');
  await page.getByRole('link', { name: 'Back to Story Bible', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('This story’s canon.');
  await expect(page.getByRole('link', { name: 'Lantern character', exact: true })).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Only in the first voyage', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Filter canon', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Filter canon', exact: true })).toBeEnabled();
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
      .violations,
  ).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  expect(uiErrors).toEqual([]);
  await page.evaluate(() => window.scrollTo(0, 0));
  if (process.env.INKWELL_SCREENSHOT_DIR)
    await page.screenshot({
      path: process.env.INKWELL_SCREENSHOT_DIR + '/canon-' + testInfo.project.name + '.png',
      fullPage: false,
      scale: 'css',
    });
  await page.goto(`/projects/${p.id}/stories/${s2.id}/canon`);
  await expect(page.getByRole('link', { name: 'Lantern character', exact: true })).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Only in the first voyage', exact: true }),
  ).toHaveCount(0);
});
test('story overrides preserve clears and require explicit review of shared changes', async ({
  page,
  context,
  baseURL,
}, testInfo) => {
  test.setTimeout(60000);
  const origin = baseURL!,
    { p, s, base } = await fixture(context.request, origin);
  const r = await post(context.request, origin, base, {
    kind: 'CHARACTER',
    name: 'Shared Ada',
    content: plainDocument('Shared original notes'),
  });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`/projects/${p.id}/stories/${s.id}/canon/${r.id}`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Shared Ada');
  await page.getByRole('combobox', { name: 'Name behavior', exact: true }).selectOption('CUSTOM');
  await page.getByLabel('Story name', { exact: true }).fill('Voyage Ada');
  await page.getByRole('combobox', { name: 'Notes behavior', exact: true }).selectOption('CLEAR');
  await page.getByRole('button', { name: 'Save story override', exact: true }).click();
  await expect(
    page.getByRole('form', { name: 'Edit story override' }).getByRole('status'),
  ).toContainText('Story override saved');
  const patch = async (version: number, data: unknown) => {
    expect(
      (
        await context.request.patch('/api/v1' + base + '/' + r.id, {
          headers: { Origin: origin, 'If-Match': `"${version}"` },
          data,
        })
      ).status(),
    ).toBe(200);
  };
  await patch(1, { name: 'New shared Ada' });
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Review shared changes', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Voyage Ada');
  await page
    .getByRole('combobox', { name: 'Name review decision', exact: true })
    .selectOption('KEEP');
  await page.getByRole('button', { name: 'Save review decisions', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Review shared changes', exact: true }),
  ).toHaveCount(0);
  await patch(2, { content: plainDocument('New shared notes') });
  await page.reload();
  await expect(page.getByText('Explicitly cleared', { exact: true })).toBeVisible();
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
      .violations,
  ).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  if (process.env.INKWELL_SCREENSHOT_DIR)
    await page.locator('.canon-review').screenshot({
      path: process.env.INKWELL_SCREENSHOT_DIR + '/canon-review-' + testInfo.project.name + '.png',
      scale: 'css',
    });
  await page
    .getByRole('combobox', { name: 'Notes review decision', exact: true })
    .selectOption('INHERIT');
  await page.getByRole('button', { name: 'Save review decisions', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Review shared changes', exact: true }),
  ).toHaveCount(0);
  await page.getByText('Saved effective canon', { exact: true }).click();
  await expect(page.locator('.rich-view')).toContainText('New shared notes');
  const shared = (await (await context.request.get('/api/v1' + base + '/' + r.id)).json()).data;
  expect(shared.name).toBe('New shared Ada');
  expect(shared.override).toBeNull();
  expect(errors).toEqual([]);
});
test('stale canon and override saves keep drafts until explicitly discarded', async ({
  page,
  context,
  baseURL,
}) => {
  test.setTimeout(60000);
  const origin = baseURL!,
    { p, s, base } = await fixture(context.request, origin),
    r = await post(context.request, origin, base, {
      kind: 'LOCATION',
      name: 'Harbor',
      content: plainDocument('Notes'),
    });
  await page.goto(base + '/' + r.id);
  await page.getByLabel('Canon name', { exact: true }).fill('My unsaved harbor');
  expect(
    (
      await context.request.patch('/api/v1' + base + '/' + r.id, {
        headers: { Origin: origin, 'If-Match': '"1"' },
        data: { name: 'Other tab harbor' },
      })
    ).status(),
  ).toBe(200);
  await page.getByRole('button', { name: 'Save canon', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'changed elsewhere' })).toContainText(
    'changed elsewhere',
  );
  await expect(page.getByLabel('Canon name', { exact: true })).toHaveValue('My unsaved harbor');
  await page.getByRole('button', { name: 'Discard edits and reload canon', exact: true }).click();
  await expect(page.getByLabel('Canon name', { exact: true })).toHaveValue('Other tab harbor');
  const path = base + '/' + r.id + '/override?storyId=' + s.id;
  await post(
    context.request,
    origin,
    path,
    {
      baseVersion: 2,
      name: { mode: 'CUSTOM', value: 'Saved story harbor' },
      content: { mode: 'INHERIT' },
    },
    { 'If-None-Match': '*' },
  );
  await page.goto(`/projects/${p.id}/stories/${s.id}/canon/${r.id}`);
  await page.getByLabel('Story name', { exact: true }).fill('My unsaved story harbor');
  expect(
    (
      await context.request.patch('/api/v1' + path, {
        headers: { Origin: origin, 'If-Match': '"1"' },
        data: {
          baseVersion: 2,
          name: { mode: 'CUSTOM', value: 'Other story tab' },
          content: { mode: 'INHERIT' },
        },
      })
    ).status(),
  ).toBe(200);
  await page.getByRole('button', { name: 'Save story override', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'changed elsewhere' })).toContainText(
    'changed elsewhere',
  );
  await expect(page.getByLabel('Story name', { exact: true })).toHaveValue(
    'My unsaved story harbor',
  );
  await page.getByRole('button', { name: 'Refresh comparison; keep draft', exact: true }).click();
  await expect(page.getByLabel('Story name', { exact: true })).toHaveValue(
    'My unsaved story harbor',
  );
  await page.getByRole('button', { name: 'Discard unsaved override edits', exact: true }).click();
  await expect(page.getByLabel('Story name', { exact: true })).toHaveValue('Other story tab');
});
test('canon HTTP routes enforce account, scope, input and precondition boundaries', async ({
  context,
  playwright,
  baseURL,
}) => {
  const origin = baseURL!,
    { p, s, base } = await fixture(context.request, origin),
    other = await playwright.request.newContext({ baseURL: origin });
  await verifiedAuthor(other, origin);
  const r = await post(context.request, origin, base, {
    kind: 'EVENT',
    name: 'Launch',
    content: plainDocument('Private'),
  });
  const path = '/api/v1' + base + '/' + r.id,
    headers = { Origin: origin };
  expect((await other.get(path)).status()).toBe(404);
  expect((await other.get('/api/v1' + base)).status()).toBe(404);
  expect(
    (await context.request.patch(path, { headers, data: { name: 'Missing version' } })).status(),
  ).toBe(428);
  expect(
    (
      await context.request.patch(path, {
        headers: { ...headers, 'If-Match': '"1"' },
        data: { scope: 'STORY', name: 'Injected' },
      })
    ).status(),
  ).toBe(400);
  expect(
    (
      await context.request.patch(path, {
        headers: { Origin: 'https://foreign.example', 'If-Match': '"1"' },
        data: { name: 'CSRF' },
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await context.request.post(path + '/override?storyId=' + s.id, {
        headers,
        data: { baseVersion: 1, name: { mode: 'CLEAR' }, content: { mode: 'INHERIT' } },
      })
    ).status(),
  ).toBe(428);
  const o = await post(
    context.request,
    origin,
    base + '/' + r.id + '/override?storyId=' + s.id,
    { baseVersion: 1, name: { mode: 'CLEAR' }, content: { mode: 'INHERIT' } },
    { 'If-None-Match': '*' },
  );
  expect(o.effective.name).toBe('');
  expect(
    (
      await context.request.post(path + '/override?storyId=' + s.id, {
        headers: { ...headers, 'If-None-Match': '*' },
        data: { baseVersion: 1, name: { mode: 'INHERIT' }, content: { mode: 'CLEAR' } },
      })
    ).status(),
  ).toBe(409);
  const loc = await post(context.request, origin, base, {
    kind: 'LOCATION',
    name: 'Port',
    content: plainDocument(''),
  });
  expect(
    (
      await context.request.post(path + '/relationships', {
        headers,
        data: { kind: 'PRECEDES', toId: loc.id },
      })
    ).status(),
  ).toBe(400);
  const otherProject = await post(context.request, origin, '/projects', { title: 'Other project' }),
    otherCanon = await post(context.request, origin, `/projects/${otherProject.id}/canon`, {
      kind: 'EVENT',
      name: 'Other event',
      content: plainDocument(''),
    });
  expect(
    (
      await context.request.post(path + '/relationships', {
        headers,
        data: { kind: 'RELATED', toId: otherCanon.id },
      })
    ).status(),
  ).toBe(404);
  expect(
    (
      await context.request.patch(path + '?storyId=' + s.id, {
        headers: { ...headers, 'If-Match': '"1"' },
        data: { name: 'Shared mutation through story' },
      })
    ).status(),
  ).toBe(409);
  const response = await context.request.get(path);
  expect(response.headers()['cache-control']).toContain('no-store');
  expect(response.headers().etag).toBe('"1"');
  expect((await other.get(`/api/v1/projects/${p.id}/canon/${r.id}/relationships`)).status()).toBe(
    404,
  );
  await other.dispose();
});
