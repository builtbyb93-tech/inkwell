import { randomUUID } from 'node:crypto';
import { afterAll, describe, it, expect } from 'vitest';
import { database } from '../../apps/web/src/server/database';
import {
  register,
  consumeAccountToken,
  authenticate,
  requestAccountToken,
} from '../../apps/web/src/server/accounts';
import {
  createProject,
  createStory,
  getProject,
  getStory,
  listProjects,
  updateProject,
  updateStory,
  listStories,
  summary,
} from '../../apps/web/src/server/records';
import { authOptions } from '../../apps/web/src/server/auth';
import { limit } from '../../apps/web/src/server/rate-limit';
import { accountLink } from '../support/mail';
import type { AccountRecord } from '@inkwell/contracts';

if (!new URL(process.env.DATABASE_URL ?? 'http://invalid').pathname.startsWith('/inkwell_test_'))
  throw new Error('Use the isolated integration runner.');
const db = database();
afterAll(() => db.$disconnect());
const password = 'Stories begin in quiet places 42!';
async function newAccount() {
  const email = `${randomUUID()}@example.test`;
  await register({ email, password, displayName: 'Test author' });
  await requestAccountToken(email, 'VERIFY_EMAIL');
  const link = await accountLink(email, 'verify-email');
  const token = new URLSearchParams(new URL(link).hash.slice(1)).get('token')!;
  return { email, token };
}
async function account(): Promise<AccountRecord> {
  const { email, token } = await newAccount();
  await consumeAccountToken(token, 'VERIFY_EMAIL');
  const user = await db.user.findUniqueOrThrow({ where: { email }, include: { workspace: true } });
  return {
    id: user.id,
    email,
    displayName: user.displayName,
    version: user.version,
    aiEnabled: false,
    workspaceId: user.workspace!.id,
  };
}

