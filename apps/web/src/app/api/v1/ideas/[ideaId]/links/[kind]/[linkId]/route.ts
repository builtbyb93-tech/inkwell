import type { NextRequest } from 'next/server';
import { privateApi } from '@/server/private-api';
import { ok, revision, notFound } from '@/server/http';
import { removeIdeaLink } from '@/server/idea-links';
type Context = { params: Promise<{ ideaId: string; kind: string; linkId: string }> };
export function DELETE(request: NextRequest, context: Context) {
  return privateApi(request, async (account) => {
    const { ideaId, kind, linkId } = await context.params;
    if (kind !== 'STORY' && kind !== 'SCENE') notFound();
    const result = await removeIdeaLink(account, ideaId, kind, linkId, revision(request));
    return ok(result, 200, result.ideaVersion);
  });
}
