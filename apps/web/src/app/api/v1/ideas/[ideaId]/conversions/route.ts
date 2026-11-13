import type { NextRequest } from 'next/server';
import { IdeaConversionInput } from '@inkwell/contracts';
import { privateApi } from '@/server/private-api';
import { json, ok, revision } from '@/server/http';
import { convertIdea, listConversions } from '@/server/idea-conversions';
type Context = { params: Promise<{ ideaId: string }> };
export function GET(request: NextRequest, context: Context) {
  return privateApi(request, async (account) =>
    ok(await listConversions(account, (await context.params).ideaId, request.nextUrl.searchParams)),
  );
}
export function POST(request: NextRequest, context: Context) {
  return privateApi(request, async (account) => {
    const result = await convertIdea(
      account,
      (await context.params).ideaId,
      revision(request),
      request.headers.get('idempotency-key') ?? '',
      await json(request, IdeaConversionInput),
    );
    return ok(result, result.replayed ? 200 : 201, result.ideaVersion);
  });
}
