import 'server-only';
import { createHash, randomBytes } from 'node:crypto';
import { database } from './database';
import { hashPassword, verifyPassword } from './passwords';
import { sendAccountMail } from './mail';
import { HttpError } from './http';

const tokenHash = (value: string) => createHash('sha256').update(value).digest('hex');
export async function register(input: { email: string; password: string; displayName: string }) {
  const db = database();
  const passwordHash = await hashPassword(input.password);
  try {
    await db.user.create({
      data: {
        email: input.email,
        passwordHash,
        displayName: input.displayName,
        workspace: { create: {} },
      },
    });
  } catch (error) {
    if (!(error && typeof error === 'object' && 'code' in error && error.code === 'P2002'))
      throw error;
  }
}

export async function requestAccountToken(
  email: string,
  purpose: 'VERIFY_EMAIL' | 'RESET_PASSWORD',
) {
  const db = database();
  const user = await db.user.findUnique({
    where: { email },
    select: { id: true, emailVerifiedAt: true, passwordHash: true },
  });
  if (
    !user?.passwordHash ||
    (purpose === 'VERIFY_EMAIL' && user.emailVerifiedAt) ||
    (purpose === 'RESET_PASSWORD' && !user.emailVerifiedAt)
  )
    return;
  const raw = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + (purpose === 'VERIFY_EMAIL' ? 86400000 : 1800000));
  await db.$transaction(async (tx) => {
    // Serialize token issuance and consumption on the account, including recovery.
    await tx.user.update({ where: { id: user.id }, data: { updatedAt: new Date() } });
    await tx.authToken.updateMany({
      where: { userId: user.id, purpose, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    await tx.authToken.create({
      data: { userId: user.id, purpose, tokenHash: tokenHash(raw), expiresAt },
    });
  });
  try {
    await sendAccountMail(email, raw, purpose);
  } catch {
    // Same public response for absent accounts and SMTP failures. Resend is available.
    // Tokens and delivery errors must never enter application logs.
    console.warn('inkwell.auth.mail_delivery_failed');
  }
}

export async function consumeAccountToken(
  raw: string,
  purpose: 'VERIFY_EMAIL' | 'RESET_PASSWORD',
  password?: string,
) {
  const db = database();
  const passwordHash = password === undefined ? undefined : await hashPassword(password);
  await db.$transaction(async (tx) => {
    const token = await tx.authToken.findUnique({ where: { tokenHash: tokenHash(raw) } });
    if (!token || token.purpose !== purpose || token.consumedAt || token.expiresAt <= new Date())
      throw invalidToken();
    await tx.user.update({ where: { id: token.userId }, data: { updatedAt: new Date() } });
    const claimed = await tx.authToken.updateMany({
      where: { id: token.id, consumedAt: null, expiresAt: { gt: new Date() } },
      data: { consumedAt: new Date() },
    });
    if (claimed.count !== 1) throw invalidToken();
    if (purpose === 'VERIFY_EMAIL') {
      await tx.user.update({ where: { id: token.userId }, data: { emailVerifiedAt: new Date() } });
    } else {
      if (!passwordHash) throw invalidToken();
      await tx.user.update({
        where: { id: token.userId },
        data: { passwordHash, authVersion: { increment: 1 } },
      });
      await tx.authSession.updateMany({
        where: { userId: token.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    await tx.authToken.updateMany({
      where: { userId: token.userId, purpose, consumedAt: null },
      data: { consumedAt: new Date() },
    });
  });
}
function invalidToken() {
  return new HttpError(
    400,
    'VALIDATION_ERROR',
    'This link is invalid, expired, or already used. Request a new link.',
  );
}

export const sessionSeconds = 7 * 86400;
export async function authenticate(email: string, password: string) {
  const db = database();
  const user = await db.user.findUnique({ where: { email } });
  const valid = await verifyPassword(password, user?.passwordHash ?? null);
  if (!valid || !user?.emailVerifiedAt || !user.passwordHash) return null;
  return db.$transaction(async (tx) => {
    const unchanged = await tx.user.updateMany({
      where: {
        id: user.id,
        passwordHash: user.passwordHash,
        authVersion: user.authVersion,
        emailVerifiedAt: { not: null },
      },
      data: { updatedAt: new Date() },
    });
    if (unchanged.count !== 1) return null;
    const session = await tx.authSession.create({
      data: {
        userId: user.id,
        authVersion: user.authVersion,
        expiresAt: new Date(Date.now() + sessionSeconds * 1000),
      },
    });
    return { id: user.id, email: user.email, name: user.displayName, sid: session.id };
  });
}