describe('account security and transactional ownership', () => {
  it('requires secure HttpOnly cookies on an HTTPS origin', () => {
    const previous = process.env.NEXTAUTH_URL;
    process.env.NEXTAUTH_URL = 'https://inkwell.example.test/api/v1/auth';
    try {
      const cookie = authOptions().cookies?.sessionToken;
      expect(cookie?.name).toBe('__Secure-inkwell.session-token');
      expect(cookie?.options).toMatchObject({
        secure: true,
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
      });
    } finally {
      if (previous === undefined) delete process.env.NEXTAUTH_URL;
      else process.env.NEXTAUTH_URL = previous;
    }
  });
  it('requires verification, hashes secrets, creates one workspace, and consumes verification once under concurrency', async () => {
    const { email, token } = await newAccount();
    const user = await db.user.findUniqueOrThrow({ where: { email }, include: { tokens: true } });
    expect(user.passwordHash).toMatch(/^\$argon2id\$/);
    expect(user.tokens[0]?.tokenHash).not.toBe(token);
    expect(await db.workspace.count({ where: { ownerId: user.id } })).toBe(1);
    expect(await authenticate(email, password)).toBeNull();
    const results = await Promise.allSettled([
      consumeAccountToken(token, 'VERIFY_EMAIL'),
      consumeAccountToken(token, 'VERIFY_EMAIL'),
    ]);
    expect(results.filter((x) => x.status === 'fulfilled')).toHaveLength(1);
    expect(await authenticate(email, password)).toMatchObject({ id: user.id });
    expect(await authenticate(email, 'wrong password')).toBeNull();
  });
  it('expires tokens and resets passwords once while revoking every existing session and old recovery link', async () => {
    const a = await account();
    const before = await authenticate(a.email, password);
    expect(before?.sid).toBeTruthy();
    await requestAccountToken(a.email, 'RESET_PASSWORD');
    const link = await accountLink(a.email, 'reset-password');
    const token = new URLSearchParams(new URL(link).hash.slice(1)).get('token')!;
    await consumeAccountToken(token, 'RESET_PASSWORD', 'A newly chosen long passphrase 55!');
    await expect(consumeAccountToken(token, 'RESET_PASSWORD', password)).rejects.toMatchObject({
      status: 400,
    });
    expect(await authenticate(a.email, password)).toBeNull();
    expect(await authenticate(a.email, 'A newly chosen long passphrase 55!')).toMatchObject({
      id: a.id,
    });
    expect(
      (await db.authSession.findUniqueOrThrow({ where: { id: before!.sid } })).revokedAt,
    ).not.toBeNull();
    const b = await newAccount();
    await db.authToken.updateMany({
      where: { user: { email: b.email } },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    await expect(consumeAccountToken(b.token, 'VERIFY_EMAIL')).rejects.toMatchObject({
      status: 400,
    });
  });
  it('rejects foreign resources and FK scope mismatches; conflicting edits cannot overwrite', async () => {
    const a = await account(),
      b = await account();
    const project = await createProject(a, {
      title: 'Private world',
      description: 'Keep this description',
    });
    const story = await createStory(a, project.id, {
      title: 'First story',
      synopsis: 'Original',
      format: 'Animation',
    });
    await createStory(a, project.id, {
      title: 'Second story',
      synopsis: 'Another beginning',
      format: 'Comic',
    });
    expect((await listStories(a, project.id, new URLSearchParams())).items).toHaveLength(2);
    expect(await summary(a)).toMatchObject({ projects: 1, stories: 2 });
    expect(await summary(b)).toMatchObject({ projects: 0, stories: 0, recent: [] });
    await expect(getProject(b, project.id)).rejects.toMatchObject({ status: 404 });
    await expect(getStory(b, project.id, story.id)).rejects.toMatchObject({ status: 404 });
    await expect(
      createStory(b, project.id, { title: 'Intrusion', synopsis: '', format: '' }),
    ).rejects.toMatchObject({ status: 404 });
    await expect(updateProject(b, project.id, 1, { title: 'Intrusion' })).rejects.toMatchObject({
      status: 404,
    });
    await expect(
      updateStory(b, project.id, story.id, 1, { title: 'Intrusion' }),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      db.story.create({
        data: { workspaceId: b.workspaceId, projectId: project.id, title: 'Invalid FK' },
      }),
    ).rejects.toMatchObject({ code: 'P2003' });
    const edits = await Promise.allSettled([
      updateStory(a, project.id, story.id, 1, { title: 'Version A' }),
      updateStory(a, project.id, story.id, 1, { title: 'Version B' }),
    ]);
    expect(edits.filter((x) => x.status === 'fulfilled')).toHaveLength(1);
    expect(edits.find((x) => x.status === 'rejected')).toMatchObject({ reason: { status: 409 } });
    const archived = await updateProject(a, project.id, 1, { archived: true });
    expect(archived.description).toBe('Keep this description');
    await expect(
      createStory(a, project.id, { title: 'Blocked', synopsis: '', format: '' }),
    ).rejects.toMatchObject({ status: 409 });
    expect((await listProjects(a, new URLSearchParams())).items).toHaveLength(0);
    expect((await listProjects(b, new URLSearchParams('archived=true'))).items).toHaveLength(0);
    const restored = await updateProject(a, project.id, archived.version, { archived: false });
    expect(restored.archivedAt).toBeNull();
    expect((await getStory(a, project.id, story.id)).synopsis).toBe('Original');
  });
  it('applies a shared atomic rate limit without storing raw identifiers', async () => {
    const identifier = randomUUID() + '@example.test';
    const results = await Promise.allSettled(
      Array.from({ length: 8 }, () => limit('test', identifier, 3)),
    );
    expect(results.filter((x) => x.status === 'fulfilled')).toHaveLength(3);
    expect(
      results
        .filter((x) => x.status === 'rejected')
        .every((x) => x.status === 'rejected' && x.reason.status === 429),
    ).toBe(true);
    expect(await db.rateLimitBucket.count({ where: { keyHash: { contains: identifier } } })).toBe(
      0,
    );
  });
});
