import type { NextRequest } from 'next/server';
import { IdeaPatch } from '@inkwell/contracts';
import { privateApi } from '@/server/private-api';
import { json, ok, revision } from '@/server/http';
import { getIdea, updateIdea } from '@/server/ideas';
type Context = { params: Promise<{ ideaId: string }> };
export function GET(request: NextRequest, context: Context) {
  return privateApi(request, async (account) => {
    const row = await getIdea(account, (await context.params).ideaId);
    return ok(row, 200, row.version);
  });
}
export function PATCH(request: NextRequest, context: Context) {
  return privateApi(request, async (account) => {
    const row = await updateIdea(
      account,
      (await context.params).ideaId,
      revision(request),
      await json(request, IdeaPatch),
    );
    return ok(row, 200, row.version);
  });
}
export function DELETE(request: NextRequest, context: Context) {
  return privateApi(request, async (account) => {
    const row = await updateIdea(account, (await context.params).ideaId, revision(request), {
      archived: true,
    });
    return ok(row, 200, row.version);
  });
}
