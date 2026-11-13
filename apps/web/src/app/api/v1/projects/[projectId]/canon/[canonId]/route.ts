import type { NextRequest } from 'next/server';
import { privateApi } from '@/server/private-api';
import { json, ok, revision } from '@/server/http';
import { canonApiContext } from '@/server/canon-api';
import { CanonPatch } from '@inkwell/contracts';
import { getCanon, updateCanon } from '@/server/canon';
type Context = { params: Promise<{ projectId: string; canonId: string }> };
export function GET(request: NextRequest, context: Context) {
  return privateApi(request, async (a) => {
    const p = await context.params;
    const row = await getCanon(a, canonApiContext(request, p.projectId), p.canonId);
    return ok(row, 200, row.version);
  });
}
export function PATCH(request: NextRequest, context: Context) {
  return privateApi(request, async (a) => {
    const p = await context.params;
    const row = await updateCanon(
      a,
      canonApiContext(request, p.projectId),
      p.canonId,
      revision(request),
      await json(request, CanonPatch),
    );
    return ok(row, 200, row.version);
  });
}
