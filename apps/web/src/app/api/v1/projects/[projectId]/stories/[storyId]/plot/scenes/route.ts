import type { NextRequest } from 'next/server';
import { privateApi } from '@/server/private-api';
import { json, ok } from '@/server/http';
import { SceneInput } from '@inkwell/contracts';
import { createScene } from '@/server/plot';
type Context = { params: Promise<{ projectId: string; storyId: string }> };
export function POST(request: NextRequest, context: Context) {
  return privateApi(request, async (a) => {
    const row = await createScene(a, await context.params, await json(request, SceneInput));
    return ok(row, 201, row.version);
  });
}
