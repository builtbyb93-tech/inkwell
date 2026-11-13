import type { NextRequest } from 'next/server';
import { privateApi } from '@/server/private-api';
import { json, ok, revision } from '@/server/http';
import { SceneCanonInput } from '@inkwell/contracts';
import { changeSceneCanon, sceneCanonReferences } from '@/server/plot-links';
import { HttpError } from '@/server/http';
type Context = { params: Promise<{ projectId: string; storyId: string; sceneId: string }> };
export function GET(request: NextRequest, context: Context) {
  return privateApi(request, async (a) => {
    const p = await context.params,
      search = new URLSearchParams(request.nextUrl.searchParams),
      kind = search.get('kind');
    if (kind !== 'CHARACTER' && kind !== 'LOCATION')
      throw new HttpError(400, 'VALIDATION_ERROR', 'Choose character or location references.');
    search.delete('kind');
    return ok(await sceneCanonReferences(a, p, p.sceneId, kind, search));
  });
}
export function POST(request: NextRequest, context: Context) {
  return privateApi(request, async (a) => {
    const p = await context.params;
    const row = await changeSceneCanon(
      a,
      p,
      p.sceneId,
      revision(request),
      await json(request, SceneCanonInput),
    );
    return ok(row, 201, row.sceneVersion);
  });
}
export function DELETE(request: NextRequest, context: Context) {
  return privateApi(request, async (a) => {
    const p = await context.params;
    const row = await changeSceneCanon(
      a,
      p,
      p.sceneId,
      revision(request),
      await json(request, SceneCanonInput),
      true,
    );
    return ok(row, 200, row.sceneVersion);
  });
}
