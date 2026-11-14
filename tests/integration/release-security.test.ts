import pg from 'pg';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { afterAll, expect, it, vi } from 'vitest';
import { createDatabase } from '@inkwell/db';
import { createRateLimiter } from '../../apps/web/src/server/rate-limit';
import { failure } from '../../apps/web/src/server/http';
const url = process.env.DATABASE_URL!;
if (!new URL(url).pathname.startsWith('/inkwell_test_')) throw new Error('Use isolated runner.');
const a = createDatabase(url),
  b = createDatabase(url);
afterAll(async () => {
  await a.$disconnect();
  await b.$disconnect();
});
it('coordinates rate limits across independent replica clients without losing increments', async () => {
  const secret = randomUUID(),
    identity = randomUUID();
  let now = Math.floor(Date.now() / 60000) * 60000 + 1000;
  const first = createRateLimiter(a, secret, () => now),
    second = createRateLimiter(b, secret, () => now);
  const results = await Promise.allSettled(
    Array.from({ length: 40 }, (_, i) => (i % 2 ? first : second)('replica-proof', identity, 7)),
  );
  expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(7);
  for (const result of results)
    if (result.status === 'rejected')
      expect(result.reason).toMatchObject({ status: 429, code: 'RATE_LIMITED' });
  await expect(second('replica-proof', randomUUID(), 7)).resolves.toBeUndefined();
  now += 60000;
  await expect(first('replica-proof', identity, 7)).resolves.toBeUndefined();
});
it('reports closed operational events and safe responses without exception details', async () => {
  const log = vi.spyOn(console, 'error').mockImplementation(() => {});
  try {
    const marker = 'synthetic-private-content-' + randomUUID();
    const response = failure(
      new Error(marker + ' https://private.example.test/path?credential=hidden'),
    );
    const body = await response.json();
    expect(response.status).toBe(503);
    const event = JSON.parse(String(log.mock.calls[0]![0]));
    expect(Object.keys(event).sort()).toEqual(['at', 'code', 'event', 'requestId', 'status']);
    expect(event).toMatchObject({
      event: 'inkwell.request_failure',
      status: 503,
      code: 'SERVICE_UNAVAILABLE',
      requestId: body.error.requestId,
    });
    expect(JSON.stringify(log.mock.calls) + JSON.stringify(body)).not.toContain(marker);
    expect(JSON.stringify(log.mock.calls)).not.toContain('private.example.test');
  } finally {
    log.mockRestore();
  }
});

it('runtime grants permit core persistence and reject schema access and permanent creative deletion', async () => {
  const admin = new pg.Pool({ connectionString: url }),
    client = await admin.connect();
  const role = 'inkwell_runtime_test_' + randomUUID().replaceAll('-', '');
  try {
    await client.query(
      'CREATE ROLE "' + role + '" NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION',
    );
    const grants = readFileSync(
      new URL('../../deploy/runtime-grants.sql', import.meta.url),
      'utf8',
    ).replaceAll(':"runtime_role"', '"' + role + '"');
    await client.query(grants);
    await client.query('SET ROLE "' + role + '"');
    const user = randomUUID(),
      workspace = randomUUID(),
      project = randomUUID();
    await client.query('INSERT INTO "User" (id,email,"updatedAt") VALUES ($1,$2,now())', [
      user,
      user + '@example.test',
    ]);
    await client.query('INSERT INTO "Workspace" (id,"ownerId","updatedAt") VALUES ($1,$2,now())', [
      workspace,
      user,
    ]);
    await client.query(
      'INSERT INTO "Project" (id,"workspaceId",title,"updatedAt") VALUES ($1,$2,$3,now())',
      [project, workspace, 'Runtime role project'],
    );
    await client.query('UPDATE "Project" SET title=$1 WHERE id=$2', ['Runtime updated', project]);
    expect(
      (await client.query('SELECT title FROM "Project" WHERE id=$1', [project])).rows[0].title,
    ).toBe('Runtime updated');
    for (const statement of [
      'CREATE TABLE public.unauthorized_table (id integer)',
      'DROP TABLE "Project"',
      'DELETE FROM "Project"',
      'SELECT * FROM "_prisma_migrations"',
    ])
      await expect(client.query(statement)).rejects.toMatchObject({ code: '42501' });
  } finally {
    await client.query('RESET ROLE');
    await client.query('DROP OWNED BY "' + role + '"');
    await client.query('DROP ROLE "' + role + '"');
    client.release();
    await admin.end();
  }
});
it('bounds operational log volume and keeps safe errors usable when the log sink fails', async () => {
  const log = vi.spyOn(console, 'error').mockImplementation(() => {});
  try {
    const ids = new Set<string>();
    for (let i = 0; i < 200; i++)
      ids.add((await failure(new Error('synthetic')).json()).error.requestId);
    expect(ids.size).toBe(200);
    expect(log.mock.calls.length).toBeLessThanOrEqual(60);
    const clock = vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 60000);
    log.mockImplementation(() => {
      throw new Error('Synthetic unavailable log sink');
    });
    try {
      expect(failure(new Error('synthetic')).status).toBe(503);
    } finally {
      clock.mockRestore();
    }
  } finally {
    log.mockRestore();
  }
});
