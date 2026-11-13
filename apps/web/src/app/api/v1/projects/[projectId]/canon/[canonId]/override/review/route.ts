import type { NextRequest } from 'next/server';
import { privateApi } from '@/server/private-api';
import { json, ok, revision } from '@/server/http';
import { canonApiContext } from '@/server/canon-api';
import { OverrideReview } from '@inkwell/contracts';
import { reviewOverride } from '@/server/canon';
type Context = { params: Promise<{ projectId: string; canonId: string }> };
export function POST(request: NextRequest, context: Context) {
  return privateApi(request, async (a) => {
    const p = await context.params;
    const row = await reviewOverride(
      a,
      canonApiContext(request, p.projectId),
      p.canonId,
      revision(request),
      await json(request, OverrideReview),
    );
    return ok(row, 200, row.override!.version);
  });
}
