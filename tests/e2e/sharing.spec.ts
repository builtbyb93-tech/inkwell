import { test, expect, type APIRequestContext } from '@playwright/test';
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
  const project = await post(client, origin, '/projects', {
      title: 'Private universe',
      description: 'Do not publish this description',
    }),
    story = await post(client, origin, `/projects/${project.id}/stories`, {
      title: 'Private story',
      synopsis: 'Do not publish this synopsis',
    }),
    scene = await post(client, origin, `/projects/${project.id}/stories/${story.id}/plot/scenes`, {
      title: 'Selected lantern scene',
      content: plainDocument('A lantern reaches the harbor.'),
      status: 'DRAFT',
    });
  return { project, story, scene, path: '/projects/' + project.id + '/snapshots' };
}
const selected = (sceneId: string) => ({
  project: false,
  storyIds: [],
  ideaIds: [],
  canonIds: [],
  sceneIds: [sceneId],
  groupIds: [],
  relationships: false,
});
test('owners select and preview a frozen copy, then revoke a read-only link without exposing parent content', async ({
  page,
  context,
  browser,
  baseURL,
}, testInfo) => {
  test.setTimeout(60000);
  const f = await fixture(context.request, baseURL!);
  await page.goto('/projects/' + f.project.id + '/sharing?storyId=' + f.story.id);
  await page.getByLabel('Snapshot title', { exact: true }).fill('A lantern for you');
  await page.getByLabel('Content to select', { exact: true }).selectOption('SCENE');
  await page.getByRole('checkbox', { name: 'Selected lantern scene', exact: true }).check();
  await page
    .getByRole('button', { name: 'Create private snapshot and preview', exact: true })
    .click();
  const preview = page.locator('.snapshot-document');
  await expect(preview).toContainText('A lantern reaches the harbor.');
  await expect(preview).not.toContainText('Private universe');
  await expect(preview).not.toContainText('Private story');
  await expect(preview).not.toContainText('Do not publish');
  await page.getByLabel('Link expiry (your local time)', { exact: true }).fill('2030-01-01T12:00');
  await page.getByRole('button', { name: 'Create read-only link', exact: true }).click();
  const link = page.getByLabel('Share link', { exact: true });
  await expect(link).toHaveValue(/\/share#token=[-_A-Za-z0-9]{43}$/);
  const url = await link.inputValue(),
    token = new URLSearchParams(new URL(url).hash.slice(1)).get('token')!;
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  const guest = await browser.newContext({
      baseURL: baseURL!,
      viewport: testInfo.project.use.viewport!,
    }),
    view = await guest.newPage();
  try {
    await view.goto(url);
    await expect(view.getByRole('heading', { level: 1 })).toHaveText('A lantern for you');
    await expect(view.locator('.snapshot-document')).toContainText('Selected lantern scene');
    await expect(
      view.getByRole('button', { name: 'Download shared JSON', exact: true }),
    ).toHaveCount(0);
    expect(
      (
        await guest.request.post('/api/v1/shared/download', {
          headers: { Origin: baseURL! },
          data: { token },
        })
      ).status(),
    ).toBe(403);
    expect(
      (
        await guest.request.get('/api/v1/projects/' + f.project.id, {
          headers: { Authorization: 'Bearer ' + token },
        })
      ).status(),
    ).toBe(401);
    await context.request.patch(
      `/api/v1/projects/${f.project.id}/stories/${f.story.id}/plot/scenes/${f.scene.id}`,
      { headers: { Origin: baseURL!, 'If-Match': '"1"' }, data: { title: 'A later private edit' } },
    );
    await view.reload();
    await expect(view.locator('.snapshot-document')).toContainText('Selected lantern scene');
    await expect(view.locator('.snapshot-document')).not.toContainText('A later private edit');
    expect((await new AxeBuilder({ page: view }).analyze()).violations).toEqual([]);
    await page.getByRole('button', { name: 'Revoke link', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Share link revoked.' })).toBeVisible();
    await view.reload();
    await expect(view.getByRole('main').getByRole('alert')).toContainText('unavailable');
    expect(
      (
        await guest.request.post('/api/v1/shared/view', {
          headers: { Origin: baseURL! },
          data: { token },
        })
      ).status(),
    ).toBe(404);
  } finally {
    await guest.close();
  }
});
test('permitted downloads match the private preview and every public response forbids caching and indexing', async ({
  context,
  browser,
  baseURL,
}, testInfo) => {
  const f = await fixture(context.request, baseURL!),
    snapshot = await post(context.request, baseURL!, f.path, {
      title: 'Downloadable lantern',
      selection: selected(f.scene.id),
    }),
    link = await post(context.request, baseURL!, f.path + '/' + snapshot.snapshot.id + '/links', {
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
      allowDownload: true,
    }),
    guest = await browser.newContext({
      baseURL: baseURL!,
      viewport: testInfo.project.use.viewport!,
    }),
    view = await guest.newPage();
  try {
    const requests: string[] = [];
    view.on('request', (r) => requests.push(r.url()));
    await view.goto(baseURL + '/share#token=' + link.token);
    await expect(
      view.getByRole('button', { name: 'Download shared JSON', exact: true }),
    ).toBeVisible();
    const waiting = view.waitForEvent('download');
    await view.getByRole('button', { name: 'Download shared JSON', exact: true }).click();
    expect((await waiting).suggestedFilename()).toBe('inkwell-snapshot.json');
    const response = await guest.request.post('/api/v1/shared/download', {
      headers: { Origin: baseURL! },
      data: { token: link.token },
    });
    expect(response.status()).toBe(200);
    expect(await response.json()).toEqual(snapshot.document);
    expect(response.headers()['cache-control']).toContain('no-store');
    expect(response.headers()['x-robots-tag']).toContain('noindex');
    expect(response.headers()['referrer-policy']).toBe('no-referrer');
    expect(requests.some((url) => url.includes(link.token))).toBe(false);
    const text = JSON.stringify(await response.json());
    for (const value of [f.project.id, f.story.id, f.scene.id, 'Private universe', 'Private story'])
      expect(text).not.toContain(value);
    await view.clock.install();
    await view.clock.setSystemTime(new Date(Date.now() + 7200000));
    await view.clock.runFor(1100);
    await expect(view.getByRole('main').getByRole('alert')).toContainText('expired');
    await expect(view.locator('.snapshot-document')).toHaveCount(0);
  } finally {
    await guest.close();
  }
});
test('sharing routes reject foreign owners, unknown selections and unsafe link policies', async ({
  context,
  playwright,
  baseURL,
}) => {
  const f = await fixture(context.request, baseURL!),
    other = await playwright.request.newContext({ baseURL: baseURL! });
  try {
    await verifiedAuthor(other, baseURL!);
    expect(
      (
        await other.post('/api/v1' + f.path, {
          headers: { Origin: baseURL! },
          data: { title: 'Wrong owner', selection: selected(f.scene.id) },
        })
      ).status(),
    ).toBe(404);
    expect(
      (
        await context.request.post('/api/v1' + f.path, {
          headers: { Origin: baseURL! },
          data: { title: 'Nothing selected', selection: { ...selected(f.scene.id), sceneIds: [] } },
        })
      ).status(),
    ).toBe(400);
    const snapshot = await post(context.request, baseURL!, f.path, {
      title: 'Private preview',
      selection: selected(f.scene.id),
    });
    expect((await other.get('/api/v1' + f.path + '/' + snapshot.snapshot.id)).status()).toBe(404);
    expect(
      (
        await context.request.post('/api/v1' + f.path + '/' + snapshot.snapshot.id + '/links', {
          headers: { Origin: baseURL! },
          data: { expiresAt: '2020-01-01T00:00:00Z', allowDownload: false },
        })
      ).status(),
    ).toBe(400);
    expect(
      (
        await other.post('/api/v1/shared/view', {
          headers: { Origin: 'https://foreign.example' },
          data: { token: 'x'.repeat(43) },
        })
      ).status(),
    ).toBe(403);
    expect(
      (
        await other.post('/api/v1/shared/view', {
          headers: { Origin: baseURL! },
          data: { token: 'x'.repeat(43) },
        })
      ).status(),
    ).toBe(404);
  } finally {
    await other.dispose();
  }
});

test('connection navigation preserves the share capability through keyboard movement and reload', async ({
  context,
  browser,
  baseURL,
}, testInfo) => {
  const f = await fixture(context.request, baseURL!);
  const character = await post(context.request, baseURL!, `/projects/${f.project.id}/canon`, {
    kind: 'CHARACTER',
    name: 'Lantern keeper',
    content: plainDocument('A selected traveler'),
  });
  const linked = await context.request.post(
    `/api/v1/projects/${f.project.id}/stories/${f.story.id}/plot/scenes/${f.scene.id}/canon-links`,
    {
      headers: { Origin: baseURL!, 'If-Match': '"1"' },
      data: { kind: 'CHARACTER', canonId: character.id },
    },
  );
  expect(linked.status()).toBe(201);
  const snapshot = await post(context.request, baseURL!, f.path, {
    title: 'Connected lantern',
    storyId: f.story.id,
    selection: { ...selected(f.scene.id), canonIds: [character.id], relationships: true },
  });
  expect(snapshot.document.relationships).toHaveLength(1);
  const link = await post(
    context.request,
    baseURL!,
    f.path + '/' + snapshot.snapshot.id + '/links',
    {
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
      allowDownload: false,
    },
  );
  const guest = await browser.newContext({
      baseURL: baseURL!,
      viewport: testInfo.project.use.viewport!,
    }),
    view = await guest.newPage();
  try {
    const errors: string[] = [];
    view.on('pageerror', (error) => errors.push(error.name));
    const url = baseURL + '/share#token=' + link.token;
    await view.goto(url);
    const connection = view
      .getByRole('region', { name: 'Selected relationships' })
      .getByRole('button', { name: 'Lantern keeper', exact: true });
    await connection.focus();
    await view.keyboard.press('Enter');
    await expect(view).toHaveURL(url);
    await expect(view.locator('article').filter({ hasText: 'A selected traveler' })).toBeFocused();
    await view.reload();
    await expect(view.getByRole('heading', { level: 1 })).toHaveText('Connected lantern');
    await expect(connection).toBeVisible();
    await connection.click();
    await expect(view).toHaveURL(url);
    await expect(view).toHaveTitle(/Inkwell/);
    expect(errors).toEqual([]);
    await view.screenshot({
      path: '/tmp/inkwell-phase6-sharing-' + testInfo.project.name + '.png',
    });
  } finally {
    await guest.close();
  }
});
