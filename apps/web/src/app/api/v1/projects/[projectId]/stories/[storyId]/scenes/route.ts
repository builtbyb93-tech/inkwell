import type { NextRequest } from 'next/server';
import { privateApi } from '@/server/private-api';
import { ok } from '@/server/http';
import { listScenes } from '@/server/idea-targets';
type Context = { params: Promise<{ projectId: string; storyId: string }> };
export function GET(request: NextRequest, context: Context) {
  return privateApi(request, async (account) => {
    const { projectId, storyId } = await context.params;
    return ok(await listScenes(account, projectId, storyId, request.nextUrl.searchParams));
  });
}
