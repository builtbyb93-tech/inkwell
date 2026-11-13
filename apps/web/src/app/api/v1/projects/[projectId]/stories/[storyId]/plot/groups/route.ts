import type { NextRequest } from 'next/server';
import { privateApi } from '@/server/private-api';
import { json, ok } from '@/server/http';
import { PlotGroupInput } from '@inkwell/contracts';
import { listGroups, createGroup } from '@/server/plot';
type Context = { params: Promise<{ projectId: string; storyId: string }> };
export function GET(request: NextRequest, context: Context) {
  return privateApi(request, async (a) =>
    ok(await listGroups(a, await context.params, request.nextUrl.searchParams)),
  );
}
export function POST(request: NextRequest, context: Context) {
  return privateApi(request, async (a) => {
    const row = await createGroup(a, await context.params, await json(request, PlotGroupInput));
    return ok(row, 201, row.version);
  });
}
