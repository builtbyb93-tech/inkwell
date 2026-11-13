import type { NextRequest } from 'next/server';
import { privateApi } from '@/server/private-api';
import { ok } from '@/server/http';
import { getPlot } from '@/server/plot';
type Context = { params: Promise<{ projectId: string; storyId: string }> };
export function GET(request: NextRequest, context: Context) {
  return privateApi(request, async (a) => {
    const row = await getPlot(a, await context.params, request.nextUrl.searchParams);
    return ok(row, 200, row.sequenceVersion);
  });
}
