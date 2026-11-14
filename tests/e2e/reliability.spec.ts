import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { plainDocument } from '@inkwell/contracts';
import { verifiedAuthor } from '../support/accounts';
async function post(client: APIRequestContext, origin: string, path: string, data: unknown) {
  const r = await client.post('/api/v1' + path, { headers: { Origin: origin }, data });
  expect(r.ok()).toBe(true);
  return (await r.json()).data;
}
async function idea(client: APIRequestContext, origin: string) {
  return post(client, origin, '/ideas', {
    title: 'Lantern original',
    content: plainDocument('Original notes'),
  });
}
async function stored(page: Page) {
  return page.evaluate(
    () =>
      new Promise<{ count: number; encrypted: boolean }>((resolve) => {
        const r = indexedDB.open('inkwell-recovery-v1', 1);
        r.onsuccess = () => {
          const tx = r.result.transaction('drafts', 'readonly'),
            q = tx.objectStore('drafts').getAll();
          q.onsuccess = () =>
            resolve({
              count: q.result.length,
              encrypted: q.result.every((x) => x.cipher instanceof ArrayBuffer && !('fields' in x)),
            });
        };
      }),
  );
}
test.beforeEach(async ({ page }) => {
  page.on('dialog', (d) => void d.accept());
});
test('autosave acknowledges only the submitted fields while newer typing remains editable', async ({
  page,
  context,
  baseURL,
}) => {
  await verifiedAuthor(context.request, baseURL!);
  const r = await idea(context.request, baseURL!);
  let reached = () => {},
    release = () => {};
  const ready = new Promise<void>((r) => (reached = r)),
    gate = new Promise<void>((r) => (release = r));
  let first = true;
  await page.route('**/api/v1/draft-saves', async (route) => {
    if (!first) return route.continue();
    first = false;
    const response = await route.fetch();
    reached();
    await gate;
    await route.fulfill({ response });
  });
  await page.goto('/ideas/' + r.id);
  await page.getByLabel('Idea title', { exact: true }).fill('First lantern edit');
  await ready;
  await expect(page.getByLabel('Idea title', { exact: true })).toBeEnabled();
  await page.getByLabel('Idea title', { exact: true }).fill('A newer lantern thought');
  release();
  await expect
    .poll(
      async () => (await (await context.request.get('/api/v1/ideas/' + r.id)).json()).data.title,
    )
    .toBe('A newer lantern thought');
  await expect(page.getByLabel('Idea title', { exact: true })).toHaveValue(
    'A newer lantern thought',
  );
  await expect(page.locator('.reliability-panel .save-state')).toHaveText('All changes saved');
  await expect.poll(async () => (await stored(page)).count).toBe(0);
});
test('lost-response retry keeps its key and cannot advance past an unseen edit', async ({
  page,
  context,
  baseURL,
}) => {
  await verifiedAuthor(context.request, baseURL!);
  const r = await idea(context.request, baseURL!),
    requests: unknown[] = [];
  let first = true;
  await page.route('**/api/v1/draft-saves', async (route) => {
    requests.push(route.request().postDataJSON());
    if (first) {
      first = false;
      await route.fetch();
      return route.abort('failed');
    }
    return route.continue();
  });
  await page.goto('/ideas/' + r.id);
  await page.getByLabel('Idea title', { exact: true }).fill('My acknowledged draft');
  await expect(page.getByRole('button', { name: 'Retry save', exact: true })).toBeVisible();
  const patch = await context.request.patch('/api/v1/ideas/' + r.id, {
    headers: { Origin: baseURL!, 'If-Match': '"2"' },
    data: { title: 'Other tab saved title' },
  });
  expect(patch.status()).toBe(200);
  await page.getByLabel('Idea title', { exact: true }).fill('My newest unsaved draft');
  await page.getByRole('button', { name: 'Retry save', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Compare current record', exact: true }),
  ).toBeVisible();
  expect(requests[0]).toEqual(requests[1]);
  expect((requests[2] as { version: number }).version).toBe(2);
  await expect(page.getByLabel('Idea title', { exact: true })).toHaveValue(
    'My newest unsaved draft',
  );
  expect((await (await context.request.get('/api/v1/ideas/' + r.id)).json()).data.title).toBe(
    'Other tab saved title',
  );
  await page.getByRole('button', { name: 'Compare current record', exact: true }).click();
  await expect(page.locator('.recovery-choice')).toContainText('Other tab saved title');
  await page
    .getByRole('button', { name: 'Use current version as base and keep my draft', exact: true })
    .click();
  await expect
    .poll(
      async () => (await (await context.request.get('/api/v1/ideas/' + r.id)).json()).data.title,
    )
    .toBe('My newest unsaved draft');
});
test('interrupted drafts require explicit restore and compare before replacing a newer saved revision', async ({
  page,
  context,
  baseURL,
}) => {
  await verifiedAuthor(context.request, baseURL!);
  const r = await idea(context.request, baseURL!);
  await page.route('**/api/v1/draft-saves', (route) => route.abort('failed'));
  await page.goto('/ideas/' + r.id);
  await page.getByLabel('Idea title', { exact: true }).fill('Recovered lantern draft');
  await expect(page.locator('.reliability-panel')).toContainText('Draft protected on this device');
  expect(await stored(page)).toEqual({ count: 1, encrypted: true });
  await context.request.patch('/api/v1/ideas/' + r.id, {
    headers: { Origin: baseURL!, 'If-Match': '"1"' },
    data: { title: 'New server lantern' },
  });
  await page.unroute('**/api/v1/draft-saves');
  await page.reload();
  await expect(
    page.getByRole('button', { name: 'Restore device draft', exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel('Idea title', { exact: true })).toHaveValue('New server lantern');
  await page.getByRole('button', { name: 'Restore device draft', exact: true }).click();
  await expect(page.getByLabel('Idea title', { exact: true })).toHaveValue(
    'Recovered lantern draft',
  );
  await expect(
    page.getByRole('button', { name: 'Compare current record', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Compare current record', exact: true }).click();
  await expect(page.locator('.recovery-choice')).toContainText('New server lantern');
  await page
    .getByRole('button', { name: 'Use current version as base and keep my draft', exact: true })
    .click();
  await expect
    .poll(
      async () => (await (await context.request.get('/api/v1/ideas/' + r.id)).json()).data.title,
    )
    .toBe('Recovered lantern draft');
});
test('new record drafts restore without creating a record, and expire after seven days', async ({
  page,
  context,
  baseURL,
}) => {
  await verifiedAuthor(context.request, baseURL!);
  await page.goto('/ideas/new');
  await page.getByLabel('Idea title', { exact: true }).fill('A new unsaved lantern');
  await expect(page.locator('.reliability-panel')).toContainText('Draft protected on this device');
  await page.reload();
  await page.getByRole('button', { name: 'Restore device draft', exact: true }).click();
  await expect(page.getByLabel('Idea title', { exact: true })).toHaveValue('A new unsaved lantern');
  expect((await (await context.request.get('/api/v1/ideas')).json()).data.items).toHaveLength(0);
  await expect(page.locator('.reliability-panel')).toContainText('Draft protected on this device');
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        const req = indexedDB.open('inkwell-recovery-v1', 1);
        req.onsuccess = () => {
          const tx = req.result.transaction('drafts', 'readwrite'),
            store = tx.objectStore('drafts'),
            r = store.getAll();
          r.onsuccess = () => {
            for (const row of r.result) store.put({ ...row, expiresAt: Date.now() - 1 });
          };
          tx.oncomplete = () => resolve();
        };
      }),
  );
  await page.reload();
  await expect(page.getByLabel('Idea title', { exact: true })).toHaveValue('');
  await expect(page.getByRole('button', { name: 'Restore device draft', exact: true })).toHaveCount(
    0,
  );
  await expect.poll(async () => (await stored(page)).count).toBe(0);
});
test('settings purge and sign-out prevent an older tab from recreating recovery drafts', async ({
  page,
  context,
  baseURL,
}) => {
  await verifiedAuthor(context.request, baseURL!);
  await page.goto('/ideas/new');
  await page.getByLabel('Idea title', { exact: true }).fill('Private device lantern');
  await expect.poll(async () => (await stored(page)).count).toBe(1);
  const settings = await context.newPage();
  await settings.goto('/settings');
  await settings.getByRole('button', { name: 'Clear device recovery drafts', exact: true }).click();
  await expect(
    settings.getByRole('status').filter({ hasText: 'Device recovery drafts cleared.' }),
  ).toBeVisible();
  await page.getByLabel('Idea title', { exact: true }).fill('An edit in the older tab');
  await expect(page.locator('.reliability-panel')).toContainText('Device recovery changed');
  await expect.poll(async () => (await stored(page)).count).toBe(0);
  await settings.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(settings).toHaveURL(/\/sign-in$/);
  await verifiedAuthor(context.request, baseURL!);
  await page.goto('/ideas/new');
  await expect(page.getByRole('button', { name: 'Restore device draft', exact: true })).toHaveCount(
    0,
  );
  await expect(page.getByLabel('Idea title', { exact: true })).toHaveValue('');
  await expect.poll(async () => (await stored(page)).count).toBe(0);
  await settings.close();
});
test('browser storage failure leaves online autosave and server sign-out usable', async ({
  page,
  context,
  baseURL,
}) => {
  await verifiedAuthor(context.request, baseURL!);
  const r = await idea(context.request, baseURL!);
  await page.addInitScript(() => {
    Object.defineProperty(window, 'indexedDB', {
      get() {
        throw new Error('Storage unavailable');
      },
    });
  });
  await page.goto('/ideas/' + r.id);
  await expect(page.locator('.reliability-panel')).toContainText('Device recovery is unavailable');
  await page.getByLabel('Idea title', { exact: true }).fill('Online only lantern');
  await expect
    .poll(
      async () => (await (await context.request.get('/api/v1/ideas/' + r.id)).json()).data.title,
    )
    .toBe('Online only lantern');
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page).toHaveURL(/\/sign-in$/);
});
test('search filters authorized records, and a downloaded archive imports as a separate project', async ({
  page,
  context,
  baseURL,
}) => {
  test.setTimeout(60000);
  await verifiedAuthor(context.request, baseURL!);
  const p = await post(context.request, baseURL!, '/projects', { title: 'Lantern universe' });
  await post(context.request, baseURL!, `/projects/${p.id}/stories`, { title: 'Lantern voyage' });
  await page.goto('/search');
  await page.getByLabel('Search words', { exact: true }).fill('Lantern');
  await page.getByRole('button', { name: 'Search workspace', exact: true }).click();
  await expect(page.locator('.record-list')).toContainText('Lantern voyage');
  await page.getByLabel('Record type', { exact: true }).selectOption('PROJECT');
  await page.getByRole('button', { name: 'Search workspace', exact: true }).click();
  await expect(page.locator('.record-list')).toContainText('Lantern universe');
  await expect(page.locator('.record-list')).not.toContainText('Lantern voyage');
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({
    path: '/tmp/inkwell-phase5-search-' + test.info().project.name + '.png',
    fullPage: true,
  });
  await page.goto('/projects/' + p.id);
  const download = page.waitForEvent('download');
  await page.getByRole('link', { name: 'Export project JSON', exact: true }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe('inkwell-project.json');
  const exported = await (await context.request.get('/api/v1/projects/' + p.id + '/export')).json();
  await page.goto('/imports');
  await page.getByLabel('Project archive', { exact: true }).setInputFiles({
    name: 'inkwell-project.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(exported)),
  });
  await expect(
    page.getByRole('button', { name: 'Import as a separate project', exact: true }),
  ).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByRole('button', { name: 'Import as a separate project', exact: true }).click();
  await expect(page).toHaveURL(/\/projects\/[a-f0-9-]{36}$/);
  expect(page.url()).not.toContain(p.id);
  await expect(page.getByRole('link', { name: 'Lantern voyage', exact: true })).toBeVisible();
});

test('a recovery encryption operation already in flight cannot recreate drafts after a purge', async ({
  page,
  context,
  baseURL,
}) => {
  await verifiedAuthor(context.request, baseURL!);
  await page.goto('/ideas/new');
  await page.getByLabel('Idea title', { exact: true }).fill('');
  await expect(page.locator('.reliability-panel')).not.toContainText(
    'Device recovery is unavailable',
  );
  await page.evaluate(() => {
    const encrypt = crypto.subtle.encrypt.bind(crypto.subtle),
      w = window as typeof window & {
        releaseRecovery?: () => void;
        recoveryEncryptReached?: boolean;
      };
    crypto.subtle.encrypt = async (...args: Parameters<SubtleCrypto['encrypt']>) => {
      const result = await encrypt(...args);
      w.recoveryEncryptReached = true;
      await new Promise<void>((resolve) => (w.releaseRecovery = resolve));
      crypto.subtle.encrypt = encrypt;
      return result;
    };
  });
  await page.getByLabel('Idea title', { exact: true }).fill('An encryption race lantern');
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as typeof window & { recoveryEncryptReached?: boolean }).recoveryEncryptReached,
      ),
    )
    .toBe(true);
  const settings = await context.newPage();
  await settings.goto('/settings');
  await settings.getByRole('button', { name: 'Clear device recovery drafts', exact: true }).click();
  await expect(
    settings.getByRole('status').filter({ hasText: 'Device recovery drafts cleared.' }),
  ).toBeVisible();
  await page.evaluate(() =>
    (window as typeof window & { releaseRecovery?: () => void }).releaseRecovery?.(),
  );
  await expect(page.locator('.reliability-panel')).toContainText('Device recovery changed');
  await expect.poll(async () => (await stored(page)).count).toBe(0);
  await settings.close();
});

