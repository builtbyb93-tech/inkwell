import type { NextRequest } from 'next/server';
import { IdeaInput } from '@inkwell/contracts';
import { privateApi } from '@/server/private-api';
import { json, ok } from '@/server/http';
import { createIdea, listIdeas } from '@/server/ideas';
export function GET(request: NextRequest) {
  return privateApi(request, async (account) =>
    ok(await listIdeas(account, request.nextUrl.searchParams)),
  );
}
export function POST(request: NextRequest) {
  return privateApi(request, async (account) => {
    const row = await createIdea(account, await json(request, IdeaInput));
    return ok(row, 201, row.version);
  });
}
