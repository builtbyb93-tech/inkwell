import type { NextRequest } from 'next/server';
import { privateApi } from '@/server/private-api';
import { ok } from '@/server/http';
import { getTarget } from '@/server/idea-targets';
type Context = { params: Promise<{ projectId: string; characterId: string }> };
export function GET(request: NextRequest, context: Context) {
  return privateApi(request, async (account) => {
    const { projectId, characterId } = await context.params;
    return ok(await getTarget(account, 'CHARACTER', projectId, characterId));
  });
}
