import type { NextRequest } from 'next/server';
import { privateApi } from '@/server/private-api';
import { ok } from '@/server/http';
import { snapshotOptions } from '@/server/snapshots';
export function GET(request: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  return privateApi(request, async (a) =>
    ok(await snapshotOptions(a, (await params).projectId, request.nextUrl.searchParams)),
  );
}
