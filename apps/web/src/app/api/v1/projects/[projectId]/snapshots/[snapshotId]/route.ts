import type { NextRequest } from 'next/server';
import { privateApi } from '@/server/private-api';
import { ok } from '@/server/http';
import { previewSnapshot } from '@/server/snapshots';
export function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; snapshotId: string }> },
) {
  return privateApi(request, async (a) => {
    const p = await params;
    return ok(await previewSnapshot(a, p.projectId, p.snapshotId));
  });
}