test('navigating between records never carries a draft into a different record', async ({
  page,
  context,
  baseURL,
}) => {
  await verifiedAuthor(context.request, baseURL!);
  const first = await idea(context.request, baseURL!),
    second = await post(context.request, baseURL!, '/ideas', {
      title: 'Different lantern record',
      content: plainDocument('Independent notes'),
    });
  await page.route('**/api/v1/draft-saves', (route) => route.abort('failed'));
  await page.goto('/ideas/' + first.id);
  await page.getByLabel('Idea title', { exact: true }).fill('Draft for the first record');
  await expect(page.locator('.reliability-panel')).toContainText('Draft protected on this device');
  await page.goto('/ideas/' + second.id);
  await expect(page.getByLabel('Idea title', { exact: true })).toHaveValue(
    'Different lantern record',
  );
  await expect(page.getByRole('button', { name: 'Restore device draft', exact: true })).toHaveCount(
    0,
  );
  await page.goto('/ideas/' + first.id);
  await page.getByRole('button', { name: 'Restore device draft', exact: true }).click();
  await expect(page.getByLabel('Idea title', { exact: true })).toHaveValue(
    'Draft for the first record',
  );
});

test('device recovery refuses capacity overflow without evicting drafts and settings can disable it', async ({
  page,
  context,
  baseURL,
}) => {
  await verifiedAuthor(context.request, baseURL!);
  await page.goto('/ideas/new');
  await page.getByLabel('Idea title', { exact: true }).fill('The original protected draft');
  await expect(page.locator('.reliability-panel')).toContainText('Draft protected on this device');
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        const req = indexedDB.open('inkwell-recovery-v1', 1);
        req.onsuccess = () => {
          const tx = req.result.transaction('drafts', 'readwrite'),
            store = tx.objectStore('drafts'),
            r = store.getAll();
          r.onsuccess = () => {
            const row = r.result[0];
            for (let i = 0; i < 49; i++) {
              const slot = 'synthetic-capacity-' + i;
              store.put({ ...row, id: row.owner + '|' + slot, slot });
            }
          };
          tx.oncomplete = () => resolve();
        };
      }),
  );
  await page.goto('/projects/new');
  await page.getByLabel('Title', { exact: true }).fill('A draft beyond capacity');
  await expect(page.locator('.reliability-panel')).toContainText('Device recovery is full');
  expect((await stored(page)).count).toBe(50);
  await page.goto('/settings');
  await page.getByLabel('Keep unsaved drafts on this device', { exact: true }).uncheck();
  await expect(
    page.getByRole('status').filter({ hasText: 'Device recovery disabled and drafts cleared.' }),
  ).toBeVisible();
  expect((await stored(page)).count).toBe(0);
  await page.goto('/ideas/new');
  await page.getByLabel('Idea title', { exact: true }).fill('Recovery is disabled');
  await expect(page.getByLabel('Idea title', { exact: true })).toHaveValue('Recovery is disabled');
  expect((await stored(page)).count).toBe(0);
});

