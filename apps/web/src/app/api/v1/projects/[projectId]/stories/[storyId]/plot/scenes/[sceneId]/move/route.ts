import type { NextRequest } from 'next/server';
import { privateApi } from '@/server/private-api';
import { json, ok, revision } from '@/server/http';
import { SceneMove } from '@inkwell/contracts';
import { moveScene } from '@/server/plot';
type Context = { params: Promise<{ projectId: string; storyId: string; sceneId: string }> };
export function POST(request: NextRequest, context: Context) {
  return privateApi(request, async (a) => {
    const p = await context.params;
    const row = await moveScene(a, p, p.sceneId, revision(request), await json(request, SceneMove));
    return ok(row, 200, row.sequenceVersion);
  });
}
