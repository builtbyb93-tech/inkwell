import type { NextRequest } from 'next/server';
import { privateApi } from '@/server/private-api';
import { ok } from '@/server/http';
import { database } from '@/server/database';
export function POST(request: NextRequest) {
  return privateApi(request, async (account) => {
    await database().$transaction(async (tx) => {
      await tx.user.update({ where: { id: account.id }, data: { authVersion: { increment: 1 } } });
      await tx.authSession.updateMany({
        where: { userId: account.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    });
    return ok({ message: 'All sessions have ended. Sign in to continue.' });
  });
}