test('reliability APIs reject foreign owners, unsafe origins, malformed archives and save keys atomically', async ({
  context,
  playwright,
  baseURL,
}) => {
  await verifiedAuthor(context.request, baseURL!);
  const p = await post(context.request, baseURL!, '/projects', { title: 'Owned private lantern' }),
    r = await idea(context.request, baseURL!),
    other = await idea(context.request, baseURL!),
    anon = await playwright.request.newContext({ baseURL: baseURL! });
  try {
    expect((await anon.get('/api/v1/search?q=lantern')).status()).toBe(401);
    await verifiedAuthor(anon, baseURL!);
    expect((await anon.get('/api/v1/search?q=lantern&projectId=' + p.id)).status()).toBe(404);
    expect((await anon.get('/api/v1/projects/' + p.id + '/export')).status()).toBe(404);
    const archive = await (
      await context.request.get('/api/v1/projects/' + p.id + '/export')
    ).json();
    archive.workspaceId = '11111111-1111-4111-8111-111111111111';
    expect(
      (
        await context.request.post('/api/v1/imports/preview', {
          headers: { Origin: baseURL! },
          data: archive,
        })
      ).status(),
    ).toBe(400);
    const body = {
      kind: 'IDEA',
      recordId: r.id,
      requestKey: '11111111-1111-4111-8111-111111111111',
      version: 1,
      fields: { title: 'A valid saved lantern' },
    };
    expect(
      (
        await context.request.post('/api/v1/draft-saves', {
          headers: { Origin: 'https://foreign.example' },
          data: body,
        })
      ).status(),
    ).toBe(403);
    expect(
      (
        await context.request.post('/api/v1/draft-saves', {
          headers: { Origin: baseURL! },
          data: { ...body, fields: { archived: true } },
        })
      ).status(),
    ).toBe(400);
    expect(
      (
        await context.request.post('/api/v1/draft-saves', {
          headers: { Origin: baseURL! },
          data: body,
        })
      ).status(),
    ).toBe(200);
    expect(
      (
        await context.request.post('/api/v1/draft-saves', {
          headers: { Origin: baseURL! },
          data: { ...body, recordId: other.id },
        })
      ).status(),
    ).toBe(409);
    expect((await (await context.request.get('/api/v1/ideas/' + other.id)).json()).data.title).toBe(
      'Lantern original',
    );
    expect(
      (
        await anon.post('/api/v1/draft-saves', { headers: { Origin: baseURL! }, data: body })
      ).status(),
    ).toBe(404);
  } finally {
    await anon.dispose();
  }
});

