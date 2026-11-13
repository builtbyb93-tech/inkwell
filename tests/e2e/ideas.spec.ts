import { randomUUID } from 'node:crypto';
import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { plainDocument } from '@inkwell/contracts';
import { verifiedAuthor } from '../support/accounts';
async function post(
  client: APIRequestContext,
  origin: string,
  path: string,
  data: unknown,
  headers: Record<string, string> = {},
) {
  const result = await client.post('/api/v1' + path, {
    headers: { Origin: origin, ...headers },
    data,
  });
  expect(result.ok()).toBe(true);
  return (await result.json()).data;
}

async function holdTagResponse(page: Page) {
  let release = () => {},
    reached = () => {};
  const gate = new Promise<void>((resolve) => {
      release = resolve;
    }),
    ready = new Promise<void>((resolve) => {
      reached = resolve;
    });
  await page.route('**/api/v1/idea-taxonomy/tags', async (route) => {
    if (route.request().method() !== 'POST') return route.continue();
    const response = await route.fetch();
    reached();
    await gate;
    await route.fulfill({ response });
  });
  return { ready, release, remove: () => page.unroute('**/api/v1/idea-taxonomy/tags') };
}

test('creators capture, format, classify, connect and convert ideas without losing their source', async ({
  page,
  context,
  baseURL,
}) => {
  test.setTimeout(90000);
  const origin = baseURL!;
  await verifiedAuthor(context.request, origin);
  const project = await post(context.request, origin, '/projects', { title: 'Comet universe' });
  const first = await post(context.request, origin, `/projects/${project.id}/stories`, {
    title: 'First journey',
  });
  const second = await post(context.request, origin, `/projects/${project.id}/stories`, {
    title: 'Second journey',
  });
  const seed = await post(context.request, origin, '/ideas', {
    title: 'Existing scene',
    content: plainDocument('An earlier thought'),
  });
  const otherScene = await post(
    context.request,
    origin,
    `/ideas/${seed.id}/conversions`,
    { kind: 'SCENE', projectId: project.id, storyId: first.id },
    { 'If-Match': '"1"', 'Idempotency-Key': randomUUID() },
  );
  await page.goto('/ideas');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Idea Vault.');
  await page
    .getByLabel('Capture an idea', { exact: true })
    .fill('Comet lantern\nA thought on a journey home.');
  await page.getByRole('button', { name: 'Capture idea', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Captured.' })).toBeVisible();
  await page.getByRole('link', { name: 'Comet lantern', exact: true }).click();
  await expect(page).toHaveURL(/\/ideas\/[a-f0-9-]{36}$/);
  const ideaId = page.url().split('/').at(-1)!;
  const editor = page.getByRole('textbox', { name: 'Idea content', exact: true });
  await editor.fill('');
  await page.getByRole('button', { name: 'Bold', exact: true }).click();
  await editor.pressSequentially('A silver comet finds its way home.');
  await expect(editor.locator('strong')).toContainText('A silver comet');
  await page.getByLabel('Idea title', { exact: true }).fill('Silver comet');
  await page.getByLabel('New category name', { exact: true }).fill('World building');
  await page.getByRole('button', { name: 'Add category', exact: true }).click();
  await expect(page.getByLabel('Category', { exact: true })).not.toHaveValue('');
  await page.getByLabel('New tag name', { exact: true }).fill('Cosmic');
  const heldTag = await holdTagResponse(page);
  try {
    await page.getByRole('button', { name: 'Add tag', exact: true }).click();
    await heldTag.ready;
    await expect(
      page.getByRole('form', { name: 'Edit idea' }).getByRole('button', { name: 'Saving…' }),
    ).toBeDisabled();
    await expect(page.getByLabel('Idea title', { exact: true })).toBeDisabled();
    await expect(page.getByRole('textbox', { name: 'Idea content' })).toHaveAttribute(
      'contenteditable',
      'false',
    );
  } finally {
    heldTag.release();
  }
  await expect(page.getByLabel('Cosmic', { exact: true })).toBeChecked();
  await heldTag.remove();
  await page.getByRole('button', { name: 'Save idea', exact: true }).click();
  await expect(page.getByRole('form', { name: 'Edit idea' }).getByRole('status')).toHaveText(
    'Saved.',
  );
  await page.reload();
  await expect(page.getByRole('textbox', { name: 'Idea content' }).locator('strong')).toContainText(
    'silver comet',
  );
  await expect(page.getByLabel('Cosmic', { exact: true })).toBeChecked();
  await page.getByLabel('Target project', { exact: true }).selectOption(project.id);
  await page.getByRole('button', { name: 'Create record', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Story: Silver comet', exact: true })).toBeVisible();
  await page.getByLabel('Create from this idea', { exact: true }).selectOption('CHARACTER');
  await page.getByRole('button', { name: 'Create record', exact: true }).click();
  const character = page.getByRole('link', { name: 'Character: Silver comet', exact: true });
  await expect(character).toBeVisible();
  const characterUrl = await character.getAttribute('href');
  await page.getByLabel('Target story', { exact: true }).selectOption(first.id);
  await page.getByLabel('Create from this idea', { exact: true }).selectOption('SCENE');
  await page.getByRole('button', { name: 'Create record', exact: true }).click();
  const sceneLink = page.getByRole('link', { name: 'Scene: Silver comet', exact: true });
  await expect(sceneLink).toBeVisible();
  const sceneUrl = await sceneLink.getAttribute('href');
  await page.getByRole('button', { name: 'Link reference', exact: true }).click();
  await expect(page.getByRole('link', { name: 'First journey', exact: true })).toBeVisible();
  await page.getByLabel('Target story', { exact: true }).selectOption(second.id);
  await page.getByRole('button', { name: 'Link reference', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Second journey', exact: true })).toBeVisible();
  await page.getByLabel('Target story', { exact: true }).selectOption(first.id);
  await page.getByLabel('Link an existing', { exact: true }).selectOption('SCENE');
  await page
    .getByLabel('Target scene', { exact: true })
    .selectOption(otherScene.conversion.targetSceneId);
  await page.getByRole('button', { name: 'Link reference', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Existing scene', exact: true })).toBeVisible();
  const before = (await (await context.request.get(`/api/v1/ideas/${ideaId}`)).json()).data;
  expect(before.counts).toEqual({ stories: 3, scenes: 2, conversions: 3 });
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
      .violations,
  ).toEqual([]);
  await page.goto(characterUrl!);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Silver comet');
  await expect(page.locator('.rich-view strong')).toContainText('silver comet');
  await page.getByRole('link', { name: 'Silver comet', exact: true }).click();
  await expect(page).toHaveURL(new RegExp('/ideas/' + ideaId + '$'));
  await page.goto(sceneUrl!);
  await expect(page.locator('.rich-view strong')).toContainText('silver comet');
  await expect(page.getByRole('link', { name: 'Silver comet', exact: true })).toBeVisible();
  await page.goto('/ideas');
  await page.getByText('Search & filter ideas', { exact: true }).click();
  await page.getByLabel('Search ideas', { exact: true }).fill('comet');
  await page.getByLabel('Category', { exact: true }).selectOption({ label: 'World building' });
  await page.getByLabel('Cosmic', { exact: true }).check();
  await page.getByRole('button', { name: 'Search vault', exact: true }).click();
  await expect(page.locator('.idea-list').getByRole('link')).toHaveCount(1);
  await page.getByRole('link', { name: 'Silver comet', exact: true }).click();
  await page.getByRole('button', { name: 'Archive idea', exact: true }).click();
  await expect(page.getByRole('form', { name: 'Edit idea' }).getByRole('status')).toContainText(
    'Archived.',
  );
  await expect(page.getByRole('textbox', { name: 'Idea content' })).toHaveAttribute(
    'contenteditable',
    'false',
  );
  await page.goto('/ideas?archived=true');
  await expect(
    page.locator('.idea-list').getByRole('link', { name: 'Silver comet', exact: true }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Silver comet', exact: true }).click();
  await page.getByRole('button', { name: 'Restore idea', exact: true }).click();
  await expect(page.getByRole('form', { name: 'Edit idea' }).getByRole('status')).toHaveText(
    'Restored.',
  );
  const restored = (await (await context.request.get(`/api/v1/ideas/${ideaId}`)).json()).data;
  expect(restored.counts).toEqual(before.counts);
  expect(restored.tags[0].name).toBe('Cosmic');
  await page.goto('/ideas');
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
      .violations,
  ).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});

test('vault APIs isolate accounts, validate rich text and replay conversion retries safely', async ({
  page,
  context,
  playwright,
  baseURL,
}) => {
  test.setTimeout(60000);
  const origin = baseURL!;
  await verifiedAuthor(context.request, origin);
  const other = await playwright.request.newContext({ baseURL: origin });
  await verifiedAuthor(other, origin);
  const headers = { Origin: origin };
  const project = await post(context.request, origin, '/projects', { title: 'Private project' });
  const idea = await post(context.request, origin, '/ideas', {
    title: 'Private comet',
    content: plainDocument('<img src=x onerror="window.__inkwellXss=1">'),
  });
  const foreignLabel = await post(other, origin, '/idea-taxonomy/tags', { name: 'Foreign tag' });
  expect((await other.get(`/api/v1/ideas/${idea.id}`)).status()).toBe(404);
  expect((await other.get('/api/v1/ideas?q=comet').then((r) => r.json())).data.items).toEqual([]);
  expect(
    (
      await context.request.patch(`/api/v1/ideas/${idea.id}`, {
        headers,
        data: { title: 'No version' },
      })
    ).status(),
  ).toBe(428);
  expect(
    (
      await context.request.patch(`/api/v1/ideas/${idea.id}`, {
        headers: { ...headers, 'If-Match': '"1"' },
        data: { tagIds: [foreignLabel.id] },
      })
    ).status(),
  ).toBe(404);
  expect(
    (
      await context.request.post('/api/v1/ideas', {
        headers,
        data: {
          title: 'Unsafe',
          content: {
            type: 'doc',
            content: [{ type: 'image', attrs: { src: 'https://external.example' } }],
          },
        },
      })
    ).status(),
  ).toBe(400);
  expect(
    (
      await context.request.post('/api/v1/ideas', {
        headers: { Origin: 'https://foreign.example' },
        data: { title: 'CSRF', content: plainDocument('Blocked') },
      })
    ).status(),
  ).toBe(403);
  const key = randomUUID(),
    body = { kind: 'STORY', projectId: project.id };
  const results = await Promise.all(
    [1, 2].map(() =>
      context.request.post(`/api/v1/ideas/${idea.id}/conversions`, {
        headers: { ...headers, 'If-Match': '"1"', 'Idempotency-Key': key },
        data: body,
      }),
    ),
  );
  expect(results.map((r) => r.status()).sort()).toEqual([200, 201]);
  const converted = await Promise.all(results.map((r) => r.json()));
  expect(converted[0].data.conversion.id).toBe(converted[1].data.conversion.id);
  for (const response of converted) {
    expect(response.data.conversion).not.toHaveProperty('requestHash');
    expect(response.data.conversion).not.toHaveProperty('requestKey');
    expect(response.data.conversion).not.toHaveProperty('contentSnapshot');
  }

  expect(
    (
      await context.request.post(`/api/v1/ideas/${idea.id}/conversions`, {
        headers: { ...headers, 'If-Match': '"1"', 'Idempotency-Key': key },
        data: { kind: 'CHARACTER', projectId: project.id },
      })
    ).status(),
  ).toBe(409);
  expect(
    (
      await other.post(`/api/v1/ideas/${idea.id}/conversions`, {
        headers: { ...headers, 'If-Match': '"1"', 'Idempotency-Key': randomUUID() },
        data: body,
      })
    ).status(),
  ).toBe(404);
  await page.goto(`/ideas/${idea.id}`);
  await expect(page.getByRole('textbox', { name: 'Idea content' })).toContainText('<img src=x');
  expect(await page.locator('.rich-input img').count()).toBe(0);
  expect(await page.evaluate(() => Reflect.get(window, '__inkwellXss'))).toBeUndefined();
  await other.dispose();
});

test('creative forms wait for client readiness before accepting a draft', async ({
  page,
  context,
  baseURL,
}) => {
  test.setTimeout(60000);
  await verifiedAuthor(context.request, baseURL!);
  let release = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/_next/static/**/*.js', async (route) => {
    await gate;
    await route.continue();
  });
  try {
    await page.goto('/projects/new', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('A new project.');
    await expect(page.getByLabel('Title', { exact: true })).toBeDisabled();
  } finally {
    release();
  }
  await expect(page.getByLabel('Title', { exact: true })).toBeEnabled();
  await page.getByLabel('Title', { exact: true }).fill('A ready beginning');
  await page.getByRole('button', { name: 'Create project', exact: true }).click();
  await expect(page).toHaveURL(/\/projects\/[a-f0-9-]{36}$/);
  await expect(page.getByLabel('Title', { exact: true })).toHaveValue('A ready beginning');
  await page.unroute('**/_next/static/**/*.js');
});
