import type { NextRequest } from 'next/server';
import { privateApi } from '@/server/private-api';
import { ok, revision } from '@/server/http';
import { duplicateScene } from '@/server/plot';
type Context = { params: Promise<{ projectId: string; storyId: string; sceneId: string }> };
export function POST(request: NextRequest, context: Context) {
  return privateApi(request, async (a) => {
    const p = await context.params;
    const row = await duplicateScene(a, p, p.sceneId, revision(request));
    return ok(row, 201, row.version);
  });
}