test('Quick Capture restores an interrupted thought and clears even an in-flight buffer after capture', async ({
  page,
  context,
  baseURL,
}) => {
  await verifiedAuthor(context.request, baseURL!);
  await page.goto('/ideas');
  await page.getByLabel('Capture an idea', { exact: true }).fill('An interrupted quick thought');
  await expect(page.locator('.reliability-panel')).toContainText('Draft protected on this device');
  await page.reload();
  await page.getByRole('button', { name: 'Restore device draft', exact: true }).click();
  await expect(page.getByLabel('Capture an idea', { exact: true })).toHaveValue(
    'An interrupted quick thought',
  );
  await expect(page.locator('.reliability-panel')).toContainText('Draft protected on this device');
  await page.evaluate(() => {
    const encrypt = crypto.subtle.encrypt.bind(crypto.subtle),
      w = window as typeof window & {
        releaseRecovery?: () => void;
        recoveryEncryptReached?: boolean;
      };
    crypto.subtle.encrypt = async (...args: Parameters<SubtleCrypto['encrypt']>) => {
      const result = await encrypt(...args);
      w.recoveryEncryptReached = true;
      await new Promise<void>((resolve) => (w.releaseRecovery = resolve));
      crypto.subtle.encrypt = encrypt;
      return result;
    };
  });
  await page.getByLabel('Capture an idea', { exact: true }).fill('A captured quick thought');
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as typeof window & { recoveryEncryptReached?: boolean }).recoveryEncryptReached,
      ),
    )
    .toBe(true);
  await page.getByRole('button', { name: 'Capture idea', exact: true }).click();
  await expect
    .poll(async () => (await (await context.request.get('/api/v1/ideas')).json()).data.items.length)
    .toBe(1);
  await page.evaluate(() =>
    (window as typeof window & { releaseRecovery?: () => void }).releaseRecovery?.(),
  );
  await expect(page.getByRole('status').filter({ hasText: 'Captured.' })).toBeVisible();
  await expect.poll(async () => (await stored(page)).count).toBe(0);
  await page.reload();
  await expect(page.getByLabel('Capture an idea', { exact: true })).toHaveValue('');
  await expect(page.getByRole('button', { name: 'Restore device draft', exact: true })).toHaveCount(
    0,
  );
});

