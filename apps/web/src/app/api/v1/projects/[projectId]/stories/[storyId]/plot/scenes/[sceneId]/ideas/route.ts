import type { NextRequest } from 'next/server';
import { privateApi } from '@/server/private-api';
import { ok } from '@/server/http';
import { sceneIdeaReferences } from '@/server/plot-links';
type Context = { params: Promise<{ projectId: string; storyId: string; sceneId: string }> };
export function GET(request: NextRequest, context: Context) {
  return privateApi(request, async (a) => {
    const p = await context.params;
    return ok(await sceneIdeaReferences(a, p, p.sceneId, request.nextUrl.searchParams));
  });
}
