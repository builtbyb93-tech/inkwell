import type { NextRequest } from 'next/server';
import { privateApi } from '@/server/private-api';
import { ok } from '@/server/http';
import { canonApiContext } from '@/server/canon-api';
import { canonSceneReferences } from '@/server/plot-links';
type Context = { params: Promise<{ projectId: string; canonId: string }> };
export function GET(request: NextRequest, context: Context) {
  return privateApi(request, async (a) => {
    const p = await context.params,
      c = canonApiContext(request, p.projectId, true),
      search = new URLSearchParams(request.nextUrl.searchParams);
    search.delete('storyId');
    return ok(await canonSceneReferences(a, c, p.canonId, search));
  });
}
