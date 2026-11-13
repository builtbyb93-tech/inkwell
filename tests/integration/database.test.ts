import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { createDatabase } from '@inkwell/db';

const url = process.env.DATABASE_URL;
if (!url || !new URL(url).pathname.startsWith('/inkwell_test_')) {
  throw new Error(
    'Run integration tests through pnpm test:integration, never against a shared database.',
  );
}
const db = createDatabase(url);
afterAll(() => db.$disconnect());

describe('foundation database invariants', () => {
  it('persists UUID records and UTC timestamps through Prisma', async () => {
    const user = await db.user.create({
      data: { email: `${randomUUID()}@example.test`, workspace: { create: {} } },
      include: { workspace: true },
    });
    expect(user.id).toMatch(/^[a-f0-9-]{36}$/);
    expect(user.workspace?.ownerId).toBe(user.id);
    expect(user.createdAt.toISOString()).toMatch(/Z$/);
  });

  it('enforces at most one workspace per account at the database boundary', async () => {
    const user = await db.user.create({
      data: { email: `${randomUUID()}@example.test`, workspace: { create: {} } },
    });
    await expect(db.workspace.create({ data: { ownerId: user.id } })).rejects.toMatchObject({
      code: 'P2002',
    });
  });

  it('rejects an owner that does not exist', async () => {
    await expect(db.workspace.create({ data: { ownerId: randomUUID() } })).rejects.toMatchObject({
      code: 'P2003',
    });
  });

  it('rolls back a failed multi-record transaction', async () => {
    const email = `${randomUUID()}@example.test`;
    await expect(
      db.$transaction(async (tx) => {
        await tx.user.create({ data: { email } });
        await tx.workspace.create({ data: { ownerId: randomUUID() } });
      }),
    ).rejects.toMatchObject({ code: 'P2003' });
    expect(await db.user.findUnique({ where: { email } })).toBeNull();
  });
});
