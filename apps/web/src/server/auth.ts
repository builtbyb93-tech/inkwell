import 'server-only';
import { createHmac } from 'node:crypto';
import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { getToken } from 'next-auth/jwt';
import type { NextRequest } from 'next/server';
import { LoginInput, Id, type AccountRecord } from '@inkwell/contracts';
import { authenticate, sessionSeconds } from './accounts';
import { authConfig, sessionCookie } from './config';
import { database } from './database';
import { HttpError } from './http';

declare module 'next-auth' {
  interface User {
    sid?: string;
  }
}

export function authOptions(): NextAuthOptions {
  const config = authConfig();
  return {
    secret: config.secret,
    session: { strategy: 'jwt', maxAge: sessionSeconds },
    jwt: { maxAge: sessionSeconds },
    useSecureCookies: config.secure,
    cookies: {
      sessionToken: {
        name: sessionCookie(),
        options: { httpOnly: true, sameSite: 'lax', path: '/', secure: config.secure },
      },
    },
    pages: { signIn: '/sign-in', error: '/sign-in' },
    providers: [
      CredentialsProvider({
        name: 'Email and password',
        credentials: { email: { type: 'email' }, password: { type: 'password' } },
        async authorize(credentials) {
          const input = LoginInput.safeParse(credentials);
          if (!input.success) return null;
          return authenticate(input.data.email, input.data.password);
        },
      }),
    ],
    callbacks: {
      async jwt({ token, user }) {
        if (user) {
          token.sub = user.id;
          token.sid = user.sid;
        }
        return token;
      },
      async session() {
        return { expires: new Date(0).toISOString() };
      },
      async redirect({ url }) {
        try {
          return new URL(url, config.origin).origin === config.origin
            ? new URL(url, config.origin).toString()
            : `${config.origin}/dashboard`;
        } catch {
          return `${config.origin}/dashboard`;
        }
      },
    },
    events: {
      async signOut({ token }) {
        if (typeof token?.sid === 'string' && Id.safeParse(token.sid).success)
          await database().authSession.updateMany({
            where: { id: token.sid },
            data: { revokedAt: new Date() },
          });
      },
    },
    logger: {
      error() {
        /* Do not log credential, token or database metadata. */
      },
      warn() {},
      debug() {},
    },
  };
}

export async function principal(request: NextRequest): Promise<AccountRecord> {
  return (await principalContext(request)).account;
}
export async function principalContext(request: NextRequest) {
  const config = authConfig();
  const token = await getToken({
    req: request,
    secret: config.secret,
    cookieName: sessionCookie(),
    secureCookie: config.secure,
  });
  if (
    typeof token?.sid !== 'string' ||
    !Id.safeParse(token.sid).success ||
    typeof token.sub !== 'string' ||
    !Id.safeParse(token.sub).success
  )
    throw unauthenticated();
  const session = await database().authSession.findFirst({
    where: { id: token.sid, userId: token.sub, revokedAt: null, expiresAt: { gt: new Date() } },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          displayName: true,
          version: true,
          emailVerifiedAt: true,
          authVersion: true,
          workspace: { select: { id: true } },
        },
      },
    },
  });
  const user = session?.user;
  if (
    !session ||
    !user?.emailVerifiedAt ||
    !user.workspace ||
    session.authVersion !== user.authVersion
  )
    throw unauthenticated();
  const account: AccountRecord = {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    version: user.version,
    aiEnabled: false,
    workspaceId: user.workspace.id,
  };
  return {
    account,
    recovery: {
      owner: user.id + ':' + user.workspace.id,
      tag: createHmac('sha256', config.secret)
        .update('recovery:' + session.id)
        .digest('hex'),
      startedAt: session.createdAt.getTime(),
    },
  };
}
export function unauthenticated() {
  return new HttpError(401, 'UNAUTHENTICATED', 'Sign in to continue.');
}
