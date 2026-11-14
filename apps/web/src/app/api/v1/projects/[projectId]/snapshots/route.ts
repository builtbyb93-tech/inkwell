import type { NextRequest } from 'next/server';
import { SnapshotInput } from '@inkwell/contracts';
import { privateApi } from '@/server/private-api';
import { json, ok } from '@/server/http';
import { createSnapshot, listSnapshots } from '@/server/snapshots';
import { limit } from '@/server/rate-limit';
type Context = { params: Promise<{ projectId: string }> };
export function GET(request: NextRequest, { params }: Context) {
  return privateApi(request, async (a) =>
    ok(await listSnapshots(a, (await params).projectId, request.nextUrl.searchParams)),
  );
}
export function POST(request: NextRequest, { params }: Context) {
  return privateApi(request, async (a) => {
    await limit('create-snapshot', a.id, 5);
    return ok(
      await createSnapshot(a, (await params).projectId, await json(request, SnapshotInput, 65536)),
      201,
    );
  });
}
