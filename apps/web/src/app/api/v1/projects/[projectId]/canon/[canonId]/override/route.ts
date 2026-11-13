import type { NextRequest } from 'next/server';
import { privateApi } from '@/server/private-api';
import { json, ok, revision, HttpError } from '@/server/http';
import { canonApiContext } from '@/server/canon-api';
import { OverrideInput } from '@inkwell/contracts';
import { saveOverride } from '@/server/canon';
type Context = { params: Promise<{ projectId: string; canonId: string }> };
async function save(request: NextRequest, context: Context, create: boolean) {
  return privateApi(request, async (a) => {
    const p = await context.params;
    if (create && request.headers.get('if-none-match') !== '*')
      throw new HttpError(428, 'PRECONDITION_REQUIRED', 'New overrides require If-None-Match: *.');
    const row = await saveOverride(
      a,
      canonApiContext(request, p.projectId),
      p.canonId,
      create ? 0 : revision(request),
      await json(request, OverrideInput),
    );
    return ok(row, create ? 201 : 200, row.override!.version);
  });
}
export function POST(r: NextRequest, c: Context) {
  return save(r, c, true);
}
export function PATCH(r: NextRequest, c: Context) {
  return save(r, c, false);
}
