import type { NextRequest } from 'next/server';
import { privateApi } from '@/server/private-api';
import { ok } from '@/server/http';
import { searchWorkspace } from '@/server/search';
export function GET(request: NextRequest) {
  return privateApi(request, async (account) =>
    ok(await searchWorkspace(account, request.nextUrl.searchParams)),
  );
}
