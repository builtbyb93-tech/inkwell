import { randomUUID } from 'node:crypto';
import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { accountLink } from '../support/mail';

const password = 'A private beginning among the stars 42!';
async function holdSaveResponse(page: Page, path: string) {
  let release = () => {};
  let reached = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const ready = new Promise<void>((resolve) => {
    reached = resolve;
  });
  const draft = path.includes('/stories/');
  const pattern = draft ? '**/api/v1/draft-saves' : '**' + path;
  await page.route(pattern, async (route) => {
    if (route.request().method() !== (draft ? 'POST' : 'PATCH')) return route.continue();
    const response = await route.fetch();
    reached();
    await gate;
    await route.fulfill({ response });
  });
  return { ready, release, remove: () => page.unroute(pattern) };
}
async function signIn(client: APIRequestContext, origin: string, email: string, value = password) {
  const csrf = await client.get('/api/v1/auth/csrf');
  expect(csrf.status()).toBe(200);
  const token = (await csrf.json()).data.csrfToken;
  return client.post('/api/v1/auth/callback/credentials', {
    headers: { Origin: origin },
    form: {
      email,
      password: value,
      csrfToken: token,
      callbackUrl: origin + '/dashboard',
      json: 'true',
    },
  });
}
test('verified accounts organize private projects and stories, recover access, and revoke sessions', async ({
  page,
  context,
  playwright,
  baseURL,
}) => {
  test.setTimeout(90000);
  const origin = baseURL!;
  const email = `${randomUUID()}@example.test`;
  await page.goto('/register');
  await page.getByLabel('Your name', { exact: true }).fill('Ada');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('If this address is eligible');
  const unverified = await signIn(context.request, origin, email);
  expect(unverified.status()).toBe(401);
  const verify = await accountLink(email, 'verify-email');
  await page.goto(verify);
  await expect(page).toHaveURL(/\/verify-email$/);
  await page.getByRole('button', { name: 'Verify email', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Email verified');
  await page.getByRole('link', { name: 'Sign in', exact: true }).last().click();
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('what comes next');
  const cookie = (await context.cookies()).find((c) => c.name === 'inkwell.session-token');
  expect(cookie?.httpOnly).toBe(true);
  expect(cookie?.sameSite).toBe('Lax');
  const dashboard = await context.request.get('/dashboard');
  expect(dashboard.headers()['cache-control']).toContain('no-store');
  expect(dashboard.headers()['content-security-policy']).toContain("'nonce-");
  await expect(context.request.get('/api/v1/account').then((r) => r.status())).resolves.toBe(200);
  const a11y = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(a11y.violations).toEqual([]);
  await page.getByRole('link', { name: 'Open projects' }).click();
  await page.getByRole('link', { name: 'New project', exact: true }).click();
  await page.getByLabel('Title', { exact: true }).fill('The quiet universe');
  await page.getByLabel('Description', { exact: true }).fill('A world worth keeping.');
  await page.getByRole('button', { name: 'Create project', exact: true }).click();
  await expect(page).toHaveURL(/\/projects\/[a-f0-9-]{36}$/);
  const projectId = page.url().split('/').at(-1)!;
  await expect(page.getByLabel('Title', { exact: true })).toHaveValue('The quiet universe');
  await page.getByRole('link', { name: 'New story', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('A new story.');
  await page.getByLabel('Title', { exact: true }).fill('The first light');
  await page.getByLabel('Story format', { exact: true }).fill('Animated short');
  await page.getByLabel('Synopsis', { exact: true }).fill('A small light travels home.');
  await page.getByRole('button', { name: 'Create story', exact: true }).click();
  await expect(page).toHaveURL(/\/stories\/[a-f0-9-]{36}$/);
  const storyId = page.url().split('/').at(-1)!;
  await page.reload();
  await expect(page.getByLabel('Synopsis', { exact: true })).toHaveValue(
    'A small light travels home.',
  );
  const storyPath = `/api/v1/projects/${projectId}/stories/${storyId}`;
  const row = (await (await context.request.get(storyPath)).json()).data;
  const changes = await Promise.all(
    ['External A', 'External B'].map((title) =>
      context.request.patch(storyPath, {
        headers: { Origin: origin, 'If-Match': `"${row.version}"` },
        data: { title },
      }),
    ),
  );
  expect(changes.map((r) => r.status()).sort()).toEqual([200, 409]);
  await page.getByLabel('Title', { exact: true }).fill('My unsaved title');
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(page.getByRole('main').getByRole('alert')).toContainText('changed elsewhere');
  await expect(page.getByLabel('Title', { exact: true })).toHaveValue('My unsaved title');
  await page.getByRole('button', { name: 'Discard edits and reload' }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Current version loaded.' }),
  ).toBeVisible();
  await page.getByLabel('Title', { exact: true }).fill('A saved title');
  const heldStory = await holdSaveResponse(page, storyPath);
  try {
    await page.getByRole('button', { name: 'Save changes', exact: true }).click();
    await heldStory.ready;
    await expect(page.getByLabel('Title', { exact: true })).toBeEnabled();
    await expect(page.getByLabel('Story format', { exact: true })).toBeEnabled();
    await expect(page.getByLabel('Synopsis', { exact: true })).toBeEnabled();
  } finally {
    heldStory.release();
  }
  await expect(page.getByRole('status').filter({ hasText: /^Saved\.$/ })).toBeVisible();
  await heldStory.remove();
  await expect(page.getByLabel('Title', { exact: true })).toBeEnabled();
  await page.reload();
  await expect(page.getByLabel('Title', { exact: true })).toHaveValue('A saved title');
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
      .violations,
  ).toEqual([]);
  const b = await playwright.request.newContext({ baseURL: origin });
  const other = `${randomUUID()}@example.test`;
  expect(
    (
      await b.post('/api/v1/auth/register', {
        headers: { Origin: origin },
        data: { email: other, password, displayName: 'Other author' },
      })
    ).status(),
  ).toBe(202);
  const otherLink = await accountLink(other, 'verify-email');
  const otherToken = new URLSearchParams(new URL(otherLink).hash.slice(1)).get('token');
  expect(
    (
      await b.post('/api/v1/auth/verify-email', {
        headers: { Origin: origin },
        data: { token: otherToken },
      })
    ).status(),
  ).toBe(200);
  expect((await signIn(b, origin, other)).status()).toBe(200);
  for (const path of [
    `/api/v1/projects/${projectId}`,
    storyPath,
    `/api/v1/projects/${projectId}/stories`,
  ])
    expect((await b.get(path)).status()).toBe(404);
  expect(
    (
      await b.patch(storyPath, {
        headers: { Origin: origin, 'If-Match': '"1"' },
        data: { title: 'Intrusion' },
      })
    ).status(),
  ).toBe(404);
  expect(
    (
      await b.post(`/api/v1/projects/${projectId}/stories`, {
        headers: { Origin: origin },
        data: { title: 'Intrusion' },
      })
    ).status(),
  ).toBe(404);
  expect((await b.get('/api/v1/projects').then((r) => r.json())).data.items).toEqual([]);
  expect(
    (
      await context.request.post('/api/v1/projects', {
        headers: { Origin: 'https://foreign.example' },
        data: { title: 'CSRF' },
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await context.request.patch(storyPath, {
        headers: { Origin: origin },
        data: { title: 'No version' },
      })
    ).status(),
  ).toBe(428);
  const current = (await (await context.request.get(storyPath)).json()).data;
  expect(
    (
      await context.request.delete(storyPath, {
        headers: { Origin: origin, 'If-Match': `"${current.version}"` },
      })
    ).status(),
  ).toBe(200);
  const archived = (await (await context.request.get(storyPath)).json()).data;
  expect(archived.archivedAt).not.toBeNull();
  expect(
    (
      await context.request.patch(storyPath, {
        headers: { Origin: origin, 'If-Match': `"${archived.version}"` },
        data: { archived: false },
      })
    ).status(),
  ).toBe(200);
  const replay = await playwright.request.newContext({
    baseURL: origin,
    storageState: await context.storageState(),
  });
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page).toHaveURL(/\/sign-in$/);
  expect((await replay.get('/api/v1/account')).status()).toBe(401);
  await replay.dispose();
  expect((await signIn(context.request, origin, email)).status()).toBe(200);
  await page.goto('/forgot-password');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByRole('button', { name: 'Send recovery link' }).click();
  await expect(page.getByRole('status')).toContainText('If this address is eligible');
  const reset = await accountLink(email, 'reset-password');
  await page.goto(reset);
  const newPassword = 'A second beginning with a different key 73!';
  await page.getByLabel('Password', { exact: true }).fill(newPassword);
  await page.getByRole('button', { name: 'Save new password' }).click();
  await expect(page.getByRole('status')).toContainText('Password changed');
  expect((await context.request.get('/api/v1/account')).status()).toBe(401);
  expect((await b.get('/api/v1/account')).status()).toBe(200);
  expect((await signIn(context.request, origin, email, password)).status()).toBe(401);
  expect((await signIn(context.request, origin, email, newPassword)).status()).toBe(200);
  await page.goto('/settings');
  await page.getByLabel('Your name', { exact: true }).fill('Ada Storyteller');
  const heldAccount = await holdSaveResponse(page, '/api/v1/account');
  try {
    await page.getByRole('button', { name: 'Save account' }).click();
    await heldAccount.ready;
    await expect(page.getByLabel('Your name', { exact: true })).toBeDisabled();
  } finally {
    heldAccount.release();
  }
  await expect(page.getByRole('status').filter({ hasText: /^Saved\.$/ })).toBeVisible();
  await heldAccount.remove();
  await expect(page.getByLabel('Your name', { exact: true })).toBeEnabled();
  await expect(page.getByText('AI is disabled.', { exact: true })).toBeVisible();
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
      .violations,
  ).toEqual([]);
  await page.getByRole('button', { name: 'Sign out all devices' }).click();
  await expect(page).toHaveURL(/\/sign-in$/);
  expect((await context.request.get('/api/v1/projects')).status()).toBe(401);
  await b.dispose();
});

test('auth endpoints reject unsafe input, enforce CSRF, and limit enumeration attempts', async ({
  request,
  baseURL,
}) => {
  const email = `${randomUUID()}@example.test`;
  const headers = { Origin: baseURL! };
  expect((await request.get('/api/v1/projects')).status()).toBe(401);
  expect(
    (
      await request.post('/api/v1/auth/register', {
        headers,
        data: { email, password: 'short', displayName: 'A' },
      })
    ).status(),
  ).toBe(400);
  expect(
    (
      await request.post('/api/v1/auth/register', {
        headers: { Origin: 'https://foreign.example' },
        data: { email, password, displayName: 'A' },
      })
    ).status(),
  ).toBe(403);
  const csrfFree = await request.post('/api/v1/auth/callback/credentials', {
    headers,
    form: { email, password, json: 'true' },
  });
  expect(csrfFree.status()).toBe(400);
  for (let i = 0; i < 6; i++) {
    const response = await request.post('/api/v1/auth/forgot-password', {
      headers,
      data: { email },
    });
    expect(response.status()).toBe(i < 5 ? 202 : 429);
    if (i === 5) {
      expect(response.headers()['retry-after']).toBeTruthy();
      expect(Object.keys((await response.json()).error).sort()).toEqual([
        'code',
        'message',
        'requestId',
      ]);
    }
  }
});
