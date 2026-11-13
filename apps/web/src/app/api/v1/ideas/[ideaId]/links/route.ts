import type { NextRequest } from 'next/server';
import { IdeaLinkInput } from '@inkwell/contracts';
import { privateApi } from '@/server/private-api';
import { json, ok, revision, HttpError } from '@/server/http';
import { addIdeaLink, listIdeaLinks } from '@/server/idea-links';
type Context = { params: Promise<{ ideaId: string }> };
export function GET(request: NextRequest, context: Context) {
  return privateApi(request, async (account) => {
    const params = new URLSearchParams(request.nextUrl.searchParams);
    const kind = params.get('kind');
    if (kind !== 'STORY' && kind !== 'SCENE')
      throw new HttpError(400, 'VALIDATION_ERROR', 'Choose story or scene links.');
    params.delete('kind');
    return ok(await listIdeaLinks(account, (await context.params).ideaId, kind, params));
  });
}
export function POST(request: NextRequest, context: Context) {
  return privateApi(request, async (account) => {
    const result = await addIdeaLink(
      account,
      (await context.params).ideaId,
      revision(request),
      await json(request, IdeaLinkInput),
    );
    return ok(result, 201, result.ideaVersion);
  });
}
