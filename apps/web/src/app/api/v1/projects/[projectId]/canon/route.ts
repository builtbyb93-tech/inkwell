import type { NextRequest } from 'next/server';
import { privateApi } from '@/server/private-api';
import { json, ok } from '@/server/http';
import { canonApiContext } from '@/server/canon-api';
import { CanonInput } from '@inkwell/contracts';
import { createCanon, listCanon } from '@/server/canon';
type Context = { params: Promise<{ projectId: string }> };
export function GET(request: NextRequest, context: Context) {
  return privateApi(request, async (a) =>
    ok(
      await listCanon(
        a,
        canonApiContext(request, (await context.params).projectId, true),
        request.nextUrl.searchParams,
      ),
    ),
  );
}
export function POST(request: NextRequest, context: Context) {
  return privateApi(request, async (a) => {
    const row = await createCanon(
      a,
      canonApiContext(request, (await context.params).projectId),
      await json(request, CanonInput),
    );
    return ok(row, 201, row.version);
  });
}
