import type { NextRequest } from 'next/server';
import { privateApi } from '@/server/private-api';
import { ok } from '@/server/http';
import { summary } from '@/server/records';
export function GET(request: NextRequest) {
  return privateApi(request, async (account) => ok(await summary(account)));
}
