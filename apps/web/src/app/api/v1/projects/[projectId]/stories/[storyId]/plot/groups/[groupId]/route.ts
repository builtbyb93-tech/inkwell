import type { NextRequest } from 'next/server';
import { privateApi } from '@/server/private-api';
import { json, ok, revision } from '@/server/http';
import { PlotGroupPatch } from '@inkwell/contracts';
import { getGroup, updateGroup } from '@/server/plot';
type Context = { params: Promise<{ projectId: string; storyId: string; groupId: string }> };
export function GET(request: NextRequest, context: Context) {
  return privateApi(request, async (a) => {
    const p = await context.params;
    const row = await getGroup(a, p, p.groupId);
    return ok(row, 200, row.version);
  });
}
export function PATCH(request: NextRequest, context: Context) {
  return privateApi(request, async (a) => {
    const p = await context.params;
    const row = await updateGroup(
      a,
      p,
      p.groupId,
      revision(request),
      await json(request, PlotGroupPatch),
    );
    return ok(row, 200, row.version);
  });
}
