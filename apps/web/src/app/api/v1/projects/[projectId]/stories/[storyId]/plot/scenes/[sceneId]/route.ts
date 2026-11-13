import type { NextRequest } from 'next/server';
import { privateApi } from '@/server/private-api';
import { json, ok, revision } from '@/server/http';
import { ScenePatch } from '@inkwell/contracts';
import { getScene, updateScene } from '@/server/plot';
type Context = { params: Promise<{ projectId: string; storyId: string; sceneId: string }> };
export function GET(request: NextRequest, context: Context) {
  return privateApi(request, async (a) => {
    const p = await context.params;
    const row = await getScene(a, p, p.sceneId);
    return ok(row, 200, row.version);
  });
}
export function PATCH(request: NextRequest, context: Context) {
  return privateApi(request, async (a) => {
    const p = await context.params;
    const row = await updateScene(
      a,
      p,
      p.sceneId,
      revision(request),
      await json(request, ScenePatch),
    );
    return ok(row, 200, row.version);
  });
}
