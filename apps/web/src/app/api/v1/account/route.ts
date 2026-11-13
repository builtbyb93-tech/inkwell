import type { NextRequest } from 'next/server';
import { AccountPatch } from '@inkwell/contracts';
import { privateApi } from '@/server/private-api';
import { json, ok, revision, conflict } from '@/server/http';
import { database } from '@/server/database';
export function GET(request: NextRequest) {
  return privateApi(request, async (account) => ok(account, 200, account.version));
}
export function PATCH(request: NextRequest) {
  return privateApi(request, async (account) => {
    const input = await json(request, AccountPatch);
    const version = revision(request);
    const result = await database().user.updateMany({
      where: { id: account.id, version },
      data: { displayName: input.displayName, version: { increment: 1 } },
    });
    if (result.count !== 1) conflict();
    return ok(
      { ...account, displayName: input.displayName, version: version + 1 },
      200,
      version + 1,
    );
  });
}