test('a cached recovery candidate cannot be restored after a tab resumes past its expiry', async ({
  page,
  context,
  baseURL,
}) => {
  await verifiedAuthor(context.request, baseURL!);
  const r = await idea(context.request, baseURL!);
  await page.route('**/api/v1/draft-saves', (route) => route.abort('failed'));
  await page.goto('/ideas/' + r.id);
  await page.getByLabel('Idea title', { exact: true }).fill('A draft that must expire');
  await expect(page.locator('.reliability-panel')).toContainText('Draft protected on this device');
  await page.reload();
  await expect(
    page.getByRole('button', { name: 'Restore device draft', exact: true }),
  ).toBeVisible();
  await page.clock.install();
  await page.clock.setSystemTime(new Date(Date.now() + 8 * 86400000));
  await page.getByRole('button', { name: 'Restore device draft', exact: true }).click();
  await expect(page.locator('.reliability-panel')).toContainText(
    'This device draft expired or was cleared.',
  );
  await expect(page.getByRole('button', { name: 'Restore device draft', exact: true })).toHaveCount(
    0,
  );
  await expect(page.getByLabel('Idea title', { exact: true })).toHaveValue('Lantern original');
  await expect.poll(async () => (await stored(page)).count).toBe(0);
  expect((await (await context.request.get('/api/v1/ideas/' + r.id)).json()).data).toMatchObject({
    version: 1,
    title: 'Lantern original',
  });
});

test('a recovery write queued before suspension cannot renew a seven-day-old unedited draft', async ({
  page,
  context,
  baseURL,
}) => {
  await verifiedAuthor(context.request, baseURL!);
  await page.goto('/ideas/new');
  await page.getByLabel('Idea title', { exact: true }).fill('');
  await expect(page.getByRole('button', { name: 'Create idea', exact: true })).toBeEnabled();
  await page.clock.install();
  await page.clock.pauseAt(new Date(Date.now() + 1000));
  await page.getByLabel('Idea title', { exact: true }).fill('A queued draft that must expire');
  await expect(page.getByRole('form', { name: 'Edit idea' }).getByRole('status')).toHaveText(
    'Unsaved changes',
  );
  await page.clock.setSystemTime(new Date(Date.now() + 8 * 86400000));
  await page.clock.runFor(200);
  await expect(page.locator('.reliability-panel')).toContainText('This device draft expired.');
  await expect.poll(async () => (await stored(page)).count).toBe(0);
  await expect(page.getByLabel('Idea title', { exact: true })).toHaveValue(
    'A queued draft that must expire',
  );
});
